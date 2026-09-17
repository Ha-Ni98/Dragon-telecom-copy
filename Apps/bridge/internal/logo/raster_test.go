package logo

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"

	"dragon-telecom/bridge/internal/escpos"
)

// buildFixtureImage makes an 8x4 image with a deliberately simple, hand-verifiable pattern:
// row 0 solid black, row 1 solid white, row 2 alternating black/white starting black,
// row 3 alternating white/black starting white. 8px wide packs to exactly 1 byte per row.
func buildFixtureImage() image.Image {
	img := image.NewGray(image.Rect(0, 0, 8, 4))
	black := color.Gray{Y: 0}
	white := color.Gray{Y: 255}
	for x := 0; x < 8; x++ {
		img.Set(x, 0, black)
		img.Set(x, 1, white)
		if x%2 == 0 {
			img.Set(x, 2, black)
			img.Set(x, 3, white)
		} else {
			img.Set(x, 2, white)
			img.Set(x, 3, black)
		}
	}
	return img
}

// wantFixtureRaster is BuildRasterBlock's expected output for the fixture at 1:1 scale (no
// resize distortion — targetWidth equals the source width), computed by hand from the pattern
// above: row0=0xFF (all dots), row1=0x00 (no dots), row2=0xAA (10101010), row3=0x55 (01010101).
var wantFixtureRaster = []byte{
	esc, 0x40, esc, 0x61, 0x01, // ESC @, ESC a 1
	gs, 0x76, 0x30, 0x00, 0x01, 0x00, 0x04, 0x00, // GS v 0 m=0, xL/xH=1/0, yL/yH=4/0
	0xff, 0x00, 0xaa, 0x55, // packed rows
	0x0a, esc, 0x61, 0x00, // LF, ESC a 0
}

const (
	esc = 0x1b
	gs  = 0x1d
)

func TestRaster_GoldenAgainstHandBuiltImage(t *testing.T) {
	img := buildFixtureImage()

	got := Raster(img, 8, 128)

	if !bytes.Equal(got, wantFixtureRaster) {
		t.Errorf("Raster (direct image):\ngot:  % x\nwant: % x", got, wantFixtureRaster)
	}
}

func TestRaster_GoldenAgainstFixturePNG(t *testing.T) {
	// Exercises the real png.Encode/png.Decode round trip — "byte-exact golden test against a
	// fixture PNG" per print-bridge-plan-v1.md's Sprint 6 acceptance bar — rather than trusting
	// image/png's grayscale round-trip is lossless without checking.
	img := buildFixtureImage()

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode fixture PNG: %v", err)
	}
	decoded, err := png.Decode(&buf)
	if err != nil {
		t.Fatalf("decode fixture PNG: %v", err)
	}

	got := Raster(decoded, 8, 128)

	if !bytes.Equal(got, wantFixtureRaster) {
		t.Errorf("Raster (via PNG round-trip):\ngot:  % x\nwant: % x", got, wantFixtureRaster)
	}
}

func TestRaster_DownscalePreservesAspectRatio(t *testing.T) {
	// 8x4 source, downscaled to width 4 -> height should be 4*4/8 = 2.
	img := buildFixtureImage()

	got := Raster(img, 4, 128)

	// yL/yH sit at fixed offsets in the header regardless of content; decode them directly.
	// ESC@ (2) + ESC a1 (3) + GS v0 m=0 (4) = 9 bytes, then xL(9) xH(10) yL(11) yH(12).
	if len(got) < 13 {
		t.Fatalf("output too short to contain a header: % x", got)
	}
	yL, yH := got[11], got[12]
	height := int(yL) | int(yH)<<8
	if height != 2 {
		t.Errorf("downscaled height = %d, want 2 (aspect-preserving from 8x4 -> width 4)", height)
	}
}

func TestRaster_ZeroTargetWidthReturnsNil(t *testing.T) {
	img := buildFixtureImage()
	if got := Raster(img, 0, 128); got != nil {
		t.Errorf("Raster with targetWidth=0 = % x, want nil", got)
	}
}

func TestRaster_TransparentPixelsTreatedAsWhite(t *testing.T) {
	// A fully transparent pixel must print as "no dot" (background), not as black — see
	// downscale.go's grayAt comment on why naively ignoring alpha would get this backwards.
	img := image.NewNRGBA(image.Rect(0, 0, 8, 1))
	for x := 0; x < 8; x++ {
		img.Set(x, 0, color.NRGBA{R: 0, G: 0, B: 0, A: 0}) // "black" RGB but fully transparent
	}

	got := Raster(img, 8, 128)
	want := escpos.BuildRasterBlock([]byte{0x00}, 1, 1) // no dots at all
	if !bytes.Equal(got, want) {
		t.Errorf("transparent pixels:\ngot:  % x\nwant: % x", got, want)
	}
}
