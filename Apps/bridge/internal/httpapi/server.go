// Package httpapi implements dtbridge's two HTTP endpoints — GET /status and POST /print — per
// Docs/Stage-04-Fixes/plans/bridge/print-bridge-protocol.md.
package httpapi

import (
	"net/http"

	"dragon-telecom/bridge/internal/config"
	"dragon-telecom/bridge/internal/dedupe"
	"dragon-telecom/bridge/internal/job"

	"log/slog"
)

// maxBodyBytes bounds a POST /print body. A 14-line supplier-invoice ZPL batch — the largest
// payload any web call site sends — runs to tens of KB; 8 MB is anti-abuse headroom, not a real
// ceiling. See print-bridge-plan-v1.md §4.
const maxBodyBytes = 8 << 20

// Sink is where a validated, de-duplicated job goes next: internal/queue's worker-per-target
// implementation (Sprint 5), which itself writes through internal/device (Sprint 3). Sprint 2
// ships only the HTTP/validation/dedupe layer, wired to a stub Sink — see cmd/dtbridge/main.go —
// so the full request lifecycle, including "a duplicate jobId reaches the sink exactly once", is
// already under test.
type Sink interface {
	// Submit hands off an already-validated job. A non-nil error means the job could not be
	// accepted (e.g. a full queue) and is reported to the web as 503, which is the signal to fall
	// back to the browser print dialog.
	Submit(j job.Job) error
}

// Server holds everything a request needs. It is stateless per-request; the mutable state
// (dedupe, and eventually the queue) lives behind its own concurrency-safe type.
type Server struct {
	cfg       *config.Config
	logger    *slog.Logger
	dedupe    *dedupe.Dedupe
	sink      Sink
	version   string
	languages map[string]string
	connected func(target string) bool
}

// Option customises a Server built by New.
type Option func(*Server)

// WithConnected overrides the /status "connected" callback. Without it every printer reports
// connected:false — accurate for Sprint 2, which has no device layer yet to probe. Sprint 3's
// background prober supplies the real one.
func WithConnected(f func(target string) bool) Option {
	return func(s *Server) { s.connected = f }
}

func New(cfg *config.Config, logger *slog.Logger, sink Sink, version string, opts ...Option) *Server {
	s := &Server{
		cfg:     cfg,
		logger:  logger,
		dedupe:  dedupe.New(dedupe.DefaultCapacity, dedupe.DefaultTTL),
		sink:    sink,
		version: version,
		languages: map[string]string{
			"label":   cfg.Printers.Label.Language,
			"receipt": cfg.Printers.Receipt.Language,
		},
		connected: func(string) bool { return false },
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Handler returns the routed, CORS-wrapped HTTP handler for both endpoints.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /status", s.withCORS(s.handleStatus))
	mux.HandleFunc("POST /print", s.withCORS(s.handlePrint))
	mux.HandleFunc("OPTIONS /print", s.handlePrintPreflight)
	return mux
}
