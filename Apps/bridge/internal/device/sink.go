package device

import (
	"fmt"
	"os"
	"path/filepath"
	"sync/atomic"
	"time"
)

// DryRunWriter stands in for a real printer under --dry-run: instead of writing to hardware, it
// captures each job's exact bytes to its own .bin file, so a print can be inspected or diffed
// against a golden fixture (print-bridge-plan-v1.md §7). This is device.Writer's fourth backend,
// alongside TCPWriter/FileWriter/the Windows spooler backend (Sprint 4) — not to be confused with
// httpapi.Sink, the unrelated interface a validated job is submitted to before it ever reaches a
// Writer.
type DryRunWriter struct {
	Dir    string // directory the .bin files are written into
	Target string // "label" or "receipt" — used only to make filenames readable

	seq atomic.Uint64
}

func (w *DryRunWriter) Open() error {
	return os.MkdirAll(w.Dir, 0o755)
}

func (w *DryRunWriter) Write(payload []byte) error {
	n := w.seq.Add(1)
	name := fmt.Sprintf("%s-%d-%03d.bin", w.Target, time.Now().UnixNano(), n)
	if err := os.WriteFile(filepath.Join(w.Dir, name), payload, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", name, err)
	}
	return nil
}

func (w *DryRunWriter) Close() error {
	return nil
}
