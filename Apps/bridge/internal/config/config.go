// Package config loads and validates dtbridge's config.json. The process refuses to start on an
// invalid config rather than failing later at print time — see print-bridge-plan-v1.md §4.
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"slices"
)

var (
	// EPL is the older Eltron label language. Pre-"Plus" Zebra desktop units (the LP 2824 among
	// them) speak it and have no ZPL interpreter at all — sent ZPL they print nothing whatsoever,
	// with no error to go on, which is why this is per-printer config rather than an assumption.
	validLanguages  = []string{"ZPL", "EPL", "ESCPOS"}
	validTransports = []string{"spooler", "tcp", "file"}
	validCutCmds    = []string{"auto", "GSV66", "GSV0", "GSV1", "none"}
	// validCodePages matches internal/escpos.RewriteCodePage's supported targets exactly — kept
	// here rather than imported from that package to avoid config depending on escpos.
	validCodePages = []string{"CP437", "CP1252", "CP858"}
)

type LogoConfig struct {
	Enabled      bool `json:"enabled"`
	MaxWidthDots int  `json:"maxWidthDots"`
	Threshold    int  `json:"threshold"`
}

// PrinterConfig covers both targets. Which fields are required depends on Transport (spooler needs
// QueueName, tcp needs Host+Port, file needs Path) and on which target this is: "label" needs DPI,
// "receipt" needs WidthMm/WidthDots/CutCommand/CodePage/Logo. See Validate.
type PrinterConfig struct {
	Language   string      `json:"language"`
	Transport  string      `json:"transport"`
	QueueName  string      `json:"queueName,omitempty"`
	Host       string      `json:"host,omitempty"`
	Port       int         `json:"port,omitempty"`
	Path       string      `json:"path,omitempty"`
	DPI        int         `json:"dpi,omitempty"`
	WidthMm    int         `json:"widthMm,omitempty"`
	WidthDots  int         `json:"widthDots,omitempty"`
	CutCommand string      `json:"cutCommand,omitempty"`
	CodePage   *string     `json:"codePage,omitempty"`
	Logo       *LogoConfig `json:"logo,omitempty"`
}

// LogValue makes a PrinterConfig print as a readable slog group instead of a Go %+v dump — in
// particular so Logo and CodePage (both pointers) show their contents, not an address, in the
// "resolved configuration" line every dtbridge start emits.
func (p PrinterConfig) LogValue() slog.Value {
	attrs := []slog.Attr{
		slog.String("language", p.Language),
		slog.String("transport", p.Transport),
	}
	switch p.Transport {
	case "spooler":
		attrs = append(attrs, slog.String("queueName", p.QueueName))
	case "tcp":
		attrs = append(attrs, slog.String("host", p.Host), slog.Int("port", p.Port))
	case "file":
		attrs = append(attrs, slog.String("path", p.Path))
	}
	if p.DPI > 0 {
		attrs = append(attrs, slog.Int("dpi", p.DPI))
	}
	if p.WidthMm > 0 {
		attrs = append(attrs, slog.Int("widthMm", p.WidthMm), slog.Int("widthDots", p.WidthDots))
	}
	if p.CutCommand != "" {
		attrs = append(attrs, slog.String("cutCommand", p.CutCommand))
	}
	if p.CodePage != nil {
		attrs = append(attrs, slog.String("codePage", *p.CodePage))
	}
	if p.Logo != nil {
		attrs = append(attrs, slog.Group("logo",
			slog.Bool("enabled", p.Logo.Enabled),
			slog.Int("maxWidthDots", p.Logo.MaxWidthDots),
			slog.Int("threshold", p.Logo.Threshold),
		))
	}
	return slog.GroupValue(attrs...)
}

type PrintersConfig struct {
	Label   PrinterConfig `json:"label"`
	Receipt PrinterConfig `json:"receipt"`
}

type Config struct {
	Port           int            `json:"port"`
	AllowedOrigins []string       `json:"allowedOrigins"`
	LogFile        string         `json:"logFile"`
	Printers       PrintersConfig `json:"printers"`
}

// Default returns the structural defaults from print-bridge-plan-v1.md §4. Site-specific fields
// (queueName, host, path) have no sane default and are left empty — Validate rejects an empty
// required field rather than guessing a printer name or address.
func Default() *Config {
	return &Config{
		Port:           9110,
		AllowedOrigins: []string{"*"},
		LogFile:        "dtbridge.log",
		Printers: PrintersConfig{
			Label: PrinterConfig{
				Language:  "ZPL",
				Transport: "spooler",
				DPI:       203,
			},
			Receipt: PrinterConfig{
				Language:   "ESCPOS",
				Transport:  "tcp",
				Port:       9100,
				WidthMm:    80,
				WidthDots:  576,
				CutCommand: "auto",
				Logo:       &LogoConfig{Enabled: false, MaxWidthDots: 384, Threshold: 128},
			},
		},
	}
}

// Load reads path on top of Default(): encoding/json only overwrites fields present in the file,
// so a config.json that only sets site-specific values (queueName, host, allowedOrigins, ...)
// still gets every structural default. Validate runs before Load returns, so a caller never holds
// a Config that hasn't passed it.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}

	cfg := Default()
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid %s: %w", path, err)
	}

	return cfg, nil
}

// Validate collects every problem instead of stopping at the first, so a shop fixing config.json
// sees the whole list in one run rather than one error per restart.
func (c *Config) Validate() error {
	var errs []error

	if c.Port < 1 || c.Port > 65535 {
		errs = append(errs, fmt.Errorf("port: must be 1-65535, got %d", c.Port))
	}
	if len(c.AllowedOrigins) == 0 {
		errs = append(errs, errors.New("allowedOrigins: must not be empty (use [\"*\"] to allow any origin)"))
	}
	if c.LogFile == "" {
		errs = append(errs, errors.New("logFile: must not be empty"))
	}

	errs = append(errs, validatePrinter("printers.label", &c.Printers.Label, true)...)
	errs = append(errs, validatePrinter("printers.receipt", &c.Printers.Receipt, false)...)

	return errors.Join(errs...)
}

func validatePrinter(field string, p *PrinterConfig, isLabel bool) []error {
	var errs []error

	if !slices.Contains(validLanguages, p.Language) {
		errs = append(errs, fmt.Errorf("%s.language: must be one of %v, got %q", field, validLanguages, p.Language))
	}
	if !slices.Contains(validTransports, p.Transport) {
		errs = append(errs, fmt.Errorf("%s.transport: must be one of %v, got %q", field, validTransports, p.Transport))
	}

	switch p.Transport {
	case "spooler":
		if p.QueueName == "" {
			errs = append(errs, fmt.Errorf("%s.queueName: required when transport is \"spooler\"", field))
		}
	case "tcp":
		if p.Host == "" {
			errs = append(errs, fmt.Errorf("%s.host: required when transport is \"tcp\"", field))
		}
		if p.Port < 1 || p.Port > 65535 {
			errs = append(errs, fmt.Errorf("%s.port: must be 1-65535, got %d", field, p.Port))
		}
	case "file":
		if p.Path == "" {
			errs = append(errs, fmt.Errorf("%s.path: required when transport is \"file\"", field))
		}
	}

	if isLabel {
		if p.DPI <= 0 {
			errs = append(errs, fmt.Errorf("%s.dpi: must be positive, got %d", field, p.DPI))
		}
		return errs
	}

	if p.WidthMm <= 0 {
		errs = append(errs, fmt.Errorf("%s.widthMm: must be positive, got %d", field, p.WidthMm))
	}
	if p.WidthDots <= 0 {
		errs = append(errs, fmt.Errorf("%s.widthDots: must be positive, got %d", field, p.WidthDots))
	}
	if !slices.Contains(validCutCmds, p.CutCommand) {
		errs = append(errs, fmt.Errorf("%s.cutCommand: must be one of %v, got %q", field, validCutCmds, p.CutCommand))
	}
	if p.CodePage != nil && !slices.Contains(validCodePages, *p.CodePage) {
		errs = append(errs, fmt.Errorf("%s.codePage: must be one of %v or null, got %q", field, validCodePages, *p.CodePage))
	}
	if p.Logo != nil && (p.Logo.Threshold < 0 || p.Logo.Threshold > 255) {
		errs = append(errs, fmt.Errorf("%s.logo.threshold: must be 0-255, got %d", field, p.Logo.Threshold))
	}
	if p.Logo != nil && p.Logo.MaxWidthDots < 0 {
		errs = append(errs, fmt.Errorf("%s.logo.maxWidthDots: must not be negative, got %d", field, p.Logo.MaxWidthDots))
	}

	return errs
}
