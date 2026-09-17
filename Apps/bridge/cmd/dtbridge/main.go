// dtbridge is the local print helper described in Docs/Stage-04-Fixes/plans/bridge/
// print-bridge-protocol.md. It runs on the counter PC and bridges the web app's ZPL/ESC-POS bytes
// to the shop's label and receipt printers over loopback HTTP.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"dragon-telecom/bridge/internal/config"
	"dragon-telecom/bridge/internal/logging"
)

const version = "1.0.0"

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

	// /status and /print land here in Sprint 2; Sprint 1 only proves the process starts, loads a
	// valid config, and shuts down cleanly.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	logger.Info("dtbridge ready — press Ctrl+C to stop")
	<-ctx.Done()
	logger.Info("shutting down")

	return nil
}
