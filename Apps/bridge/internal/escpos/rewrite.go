// Package escpos manipulates already-generated ESC/POS byte streams: rewriting the trailing cut
// command and (see codepage.go) the leading code-page selector to match a printer clone's actual
// firmware — the one place the helper is allowed to edit a payload, because it alone knows the
// device (print-bridge-protocol.md's "Hardware-specific details the helper may need to
// override"). Never used for ZPL: this package only ever touches bytes the web generates in
// ESC/POS.
package escpos

import "bytes"

const (
	esc = 0x1b
	gs  = 0x1d
)

// webCutSuffix is the exact trailing sequence Apps/web/src/lib/escpos.ts's finishReceipt always
// appends: ESC d 4 (feed 4 lines), GS V 66 0 (function B, partial cut, no extra feed). Matched as
// a literal suffix — surgical, not a heuristic — so a payload that doesn't end exactly this way
// is left untouched rather than risk corrupting bytes the helper doesn't recognise.
var webCutSuffix = []byte{esc, 0x64, 0x04, gs, 0x56, 0x42, 0x00}

// cutReplacements gives the GS V ... bytes to substitute for each cutCommand config value.
// "auto" (and "") never reach this map — see RewriteCut. Values match the Epson ESC/POS
// reference's GS V forms, the same ones documented in lib/escpos.ts's own CMD comment.
var cutReplacements = map[string][]byte{
	"GSV66": {gs, 0x56, 0x42, 0x00}, // function B, partial cut — identical to the web's own default
	"GSV0":  {gs, 0x56, 0x00},       // full cut, single-byte form
	"GSV1":  {gs, 0x56, 0x01},       // partial cut, single-byte form
	"none":  {},                     // strip the cut command entirely — feed-only
}

// RewriteCut substitutes payload's trailing cut sequence per cutCommand. "auto" or "" leaves the
// payload untouched — that is the whole point of the default. If the payload does not end with
// the exact bytes the web is known to emit, it is also returned unmodified: skipping an override
// is always safer than corrupting a payload shape the helper doesn't recognise.
func RewriteCut(payload []byte, cutCommand string) []byte {
	if cutCommand == "" || cutCommand == "auto" {
		return payload
	}
	replacement, ok := cutReplacements[cutCommand]
	if !ok {
		return payload
	}
	if !bytes.HasSuffix(payload, webCutSuffix) {
		return payload
	}

	feedPrefix := webCutSuffix[:3] // ESC d 4 — kept regardless of which cut variant follows it
	out := make([]byte, 0, len(payload)-len(webCutSuffix)+len(feedPrefix)+len(replacement))
	out = append(out, payload[:len(payload)-len(webCutSuffix)]...)
	out = append(out, feedPrefix...)
	out = append(out, replacement...)
	return out
}
