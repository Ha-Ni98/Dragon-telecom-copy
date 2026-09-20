package dedupe

import (
	"testing"
	"time"
)

func TestSeen_FirstThenRepeat(t *testing.T) {
	d := New(500, 10*time.Minute)

	if d.Seen("job-1") {
		t.Fatal("first Seen() should be false")
	}
	if !d.Seen("job-1") {
		t.Fatal("second Seen() for the same key should be true")
	}
}

func TestSeen_DistinctKeysDoNotCollide(t *testing.T) {
	d := New(500, 10*time.Minute)

	if d.Seen("job-1") {
		t.Fatal("job-1 should be new")
	}
	if d.Seen("job-2") {
		t.Fatal("job-2 should be new")
	}
}

func TestSeen_ExpiresAfterTTL(t *testing.T) {
	now := time.Now()
	d := New(500, 10*time.Minute)
	d.now = func() time.Time { return now }

	d.Seen("job-1")

	now = now.Add(11 * time.Minute) // past the TTL
	if d.Seen("job-1") {
		t.Fatal("an expired key must be treated as unseen")
	}
}

func TestSeen_StillDedupesWithinTTL(t *testing.T) {
	now := time.Now()
	d := New(500, 10*time.Minute)
	d.now = func() time.Time { return now }

	d.Seen("job-1")
	now = now.Add(9 * time.Minute) // inside the TTL
	if !d.Seen("job-1") {
		t.Fatal("a key inside its TTL must still dedupe")
	}
}

func TestSeen_EvictsOldestPastCapacity(t *testing.T) {
	d := New(2, 10*time.Minute)

	d.Seen("job-1")
	d.Seen("job-2")
	d.Seen("job-3") // pushes job-1 out

	// Check job-2 before job-1: Seen() is check-and-insert in one call (by design — see the
	// method doc), so checking the evicted job-1 first would re-insert it and evict job-2 as a
	// side effect, corrupting the second assertion.
	if !d.Seen("job-2") {
		t.Fatal("job-2 should still be tracked")
	}
	if d.Seen("job-1") {
		t.Fatal("job-1 should have been evicted once capacity was exceeded")
	}
}

func TestSeen_RevisitingMovesToFront(t *testing.T) {
	d := New(2, 10*time.Minute)

	d.Seen("job-1")
	d.Seen("job-2")
	d.Seen("job-1") // touches job-1 again, so job-2 is now the least recently used
	d.Seen("job-3") // should evict job-2, not job-1

	if !d.Seen("job-1") {
		t.Fatal("job-1 was touched most recently and should not have been evicted")
	}
}
