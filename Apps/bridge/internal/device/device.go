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

// JobIDReporter is an optional interface a Writer may implement when the OS hands back an
// identifier for the job it just accepted. Only the Windows spooler has such a concept — a TCP
// socket or a device file does not — so internal/queue type-asserts for it rather than forcing
// every backend to carry a meaningless method, the same way net/http treats http.Flusher.
//
// It exists because "we handed the bytes over successfully" and "paper came out" are different
// claims: when a print silently does nothing, this number is what lets a dtbridge log line be
// matched against the job Windows actually queued.
type JobIDReporter interface {
	LastJobID() uint32
}
