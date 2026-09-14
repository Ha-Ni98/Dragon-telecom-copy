// S26.1 — content sniffing, not extension or client-declared mimetype. The old multer filter
// (`file.mimetype.startsWith('image/')`) trusted a header the uploader controls entirely.

export type SniffedImageType = 'jpeg' | 'png' | 'webp' | 'heic';

const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

// ISO-BMFF brands that identify a HEIF/HEIC still image. `mif1`/`msf1` are the generic image
// brands iOS also emits; `avif` is deliberately absent — sharp handles AVIF natively, but no
// requirement asks for it, so it falls through to UNSUPPORTED_IMAGE_TYPE.
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

export function sniffImageType(buffer: Buffer): SniffedImageType | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';

  // WebP: "RIFF" ....  "WEBP"
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }

  // HEIC/HEIF: ISO-BMFF box, "ftyp" at offset 4, brand at offset 8.
  if (buffer.toString('ascii', 4, 8) === 'ftyp' && HEIF_BRANDS.includes(buffer.toString('ascii', 8, 12))) {
    return 'heic';
  }

  return null;
}
