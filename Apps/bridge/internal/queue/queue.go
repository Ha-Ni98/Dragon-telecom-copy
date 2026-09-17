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

// Target bundles what one worker needs for its printer: the device to write to, and how to
// rewrite a payload before writing.
type Target struct {
	Writer  device.Writer
	Rewrite RewriteFunc
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

	n := copiesFor(j.Language, j.Copies)
	for i := 1; i <= n; i++ {
		if err := t.Writer.Write(payload); err != nil {
			logger.Error("device write failed", "jobId", j.ID, "target", target, "copy", i, "of", n, "error", err)
			return
		}
	}
	logger.Info("job written to device", "jobId", j.ID, "target", target, "writes", n, "bytes", len(payload))
}

// copiesFor implements the protocol's copies rule — "the most likely thing to get wrong": ZPL
// already carries its copy count in ^PQ (one per ^XA…^XZ block in a batch), so the payload is
// written exactly once regardless of what `copies` says. ESC/POS has no such mechanism, so the
// payload is written `copies` times.
func copiesFor(language string, copies int) int {
	if language == "ZPL" {
		return 1
	}
	if copies < 1 {
		return 1
	}
	return copies
}
