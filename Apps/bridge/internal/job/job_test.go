package job

import (
	"encoding/base64"
	"errors"
	"strings"
	"testing"
)

var languages = map[string]string{"label": "ZPL", "receipt": "ESCPOS"}

func validZPL() Request {
	return Request{
		JobID:    "job-1",
		Target:   "label",
		Language: "ZPL",
		Encoding: "base64",
		Payload:  base64.StdEncoding.EncodeToString([]byte("^XA^XZ")),
		Copies:   1,
	}
}

func TestFromRequest_Valid(t *testing.T) {
	j, err := FromRequest(validZPL(), languages)
	if err != nil {
		t.Fatalf("FromRequest: %v", err)
	}
	if j.ID != "job-1" || j.Target != "label" || j.Language != "ZPL" || j.Copies != 1 {
		t.Errorf("unexpected job: %+v", j)
	}
	if string(j.Payload) != "^XA^XZ" {
		t.Errorf("Payload = %q, want decoded bytes", j.Payload)
	}
}

func TestFromRequest_Rejections(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*Request)
		wantSub string
	}{
		{"empty jobId", func(r *Request) { r.JobID = "" }, "jobId is required"},
		{"unknown target", func(r *Request) { r.Target = "cash-drawer" }, "target must be"},
		{"unknown language", func(r *Request) { r.Language = "PCL" }, "language must be"},
		{"language mismatch", func(r *Request) { r.Language = "ESCPOS" }, "language mismatch"},
		{"bad encoding", func(r *Request) { r.Encoding = "utf8" }, "encoding must be"},
		{"bad base64", func(r *Request) { r.Payload = "not-base64!!!" }, "not valid base64"},
		{"empty payload", func(r *Request) { r.Payload = "" }, "must not be empty"},
		{"zero copies", func(r *Request) { r.Copies = 0 }, "copies must be at least 1"},
		{"negative copies", func(r *Request) { r.Copies = -3 }, "copies must be at least 1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := validZPL()
			tt.mutate(&req)

			_, err := FromRequest(req, languages)
			if err == nil {
				t.Fatalf("expected an error, got none")
			}
			var ve *ValidationError
			if !errors.As(err, &ve) {
				t.Errorf("error is %T, want *ValidationError", err)
			}
			if got := err.Error(); !strings.Contains(got, tt.wantSub) {
				t.Errorf("error = %q, want it to contain %q", got, tt.wantSub)
			}
		})
	}
}

func TestFromRequest_ESCPOSMatchesReceipt(t *testing.T) {
	req := Request{
		JobID:    "job-2",
		Target:   "receipt",
		Language: "ESCPOS",
		Encoding: "base64",
		Payload:  base64.StdEncoding.EncodeToString([]byte{0x1b, 0x40}),
		Copies:   3,
	}
	j, err := FromRequest(req, languages)
	if err != nil {
		t.Fatalf("FromRequest: %v", err)
	}
	if j.Copies != 3 {
		t.Errorf("Copies = %d, want 3", j.Copies)
	}
}

func TestFromRequest_AcceptsEPLWhenTheLabelPrinterIsConfiguredForIt(t *testing.T) {
	eplLanguages := map[string]string{"label": "EPL", "receipt": "ESCPOS"}
	req := validZPL()
	req.Language = "EPL"
	req.Payload = base64.StdEncoding.EncodeToString([]byte("N\r\nP1\r\n"))

	j, err := FromRequest(req, eplLanguages)
	if err != nil {
		t.Fatalf("FromRequest: %v", err)
	}
	if j.Language != "EPL" {
		t.Errorf("Language = %q, want EPL", j.Language)
	}
}

func TestFromRequest_RejectsEPLWhenTheLabelPrinterSpeaksZPL(t *testing.T) {
	// The guard that stops a mismatched label language reaching hardware that cannot read it —
	// the failure mode that prints nothing at all and gives no error to diagnose.
	req := validZPL()
	req.Language = "EPL"

	_, err := FromRequest(req, languages) // languages has label=ZPL
	if err == nil || !strings.Contains(err.Error(), "language mismatch") {
		t.Fatalf("FromRequest error = %v, want a language mismatch", err)
	}
}

func TestFromRequest_LogoURLRoundTrips(t *testing.T) {
	req := validZPL()
	req.Target, req.Language = "receipt", "ESCPOS"
	req.LogoURL = "https://r2.example.com/store-logo.png"

	j, err := FromRequest(req, languages)
	if err != nil {
		t.Fatalf("FromRequest: %v", err)
	}
	if j.LogoURL != req.LogoURL {
		t.Errorf("LogoURL = %q, want %q", j.LogoURL, req.LogoURL)
	}
}

func TestFromRequest_AbsentLogoURLIsEmpty(t *testing.T) {
	// No LogoURL set at all — the Sprint 7 web change doesn't exist yet in this test's world, and
	// that must not be a validation error (protocol 1.1 backward compatibility, see job.go).
	j, err := FromRequest(validZPL(), languages)
	if err != nil {
		t.Fatalf("FromRequest: %v", err)
	}
	if j.LogoURL != "" {
		t.Errorf("LogoURL = %q, want empty", j.LogoURL)
	}
}
