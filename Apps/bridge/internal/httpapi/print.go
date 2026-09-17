package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"dragon-telecom/bridge/internal/job"
)

type printResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, resp printResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(resp)
}

// handlePrint answers POST /print. Every rejection is a 4xx/5xx {"ok":false,"error":...} body,
// per protocol — the web's contract is "HTTP 2xx AND ok:true", so any other shape is already a
// correct failure signal without special-casing on the web side.
func (s *Server) handlePrint(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	var req job.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeJSON(w, http.StatusRequestEntityTooLarge, printResponse{OK: false, Error: "request body too large"})
			return
		}
		writeJSON(w, http.StatusBadRequest, printResponse{OK: false, Error: "malformed JSON body"})
		return
	}

	j, err := job.FromRequest(req, s.languages)
	if err != nil {
		s.logger.Warn("rejected print job", "jobId", req.JobID, "target", req.Target, "error", err)
		writeJSON(w, http.StatusBadRequest, printResponse{OK: false, Error: err.Error()})
		return
	}

	// Rule 4 (protocol): the web never retries, so jobId exists precisely so a human's
	// double-click — or a retry at some layer below the web's control — doesn't reach the sink
	// twice. Seen() is both the check and the insert; see internal/dedupe for why that must be
	// one call.
	if s.dedupe.Seen(j.ID) {
		s.logger.Info("duplicate jobId, not re-submitted", "jobId", j.ID, "target", j.Target)
		writeJSON(w, http.StatusOK, printResponse{OK: true})
		return
	}

	// Ack on queue, never on paper (protocol rule 3): Submit only needs to accept the job, not
	// wait for the device. A non-nil error here means the job could not even be queued (e.g. it's
	// full), which is the one case that must still reach the web as a failure.
	if err := s.sink.Submit(j); err != nil {
		s.logger.Error("sink rejected job", "jobId", j.ID, "target", j.Target, "error", err)
		writeJSON(w, http.StatusServiceUnavailable, printResponse{OK: false, Error: "print queue full"})
		return
	}

	s.logger.Info("job accepted", "jobId", j.ID, "target", j.Target, "language", j.Language,
		"copies", j.Copies, "bytes", len(j.Payload))
	writeJSON(w, http.StatusOK, printResponse{OK: true})
}
