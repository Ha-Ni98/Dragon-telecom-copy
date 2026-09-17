//go:build !windows

package device

import "errors"

// errSpoolerUnsupported is returned by every SpoolerWriter method and by ListPrinters on any OS
// other than Windows — the Win32 print spooler this backend talks to simply does not exist
// elsewhere. dtbridge itself only ships for Windows counter PCs (see print-bridge-plan-v1.md); this
// stub exists so the module still builds and tests on the Linux/macOS dev machine.
var errSpoolerUnsupported = errors.New("spooler printing is only supported on Windows")

// SpoolerWriter is the non-Windows stand-in for the real Win32 spooler backend
// (spooler_windows.go). Every method fails with errSpoolerUnsupported except Close, which is a
// no-op — consistent with every other Writer's contract that Close must be safe to call even
// when Open never succeeded.
type SpoolerWriter struct {
	QueueName string
}

func (w *SpoolerWriter) Open() error                { return errSpoolerUnsupported }
func (w *SpoolerWriter) Write(payload []byte) error { return errSpoolerUnsupported }
func (w *SpoolerWriter) Close() error               { return nil }

// ListPrinters is unsupported outside Windows — see errSpoolerUnsupported.
func ListPrinters() ([]string, error) {
	return nil, errSpoolerUnsupported
}
