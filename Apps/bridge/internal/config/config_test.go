package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func write(t *testing.T, contents string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	return path
}

func TestLoad_DefaultsFillGaps(t *testing.T) {
	path := write(t, `{
		"printers": {
			"label":   {"queueName": "ZDesigner GK420d"},
			"receipt": {"host": "192.168.1.50"}
		}
	}`)

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if cfg.Port != 9110 {
		t.Errorf("Port = %d, want default 9110", cfg.Port)
	}
	if len(cfg.AllowedOrigins) != 1 || cfg.AllowedOrigins[0] != "*" {
		t.Errorf("AllowedOrigins = %v, want default [*]", cfg.AllowedOrigins)
	}
	if cfg.Printers.Label.Language != "ZPL" || cfg.Printers.Label.DPI != 203 {
		t.Errorf("label defaults not applied: %+v", cfg.Printers.Label)
	}
	if cfg.Printers.Label.QueueName != "ZDesigner GK420d" {
		t.Errorf("label.queueName not read from file: %+v", cfg.Printers.Label)
	}
	if cfg.Printers.Receipt.Language != "ESCPOS" || cfg.Printers.Receipt.WidthMm != 80 {
		t.Errorf("receipt defaults not applied: %+v", cfg.Printers.Receipt)
	}
	if cfg.Printers.Receipt.Host != "192.168.1.50" {
		t.Errorf("receipt.host not read from file: %+v", cfg.Printers.Receipt)
	}
}

func TestLoad_MissingFile(t *testing.T) {
	if _, err := Load(filepath.Join(t.TempDir(), "nope.json")); err == nil {
		t.Fatal("expected an error for a missing config file")
	}
}

func TestLoad_MalformedJSON(t *testing.T) {
	path := write(t, `{not json`)
	if _, err := Load(path); err == nil {
		t.Fatal("expected an error for malformed JSON")
	}
}

func TestValidate_RejectsBadPort(t *testing.T) {
	cfg := Default()
	cfg.Port = 70000
	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "port") {
		t.Fatalf("Validate() = %v, want a port error", err)
	}
}

func TestValidate_RejectsEmptyOrigins(t *testing.T) {
	cfg := Default()
	cfg.AllowedOrigins = nil
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected an error for empty allowedOrigins")
	}
}

func TestValidate_TCPRequiresHostAndPort(t *testing.T) {
	cfg := Default()
	cfg.Printers.Receipt.Transport = "tcp"
	cfg.Printers.Receipt.Host = ""
	cfg.Printers.Receipt.Port = 0

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected an error")
	}
	if !strings.Contains(err.Error(), "host") || !strings.Contains(err.Error(), "port") {
		t.Errorf("Validate() = %v, want both a host and a port error", err)
	}
}

func TestValidate_SpoolerRequiresQueueName(t *testing.T) {
	cfg := Default()
	cfg.Printers.Label.Transport = "spooler"
	cfg.Printers.Label.QueueName = ""

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "queueName") {
		t.Fatalf("Validate() = %v, want a queueName error", err)
	}
}

func TestValidate_FileRequiresPath(t *testing.T) {
	cfg := Default()
	cfg.Printers.Label.Transport = "file"
	cfg.Printers.Label.QueueName = ""

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "path") {
		t.Fatalf("Validate() = %v, want a path error", err)
	}
}

func TestValidate_RejectsUnknownLanguage(t *testing.T) {
	cfg := Default()
	cfg.Printers.Label.Language = "PCL"

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "language") {
		t.Fatalf("Validate() = %v, want a language error", err)
	}
}

func TestValidate_RejectsUnknownCodePage(t *testing.T) {
	cfg := Default()
	bad := "CP1250"
	cfg.Printers.Receipt.CodePage = &bad

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "codePage") {
		t.Fatalf("Validate() = %v, want a codePage error", err)
	}
}

func TestValidate_NilCodePageIsValid(t *testing.T) {
	cfg := Default()
	cfg.Printers.Label.QueueName = "TestZebra"
	cfg.Printers.Receipt.Host = "192.168.1.50"
	cfg.Printers.Receipt.CodePage = nil // "auto" — leave the web's CP437 untouched
	if err := cfg.Validate(); err != nil {
		t.Errorf("Validate() = %v, want nil codePage to be valid", err)
	}
}

func TestValidate_RejectsUnknownCutCommand(t *testing.T) {
	cfg := Default()
	cfg.Printers.Receipt.CutCommand = "GSVBOGUS"

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "cutCommand") {
		t.Fatalf("Validate() = %v, want a cutCommand error", err)
	}
}

func TestValidate_RejectsThresholdOutOfRange(t *testing.T) {
	cfg := Default()
	cfg.Printers.Receipt.Logo = &LogoConfig{Enabled: true, Threshold: 300}

	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "threshold") {
		t.Fatalf("Validate() = %v, want a threshold error", err)
	}
}

func TestValidate_CollectsAllErrors(t *testing.T) {
	cfg := &Config{} // zero value: every required field is missing or invalid

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected an error")
	}
	// Port, origins, logFile, both printers' language/transport, label.dpi, receipt.widthMm,
	// widthDots and cutCommand — Validate must not stop at the first failure.
	if got := strings.Count(err.Error(), "\n"); got < 8 {
		t.Errorf("expected Validate to collect many errors, got %d lines:\n%s", got+1, err)
	}
}

func TestExampleConfig_Loads(t *testing.T) {
	if _, err := Load("../../config.example.json"); err != nil {
		t.Fatalf("config.example.json must be valid: %v", err)
	}
}
