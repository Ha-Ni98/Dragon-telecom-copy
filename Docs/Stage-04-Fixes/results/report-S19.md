# Report — Set 19: Barcode — generation API & label printing

Executed against `Docs/Stage-04-Fixes/plans/plan-S19-barcode-generation-and-labels.md` on
`version-1-1-1`, 2026-08-05.

Owner decisions confirmed before execution: **Q1** — strip diacritics, keep `[A-Z0-9]`, pad with
`X`; **Q2** — 10 collision-retry attempts then 409; **Q4** — label shows the barcode symbol and its
digits only (no name, no price).

## What changed

### Contract (`Apps/contract`)
- **New `modules/catalog/catalog.constants.ts`** — `BARCODE_PREFIX_CHARS` (2), `BARCODE_DIGITS`
  (5), `BARCODE_LENGTH` (9), `BARCODE_PREFIX_PAD_CHAR` (`"X"`), `BARCODE_GENERATION_MAX_ATTEMPTS`
  (10), `BARCODE_LABEL_MAX_QUANTITY` (200), and the `CATALOG_ERROR` sentinel map
  (`BARCODE_TAKEN`, `BARCODE_GENERATION_EXHAUSTED`). Exported first from `modules/catalog/index.ts`.
- **`catalog.routes.ts`** — `GENERATE_BARCODE: '/admin/products/barcode'`, registered as a literal
  segment (same reason `PRODUCT_STATS` is registered before `ADMIN_PRODUCT_BY_ID`).
- **`catalog.command.ts`** — `GenerateBarcodeSchema` (`familyId`, `brandId`, both `z.uuid()`).
- **`catalog.dtos.ts`** — `GeneratedBarcodeResponseSchema` (`barcode: z.string().length(BARCODE_LENGTH)`).

### Backend (`Apps/api`)
- **`catalog.service.ts`** — two new module-level helpers: `barcodePrefix(name)` (NFD-normalize,
  strip combining marks via `̀`–`ͯ`, uppercase, keep `[A-Z0-9]`, take first 2, pad with
  `X`) and `randomBarcodeDigits()` (5-digit zero-padded). New `CatalogProductService.generateBarcode`
  — reads family/brand names, builds the derived prefix, loops up to
  `BARCODE_GENERATION_MAX_ATTEMPTS` regenerating only the digits and checking
  `Product.barcode` uniqueness via `findUnique`, throws `ConflictError(CATALOG_ERROR
  .BARCODE_GENERATION_EXHAUSTED)` on exhaustion. No transaction — read-only, and
  `barcode @unique` is the real guard.
  - `createProduct`/`updateProduct`'s P2002 catches now throw `ConflictError(CATALOG_ERROR
    .BARCODE_TAKEN)` instead of the English string `'Barcode already in use'`, so the frontend can
    compare against a contract constant rather than a sentence.
  - `createProduct` trims the barcode before writing it.
  - `updateProduct` now maps a cleared/blank barcode to `null` (not `''`), so a second product whose
    barcode is cleared doesn't collide with the first under the unique index.
- **`catalog.interface.ts`** — `generateBarcode` added to `ICatalogProductService`.
- **`catalog.controller.ts`** — `generateBarcode` handler.
- **`catalog.routes.ts`** — `POST GENERATE_BARCODE`, `adminOnly`, validated against
  `GenerateBarcodeSchema`, registered before `ADMIN_PRODUCTS`/`ADMIN_PRODUCT_BY_ID`.

### Frontend (`Apps/web`)
- **`npm install jsbarcode`** (`^3.12.3`). No `@types/jsbarcode` — verified the bundled
  `jsbarcode.d.ts` resolves and type-checks cleanly under this repo's exact `tsconfig.json`
  (`moduleResolution: Bundler`, no `esModuleInterop`) before adding the dependency.
- **`services/catalog.service.ts`** — `generateBarcode(command)`, `POST` to `GENERATE_BARCODE`.
- **`hooks/useCatalogProducts.ts`** — `useGenerateBarcode()`, a `useMutation` (deliberately not a
  query: every click must yield a fresh value, and nothing is written server-side so there is no
  cache to invalidate).
- **`lib/query-client.ts`** — `SENTINEL_TRANSLATION_KEYS` map translates `CATALOG_ERROR
  .BARCODE_TAKEN`/`BARCODE_GENERATION_EXHAUSTED` in the generic mutation-cache toast; any other
  sentinel still falls through unchanged (scope-limited to the two this set introduces, per the
  plan — the pre-existing `INSUFFICIENT_STOCK`/`CREDIT_REQUIRES_CLIENT` raw-token call sites were
  left alone).
- **`pages/admin/products/AdminProductsAdd.tsx`** — deleted the old client-side fake generator
  (`BC` + timestamp, never checked uniqueness, never called the server). New
  `handleGenerateBarcode`: guards on family/brand selected (toast, no request) and calls
  `useGenerateBarcode()`. The barcode field gained a helper line and an error slot; a
  `BARCODE_TAKEN` response on submit now calls `setError("barcode", …)` instead of only closing the
  confirm dialog.
- **`pages/admin/products/use-edit-mode.ts`** — added `generateBarcode`/`isGeneratingBarcode`
  (same family/brand-derived generation, no "select first" guard needed since an existing product
  always has both). Rewrote `save()` to `await` `mutateAsync` for both details and pricing and only
  set the `Ok` flags after the request itself resolves — previously the success toast fired and
  edit mode closed synchronously after validation, before the server had answered, so a
  server-side rejection had nowhere to land. A `BARCODE_TAKEN` details-save failure now sets the
  field error and keeps edit mode open.
- **`pages/admin/products/components/product-details-section.tsx`** — barcode input gained the
  Auto-generate button (edit mode only), helper text, and an error slot, mirroring Add Product.
- **`pages/admin/products/AdminProductInformation.tsx`** — passes `onGenerateBarcode`/
  `isGeneratingBarcode` through to `ProductDetailsSection`.
- **New `pages/admin/products/components/barcode-label.tsx`** — one 40×25mm Code 128 label via
  JsBarcode into an `<svg>`, forced white-on-black regardless of theme.
- **New `pages/admin/products/components/barcode-label-dialog.tsx`** — quantity input
  (clamped 1–`BARCODE_LABEL_MAX_QUANTITY` on every keystroke, defaults to the product's
  `quantityOnHand`, minimum 1 for a zero-stock product), a live preview, and a print action. The
  print sheet is portalled to `<body>` as `#barcode-print-root` (hidden on screen) rather than
  nested inside the dialog, so the dialog's own max-height can't clip a large run.
- **`index.css`** — `@media print` rule: `@page { size: A4; margin: 8mm; }`, hides every direct
  child of `<body>` except `#barcode-print-root` (covers both the app root and Radix's dialog
  portal, which is also a body child).
- **`pages/admin/products/components/admin-products-table.tsx`** — actions column header renamed
  "Edit" → "Actions"; a second row action (printer icon) opens the label dialog, disabled with an
  explanatory tooltip on a product with no barcode. Same action added to the mobile row, next to
  Edit (previously desktop-only intent, now also reachable on mobile).
- **`pages/admin/products/AdminProducts.tsx`** — owns `labelProduct` state, passes
  `onPrintBarcode={setLabelProduct}` to the table, renders `<BarcodeLabelDialog>`.
- **`config/translations.json`** — 15 new keys: 3 under `admin.productsAdd.*`
  (`barcodeHelper`, `barcodeNeedsFamilyBrand`, `barcodeTaken`), 2 under `common.errors.sentinel.*`
  (`barcodeTaken`, `barcodeGenerationExhausted`), 3 under `admin.productsList.table.*` (`actions`,
  `printLabels`, `printLabelsNoBarcode`), 5 under `admin.productsList.printLabels.*` (`title`,
  `preview`, `quantityLabel`, `quantityHelper`, `print`). `ar: ""` per convention;
  `autoGenerateBarcode` and `common.actions.cancel` were reused, not duplicated.

## Deviations from the plan

None. All actions (A1–A5, B1–B6, C1–C4, D1–D4, E1–E5, F) were implemented as specified. Two
formatting nits (an import-line wrap and a call-site wrap in `use-edit-mode.ts`) were fixed to
satisfy `prettier/prettier` — not a deviation from the plan's logic, just the file's exact line
breaks differ slightly from the plan's inline snippets.

## Validation gate (no test file read, edited, or run)

| Package | `tsc --noEmit` | `lint` |
|---|---|---|
| `Apps/contract` | clean | clean |
| `Apps/api` | `src/**` clean (zero `error TS` lines outside `test/**`); `test/**` errors are pre-existing (confirmed identical — 228 lines — on clean HEAD via `git stash`, unrelated modules: billing/orders/repairs/statistics fixture drift) | `src/modules/catalog/{catalog.controller,catalog.service,catalog.interface}.ts` clean; the one `catalog.routes.ts` error (`PRODUCT_UPLOAD_DIR` unused) is pre-existing, confirmed on clean HEAD |
| `Apps/web` | `tsc --noEmit` clean; `tsc --noEmit -p tsconfig.test.json` clean (test-tsconfig failures — 48 lines — are pre-existing, confirmed identical on clean HEAD, none in a touched or created file) | Every file touched or created this set lints clean (`catalog.service.ts`, `useCatalogProducts.ts`, `query-client.ts`, `AdminProductsAdd.tsx`, `AdminProductInformation.tsx`, `AdminProducts.tsx`, `use-edit-mode.ts`, `product-details-section.tsx`, `admin-products-table.tsx`, `barcode-label.tsx`, `barcode-label-dialog.tsx`). The full-repo `eslint .` run surfaces ~3.7k pre-existing `prettier/prettier` findings in unrelated files (the documented Sub-01 draft-types/prettier-noise baseline) — not touched, per D12 (correctness/imports/syntax only). Two new formatting errors this set actually introduced in `use-edit-mode.ts` were fixed. |

No test file was read, edited, or run.

## Manual verification checklist (browser)

Reproduced from the plan's §"Manual verification checklist" for the reviewer's convenience.

**Generation — Add Product** (`/admin/products/add`, as ADMIN)

1. With **no family and no brand** selected, click **Auto-generate** → a toast reads "Select a
   family and a brand first", the barcode field stays empty, and the Network tab shows **no**
   request.
2. Select family **Display** (or any) and brand **iPhone** (or any), click **Auto-generate** → the
   field fills with a 9-character value whose first four characters are the uppercased first two
   letters of each name (e.g. `DIIP…`) and whose last five are digits.
3. Click **Auto-generate** again → a **different** value each time.
4. Type over the generated value by hand, then clear it completely → both are allowed; the field is
   never read-only and never re-fills itself.
5. Pick a family or brand whose name is one character, or accented, or non-Latin (create one inline
   if needed, e.g. a family called `K` and a brand called `Écrans`) → the prefix is `KXEC`, not a
   crash and not a shorter barcode.
6. Save the product with a generated barcode → it appears in the products list with that barcode in
   the Barcode column.
7. Add another product, type **the barcode you just used**, and save → the create fails, the message
   **"This barcode is already used by another product"** appears **under the barcode input**, the
   confirm dialog closes, and the toast says the same thing (not `BARCODE_TAKEN`).

**Generation — Product Info** (`/admin/products/<id>`)

8. Click **Edit** → the barcode field is editable and shows an **Auto-generate** button; outside edit
   mode it is still plain text.
9. Click **Auto-generate** → the field fills with a fresh value derived from *this product's* family
   and brand. Click **Cancel** → the field reverts to the saved barcode; nothing was written.
10. Generate again, then **Save** → success toast, edit mode closes, and the header/details show the
    new barcode after the refetch.
11. Edit, type a barcode that belongs to **another** product, Save → **edit mode stays open**, the
    message lands under the barcode input, and no success toast appears.
12. Edit, **clear** the barcode entirely, Save → the barcode shows "—". Clear a **second** product's
    barcode the same way → it also succeeds (the empty-string-vs-NULL fix; before it, the second
    clear would 409).

**Label printing** (`/admin/products`)

13. The row actions column now shows **two** icons: the pencil and a printer.
14. Hover the printer on a product **with no barcode** → it is disabled and its tooltip reads "This
    product has no barcode yet"; clicking does nothing.
15. Click the printer on a product **with** a barcode → a dialog opens showing one label preview
    (bars + the 9 characters underneath, black on white in both light and dark theme) and a
    **Number of labels** input **pre-filled with that product's on-hand quantity**.
16. Set the quantity to `3`, click **Print** → the browser print preview shows **exactly 3** labels
    on an A4 page, tiled left-to-right, and **nothing else** — no app chrome, no sidebar, no dialog
    box. Cancel the print dialog → the app is intact and the dialog is still open.
17. Set the quantity to `40` → the print preview fills roughly one A4 page. Set it to `9999` → it
    clamps to `200`. Clear the field → it falls back to `1`.
18. A product with **0 on hand** → the quantity pre-fills to `1`, not `0`, and printing yields one
    label.
19. Scan one printed (or on-screen) label with the POS barcode scanner (`/staff/pos`, F2) or type the
    value into the products search → the correct product is found. **This is the only check that
    proves the Code 128 symbol is well-formed and undistorted — do not skip it.**
20. Close the dialog and print any other page normally (Ctrl+P on the products list with no dialog
    open) → the page prints as before; the label rule only takes effect while the dialog is open.

## Handoffs

1. **To S21** — S21's contract/backend work extends the same files this set touched
   (`catalog.constants.ts`, `catalog.routes.ts`, `catalog.command.ts`, `catalog.dtos.ts`,
   `catalog.interface.ts`, `catalog.service.ts`, `catalog.controller.ts`, `catalog.routes.ts` in
   the api). Running S19 first (as the brief specified) means S21 extends files already in their
   post-S19 shape.
2. **Known, deliberate gap** — `Apps/web/tests/fixtures/msw/catalog.handlers.ts` has no handler for
   `GENERATE_BARCODE`. Any future test exercising Auto-generate will need one; out of scope here
   because D12 forbids touching test files.
