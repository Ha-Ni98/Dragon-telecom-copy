package device

import (
	"context"
	"net"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

func waitFor(t *testing.T, timeout time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("condition was never met within the timeout")
		}
		time.Sleep(time.Millisecond)
	}
}

func TestProber_UnregisteredTargetReportsFalse(t *testing.T) {
	p := NewProber(time.Hour)
	if p.Connected("label") {
		t.Error("an unregistered target should report false")
	}
}

func TestProber_RunProbesImmediatelyOnStart(t *testing.T) {
	p := NewProber(time.Hour) // long interval: only the immediate probe on Run should matter here
	p.Register("label", func() bool { return true })

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		p.Run(ctx)
		close(done)
	}()

	waitFor(t, time.Second, func() bool { return p.Connected("label") })

	cancel()
	<-done
}

func TestProber_ReflectsCheckResultChanges(t *testing.T) {
	var up atomic.Bool
	up.Store(true)

	p := NewProber(5 * time.Millisecond)
	p.Register("receipt", func() bool { return up.Load() })

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		p.Run(ctx)
		close(done)
	}()
	defer func() {
		cancel()
		<-done
	}()

	waitFor(t, time.Second, func() bool { return p.Connected("receipt") })

	up.Store(false)
	waitFor(t, time.Second, func() bool { return !p.Connected("receipt") })
}

func TestProber_StopsOnContextCancel(t *testing.T) {
	p := NewProber(5 * time.Millisecond)
	p.Register("label", func() bool { return true })

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		p.Run(ctx)
		close(done)
	}()
	cancel()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Run did not return after context cancellation")
	}
}

func TestTCPCheck(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			conn.Close()
		}
	}()

	check := TCPCheck(ln.Addr().String(), 200*time.Millisecond)
	if !check() {
		t.Error("TCPCheck should report true against a listening address")
	}

	ln.Close()
	checkAfterClose := TCPCheck(ln.Addr().String(), 200*time.Millisecond)
	if checkAfterClose() {
		t.Error("TCPCheck should report false once nothing is listening")
	}
}

func TestFileCheck(t *testing.T) {
	dir := t.TempDir()
	existing := filepath.Join(dir, "exists")
	if err := os.WriteFile(existing, []byte("x"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	if !FileCheck(existing)() {
		t.Error("FileCheck should report true for an existing path")
	}
	if FileCheck(filepath.Join(dir, "missing"))() {
		t.Error("FileCheck should report false for a missing path")
	}
}
