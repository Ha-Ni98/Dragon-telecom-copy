package device

import (
	"context"
	"net"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

// DefaultProbeInterval and DefaultProbeTimeout match print-bridge-plan-v1.md §4's "/status":
// "a background prober checks each device every 10s (TCP dial with a 500ms timeout; ...)".
const (
	DefaultProbeInterval = 10 * time.Second
	DefaultProbeTimeout  = 500 * time.Millisecond
)

// Prober periodically checks each printer's reachability in the background and caches the
// result, so GET /status can read it instantly instead of risking the web's 1.5s abort by probing
// inline. Construct with NewProber; the zero value is not usable.
type Prober struct {
	interval time.Duration
	checks   map[string]func() bool
	cache    sync.Map // target -> *atomic.Bool
}

func NewProber(interval time.Duration) *Prober {
	return &Prober{interval: interval, checks: make(map[string]func() bool)}
}

// Register adds target ("label" or "receipt") with the check to run for it. Call before Run;
// not safe to call concurrently with Run or Connected.
func (p *Prober) Register(target string, check func() bool) {
	var cached atomic.Bool
	p.cache.Store(target, &cached)
	p.checks[target] = check
}

// Connected reports the last cached result for target. An unregistered target — e.g. one whose
// transport has no probe implemented yet, like "spooler" before Sprint 4 — reports false. That is
// the honest default: httpapi's own WithConnected doc makes the same call rather than fabricating
// true for a target nothing has actually checked.
func (p *Prober) Connected(target string) bool {
	v, ok := p.cache.Load(target)
	if !ok {
		return false
	}
	return v.(*atomic.Bool).Load()
}

// Run probes every registered target immediately, then again every interval, until ctx is
// cancelled. Intended to run once, in its own goroutine, for the process's lifetime.
func (p *Prober) Run(ctx context.Context) {
	p.probeAll()
	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.probeAll()
		}
	}
}

func (p *Prober) probeAll() {
	for target, check := range p.checks {
		v, ok := p.cache.Load(target)
		if !ok {
			continue
		}
		v.(*atomic.Bool).Store(check())
	}
}

// TCPCheck dials addr (host:port) with a short timeout. Success means only that something is
// accepting connections there — the same weak, informational guarantee print-bridge-protocol.md
// assigns to "connected" generally.
func TCPCheck(addr string, timeout time.Duration) func() bool {
	return func() bool {
		conn, err := net.DialTimeout("tcp", addr, timeout)
		if err != nil {
			return false
		}
		_ = conn.Close()
		return true
	}
}

// FileCheck reports whether path exists. Necessarily weak for a real character device — a
// successful stat doesn't prove a printer is attached — but it is the only signal available
// without writing test bytes to the device purely to answer a status probe, which the protocol's
// "connected is informational" stance says not to risk.
func FileCheck(path string) func() bool {
	return func() bool {
		_, err := os.Stat(path)
		return err == nil
	}
}

// SpoolerCheck reports whether queueName currently appears among the installed Windows printer
// queues (ListPrinters, from spooler_windows.go). Off Windows, ListPrinters always errors — see
// spooler_other.go — so this correctly and honestly reports false there: there is no spooler to
// check, not a fabricated true.
func SpoolerCheck(queueName string) func() bool {
	return spoolerCheck(ListPrinters, queueName)
}

// spoolerCheck takes the lister as a parameter purely so the matching/error logic above is
// testable on any OS, without needing the real (Windows-only) ListPrinters.
func spoolerCheck(list func() ([]string, error), queueName string) func() bool {
	return func() bool {
		names, err := list()
		if err != nil {
			return false
		}
		for _, n := range names {
			if n == queueName {
				return true
			}
		}
		return false
	}
}
