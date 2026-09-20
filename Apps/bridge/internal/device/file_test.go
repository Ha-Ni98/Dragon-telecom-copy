package device

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFileWriter_WritesExactBytes(t *testing.T) {
	path := filepath.Join(t.TempDir(), "printer")
	w := &FileWriter{Path: path}

	if err := w.Open(); err != nil {
		t.Fatalf("Open: %v", err)
	}
	payload := []byte{0x1b, 0x40, 'h', 'i'}
	if err := w.Write(payload); err != nil {
		t.Fatalf("Write: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read back: %v", err)
	}
	if string(got) != string(payload) {
		t.Errorf("file contents = %q, want %q", got, payload)
	}
}

func TestFileWriter_SecondWriteDoesNotLeaveStaleTail(t *testing.T) {
	path := filepath.Join(t.TempDir(), "printer")

	w1 := &FileWriter{Path: path}
	if err := w1.Open(); err != nil {
		t.Fatalf("Open (1): %v", err)
	}
	if err := w1.Write([]byte("a very long first payload")); err != nil {
		t.Fatalf("Write (1): %v", err)
	}
	if err := w1.Close(); err != nil {
		t.Fatalf("Close (1): %v", err)
	}

	w2 := &FileWriter{Path: path}
	if err := w2.Open(); err != nil {
		t.Fatalf("Open (2): %v", err)
	}
	if err := w2.Write([]byte("short")); err != nil {
		t.Fatalf("Write (2): %v", err)
	}
	if err := w2.Close(); err != nil {
		t.Fatalf("Close (2): %v", err)
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read back: %v", err)
	}
	if string(got) != "short" {
		t.Errorf("file contents = %q, want exactly \"short\" (no stale tail from the first write)", got)
	}
}

func TestFileWriter_WriteBeforeOpenErrors(t *testing.T) {
	w := &FileWriter{Path: filepath.Join(t.TempDir(), "printer")}
	if err := w.Write([]byte("x")); err == nil {
		t.Fatal("expected an error writing before Open")
	}
}

func TestFileWriter_CloseWithoutOpenIsNoop(t *testing.T) {
	w := &FileWriter{}
	if err := w.Close(); err != nil {
		t.Errorf("Close() on a never-opened writer = %v, want nil", err)
	}
}

func TestFileWriter_OpenFailsOnUnwritablePath(t *testing.T) {
	w := &FileWriter{Path: filepath.Join(t.TempDir(), "no-such-dir", "printer")}
	if err := w.Open(); err == nil {
		t.Fatal("expected Open to fail when the parent directory does not exist")
	}
}
