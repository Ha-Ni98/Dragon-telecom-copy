// Package device writes raw print bytes to a physical printer, and probes whether one is
// reachable for GET /status. Nothing here parses ZPL or ESC/POS — that would violate the
// byte-pipe rule in Docs/Stage-04-Fixes/plans/bridge/print-bridge-protocol.md.
package device

// Writer sends one job's raw bytes to a physical printer. The queue (Sprint 5) calls
// Open → Write → Close exactly once per required copy, per print-bridge-plan-v1.md §4's request
// lifecycle. Every implementation is a complete cycle per call — nothing here holds a connection
// open between jobs, since a shop counter prints too rarely for that to matter and a stale open
// socket/handle is a worse failure mode than reopening each time.
type Writer interface {
	// Open prepares the device: dials, opens the file/handle, or similar. Called once per job.
	Open() error
	// Write sends payload. Only called after a successful Open.
	Write(payload []byte) error
	// Close releases whatever Open acquired. Always called, even after a failed Write, so a
	// partial job can never leak a socket or file handle.
	Close() error
}
