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
	"syscall"
	"time"

	"dragon-telecom/bridge/internal/config"
	"dragon-telecom/bridge/internal/device"
	"dragon-telecom/bridge/internal/httpapi"
	"dragon-telecom/bridge/internal/job"
	"dragon-telecom/bridge/internal/logging"
)

const version = "1.0.0"

const (
	readTimeout  = 5 * time.Second
	writeTimeout = 5 * time.Second
	idleTimeout  = 60 * time.Second
	shutdownWait = 3 * time.Second
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "dtbridge:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	fs := flag.NewFlagSet("dtbridge", flag.ContinueOnError)
	configPath := fs.String("config", "config.json", "path to config.json")
	dryRun := fs.Bool("dry-run", false, "write print jobs to .bin files instead of a real device")
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

	// stubSink stands in for internal/queue (Sprint 5), which itself writes through
	// internal/device via the Writer backends built in Sprint 3. Nothing reaches a real printer
	// yet — every accepted job is logged and dropped. Replaced with the real queue once both
	// layers exist.
	api := httpapi.New(cfg, logger, stubSink{logger: logger}, version, httpapi.WithConnected(prober.Connected))

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

// registerProbe wires a background connectivity check for target, matching its configured
// transport. "spooler" has no check yet — the Windows spooler backend arrives in Sprint 4 — so
// that target is left unregistered and Prober.Connected reports false for it, honestly, rather
// than guessing.
func registerProbe(p *device.Prober, target string, printer config.PrinterConfig) {
	switch printer.Transport {
	case "tcp":
		addr := net.JoinHostPort(printer.Host, strconv.Itoa(printer.Port))
		p.Register(target, device.TCPCheck(addr, device.DefaultProbeTimeout))
	case "file":
		p.Register(target, device.FileCheck(printer.Path))
	}
}

// stubSink is the temporary Sink used until Sprint 5 wires the real queue. It never fails, so
// every well-formed job comes back 200 {"ok":true} from the web's point of view — but nothing is
// actually written to a device yet.
type stubSink struct {
	logger *slog.Logger
}

func (s stubSink) Submit(j job.Job) error {
	s.logger.Info("job accepted (no device layer wired yet — payload dropped, see Sprint 3/5)",
		"jobId", j.ID, "target", j.Target, "language", j.Language, "copies", j.Copies, "bytes", len(j.Payload))
	return nil
}
