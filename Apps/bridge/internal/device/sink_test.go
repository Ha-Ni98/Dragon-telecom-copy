package device

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDryRunWriter_CapturesEachWriteAsItsOwnFile(t *testing.T) {
	dir := t.TempDir()
	w := &DryRunWriter{Dir: dir, Target: "receipt"}

	if err := w.Open(); err != nil {
		t.Fatalf("Open: %v", err)
	}
	if err := w.Write([]byte("job one")); err != nil {
		t.Fatalf("Write (1): %v", err)
	}
	if err := w.Write([]byte("job two")); err != nil {
		t.Fatalf("Write (2): %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read dir: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("got %d files, want 2", len(entries))
	}

	want := map[string]bool{"job one": true, "job two": true}
	for _, e := range entries {
		if filepath.Ext(e.Name()) != ".bin" {
			t.Errorf("file %s does not have a .bin extension", e.Name())
		}
		b, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			t.Fatalf("read %s: %v", e.Name(), err)
		}
		if !want[string(b)] {
			t.Errorf("unexpected file contents %q", b)
		}
		delete(want, string(b))
	}
	if len(want) != 0 {
		t.Errorf("missing expected contents: %v", want)
	}
}

func TestDryRunWriter_CreatesDirIfMissing(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "nested", "dryrun")
	w := &DryRunWriter{Dir: dir, Target: "label"}

	if err := w.Open(); err != nil {
		t.Fatalf("Open: %v", err)
	}
	if _, err := os.Stat(dir); err != nil {
		t.Errorf("Open did not create %s: %v", dir, err)
	}
}

func TestDryRunWriter_FilenameIncludesTarget(t *testing.T) {
	dir := t.TempDir()
	w := &DryRunWriter{Dir: dir, Target: "label"}
	if err := w.Open(); err != nil {
		t.Fatalf("Open: %v", err)
	}
	if err := w.Write([]byte("^XA^XZ")); err != nil {
		t.Fatalf("Write: %v", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read dir: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("got %d files, want 1", len(entries))
	}
	if got := entries[0].Name(); got[:6] != "label-" {
		t.Errorf("filename = %q, want it to start with \"label-\"", got)
	}
}
