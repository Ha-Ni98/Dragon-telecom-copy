package queue

import (
	"bytes"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"dragon-telecom/bridge/internal/job"
)

// fakeWriter records every Open/Write/Close call so tests can assert on exactly what the queue
// sent to "the device" — standing in for a real device.Writer the same way device_test.go's
// listener/tempfile fixtures do, but in-process and instant.
//
// Synchronization: writeJob's Close always runs after every Write for a job has completed (it's
// deferred right after Open succeeds — see queue.go), so tests wait on closeDone, once per job,
// rather than racing the assertion against the worker goroutine still unwinding after its last
// Write.
type fakeWriter struct {
	mu sync.Mutex

	openErr  error
	writeErr error

	opens  int
	writes [][]byte
	closes int

	closeDone chan struct{}
}

func (w *fakeWriter) Open() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.opens++
	return w.openErr
}

func (w *fakeWriter) Write(payload []byte) error {
	w.mu.Lock()
	cp := append([]byte(nil), payload...)
	w.writes = append(w.writes, cp)
	err := w.writeErr
	w.mu.Unlock()
	return err
}

func (w *fakeWriter) Close() error {
	w.mu.Lock()
	w.closes++
	w.mu.Unlock()
	if w.closeDone != nil {
		w.closeDone <- struct{}{}
	}
	return nil
}

func (w *fakeWriter) snapshot() (opens int, writes [][]byte, closes int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.opens, append([][]byte(nil), w.writes...), w.closes
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func waitForClose(t *testing.T, done chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for the job to finish (Close was never called)")
	}
}

// jobIDWriter is a fakeWriter that also satisfies device.JobIDReporter, standing in for the
// Windows spooler backend (the only real one that has an OS-level job ID).
type jobIDWriter struct {
	fakeWriter
	id uint32
}

func (w *jobIDWriter) LastJobID() uint32 { return w.id }

func TestQueue_LogsSpoolerJobIDWhenTheWriterReportsOne(t *testing.T) {
	var logBuf bytes.Buffer
	var mu sync.Mutex
	logger := slog.New(slog.NewTextHandler(&lockedWriter{w: &logBuf, mu: &mu}, nil))

	w := &jobIDWriter{id: 42}
	w.closeDone = make(chan struct{}, 10)
	q := New(logger, map[string]Target{"label": {Writer: w}}, DefaultDepth)
	defer q.Stop()

	if err := q.Submit(job.Job{ID: "j1", Target: "label", Language: "ZPL", Payload: []byte("^XA^XZ"), Copies: 1}); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	mu.Lock()
	out := logBuf.String()
	mu.Unlock()
	if !strings.Contains(out, "spoolerJobId=42") {
		t.Errorf("log did not carry the spooler job id:\n%s", out)
	}
}

func TestQueue_OmitsSpoolerJobIDForWritersWithoutOne(t *testing.T) {
	// TCP and file backends have no such concept; the attribute must simply be absent rather than
	// logged as a meaningless zero.
	var logBuf bytes.Buffer
	var mu sync.Mutex
	logger := slog.New(slog.NewTextHandler(&lockedWriter{w: &logBuf, mu: &mu}, nil))

	w := &fakeWriter{closeDone: make(chan struct{}, 10)}
	q := New(logger, map[string]Target{"label": {Writer: w}}, DefaultDepth)
	defer q.Stop()

	if err := q.Submit(job.Job{ID: "j1", Target: "label", Language: "ZPL", Payload: []byte("^XA^XZ"), Copies: 1}); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	mu.Lock()
	out := logBuf.String()
	mu.Unlock()
	if strings.Contains(out, "spoolerJobId") {
		t.Errorf("log carried a spoolerJobId for a writer that has none:\n%s", out)
	}
}

// lockedWriter serialises writes from the worker goroutine so the test can read the buffer
// without racing the logger.
type lockedWriter struct {
	w  *bytes.Buffer
	mu *sync.Mutex
}

func (l *lockedWriter) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.w.Write(p)
}

func TestQueue_ZPLWrittenExactlyOnceRegardlessOfCopies(t *testing.T) {
	w := &fakeWriter{closeDone: make(chan struct{}, 10)}
	q := New(testLogger(), map[string]Target{"label": {Writer: w}}, DefaultDepth)
	defer q.Stop()

	err := q.Submit(job.Job{ID: "j1", Target: "label", Language: "ZPL", Payload: []byte("^XA^PQ5^XZ"), Copies: 5})
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	opens, writes, closes := w.snapshot()
	if opens != 1 || closes != 1 {
		t.Errorf("opens=%d closes=%d, want 1 and 1", opens, closes)
	}
	if len(writes) != 1 {
		t.Fatalf("got %d writes, want exactly 1 (ZPL copies is carried in ^PQ, not repeated writes)", len(writes))
	}
	if string(writes[0]) != "^XA^PQ5^XZ" {
		t.Errorf("payload = %q, want the original bytes untouched", writes[0])
	}
}

func TestQueue_EPLWrittenExactlyOnceRegardlessOfCopies(t *testing.T) {
	// The copies² trap: EPL carries its count in the payload's own P command, exactly as ZPL does
	// with ^PQ. Writing it `copies` times would turn a request for 5 labels into 25.
	w := &fakeWriter{closeDone: make(chan struct{}, 10)}
	q := New(testLogger(), map[string]Target{"label": {Writer: w}}, DefaultDepth)
	defer q.Stop()

	err := q.Submit(job.Job{ID: "j1", Target: "label", Language: "EPL", Payload: []byte("N\r\nP5\r\n"), Copies: 5})
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	_, writes, _ := w.snapshot()
	if len(writes) != 1 {
		t.Fatalf("got %d writes, want exactly 1 (EPL copies live in the payload's P command)", len(writes))
	}
	if string(writes[0]) != "N\r\nP5\r\n" {
		t.Errorf("payload = %q, want the original bytes untouched", writes[0])
	}
}

func TestCopiesFor_LabelLanguagesNeverRepeatThePayload(t *testing.T) {
	for _, lang := range []string{"ZPL", "EPL"} {
		if got := copiesFor(lang, 5); got != 1 {
			t.Errorf("copiesFor(%q, 5) = %d, want 1", lang, got)
		}
	}
	if got := copiesFor("ESCPOS", 5); got != 5 {
		t.Errorf("copiesFor(\"ESCPOS\", 5) = %d, want 5", got)
	}
}

func TestQueue_ESCPOSWrittenCopiesTimes(t *testing.T) {
	w := &fakeWriter{closeDone: make(chan struct{}, 10)}
	q := New(testLogger(), map[string]Target{"receipt": {Writer: w}}, DefaultDepth)
	defer q.Stop()

	err := q.Submit(job.Job{ID: "j1", Target: "receipt", Language: "ESCPOS", Payload: []byte{0x1b, 0x40}, Copies: 5})
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	_, writes, closes := w.snapshot()
	if len(writes) != 5 {
		t.Fatalf("got %d writes, want exactly 5", len(writes))
	}
	for i, wr := range writes {
		if string(wr) != string([]byte{0x1b, 0x40}) {
			t.Errorf("write %d = %v, want the original payload each time", i, wr)
		}
	}
	if closes != 1 {
		t.Errorf("closes = %d, want 1 (one Open/Close bracket for the whole job, not per copy)", closes)
	}
}

func TestQueue_ESCPOSZeroOrNegativeCopiesWritesOnce(t *testing.T) {
	// job.FromRequest already rejects copies < 1 before a Job ever reaches the queue (Sprint 2),
	// but copiesFor's own floor is what stands between a defensive bug and an infinite/zero loop
	// if that invariant is ever violated — worth asserting directly.
	w := &fakeWriter{closeDone: make(chan struct{}, 10)}
	q := New(testLogger(), map[string]Target{"receipt": {Writer: w}}, DefaultDepth)
	defer q.Stop()

	if err := q.Submit(job.Job{ID: "j1", Target: "receipt", Language: "ESCPOS", Payload: []byte("x"), Copies: 0}); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	_, writes, _ := w.snapshot()
	if len(writes) != 1 {
		t.Fatalf("got %d writes for copies=0, want 1", len(writes))
	}
}

func TestQueue_RewriteAppliedBeforeWrite(t *testing.T) {
	w := &fakeWriter{closeDone: make(chan struct{}, 10)}
	rewrite := func(payload []byte) []byte { return append(payload, '!') }
	q := New(testLogger(), map[string]Target{"receipt": {Writer: w, Rewrite: rewrite}}, DefaultDepth)
	defer q.Stop()

	if err := q.Submit(job.Job{ID: "j1", Target: "receipt", Language: "ESCPOS", Payload: []byte("hi"), Copies: 1}); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	_, writes, _ := w.snapshot()
	if string(writes[0]) != "hi!" {
		t.Errorf("write = %q, want the rewritten payload", writes[0])
	}
}

func TestQueue_LogoPrependedBeforePayload(t *testing.T) {
	w := &fakeWriter{closeDone: make(chan struct{}, 10)}
	logo := func(jobID, logoURL string) []byte {
		if jobID != "j1" || logoURL != "https://example.com/logo.png" {
			t.Errorf("Logo called with jobID=%q logoURL=%q", jobID, logoURL)
		}
		return []byte("LOGO")
	}
	q := New(testLogger(), map[string]Target{"receipt": {Writer: w, Logo: logo}}, DefaultDepth)
	defer q.Stop()

	err := q.Submit(job.Job{ID: "j1", Target: "receipt", Language: "ESCPOS", Payload: []byte("body"), Copies: 1, LogoURL: "https://example.com/logo.png"})
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	_, writes, _ := w.snapshot()
	if len(writes) != 1 || string(writes[0]) != "LOGObody" {
		t.Errorf("write = %q, want logo block prepended to the payload", writes)
	}
}

func TestQueue_NilLogoBlockLeavesPayloadUnchanged(t *testing.T) {
	// Fail-open: Logo returning nil/empty (the normal case — no logoUrl, or the fetch failed)
	// must not add so much as a byte.
	w := &fakeWriter{closeDone: make(chan struct{}, 10)}
	logo := func(jobID, logoURL string) []byte { return nil }
	q := New(testLogger(), map[string]Target{"receipt": {Writer: w, Logo: logo}}, DefaultDepth)
	defer q.Stop()

	if err := q.Submit(job.Job{ID: "j1", Target: "receipt", Language: "ESCPOS", Payload: []byte("body"), Copies: 1}); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	_, writes, _ := w.snapshot()
	if string(writes[0]) != "body" {
		t.Errorf("write = %q, want the unmodified payload", writes[0])
	}
}

func TestQueue_LogoRepeatsPerCopy(t *testing.T) {
	w := &fakeWriter{closeDone: make(chan struct{}, 10)}
	logo := func(jobID, logoURL string) []byte { return []byte("L") }
	q := New(testLogger(), map[string]Target{"receipt": {Writer: w, Logo: logo}}, DefaultDepth)
	defer q.Stop()

	if err := q.Submit(job.Job{ID: "j1", Target: "receipt", Language: "ESCPOS", Payload: []byte("b"), Copies: 3, LogoURL: "x"}); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	_, writes, _ := w.snapshot()
	if len(writes) != 3 {
		t.Fatalf("got %d writes, want 3", len(writes))
	}
	for i, wr := range writes {
		if string(wr) != "Lb" {
			t.Errorf("write %d = %q, want the logo+payload pair each time", i, wr)
		}
	}
}

func TestQueue_LogoNeverPassesThroughRewrite(t *testing.T) {
	// Rewrite must only ever see the web's own payload, never the logo's binary raster bytes —
	// codePage transcoding on raw pixel data would corrupt it. Simulate this with a Rewrite that
	// would visibly corrupt anything unexpected: it upper-cases its input, so if the logo bytes
	// ever reached it, "logo" would come back as "LOGO" instead of staying lowercase.
	w := &fakeWriter{closeDone: make(chan struct{}, 10)}
	rewrite := func(payload []byte) []byte { return bytes.ToUpper(payload) }
	logo := func(jobID, logoURL string) []byte { return []byte("logo") }
	q := New(testLogger(), map[string]Target{"receipt": {Writer: w, Rewrite: rewrite, Logo: logo}}, DefaultDepth)
	defer q.Stop()

	if err := q.Submit(job.Job{ID: "j1", Target: "receipt", Language: "ESCPOS", Payload: []byte("body"), Copies: 1, LogoURL: "x"}); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForClose(t, w.closeDone)

	_, writes, _ := w.snapshot()
	if string(writes[0]) != "logoBODY" {
		t.Errorf("write = %q, want the lowercase logo bytes untouched and only the payload rewritten", writes[0])
	}
}

func TestQueue_UnknownTargetErrors(t *testing.T) {
	q := New(testLogger(), map[string]Target{"receipt": {Writer: &fakeWriter{}}}, DefaultDepth)
	defer q.Stop()

	if err := q.Submit(job.Job{ID: "j1", Target: "label", Language: "ZPL", Payload: []byte("x"), Copies: 1}); err == nil {
		t.Fatal("expected an error for a target with no registered queue")
	}
}

func TestQueue_FullQueueErrorsWithoutBlocking(t *testing.T) {
	// A writer that never returns from Write keeps the worker permanently busy on job 1, so the
	// channel (depth 1) fills on job 2 and job 3 must be rejected instead of blocking Submit.
	block := make(chan struct{})
	w := &blockingWriter{unblock: block}
	q := New(testLogger(), map[string]Target{"receipt": {Writer: w}}, 1)
	defer func() {
		close(block)
		q.Stop()
	}()

	if err := q.Submit(job.Job{ID: "j1", Target: "receipt", Language: "ESCPOS", Payload: []byte("a"), Copies: 1}); err != nil {
		t.Fatalf("Submit (1): %v", err)
	}
	// Give the worker a moment to pick job 1 off the channel and block inside Write, so the
	// channel is empty again and job 2 can actually occupy the queue's one slot.
	w.waitUntilWriting(t)

	if err := q.Submit(job.Job{ID: "j2", Target: "receipt", Language: "ESCPOS", Payload: []byte("b"), Copies: 1}); err != nil {
		t.Fatalf("Submit (2) should fill the one queue slot without error: %v", err)
	}

	done := make(chan error, 1)
	go func() {
		done <- q.Submit(job.Job{ID: "j3", Target: "receipt", Language: "ESCPOS", Payload: []byte("c"), Copies: 1})
	}()

	select {
	case err := <-done:
		if err == nil {
			t.Fatal("expected an error when the queue is full")
		}
	case <-time.After(time.Second):
		t.Fatal("Submit blocked instead of returning immediately when the queue was full")
	}
}

func TestQueue_WriteErrorDoesNotStopSubsequentJobs(t *testing.T) {
	w := &fakeWriter{writeErr: errors.New("printer jammed"), closeDone: make(chan struct{}, 10)}
	q := New(testLogger(), map[string]Target{"receipt": {Writer: w}}, DefaultDepth)
	defer q.Stop()

	if err := q.Submit(job.Job{ID: "j1", Target: "receipt", Language: "ESCPOS", Payload: []byte("a"), Copies: 1}); err != nil {
		t.Fatalf("Submit (1): %v", err)
	}
	waitForClose(t, w.closeDone)

	w.mu.Lock()
	w.writeErr = nil
	w.mu.Unlock()

	if err := q.Submit(job.Job{ID: "j2", Target: "receipt", Language: "ESCPOS", Payload: []byte("b"), Copies: 1}); err != nil {
		t.Fatalf("Submit (2): %v", err)
	}
	waitForClose(t, w.closeDone)

	_, writes, _ := w.snapshot()
	if len(writes) != 2 {
		t.Fatalf("got %d writes, want 2 (a failed job must not wedge the worker)", len(writes))
	}
}

// blockingWriter's Write blocks until unblock is closed, used only to prove Submit never blocks
// even while a worker is stuck mid-job.
type blockingWriter struct {
	unblock chan struct{}

	mu      sync.Mutex
	writing bool
}

func (w *blockingWriter) Open() error { return nil }

func (w *blockingWriter) Write(payload []byte) error {
	w.mu.Lock()
	w.writing = true
	w.mu.Unlock()
	<-w.unblock
	return nil
}

func (w *blockingWriter) Close() error { return nil }

func (w *blockingWriter) waitUntilWriting(t *testing.T) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for {
		w.mu.Lock()
		writing := w.writing
		w.mu.Unlock()
		if writing {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("blockingWriter never entered Write")
		}
		time.Sleep(time.Millisecond)
	}
}
