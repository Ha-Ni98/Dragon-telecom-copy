import { z } from 'zod';

// S26.1 — one pipeline for every image in the app. Each magnitude is named here because three
// places must agree on it: the api's multer limit + sharp options, the contract schemas, and the
// web upload control's own client-side pre-check and helper text.

/** Raw upload ceiling, before any processing. Also multer's `limits.fileSize`. */
export const IMAGE_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Long edge of the stored main image. Never upscales a smaller original. */
export const IMAGE_MAX_LONG_EDGE = 1600;
/** Long edge of the derivative used by grids and list views. */
export const IMAGE_THUMBNAIL_LONG_EDGE = 400;
/** S38 — the desktop hero banner is the one image wider than IMAGE_MAX_LONG_EDGE: a 1920px
 *  screen would otherwise upscale a 1600px banner. Same WebP pipeline, larger cap. */
export const IMAGE_HERO_DESKTOP_MAX_LONG_EDGE = 1920;
/** S38 — upload guidance shown in the admin (not enforced; a mismatched ratio is cropped by
 *  object-cover and the admin sees a soft warning). */
export const HERO_IMAGE_GUIDANCE = {
  desktop: { width: 1920, height: 600 },
  mobile: { width: 1080, height: 1080 },
} as const;
/** S38 — Open Graph's recommended share-image size. */
export const LINK_PREVIEW_IMAGE_GUIDANCE = { width: 1200, height: 630 } as const;
/** S39 — upload guidance for brand logos and family icons (shown in Settings → Hierarchy). They
 *  render on a light tile in both themes, so a transparent PNG/WebP is ideal; the pipeline keeps
 *  alpha (verified S39). */
export const LOGO_IMAGE_GUIDANCE = { minSize: 512, paddingPercent: 10 } as const;
/** WebP quality — visually lossless for product photography at IMAGE_MAX_LONG_EDGE. */
export const IMAGE_WEBP_QUALITY = 85;
/**
 * sharp's decompression-bomb guard. Without it a crafted 50 000 x 50 000 PNG decodes into
 * gigabytes and kills the 1 GB machine. sharp's own default (~268 MP) is far too permissive for
 * this deployment; 50 MP is comfortably above any real phone camera.
 */
export const IMAGE_MAX_INPUT_PIXELS = 50_000_000;
/**
 * The print logo is the one exception to the WebP pipeline: PNG, no lossy encoding, capped at
 * this width. Lossy compression of a black-and-white image produces edge artifacts that a
 * thermal head renders as grey fringing.
 */
export const PRINT_LOGO_MAX_WIDTH = 600;

/** Accepted by *content sniffing*, not by the client-declared mimetype. Also the web file
 *  input's `accept` attribute. */
export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

/** What the uploaded image is for. Drives the R2 folder and the processing profile. */
export enum ImagePurpose {
  PRODUCT = 'PRODUCT',
  BRAND_LOGO = 'BRAND_LOGO',
  FAMILY_ICON = 'FAMILY_ICON',
  STORE_LOGO = 'STORE_LOGO',
  PRINT_LOGO = 'PRINT_LOGO',
  // S38 — hero slider banners (two uploads per slide) and the site's link-preview image.
  HERO_DESKTOP = 'HERO_DESKTOP',
  HERO_MOBILE = 'HERO_MOBILE',
  LINK_PREVIEW = 'LINK_PREVIEW',
}

// Sentinels travel as the error *message*, not error.code — same convention as CATALOG_ERROR /
// EXPORT_ERROR. Every one of these must also appear in web's SENTINEL_TRANSLATION_KEYS.
export const MEDIA_ERROR = {
  /** Magic-byte sniff matched nothing in ACCEPTED_IMAGE_MIME_TYPES. */
  UNSUPPORTED_IMAGE_TYPE: 'UNSUPPORTED_IMAGE_TYPE',
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
  /** Tripped IMAGE_MAX_INPUT_PIXELS — a decompression bomb or a scan far beyond any real photo. */
  IMAGE_TOO_MANY_PIXELS: 'IMAGE_TOO_MANY_PIXELS',
  /** The bytes sniffed as an image type but the decoder rejected them (truncated/corrupt file,
   *  or a HEIC variant libheif cannot read). */
  IMAGE_DECODE_FAILED: 'IMAGE_DECODE_FAILED',
  /** R2 was unreachable or refused the write. No database row is ever written after this. */
  IMAGE_STORAGE_UNAVAILABLE: 'IMAGE_STORAGE_UNAVAILABLE',
} as const;
export type MediaErrorSentinel = (typeof MEDIA_ERROR)[keyof typeof MEDIA_ERROR];

/** Multipart body of the media upload route. The file itself travels outside this schema (same
 *  convention as platform's Excel import and catalog's product images). Multer delivers every
 *  form field as a string, so this schema must stay string-only. */
export const UploadImageSchema = z.object({
  purpose: z.enum(ImagePurpose),
});
export type UploadImageCommand = z.infer<typeof UploadImageSchema>;

export const MediaImageResponseSchema = z.object({
  key: z.string(),
  url: z.string(),
  /** Absent for PRINT_LOGO, which emits no derivative. */
  thumbnailKey: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  contentType: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size: z.number().int().nonnegative(),
});
export type MediaImageDto = z.infer<typeof MediaImageResponseSchema>;
