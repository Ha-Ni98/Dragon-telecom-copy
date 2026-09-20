package device

import (
	"fmt"
	"net"
	"strconv"
	"time"
)

// DefaultDialTimeout applies when TCPWriter.Timeout is zero.
const DefaultDialTimeout = 5 * time.Second

// TCPWriter writes to a network printer's raw port (typically 9100, the "JetDirect"/"AppSocket"
// convention every Ethernet-capable label/receipt printer speaks). One TCP connection per job:
// dialled in Open, written to, and closed — nothing is kept alive between jobs.
type TCPWriter struct {
	Host    string
	Port    int
	Timeout time.Duration // dial timeout; zero means DefaultDialTimeout

	conn net.Conn
}

func (w *TCPWriter) Open() error {
	timeout := w.Timeout
	if timeout <= 0 {
		timeout = DefaultDialTimeout
	}
	// net.JoinHostPort, not fmt.Sprintf("%s:%d", ...): a bare "%s:%d" is ambiguous/wrong for an
	// IPv6 host (needs "[::1]:9100" bracket notation), which JoinHostPort handles correctly.
	addr := net.JoinHostPort(w.Host, strconv.Itoa(w.Port))
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return fmt.Errorf("dial %s: %w", addr, err)
	}
	w.conn = conn
	return nil
}

func (w *TCPWriter) Write(payload []byte) error {
	if w.conn == nil {
		return fmt.Errorf("tcp writer: Write called before a successful Open")
	}
	_, err := w.conn.Write(payload)
	return err
}

func (w *TCPWriter) Close() error {
	if w.conn == nil {
		return nil
	}
	err := w.conn.Close()
	w.conn = nil
	return err
}
