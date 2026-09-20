// Package job validates and decodes a POST /print request body into something the rest of
// dtbridge can act on.
package job

import (
	"encoding/base64"
	"fmt"
)

// Request is the wire shape of POST /print's body, exactly as print-bridge-protocol.md specifies
// and as Apps/web/src/types/print-bridge.types.ts's PrintJob sends it.
//
// LogoURL is a protocol 1.1 addition (print-bridge-plan-v1.md §3 G3) — optional and backward
// compatible in both directions: an old web client simply never sends it (json.Unmarshal leaves
// it as ""), and this helper already treats "" as "no logo" (see internal/logo.Builder.Build),
// so Sprint 6 can ship the whole logo pipeline before Sprint 7's web-side change exists to
// populate the field.
type Request struct {
	JobID    string `json:"jobId"`
	Target   string `json:"target"`
	Language string `json:"language"`
	Encoding string `json:"encoding"`
	Payload  string `json:"payload"`
	Copies   int    `json:"copies"`
	LogoURL  string `json:"logoUrl,omitempty"`
}

// Job is a validated, decoded Request — what the dedupe check and the sink operate on.
type Job struct {
	ID       string
	Target   string
	Language string
	Payload  []byte
	Copies   int
	LogoURL  string
}

// ValidationError is any rejection of a Request. Its Error() is sent verbatim as the "error"
// field of a 4xx {"ok":false,...} response — written for whoever is debugging the integration,
// not for a shop customer.
type ValidationError struct {
	msg string
}

func (e *ValidationError) Error() string { return e.msg }

func invalid(format string, args ...any) error {
	return &ValidationError{msg: fmt.Sprintf(format, args...)}
}

// FromRequest validates req and decodes its payload. expectedLanguage maps target -> the language
// dtbridge's config has that printer set to (config.PrinterConfig.Language). This is what makes
// D2 ("language is per-printer config") real: a job whose language does not match its target's
// configured printer is rejected here rather than silently written to hardware that cannot speak
// it — see print-bridge-plan-v1.md §3 G-none / D2 and the config comment on PrintersConfig.
func FromRequest(req Request, expectedLanguage map[string]string) (Job, error) {
	if req.JobID == "" {
		return Job{}, invalid("jobId is required")
	}

	want, knownTarget := expectedLanguage[req.Target]
	if !knownTarget {
		return Job{}, invalid("target must be %q or %q, got %q", "label", "receipt", req.Target)
	}

	if req.Language != "ZPL" && req.Language != "EPL" && req.Language != "ESCPOS" {
		return Job{}, invalid("language must be one of %q, %q or %q, got %q", "ZPL", "EPL", "ESCPOS", req.Language)
	}
	if req.Language != want {
		return Job{}, invalid("language mismatch: %s printer is configured for %s, got %s", req.Target, want, req.Language)
	}

	if req.Encoding != "base64" {
		return Job{}, invalid("encoding must be %q, got %q", "base64", req.Encoding)
	}

	payload, err := base64.StdEncoding.DecodeString(req.Payload)
	if err != nil {
		return Job{}, invalid("payload is not valid base64")
	}
	if len(payload) == 0 {
		return Job{}, invalid("payload must not be empty")
	}

	if req.Copies < 1 {
		return Job{}, invalid("copies must be at least 1, got %d", req.Copies)
	}

	return Job{
		ID:       req.JobID,
		Target:   req.Target,
		Language: req.Language,
		Payload:  payload,
		Copies:   req.Copies,
		LogoURL:  req.LogoURL,
	}, nil
}
