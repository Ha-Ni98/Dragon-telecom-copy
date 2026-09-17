// Package logging sets up dtbridge's single logger: stdout plus a local file, since the helper
// runs unattended on a counter PC and nobody will be watching a terminal.
package logging

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
)

// maxLogBytes bounds the log file with the simplest possible rotation: stdlib-only, one previous
// file kept. dtbridge logs one line per print job on a single counter PC, so this is expected to
// roll over rarely, if ever — see the dependency policy in print-bridge-plan-v1.md §4 (no external
// rotation library).
const maxLogBytes = 10 * 1024 * 1024

// New opens path (rotating it first if oversized) and returns a logger that writes to both stdout
// and the file. The returned close func must be called on shutdown to flush and release the file.
func New(path string) (*slog.Logger, func() error, error) {
	if err := rotateIfOversized(path); err != nil {
		return nil, nil, fmt.Errorf("rotate log file: %w", err)
	}

	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return nil, nil, fmt.Errorf("open log file %s: %w", path, err)
	}

	handler := slog.NewTextHandler(io.MultiWriter(os.Stdout, f), &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	return slog.New(handler), f.Close, nil
}

func rotateIfOversized(path string) error {
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if info.Size() < maxLogBytes {
		return nil
	}
	return os.Rename(path, path+".1")
}
