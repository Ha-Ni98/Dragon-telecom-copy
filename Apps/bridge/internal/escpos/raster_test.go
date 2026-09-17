package escpos

import (
	"bytes"
	"testing"
)

func TestBuildRasterBlock_SingleBandExactBytes(t *testing.T) {
	// 1 byte wide, 3 rows: 0xFF, 0x00, 0xAA.
	packed := []byte{0xff, 0x00, 0xaa}

	got := BuildRasterBlock(packed, 1, 3)

	want := []byte{
		esc, 0x40, // ESC @
		esc, 0x61, 0x01, // ESC a 1
		gs, 0x76, 0x30, 0x00, // GS v 0 m=0
		0x01, 0x00, // xL, xH = 1, 0
		0x03, 0x00, // yL, yH = 3, 0
		0xff, 0x00, 0xaa, // data
		0x0a,            // LF
		esc, 0x61, 0x00, // ESC a 0
	}
	if !bytes.Equal(got, want) {
		t.Errorf("BuildRasterBlock:\ngot:  % x\nwant: % x", got, want)
	}
}

func TestBuildRasterBlock_BandsAt128Rows(t *testing.T) {
	widthBytes := 1
	height := 200 // splits into a 128-row band and a 72-row band
	packed := make([]byte, widthBytes*height)
	for i := range packed {
		packed[i] = byte(i) // distinct value per row, so band slicing is checkable
	}

	got := BuildRasterBlock(packed, widthBytes, height)

	// First band header: GS v 0 m=0, xL xH = 1 0, yL yH = 128 0 (128 = 0x80).
	band1Header := []byte{gs, 0x76, 0x30, 0x00, 0x01, 0x00, 0x80, 0x00}
	idx := bytes.Index(got, band1Header)
	if idx < 0 {
		t.Fatalf("first band header not found in output: % x", got)
	}
	band1Data := got[idx+len(band1Header) : idx+len(band1Header)+128]
	if !bytes.Equal(band1Data, packed[:128]) {
		t.Errorf("first band data mismatch:\ngot:  % x\nwant: % x", band1Data, packed[:128])
	}

	// Second band header: yL yH = 72 0.
	band2Header := []byte{gs, 0x76, 0x30, 0x00, 0x01, 0x00, 0x48, 0x00}
	idx2 := bytes.Index(got, band2Header)
	if idx2 < 0 {
		t.Fatalf("second band header not found in output: % x", got)
	}
	band2Data := got[idx2+len(band2Header) : idx2+len(band2Header)+72]
	if !bytes.Equal(band2Data, packed[128:]) {
		t.Errorf("second band data mismatch:\ngot:  % x\nwant: % x", band2Data, packed[128:])
	}

	// Exactly two GS v 0 headers — no third band, no dropped rows.
	if got2 := bytes.Count(got, []byte{gs, 0x76, 0x30, 0x00}); got2 != 2 {
		t.Errorf("found %d GS v 0 commands, want 2", got2)
	}
}

func TestBuildRasterBlock_EmptyBitmapStillWrapped(t *testing.T) {
	got := BuildRasterBlock(nil, 0, 0)
	want := []byte{esc, 0x40, esc, 0x61, 0x01, 0x0a, esc, 0x61, 0x00}
	if !bytes.Equal(got, want) {
		t.Errorf("BuildRasterBlock(nil, 0, 0):\ngot:  % x\nwant: % x", got, want)
	}
}

func TestBuildRasterBlock_WidthBytesWideEnoughForTwoBytePacking(t *testing.T) {
	// 2 bytes wide (a 9-16px row), 1 row.
	packed := []byte{0xaa, 0x55}
	got := BuildRasterBlock(packed, 2, 1)

	want := []byte{
		esc, 0x40,
		esc, 0x61, 0x01,
		gs, 0x76, 0x30, 0x00,
		0x02, 0x00, // xL, xH = 2, 0
		0x01, 0x00, // yL, yH = 1, 0
		0xaa, 0x55,
		0x0a,
		esc, 0x61, 0x00,
	}
	if !bytes.Equal(got, want) {
		t.Errorf("BuildRasterBlock:\ngot:  % x\nwant: % x", got, want)
	}
}
