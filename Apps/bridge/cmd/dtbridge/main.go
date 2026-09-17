// dtbridge is the local print helper described in Docs/Stage-04-Fixes/plans/bridge/
// print-bridge-protocol.md. It runs on the counter PC and bridges the web app's ZPL/ESC-POS bytes
// to the shop's label and receipt printers over loopback HTTP.
package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"dragon-telecom/bridge/internal/config"
	"dragon-telecom/bridge/internal/device"
	"dragon-telecom/bridge/internal/escpos"
	"dragon-telecom/bridge/internal/httpapi"
	"dragon-telecom/bridge/internal/logging"
	"dragon-telecom/bridge/internal/queue"
)

const version = "1.0.0"

const (
	readTimeout      = 5 * time.Second
	writeTimeout     = 5 * time.Second
	idleTimeout      = 60 * time.Second
	shutdownWait     = 3 * time.Second
	defaultDryRunDir = "dtbridge-dry-run"
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

	fs := flag.NewFlagSet("dtbridge", flag.ContinueOnError)
	configPath := fs.String("config", "config.json", "path to config.json")
	dryRun := fs.Bool("dry-run", false, "capture print jobs to .bin files instead of writing to a real device")
	dryRunDir := fs.String("dry-run-dir", defaultDryRunDir, "directory .bin files are written to under --dry-run")
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
