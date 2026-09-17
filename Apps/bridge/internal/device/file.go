package device

import (
	"fmt"
	"os"
)

// FileWriter writes to a filesystem path: a USB printer exposed as a character device
// (/dev/usb/lp0), a port name, or a plain file for local testing — the dev/Linux-counter stand-in
// for hardware that would otherwise need the Windows spooler backend (Sprint 4).
type FileWriter struct {
	Path string

	file *os.File
}

func (w *FileWriter) Open() error {
	// O_TRUNC is a no-op on a real character device (the kernel ignores truncate on most device
	// nodes) but makes repeated writes to the same regular file byte-exact during testing —
	// without it, a shorter payload would leave a stale tail from a previous job's bytes.
	f, err := os.OpenFile(w.Path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return fmt.Errorf("open %s: %w", w.Path, err)
	}
	w.file = f
	return nil
}

func (w *FileWriter) Write(payload []byte) error {
	if w.file == nil {
		return fmt.Errorf("file writer: Write called before a successful Open")
	}
	_, err := w.file.Write(payload)
	return err
}

func (w *FileWriter) Close() error {
	if w.file == nil {
		return nil
	}
	err := w.file.Close()
	w.file = nil
	return err
}
