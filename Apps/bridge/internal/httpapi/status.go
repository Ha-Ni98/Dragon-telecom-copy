package httpapi

import (
	"encoding/json"
	"net/http"
)

type printerStatus struct {
	Connected bool   `json:"connected"`
	Language  string `json:"language"`
	DPI       int    `json:"dpi,omitempty"`
	WidthMm   int    `json:"widthMm,omitempty"`
}

type statusResponse struct {
	OK       bool `json:"ok"`
	Printers struct {
		Label   printerStatus `json:"label"`
		Receipt printerStatus `json:"receipt"`
	} `json:"printers"`
	Version string `json:"version"`
}

// handleStatus answers GET /status. No auth, per protocol — and it must stay cheap: the web
// aborts at 1.5s, so this never does I/O of its own. "connected" is whatever s.connected reports
// (a background prober from Sprint 3 onward); the protocol treats it as informational only — the
// web does not gate on it, the POST /print is the real test.
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	resp := statusResponse{OK: true, Version: s.version}
	resp.Printers.Label = printerStatus{
		Connected: s.connected("label"),
		Language:  s.cfg.Printers.Label.Language,
		DPI:       s.cfg.Printers.Label.DPI,
	}
	resp.Printers.Receipt = printerStatus{
		Connected: s.connected("receipt"),
		Language:  s.cfg.Printers.Receipt.Language,
		WidthMm:   s.cfg.Printers.Receipt.WidthMm,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp) // best-effort; nothing to do if the client already hung up
}
