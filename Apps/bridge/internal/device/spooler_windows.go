//go:build windows

package device

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

// winspool.drv exports these under their wide-string ("W") names. x/sys/windows only supplies the
// LazyDLL/LazyProc primitives (NewLazySystemDLL, NewProc, Call) used to reach an arbitrary Win32
// DLL — it has no ready-made wrapper for winspool, unlike kernel32/user32. This is the same
// approach Zebra Browser Print and DYMO Connect use: OpenPrinter → StartDocPrinter with
// pDatatype "RAW" → WritePrinter, which hands bytes straight to the device and bypasses the
// driver's own rendering entirely — see print-bridge-plan-v1.md's "Why Go, in one paragraph" for
// why this is the only route that coexists with an installed vendor driver.
var (
	winspool             = windows.NewLazySystemDLL("winspool.drv")
	procOpenPrinter      = winspool.NewProc("OpenPrinterW")
	procClosePrinter     = winspool.NewProc("ClosePrinter")
	procStartDocPrinter  = winspool.NewProc("StartDocPrinterW")
	procEndDocPrinter    = winspool.NewProc("EndDocPrinter")
	procStartPagePrinter = winspool.NewProc("StartPagePrinter")
	procEndPagePrinter   = winspool.NewProc("EndPagePrinter")
	procWritePrinter     = winspool.NewProc("WritePrinter")
	procEnumPrinters     = winspool.NewProc("EnumPrintersW")
)

// docInfo1 mirrors Win32's DOC_INFO_1W. pDatatype "RAW" is what makes StartDocPrinter hand our
// bytes straight to the device instead of routing them through the driver's own renderer.
type docInfo1 struct {
	pDocName    *uint16
	pOutputFile *uint16
	pDatatype   *uint16
}

// SpoolerWriter writes RAW bytes to a printer through the Windows print spooler. QueueName must
// match the printer's exact Windows queue name (Settings > Printers, or `dtbridge list-printers`).
//
// One OpenPrinter per job cycle (Open/Close), but Write may be called more than once between
// them — the queue (Sprint 5) does exactly this to implement the copies rule for ESC/POS. Each
// Write call is its own complete StartDocPrinter/EndDocPrinter bracket, i.e. its own discrete
// entry in the Windows print queue: ZPL's "write once" and ESC/POS's "write N times" therefore
// show up as one job or N jobs in the spooler too, which is the natural unit Windows itself uses.
type SpoolerWriter struct {
	QueueName string

	handle windows.Handle
}

func (w *SpoolerWriter) Open() error {
	name, err := windows.UTF16PtrFromString(w.QueueName)
	if err != nil {
		return fmt.Errorf("printer name %q: %w", w.QueueName, err)
	}
	r1, _, err := procOpenPrinter.Call(
		uintptr(unsafe.Pointer(name)),
		uintptr(unsafe.Pointer(&w.handle)),
		0, // pDefault: NULL — no custom PRINTER_DEFAULTS needed for RAW printing
	)
	if r1 == 0 {
		return fmt.Errorf("OpenPrinter %q: %w", w.QueueName, err)
	}
	return nil
}

func (w *SpoolerWriter) Write(payload []byte) error {
	if w.handle == 0 {
		return fmt.Errorf("spooler writer: Write called before a successful Open")
	}
	if len(payload) == 0 {
		return nil
	}

	docName, err := windows.UTF16PtrFromString("dtbridge print job")
	if err != nil {
		return fmt.Errorf("doc name: %w", err)
	}
	dataType, err := windows.UTF16PtrFromString("RAW")
	if err != nil {
		return fmt.Errorf("data type: %w", err)
	}
	info := docInfo1{pDocName: docName, pOutputFile: nil, pDatatype: dataType}

	r1, _, err := procStartDocPrinter.Call(uintptr(w.handle), 1, uintptr(unsafe.Pointer(&info)))
	if r1 == 0 {
		return fmt.Errorf("StartDocPrinter: %w", err)
	}
	// EndDocPrinter must run even if StartPagePrinter/WritePrinter/EndPagePrinter fails partway,
	// or the job is left dangling in the spooler queue forever.
	defer procEndDocPrinter.Call(uintptr(w.handle))

	if r1, _, err := procStartPagePrinter.Call(uintptr(w.handle)); r1 == 0 {
		return fmt.Errorf("StartPagePrinter: %w", err)
	}
	defer procEndPagePrinter.Call(uintptr(w.handle))

	var written uint32
	r1, _, err = procWritePrinter.Call(
		uintptr(w.handle),
		uintptr(unsafe.Pointer(&payload[0])),
		uintptr(len(payload)),
		uintptr(unsafe.Pointer(&written)),
	)
	if r1 == 0 {
		return fmt.Errorf("WritePrinter: %w", err)
	}
	if int(written) != len(payload) {
		return fmt.Errorf("WritePrinter wrote %d of %d bytes", written, len(payload))
	}
	return nil
}

func (w *SpoolerWriter) Close() error {
	if w.handle == 0 {
		return nil
	}
	r1, _, err := procClosePrinter.Call(uintptr(w.handle))
	w.handle = 0
	if r1 == 0 {
		return fmt.Errorf("ClosePrinter: %w", err)
	}
	return nil
}

// printerInfo4 mirrors Win32's PRINTER_INFO_4W — just enough fields to list queue names for
// `dtbridge list-printers`, without pulling in the much larger PRINTER_INFO_2.
type printerInfo4 struct {
	pPrinterName *uint16
	pServerName  *uint16
	attributes   uint32
}

const (
	printerEnumLocal       = 0x00000002
	printerEnumConnections = 0x00000004
)

// ListPrinters enumerates installed printer queues — the exact names SpoolerWriter.QueueName must
// match. Exposed via `dtbridge list-printers` so a shop technician can copy the right value into
// config.json instead of guessing at it.
func ListPrinters() ([]string, error) {
	flags := uintptr(printerEnumLocal | printerEnumConnections)
	const level = 4

	// First call: cbBuf=0, just to learn how large a buffer EnumPrinters actually needs. This
	// call is expected to "fail" (returns FALSE) — that's how the API reports the needed size.
	var needed, returned uint32
	_, _, _ = procEnumPrinters.Call(flags, 0, level, 0, 0,
		uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
	if needed == 0 {
		return nil, nil
	}

	buf := make([]byte, needed)
	r1, _, err := procEnumPrinters.Call(
		flags, 0, level,
		uintptr(unsafe.Pointer(&buf[0])), uintptr(needed),
		uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)),
	)
	if r1 == 0 {
		return nil, fmt.Errorf("EnumPrinters: %w", err)
	}

	entries := unsafe.Slice((*printerInfo4)(unsafe.Pointer(&buf[0])), returned)
	names := make([]string, 0, returned)
	for _, e := range entries {
		if e.pPrinterName != nil {
			names = append(names, windows.UTF16PtrToString(e.pPrinterName))
		}
	}
	return names, nil
}
