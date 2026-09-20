// dtbridge is the local print helper described in Docs/Stage-04-Fixes/plans/bridge/
// print-bridge-protocol.md. It runs on the counter PC and bridges the web app's ZPL/ESC-POS bytes
// to the shop's label and receipt printers over loopback HTTP.
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"dragon-telecom/bridge/internal/config"
	"dragon-telecom/bridge/internal/device"
	"dragon-telecom/bridge/internal/escpos"
	"dragon-telecom/bridge/internal/httpapi"
	"dragon-telecom/bridge/internal/logging"
	"dragon-telecom/bridge/internal/logo"
	"dragon-telecom/bridge/internal/queue"
)

const version = "1.0.0"

const (
	readTimeout         = 5 * time.Second
	writeTimeout        = 5 * time.Second
	idleTimeout         = 60 * time.Second
	shutdownWait        = 3 * time.Second
	defaultDryRunDir    = "dtbridge-dry-run"
	defaultLogoCacheDir = "dtbridge-logo-cache"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "dtbridge:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) > 0 && args[0] == "list-printers" {
		return runListPrinters(args[1:])
	}
	if len(args) > 0 && args[0] == "test-print" {
		return runTestPrint(args[1:])
	}

	fs := flag.NewFlagSet("dtbridge", flag.ContinueOnError)
	configPath := fs.String("config", "config.json", "path to config.json")
	dryRun := fs.Bool("dry-run", false, "capture print jobs to .bin files instead of writing to a real device")
	dryRunDir := fs.String("dry-run-dir", defaultDryRunDir, "directory .bin files are written to under --dry-run")
	logoCacheDir := fs.String("logo-cache-dir", defaultLogoCacheDir, "directory rastered logos are cached in (\"\" disables the on-disk cache)")
	showVersion := fs.Bool("version", false, "print version and exit")
	if err := fs.Parse(args); err != nil {
		return err
	}

	if *showVersion {
		fmt.Println("dtbridge", version)
		return nil
	}

	cfg, err := config.Load(*configPath)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	logger, closeLog, err := logging.New(cfg.LogFile)
	if err != nil {
		return fmt.Errorf("set up logging: %w", err)
	}
	defer closeLog()

	logger.Info("dtbridge starting", "version", version, "configPath", *configPath, "dryRun", *dryRun)
	logger.Info("resolved configuration",
		"port", cfg.Port,
		"allowedOrigins", cfg.AllowedOrigins,
		"logFile", cfg.LogFile,
		"label", cfg.Printers.Label,
		"receipt", cfg.Printers.Receipt,
	)

	prober := device.NewProber(device.DefaultProbeInterval)
	registerProbe(prober, "label", cfg.Printers.Label)
	registerProbe(prober, "receipt", cfg.Printers.Receipt)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go prober.Run(ctx)

	targets := map[string]queue.Target{
		"label": {
			Writer: newDeviceWriter(cfg.Printers.Label, "label", *dryRun, *dryRunDir),
			// No ZPL payload override exists in v1.0 — print-bridge-protocol.md's "^CI28" note is
			// a known gap, not silently dropped; see the Sprint 5 report.
		},
		"receipt": {
			Writer:  newDeviceWriter(cfg.Printers.Receipt, "receipt", *dryRun, *dryRunDir),
			Rewrite: newReceiptRewrite(cfg.Printers.Receipt),
			Logo:    newLogoFunc(logger, cfg.Printers.Receipt, *logoCacheDir),
		},
	}
	q := queue.New(logger, targets, queue.DefaultDepth)
	defer q.Stop()

	api := httpapi.New(cfg, logger, q, version, httpapi.WithConnected(prober.Connected))

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      api.Handler(),
		ReadTimeout:  readTimeout,
		WriteTimeout: writeTimeout,
		IdleTimeout:  idleTimeout,
	}

	serveErr := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serveErr <- err
			return
		}
		serveErr <- nil
	}()

	logger.Info("dtbridge ready — press Ctrl+C to stop")

	select {
	case <-ctx.Done():
		logger.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownWait)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown: %w", err)
		}
		<-serveErr
		return nil
	case err := <-serveErr:
		if err != nil {
			return fmt.Errorf("serve: %w", err)
		}
		return nil
	}
}

// newDeviceWriter picks the Writer backend for one printer. --dry-run overrides the configured
// transport entirely — every job for every target is captured to .bin files instead of touching
// real hardware, regardless of what config.json says.
func newDeviceWriter(printer config.PrinterConfig, target string, dryRun bool, dryRunDir string) device.Writer {
	if dryRun {
		return &device.DryRunWriter{Dir: dryRunDir, Target: target}
	}
	switch printer.Transport {
	case "tcp":
		return &device.TCPWriter{Host: printer.Host, Port: printer.Port}
	case "file":
		return &device.FileWriter{Path: printer.Path}
	case "spooler":
		return &device.SpoolerWriter{QueueName: printer.QueueName}
	}
	// Unreachable: config.Validate already rejects any transport outside this set.
	panic(fmt.Sprintf("unknown transport %q", printer.Transport))
}

// newReceiptRewrite composes the two ESC/POS hardware overrides — cut command and code page —
// into one queue.RewriteFunc. Both are independently "auto" (pass-through) unless configured, per
// print-bridge-protocol.md's "Hardware-specific details the helper may need to override".
func newReceiptRewrite(printer config.PrinterConfig) queue.RewriteFunc {
	codePage := ""
	if printer.CodePage != nil {
		codePage = *printer.CodePage
	}
	return func(payload []byte) []byte {
		payload = escpos.RewriteCut(payload, printer.CutCommand)
		payload = escpos.RewriteCodePage(payload, codePage)
		return payload
	}
}

// newLogoFunc wires the logo pipeline for the receipt target, or returns nil if logos are off —
// no Logo config block at all, or logo.enabled: false. A nil queue.LogoFunc means writeJob never
// attempts a logo for this target, regardless of what a job's LogoURL says; this is the one place
// "logo.enabled: false" (one of the fail-open triggers print-bridge-plan-v1.md §5 lists) is
// actually enforced — logo.Builder itself has no enabled/disabled concept.
func newLogoFunc(logger *slog.Logger, printer config.PrinterConfig, cacheDir string) queue.LogoFunc {
	if printer.Logo == nil || !printer.Logo.Enabled {
		return nil
	}
	builder := logo.NewBuilder(logger, printer.Logo.MaxWidthDots, printer.WidthDots, printer.Logo.Threshold, cacheDir)
	return builder.Build
}

// registerProbe wires a background connectivity check for target, matching its configured
// transport.
func registerProbe(p *device.Prober, target string, printer config.PrinterConfig) {
	switch printer.Transport {
	case "tcp":
		addr := net.JoinHostPort(printer.Host, strconv.Itoa(printer.Port))
		p.Register(target, device.TCPCheck(addr, device.DefaultProbeTimeout))
	case "file":
		p.Register(target, device.FileCheck(printer.Path))
	case "spooler":
		p.Register(target, device.SpoolerCheck(printer.QueueName))
	}
}

// Built-in test payloads for `dtbridge test-print`. Each is the smallest thing that unambiguously
// answers "does this printer understand this language?" — a line of text plus a barcode.
//
// The label languages are NOT interchangeable and a printer given the wrong one typically does
// nothing at all: no error, no LED, no paper. That silence is exactly what makes a direct test
// worth having, and is why `--language` can override whatever config.json says.
var testPayloads = map[string][]byte{
	// ZPL II — Zebra's modern label language.
	"ZPL": []byte("^XA\n" +
		"^FO40,40^A0N,40,40^FDDTBRIDGE ZPL TEST^FS\n" +
		"^FO40,100^BY2^BCN,80,Y,N,N^FD12345678^FS\n" +
		"^PQ1\n" +
		"^XZ\n"),

	// EPL2 — the older Eltron language still used by pre-"Plus" Zebra desktop units such as the
	// LP 2824. Line-oriented and CRLF-terminated, unlike ZPL.
	//
	// UNVERIFIED, deliberately flagged: the `B` command's barcode-type selector for Code 128
	// (here `1`) is recalled, not confirmed against the EPL2 manual or real hardware. If the text
	// line prints and the barcode does not, that selector is the thing to correct — and it is
	// precisely why --file exists, so variants can be tried without a rebuild.
	"EPL": []byte("N\r\n" +
		"q400\r\n" +
		"A40,20,0,3,1,1,N,\"DTBRIDGE EPL TEST\"\r\n" +
		"B40,60,0,1,2,6,80,B,\"12345678\"\r\n" +
		"P1\r\n"),

	// ESC/POS — the 80mm receipt printer. Init, text, feed clear of the cutter, partial cut.
	"ESCPOS": append(
		append([]byte{0x1b, 0x40, 0x1b, 0x61, 0x01}, "DTBRIDGE ESC/POS TEST\n12345678\n"...),
		0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00),
}

// runTestPrint implements `dtbridge test-print`: send bytes straight at a configured printer,
// bypassing the web app, the HTTP layer, the dedupe cache and the queue entirely.
//
// This is the hardware bring-up tool. When a print silently does nothing, it collapses the
// question "is it the web, the bridge, or the printer?" into one synchronous command whose error
// (or silence) is attributable to exactly one layer. It writes directly rather than going through
// the queue on purpose: the queue acks on enqueue and logs failures asynchronously, which is right
// for production and useless for diagnosis.
func runTestPrint(args []string) error {
	fs := flag.NewFlagSet("dtbridge test-print", flag.ContinueOnError)
	configPath := fs.String("config", "config.json", "path to config.json")
	target := fs.String("target", "label", "which configured printer to send to: label | receipt")
	language := fs.String("language", "", "override the built-in payload's language: ZPL | EPL | ESCPOS (default: whatever the target is configured for)")
	file := fs.String("file", "", "send the raw bytes of this file instead of a built-in payload")
	dryRun := fs.Bool("dry-run", false, "capture to a .bin file instead of writing to a real device")
	dryRunDir := fs.String("dry-run-dir", defaultDryRunDir, "directory .bin files are written to under --dry-run")
	if err := fs.Parse(args); err != nil {
		return err
	}

	cfg, err := config.Load(*configPath)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	var printer config.PrinterConfig
	switch *target {
	case "label":
		printer = cfg.Printers.Label
	case "receipt":
		printer = cfg.Printers.Receipt
	default:
		return fmt.Errorf("--target must be \"label\" or \"receipt\", got %q", *target)
	}

	payload, describe, err := testPrintPayload(*file, *language, printer.Language)
	if err != nil {
		return err
	}

	writer := newDeviceWriter(printer, *target, *dryRun, *dryRunDir)
	fmt.Printf("sending %d bytes (%s) to the %q printer via %s...\n",
		len(payload), describe, *target, printer.Transport)

	if err := writer.Open(); err != nil {
		return fmt.Errorf("open device: %w", err)
	}
	defer writer.Close()

	if err := writer.Write(payload); err != nil {
		return fmt.Errorf("write to device: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("close device: %w", err)
	}

	if reporter, ok := writer.(device.JobIDReporter); ok && reporter.LastJobID() != 0 {
		fmt.Printf("accepted by the Windows spooler as job %d.\n", reporter.LastJobID())
	}
	fmt.Println("the device accepted every byte. If nothing came out of the printer, the bytes")
	fmt.Println("reached it and it did not understand them — most often the wrong label language.")
	return nil
}

func testPrintPayload(file, languageOverride, configuredLanguage string) (payload []byte, describe string, err error) {
	if file != "" {
		raw, err := os.ReadFile(file)
		if err != nil {
			return nil, "", fmt.Errorf("read --file: %w", err)
		}
		if len(raw) == 0 {
			return nil, "", fmt.Errorf("--file %s is empty", file)
		}
		return raw, "raw bytes from " + file, nil
	}

	lang := configuredLanguage
	if languageOverride != "" {
		lang = strings.ToUpper(languageOverride)
	}
	built, ok := testPayloads[lang]
	if !ok {
		return nil, "", fmt.Errorf("no built-in test payload for language %q (try ZPL, EPL or ESCPOS, or use --file)", lang)
	}
	return built, "built-in " + lang + " test", nil
}

// runListPrinters implements `dtbridge list-printers`: lists installed Windows printer queues so
// a shop technician can copy the exact name into config.json's queueName rather than guessing at
// it. Off Windows, device.ListPrinters always errors — there is no spooler to enumerate.
func runListPrinters(args []string) error {
	fs := flag.NewFlagSet("dtbridge list-printers", flag.ContinueOnError)
	if err := fs.Parse(args); err != nil {
		return err
	}

	names, err := device.ListPrinters()
	if err != nil {
		return fmt.Errorf("list printers: %w", err)
	}
	if len(names) == 0 {
		fmt.Println("no printers found")
		return nil
	}
	for _, name := range names {
		fmt.Println(name)
	}
	return nil
}
