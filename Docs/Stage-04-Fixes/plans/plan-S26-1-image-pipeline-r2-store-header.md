# Plan — Set S26.1: Image pipeline, R2 storage & logo/header settings

Target branch: `version-1-3`. Source set: `Docs/Stage-04-Fixes/sets-26-29.md` §S26.1.

**Sets that must land first:** none. S26.1 is the first set of the 26.1→29 programme and is a
prerequisite for **S27** (thermal receipt + barcode labels), which consumes `store.activityLine`,
`store.repairPhone`, `store.salesPhone` and `store.printLogoUrl` introduced here.

**Do not implement S27 content here.** This set adds the settings *fields* and the *upload*
controls; it does not touch the receipt or the label markup.

---

## 0. Owner decisions taken before planning

| # | Question | Decision |
|---|---|---|
| **Q1** | `sharp`'s prebuilt binaries ship **without** HEIF/HEIC decode (patent licensing) — `sharp(heicBuffer)` throws. The set requires accepting HEIC. | **Lazy `heic-convert` fallback.** Sniff HEIC by magic bytes, `await import('heic-convert')` only when one actually arrives, decode to JPEG, hand that to sharp. Serialised behind a one-at-a-time lock because the wasm decoder's memory spike scales with pixel count and the machine has 1 GB. |
| **Q2** | Fate of the existing single `store.phone` field. | **All three coexist.** `phone` keeps its current role and its current consumers (invoice PDF header, POS receipt, repair claim slip); `repairPhone` and `salesPhone` are new optional fields. S27's receipt prints the two labelled numbers and falls back to `phone` where one is unset. |

---

## 1. Facts established by reading the code — do not re-derive these

These are the concrete shapes the set's "follow the pattern of X" phrases refer to. Read this
section before touching anything.

### 1.1 Storage today

- `Apps/api/src/common/storage/` already exists (commit `50e4cea`, outside the S1–S25 reports):
  `storage.types.ts` (interface `StorageService { upload(file, folder?) / delete(key) / exists(key) }`),
  `r2.service.ts` (`R2StorageService`, `@aws-sdk/client-s3`, already a dependency), and
  `storage.service.ts` (exports the singleton `storageService`).
- `R2StorageService` names an object `` `${folder}/${crypto.randomUUID()}.${ext}` ``, sets no
  `Cache-Control`, does no processing, and reads **`R2_BUCKET_NAME`, `R2_PUBLIC_URL`,
  `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`** straight off `process.env` with
  non-null assertions. Those five names (plus an unused `R2_ACCOUNT_ID`) **already exist in
  `Apps/api/.env`** — reuse them exactly, invent no new names.
- **They are not in `Apps/api/src/env.ts` and not in `Docs/Stage-02-Backend/env-template.md`.**
  Boot validation for them is an action in this plan (§3).
- `storageService` has exactly **three** call sites, all in
  `Apps/api/src/modules/catalog/catalog.service.ts`: `createProduct` (~line 663, **inside the
  `$transaction` callback**), `addImages` (~line 772), `deleteImage` (~line 854).
- `ProductImage` already has a `key` column (migration `20260804171022_add_image_key`).
- `deleteImage` already guards deduplicated objects: it counts `productImage where url =
  image.url` **before** deleting the row and only calls `storageService.delete` when the count is
  1. That guard is what makes content-addressed keys safe for products; keep it.
- `PRODUCT_UPLOAD_DIR = 'uploads'` (`Apps/contract/src/modules/catalog/catalog.routes.ts:44`)
  still drives an `express.static` mount in `Apps/api/src/app.ts:31-34` and is imported by
  `catalog.routes.ts`. It is dead relative to R2 and unusable on Fly (ephemeral filesystem).

### 1.2 Upload wiring today

- `Apps/api/src/modules/catalog/catalog.routes.ts:76-82` — `uploadImages = multer({ storage:
  multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: mimetype.startsWith('image/') })`.
  **The filter trusts the client-declared mimetype** — this is precisely the "validate by content,
  not extension" defect the set names.
- `Apps/api/src/modules/platform/platform.routes.ts:33-42` — the same shape for the Excel fee
  import (`upload.single('file')`), controller reads `req.file.buffer`. That is the pattern a new
  single-file upload route follows.
- `Apps/api/src/@types/express.d.ts` augments `Request` with `user` and `validated` only;
  `req.file` comes from `@types/multer`, already a devDependency.
- `validateRequest` (`common/middlewares/validate-request.middleware.ts`) parses `req.body` with
  the given zod schema. Multer-parsed multipart fields all arrive as **strings**, so a schema used
  on a multipart body may only contain string-ish fields (a `z.enum` over a string enum is fine).
  > **Observation, not an action:** that middleware computes `normalizeEmptyStrings(req.body/query/params)`
  > into local consts and then parses the *un-normalised* originals — the three locals are dead.
  > Pre-existing, unrelated to this set, do not "fix" it here; just do not rely on normalisation.

### 1.3 Settings today

- Storage is `model Setting { key @id, value String /* JSON-encoded */, updatedAt }` —
  **one row per DTO section**. Adding a field to `store` therefore needs **no Prisma migration**.
- `Apps/contract/src/modules/platform/platform.dtos.ts` — `SettingsResponseSchema.store` is
  `{ name, address?, phone?, logoUrl? }`; `PublicSettingsResponseSchema.store` is the **same four
  fields** (S25 made the store header public so the POS receipt could print it — the schema
  carries a comment explaining why; extend that comment, don't replace it).
- `Apps/contract/src/modules/platform/platform.command.ts` — `StoreSettingsInputSchema` mirrors
  those four, all optional; `UpdateSettingsSchema` is section-wise optional so a PATCH may carry
  `{ store: { logoUrl } }` alone.
- `Apps/api/prisma/settings-defaults.ts` — `DEFAULT_SETTINGS.store = { name: 'Dragon Telecom' }`.
  `PlatformMapper.toSettingsDto` falls back **whole-section** for `store` (only `storefront` is
  merged field-wise). New `store` fields are all optional, so the whole-section fallback stays
  valid — no mapper change needed for them.
- `PlatformService.updateSettings` merges with `mergeDefined`, diffs leaves for the
  `settings.changed` audit event, and upserts only touched sections. New optional fields flow
  through it with **no service change**.
- Consumers of `store`: `billing.service.ts:404-406` (invoice PDF header → `pdf.utils.ts:41-42`,
  which prints **name/address/phone as text and embeds no image** — so a WebP store logo cannot
  break the invoice PDF), `PosReceiptView.tsx:107-114` and `RepairReceipt.tsx:50-55` (both read
  `PublicSettingsDto["store"]`).

### 1.4 Brand & family logos today

- `Brand.logoUrl` and `Family.iconUrl` exist in `schema.prisma` (lines 396, 427).
- They are already in the contract: `BrandResponseSchema.logoUrl?`, `FamilyResponseSchema.iconUrl?`,
  and — critically — **already accepted by `UpdateBrandSchema.logoUrl?` and
  `UpdateFamilySchema.iconUrl?`** (`catalog.command.ts:148-170`). No contract or backend change is
  needed to *set* them; only a UI that sends the value.
- They are already rendered: `Apps/web/src/components/sections/landing/brands-section.tsx:49-63`
  (falls back to the brand's first letter) and `.../categories-section.tsx:88-95` (falls back to a
  `Package` icon). Both are confirmed working — this set only has to populate the columns.
- Update hooks already exist: `useUpdateCatalogBrand()` / `useUpdateCatalogFamily()`
  (`Apps/web/src/hooks/useCatalogTaxonomy.ts:45,75`), both `({ id, command })` and both
  invalidating `qk.catalog.brands.all()` / `qk.catalog.families.all()` — the `.all()` prefix
  deliberately covers the public *and* admin list variants (S21).
- `HierarchyPanel` (`Apps/web/src/pages/admin/settings/components/hierarchy-panel.tsx`) renders
  three cards (families / brands / models), each a name + `EnabledBadge` + Disable/Enable button.
  Its S21 precedent for adding props to a component with an existing test: **make the new props
  optional** and say why in the prop's doc comment. Follow that precedent exactly — tests must not
  be edited.

### 1.5 Frontend conventions

- Translations: `Apps/web/src/config/translations.json` — a **flat** map of dotted key →
  `{ en, fr, ar }`. `ar` stays `""` (nothing sets the language to `ar` today; see `lib/i18n.ts`).
  Existing keys `admin.settings.hierarchy.logo` and `admin.settings.hierarchy.icon` are already
  present and unused — reuse them.
- Business-rule errors travel as the **message**, not `error.code`. Sentinels are declared in the
  contract and mapped to translation keys in `Apps/web/src/lib/query-client.ts:10-16`
  (`SENTINEL_TRANSLATION_KEYS`). Any new sentinel must be added there or it surfaces as a raw
  `SCREAMING_SNAKE` token in a toast.
- Multipart from the web: `platform.service.ts:61-70` (`new FormData()`, `append`, `api.post`,
  no manual `Content-Type`). That is the pattern for the new media upload call.
- **The POS product list renders no image** — `StaffProductResponseSchema` carries no `images`
  field at all, and `Apps/web/src/pages/staff/pos/components/` contains no `<img>` except the
  receipt logo. The set's "POS product cards" thumbnail consumer therefore **does not exist**;
  do not invent a `StaffProductDto.images` field. Thumbnails are consumed by the storefront grid,
  the cart row and the admin image manager (§9).
- `Apps/web/src/hooks/use-image-upload.ts` is a **Sub-01 mock** (it fabricates
  `URL.createObjectURL` "uploads" and carries a `// TODO: In a real application...` block). It has
  **zero consumers**. Delete it (§10).

---

## 2. Dependencies

### Action 2.1 — `Apps/api/package.json`

Add to `dependencies`:

```json
"sharp": "^0.34.0",
"heic-convert": "^2.1.0"
```

Add to `devDependencies`:

```json
"@types/heic-convert": "^1.2.3"
```

Then run `npm install` inside `Apps/api`.

Notes the executor must respect:
- **`sharp` strips all metadata by default.** Achieving requirement "strip all metadata (GPS,
  weight)" means **not** calling `.withMetadata()`. Do not add it.
- `sharp` is a native module with prebuilt binaries for linux-x64; no build toolchain needed.
- `heic-convert` is only ever loaded through a dynamic `await import()` (§4.3), so its wasm
  payload is not resident for the 99 % of uploads that are JPEG/PNG/WebP.

---

## 3. Environment & boot validation

### Action 3.1 — `Apps/api/src/env.ts`

Add to `envSchema`, after `LOG_LEVEL`:

```ts
  // S26.1 — Cloudflare R2. Validated at boot because an image upload that reaches a
  // misconfigured client fails per-request with an opaque S3 error instead of failing the
  // deploy. Names match the keys already present in Apps/api/.env — do not rename.
  R2_ENDPOINT: z.url(),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  // Public base URL of the bucket's custom domain. Image traffic is served from here directly,
  // never proxied through the Fly machine (set S26.1 — keeps egress off the app's bandwidth and
  // its 1 GB of memory). No trailing slash.
  R2_PUBLIC_URL: z.url(),
```

`R2_ACCOUNT_ID` is present in `.env` but read by nothing — **do not add it to the schema** (the
schema is the superset of what the code reads, per `env-template.md`'s own rule).

> **Test-run caveat:** the api's integration config runs with `NODE_ENV=test`. If the test
> environment has no R2 credentials, `env.ts` will now `process.exit(1)` at import. You are
> forbidden from running the suites, so simply ensure the five keys are present in
> `Apps/api/.env` (they are) and note this in the report so the owner is not surprised.

### Action 3.2 — `Apps/api/.env.example`

Append a block mirroring §3.1 with placeholder values:

```bash
# Cloudflare R2 (image storage) — S26.1
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_BUCKET_NAME="dragon-telecom"
R2_ACCESS_KEY_ID="replace-me"
R2_SECRET_ACCESS_KEY="replace-me"
R2_PUBLIC_URL="https://media.example.com"
```

### Action 3.3 — `Docs/Stage-02-Backend/env-template.md`

Under **"Project-specific add-ons"**, replace the vague `SMTP_* / AWS_*` line's file-upload half
with a real `R2_*` subsection listing the five variables above and stating that image objects are
served from `R2_PUBLIC_URL` directly, never through the API. Add the same five lines to the
`.env.example` code block at the bottom of that doc.

---

## 4. Backend — the shared image pipeline

> This is the single pipeline the set demands. Every image upload in the app goes through
> `imagePipeline.process(...)`. No module re-implements sniffing, resizing or key derivation.

### Action 4.1 — `Apps/contract/src/common/media.ts` **(new file)**

All shared magnitudes, the purpose enum, the request/response schemas and the error sentinels.
No magic strings or numbers on either side.

```ts
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
```

### Action 4.2 — `Apps/contract/src/index.ts`

Add `export * from './common/media';` immediately after the `./common/exports` line.

### Action 4.3 — `Apps/api/src/common/media/image-sniff.ts` **(new file)**

A dependency-free magic-byte sniffer. Returns the real type or `null`.

```ts
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
```

### Action 4.4 — `Apps/api/src/common/media/heic-decoder.ts` **(new file)**

Owner decision Q1. Lazy import, serialised.

```ts
import { logger } from '@common/config/logger';

// S26.1 / owner decision Q1 — sharp's prebuilt libvips ships WITHOUT HEIF decode (patent
// licensing), so sharp(heicBuffer) throws. iPhones upload HEIC by default, so rejecting it
// outright would make the phone-photo path unusable; instead HEIC is transcoded to JPEG here
// and the rest of the pipeline is unchanged.
//
// Two guards, both because of the 1 GB Fly machine:
//  1. `await import()` — the wasm libheif build is only resident once a HEIC actually arrives.
//  2. `queue` — libheif's peak RSS scales with pixel count (a 12 MP still decodes to ~48 MB of
//     RGBA before re-encoding). Two concurrent decodes are what would actually OOM the machine,
//     so decodes are serialised into a single chain. Uploads are an admin action measured in
//     handfuls per day; the queueing cost is irrelevant.
let queue: Promise<unknown> = Promise.resolve();

export async function decodeHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  const run = queue.then(async () => {
    const { default: heicConvert } = await import('heic-convert');
    logger.debug('Decoding HEIC upload via heic-convert');
    const output = await heicConvert({ buffer, format: 'JPEG', quality: 1 });
    return Buffer.from(output);
  });
  // Keep the chain alive even when this decode rejects, so one bad file does not wedge the queue.
  queue = run.catch(() => undefined);
  return run;
}
```

> If `heic-convert`'s types complain about `buffer` (its `.d.ts` declares `ArrayBufferLike`),
> pass `new Uint8Array(buffer)` and keep the `Buffer.from(output)` wrap. Do not `as never` it.

### Action 4.5 — `Apps/api/src/common/media/image-pipeline.service.ts` **(new file)**

The one pipeline.

```ts
import crypto from 'crypto';
import sharp from 'sharp';
import {
  IMAGE_MAX_INPUT_PIXELS,
  IMAGE_MAX_LONG_EDGE,
  IMAGE_MAX_UPLOAD_BYTES,
  IMAGE_THUMBNAIL_LONG_EDGE,
  IMAGE_WEBP_QUALITY,
  ImagePurpose,
  MEDIA_ERROR,
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
};

export class ImagePipelineService {
  constructor(private storage: StorageService) {}

  async process(file: UploadFile, purpose: ImagePurpose): Promise<MediaImageDto> { /* see below */ }
}

export const imagePipeline = new ImagePipelineService(storageService);
```

`process` executes, in order:

1. **Size.** `if (file.buffer.length > IMAGE_MAX_UPLOAD_BYTES) throw new BadRequestError(MEDIA_ERROR.IMAGE_TOO_LARGE)`.
   (Multer's own `limits.fileSize` also enforces this; this is the belt to that's braces, and it
   is what makes the service safe to call from anywhere.)
2. **Sniff.** `const sniffed = sniffImageType(file.buffer);`
   `if (!sniffed) throw new BadRequestError(MEDIA_ERROR.UNSUPPORTED_IMAGE_TYPE)`.
   The client-declared `file.mimetype` is **never** consulted for validation.
3. **HEIC transcode.** `const decodable = sniffed === 'heic' ? await decodeHeicToJpeg(file.buffer) : file.buffer;`
   Wrap in try/catch → `BadRequestError(MEDIA_ERROR.IMAGE_DECODE_FAILED)`.
4. **Base sharp instance**, shared by both derivatives via `.clone()`:
   ```ts
   const base = sharp(decodable, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS, failOn: 'error' })
     .rotate(); // EXIF auto-orient — phone photos arrive sideways. Also drops the orientation tag.
   ```
   **Do not call `.withMetadata()`** — sharp strips EXIF/GPS/ICC by default, and calling it would
   put the metadata back. That is the whole of requirement "strip all metadata".
5. **Profile.**
   - `purpose === ImagePurpose.PRINT_LOGO`:
     ```ts
     const main = await base
       .clone()
       .resize({ width: PRINT_LOGO_MAX_WIDTH, withoutEnlargement: true })
       .threshold(128)                       // downscaling a 1-bit image interpolates greys back
                                             // in; the threshold forces pure black/white so the
                                             // thermal head has nothing to dither.
       .png({ compressionLevel: 9 })
       .toBuffer({ resolveWithObject: true });
     ```
     Extension `png`, contentType `image/png`, **no thumbnail**.
   - every other purpose:
     ```ts
     const main = await base
       .clone()
       .resize({ width: IMAGE_MAX_LONG_EDGE, height: IMAGE_MAX_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
       .webp({ quality: IMAGE_WEBP_QUALITY })
       .toBuffer({ resolveWithObject: true });
     const thumb = await base
       .clone()
       .resize({ width: IMAGE_THUMBNAIL_LONG_EDGE, height: IMAGE_THUMBNAIL_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
       .webp({ quality: IMAGE_WEBP_QUALITY })
       .toBuffer();
     ```
     Extension `webp`, contentType `image/webp`.
   Wrap the sharp calls in try/catch: if the thrown message matches `/pixel|limitInputPixels/i`
   throw `BadRequestError(MEDIA_ERROR.IMAGE_TOO_MANY_PIXELS)`, otherwise
   `BadRequestError(MEDIA_ERROR.IMAGE_DECODE_FAILED)`. Log the original at `warn` with
   `logger.warn({ err }, ...)` so a real decoder bug is diagnosable.
6. **Content-addressed keys.**
   ```ts
   const hash = crypto.createHash('sha256').update(main.data).digest('hex');
   const key = `${FOLDER[purpose]}/${hash}.${extension}`;
   const thumbnailKey = thumb ? `${FOLDER[purpose]}/${hash}-thumb.${extension}` : undefined;
   ```
   Hash the **processed** bytes, never the upload. Deduplication (the same photo uploaded twice is
   one object) and cache-busting (any edit is a new key) both fall out of this.
7. **Store.** `await this.storage.put({ key, body: main.data, contentType })` then the thumbnail.
   Both with `Cache-Control: public, max-age=31536000, immutable` (§5). The upload is the **last**
   step: if R2 throws, the method throws and no caller has written a row yet (§6, §7).
8. **Return** `MediaImageResponseSchema.parse({ key, url, thumbnailKey?, thumbnailUrl?, contentType,
   width: main.info.width, height: main.info.height, size: main.info.size })`. Use conditional
   spreads for the two optional fields — the api's tsconfig sets `exactOptionalPropertyTypes`, so
   `thumbnailKey: undefined` does not type-check against `thumbnailKey?: string`.

---

## 5. Backend — R2 storage service

### Action 5.1 — `Apps/api/src/common/storage/storage.types.ts` (rewrite)

The interface becomes key-addressed; the old `upload(file, folder)` (which minted a random UUID
name and set no cache header) is removed. `UploadFile` stays — the pipeline takes it as input.

```ts
export interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface PutObjectInput {
  /** Full object key, including folder. Content-addressed by ImagePipelineService. */
  key: string;
  body: Buffer;
  contentType: string;
  /** Defaults to IMMUTABLE_CACHE_CONTROL. */
  cacheControl?: string;
}

export interface StoredObject {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

// Safe because every key this app writes is content-addressed — the bytes behind a key can
// never change, so a year-long immutable cache can never go stale (set S26.1, Storage).
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface StorageService {
  put(input: PutObjectInput): Promise<StoredObject>;
  /** Tolerates an already-absent key. */
  delete(key: string): Promise<void>;
  /** Deletes every derivative of one image in one call (full size + thumbnail). */
  deleteMany(keys: string[]): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

### Action 5.2 — `Apps/api/src/common/storage/r2.service.ts` (rewrite)

- Import `env` from `../../env` and read `env.R2_*` instead of `process.env.R2_*!`. The non-null
  assertions go away because §3.1 validates at boot.
- `put()` sends `PutObjectCommand` with `CacheControl: input.cacheControl ?? IMMUTABLE_CACHE_CONTROL`,
  returns `{ key, url: \`${env.R2_PUBLIC_URL}/${key}\`, contentType, size: body.length }`.
- Wrap the `send()` in try/catch and rethrow as a new `StorageUnavailableError` (§5.3), logging the
  underlying AWS error. This is the "state what happens when R2 is unreachable" requirement: the
  upload fails cleanly with a surfaced, translated error and **no caller proceeds to a DB write**.
- `delete()` keeps swallowing a missing key. `deleteMany(keys)` uses `DeleteObjectsCommand`
  (import it) with `Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true }`, and swallows
  failures for the same reason `delete()` does — an orphaned object is strictly better than a row
  that outlives the delete the admin asked for.
- Reformat the file to the repo's normal density while you are in it (the current file has a blank
  line between every statement, unlike every other file in `common/`).

### Action 5.3 — `Apps/api/src/common/errors/index.ts`

Add, after `BadRequestError`:

```ts
/** S26.1 — R2 refused or could not be reached. 502, because the failure is an upstream
 *  dependency's, not the caller's. The message is the MEDIA_ERROR sentinel so the web toast can
 *  translate it like every other business-rule error. */
export class StorageUnavailableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(502, ErrorCode.INTERNAL_SERVER_ERROR, message, details);
  }
}
```

Construct it as `new StorageUnavailableError(MEDIA_ERROR.IMAGE_STORAGE_UNAVAILABLE)`.

---

## 6. Backend — the media upload route

Lives in **platform**, the module that already owns cross-cutting infrastructure (settings,
sequences, delivery fees) and already has the single-file multipart precedent. It writes **no
database rows** — it returns URLs — so it crosses no module-ownership boundary (layering rule 5).

### Action 6.1 — `Apps/contract/src/modules/platform/platform.routes.ts`

```ts
  // S26.1 — the one image-upload endpoint. Writes no row: it processes the bytes, stores the
  // derivatives in R2 and returns their URLs. The caller then PATCHes whichever entity should
  // point at them (brand.logoUrl, family.iconUrl, settings.store.logoUrl/printLogoUrl), which is
  // what keeps the "no DB row pointing at a missing object" guarantee — the row is only written
  // after the object exists. Product images keep their own multipart routes (they create the
  // ProductImage rows themselves) but go through the same pipeline service.
  ADMIN_MEDIA_IMAGE: '/admin/media/images',
```

### Action 6.2 — `Apps/api/src/modules/platform/platform.interface.ts`

Add to `IPlatformService`:

```ts
  uploadImage(file: UploadFile, cmd: UploadImageCommand): Promise<MediaImageDto>;
```

### Action 6.3 — `Apps/api/src/modules/platform/platform.service.ts`

Add to `PlatformService`:

```ts
  // S26.1 — a thin delegation to the shared pipeline. No settings row is touched here: the
  // caller decides what the returned URL becomes (a brand logo, a family icon, the store logo,
  // the print logo) with its own PATCH.
  async uploadImage(file: UploadFile, cmd: UploadImageCommand): Promise<MediaImageDto> {
    return imagePipeline.process(file, cmd.purpose);
  }
```

### Action 6.4 — `Apps/api/src/modules/platform/platform.controller.ts`

Mirror `importFees` exactly:

```ts
  uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) throw new BadRequestError('No file uploaded (field name must be "image")');
      const result = await this.service.uploadImage(
        { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype },
        req.validated.body as UploadImageCommand,
      );
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };
```

### Action 6.5 — `Apps/api/src/modules/platform/platform.routes.ts`

Add a second multer instance beside the existing fee-import one (keep them separate — different
limits, different filters):

```ts
// S26.1 — image uploads. memoryStorage because the Fly filesystem is ephemeral and every byte
// goes straight to sharp; the 10 MB ceiling is the contract's IMAGE_MAX_UPLOAD_BYTES so multer,
// the pipeline and the web control all enforce the same number. NO fileFilter on mimetype:
// the type is decided by magic-byte sniffing inside the pipeline, because the declared mimetype
// is attacker-controlled.
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_UPLOAD_BYTES, files: 1 },
});
```

and the route, with the other admin routes:

```ts
router.post(
  PLATFORM_ROUTES.ADMIN_MEDIA_IMAGE,
  adminOnly,
  uploadImage.single('image'),
  validateRequest({ body: UploadImageSchema }),
  controller.uploadImage,
);
```

Order matters: `multer` must run **before** `validateRequest`, otherwise `req.body` is empty.

---

## 7. Backend — product images onto the pipeline

### Action 7.1 — `Apps/api/prisma/schema.prisma`

```prisma
model ProductImage {
  id           String  @id @default(uuid())
  productId    String
  url          String
  key          String
  // S26.1 — the 400px derivative emitted by the shared image pipeline, used by list/grid views
  // so a product grid does not pull five 1600px originals. Optional: rows written before S26.1
  // have no derivative and fall back to `url` on both sides. No backfill (test data only).
  thumbnailUrl String?
  thumbnailKey String?
  alt          String?
  position     Int     @default(0)
  isPrimary    Boolean @default(false)

  product Product @relation(fields: [productId], references: [id])
}
```

Migration: `cd Apps/api && npx prisma migrate dev --name s26_1_image_thumbnails`, then
`npm run prisma:generate`. Two nullable columns — additive, no data touched, **no backfill**.

### Action 7.2 — `Apps/contract/src/modules/catalog/catalog.dtos.ts`

```ts
export const ProductImageResponseSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  // S26.1 — 400px derivative for grids and list views. Absent on rows created before S26.1;
  // every consumer reads `thumbnailUrl ?? url`.
  thumbnailUrl: z.string().optional(),
  alt: z.string().optional(),
  position: z.number().int().min(0),
  isPrimary: z.boolean(),
});
```

`thumbnailKey` is deliberately **not** in the DTO — it is a storage detail the client never needs.
This one edit ripples automatically to `ProductWithPricingDto`, `ProductDetailDto` and
`AdminProductDto`, which all embed this schema.

### Action 7.3 — `Apps/api/src/modules/catalog/catalog.mapper.ts`

In `toProductImageDto`, add `...(image.thumbnailUrl != null ? { thumbnailUrl: image.thumbnailUrl } : {})`
after `url` (conditional spread — `exactOptionalPropertyTypes`).

### Action 7.4 — `Apps/api/src/modules/catalog/catalog.service.ts` — `createProduct`

**Move the uploads out of the transaction.** Today `storageService.upload` is called from inside
the `$transaction` callback, which holds a database transaction open across N network round-trips
to R2 — and if R2 is slow the transaction can time out mid-write.

- Before `await this.prisma.$transaction(...)`, process every file:
  ```ts
  // S26.1 — processed and stored BEFORE the transaction opens, for two reasons: a network
  // round-trip must never be held inside a database transaction, and the set's guarantee is
  // that no row may point at an object that does not exist. If R2 is unreachable this throws
  // here and nothing at all is written. The inverse (object stored, row write then fails) is
  // the tolerated direction: an orphaned object costs nothing, a broken <img> is user-visible.
  const processedImages = images.length > 0
    ? await Promise.all(images.map((file) => imagePipeline.process(file, ImagePurpose.PRODUCT)))
    : [];
  ```
- Inside the transaction, the `productImage.createMany` maps from `processedImages`, adding
  `thumbnailUrl` / `thumbnailKey` via conditional spreads.
- Delete the now-unused `storageService` import if nothing else in the file uses it (it still
  does — see 7.6 — so keep it, but add the `imagePipeline` import).

### Action 7.5 — `Apps/api/src/modules/catalog/catalog.service.ts` — `addImages`

Replace the `storageService.upload(...)` map with `imagePipeline.process(file, ImagePurpose.PRODUCT)`
and carry `thumbnailUrl` / `thumbnailKey` into the `createMany` data. The existing
`files.length !== cmd.images.length` guard and the 3-image cap enforced by the UI stay as they are.

### Action 7.6 — `Apps/api/src/modules/catalog/catalog.service.ts` — `deleteImage`

Two changes:

1. **Delete every derivative.** Inside the existing `if (imageCount == 1)` block, replace
   `storageService.delete(image.key)` with:
   ```ts
   await storageService.deleteMany(
     [image.key, ...(image.thumbnailKey != null ? [image.thumbnailKey] : [])],
   );
   ```
   This is the set's "deletion removes every derivative" plus its "check the existing removal
   feature for orphans": the reference-count guard (`imageCount == 1`) is what makes it safe under
   content-addressed dedup, since two products sharing a photo now share one object.
2. **Rewrite the stale comment.** The current block comment describes disk storage, `unlink`, and
   a `basename()` path-traversal guard — none of which is true any more (it was already stale
   before this set; the R2 commit changed the body and left the comment). Replace it with:
   ```ts
   // Deletes the row *and* every stored derivative (full size + thumbnail) in R2. The DB row is
   // the source of truth: a failed object delete is swallowed and the row still goes, because an
   // orphaned row keeps rendering a broken <img> while an orphaned object costs nothing.
   // The `imageCount` guard matters more since S26.1 made keys content-addressed: two products
   // uploaded from the same photo file share one object, so the object may only be deleted when
   // this is the last row referencing that URL.
   ```

### Action 7.7 — `Apps/api/src/modules/catalog/catalog.routes.ts`

- Replace the local `uploadImages` multer config: drop the mimetype `fileFilter` entirely (the
  pipeline sniffs), and raise `limits.fileSize` to `IMAGE_MAX_UPLOAD_BYTES` with `files: 3`.
- Rewrite the block comment above it (lines 71-75). It currently claims disk storage, a servable
  path, and "no upload env knob exists yet … pending an owner decision on the real storage
  backend". All three are now false. Replace with a short note that files go to R2 through
  `imagePipeline`, that memory storage is required because the Fly filesystem is ephemeral, and
  that the limit comes from the contract constant.
- Remove `PRODUCT_UPLOAD_DIR` from the contract import list.

### Action 7.8 — Retire the local-disk mount

- `Apps/api/src/app.ts` — delete the `app.use(\`${env.API_PREFIX}/uploads\`, express.static(...))`
  block and the now-unused `path` / `PRODUCT_UPLOAD_DIR` imports. Rationale to put in the commit
  message and report: the Fly filesystem is ephemeral, so anything served from it disappears on
  every deploy; all images live in R2 and are served from `R2_PUBLIC_URL` without touching the
  machine.
- `Apps/contract/src/modules/catalog/catalog.routes.ts` — delete `PRODUCT_UPLOAD_DIR` and its
  comment, and delete the unused `IMAGE: '/uploads/:id'` route constant in the same object (grep
  first: it has no consumer).
- Legacy `/uploads/...` rows in the local test database will render broken after this. That is
  expected and accepted — **no backfill**, per the standing rule. Say so in the report.

---

## 8. Backend — settings ripple

No Prisma migration: `Setting.value` is JSON.

### Action 8.1 — `Apps/contract/src/modules/platform/platform.dtos.ts`

Extend **both** store objects identically:

```ts
  store: z.object({
    name: z.string(),
    // S26.1 — the store's description line, printed under the name on the thermal receipt
    // (e.g. "VENTE PIECES DE RECHANGE ET ACCESOIRRES MOBILES").
    activityLine: z.string().optional(),
    address: z.string().optional(),
    // S26.1 / owner decision Q2 — `phone` keeps its existing role and its existing consumers
    // (invoice PDF header, POS receipt, repair claim slip). `repairPhone` and `salesPhone` are
    // the two separately labelled numbers S27's receipt prints; each falls back to `phone`
    // when unset, so no printed document loses a number.
    phone: z.string().optional(),
    repairPhone: z.string().optional(),
    salesPhone: z.string().optional(),
    // Full-colour logo — screen and PDF.
    logoUrl: z.string().optional(),
    // S26.1 — a dedicated monochrome PNG for the thermal printer, uploaded already
    // black-and-white and stored without lossy encoding (a WebP/JPEG of a 1-bit image produces
    // edge artifacts the thermal head renders as grey fringing). Never used on screen.
    printLogoUrl: z.string().optional(),
  }),
```

Extend — do not replace — the existing comment above `PublicSettingsResponseSchema` to record that
the new header fields are public for the same reason the original four are: they are printed on
documents already handed to customers, and the route is what the STAFF-scoped POS receipt reads.

### Action 8.2 — `Apps/contract/src/modules/platform/platform.command.ts`

Add the same five new fields to `StoreSettingsInputSchema`, each `.optional()`. No other change —
`UpdateSettingsSchema` already carries `store` as an optional section.

### Action 8.3 — `Apps/api/prisma/settings-defaults.ts`

Leave `DEFAULT_SETTINGS.store` as `{ name: 'Dragon Telecom' }`. Every new field is optional and
`PlatformMapper.toSettingsDto` falls back whole-section for `store`, so nothing breaks. Add a
one-line comment saying so, to stop a future reader "fixing" it into a field-wise merge.

`PlatformService.updateSettings`, `mergeDefined`, `diffLeaves` and `PlatformMapper` need **no
changes** — they are generic over the section shape. Verify by reading, do not edit.

---

## 9. Frontend

### Action 9.1 — `Apps/web/src/services/media.service.ts` **(new file)**

```ts
// S26.1 — the single image-upload call. Multipart, same shape as platform.service.ts's
// importFees: a bare FormData with no manual Content-Type (the browser must set the boundary).
import { api } from "@/lib/axios";
import { apiPath } from "@/lib/api-path";
import {
  PLATFORM_ROUTES,
  type ApiResponse,
  type ImagePurpose,
  type MediaImageDto,
} from "@dragon-telecom/contract";

export async function uploadImage(file: File, purpose: ImagePurpose): Promise<MediaImageDto> {
  const formData = new FormData();
  formData.append("purpose", purpose);
  formData.append("image", file);
  const res = await api.post<ApiResponse<MediaImageDto>>(
    apiPath(PLATFORM_ROUTES.ADMIN_MEDIA_IMAGE),
    formData,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
```

`purpose` must be appended **before** the file so the field is parsed by the time multer finishes.

### Action 9.2 — `Apps/web/src/hooks/useMedia.ts` **(new file)**

```ts
// S26.1 — mutation only, no query key: an upload produces a URL the caller then persists via
// its own entity mutation (brand PATCH, family PATCH, settings PATCH), and each of those already
// invalidates the cache the new URL shows up in. Nothing here is cacheable domain data.
export function useUploadImage() {
  return useMutation({
    mutationFn: ({ file, purpose }: { file: File; purpose: ImagePurpose }) =>
      mediaService.uploadImage(file, purpose),
  });
}
```

### Action 9.3 — `Apps/web/src/lib/query-client.ts`

Import `MEDIA_ERROR` and add five entries to `SENTINEL_TRANSLATION_KEYS`:

```ts
  [MEDIA_ERROR.UNSUPPORTED_IMAGE_TYPE]: "common.errors.sentinel.unsupportedImageType",
  [MEDIA_ERROR.IMAGE_TOO_LARGE]: "common.errors.sentinel.imageTooLarge",
  [MEDIA_ERROR.IMAGE_TOO_MANY_PIXELS]: "common.errors.sentinel.imageTooManyPixels",
  [MEDIA_ERROR.IMAGE_DECODE_FAILED]: "common.errors.sentinel.imageDecodeFailed",
  [MEDIA_ERROR.IMAGE_STORAGE_UNAVAILABLE]: "common.errors.sentinel.imageStorageUnavailable",
```

Without this the toasts read `UNSUPPORTED_IMAGE_TYPE`.

### Action 9.4 — `Apps/web/src/components/shared/image-upload-field.tsx` **(new file)**

One reusable control, used five times (store logo, print logo, brand logo, family icon, and
available for any future purpose). Props:

```ts
interface ImageUploadFieldProps {
  /** Currently stored URL, or undefined when nothing is set yet. */
  value?: string;
  purpose: ImagePurpose;
  /** Fired with the processed main-image URL after a successful upload. The caller persists it. */
  onUploaded: (url: string) => void;
  label: string;
  /** Helper text beneath the control — the caller supplies an already-translated string. */
  hint?: string;
  disabled?: boolean;
  /** Tailwind size classes for the preview box; defaults to a 20x20 square. */
  previewClassName?: string;
}
```

Behaviour:
- Renders the label, a preview box (`<img src={value}>` when set, an `ImageIcon` placeholder
  otherwise), and a button reading `t("common.media.upload")` when `value` is empty or
  `t("common.media.replace")` when it is set.
- The button clicks a hidden `<input type="file">` with
  `accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}` (from the contract — no hardcoded MIME list).
- Client-side pre-check before firing the mutation: reject `file.size > IMAGE_MAX_UPLOAD_BYTES`
  with `toast.error(t("common.media.tooLarge", { max: IMAGE_MAX_UPLOAD_BYTES / (1024 * 1024) }))`.
  This is UX only; the server re-checks.
- While `useUploadImage().isPending`: disable the button, swap its label for
  `t("common.media.uploading")` and show a `Loader2` spinner.
- `onSuccess: (result) => { onUploaded(result.url); toast.success(t("common.media.uploadSuccess")); }`.
  `onError` needs no handler — `queryClient`'s `MutationCache` already toasts the translated
  sentinel (§9.3).
- Clear the input's `value` after each selection so re-picking the same file fires `change` again.
- **No remove/clear action.** Nothing in this set asks to unset a logo, and the contract's
  `.optional()` fields cannot express "clear" through a PATCH that ignores `undefined`. Say so in
  a comment so the omission reads as deliberate.

### Action 9.5 — `Apps/web/src/pages/admin/settings/components/store-settings.schema.ts`

New shape, and **`logoUrl` is removed**:

```ts
export function storeSettingsSchema(_t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().optional(),
    activityLine: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    repairPhone: z.string().optional(),
    salesPhone: z.string().optional(),
  });
}
```

Add a comment explaining the removal:

> S26.1 — `logoUrl`/`printLogoUrl` are deliberately **not** in this form. The two logo controls
> commit their own PATCH the moment an upload succeeds (like `ProductImagesSection` does), so if
> the text form also carried a logo field, pressing Save with a form seeded before the upload
> would silently revert the logo it just set.

The existing `AssertAssignable` compile-time guard still holds — every field is optional on the
command's `store` section — so leave it in place.

### Action 9.6 — `Apps/web/src/pages/admin/settings/components/store-settings-form.tsx`

Add three `FormField` blocks in this order: `name`, `activityLine`, `address`, `phone`,
`repairPhone`, `salesPhone`. Each mirrors the existing `name` block exactly (FormItem → FormLabel
→ FormControl/Input → FormMessage). Update the `values ?? {...}` fallback to list all six keys
with `""`. Labels:

| field | key |
|---|---|
| `activityLine` | `admin.settings.general.activityLine` |
| `phone` | `admin.settings.general.storePhone` *(existing)* |
| `repairPhone` | `admin.settings.general.repairPhone` |
| `salesPhone` | `admin.settings.general.salesPhone` |

Give `activityLine` a `FormDescription` with `admin.settings.general.activityLineHelp`, and
`phone` one with `admin.settings.general.storePhoneHelp` explaining it is the general number used
on invoices while the two below are printed on the thermal receipt. Update the component's header
comment — it currently says "Sprint 8 wires …", which is long done; note instead that the logos
are handled beside this form, not inside it.

### Action 9.7 — `Apps/web/src/pages/admin/settings/AdminSettings.tsx` — Store tab

Above the existing `<StoreSettingsForm>` in `TabsContent value="store"`, add a `Card` titled
`admin.settings.store.logos.title` with description `…logos.description`, containing two
`ImageUploadField`s side by side:

```tsx
<ImageUploadField
  value={settingsQuery.data?.store.logoUrl}
  purpose={ImagePurpose.STORE_LOGO}
  label={t("admin.settings.store.logos.storeLogo")}
  hint={t("admin.settings.store.logos.storeLogoHelp")}
  onUploaded={(url) => handleSaveStoreLogo({ logoUrl: url })}
  disabled={updateSettings.isPending}
/>
<ImageUploadField
  value={settingsQuery.data?.store.printLogoUrl}
  purpose={ImagePurpose.PRINT_LOGO}
  label={t("admin.settings.store.logos.printLogo")}
  hint={t("admin.settings.store.logos.printLogoHelp")}
  onUploaded={(url) => handleSaveStoreLogo({ printLogoUrl: url })}
  disabled={updateSettings.isPending}
  previewClassName="h-20 w-40 bg-white"
/>
```

with

```tsx
// S26.1 — a logo commits immediately on upload rather than waiting for the text form's Save,
// mirroring ProductImagesSection (an upload is its own mutation there too). This is also why
// storeSettingsSchema no longer carries logoUrl: two writers for one field would race.
const handleSaveStoreLogo = (patch: { logoUrl?: string; printLogoUrl?: string }) => {
  updateSettings.mutate(
    { store: patch },
    { onSuccess: () => toast.success(t("admin.settings.saveSuccess")) },
  );
};
```

The print-logo preview gets a white background because a black monochrome PNG is invisible on the
dark theme's card.

### Action 9.8 — `Apps/web/src/pages/admin/settings/components/hierarchy-panel.tsx`

Add three optional props — follow the S21 precedent verbatim, including a doc comment saying the
optionality exists so the pre-existing test that renders this component with the older prop set
still type-checks:

```ts
  /** S26.1 — Brand.logoUrl / Family.iconUrl have existed in the schema and been rendered by the
   *  home page since the start; there was simply no way to set them. Optional for the same
   *  reason onEnable* above is: an existing test renders this component without them. */
  onSetFamilyIcon?: (id: string, iconUrl: string) => void;
  onSetBrandLogo?: (id: string, logoUrl: string) => void;
```

In the **families** row and the **brands** row, insert before the name:

- a 8×8 rounded preview — `<img src={family.iconUrl}>` when set, otherwise a muted `ImageIcon`;
- and, at the end of the action group, an `ImageUploadField` rendered in a compact variant
  (icon-only button). Simplest correct approach: render `ImageUploadField` with
  `previewClassName="hidden"` is **not** acceptable — instead give `ImageUploadField` an optional
  `compact?: boolean` prop that renders only the button (no label, no preview, no hint) with an
  `Upload` icon and `aria-label={label}`. Use `compact` here and the full variant in §9.7.

Wire in `AdminSettings.tsx`:

```tsx
const handleSetFamilyIcon = (id: string, iconUrl: string) =>
  updateFamily.mutate(
    { id, command: { iconUrl } },
    { onSuccess: () => toast.success(t("admin.settings.hierarchy.logoUpdateSuccess")) },
  );
const handleSetBrandLogo = (id: string, logoUrl: string) =>
  updateBrand.mutate(
    { id, command: { logoUrl } },
    { onSuccess: () => toast.success(t("admin.settings.hierarchy.logoUpdateSuccess")) },
  );
```

and pass them to `<HierarchyPanel>` alongside the existing handlers. Purposes:
`ImagePurpose.FAMILY_ICON` for families, `ImagePurpose.BRAND_LOGO` for brands. The existing
hooks' `qk.catalog.families.all()` / `qk.catalog.brands.all()` invalidation already refreshes both
the admin list and the public storefront list — no new query key, no extra invalidation.

Models get **no** upload control: `DeviceModel` has no image column and none is being added.

### Action 9.9 — Thumbnail consumers

Change each of these to prefer the derivative, falling back to the full-size URL for rows written
before this set:

| File | Change |
|---|---|
| `Apps/web/src/components/shared/ProductCard.tsx:52` | `src={primaryImage.thumbnailUrl ?? primaryImage.url}` |
| `Apps/web/src/pages/cart/components/CartItemRow.tsx:41` | same |
| `Apps/web/src/pages/admin/products/components/product-images-section.tsx` | the tile `<img>` uses `image.thumbnailUrl ?? image.url` |
| `Apps/web/src/components/sections/product-details/ProductImageGallery.tsx` | the **thumb strip** uses `thumbnailUrl ?? url`; the **main/zoom image keeps `url`** |

Add a one-line comment at the first of these explaining the `?? url` fallback (pre-S26.1 rows).

**Do not** touch the POS product list — it renders no image and `StaffProductDto` carries none
(§1.5).

### Action 9.10 — `Apps/web/src/services/catalog.service.ts`

Three sites (`listProducts`, `getProduct`, and the create-product response handler around line
156) run a loop whose body is `image.url = \`${image.url}\`` — a no-op — under the comment *"The
backend returns a relative path (e.g. `/uploads/abc.jpg`) but the frontend needs a full URL."*
That comment is now doubly wrong (the backend returns an absolute R2 URL, and the code does
nothing). **Delete all three loops and their comments.**

---

## 10. Cleanup

### Action 10.1 — delete `Apps/web/src/hooks/use-image-upload.ts`

A Sub-01 mock with a `// TODO: In a real application, this would upload to a server` block and
**zero consumers** (grep confirms only its own definition and the unrelated
`useImageUploadScreenReaderSupport` in `use-screen-reader-support.ts`). Leaving it beside a real
pipeline is an active trap. Grep `useImageUpload` once more before deleting, then check whether
`ImageUploadResult` in `Apps/web/src/types/draft-types/admin-product-add.types.ts` becomes
unreferenced and remove it too if so.

### Action 10.2 — `Apps/web/src/components/shared/drag-drop-area.tsx`

Its defaults (`maxSize = 5`, `allowedTypes = ["image/jpeg","image/png","image/webp"]`) now
contradict the real limits. Grep for consumers first:
- **if it has consumers**, change the defaults to `IMAGE_MAX_UPLOAD_BYTES / (1024*1024)` and
  `ACCEPTED_IMAGE_MIME_TYPES` from the contract;
- **if it has none**, delete the file, exactly as §10.1.

State which branch you took in the report.

### Action 10.3 — `Apps/web/src/pages/admin/products/AdminProductsAdd.tsx:511`

The file input's `accept="image/*"` becomes `accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}`. Do the
same for the input in `product-images-section.tsx`.

---

## 11. Translation keys

Add to `Apps/web/src/config/translations.json` (flat keys, `{ en, fr, ar: "" }`):

**Sentinels**
| key | en | fr |
|---|---|---|
| `common.errors.sentinel.unsupportedImageType` | Unsupported image format. Use JPEG, PNG, WebP or HEIC. | Format d'image non pris en charge. Utilisez JPEG, PNG, WebP ou HEIC. |
| `common.errors.sentinel.imageTooLarge` | The image is too large. The maximum is 10 MB. | L'image est trop volumineuse. Le maximum est de 10 Mo. |
| `common.errors.sentinel.imageTooManyPixels` | The image has too many pixels to process safely. | L'image comporte trop de pixels pour être traitée. |
| `common.errors.sentinel.imageDecodeFailed` | The image could not be read. It may be corrupt. | Impossible de lire l'image. Elle est peut-être corrompue. |
| `common.errors.sentinel.imageStorageUnavailable` | Image storage is unreachable. Nothing was saved — try again. | Le stockage d'images est injoignable. Rien n'a été enregistré — réessayez. |

**Upload control**
`common.media.upload` (Upload / Téléverser), `common.media.replace` (Replace / Remplacer),
`common.media.uploading` (Uploading… / Téléversement…), `common.media.noImage` (No image /
Aucune image), `common.media.uploadSuccess` (Image uploaded / Image téléversée),
`common.media.tooLarge` (`The image must be under {max} MB.` / `L'image doit faire moins de {max} Mo.`).

**Store tab**
`admin.settings.general.activityLine` (Activity line / Ligne d'activité),
`admin.settings.general.activityLineHelp` (Printed under the store name on receipts. / Imprimée
sous le nom du magasin sur les tickets.),
`admin.settings.general.storePhoneHelp` (General number, used on invoices. / Numéro général,
utilisé sur les factures.),
`admin.settings.general.repairPhone` (Repair phone / Téléphone réparation),
`admin.settings.general.salesPhone` (Sales phone / Téléphone vente),
`admin.settings.store.logos.title` (Logos), `…description`, `…storeLogo` (Store logo / Logo du
magasin), `…storeLogoHelp` (Full colour. Used on screen and on PDF documents. / En couleur.
Utilisé à l'écran et sur les documents PDF.), `…printLogo` (Print logo / Logo d'impression),
`…printLogoHelp` (Black and white only — used by the thermal receipt printer. Upload an already
monochrome image. / En noir et blanc uniquement — utilisé par l'imprimante thermique. Téléversez
une image déjà monochrome.).

**Hierarchy**
`admin.settings.hierarchy.logoUpdateSuccess` (Image updated / Image mise à jour).
Reuse the **existing** `admin.settings.hierarchy.logo` and `admin.settings.hierarchy.icon` keys as
the two upload controls' `aria-label`s — do not add duplicates.

Every one of these must go through `t()`; no literal strings in JSX (hard rule 2).

---

## 12. Dependency order

1. §2 dependencies → §3 env (nothing compiles without `sharp`'s types).
2. §4.1–4.2 contract media module (everything imports from it).
3. §5 storage rewrite → §4.3–4.5 pipeline (the pipeline depends on the new `StorageService`).
4. §6 media route (depends on the pipeline).
5. §7 prisma migration → contract DTO → mapper → catalog service → catalog routes → app.ts.
6. §8 settings contract (independent of §7; can run in parallel).
7. §9 frontend, in order 9.1 → 9.2 → 9.3 → 9.4 → 9.5/9.6/9.7 → 9.8 → 9.9 → 9.10.
8. §10 cleanup, §11 translations.

---

## 13. Validation gates (no test suites — hard rule 3)

Run, in order, and do not proceed past a failure:

```bash
cd Apps/contract && npx tsc --noEmit
cd Apps/api      && npm run prisma:generate && npx tsc --noEmit && npm run lint
cd Apps/web      && npx tsc --noEmit && npm run lint
```

**Do not run `npm test`, `test:unit` or `test:int`, and do not edit any file under `test/` or
`__tests__/`.** Lint in this repo has crashed rather than warned on real findings in the past; a
crash is a finding, not an infrastructure problem.

Additionally grep-verify, since the compiler cannot catch them:
- `grep -rn "PRODUCT_UPLOAD_DIR\|storageService.upload\|use-image-upload" Apps` → no hits.
- Every new `t("…")` key exists in `translations.json`.
- `grep -rn "image/jpeg" Apps/web/src` → only `ACCEPTED_IMAGE_MIME_TYPES` in the contract.

---

## 14. Manual verification checklist (the owner runs this in the browser)

**Setup**
1. Confirm `Apps/api/.env` carries all five `R2_*` keys, then start the API. It must boot; a
   missing key must now print `❌ Invalid environment variables` and exit — verify by temporarily
   blanking `R2_BUCKET_NAME`, restarting, and putting it back.

**Upload pipeline**
2. Admin → Settings → Store → **Store logo** → Upload a large colour JPEG (3 MB+ from a phone).
   It uploads, the preview appears, and a success toast fires.
3. Open the preview image in a new tab: the URL is on the R2 public domain (not the API host), the
   response is `content-type: image/webp`, and `cache-control: public, max-age=31536000, immutable`
   (check the Network tab). The long edge is ≤ 1600 px and the file is far smaller than the original.
4. Upload a photo taken **sideways** on a phone. It appears upright, not rotated — EXIF
   auto-orientation.
5. Upload a **HEIC** straight off an iPhone. It succeeds and displays. (This is the Q1 path; if it
   fails, capture the API log line and report it.)
6. Upload a **PDF renamed to `.jpg`**. It is rejected with "Unsupported image format…", not a
   generic crash — content sniffing, not the extension.
7. Upload a file **over 10 MB**. It is rejected with the size message before anything is stored.
8. Upload the **same image twice**. Both succeed and the two URLs are **identical** —
   content-addressed deduplication.

**Print logo**
9. Settings → Store → **Print logo** → upload a black-and-white PNG. The preview shows on the white
   backdrop; the stored object is `content-type: image/png` and no wider than 600 px.
10. Open it at full size and confirm there is **no grey fringing** around the black edges.

**Store header fields**
11. Settings → Store: fill **Activity line**, **Repair phone**, **Sales phone**, press Save, reload
    the page. All three persist. The pre-existing **Phone** field still holds its old value.
12. Confirm an **invoice PDF** still prints the store name/address/phone header unchanged
    (Billing → any invoice → download).
13. Change the Activity line, press Save, **then** upload a new store logo. Reload: both the new
    text and the new logo are present — the logo's own PATCH did not revert the text and vice versa.

**Brand & family images**
14. Settings → Hierarchy → **Brands**: click a brand's upload button, pick a logo. Success toast,
    the row's thumbnail appears immediately.
15. Same for a **Family** icon.
16. Go to the **public home page**. The brand appears in the Brands strip with its real logo
    (not its first letter), and the family tile in the Categories grid shows its icon (not the
    generic package icon). Both must appear **without** a hard refresh being required beyond a
    normal navigation.
17. Replace one brand's logo with a different image. The home page shows the new one — the
    content-addressed key changed, so no stale cached image survives.

**Product images & thumbnails**
18. Admin → Products → Add: create a product with 3 images. It saves; all three appear on the
    detail page.
19. On the **storefront product grid**, inspect the card image in the Network tab: the request is
    for a `-thumb.webp` object, not the full-size one.
20. On the **product detail page**, the large/zoom image is the full-size object while the thumb
    strip below uses the `-thumb` objects.
21. Delete one product image. The row disappears, the primary is promoted if you deleted the
    primary, and the object plus its `-thumb` are gone from R2 (check the bucket).
22. Upload the *same* file as images on **two different products**, then delete it from one. The
    **other product's image still renders** — the reference-count guard held.

**Failure path**
23. Stop network access to R2 (or temporarily point `R2_ENDPOINT` at an unreachable host and
    restart). Attempt a brand-logo upload: a clear "Image storage is unreachable…" toast appears,
    and after restoring the endpoint the brand's logo is **unchanged** — no row was written
    pointing at an object that does not exist.

**Regression sweep**
24. POS: complete a sale and print the receipt. It still prints the store block (this set does not
    change the receipt — S27 does); nothing regressed.
25. Repairs: open a repair and print the claim slip. Same.
26. Switch the language toggle to **FR** on the Settings → Store tab and the Hierarchy tab: every
    new label, helper text, button and toast is French, with no raw key or English string.

---

## 15. Execution protocol

Execute this set **on its own**. When finished, write
`Docs/Stage-04-Fixes/results/report-S26-1.md` describing what changed, file by file, and ending
with the checklist in §14 above. Record explicitly:

- which branch §10.2 took (fix defaults vs. delete `drag-drop-area.tsx`);
- that the `/uploads` static mount and `PRODUCT_UPLOAD_DIR` were removed and that pre-existing
  local-disk image rows now render broken, **with no backfill**, per the standing rule;
- that `env.ts` now fails boot without the five `R2_*` keys, and what that means for any
  environment that lacks them;
- anything the Q1 HEIC path did not handle.

The owner reviews and approves before **S27** begins.
