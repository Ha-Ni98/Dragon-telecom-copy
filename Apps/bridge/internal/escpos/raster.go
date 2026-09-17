package escpos

import "bytes"

// maxBandRows caps how many rows go into a single GS v 0 command. Some clones misbehave above a
// few hundred rows in one raster command — banding avoids relying on any single clone's actual
// ceiling. See print-bridge-plan-v1.md §5.
const maxBandRows = 128

// BuildRasterBlock wraps an already 1-bit, MSB-first, row-padded bitmap (widthBytes bytes per
// row, height rows — exactly what internal/logo's threshold step produces) in the ESC/POS
// sequence that prints it: ESC @ | ESC a 1 (center) | one GS v 0 per <=128-row band | LF |
// ESC a 0 (restore left). GS v 0 is used over the newer GS ( L raster form because it is the
// older, more universally implemented command across Epson-compatible clones — the same
// widest-compatibility reasoning lib/escpos.ts's own cut-command choice already documents.
func BuildRasterBlock(packed []byte, widthBytes, height int) []byte {
	var buf bytes.Buffer
	buf.Write([]byte{esc, 0x40})       // ESC @ — init; harmless ahead of the web's own ESC @
	buf.Write([]byte{esc, 0x61, 0x01}) // ESC a 1 — center align, for the logo only

	for y0 := 0; y0 < height; y0 += maxBandRows {
		bandH := maxBandRows
		if y0+bandH > height {
			bandH = height - y0
		}
		buf.Write([]byte{gs, 0x76, 0x30, 0x00}) // GS v 0 m=0 — normal-size raster
		buf.WriteByte(byte(widthBytes))
		buf.WriteByte(byte(widthBytes >> 8))
		buf.WriteByte(byte(bandH))
		buf.WriteByte(byte(bandH >> 8))
		start := y0 * widthBytes
		end := (y0 + bandH) * widthBytes
		buf.Write(packed[start:end])
	}

	buf.WriteByte(0x0a)                // LF
	buf.Write([]byte{esc, 0x61, 0x00}) // ESC a 0 — restore left align for what follows

	return buf.Bytes()
}
