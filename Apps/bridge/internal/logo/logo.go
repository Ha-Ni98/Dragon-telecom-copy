// Package logo builds the ESC/POS raster block for a receipt's store logo: fetch the PNG,
// decode, downscale (box filter), threshold to 1-bit, and hand the result to
// internal/escpos.BuildRasterBlock. Fail-open on every error path is the load-bearing contract
// here, owner-confirmed: a logo problem must never become a print problem — see
// print-bridge-plan-v1.md §5.
package logo

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	"image/png"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"dragon-telecom/bridge/internal/escpos"
)

const (
	FetchTimeout     = 3 * time.Second
	MaxBodyBytes     = 2 << 20 // 2 MB
	NegativeCacheTTL = 60 * time.Second
)

type cacheEntry struct {
	raster    []byte    // nil = a confirmed failure, held for NegativeCacheTTL
	expiresAt time.Time // only meaningful when raster == nil
}

// Builder is safe for concurrent use, though in this architecture only one queue worker (the
// receipt target's) ever calls it.
type Builder struct {
	logger       *slog.Logger
	maxWidthDots int
	widthDots    int // the receipt's total printable width; the real cap is min(maxWidthDots, widthDots)
	threshold    int
	cacheDir     string // "" disables the on-disk cache layer
	client       *http.Client

	mu    sync.Mutex
	cache map[string]cacheEntry
}

// Option customises a Builder built by NewBuilder.
type Option func(*Builder)

// WithHTTPClient overrides the default 3s-timeout client — tests use this to inject a short
// timeout against a deliberately slow server, rather than waiting out the real FetchTimeout.
func WithHTTPClient(c *http.Client) Option {
	return func(b *Builder) { b.client = c }
}

func NewBuilder(logger *slog.Logger, maxWidthDots, widthDots, threshold int, cacheDir string, opts ...Option) *Builder {
	b := &Builder{
		logger:       logger,
		maxWidthDots: maxWidthDots,
		widthDots:    widthDots,
		threshold:    threshold,
		cacheDir:     cacheDir,
		client:       &http.Client{Timeout: FetchTimeout},
		cache:        make(map[string]cacheEntry),
	}
	for _, opt := range opts {
		opt(b)
	}
	return b
}

// Build returns the ESC/POS raster block for logoURL, or nil on ANY failure — never an error.
// jobID is used only for log correlation on the one WARN line a failure produces.
func (b *Builder) Build(jobID, logoURL string) []byte {
	if logoURL == "" {
		return nil
	}

	if raster, negative := b.fromMemory(logoURL); raster != nil || negative {
		return raster
	}
	if raster, ok := b.fromDisk(logoURL); ok {
		b.storeMemory(logoURL, raster)
		return raster
	}

	raster, err := b.fetchAndBuild(logoURL)
	if err != nil {
		b.logger.Warn("logo unavailable, printing receipt without it",
			"jobId", jobID, "logoUrl", logoURL, "error", err)
		b.mu.Lock()
		b.cache[logoURL] = cacheEntry{raster: nil, expiresAt: time.Now().Add(NegativeCacheTTL)}
		b.mu.Unlock()
		return nil
	}

	b.storeMemory(logoURL, raster)
	b.storeDisk(logoURL, raster)
	return raster
}

// fromMemory reports (raster, negative). negative=true means "confirmed failure, still within
// its TTL — don't refetch yet", distinct from a plain cache miss.
func (b *Builder) fromMemory(logoURL string) (raster []byte, negative bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	entry, ok := b.cache[logoURL]
	if !ok {
		return nil, false
	}
	if entry.raster != nil {
		return entry.raster, false
	}
	if time.Now().Before(entry.expiresAt) {
		return nil, true
	}
	return nil, false // negative entry expired — try again
}

func (b *Builder) storeMemory(logoURL string, raster []byte) {
	b.mu.Lock()
	b.cache[logoURL] = cacheEntry{raster: raster}
	b.mu.Unlock()
}

// diskPath hashes the URL rather than using it as a filename directly — arbitrary URL characters
// are not safe path components, and a hash sidesteps that entirely.
func (b *Builder) diskPath(logoURL string) string {
	if b.cacheDir == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(logoURL))
	return filepath.Join(b.cacheDir, hex.EncodeToString(sum[:])+".raster")
}

func (b *Builder) fromDisk(logoURL string) ([]byte, bool) {
	path := b.diskPath(logoURL)
	if path == "" {
		return nil, false
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}
	return data, true
}

// storeDisk is best-effort: a cache-write failure (read-only filesystem, full disk, ...) must
// never fail the print itself, so it only logs.
func (b *Builder) storeDisk(logoURL string, raster []byte) {
	path := b.diskPath(logoURL)
	if path == "" {
		return
	}
	if err := os.MkdirAll(b.cacheDir, 0o755); err != nil {
		b.logger.Warn("logo disk cache: could not create cache dir", "cacheDir", b.cacheDir, "error", err)
		return
	}
	if err := os.WriteFile(path, raster, 0o644); err != nil {
		b.logger.Warn("logo disk cache: could not write cache file", "path", path, "error", err)
	}
}

func (b *Builder) fetchAndBuild(logoURL string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), FetchTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, logoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	resp, err := b.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	// A present-but-wrong Content-Type is rejected outright; an absent one falls through to the
	// decode step, which is the real test — some CDN/bucket configs omit the header entirely.
	if ct := resp.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "image/png") {
		return nil, fmt.Errorf("unexpected content type %q", ct)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, MaxBodyBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	if len(body) > MaxBodyBytes {
		return nil, fmt.Errorf("body exceeds %d bytes", MaxBodyBytes)
	}

	img, err := png.Decode(bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("decode png: %w", err)
	}

	raster := Raster(img, b.targetWidth(), b.threshold)
	if raster == nil {
		return nil, fmt.Errorf("image has no usable dimensions")
	}
	return raster, nil
}

func (b *Builder) targetWidth() int {
	w := b.maxWidthDots
	if b.widthDots > 0 && b.widthDots < w {
		w = b.widthDots
	}
	return w
}

// Raster downscales img to targetWidth (keeping aspect ratio), thresholds it to 1-bit, and wraps
// the result in the ESC/POS raster command sequence. Exported — unlike the rest of this file's
// plumbing — so tests can feed it an image directly without going through HTTP or PNG encoding.
func Raster(img image.Image, targetWidth, threshold int) []byte {
	if targetWidth <= 0 {
		return nil
	}
	bounds := img.Bounds()
	origW, origH := bounds.Dx(), bounds.Dy()
	if origW <= 0 || origH <= 0 {
		return nil
	}

	targetHeight := origH * targetWidth / origW
	if targetHeight <= 0 {
		targetHeight = 1
	}

	gray := boxDownscale(img, targetWidth, targetHeight)
	packed, widthBytes, height := threshold1Bit(gray, threshold)
	return escpos.BuildRasterBlock(packed, widthBytes, height)
}
