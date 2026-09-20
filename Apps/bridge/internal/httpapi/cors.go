package httpapi

import (
	"net/http"
	"slices"
)

// originAllowed reports whether a response may go to origin, and what value to put in
// Access-Control-Allow-Origin (empty = omit the header entirely).
//
// Wildcard mode (allowedOrigins: ["*"], the v1.0 default — print-bridge-plan-v1.md §4.1) is legal
// specifically because Apps/web/src/lib/print-bridge.ts always sends credentials: "omit"; a
// wildcard ACAO is only forbidden for credentialed requests. An explicit allowedOrigins list
// switches to echoing the exact matched origin plus Vary: Origin, which is what lets a shop
// tighten this down without a rebuild.
//
// An empty Origin header (no browser involved — e.g. a local curl health check) is let through
// with no ACAO value: there is no CORS check to satisfy or fail in that case, and a non-browser
// caller was never going to be stopped by a header-based mechanism anyway.
func (s *Server) originAllowed(origin string) (allowed bool, acao string) {
	if slices.Contains(s.cfg.AllowedOrigins, "*") {
		return true, "*"
	}
	if origin == "" {
		return true, ""
	}
	if slices.Contains(s.cfg.AllowedOrigins, origin) {
		return true, origin
	}
	return false, ""
}

func writeCORSHeaders(w http.ResponseWriter, acao string) {
	if acao == "" {
		return
	}
	w.Header().Set("Access-Control-Allow-Origin", acao)
	if acao != "*" {
		w.Header().Add("Vary", "Origin")
	}
}

// withCORS wraps GET /status and POST /print: it sets the response-side CORS headers a browser
// checks before letting the page read the body. It never blocks the handler itself — a
// disallowed explicit origin simply gets no Access-Control-Allow-Origin, which is what makes the
// browser refuse to hand the response to the page. Preflight rejection (the actual gate for a
// disallowed origin under an explicit list) is handlePrintPreflight's job.
func (s *Server) withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, acao := s.originAllowed(r.Header.Get("Origin"))
		writeCORSHeaders(w, acao)
		next(w, r)
	}
}

// handlePrintPreflight answers the mandatory OPTIONS /print preflight — POST + application/json
// is a non-simple request, so a browser always sends this before the real POST. Never sends
// Access-Control-Allow-Credentials: the web sends credentials: "omit" and the helper must not
// invite the browser to attach any.
func (s *Server) handlePrintPreflight(w http.ResponseWriter, r *http.Request) {
	allowed, acao := s.originAllowed(r.Header.Get("Origin"))
	if !allowed {
		w.WriteHeader(http.StatusForbidden)
		return
	}

	writeCORSHeaders(w, acao)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "content-type")
	w.Header().Set("Access-Control-Max-Age", "600")
	// Sent unconditionally, per print-bridge-protocol.md: Chrome's enforcement of Private Network
	// Access has shifted across versions (warning-only, then enforced, then a permission prompt),
	// and the header costs nothing under any of them.
	w.Header().Set("Access-Control-Allow-Private-Network", "true")
	w.WriteHeader(http.StatusNoContent)
}
