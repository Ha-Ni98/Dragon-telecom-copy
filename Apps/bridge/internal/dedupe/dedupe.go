// Package dedupe tracks recently seen print job IDs so a human's double-click on Print — or a web
// client retrying at the transport level — cannot reach the printer twice. See
// print-bridge-plan-v1.md §4 ("De-duplication").
package dedupe

import (
	"container/list"
	"sync"
	"time"
)

// DefaultCapacity and DefaultTTL are the values the plan settled on: enough to cover a busy
// counter's jobs for the window a human might plausibly double-click, without growing unbounded.
const (
	DefaultCapacity = 500
	DefaultTTL      = 10 * time.Minute
)

type entry struct {
	key       string
	expiresAt time.Time
}

// Dedupe is a thread-safe, size- and time-bounded set of recently seen job IDs. Deliberately not
// persisted across restarts: a restart is rare, and a lost entry costs one duplicate print at
// worst — cheaper than a stale on-disk cache silently swallowing a genuine reprint.
type Dedupe struct {
	mu       sync.Mutex
	capacity int
	ttl      time.Duration
	now      func() time.Time
	order    *list.List               // front = most recently used
	index    map[string]*list.Element // key -> element (element.Value is *entry)
}

func New(capacity int, ttl time.Duration) *Dedupe {
	return &Dedupe{
		capacity: capacity,
		ttl:      ttl,
		now:      time.Now,
		order:    list.New(),
		index:    make(map[string]*list.Element),
	}
}

// Seen reports whether key was already recorded within the TTL, and records it either way — a
// single call is both the check and the insert, so callers must invoke it exactly once per
// request rather than checking and inserting separately (which would race under concurrent
// requests).
func (d *Dedupe) Seen(key string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := d.now()

	if el, ok := d.index[key]; ok {
		e := el.Value.(*entry)
		if now.Before(e.expiresAt) {
			d.order.MoveToFront(el)
			return true
		}
		d.order.Remove(el)
		delete(d.index, key)
	}

	el := d.order.PushFront(&entry{key: key, expiresAt: now.Add(d.ttl)})
	d.index[key] = el

	for d.order.Len() > d.capacity {
		oldest := d.order.Back()
		if oldest == nil {
			break
		}
		d.order.Remove(oldest)
		delete(d.index, oldest.Value.(*entry).key)
	}

	return false
}
