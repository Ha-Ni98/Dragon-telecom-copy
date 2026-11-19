import crypto from 'crypto';
import sharp from 'sharp';
import {
  IMAGE_HERO_DESKTOP_MAX_LONG_EDGE,
  IMAGE_MAX_INPUT_PIXELS,
  IMAGE_MAX_LONG_EDGE,
  IMAGE_MAX_UPLOAD_BYTES,
  IMAGE_THUMBNAIL_LONG_EDGE,
  IMAGE_WEBP_QUALITY,
  ImagePurpose,
  MEDIA_ERROR,
  MediaImageResponseSchema,
  PRINT_LOGO_MAX_WIDTH,
  type MediaImageDto,
} from '@dragon-telecom/contract';
import { BadRequestError } from '@common/errors';
import { logger } from '@common/config/logger';
import { storageService } from '@common/storage/storage.service';
import type { StorageService, UploadFile } from '@common/storage/storage.types';
import { sniffImageType } from './image-sniff';
import { decodeHeicToJpeg } from './heic-decoder';

// Folder per purpose. Content-addressed keys make the folder cosmetic (two identical bytes in
// two folders are two objects), but it keeps the bucket browsable.
const FOLDER: Record<ImagePurpose, string> = {
  [ImagePurpose.PRODUCT]: 'products',
  [ImagePurpose.BRAND_LOGO]: 'brands',
  [ImagePurpose.FAMILY_ICON]: 'families',
  [ImagePurpose.STORE_LOGO]: 'settings',
  [ImagePurpose.PRINT_LOGO]: 'settings',
  // S38 — hero banners share one folder: the platform service validates a key by its
  // `hero/<sha256>.webp` shape (platform.service.ts HERO_KEY_PATTERN).
  [ImagePurpose.HERO_DESKTOP]: 'hero',
  [ImagePurpose.HERO_MOBILE]: 'hero',
  [ImagePurpose.LINK_PREVIEW]: 'settings',
};

// S38 — only the desktop hero banner exceeds the shared 1600px cap (a 1920px screen would
// otherwise upscale it). Every other purpose uses IMAGE_MAX_LONG_EDGE.
const MAX_LONG_EDGE: Partial<Record<ImagePurpose, number>> = {
  [ImagePurpose.HERO_DESKTOP]: IMAGE_HERO_DESKTOP_MAX_LONG_EDGE,
};

type ProcessedVariant = { data: Buffer; width: number; height: number; size: number };

// S26.1 — the ONE image pipeline. Every image upload in the app (product photos, brand logos,
// family icons, the store logo, the print logo, and — S38 — hero banners and the link-preview
// image) goes through this class; no module re-implements sniffing, resizing or key derivation.
export class ImagePipelineService {
  constructor(private storage: StorageService) {}

  async process(file: UploadFile, purpose: ImagePurpose): Promise<MediaImageDto> {
    if (file.buffer.length > IMAGE_MAX_UPLOAD_BYTES) {
      throw new BadRequestError(MEDIA_ERROR.IMAGE_TOO_LARGE);
    }

    // Content sniffing, not the client-declared mimetype — that header is attacker-controlled.
    const sniffed = sniffImageType(file.buffer);
    if (!sniffed) throw new BadRequestError(MEDIA_ERROR.UNSUPPORTED_IMAGE_TYPE);

    let decodable: Buffer;
    if (sniffed === 'heic') {
      try {
        decodable = await decodeHeicToJpeg(file.buffer);
      } catch (err) {
        logger.warn({ err }, 'HEIC decode failed');
        throw new BadRequestError(MEDIA_ERROR.IMAGE_DECODE_FAILED);
      }
    } else {
      decodable = file.buffer;
    }

    // EXIF auto-orient (phone photos arrive sideways) and drop the orientation tag. Deliberately
    // NOT calling .withMetadata() afterwards — sharp strips EXIF/GPS/ICC by default, which is the
    // whole of the "strip all metadata" requirement; calling it would put the metadata back.
    const base = sharp(decodable, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS, failOn: 'error' }).rotate();

    const isPrintLogo = purpose === ImagePurpose.PRINT_LOGO;

    let main: ProcessedVariant;
    let thumb: ProcessedVariant | undefined;
    const extension = isPrintLogo ? 'png' : 'webp';
    const contentType = isPrintLogo ? 'image/png' : 'image/webp';

    try {
      if (isPrintLogo) {
        // Owner exception — monochrome PNG, no lossy encoding, capped at PRINT_LOGO_MAX_WIDTH.
        // .threshold(128) forces pure black/white: downscaling a 1-bit image interpolates greys
        // back in, and a thermal head renders any grey as fringing.
        const { data, info } = await base
          .clone()
          .resize({ width: PRINT_LOGO_MAX_WIDTH, withoutEnlargement: true })
          .threshold(128)
          .png({ compressionLevel: 9 })
          .toBuffer({ resolveWithObject: true });
        main = { data, width: info.width, height: info.height, size: info.size };
      } else {
        const longEdge = MAX_LONG_EDGE[purpose] ?? IMAGE_MAX_LONG_EDGE;
        const { data, info } = await base
          .clone()
          .resize({ width: longEdge, height: longEdge, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: IMAGE_WEBP_QUALITY })
          .toBuffer({ resolveWithObject: true });
        main = { data, width: info.width, height: info.height, size: info.size };

        const { data: thumbData, info: thumbInfo } = await base
          .clone()
          .resize({ width: IMAGE_THUMBNAIL_LONG_EDGE, height: IMAGE_THUMBNAIL_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: IMAGE_WEBP_QUALITY })
          .toBuffer({ resolveWithObject: true });
        thumb = { data: thumbData, width: thumbInfo.width, height: thumbInfo.height, size: thumbInfo.size };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ err }, 'Image processing failed');
      if (/pixel|limitInputPixels/i.test(message)) {
        throw new BadRequestError(MEDIA_ERROR.IMAGE_TOO_MANY_PIXELS);
      }
      throw new BadRequestError(MEDIA_ERROR.IMAGE_DECODE_FAILED);
    }

    // Content-addressed keys — hash the PROCESSED bytes, never the upload. Deduplication (the
    // same photo uploaded twice is one object) and cache-busting (any edit is a new key) both
    // fall out of this for free.
    const hash = crypto.createHash('sha256').update(main.data).digest('hex');
    const folder = FOLDER[purpose];
    const key = `${folder}/${hash}.${extension}`;
    const thumbnailKey = thumb ? `${folder}/${hash}-thumb.${extension}` : undefined;

    // Stored LAST: if R2 throws here, nothing has written a row yet (callers persist only after
    // this method returns).
    const stored = await this.storage.put({ key, body: main.data, contentType });
    const storedThumb = thumb && thumbnailKey
      ? await this.storage.put({ key: thumbnailKey, body: thumb.data, contentType })
      : undefined;

    const dto: MediaImageDto = {
      key: stored.key,
      url: stored.url,
      ...(storedThumb ? { thumbnailKey: storedThumb.key, thumbnailUrl: storedThumb.url } : {}),
      contentType,
      width: main.width,
      height: main.height,
      size: main.size,
    };
    return MediaImageResponseSchema.parse(dto);
  }
}

export const imagePipeline = new ImagePipelineService(storageService);
