package escpos

import (
	"bytes"
	"testing"
)

func TestRewriteCodePage_EmptyOrCP437LeavesPayloadUntouched(t *testing.T) {
	payload := fixturePayload("café")
	for _, cp := range []string{"", "CP437"} {
		got := RewriteCodePage(payload, cp)
		if !bytes.Equal(got, payload) {
			t.Errorf("RewriteCodePage(%q) modified the payload", cp)
		}
	}
}

func TestRewriteCodePage_UnrecognisedValueLeftUntouched(t *testing.T) {
	payload := fixturePayload("café")
	got := RewriteCodePage(payload, "CP1250")
	if !bytes.Equal(got, payload) {
		t.Error("RewriteCodePage modified the payload for an unrecognised codePage value")
	}
}

func TestRewriteCodePage_MissingPrefixLeftUntouched(t *testing.T) {
	payload := []byte("no header at all, just text")
	got := RewriteCodePage(payload, "CP1252")
	if !bytes.Equal(got, payload) {
		t.Error("RewriteCodePage modified a payload lacking the expected ESC @ / ESC t 0 prefix")
	}
}

func TestRewriteCodePage_CP1252SelectorAndAccentsRewritten(t *testing.T) {
	// "café" in CP437 is c,a,f,0x82(é) — 0x82 is what lib/escpos.ts's own CP437 map assigns 'é'.
	payload := append([]byte{esc, 0x40, esc, 0x74, 0x00}, 'c', 'a', 'f', 0x82)

	got := RewriteCodePage(payload, "CP1252")

	want := []byte{esc, 0x40, esc, 0x74, 16, 'c', 'a', 'f', 0xe9} // selector=16, é=0xE9 in CP1252
	if !bytes.Equal(got, want) {
		t.Errorf("CP1252 rewrite:\ngot:  % x\nwant: % x", got, want)
	}
}

func TestRewriteCodePage_CP858SelectorAndDivergentByteRewritten(t *testing.T) {
	// The cent sign is the case that actually distinguishes CP858 from CP437/CP1252: CP437 emits
	// it as 0x9B, but CP858 assigns the same character a different byte (0xBD) — verified against
	// the real charmap tables, not memorized, precisely because this is where a hand-built table
	// would have been likely to go wrong.
	payload := append([]byte{esc, 0x40, esc, 0x74, 0x00}, 0x9b) // 0x9B = ¢ in CP437

	got := RewriteCodePage(payload, "CP858")

	want := []byte{esc, 0x40, esc, 0x74, 19, 0xbd} // selector=19, ¢=0xBD in CP858
	if !bytes.Equal(got, want) {
		t.Errorf("CP858 rewrite:\ngot:  % x\nwant: % x", got, want)
	}
}

func TestRewriteCodePage_ControlBytesSurviveUnchanged(t *testing.T) {
	payload := fixturePayload("plain ascii, no accents")
	got := RewriteCodePage(payload, "CP1252")

	// Every byte outside the accented range must round-trip byte-for-byte, including the
	// finishReceipt cut tail this fixture carries — codepage rewriting must never touch it.
	if !bytes.HasSuffix(got, webCutSuffix) {
		t.Errorf("cut suffix was altered by a codepage rewrite: % x", got)
	}
	if got[0] != esc || got[1] != 0x40 {
		t.Errorf("ESC @ init sequence was altered: % x", got[:2])
	}
}

func TestRewriteCodePage_AllWebCP437CharsSurviveCP1252Roundtrip(t *testing.T) {
	// Every character lib/escpos.ts's own CP437 map can produce, run through the same rewrite —
	// none should come back as '?' (the ReplaceUnsupported fallback), since CP1252 covers all of
	// them.
	accented := "Ç ü é â ä à å ç ê ë è ï î ì Ä Å É æ Æ ô ö ò û ù ÿ Ö Ü ¢ £ ¥ á í ó ú ñ Ñ º ª ¿ ° · ²"
	payload := fixturePayload(accented)

	got := RewriteCodePage(payload, "CP1252")

	if bytes.ContainsRune(got, '?') {
		t.Errorf("CP1252 rewrite substituted '?' for a character it should fully support: % x", got)
	}
}

func TestRewriteCodePage_DoesNotMutateInputSlice(t *testing.T) {
	payload := append([]byte{esc, 0x40, esc, 0x74, 0x00}, 0x82)
	original := append([]byte{}, payload...)

	_ = RewriteCodePage(payload, "CP1252")

	if !bytes.Equal(payload, original) {
		t.Error("RewriteCodePage mutated its input slice in place")
	}
}
