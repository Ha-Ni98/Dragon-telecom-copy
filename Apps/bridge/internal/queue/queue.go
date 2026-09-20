// Package queue implements the ack-on-enqueue print queue: one worker goroutine per target,
// serialising writes to that target's device so two cashiers hammering Print cannot interleave
// two receipts into one stream. See print-bridge-plan-v1.md §4 ("Request lifecycle").
package queue

import (
	"fmt"
	"log/slog"

	"dragon-telecom/bridge/internal/device"
	"dragon-telecom/bridge/internal/job"
)

// DefaultDepth is the per-target channel capacity. A full queue is the only enqueue-time failure
// — the web treats it as a 503 and falls back to the browser print dialog, which is the correct
// outcome per the protocol.
const DefaultDepth = 16

// RewriteFunc edits a job's payload before it is written — the one place the helper is allowed to
// touch bytes, per print-bridge-protocol.md's hardware-override section (cut command, code
// page). nil means "auto": leave the web's bytes untouched.
type RewriteFunc func(payload []byte) []byte

// LogoFunc returns the ESC/POS raster block to prepend ahead of a job's payload, or nil for "no
// logo" — always fail-open (see internal/logo.Builder.Build); writeJob never inspects why a logo
// was skipped, it just doesn't prepend one. nil means this target never attempts a logo at all
// (labels, or a receipt printer with logo.enabled: false).
type LogoFunc func(jobID, logoURL string) []byte

// Target bundles what one worker needs for its printer: the device to write to, how to rewrite a
// payload before writing, and how to build a logo block to prepend.
type Target struct {
	Writer  device.Writer
	Rewrite RewriteFunc
	Logo    LogoFunc
}

// Queue owns one worker goroutine per configured target and implements httpapi.Sink.
type Queue struct {
	logger  *slog.Logger
	targets map[string]chan job.Job
}

// New starts one worker per entry in targets. depth <= 0 uses DefaultDepth.
func New(logger *slog.Logger, targets map[string]Target, depth int) *Queue {
	if depth <= 0 {
		depth = DefaultDepth
	}
	q := &Queue{logger: logger, targets: make(map[string]chan job.Job, len(targets))}
	for name, t := range targets {
		ch := make(chan job.Job, depth)
		q.targets[name] = ch
		go worker(logger, name, t, ch)
	}
	return q
}

// Submit implements httpapi.Sink: hand off an already-validated, de-duplicated job. Never blocks
// — a full channel is reported as an error immediately rather than stalling the HTTP handler,
// which is what protocol rule 3 (ack on queue, not on paper) requires.
func (q *Queue) Submit(j job.Job) error {
	ch, ok := q.targets[j.Target]
	if !ok {
		return fmt.Errorf("no queue registered for target %q", j.Target)
	}
	select {
	case ch <- j:
		return nil
	default:
		return fmt.Errorf("print queue full for target %q", j.Target)
	}
}

// Stop closes every target's channel so each worker can drain in-flight jobs and exit. Not
// required for process-exit correctness — the OS reclaims everything on exit — but it keeps
// tests deterministic and gives a clean shutdown path if main.go ever wants one.
func (q *Queue) Stop() {
	for _, ch := range q.targets {
		close(ch)
	}
}

func worker(logger *slog.Logger, target string, t Target, jobs <-chan job.Job) {
	for j := range jobs {
		writeJob(logger, target, t, j)
	}
}

// writeJob is the request lifecycle's "device.Open() → Write() → Close(); errors go to the log,
// never to the client" — the ack already happened when Submit enqueued the job, so nothing here
// can report back to the web even on failure. That is deliberate: see print-bridge-plan-v1.md's
// note on ack-on-queue vs. device errors being in tension by design.
func writeJob(logger *slog.Logger, target string, t Target, j job.Job) {
	if err := t.Writer.Open(); err != nil {
		logger.Error("device open failed", "jobId", j.ID, "target", target, "error", err)
		return
	}
	defer func() {
		if err := t.Writer.Close(); err != nil {
			logger.Error("device close failed", "jobId", j.ID, "target", target, "error", err)
		}
	}()

	payload := j.Payload
	if t.Rewrite != nil {
		payload = t.Rewrite(payload)
	}

	// Logo prepending happens AFTER Rewrite, deliberately: the logo block is raw binary pixel
	// data, not CP437 text, and must never pass through RewriteCodePage's transcode — only the
	// web's own payload is text. Prepending (not appending) means a copies>1 loop below repeats
	// the whole logoBlock+payload pair per copy, matching print-bridge-plan-v1.md §5.
	if t.Logo != nil {
		if block := t.Logo(j.ID, j.LogoURL); len(block) > 0 {
			combined := make([]byte, 0, len(block)+len(payload))
			combined = append(combined, block...)
			combined = append(combined, payload...)
			payload = combined
		}
	}

	n := copiesFor(j.Language, j.Copies)
	for i := 1; i <= n; i++ {
		if err := t.Writer.Write(payload); err != nil {
			logger.Error("device write failed", "jobId", j.ID, "target", target, "copy", i, "of", n, "error", err)
			return
		}
	}

	// Deliberately NOT "printed" or "written to device". All this line can honestly claim is that
	// the device layer accepted every byte — for the Windows spooler that means the job was queued,
	// which is a long way from paper coming out. A Zebra that speaks a different label language
	// than the one it was sent will reach exactly this line and print nothing at all.
	attrs := []any{"jobId", j.ID, "target", target, "writes", n, "bytes", len(payload)}
	if reporter, ok := t.Writer.(device.JobIDReporter); ok {
		if id := reporter.LastJobID(); id != 0 {
			attrs = append(attrs, "spoolerJobId", id)
		}
	}
	logger.Info("job accepted by device (queued — not proof it printed)", attrs...)
}

// copiesFor implements the protocol's copies rule — "the most likely thing to get wrong".
//
// Both label languages carry their own copy count INSIDE the payload: ZPL as ^PQ (one per
// ^XA…^XZ block in a batch) and EPL as P (one per N…P block). Either is therefore written exactly
// once regardless of what `copies` says — writing it `copies` times would print copies² labels,
// so a request for 3 would yield 9. ESC/POS has no such mechanism, so the receipt payload really
// is written `copies` times.
func copiesFor(language string, copies int) int {
	if language == "ZPL" || language == "EPL" {
		return 1
	}
	if copies < 1 {
		return 1
	}
	return copies
}
