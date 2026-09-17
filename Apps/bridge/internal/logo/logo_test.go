package logo

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func fixturePNGBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewGray(image.Rect(0, 0, 4, 4))
	for y := 0; y < 4; y++ {
		for x := 0; x < 4; x++ {
			img.Set(x, y, color.Gray{Y: 0}) // solid black — any valid PNG works for these tests
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode fixture PNG: %v", err)
	}
	return buf.Bytes()
}

// --- happy path + caching -----------------------------------------------------------------

func TestBuild_EmptyURLReturnsNilWithoutNetworkCall(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	if got := b.Build("job-1", ""); got != nil {
		t.Errorf("Build with empty URL = % x, want nil", got)
	}
	if calls.Load() != 0 {
		t.Error("empty URL should never reach the network")
	}
}

func TestBuild_FetchesDecodesAndReturnsNonEmptyRaster(t *testing.T) {
	pngBytes := fixturePNGBytes(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.Write(pngBytes)
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	got := b.Build("job-1", srv.URL)

	if len(got) == 0 {
		t.Fatal("Build returned no raster for a valid PNG response")
	}
}

func TestBuild_SecondCallServedFromMemoryCache(t *testing.T) {
	pngBytes := fixturePNGBytes(t)
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "image/png")
		w.Write(pngBytes)
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	first := b.Build("job-1", srv.URL)
	second := b.Build("job-2", srv.URL)

	if !bytes.Equal(first, second) {
		t.Error("second Build returned different bytes than the first")
	}
	if calls.Load() != 1 {
		t.Errorf("server received %d requests, want exactly 1 (second call should hit the memory cache)", calls.Load())
	}
}

// --- disk cache ------------------------------------------------------------------------------

func TestBuild_WritesAndReadsDiskCache(t *testing.T) {
	pngBytes := fixturePNGBytes(t)
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "image/png")
		w.Write(pngBytes)
	}))
	defer srv.Close()

	dir := t.TempDir()
	b1 := NewBuilder(testLogger(), 384, 576, 128, dir)
	want := b1.Build("job-1", srv.URL)
	if len(want) == 0 {
		t.Fatal("first builder produced no raster")
	}

	entries, err := filepath.Glob(filepath.Join(dir, "*.raster"))
	if err != nil || len(entries) != 1 {
		t.Fatalf("expected exactly one .raster file in %s, got %v (err=%v)", dir, entries, err)
	}

	// A fresh Builder (empty in-memory cache) sharing the same disk cache dir must not hit the
	// network at all — the disk cache is what survives a restart.
	b2 := NewBuilder(testLogger(), 384, 576, 128, dir)
	got := b2.Build("job-2", srv.URL)

	if !bytes.Equal(got, want) {
		t.Errorf("disk-cached raster = % x, want % x", got, want)
	}
	if calls.Load() != 1 {
		t.Errorf("server received %d requests, want exactly 1 (second builder should read the disk cache)", calls.Load())
	}
}

func TestBuild_NoCacheDirDisablesDiskCache(t *testing.T) {
	pngBytes := fixturePNGBytes(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.Write(pngBytes)
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "") // cacheDir="" — disk cache off
	if got := b.Build("job-1", srv.URL); len(got) == 0 {
		t.Fatal("expected a raster even with the disk cache disabled")
	}
	// Nothing to assert about the filesystem here beyond "it didn't panic or error" — the point
	// is purely that an empty cacheDir is a valid, safe configuration.
}

// --- fail-open: every failure mode must return nil, log a WARN, and never error -------------

func TestBuild_HTTPErrorStatusFailsOpen(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	if got := b.Build("job-1", srv.URL); got != nil {
		t.Errorf("Build on 404 = % x, want nil", got)
	}
}

func TestBuild_WrongContentTypeFailsOpen(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte("<html>not a logo</html>"))
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	if got := b.Build("job-1", srv.URL); got != nil {
		t.Errorf("Build on wrong content type = % x, want nil", got)
	}
}

func TestBuild_MissingContentTypeFallsThroughToDecode(t *testing.T) {
	// No Content-Type header at all: must not be rejected outright (some CDNs omit it) — the
	// PNG decode step is the real test. A valid PNG with no header should still succeed.
	pngBytes := fixturePNGBytes(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(pngBytes) // deliberately no Content-Type
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	if got := b.Build("job-1", srv.URL); len(got) == 0 {
		t.Error("Build with no Content-Type header should still succeed for a valid PNG body")
	}
}

func TestBuild_NonPNGBodyFailsOpen(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.Write([]byte("not actually a png"))
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	if got := b.Build("job-1", srv.URL); got != nil {
		t.Errorf("Build on undecodable body = % x, want nil", got)
	}
}

func TestBuild_OversizedBodyFailsOpen(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.Write(make([]byte, MaxBodyBytes+1024))
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	if got := b.Build("job-1", srv.URL); got != nil {
		t.Errorf("Build on oversized body = % x, want nil", got)
	}
}

func TestBuild_UnreachableServerFailsOpen(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	url := srv.URL
	srv.Close() // nothing listening on this address anymore

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	if got := b.Build("job-1", url); got != nil {
		t.Errorf("Build against a closed server = % x, want nil", got)
	}
}

func TestBuild_SlowServerTimesOutAndFailsOpen(t *testing.T) {
	block := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-block // never responds within the test's lifetime unless we unblock it
	}))
	// Defers run LIFO: close(block) must fire BEFORE srv.Close(), or Close() deadlocks waiting
	// for the still-blocked handler goroutine to exit. Registering srv.Close() first (so it
	// executes last) is what makes that ordering hold.
	defer srv.Close()
	defer close(block)

	// A short client timeout, injected via WithHTTPClient, so the test doesn't have to wait out
	// the real 3s FetchTimeout.
	b := NewBuilder(testLogger(), 384, 576, 128, "", WithHTTPClient(&http.Client{Timeout: 50 * time.Millisecond}))

	start := time.Now()
	got := b.Build("job-1", srv.URL)
	elapsed := time.Since(start)

	if got != nil {
		t.Errorf("Build against a slow server = % x, want nil", got)
	}
	if elapsed > time.Second {
		t.Errorf("Build took %v, want it to fail fast on the injected client timeout", elapsed)
	}
}

func TestBuild_LogoDisabledConfigIsCallerResponsibility(t *testing.T) {
	// logo.enabled:false is handled by the caller never constructing/wiring a Builder for that
	// target (see cmd/dtbridge/main.go) — Builder itself has no "enabled" concept, so there is
	// nothing to test here beyond documenting the boundary. This test exists so that boundary
	// isn't silently unverified.
	t.Skip("logo.enabled is enforced by the caller not wiring a Builder — see main.go")
}

// --- negative cache ----------------------------------------------------------------------------

func TestBuild_FailureIsNegativeCached(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	b.Build("job-1", srv.URL)
	b.Build("job-2", srv.URL)

	if calls.Load() != 1 {
		t.Errorf("server received %d requests, want exactly 1 (second failure should hit the negative cache)", calls.Load())
	}
}

func TestBuild_NegativeCacheExpiresAndRetries(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	b := NewBuilder(testLogger(), 384, 576, 128, "")
	b.Build("job-1", srv.URL)

	// Reach directly into the cache to simulate the negative TTL already having elapsed, rather
	// than sleeping 60 real seconds in a test.
	b.mu.Lock()
	entry := b.cache[srv.URL]
	entry.expiresAt = time.Now().Add(-time.Second)
	b.cache[srv.URL] = entry
	b.mu.Unlock()

	b.Build("job-2", srv.URL)

	if calls.Load() != 2 {
		t.Errorf("server received %d requests, want 2 (an expired negative entry must retry)", calls.Load())
	}
}
