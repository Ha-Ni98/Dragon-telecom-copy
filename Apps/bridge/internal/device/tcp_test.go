package device

import (
	"bytes"
	"io"
	"net"
	"strconv"
	"testing"
	"time"
)

func splitHostPort(t *testing.T, addr string) (string, int) {
	t.Helper()
	host, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		t.Fatalf("split %s: %v", addr, err)
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		t.Fatalf("parse port from %s: %v", addr, err)
	}
	return host, port
}

func TestTCPWriter_WritesExactBytes(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()

	received := make(chan []byte, 1)
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			received <- nil
			return
		}
		defer conn.Close()
		data, _ := io.ReadAll(conn)
		received <- data
	}()

	host, port := splitHostPort(t, ln.Addr().String())
	w := &TCPWriter{Host: host, Port: port, Timeout: time.Second}

	if err := w.Open(); err != nil {
		t.Fatalf("Open: %v", err)
	}
	payload := []byte("^XA^FO0,0^BY2^BCN,100,Y,N,N^FD123456^FS^XZ")
	if err := w.Write(payload); err != nil {
		t.Fatalf("Write: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	select {
	case got := <-received:
		if !bytes.Equal(got, payload) {
			t.Errorf("listener received %q, want %q", got, payload)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for the listener to receive the payload")
	}
}

func TestTCPWriter_OpenFailsWhenNothingListening(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	host, port := splitHostPort(t, ln.Addr().String())
	ln.Close() // nothing is listening on this port anymore

	w := &TCPWriter{Host: host, Port: port, Timeout: 200 * time.Millisecond}
	if err := w.Open(); err == nil {
		t.Fatal("expected Open to fail against a closed port")
	}
}

func TestTCPWriter_WriteBeforeOpenErrors(t *testing.T) {
	w := &TCPWriter{Host: "127.0.0.1", Port: 9100}
	if err := w.Write([]byte("x")); err == nil {
		t.Fatal("expected an error writing before Open")
	}
}

func TestTCPWriter_CloseWithoutOpenIsNoop(t *testing.T) {
	w := &TCPWriter{}
	if err := w.Close(); err != nil {
		t.Errorf("Close() on a never-opened writer = %v, want nil", err)
	}
}

func TestTCPWriter_ZeroTimeoutFallsBackToDefault(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()
	go func() {
		conn, err := ln.Accept()
		if err == nil {
			conn.Close()
		}
	}()

	host, port := splitHostPort(t, ln.Addr().String())
	w := &TCPWriter{Host: host, Port: port} // Timeout left at zero
	defer w.Close()

	if err := w.Open(); err != nil {
		t.Fatalf("Open with zero Timeout should fall back to DefaultDialTimeout, got: %v", err)
	}
}
