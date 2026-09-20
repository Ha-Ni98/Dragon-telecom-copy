package httpapi

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"dragon-telecom/bridge/internal/config"
	"dragon-telecom/bridge/internal/job"
)

// fakeSink records every job handed to it, or returns a configured error (standing in for a full
// queue) — see Sink's doc comment on why Sprint 2 tests against a stub rather than the real
// queue/device layers.
type fakeSink struct {
	mu    sync.Mutex
	calls []job.Job
	err   error
}

func (f *fakeSink) Submit(j job.Job) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	f.calls = append(f.calls, j)
	return nil
}

func (f *fakeSink) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func newServer(t *testing.T, allowedOrigins []string, sink Sink) *Server {
	t.Helper()
	cfg := config.Default()
	cfg.Printers.Label.QueueName = "TestZebra"
	cfg.Printers.Receipt.Host = "192.168.1.50"
	if allowedOrigins != nil {
		cfg.AllowedOrigins = allowedOrigins
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("test config is invalid: %v", err)
	}
	return New(cfg, testLogger(), sink, "1.0.0-test")
}

func validPrintBody() job.Request {
	return job.Request{
		JobID:    "job-1",
		Target:   "label",
		Language: "ZPL",
		Encoding: "base64",
		Payload:  base64.StdEncoding.EncodeToString([]byte("^XA^XZ")),
		Copies:   1,
	}
}

func doRequest(t *testing.T, h http.Handler, method, path, origin string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// --- CORS: wildcard mode (the v1.0 default) -------------------------------------------------

func TestCORS_WildcardEchoesStarAndSkipsVary(t *testing.T) {
	s := newServer(t, []string{"*"}, &fakeSink{})
	rec := doRequest(t, s.Handler(), http.MethodGet, "/status", "https://shop.vercel.app", nil)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Access-Control-Allow-Origin = %q, want \"*\"", got)
	}
	if got := rec.Header().Get("Vary"); got != "" {
		t.Errorf("Vary = %q, want empty in wildcard mode", got)
	}
}

func TestCORS_NeverSendsAllowCredentials(t *testing.T) {
	s := newServer(t, []string{"*"}, &fakeSink{})

	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/status"},
		{http.MethodOptions, "/print"},
	} {
		rec := doRequest(t, s.Handler(), tc.method, tc.path, "https://shop.vercel.app", nil)
		if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
			t.Errorf("%s %s: Access-Control-Allow-Credentials = %q, want unset", tc.method, tc.path, got)
		}
	}
}

// --- CORS: explicit allow-list mode ----------------------------------------------------------

func TestCORS_ExplicitList_EchoesExactOriginWithVary(t *testing.T) {
	s := newServer(t, []string{"https://shop.vercel.app"}, &fakeSink{})
	rec := doRequest(t, s.Handler(), http.MethodGet, "/status", "https://shop.vercel.app", nil)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://shop.vercel.app" {
		t.Errorf("Access-Control-Allow-Origin = %q, want the exact origin echoed", got)
	}
	if got := rec.Header().Get("Vary"); got != "Origin" {
		t.Errorf("Vary = %q, want \"Origin\"", got)
	}
}

func TestCORS_ExplicitList_DisallowedOriginGetsNoACAOOnActualRequest(t *testing.T) {
	s := newServer(t, []string{"https://shop.vercel.app"}, &fakeSink{})
	rec := doRequest(t, s.Handler(), http.MethodGet, "/status", "https://evil.example", nil)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want unset for a disallowed origin", got)
	}
	// The handler still runs — the browser is what enforces the missing header, not us.
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200 (handler still executes)", rec.Code)
	}
}

func TestCORS_ExplicitList_DisallowedOriginPreflightIs403(t *testing.T) {
	s := newServer(t, []string{"https://shop.vercel.app"}, &fakeSink{})
	rec := doRequest(t, s.Handler(), http.MethodOptions, "/print", "https://evil.example", nil)

	if rec.Code != http.StatusForbidden {
		t.Errorf("preflight status = %d, want 403", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want unset on a rejected preflight", got)
	}
}

// --- Preflight (OPTIONS /print) ---------------------------------------------------------------

func TestPreflight_SendsRequiredHeaders(t *testing.T) {
	s := newServer(t, []string{"*"}, &fakeSink{})
	rec := doRequest(t, s.Handler(), http.MethodOptions, "/print", "https://shop.vercel.app", nil)

	if rec.Code != http.StatusNoContent {
		t.Errorf("preflight status = %d, want 204", rec.Code)
	}
	want := map[string]string{
		"Access-Control-Allow-Origin":          "*",
		"Access-Control-Allow-Methods":         "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers":         "content-type",
		"Access-Control-Max-Age":               "600",
		"Access-Control-Allow-Private-Network": "true",
	}
	for header, wantVal := range want {
		if got := rec.Header().Get(header); got != wantVal {
			t.Errorf("%s = %q, want %q", header, got, wantVal)
		}
	}
}

// --- POST /print: happy path + dedupe ----------------------------------------------------------

func TestPrint_AcceptsValidJob(t *testing.T) {
	sink := &fakeSink{}
	s := newServer(t, []string{"*"}, sink)
	rec := doRequest(t, s.Handler(), http.MethodPost, "/print", "https://shop.vercel.app", validPrintBody())

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var resp printResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !resp.OK {
		t.Errorf("resp.OK = false, want true")
	}
	if sink.callCount() != 1 {
		t.Errorf("sink called %d times, want 1", sink.callCount())
	}
}

func TestPrint_DuplicateJobIdSubmitsOnce(t *testing.T) {
	sink := &fakeSink{}
	s := newServer(t, []string{"*"}, sink)
	h := s.Handler()

	rec1 := doRequest(t, h, http.MethodPost, "/print", "https://shop.vercel.app", validPrintBody())
	rec2 := doRequest(t, h, http.MethodPost, "/print", "https://shop.vercel.app", validPrintBody())

	if rec1.Code != http.StatusOK || rec2.Code != http.StatusOK {
		t.Fatalf("expected both responses to be 200, got %d and %d", rec1.Code, rec2.Code)
	}
	var r1, r2 printResponse
	_ = json.Unmarshal(rec1.Body.Bytes(), &r1)
	_ = json.Unmarshal(rec2.Body.Bytes(), &r2)
	if !r1.OK || !r2.OK {
		t.Errorf("both responses should report ok:true, got %+v and %+v", r1, r2)
	}
	if got := sink.callCount(); got != 1 {
		t.Errorf("sink called %d times for a duplicate jobId, want exactly 1", got)
	}
}

func TestPrint_DifferentJobIdsBothSubmit(t *testing.T) {
	sink := &fakeSink{}
	s := newServer(t, []string{"*"}, sink)
	h := s.Handler()

	body1 := validPrintBody()
	body2 := validPrintBody()
	body2.JobID = "job-2"

	doRequest(t, h, http.MethodPost, "/print", "https://shop.vercel.app", body1)
	doRequest(t, h, http.MethodPost, "/print", "https://shop.vercel.app", body2)

	if got := sink.callCount(); got != 2 {
		t.Errorf("sink called %d times for two distinct jobIds, want 2", got)
	}
}

// --- POST /print: 4xx shapes --------------------------------------------------------------------

func TestPrint_RejectionsAre4xxWithOkFalse(t *testing.T) {
	tests := []struct {
		name       string
		mutate     func(*job.Request)
		wantStatus int
		wantSub    string
	}{
		{"missing jobId", func(r *job.Request) { r.JobID = "" }, http.StatusBadRequest, "jobId"},
		{"unknown target", func(r *job.Request) { r.Target = "cash-drawer" }, http.StatusBadRequest, "target"},
		{"language mismatch", func(r *job.Request) { r.Language = "ESCPOS" }, http.StatusBadRequest, "language mismatch"},
		{"bad encoding", func(r *job.Request) { r.Encoding = "utf8" }, http.StatusBadRequest, "encoding"},
		{"bad base64", func(r *job.Request) { r.Payload = "!!!not-base64" }, http.StatusBadRequest, "base64"},
		{"zero copies", func(r *job.Request) { r.Copies = 0 }, http.StatusBadRequest, "copies"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newServer(t, []string{"*"}, &fakeSink{})
			body := validPrintBody()
			tt.mutate(&body)

			rec := doRequest(t, s.Handler(), http.MethodPost, "/print", "https://shop.vercel.app", body)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d (body: %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}
			var resp printResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("unmarshal response: %v", err)
			}
			if resp.OK {
				t.Errorf("resp.OK = true, want false")
			}
			if !strings.Contains(resp.Error, tt.wantSub) {
				t.Errorf("resp.Error = %q, want it to contain %q", resp.Error, tt.wantSub)
			}
		})
	}
}

func TestPrint_MalformedJSONIs400(t *testing.T) {
	s := newServer(t, []string{"*"}, &fakeSink{})
	req := httptest.NewRequest(http.MethodPost, "/print", strings.NewReader("{not json"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestPrint_BodyTooLargeIs413(t *testing.T) {
	s := newServer(t, []string{"*"}, &fakeSink{})
	body := validPrintBody()
	body.Payload = base64.StdEncoding.EncodeToString(bytes.Repeat([]byte("a"), maxBodyBytes+1024))

	rec := doRequest(t, s.Handler(), http.MethodPost, "/print", "https://shop.vercel.app", body)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("status = %d, want 413", rec.Code)
	}
}

// --- POST /print: sink failure = queue full ------------------------------------------------------

func TestPrint_SinkErrorIs503(t *testing.T) {
	sink := &fakeSink{err: errors.New("queue full")}
	s := newServer(t, []string{"*"}, sink)

	rec := doRequest(t, s.Handler(), http.MethodPost, "/print", "https://shop.vercel.app", validPrintBody())

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want 503", rec.Code)
	}
	var resp printResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.OK {
		t.Errorf("resp.OK = true, want false")
	}
}

// --- GET /status -----------------------------------------------------------------------------

func TestStatus_ReportsConfiguredPrinters(t *testing.T) {
	s := newServer(t, []string{"*"}, &fakeSink{})
	rec := doRequest(t, s.Handler(), http.MethodGet, "/status", "https://shop.vercel.app", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var resp statusResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !resp.OK {
		t.Errorf("resp.OK = false, want true")
	}
	if resp.Printers.Label.Language != "ZPL" || resp.Printers.Label.DPI != 203 {
		t.Errorf("label status = %+v", resp.Printers.Label)
	}
	if resp.Printers.Receipt.Language != "ESCPOS" || resp.Printers.Receipt.WidthMm != 80 {
		t.Errorf("receipt status = %+v", resp.Printers.Receipt)
	}
	// No prober wired until Sprint 3 — must report false, not fabricate true.
	if resp.Printers.Label.Connected || resp.Printers.Receipt.Connected {
		t.Errorf("expected connected:false for both printers with no prober configured")
	}
}

func TestStatus_ConnectedCallbackIsHonoured(t *testing.T) {
	cfg := config.Default()
	cfg.Printers.Label.QueueName = "TestZebra"
	cfg.Printers.Receipt.Host = "192.168.1.50"
	s := New(cfg, testLogger(), &fakeSink{}, "1.0.0-test", WithConnected(func(target string) bool {
		return target == "label"
	}))

	rec := doRequest(t, s.Handler(), http.MethodGet, "/status", "https://shop.vercel.app", nil)
	var resp statusResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)

	if !resp.Printers.Label.Connected {
		t.Error("label should report connected:true per the injected callback")
	}
	if resp.Printers.Receipt.Connected {
		t.Error("receipt should report connected:false per the injected callback")
	}
}

// --- Routing sanity --------------------------------------------------------------------------

func TestWrongMethodOnStatusIs405(t *testing.T) {
	s := newServer(t, []string{"*"}, &fakeSink{})
	rec := doRequest(t, s.Handler(), http.MethodPost, "/status", "https://shop.vercel.app", nil)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want 405", rec.Code)
	}
}
