package logo

import "image"

// grayAt returns img's pixel at (x,y) as 0-65535 grayscale luminance, with alpha composited onto
// a white background — matching how a transparent PNG actually looks printed on white receipt
// paper. Naively ignoring alpha would render transparent areas as black: image/color's RGBA()
// returns alpha-premultiplied values, which are near-zero wherever alpha is near-zero.
func grayAt(img image.Image, x, y int) uint32 {
	r, g, b, a := img.At(x, y).RGBA() // premultiplied, 0-65535 each
	inv := 65535 - a
	r += inv
	g += inv
	b += inv
	// ITU-R BT.601 luminance weights.
	return (299*r + 587*g + 114*b) / 1000
}

// boxDownscale resizes img to targetW x targetH by averaging each output pixel's source block —
// a box filter. In practice this only ever downscales: print-bridge-protocol.md's printLogoUrl is
// already capped at 600px and a receipt prints a few hundred dots wide at most. Upscale still
// works, degrading gracefully to nearest-neighbour when a source block spans under one pixel.
func boxDownscale(img image.Image, targetW, targetH int) [][]uint8 {
	bounds := img.Bounds()
	origW, origH := bounds.Dx(), bounds.Dy()

	out := make([][]uint8, targetH)
	for ty := 0; ty < targetH; ty++ {
		row := make([]uint8, targetW)
		y0 := ty * origH / targetH
		y1 := (ty + 1) * origH / targetH
		if y1 <= y0 {
			y1 = y0 + 1
		}
		for tx := 0; tx < targetW; tx++ {
			x0 := tx * origW / targetW
			x1 := (tx + 1) * origW / targetW
			if x1 <= x0 {
				x1 = x0 + 1
			}

			var sum, count uint64
			for yy := y0; yy < y1 && yy < origH; yy++ {
				for xx := x0; xx < x1 && xx < origW; xx++ {
					sum += uint64(grayAt(img, bounds.Min.X+xx, bounds.Min.Y+yy))
					count++
				}
			}
			if count == 0 {
				count = 1
			}
			row[tx] = uint8((sum / count) >> 8) // 0-65535 -> 0-255
		}
		out[ty] = row
	}
	return out
}

// threshold1Bit packs gray (targetH rows of targetW 0-255 values) into a 1-bit, MSB-first,
// row-padded bitmap — exactly the shape ESC/POS's GS v 0 raster command expects. A pixel darker
// than thresh becomes a printed dot (bit=1). print-bridge-plan-v1.md deliberately uses a straight
// threshold rather than dithering: the source PNG is already stored monochrome (S26.1), and
// dithering an already-1-bit image only adds noise a thermal head renders as speckle.
func threshold1Bit(gray [][]uint8, thresh int) (packed []byte, widthBytes, height int) {
	height = len(gray)
	if height == 0 {
		return nil, 0, 0
	}
	width := len(gray[0])
	widthBytes = (width + 7) / 8
	packed = make([]byte, widthBytes*height)

	for y, row := range gray {
		for x, v := range row {
			if int(v) < thresh {
				byteIdx := y*widthBytes + x/8
				bitIdx := 7 - (x % 8) // MSB-first
				packed[byteIdx] |= 1 << bitIdx
			}
		}
	}
	return packed, widthBytes, height
}
