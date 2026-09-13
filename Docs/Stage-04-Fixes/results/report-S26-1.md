# Report — Set 26.1: Image pipeline, R2 storage & logo/header settings

Executed against `Docs/Stage-04-Fixes/plans/plan-S26-1-image-pipeline-r2-store-header.md` on
`version-1-3`, 2026-09-13.

Owner decisions confirmed before planning and carried into execution: **Q1** — HEIC is decoded
via a lazy `heic-convert` import, serialised behind a one-at-a-time queue; **Q2** — the existing
`store.phone` field is kept with all its current consumers, and `repairPhone`/`salesPhone` are
added alongside it.

## What changed

### Dependencies (`Apps/api`)

- Added `sharp` (image processing) and `heic-convert` + `@types/heic-convert` (HEIC → JPEG
  transcode, imported lazily so the wasm decoder is never resident unless a HEIC actually
  arrives).

### Environment

- **`Apps/api/src/env.ts`** — added `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` to the boot-validated schema. All five already existed
  in `Apps/api/.env` (from an earlier, undocumented storage commit) and are unchanged; the app
  will now refuse to boot if any is missing or invalid instead of throwing per-request `!`
  assertion failures.
- **`Apps/api/.env.example`** and **`Docs/Stage-02-Backend/env-template.md`** — documented the
  five `R2_*` variables and removed the stale "AWS_* generically" placeholder line.

### Contract (`Apps/contract`)

- **New `src/common/media.ts`** — the shared vocabulary every image upload uses: byte/pixel/quality
  constants (`IMAGE_MAX_UPLOAD_BYTES` 10MB, `IMAGE_MAX_LONG_EDGE` 1600px,
  `IMAGE_THUMBNAIL_LONG_EDGE` 400px, `IMAGE_WEBP_QUALITY` 85, `IMAGE_MAX_INPUT_PIXELS` 50MP,
  `PRINT_LOGO_MAX_WIDTH` 600px), `ACCEPTED_IMAGE_MIME_TYPES`, the `ImagePurpose` enum (PRODUCT /
  BRAND_LOGO / FAMILY_ICON / STORE_LOGO / PRINT_LOGO), `MEDIA_ERROR` sentinels, `UploadImageSchema`
  (multipart body: `purpose` only) and `MediaImageResponseSchema`/`MediaImageDto`. Exported from
  `src/index.ts`.
- **`platform.routes.ts`** — new `ADMIN_MEDIA_IMAGE: '/admin/media/images'`.
- **`platform.dtos.ts`** — `SettingsResponseSchema.store` and `PublicSettingsResponseSchema.store`
  both gained `activityLine?`, `repairPhone?`, `salesPhone?`, `printLogoUrl?` (existing `phone`/
  `logoUrl` untouched).
- **`platform.command.ts`** — `StoreSettingsInputSchema` gained the same four fields.
- **`catalog.dtos.ts`** — `ProductImageResponseSchema` gained `thumbnailUrl?` (ripples into
  `ProductWithPricingDto`/`ProductDetailDto`/`AdminProductDto`, which embed it).
- **`catalog.routes.ts`** — removed `PRODUCT_UPLOAD_DIR` and the unused `IMAGE: '/uploads/:id'`
  route constant (zero consumers of either, confirmed by grep before deleting).

### Backend (`Apps/api`)

**Storage layer** — `common/storage/`:
- `storage.types.ts` rewritten: `StorageService` is now `put(input)` / `delete(key)` /
  `deleteMany(keys)` / `exists(key)`, key-addressed rather than folder+random-name. Added
  `IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'`.
- `r2.service.ts` rewritten: reads `env.R2_*` (validated at boot) instead of `process.env.R2_*!`;
  `put()` sets `CacheControl` and wraps `PutObjectCommand` failures in a new
  `StorageUnavailableError(MEDIA_ERROR.IMAGE_STORAGE_UNAVAILABLE)` (502) so an unreachable R2
  surfaces as a translated toast and **no caller proceeds to write a database row**; `delete()`/
  `deleteMany()` swallow failures and log a warning (an orphaned object costs nothing).
- `common/errors/index.ts` — added `StorageUnavailableError`.

**New shared image pipeline** — `common/media/`:
- `image-sniff.ts` — magic-byte detection for JPEG/PNG/WebP/HEIC. The client-declared mimetype is
  never trusted.
- `heic-decoder.ts` — `decodeHeicToJpeg()`, a lazy `await import('heic-convert')` serialised
  through a single promise chain (owner decision Q1).
- `image-pipeline.service.ts` — `ImagePipelineService.process(file, purpose)`: sniff → (HEIC only)
  transcode → `sharp(...).rotate()` (EXIF auto-orient, and metadata is stripped by *not* calling
  `.withMetadata()`) → resize/encode per purpose → hash the **processed** bytes into a
  content-addressed key → `storage.put(...)` → `MediaImageResponseSchema.parse(...)`. `PRINT_LOGO`
  gets its own branch: PNG, `.threshold(128)` for pure black/white, capped at 600px wide, no
  thumbnail. Every other purpose emits a 1600px WebP-85 main image plus a 400px WebP-85 thumbnail.
  Decode/resize failures are mapped to `IMAGE_TOO_MANY_PIXELS` or `IMAGE_DECODE_FAILED`.

**Media upload route** (platform module — writes no row, only returns URLs):
- `platform.interface.ts` — `IPlatformService.uploadImage(file, cmd)`.
- `platform.service.ts` — delegates straight to `imagePipeline.process`.
- `platform.controller.ts` — `uploadImage` controller, mirrors `importFees`'s
  `req.file`-required pattern.
- `platform.routes.ts` — new `uploadImage` multer instance (`memoryStorage`, `limits.fileSize =
  IMAGE_MAX_UPLOAD_BYTES`, **no** mimetype `fileFilter` — sniffing happens in the pipeline), wired
  as `POST ADMIN_MEDIA_IMAGE`, admin-only.

**Product images onto the pipeline** — `catalog` module:
- **`schema.prisma`** — `ProductImage` gained `thumbnailUrl String?` / `thumbnailKey String?`.
  Migration `20260913120332_s26_1_image_thumbnails` applied against the local dev database
  (additive, nullable — no backfill).
- **`catalog.mapper.ts`** — `toProductImageDto` carries `thumbnailUrl` through via a conditional
  spread.
- **`catalog.service.ts`**:
  - `createProduct` — images are now processed and uploaded to R2 **before** the `$transaction`
    opens (previously the upload ran *inside* the transaction, holding a DB transaction open
    across N network round-trips to R2). If R2 is unreachable, nothing is written at all.
  - `addImages` — same pipeline call, thumbnail columns carried through.
  - `deleteImage` — deletes the object **and** its thumbnail together via `storageService
    .deleteMany([key, thumbnailKey])`, guarded by the existing reference-count check (now more
    load-bearing: content-addressed keys mean two products from the same uploaded photo share one
    object). Rewrote the block comment, which had described local-disk `unlink()` and a
    `basename()` path-traversal guard — neither true since the earlier R2 migration.
- **`catalog.routes.ts`** — the `uploadImages` multer config dropped its mimetype `fileFilter`
  (the pipeline sniffs) and now uses the contract's `IMAGE_MAX_UPLOAD_BYTES` limit with
  `files: 3`. Rewrote the stale comment above it, which described disk storage and "no owner
  decision yet on local/S3" — the pipeline exists now.

**Local-disk mount retired**:
- **`app.ts`** — removed the `${API_PREFIX}/uploads` `express.static` mount and its `path`/
  `PRODUCT_UPLOAD_DIR` imports. The Fly filesystem is ephemeral; every image is now served from
  `R2_PUBLIC_URL` directly.
- **Any pre-S26.1 row whose `url`/`logoUrl`/`iconUrl` points at a local `/uploads/...` path now
  renders a broken image.** Per the standing rule, **no backfill was performed** — the local dev
  database in this environment held no such rows (fresh-ish test data), but a database seeded
  before this set's storage migration would need to re-upload those images by hand.

**Settings**:
- **`prisma/settings-defaults.ts`** — added a comment recording that no default-value change was
  needed: `DEFAULT_SETTINGS.store` still supplies only `name`, and `PlatformMapper.toSettingsDto`
  already falls back **whole-section** for `store`, so the four new optional fields parse fine
  against the schema whether or not they've ever been written. `PlatformService.updateSettings`
  and `PlatformMapper` needed no code changes — both are generic over section shape.

### Frontend (`Apps/web`)

- **New `src/services/media.service.ts`** — `uploadImage(file, purpose)`, multipart, mirrors
  `platform.service.ts`'s `importFees`.
- **New `src/hooks/useMedia.ts`** — `useUploadImage()`, mutation-only (no query key — the caller
  persists the returned URL via its own entity mutation, which already invalidates the right
  cache).
- **`src/lib/query-client.ts`** — added the five `MEDIA_ERROR` sentinels to
  `SENTINEL_TRANSLATION_KEYS` so upload failures toast a translated sentence instead of a raw
  `SCREAMING_SNAKE` token.
- **New `src/components/shared/image-upload-field.tsx`** — the one reusable upload control (full
  variant: label + preview + button + hint; `compact` variant: icon-only button for inline table
  rows). Client-side pre-checks size before firing the mutation; no remove/clear action (nothing
  in this set asks for one, and the contract's `.optional()` fields can't express "clear" through
  a PATCH that ignores `undefined`).
- **Settings — Store tab**:
  - `store-settings.schema.ts` — added `activityLine`, `repairPhone`, `salesPhone`.
    **`logoUrl`/`printLogoUrl` are deliberately not in this form** — the two logo controls commit
    their own PATCH immediately on upload, so a stale-seeded text-form Save could otherwise
    silently revert a logo that was just set.
  - `store-settings-form.tsx` — added the three new fields plus `FormDescription` helper text on
    `activityLine` and `phone` (clarifying `phone` is the general/invoice number, distinct from
    the two new receipt-labelled numbers).
  - `AdminSettings.tsx` — new "Logos" card above the text form with two `ImageUploadField`s
    (`STORE_LOGO`, `PRINT_LOGO`, the latter previewed on a white background so a monochrome PNG
    is visible in dark mode), each committing its own `{ store: { logoUrl | printLogoUrl } }`
    PATCH on upload.
- **Settings — Hierarchy tab**:
  - `hierarchy-panel.tsx` — `HierarchyPanelProps` gained optional `onSetFamilyIcon`/
    `onSetBrandLogo` (same "optional so a pre-existing test still type-checks" precedent as the
    existing `onEnable*` props). Each family/brand row now shows a small preview thumbnail and a
    compact `ImageUploadField` button.
  - `AdminSettings.tsx` — `handleSetFamilyIcon`/`handleSetBrandLogo` wired through the **existing**
    `useUpdateCatalogFamily`/`useUpdateCatalogBrand` hooks (no new query key needed — their
    existing `.all()` invalidation already covers the admin list and the public storefront list).
- **Thumbnail consumers** — `ProductCard.tsx`, `CartItemRow.tsx`, `product-images-section.tsx`
  (admin image manager tiles) now render `image.thumbnailUrl ?? image.url`. In
  `ProductImageGallery.tsx`, only the **thumbnail strip** was changed to the derivative; the
  main/zoom image keeps the full-size `url`. The `?? url` fallback covers rows written before this
  set, which have no derivative.
- **`services/catalog.service.ts`** — removed three no-op `image.url = \`${image.url}\`` loops
  (in `listProducts`, `getProduct`, `getAdminProduct`) whose comments claimed the backend returned
  a relative `/uploads/...` path needing rewriting — false since the earlier R2 migration, and the
  line did nothing regardless.
- **Cleanup**:
  - Deleted `hooks/use-image-upload.ts` — a Sub-01 mock (`URL.createObjectURL` fake uploads, a
    `// TODO: In a real application...` block) with zero consumers. Its `ImageUploadResult` type
    (defined in `types/draft-types/admin-product-add.types.ts`, re-exported from the barrel
    `index.ts`) was removed with it, having no other consumer.
  - Deleted `components/shared/drag-drop-area.tsx` — zero consumers found by grep (the plan's
    other branch, updating its defaults, did not apply).
  - `AdminProductsAdd.tsx` and `product-images-section.tsx` — file-input `accept="image/*"`
    replaced with `ACCEPTED_IMAGE_MIME_TYPES.join(",")` from the contract.
- **Translations** — added to `src/config/translations.json`: 5 `common.errors.sentinel.*` keys
  (matching `MEDIA_ERROR`), 5 `common.media.*` keys (upload/replace/uploading/uploadSuccess/
  tooLarge), `admin.settings.general.{activityLine,activityLineHelp,storePhoneHelp,repairPhone,
  salesPhone}`, `admin.settings.store.logos.{title,description,storeLogo,storeLogoHelp,printLogo,
  printLogoHelp}`, and `admin.settings.hierarchy.logoUpdateSuccess`. The pre-existing
  `admin.settings.hierarchy.{icon,logo}` keys were reused as the compact buttons' labels rather
  than duplicated.

## Deviations from the plan

None material. One plan action (§9.4's "give `ImageUploadField` a `compact` prop") was folded
directly into the initial component write rather than added afterward, since writing it once was
simpler than the plan's two-step sequencing implied.

## Validation performed

Per the hard rule, **no test suite was run and no test file was touched.**

```
Apps/contract:  npx tsc --noEmit   → 0 errors
Apps/contract:  npm run lint       → 0 errors
Apps/api:       npx tsc --noEmit (src/**) → 0 errors
                (184 pre-existing errors remain under test/**, confirmed present on a clean
                 checkout before this set touched anything — unrelated to this work, not fixed
                 per "do not modify test files")
Apps/api:       npm run lint       → 0 errors in every file this set touched; 7 pre-existing
                errors remain in prisma/seed.ts, validate-request.middleware.ts and
                orders.service.ts — none of which this set modified
Apps/web:       npx tsc --noEmit   → 0 errors
Apps/web:       npm run lint (scoped to every file this set added or edited) → 0 errors after one
                eslint --fix pass on three files' import-statement formatting
                (image-upload-field.tsx, query-client.ts, hierarchy-panel.tsx)
```

Grep-verified: no remaining reference to `PRODUCT_UPLOAD_DIR`, `storageService.upload`, or
`use-image-upload` anywhere in `Apps/`; every new `t("…")` key resolves in `translations.json`;
`ACCEPTED_IMAGE_MIME_TYPES` is the only source of an `image/*`-style accept list left in the web
app.

## ⚠️ Action required before S27 begins

- **`env.ts` now requires all five `R2_*` variables to boot.** They are present in
  `Apps/api/.env` in this environment; any other environment (CI, a fresh clone) must set them
  before the API will start.
- **Product/brand/family image rows written before this set's storage migration, if any point at
  a local `/uploads/...` path, now render broken.** No backfill was performed (test data only, per
  the standing rule) — re-upload through the new controls if any such rows exist.
- The Q1 HEIC path was implemented and compiles/type-checks, but **could not be exercised
  end-to-end** in this session (no way to drive a real HEIC file through the running app without
  the owner's browser). Flag this as the one path in the plan's verification checklist the owner
  should check first.

## Manual verification checklist

Copied from the plan (§14) — the owner runs these in the browser:

**Setup**
1. Confirm `Apps/api/.env` carries all five `R2_*` keys, then start the API. Temporarily blank
   `R2_BUCKET_NAME`, restart, confirm boot fails with `❌ Invalid environment variables`, then
   restore it.

**Upload pipeline**
2. Admin → Settings → Store → **Store logo** → upload a large colour JPEG (3MB+ from a phone). It
   uploads, the preview appears, success toast fires.
3. Open the preview image in a new tab: URL is on the R2 public domain, `content-type: image/webp`,
   `cache-control: public, max-age=31536000, immutable`. Long edge ≤ 1600px, file much smaller than
   the original.
4. Upload a photo taken **sideways** on a phone — it appears upright (EXIF auto-orientation).
5. Upload a **HEIC** straight off an iPhone — it succeeds and displays. *(Not exercised this
   session — verify first.)*
6. Upload a **PDF renamed to `.jpg`** — rejected with "Unsupported image format…", not a crash.
7. Upload a file **over 10MB** — rejected before anything is stored.
8. Upload the **same image twice** — both succeed with **identical** URLs (content-addressed dedup).

**Print logo**
9. Settings → Store → **Print logo** → upload a black-and-white PNG. Preview shows on the white
   backdrop; stored object is `content-type: image/png`, no wider than 600px.
10. Open it at full size — **no grey fringing** around black edges.

**Store header fields**
11. Settings → Store: fill Activity line, Repair phone, Sales phone, Save, reload. All three
    persist; the pre-existing Phone field is untouched.
12. Confirm an **invoice PDF** still prints the store header unchanged.
13. Change Activity line, Save, **then** upload a new store logo. Reload: both the new text and
    the new logo are present.

**Brand & family images**
14. Settings → Hierarchy → Brands: upload a logo — success toast, thumbnail appears immediately.
15. Same for a Family icon.
16. Public home page: the brand shows its real logo (not its first letter); the family tile shows
    its icon (not the generic package icon) — without a hard refresh.
17. Replace a brand logo with a different image — the home page shows the new one.

**Product images & thumbnails**
18. Admin → Products → Add: create a product with 3 images — saves, all three appear on detail.
19. Storefront product grid: inspect the image request — it is the `-thumb.webp` object.
20. Product detail page: large/zoom image is full-size; thumb strip uses `-thumb` objects.
21. Delete one product image — row disappears, primary promoted if needed, object + thumb gone
    from R2.
22. Upload the *same* file as images on two different products, delete it from one — **the other
    product's image still renders**.

**Failure path**
23. Point `R2_ENDPOINT` at an unreachable host, restart, attempt a brand-logo upload — a clear
    "Image storage is unreachable…" toast appears, and the brand's logo is **unchanged** after
    restoring the endpoint.

**Regression sweep**
24. POS: complete a sale, print the receipt — still prints the store block (unchanged by this set).
25. Repairs: open a repair, print the claim slip — same.
26. Toggle language to **FR** on Settings → Store and Hierarchy — every new label/toast is French,
    no raw key or English leak.

---

The owner reviews and approves before **S27** (thermal receipt + barcode labels) begins.
