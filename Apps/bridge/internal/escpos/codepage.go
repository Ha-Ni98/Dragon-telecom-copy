package escpos

import (
	"bytes"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/charmap"
)

// webCodePagePrefix is the exact leading sequence Apps/web/src/lib/escpos.ts's startReceipt
// always emits: ESC @ (init), ESC t 0 (CP437). Matched as a literal prefix for the same reason
// RewriteCut only matches a known suffix — surgical, not a heuristic.
var webCodePagePrefix = []byte{esc, 0x40, esc, 0x74, 0x00}

// codePageTarget pairs the ESC t n selector byte Epson's spec assigns a code page with the
// golang.org/x/text/encoding/charmap table the payload's CP437 bytes must be transcoded into.
// golang.org/x/text is the one dependency beyond x/sys the project's dependency policy allows
// here, added specifically because these tables are not something worth hand-transcribing: CP858
// diverges from CP437 in ways that are easy to get subtly wrong (¢ and ¥ land at different bytes
// than CP437 despite most of the accented-letter block matching) — verified against the real
// library output rather than a memorized reference, see the plan's Sprint 5 notes.
var codePageTargets = map[string]struct {
	selector byte
	table    *charmap.Charmap
}{
	"CP1252": {16, charmap.Windows1252},
	"CP858":  {19, charmap.CodePage858},
}

// RewriteCodePage rewrites payload's leading ESC t n selector and transcodes every CP437 byte in
// the payload to codePage's equivalent. "" or "CP437" (the web's own default) leaves the payload
// untouched — nothing to override. If the payload doesn't start with the exact bytes the web is
// known to emit, or codePage names something unrecognised, the payload is returned unmodified:
// skipping an override is always safer than corrupting a payload shape the helper doesn't
// recognise.
func RewriteCodePage(payload []byte, codePage string) []byte {
	if codePage == "" || codePage == "CP437" {
		return payload
	}
	target, ok := codePageTargets[codePage]
	if !ok {
		return payload
	}
	if !bytes.HasPrefix(payload, webCodePagePrefix) {
		return payload
	}

	// Overwrite the selector byte before transcoding, not after: it is itself in the control-byte
	// range (< 0x20), which — like every ESC/GS command sequence — round-trips unchanged through
	// CP437 -> Unicode -> any of these single-byte code pages. That means the WHOLE payload can
	// go through the same decode/encode pass without needing to locate exactly which bytes are
	// "text" versus protocol bytes; only the printable high-byte (0x80-0xFF) characters actually
	// change.
	withSelector := append([]byte(nil), payload...)
	withSelector[len(webCodePagePrefix)-1] = target.selector

	decoded, err := charmap.CodePage437.NewDecoder().Bytes(withSelector)
	if err != nil {
		return payload
	}
	// ReplaceUnsupported: a rune with no equivalent in the target code page becomes '?' rather
	// than failing the whole job — the same "a dropped accent is an acceptable worst case,
	// mojibake is not" stance lib/escpos.ts's own encodeText already takes. Nothing in the web's
	// actual CP437 output should ever hit this path; it exists only as a fail-safe.
	transcoded, err := encoding.ReplaceUnsupported(target.table.NewEncoder()).Bytes(decoded)
	if err != nil {
		return payload
	}
	return transcoded
}
