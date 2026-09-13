# Report — Set 27: Thermal printing — 80 mm POS receipt & barcode labels

Executed against `Docs/Stage-04-Fixes/plans/plan-S27-thermal-receipt-and-labels.md` on
`version-1-3`, 2026-09-13. Depends on S26.1 (landed).

## Note on the plan's own §0 — three brief premises were already stale

The plan flagged this before execution began, and it held: S25 had already built the 80mm print
mechanism (`lib/print.ts`, the `@page` injection, `.receipt-print-root`). The two claims in the
original set brief ("@page still defaults to A4", "content carries an inherited max-width") were
false against the code as it stood. The real physical gaps were that `html`/`body` were not
constrained to the roll width and the receipt was regular-weight 11px — both fixed in §5.2 below.
S27 also **supersedes** S25's recorded decision to omit the receipt's column headers (report-S25
explicitly deleted those keys as dead); they are back, with real headers this time.

## What changed

### Contract (`Apps/contract`)

- **`sales.dtos.ts`** — `ReceiptResponseSchema` gained `subtotal`, `discountAmount`,
  `posClientName?`, `staffName`, `soldAt?`. `total`/`previousCredit`/`grandTotal`/`totalPaid`/
  `newCredit` are unchanged in both position and meaning — `total` still means `Sale.totalAmount`
  (`subtotal − discountAmount`), not repurposed.
- **`catalog.routes.ts`** — deleted `BARCODE_LABELS`. Kept `BARCODE_LOOKUP` (still used by the
  supplier-invoice dialog) and rewrote the shared comment above it.
- **`catalog.command.ts`** — deleted `BarcodeLabelSheetSchema`/`BarcodeLabelSheetCommand` in full.
  Kept `BarcodeLookupSchema`. Trimmed the constants import to only `BARCODE_LOOKUP_MAX_IDS`.
- **`catalog.constants.ts`** — deleted `BARCODE_LABEL_SHEET_MAX_ITEMS` and the
  `CATALOG_ERROR.BARCODE_LABELS_EMPTY` / `BARCODE_LABEL_TOTAL_EXCEEDED` sentinels (both were raised
  only by the deleted route). Kept `BARCODE_LABEL_MAX_QUANTITY`, `BARCODE_LABEL_SHEET_MAX_TOTAL`,
  `BARCODE_LABEL_TEXT_MAX`, `BARCODE_LOOKUP_MAX_IDS` — all still consumed client-side — and rewrote
  their comments: they now bound one **browser** print run, not a server PDF.

### Backend (`Apps/api`)

- **`sales.mapper.ts`** — `toReceiptDto` fills the five new fields from `SaleRow`, which already
  carries `posClient.name` and `staff.firstName/lastName` — **no new Prisma query**.
- **Deleted the whole label-PDF surface**, in dependency order:
  - `catalog.routes.ts` — removed the `BARCODE_LABELS` route registration and its
    `BarcodeLabelSheetSchema` import.
  - `catalog.controller.ts` — removed `renderBarcodeLabels`. Its only caller of the private
    `streamPdf` helper is now gone, so **`streamPdf` was deleted too** (confirmed by grep: no
    other handler in this controller called it). Removed the now-unused `PdfResult`/
    `BarcodeLabelSheetCommand` imports.
  - `catalog.interface.ts` — removed `renderBarcodeLabels` from `ICatalogProductService` and the
    `PdfResult` type itself (its only two usages were this method and the controller above).
  - `catalog.service.ts` — removed the `renderBarcodeLabels` method and the
    `renderBarcodeLabelsPdf` import. Kept `isPrintableBarcode` and `lookupBarcodes` (the
    supplier-invoice dialog still depends on the lookup) and updated `isPrintableBarcode`'s
    comment, which referenced the deleted PDF renderer.
  - **`pdf.utils.ts`** — deleted the entire S22/S26 label section (195 lines: `bwip-js` import,
    every `LABEL_*`/`STORE_*`/`QUIET_ZONE_MODULES` constant, `BarcodeLabelRequest`, `fitText`,
    `barcodeModules`, `drawBarcodeLabel`, `renderBarcodeLabelsPdf`) along with the `MM` constant,
    which had no other consumer. `renderInvoicePdf` and `renderTablePdf` are untouched.
- **`package.json`** — removed `bwip-js` (grep confirmed zero remaining consumers in `src/` or
  `test/`) and ran `npm install` to drop it from the lockfile/`node_modules`.

### Web — print infrastructure (`Apps/web`)

- **`lib/print.ts`** — generalised from a single `printReceipt()` into a shared `printScoped(css,
  bodyClass)` engine with two exports: `printReceipt()` (unchanged behaviour) and the new
  `printLabelSheet(widthMm, heightMm)`. The proven S25 sequence (teardown-first, `afterprint` +
  60s safety net, no synchronous teardown after `window.print()`) is preserved verbatim for both.
- **`index.css`** — receipt block: added `body.printing-receipt, html:has(body.printing-receipt) {
  width: 80mm }` (the real fix for the brief's "narrow block on a full-width sheet" symptom);
  padding 3mm → 4mm (72mm printable width); font-size 11px → 12px plus `font-weight: 700`; added
  `print-color-adjust: exact` and a `* { color: #000 !important; background: transparent
  !important; box-shadow: none !important }` rule so no leaked Tailwind utility can print faint or
  grey. New label block: `.label-print-root` + a `body.printing-labels`-gated `@media print` rule,
  structurally identical to the receipt's (`display:none` at rest, `visibility` for masking,
  `display:block` on the root — both properties load-bearing for the same reason documented on the
  receipt rule), plus `break-after: page` on every `.label-page` except the last so a continuous
  roll never wastes a trailing blank label. **This gating is the direct mitigation for S22 finding
  F1** (an ungated label print rule once broke every other print in the app) — called out in both
  the CSS comment and the component comment below.

### Web — barcode labels: PDF → browser print

- **New `types/label-print.types.ts`** — `LabelSize`, `LABEL_SIZE_PRESETS` (50×25 first/default,
  40×30, 50×30 — 50×25 is the default per S26's "40×25 stock is now invalid" finding),
  `LABEL_CUSTOM_MIN_MM`/`MAX_MM` (15/150), and the geometry constants rescued from the deleted
  `pdf.utils.ts` before it was deleted: `LABEL_PADDING_MM` (1), `LABEL_STORE_COLUMN_MM` (6),
  `LABEL_STORE_GAP_MM` (0.5), `QUIET_ZONE_MODULES` (10), `BARCODE_MIN_MODULE_MM` (0.25 scanning
  floor), `LABEL_SIZE_STORAGE_KEY`.
- **New `lib/barcode-svg.ts`** — `renderBarcodeSvg(value)`: renders one Code 128 symbol via
  JsBarcode into a detached `<svg>` (never mounted), returns the markup string plus its total
  module count (bars + both quiet zones). `margin: QUIET_ZONE_MODULES * width` supplies the quiet
  zone JsBarcode does not add by default.
- **New `components/shared/barcode-label-sheet.tsx`** — `<BarcodeLabelSheet items storeName size>`,
  the shared printable root for both dialogs. Renders each **distinct** barcode's SVG once
  (memoised) and repeats the markup string across `quantity` copies — avoids mounting up to 1000
  live JsBarcode instances for a full-size run. Structurally mirrors `barcode-label.tsx`'s existing
  preview (rotated store column + rule + caption + symbol). Renders nothing on screen; gated by
  `.label-print-root`'s CSS.
- **New `components/shared/label-size-field.tsx`** — the shared size control: a preset `Select`
  (three sizes) plus a `custom` option revealing clamped width/height number inputs, and a
  warn-only (never disables Print) note when `moduleMm` falls under the 0.25mm scanning floor.
- **New `hooks/use-label-size.ts`** — `useLabelSize()`, localStorage-backed (`dt_label_size`),
  same try/catch-around-read shape as the existing `use-search.ts` precedent, validated on read
  against the custom-size bounds so corrupted storage falls back to the 50×25 default rather than
  crashing the dialog.
- **`barcode-label-dialog.tsx`** (products page) and **`barcode-labels-dialog.tsx`** (supplier
  invoices) — both rewritten to the same pattern: dropped `usePrintBarcodeLabels`/`downloadBlob`;
  added the `<LabelSizeField>` beside the existing quantity input(s); render `<BarcodeLabelSheet>`
  as a **sibling of `<Dialog>`**, not nested in `<DialogContent>` (a Radix portal/transform would
  become the print rule's containing block and clip it — the same trap S25 documented for
  `<RepairReceipt>`); `handlePrint` now just calls `printLabelSheet(size.widthMm, size.heightMm)`.
  Supplier-invoice dialog additionally computes `moduleMm` from the **narrowest** barcode area
  across the whole run (the densest label in the batch), since one size applies to every label in
  a print. Everything else the set said to keep — per-line editable quantities defaulting to
  invoice quantity, the shared store-name field, the skipped-count note, the
  `BARCODE_LABEL_SHEET_MAX_TOTAL` guard disabling Print — is untouched.
- **`barcode-label.tsx`** — preview component body untouched; header comment rewritten to state
  the printed label is now rendered client-side too (via the same JsBarcode library, through
  `barcode-svg.ts`), and that the preview's `margin: 0` (no quiet zone) is a deliberate, permanent
  difference from the printed label — not a bug to fix later.
- **Deleted dead client code**: `services/catalog.service.ts`'s `renderBarcodeLabels` function,
  `hooks/useCatalogProducts.ts`'s `usePrintBarcodeLabels` hook, and the two
  `BARCODE_LABELS_EMPTY`/`BARCODE_LABEL_TOTAL_EXCEEDED` entries in `lib/query-client.ts`'s
  `SENTINEL_TRANSLATION_KEYS`. `useBarcodeLookup` and `lookupBarcodes` (web) are untouched.

### Web — POS receipt rebuild

- **`StaffPos.tsx`** — passes `subtotal`, `discountAmount`, `posClientName`, `staffName` through to
  `<PosReceiptView>`; `issuedAt` now prefers `receipt.soldAt` (the server's confirm-time stamp)
  over the client-side `receiptAt` fallback.
- **`PosReceiptView.tsx`** — **the on-screen card is byte-for-byte unchanged** (same markup, same
  classes, same five money rows) per the plan's explicit instruction. Only the print-only subtree
  was rebuilt into the set's nine sections:
  1. print logo (`store.printLogoUrl ?? store.logoUrl` — owner decision D3)
  2. store block: name, activity line, address, then **Repair:**/**Sales:** labelled numbers, each
     falling back to `store.phone` when its own field is unset (S26.1's recorded Q2 fallback — if
     neither is set, both labels print the same number, a deliberate self-explanatory prompt)
  3. dashed separator
  4. a real `<table>` with four column headers (Item/Qty/Unit/Total); the label cell wraps via
     `overflow-wrap: anywhere` while the three figure cells use `vertical-align: top` so they stay
     on the row's first line — this is the fix for the brief's headline complaint ("a long product
     name is simply cut")
  5. item summary (distinct article count, total quantity — computed client-side, no contract
     change)
  6. money block, **always three rows** (subtotal / discount / amount payable) per owner decision
     D1 — contrasted deliberately with the credit block below, which the brief asks to hide
     entirely for a walk-in sale
  7. credit block, gated on `posClientName != null` (owner decision D2 — one field gates both this
     and the client-name line)
  8. client name line, same gate
  9. footer: reference, date/time, **cashier's name** — still explicitly no barcode.
- **`RepairReceipt.tsx`** — **logo swap only** (owner decision D4): `store.logoUrl` →
  `store.printLogoUrl ?? store.logoUrl`. Nothing else was touched — it still prints the single
  general `store.phone` with no activity line, which is a recorded, deliberate remaining
  inconsistency with the POS receipt (the brief's structure list names only "The POS receipt").

### Translations

Added 14 keys under `staff.pos.receipt.*` (four column headers, article/quantity summary,
subtotal/discount/amountPayable/purchaseTotal, client, cashier, repairPhone, salesPhone) and 6
under `admin.labelSize.*` (label, custom, width, height, helper, tooNarrow). Deleted 3 keys whose
only call sites are gone: `admin.productsList.printLabels.generating`,
`common.errors.sentinel.barcodeLabelsEmpty`, `common.errors.sentinel.barcodeLabelTotalExceeded`.
Verified via a JSON parse pass that every added key exists and every deleted key has zero
remaining `t(...)` call sites.

## Notes the plan asked to be recorded explicitly

- **`streamPdf`/`PdfResult` did not survive** the deletions — both had exactly one caller
  (`renderBarcodeLabels`), confirmed by grep before removing them.
- **`bwip-js` removal** — confirmed zero remaining references anywhere under `Apps/api/src` or
  `Apps/api/test` before removing it from `package.json` and reinstalling.
- **Barcode resolution is now client-side for the print step** (the accepted consequence §6.7
  flagged): the products dialog prints `product.barcode` from the already-loaded row, and the
  supplier-invoice dialog prints whatever `useBarcodeLookup` last returned. Both are re-fetched
  each time a dialog opens, so the staleness window is small, but a barcode changed by another
  admin in the seconds between opening the dialog and pressing Print would no longer be re-read at
  print time the way the deleted server route did.
- **Dialog-close-vs-print ordering (§6.6 step 3)** — resolved by **not auto-closing either dialog
  after Print**. `window.print()` is not reliably blocking across browsers, and in both call sites
  closing the dialog nulls out the parent's selected-row/invoice state (`AdminProducts.tsx`'s
  `labelProduct`, `AdminSupplierInvoices.tsx`'s `labelsInvoice`), which would unmount the
  `<BarcodeLabelSheet>` sibling immediately — a race that could print a blank page if
  `window.print()` returns before the browser has actually opened the system dialog. Both dialogs
  now stay open after Print; the admin closes them manually via the existing Cancel button, exactly
  as they already could before pressing Print.
- **`RepairReceipt` deliberately received only the logo swap** and its header still differs from
  the rebuilt POS receipt (no activity line, one phone number, no cashier line) — this is expected,
  not a follow-up bug.

## Validation performed

Per the hard rule, **no test suite was run and no test file was touched.**

```
Apps/contract:  npx tsc --noEmit   → 0 errors
Apps/contract:  npm run lint       → 0 errors
Apps/api:       npx tsc --noEmit (src/**) → 0 errors
                (184 pre-existing errors remain under test/** — identical count to the S26.1
                 baseline, confirmed unrelated to this set, not fixed per "do not modify tests")
Apps/api:       npm run lint       → 0 errors in every file this set touched; the same 7
                pre-existing errors as the S26.1 baseline remain in prisma/seed.ts,
                validate-request.middleware.ts and orders.service.ts — none of which this set
                modified
Apps/web:       npx tsc --noEmit   → 0 errors
Apps/web:       npm run lint (every file this set added or edited) → 0 errors after one
                eslint --fix pass on five files' prettier formatting (barcode-label-sheet.tsx,
                label-size-field.tsx, useCatalogProducts.ts, both barcode-label(s)-dialog.tsx)
```

Grep-verified: no remaining reference to `BARCODE_LABELS`, `renderBarcodeLabels`,
`usePrintBarcodeLabels`, `BarcodeLabelSheetCommand/Schema`, or `bwip` anywhere in `Apps/` outside
historical comments; every new `t("…")` key resolves in `translations.json`; every deleted key has
zero remaining call sites.

## Manual verification checklist

**Print previews are not sufficient for this set — print both artefacts on the real thermal and
label hardware.** A browser preview will not reveal faint bars, a misfed roll, or a scaled/clipped
page.

### POS receipt — on screen
1. `/staff/pos` → build a ticket with three products, one with a deliberately long name (e.g.
   "AFFICHEUR ACE BUZZ 6 PRIME • BUZZ 7 LITE • BUZZ 7 PRIME"), confirm the sale.
2. The on-screen receipt card is unchanged — same five money rows, same lines list, same two
   buttons.

### POS receipt — print preview
3. Click **Print** → the preview is a narrow single-column receipt, ~80mm, no A4 whitespace to the
   right, no horizontal clipping.
4. The print logo appears centred at the top. Clear it in Settings → Store and reprint → the colour
   store logo appears instead; with neither set, the header starts at the store name.
5. Under the name: activity line, address, then **Repair:**/**Sales:** numbers. Set only one of the
   two in Settings and reprint → the other falls back to the general phone.
6. The items table has four column headers (Item / Qty / Unit / Total).
7. **The long product name wraps onto as many lines as it needs**, and its quantity, unit price and
   line total stay right-aligned on the first line of that row, with nothing cut off at the right
   edge.
8. Below the table: number of articles and total quantity.
9. Money block shows three rows — Total, Discount (0), Amount payable — all three present even
   with a zero discount.
10. Footer shows the sale reference, the date and time, and the cashier's name. No barcode
    anywhere.

### POS receipt — the credit block
11. Walk-in sale (no POS client) → the credit block is absent entirely, and so is the client-name
    line. No zero rows.
12. Sale with a POS client attached, paying less than the total → credit block appears with
    previous credit, purchase total, amount paid, new credit; the client's name prints above the
    footer. Figures match the on-screen card.

### POS receipt — on the real thermal printer
13. Print to the actual 80mm thermal printer. Text is dark and legible, not grey.
14. Content fits the roll with no right-hand truncation; the roll cuts cleanly at the end of the
    content.
15. A one-line receipt and a fifteen-line receipt both print completely — no forced page break
    mid-receipt.

### Barcode labels — products page
16. `/admin/products` → a product with a barcode → Print labels.
17. Dialog shows the preview, store name, caption, quantity, and the new Label size field
    defaulting to 50 × 25mm.
18. Choose Custom, enter 30×20 → a warning appears that the bars fall below 0.25mm; Print stays
    enabled.
19. Set size back to 50×25, quantity 3, click Print → the print dialog opens directly. No PDF is
    downloaded and no file-save prompt appears.
20. The preview shows 3 pages, one label per page — not tiled on one sheet.
21. Each label shows the vertical store name, the caption above the bars, the Code 128 symbol and
    its digits, with visible white margin either side of the bars.
22. Close the dialog, reopen it → size field still reads 50×25mm. Reload the page and reopen →
    still remembered.

### Barcode labels — supplier invoices
23. `/admin/supplier-invoices` → open any invoice → Print barcodes.
24. Rows default to each line's invoice quantity and are editable; the size field shows the value
    remembered from step 22.
25. An invoice with a line whose product has no barcode still shows the "N line(s) skipped" note.
26. Push quantities past 1000 → the red over-limit note appears and Print is disabled.
27. Print → print dialog opens directly, one label per page, in invoice-line order.

### Barcode labels — on the real label printer
28. Load 50×25mm stock and print for real. Each label lands centred on its own physical label with
    no misfeed and no creep across the run.
29. Scan the printed barcode with the handheld reader — reads first time. Scan one from a 10-label
    run to confirm the last is as good as the first.
30. Print a run at 50×30 on matching stock → still one per label, still scans.

### Print-scoping regressions — S22 finding F1
31. `/staff/sales` → Reprint on a sale → prints the whole A4 page, unchanged.
32. `/staff/invoices` → Print → whole A4 page, unchanged.
33. `Ctrl+P` on `/admin/products` with the label dialog open → normal A4 page; no labels leak in.
34. `Ctrl+P` on `/staff/pos` with a receipt on screen → normal A4 page, no 80mm receipt.
35. Print a receipt, close the dialog, then immediately `Ctrl+P` on the same page → A4, proving
    teardown ran.
36. Print labels, then print a POS receipt without reloading → receipt comes out at 80mm, not the
    label size. Print labels again → back to the label size.

### Repair slip
37. `/staff/repairs` → open a ticket → Print receipt → uses the print logo and is
    darker/bolder than before (shares the receipt CSS). Everything else is unchanged — single store
    phone, no activity line.
38. With the repair sheet open, `Ctrl+P` → normal A4 page, no receipt.

### Language
39. Switch to FR and repeat steps 3 and 19 → every printed label and dialog string is French,
    including the new column headers, money-block labels, "Caissier", and the label-size field. No
    raw key, no English leak.

---

The owner reviews and approves before **S28** (inventory: pagination, adjustment, PDF wrapping)
begins.
