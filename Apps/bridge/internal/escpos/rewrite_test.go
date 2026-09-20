package escpos

import (
	"bytes"
	"testing"
)

// fixturePayload mimics the real shape lib/escpos.ts's builder produces: INIT + codepage
// selector + font, some body text, then finishReceipt's FEED_AND_CUT tail — the exact structure
// RewriteCut and RewriteCodePage are written against.
func fixturePayload(body string) []byte {
	var buf bytes.Buffer
	buf.Write([]byte{esc, 0x40})       // ESC @ — init
	buf.Write([]byte{esc, 0x74, 0x00}) // ESC t 0 — CP437
	buf.Write([]byte{esc, 0x4d, 0x00}) // ESC M 0 — font A
	buf.WriteString(body)
	buf.WriteByte(0x0a) // LF
	buf.Write(webCutSuffix)
	return buf.Bytes()
}

func TestRewriteCut_AutoLeavesPayloadUntouched(t *testing.T) {
	payload := fixturePayload("hello")
	got := RewriteCut(payload, "auto")
	if !bytes.Equal(got, payload) {
		t.Errorf("RewriteCut with \"auto\" modified the payload")
	}
}

func TestRewriteCut_EmptyStringLeavesPayloadUntouched(t *testing.T) {
	payload := fixturePayload("hello")
	got := RewriteCut(payload, "")
	if !bytes.Equal(got, payload) {
		t.Errorf("RewriteCut with \"\" modified the payload")
	}
}

func TestRewriteCut_GSV66MatchesWebDefault(t *testing.T) {
	payload := fixturePayload("hello")
	got := RewriteCut(payload, "GSV66")
	// GSV66 is byte-for-byte what the web already emits, so an explicit override should be a
	// no-op — the golden case that proves the substitution logic round-trips correctly.
	if !bytes.Equal(got, payload) {
		t.Errorf("RewriteCut with \"GSV66\" changed bytes it should have reproduced exactly\ngot:  % x\nwant: % x", got, payload)
	}
}

func TestRewriteCut_GSV0ProducesExactBytes(t *testing.T) {
	payload := fixturePayload("hello")
	got := RewriteCut(payload, "GSV0")

	want := append([]byte{}, payload[:len(payload)-len(webCutSuffix)]...)
	want = append(want, esc, 0x64, 0x04) // ESC d 4 — feed, unchanged
	want = append(want, gs, 0x56, 0x00)  // GS V 0 — full cut, single-byte form

	if !bytes.Equal(got, want) {
		t.Errorf("RewriteCut with \"GSV0\":\ngot:  % x\nwant: % x", got, want)
	}
}

func TestRewriteCut_GSV1ProducesExactBytes(t *testing.T) {
	payload := fixturePayload("hello")
	got := RewriteCut(payload, "GSV1")

	want := append([]byte{}, payload[:len(payload)-len(webCutSuffix)]...)
	want = append(want, esc, 0x64, 0x04)
	want = append(want, gs, 0x56, 0x01)

	if !bytes.Equal(got, want) {
		t.Errorf("RewriteCut with \"GSV1\":\ngot:  % x\nwant: % x", got, want)
	}
}

func TestRewriteCut_NoneStripsCutKeepingFeed(t *testing.T) {
	payload := fixturePayload("hello")
	got := RewriteCut(payload, "none")

	want := append([]byte{}, payload[:len(payload)-len(webCutSuffix)]...)
	want = append(want, esc, 0x64, 0x04) // feed only — no GS V ... bytes at all

	if !bytes.Equal(got, want) {
		t.Errorf("RewriteCut with \"none\":\ngot:  % x\nwant: % x", got, want)
	}
}

func TestRewriteCut_UnrecognisedSuffixIsLeftUntouched(t *testing.T) {
	payload := fixturePayload("hello")
	payload[len(payload)-1] = 0xff // corrupt the last byte so it no longer matches webCutSuffix

	got := RewriteCut(payload, "GSV0")
	if !bytes.Equal(got, payload) {
		t.Error("RewriteCut modified a payload that did not end with the expected cut suffix")
	}
}

func TestRewriteCut_UnknownCutCommandIsLeftUntouched(t *testing.T) {
	payload := fixturePayload("hello")
	got := RewriteCut(payload, "SOME_FUTURE_VALUE")
	if !bytes.Equal(got, payload) {
		t.Error("RewriteCut modified the payload for an unrecognised cutCommand value")
	}
}

func TestRewriteCut_DoesNotMutateInputSlice(t *testing.T) {
	payload := fixturePayload("hello")
	original := append([]byte{}, payload...)

	_ = RewriteCut(payload, "GSV0")

	if !bytes.Equal(payload, original) {
		t.Error("RewriteCut mutated its input slice in place")
	}
}
