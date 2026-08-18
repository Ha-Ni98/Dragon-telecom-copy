# Report — Set 22: Barcode label printing as PDF

Executed against `Docs/Stage-04-Fixes/plans/plan-S22-barcode-label-pdf.md` on `version-1-2`,
2026-08-11.

## Note on finding F1 — fixed in two steps

Before this set's full execution began, the print-blank-page regression (finding F1) was already
raised as urgent and fixed once, ahead of schedule, as a standalone hotfix: `index.css`'s
`@media print` rule was narrowed with `body:has(#barcode-print-root) > *:not(...)` so it only fired
while the label dialog's portal actually existed in the DOM, repairing POS/sales/invoice printing
without touching the still-live S19 `window.print()` flow. Once this set's E1 removed that flow
entirely (the dialog now downloads a PDF, no portal, no `window.print()`), the scoped rule became
dead code and was deleted outright per the plan's E3 — the CSS file carries no barcode-print rule
at all now. Net effect matches the plan; only the intermediate step differed from it.

## What changed

### Contract (`Apps/contract`)
- **`catalog.constants.ts`** — updated the stale S19 comment on `BARCODE_LABEL_MAX_QUANTITY`
  (rendering moved server-side, so the cap now bounds per-line API work, not tab survival). Added
  `BARCODE_LABEL_SHEET_MAX_ITEMS` (100), `BARCODE_LABEL_SHEET_MAX_TOTAL` (1000),
  `BARCODE_LOOKUP_MAX_IDS` (200), and two new `CATALOG_ERROR` sentinels:
  `BARCODE_LABELS_EMPTY`, `BARCODE_LABEL_TOTAL_EXCEEDED`.
- **`catalog.routes.ts`** — `BARCODE_LOOKUP` (`/admin/products/barcode-lookup`) and
  `BARCODE_LABELS` (`/admin/products/barcode-labels`), both POST, registered as literal segments
  immediately after `GENERATE_BARCODE`.
- **`catalog.command.ts`** — `BarcodeLookupSchema` (`productIds`, 1–200) and
  `BarcodeLabelSheetSchema` (`items[]` of `{productId, quantity}`, 1–100 items, cross-field
  `.refine()` capping the summed quantity at 1000 and raising it as the
  `BARCODE_LABEL_TOTAL_EXCEEDED` sentinel).
- **`catalog.dtos.ts`** — `BarcodeLookupResponseSchema` (`items: [{productId, name, barcode}]`,
  only printable products included).

### Backend (`Apps/api`)
- **`npm install bwip-js@^4.11.2`** — zero runtime dependencies, no native build, no
  `@types/bwip-js` (none exists; the package ships its own). Imported as the **default export**
  (`import bwipjs from 'bwip-js/node'`) per the plan's verified-do-not-change note — the named
  `raw` export is a different symbology, not the encoding helper.
- **`common/utils/pdf.utils.ts`** — extracted the shared `toBuffer(doc)` promise plumbing out of
  `renderInvoicePdf` (body unchanged, only the wrapper). Added `renderBarcodeLabelsPdf(requests)`:
  A4 portrait, 0-margin `PDFDocument`, 8 mm sheet margin, 2 mm gutter, 40×25 mm labels, 4 columns ×
  10 rows = 40/page. Bars are drawn as PDFKit rectangles from `bwipjs.raw('code128', value).sbs`
  (module widths), with a 10-module quiet zone added on each side (not part of `sbs`). Verified by
  a direct runtime smoke test against the real file (not the plan's prototype): rendered an 8-label,
  2-product PDF, rasterised it, and visually confirmed 4-column tiling, correct per-product counts
  and line order, before wiring anything else.
- **`catalog.service.ts`** — added `isPrintableBarcode` predicate (ASCII 0x20–0x7E only, matching
  what Code 128 / `bwipjs.raw()` can encode) right after the S19 `randomBarcodeDigits()` helper.
  Added `lookupBarcodes()` (de-dupes ids, preserves requested order, silently omits unprintable/
  missing products) and `renderBarcodeLabels()` (re-resolves barcodes from the DB rather than
  trusting the client, drops unprintable items, 400s with `BARCODE_LABELS_EMPTY` if nothing is left
  to print) — both placed after `generateBarcode()`.
- **`catalog.interface.ts`** — new `PdfResult` type (mirrors billing's own, deliberately not
  shared); `lookupBarcodes`/`renderBarcodeLabels` added to `ICatalogProductService`.
- **`catalog.controller.ts`** — `lookupBarcodes`/`renderBarcodeLabels` handlers; private
  `streamPdf()` helper (same shape as `billing.controller.ts`, `attachment` disposition since a
  label sheet is never previewed in place).
- **`catalog.routes.ts`** — both routes registered `adminOnly`, immediately after
  `GENERATE_BARCODE` and before `ADMIN_PRODUCTS`/`ADMIN_PRODUCT_BY_ID` (same literal-before-`:id`
  ordering rule as `PRODUCT_STATS`).

### Frontend (`Apps/web`)
- **`lib/query-keys.ts`** — `qk.catalog.barcodeLookup(productIds)`.
- **`services/catalog.service.ts`** — `lookupBarcodes()` (JSON), `renderBarcodeLabels()` (blob,
  mirrors `billing.service.ts`'s PDF pattern).
- **`hooks/useCatalogProducts.ts`** — `useBarcodeLookup()` (a query — cacheable, unlike generation)
  and `usePrintBarcodeLabels()` (a mutation — triggers a download, not cacheable).
- **`lib/query-client.ts`** — `SENTINEL_TRANSLATION_KEYS` extended with the two new sentinels.
- **`pages/admin/products/components/barcode-label-dialog.tsx`** — rewritten: dropped
  `createPortal`/`#barcode-print-root`/`window.print()` entirely; the Print button now calls
  `usePrintBarcodeLabels()` and downloads `labels-<barcode>.pdf` via the existing `downloadBlob`
  helper, closing the dialog on success. The on-screen single-label preview (still `jsbarcode`-
  rendered) is unchanged in shape.
- **`pages/admin/products/components/barcode-label.tsx`** — header comment updated to state this
  is a preview-only component now; component body untouched.
- **`index.css`** — the S19 `@media print` block removed entirely (see the F1 note above for how
  it got to that state in two steps).
- **New `pages/admin/supplier-invoices/components/barcode-labels-dialog.tsx`** — one row per
  invoice line (not per product), quantity defaulting to the line's invoice quantity, clamped
  1–200 per line and summed against the 1000 total with Print disabled and a red note past the
  cap. Lines whose product lacks a printable barcode are omitted and counted via the same
  `isPrintableBarcode` predicate the backend runs, so the "N skipped" note can never disagree with
  what the PDF contains. Confirms → downloads `labels-<invoice reference>.pdf`.
- **`pages/admin/supplier-invoices/AdminSupplierInvoiceEditor.tsx`** — new **Print barcodes**
  header button, shown on every saved invoice regardless of status (a sibling of, not nested
  inside, the existing DRAFT-status guard around *Record payment*); renders `BarcodeLabelsDialog`
  keyed per invoice, same convention as the existing `SupplierPaymentDialog`.
- **`config/translations.json`** — 19 new keys: 2 under `common.errors.sentinel.*`
  (`barcodeLabelsEmpty`, `barcodeLabelTotalExceeded`), 2 under `admin.productsList.printLabels.*`
  (`generating`, `tooMany`), 13 under `admin.supplierInvoices.printLabels.*`, plus 2 pre-existing
  keys reused as documented (`admin.productsAdd.autoGenerateBarcode`, `common.actions.cancel` were
  already reused by S19 and needed no change here).

**Not touched, per decision §0.6:** `Apps/api/src/modules/purchasing/**` and
`Apps/contract/src/modules/purchasing/**` — the supplier-invoice dialog gets barcodes from catalog's
own new endpoints, not from any purchasing DTO change.

## Deviations from the plan

None in the final code. The only difference from the plan's exact sequence is the two-step F1 fix
described above (a scoped `:has()` hotfix landed before this set's full execution, then was
superseded by the plan's outright deletion once E1 removed the last thing that depended on it) —
the end state matches the plan exactly, `index.css` has no barcode-print rule of any kind.

## Validation gate (no test file read, edited, or run)

| Package | `tsc --noEmit` | `lint` |
|---|---|---|
| `Apps/contract` | clean | clean |
| `Apps/api` | `src/**` clean (zero `error TS` lines outside `test/**`) | 8 pre-existing errors, none in a touched file (`prisma/seed.ts`, `validate-request.middleware.ts`, `orders.service.ts`, and the documented `PRODUCT_UPLOAD_DIR`-unused in `catalog.routes.ts`) — confirmed none reference `barcode`/`pdf.utils`/`bwip` |
| `Apps/web` | `tsc --noEmit` (app) clean; `tsc --noEmit -p tsconfig.test.json` — 41 pre-existing error lines, all in `tests/**` for unrelated modules (orders/sales/billing/clients/repairs/pos-clients/settings/inventory fixture drift), confirmed zero mention `barcode` or `catalog` | Every file touched or created this set lints clean (`query-keys.ts`, `catalog.service.ts`, `useCatalogProducts.ts`, `query-client.ts`, `barcode-label-dialog.tsx`, `barcode-label.tsx`, `barcode-labels-dialog.tsx`, `AdminSupplierInvoiceEditor.tsx`). Full-repo `eslint .` still surfaces ~3.4k pre-existing `prettier/prettier` findings in untouched files (documented baseline); the one hit for the literal string "barcode" traced to a pre-existing unrelated file (`hooks/use-loading-states.ts`), not anything this set touched. |

Additionally, `renderBarcodeLabelsPdf` was smoke-tested directly (via `tsx` against the real
`pdf.utils.ts`, not a standalone prototype) and the output PDF was rasterised and visually checked:
correct label count per product, correct order, correct 4-column tiling.

No test file was read, edited, or run.

## Manual verification checklist (browser)

Reproduced from the plan's manual verification section for the reviewer's convenience.

**Product page — labels are now a PDF** (`/admin/products`, as ADMIN)

1. Click the printer icon on a product **with** a barcode → the dialog opens unchanged: one label
   preview (bars + the 9 characters), and **Number of labels** pre-filled with the product's
   on-hand quantity.
2. Set the quantity to `3` and click **Print** → the button reads "Generating…", then a file
   **`labels-<barcode>.pdf` downloads** and the dialog closes.
3. Open the PDF → **exactly 3 labels**, tiled left-to-right from the top-left, each a Code 128
   symbol with its 9 characters underneath, black on white.
4. Set the quantity to `40` → the PDF is **exactly one full A4 page**, 4 columns × 10 rows.
5. Set it to `41` → **two pages**, the second holding one label.
6. Set it to `9999` → the input clamps to `200`. Clear the field → it falls back to `1`.
7. A product with **0 on hand** → the quantity pre-fills to `1`, and printing yields one label.
8. The printer icon on a product **with no barcode** is still disabled with the tooltip "This
   product has no barcode yet".

**Supplier invoice — print all labels for a receipt** (`/admin/supplier-invoices/<id>`)

9. Open any **CONFIRMED** invoice with several product lines → a **Print barcodes** button sits in
   the header beside *Record payment*.
10. Open a **DRAFT** invoice (or one that is CANCELLED) → **Print barcodes is still there**, even
    though *Record payment* is not.
11. Click it → the dialog lists **one row per invoice line**: product name, its barcode, and a
    **Labels** input **pre-filled with that line's invoice quantity**.
12. Clear one line's product barcode on `/admin/products/<id>` first, then reopen the dialog →
    that row is **absent**, and a note reads "1 line(s) skipped — those products have no barcode
    yet." The running total below matches the sum of the remaining inputs.
13. Confirm → **`labels-<invoice reference>.pdf`** downloads, labels in **invoice-line order**
    with the requested count per line.
14. Edit one line's count to `1`, confirm again → the PDF has 1 label for that product and the
    others unchanged.
15. Set counts summing above **1000** → the red note "Reduce the quantities…" appears and
    **Print is disabled**; no request is sent.
16. Open the dialog on an **amount-only** invoice (no product lines) → it reads "No line on this
    invoice has a printable barcode." and Print is disabled.
17. Clear the barcode on **every** product of one invoice → the dialog shows the same empty note,
    and Print stays disabled.

**Both entry points produce the same label**

18. Print one label for product *X* from the products list, and print *X*'s line from a supplier
    invoice that contains it → the two PDFs' labels are **visually identical**.
19. **Scan a printed label** with the POS barcode scanner (`/staff/pos`, F2), or type the value
    into the products search → the correct product is found. **Do this on a physically printed
    sheet, not on screen.**

**Regression — printing elsewhere in the app is repaired (finding F1)**

20. Go to `/staff/pos`, ring up a sale, and click **Print** on the receipt → the browser print
    preview shows the **receipt**, not a blank page.
21. Same check on `/staff/sales` → *Reprint* on a sale, and on `/staff/invoices` → *Print* on an
    invoice: both show content, not a blank page.
22. Press `Ctrl+P` on `/admin/products` with no dialog open → the page itself prints, as any page
    should.

**Permissions**

23. Log in as a **STAFF** user holding the products page → `/staff/products` is unchanged: no
    actions column, no print action. The two new endpoints answer **403** to a staff token.
