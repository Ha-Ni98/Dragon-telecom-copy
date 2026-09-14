# Plan — Set S27: Thermal printing — 80 mm POS receipt & barcode labels

Target branch: `version-1-3`. Source set: `Docs/Stage-04-Fixes/sets-26-29.md` §S27.

**Sets that must land first:** **S26.1** — landed and reported
(`Docs/Stage-04-Fixes/results/report-S26-1.md`). This set consumes `store.printLogoUrl`,
`store.activityLine`, `store.repairPhone` and `store.salesPhone`, all added there. Do not start
until S26.1 is approved.

**Scope note:** S28 and S29 are independent of this set; nothing here touches inventory,
statistics or the POS layout.

---

## 0. Read this first — three premises in the set brief are out of date

The brief was written before S25/S26 landed. Two of its claims are no longer true, and one of its
requirements reverses a decision S25 recorded deliberately. The executor must not "fix" things
that are already correct, and must not be confused by a comment that contradicts the new work.

| Brief says | Actual state | What this plan does |
|---|---|---|
| "`@page` is still defaulting to A4/Letter" | **False.** `Apps/web/src/lib/print.ts` already injects `@page { size: 80mm auto; margin: 0; }` for the duration of one receipt print (S25). | Keep the mechanism. Generalise it so a second page size (labels) can use it. |
| "the content carries an inherited max-width" | **False.** `.receipt-print-root` is `position: absolute` with `width: 80mm`, so no ancestor box applies. Grep found no `max-width` on `body`/`#root`. | The real gap is that `html, body` keep their full viewport width while `@page` is 80 mm. §4.2 adds `html, body { width: 80mm }` under the gated rule — that part of the brief is correct and is genuinely missing. |
| "Items table **with column headers**" | S25 **deliberately omitted** the header row and deleted the `staff.pos.receipt.item*` keys as dead (report-S25 §"Deviations", lines 133–134). | S27 supersedes that decision. §8 re-adds the keys. Note it in the report so the S25 rationale is not read as still binding. |

What **is** genuinely wrong today and is this set's real work:
- The receipt is **not bold** and is 11 px — thermal heads render thin glyphs faintly.
- `html, body` are not constrained to the roll width.
- Content is missing: no column headers, no activity line, no repair/sales phones, no item
  summary, no discount, no client name, no cashier name, and it prints the **colour** logo rather
  than S26.1's monochrome print logo.
- Long product names are **not** wrapped with right-aligned figures held on the first line.
- Labels are a **server-side PDF download**, not a print dialog.

---

## 1. Facts established by reading the code — do not re-derive these

### 1.1 The existing print mechanism (S25) — keep and generalise, do not replace

`Apps/web/src/lib/print.ts` exports `RECEIPT_ROOT_CLASS = "receipt-print-root"` and
`printReceipt()`. `printReceipt()`:
1. tears down any previous print state (idempotent — safe on a double-clicked button);
2. appends a `<style id="receipt-page-style">` containing `@page { size: 80mm auto; margin: 0; }`
   — **`@page` is a document-level at-rule and cannot be scoped by a class or `:has()`**, which is
   why it is injected and removed rather than living in `index.css`;
3. adds `body.printing-receipt`;
4. registers a one-shot `afterprint` teardown **plus a 60 s `setTimeout` safety net**, because
   `afterprint` is not fired by every browser/driver combination;
5. calls `window.print()`. It deliberately does **not** tear down synchronously afterwards —
   `window.print()` is not reliably blocking, and early teardown yields a blank or A4 page.

`Apps/web/src/index.css` carries the matching `@media print` block, **entirely gated on
`body.printing-receipt`**:
- `.receipt-print-root { display: none }` unconditionally (on screen and during any *other* print);
- inside `@media print`, `body.printing-receipt *  { visibility: hidden }`, then the root and its
  descendants back to `visible`, and the root itself to `display: block` — **both properties are
  load-bearing**: `visibility: visible` alone cannot reveal a `display: none` element, and S25's
  plan had this wrong and would have printed a blank page.
- the root then gets `position: absolute; inset: 0 auto auto 0; width: 80mm; padding: 3mm;
  color: #000; background: #fff; font-family: ui-monospace, "Courier New", monospace;
  font-size: 11px; line-height: 1.35`.

> **S22 finding F1 — the reason every rule above is gated.** S19's label print used an *ungated*
> `@media print` rule keyed on `#barcode-print-root`. It leaked into every other print in the app
> and broke POS/sales/invoice printing (blank pages). The fix was to scope it, and when S22 moved
> labels to a PDF the rule was deleted outright. **The new label print path in §6 reintroduces a
> print root, so it MUST be gated on its own body class exactly like the receipt is.** This is the
> single highest-risk regression in this set.

**Two components already declare `RECEIPT_ROOT_CLASS`:** `PosReceiptView.tsx` and
`RepairReceipt.tsx`. They live on different routes and are never mounted together. Any change to
the shared `.receipt-print-root` CSS therefore changes the repair claim slip too — intended (same
physical printer), but it must be verified, not assumed.

### 1.2 The receipt's data — what exists and what is missing

`ReceiptDto` (`Apps/contract/src/modules/sales/sales.dtos.ts`) currently carries exactly:
`reference`, `lines[{ productName, quantity, unitPrice, lineTotal, serialNumbers? }]`, `total`,
`previousCredit`, `grandTotal`, `totalPaid`, `newCredit`.

It is produced by **one** function, `SalesMapper.toReceiptDto(sale: SaleRow)`
(`Apps/api/src/modules/sales/sales.mapper.ts:95`), returned by `SalesService.confirm()`.

`SaleRow` **already includes everything the new fields need** — no new Prisma query, no new
`include`:
```ts
export type SaleRow = Sale & {
  posClient: Pick<PosClient, 'name'> | null;
  staff: Pick<Staff, 'firstName' | 'lastName'>;
  lines: SaleLine[];
};
```

**Money semantics — verified against `sales.service.ts:133-134`, do not guess:**
```ts
const subtotal    = Σ line.lineTotal;          // before discount
const totalAmount = subtotal - discountAmount; // what the customer pays
```
and `ReceiptDto.total` is **`totalAmount`** (the net payable), while
`grandTotal = total + previousCredit`.

So the set's money block maps as:

| Set's label | Value | Field |
|---|---|---|
| total | Σ line totals, **before** discount | `Sale.subtotal` → **new** `ReceiptDto.subtotal` |
| discount | the column kept at 0 | `Sale.discountAmount` → **new** `ReceiptDto.discountAmount` |
| amount payable | `subtotal − discount` | `Sale.totalAmount` → **existing** `ReceiptDto.total` |

and the set's credit block "purchase total" is the **same** `ReceiptDto.total`.

> **Do not repurpose `ReceiptDto.total`.** It already means `totalAmount` and the on-screen POS
> card renders it as "Total". The two new fields are strictly additive.

Missing for the new layout, all derivable from `SaleRow` with no new query:
`subtotal`, `discountAmount`, `posClientName?`, `staffName`, `soldAt?`.

`Sale.soldAt` is set at confirmation. The frontend currently stamps its own
`receiptAt = new Date().toISOString()` at confirm-success (`StaffPos.tsx:336`); the server value is
the honest one and should be preferred, with the client value kept as the fallback.

### 1.3 The label pipeline as it stands (S19 → S22 → S26)

- **Contract:** `CATALOG_ROUTES.BARCODE_LOOKUP` and `CATALOG_ROUTES.BARCODE_LABELS` (both POST);
  `BarcodeLookupSchema`, `BarcodeLabelSheetSchema`; constants `BARCODE_LABEL_MAX_QUANTITY` (200),
  `BARCODE_LABEL_SHEET_MAX_ITEMS` (100), `BARCODE_LABEL_SHEET_MAX_TOTAL` (1000),
  `BARCODE_LOOKUP_MAX_IDS` (200), `BARCODE_LABEL_TEXT_MAX` (60); sentinels
  `BARCODE_LABELS_EMPTY`, `BARCODE_LABEL_TOTAL_EXCEEDED`.
- **API:** `catalog.controller.renderBarcodeLabels` → `catalog.service.renderBarcodeLabels`
  (resolves barcodes server-side so a barcode edited since the dialog opened prints as it is *now*;
  drops unprintable products with the same `isPrintableBarcode` predicate `lookupBarcodes` uses;
  preserves `items` order) → `pdf.utils.renderBarcodeLabelsPdf` (PDFKit + `bwip-js`).
- **Web:** `catalogService.renderBarcodeLabels` → `usePrintBarcodeLabels` → both dialogs call
  `downloadBlob(...)` on success.
- **`bwip-js` has exactly one consumer** — `barcodeModules()` in `pdf.utils.ts`, called only by
  `drawBarcodeLabel`, called only by `renderBarcodeLabelsPdf`. Removing the label PDF orphans the
  dependency.
- **No test file references `BARCODE_LABELS`, `renderBarcodeLabels`, `usePrintBarcodeLabels`,
  `BarcodeLabelDialog`, `BarcodeLabelsDialog`, `PosReceiptView` or `printReceipt`** — verified by
  grep across `Apps/api/test/**` and `Apps/web/tests/**`. The deletions in §3 break no test.

**S26 label geometry (`pdf.utils.ts`), the numbers the HTML version must preserve:**
- label 50 × 25 mm, 1 mm padding, **6 mm** store column, **0.5 mm** separator gap, ~41 mm barcode
  area; store name rotated −90° (bottom-to-top), a 1 px vertical rule, caption above the bars,
  digits below.
- **`QUIET_ZONE_MODULES = 10` per side** — Code 128 requires it and `bwipjs.raw()` does **not**
  include it, so S22 added it to the module budget explicitly.
- **0.25 mm per module is the recorded scanning floor.** S26 widened the label 40 → 50 mm
  specifically to stay above it (0.287 mm at 50 mm). S26's report opens with a ⚠️ that
  **40 × 25 mm stock is now invalid** — so **50 × 25 mm is the owner's current stock and must be
  the default preset.**

`Apps/web/src/pages/admin/products/components/barcode-label.tsx` is the on-screen **preview**: it
calls `JsBarcode(svgRef.current, value, { format: "CODE128", displayValue: true, fontSize: 14,
height: 48, width: 2, margin: 0, textMargin: 2 })`. `jsbarcode@^3.12.3` is already a web dependency.
JsBarcode writes a `viewBox` onto the `<svg>`, which is what lets `w-full h-auto` scale the symbol
without distorting bar ratios — **this is the mechanism the printed label reuses.**

Note `margin: 0` in the preview: it has **no quiet zone**. The printed HTML label must set
`margin: QUIET_ZONE_MODULES * width` (see §6.2).

### 1.4 Dialog entry points

- Products page: `AdminProducts.tsx:241` renders `<BarcodeLabelDialog>`; the row action lives in
  `admin-products-table.tsx` and is already disabled for a product with no barcode.
- Supplier invoices: `AdminSupplierInvoiceEditor.tsx:390` and `AdminSupplierInvoices.tsx:54` both
  render `<BarcodeLabelsDialog>`.
- **There is no separate "download PDF" button on either page.** The PDF download is the
  `downloadBlob(...)` call *inside* each dialog's `onSuccess`. "Remove the PDF download from both
  pages" therefore means replacing those two call sites, not deleting page-level actions.
- `downloadBlob` itself has **six other consumers** (invoice PDFs, delivery-fee/stock/movement/
  statistics exports) — **keep the helper**, only drop these two uses.

### 1.5 Conventions to follow

- Translations are a **flat** map of dotted key → `{ en, fr, ar }` in
  `Apps/web/src/config/translations.json`; `ar` stays `""`.
- `formatDZD(amount, language)` and `formatDateTime(iso, language)` live in `@/lib/utils`.
- Business-rule sentinels travel as the error **message** and are mapped to translation keys in
  `lib/query-client.ts`'s `SENTINEL_TRANSLATION_KEYS`.
- localStorage precedent: `use-search.ts` (module-level `STORAGE_KEY` const, `try/catch` around
  reads). `lib/i18n.ts` uses the key `sv_lang`.

---

## 2. Owner decisions taken in this plan

Stated rather than asked — none changes the meaning of a stored money or stock figure.

| # | Decision | Why |
|---|---|---|
| **D1** | The money block prints **all three rows always** (total / discount / amount payable), even while discount is 0. | The set asks for conditional hiding **explicitly and only** for the credit block ("a walk-in sale hides the block entirely rather than printing zeroes"). The contrast is deliberate: the money block is a fixed three-row structure. |
| **D2** | The credit block and the client-name line are both gated on **`posClientName != null`** — one field serving both. | `PosClient.name` is non-nullable, so its presence in the DTO is exactly "a POS client is attached". Adding a second boolean would be two sources of truth for one condition. |
| **D3** | The receipt logo is **`printLogoUrl ?? logoUrl`**. | An owner who has not yet uploaded a print logo keeps today's header instead of losing it. The store name below is always text, so the header is never empty either way. |
| **D4** | `RepairReceipt.tsx` gets the **same one-line logo swap** and nothing else. | It prints to the same thermal head; leaving it on the colour logo would be an obvious inconsistency. Restructuring it (activity line, two phones) is **not** in this set — S27's structure list is explicitly "The POS receipt". Flag the remaining inconsistency in the report. |
| **D5** | The label keeps S26's **vertical store-name column and caption**. | The set says "Everything else already agreed stays" and "label content stays as established". Dropping them would silently undo S26, which the owner approved three weeks ago. |
| **D6** | Default label size is **50 × 25 mm**; presets are 40 × 30, 50 × 25, 50 × 30, plus custom. | S26's report states 40 × 25 stock is invalid and 50 × 25 is what the owner now buys. |
| **D7** | The numeric caps (`BARCODE_LABEL_MAX_QUANTITY`, `BARCODE_LABEL_SHEET_MAX_TOTAL`, `BARCODE_LABEL_TEXT_MAX`, `BARCODE_LOOKUP_MAX_IDS`) **stay in the contract**; only `BARCODE_LABEL_SHEET_MAX_ITEMS` and the sheet schema/sentinels are deleted. | `BARCODE_LOOKUP` remains a real shared route, so the module stays shared vocabulary. `SHEET_MAX_ITEMS` bounded the deleted request array and has no other consumer. |

---

## 3. Contract changes (`Apps/contract`)

### Action 3.1 — `src/modules/sales/sales.dtos.ts`: extend `ReceiptResponseSchema`

Add five fields. Keep every existing field and its meaning untouched.

```ts
export const ReceiptResponseSchema = z.object({
  reference: z.string(),
  lines: z.array(/* unchanged */),
  // S27 — the printed money block is "total / discount / amount payable". `subtotal` is Σ line
  // totals BEFORE discount and `discountAmount` is the deduction; `total` below is unchanged and
  // still means Sale.totalAmount (= subtotal - discountAmount), i.e. what the customer pays and
  // what the credit block calls the purchase total. Three separate figures, do not conflate them.
  subtotal: z.number(),
  discountAmount: z.number(),
  total: z.number(),
  previousCredit: z.number(),
  grandTotal: z.number(),
  totalPaid: z.number(),
  newCredit: z.number(),
  // S27 — absent for a walk-in sale. Its presence is the single condition for BOTH the printed
  // credit block and the printed client-name line (owner decision D2).
  posClientName: z.string().optional(),
  // S27 — the cashier, printed in the receipt footer.
  staffName: z.string(),
  // S27 — Sale.soldAt, set at confirmation. Optional because the column is nullable; the POS
  // falls back to its own confirm-time stamp.
  soldAt: z.iso.datetime().optional(),
});
```

### Action 3.2 — `src/modules/catalog/catalog.routes.ts`: drop the sheet route

Delete the `BARCODE_LABELS: '/admin/products/barcode-labels',` entry. **Keep `BARCODE_LOOKUP`.**
Rewrite the block comment above them (it currently describes both) so it explains only
`BARCODE_LOOKUP` and why it is a POST registered before `ADMIN_PRODUCT_BY_ID`.

### Action 3.3 — `src/modules/catalog/catalog.command.ts`: drop the sheet schema

Delete `BarcodeLabelSheetSchema` and `BarcodeLabelSheetCommand` in full, including their comment
block. **Keep `BarcodeLookupSchema`.** Remove `BARCODE_LABEL_SHEET_MAX_ITEMS`,
`BARCODE_LABEL_SHEET_MAX_TOTAL` and `CATALOG_ERROR` from this file's imports **only if** nothing
else in the file still uses them (grep before editing — `BARCODE_LABEL_TEXT_MAX` and
`BARCODE_LOOKUP_MAX_IDS` are still used by `BarcodeLookupSchema` and others).

### Action 3.4 — `src/modules/catalog/catalog.constants.ts`

- **Delete** `BARCODE_LABEL_SHEET_MAX_ITEMS` (its only consumer was the schema above).
- **Delete** `CATALOG_ERROR.BARCODE_LABELS_EMPTY` and `CATALOG_ERROR.BARCODE_LABEL_TOTAL_EXCEEDED`
  — both were raised only by the deleted route.
- **Keep** `BARCODE_LABEL_MAX_QUANTITY`, `BARCODE_LABEL_SHEET_MAX_TOTAL`, `BARCODE_LABEL_TEXT_MAX`,
  `BARCODE_LOOKUP_MAX_IDS`, and every `BARCODE_*` generation constant.
- **Rewrite the stale comments.** `BARCODE_LABEL_MAX_QUANTITY`'s comment says rendering moved
  server-side and the cap "bounds the work the API does per line"; `BARCODE_LABEL_SHEET_MAX_TOTAL`'s
  says "1000 labels is now 34 pages at 30 per page". Both are false after this set. Replace with:
  these now bound one **browser** print run — the number of `<svg>` elements the tab builds and the
  number of physical labels the roll feeds — and one label is one page, so N labels is N pages.

---

## 4. Backend (`Apps/api`)

### Action 4.1 — `src/modules/sales/sales.mapper.ts`: fill the five new fields

Inside `toReceiptDto`, add to the `dto` object (conditional spreads for the optional ones —
the api's tsconfig sets `exactOptionalPropertyTypes`, so `posClientName: undefined` does **not**
satisfy `posClientName?: string`):

```ts
subtotal: SalesMapper.toMoney(sale.subtotal),
discountAmount: SalesMapper.toMoney(sale.discountAmount),
// ... existing total / previousCredit / grandTotal / totalPaid / newCredit unchanged ...
...(sale.posClient?.name != null ? { posClientName: sale.posClient.name } : {}),
staffName: `${sale.staff.firstName} ${sale.staff.lastName}`,
...(sale.soldAt != null ? { soldAt: sale.soldAt.toISOString() } : {}),
```

Both relations are already on `SaleRow` — **no change to any Prisma query or `include`.**
`toSaleDto` already builds `staffName` the same way; keep the two identical.

Extend the method's existing comment: it says "no cost/profit fields exist on this schema at all".
Still true and still the point — add that `posClientName`/`staffName` are identity, not margin, and
that `subtotal`/`discountAmount` are the two figures the printed money block needs beside `total`.

### Action 4.2 — Delete the label PDF route

In dependency order:

1. `src/modules/catalog/catalog.routes.ts` — delete the `router.post(CATALOG_ROUTES.BARCODE_LABELS, ...)`
   block and the `BarcodeLabelSheetSchema` import. **Keep the `BARCODE_LOOKUP` route.** Update the
   S22 comment above them so it no longer claims two routes.
2. `src/modules/catalog/catalog.controller.ts` — delete the `renderBarcodeLabels` handler and the
   `BarcodeLabelSheetCommand` import. Leave `streamPdf` alone if any other handler uses it (grep;
   if `renderBarcodeLabels` was its only caller, delete `streamPdf` too and say so in the report).
3. `src/modules/catalog/catalog.interface.ts` — delete `renderBarcodeLabels` from
   `ICatalogProductService` and the `BarcodeLabelSheetCommand` import. Leave `PdfResult` if another
   member still returns it; delete it if not.
4. `src/modules/catalog/catalog.service.ts` — delete the whole `renderBarcodeLabels` method and the
   `renderBarcodeLabelsPdf` import. **Keep `isPrintableBarcode` and `lookupBarcodes`** — the
   supplier-invoice dialog still depends on the lookup. Drop the now-unused `CATALOG_ERROR` import
   member if `BARCODE_LABELS_EMPTY` was its last use in the file (grep — `BARCODE_TAKEN` is used by
   `createProduct`, so the import itself almost certainly stays).

### Action 4.3 — `src/common/utils/pdf.utils.ts`: delete the label half

Delete, in one pass: the `bwipjs` import, `BarcodeLabelRequest`, `barcodeModules`, `fitText`,
`drawBarcodeLabel`, `renderBarcodeLabelsPdf`, and every label-only constant
(`LABEL_WIDTH_MM`, `LABEL_HEIGHT_MM`, `SHEET_MARGIN_MM`, `LABEL_GUTTER_MM`, `LABEL_PADDING_MM`,
`STORE_COLUMN_WIDTH_MM`, `STORE_SEPARATOR_GAP_MM`, `TOP_TEXT_SIZE_PT`, `DIGITS_SIZE_PT`,
`STORE_TEXT_SIZE_PT`, `QUIET_ZONE_MODULES`, `BARCODE_AREA_WIDTH`, and the `MM` helper **only if**
`renderInvoicePdf`/`renderTablePdf` do not use it).

**Keep `renderInvoicePdf`, `renderTablePdf` and the shared `toBuffer`** — invoices and the S25/S28
exports depend on them.

Delete the large S19/S22/S26 comment block documenting the label geometry. **Before deleting it,
copy the numbers it records into the new web-side constants in §6.1** — the 6 mm store column,
0.5 mm gap, 1 mm padding, 10-module quiet zone and the 0.25 mm/module scanning floor are the only
written record of decisions Q1/Q4 and must survive the move.

### Action 4.4 — `package.json`: drop `bwip-js`

`bwip-js` now has zero consumers (verified: only `pdf.utils.ts`'s `barcodeModules`). Remove it from
`dependencies` and run `npm install` in `Apps/api`. Grep for `bwip` across `Apps/api/src` and
`Apps/api/test` first and report the result.

---

## 5. Web — print infrastructure

### Action 5.1 — `Apps/web/src/lib/print.ts`: generalise to two print modes

Keep the existing exports working. Restructure to:

```ts
export const RECEIPT_ROOT_CLASS = "receipt-print-root";
export const LABEL_ROOT_CLASS = "label-print-root";

const STYLE_ID = "scoped-page-style";
const RECEIPT_BODY_CLASS = "printing-receipt";
const LABEL_BODY_CLASS = "printing-labels";

function teardown(): void {
  document.getElementById(STYLE_ID)?.remove();
  document.body.classList.remove(RECEIPT_BODY_CLASS, LABEL_BODY_CLASS);
}

// Shared engine. `pageCss` is a full @page rule; `bodyClass` gates the selector-scoped half in
// index.css. Everything else is S25's proven sequence and must not be reordered:
//  - teardown first, so a double-clicked button cannot stack two styles;
//  - afterprint teardown + a 60s safety net, because afterprint is not fired by every
//    browser/driver combination;
//  - NO synchronous teardown after window.print() — that call is not reliably blocking, and
//    tearing down early yields a blank or wrongly-sized page.
function printScoped(pageCss: string, bodyClass: string): void { /* S25 body, parameterised */ }

export function printReceipt(): void {
  printScoped("@page { size: 80mm auto; margin: 0; }", RECEIPT_BODY_CLASS);
}

// S27 — one label per page, so the page IS the label. The size must match the stock exactly;
// a mismatch is what makes a label printer misfeed.
export function printLabelSheet(widthMm: number, heightMm: number): void {
  printScoped(`@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`, LABEL_BODY_CLASS);
}
```

Rewrite the file header comment: it currently says "Two callers: the POS receipt and the repair
receipt". It is now three call sites across two page sizes. **Keep the `@page`-cannot-be-scoped
explanation and the S22-F1 reference verbatim** — they are the reason the file exists.

### Action 5.2 — `Apps/web/src/index.css`: fix the receipt block, add the label block

**Receipt block — four changes inside the existing `@media print` rule:**

1. Add, as a **new rule inside the same `@media print` block**:
   ```css
   /* S27 — the @page is 80mm but html/body keep their viewport width, so the browser lays the
      receipt out against a much wider box and the driver scales or clips it. Constraining both
      to the roll width is what makes the printed output physically match the page. */
   body.printing-receipt,
   html:has(body.printing-receipt) {
     width: 80mm;
     margin: 0;
     padding: 0;
   }
   ```
2. On `.receipt-print-root`, change `padding: 3mm` → **`padding: 4mm`**. 80 − 4 − 4 = **72 mm of
   content**, which is the printable width the brief specifies.
3. On `.receipt-print-root`, change `font-size: 11px` → **`12px`** and add
   **`font-weight: 700`** — the brief's "bold monospace", and the fix for faint thermal output.
4. Add `-webkit-print-color-adjust: exact; print-color-adjust: exact;` so the browser cannot
   lighten the black.

Also add a descendant rule forbidding greys and fills inside the receipt, so no Tailwind utility
that leaks in can soften the print:
```css
body.printing-receipt .receipt-print-root * {
  color: #000 !important;
  background: transparent !important;
  box-shadow: none !important;
}
```

**Label block — new, and gated exactly like the receipt one (S22 F1):**
```css
.label-print-root { display: none; }

@media print {
  body.printing-labels * { visibility: hidden; }
  body.printing-labels .label-print-root,
  body.printing-labels .label-print-root * { visibility: visible; }
  body.printing-labels .label-print-root {
    /* display:block is load-bearing for the same reason it is on the receipt root —
       visibility:visible cannot reveal a display:none element. */
    display: block;
    position: absolute;
    inset: 0 auto auto 0;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body.printing-labels,
  html:has(body.printing-labels) { margin: 0; padding: 0; }
  /* One label per page. break-after on every label EXCEPT the last — a trailing break emits a
     blank page, which on a continuous roll wastes a physical label. */
  body.printing-labels .label-print-root > .label-page:not(:last-child) {
    break-after: page;
    page-break-after: always; /* legacy alias, some print drivers still read only this */
  }
}
```

> Do **not** put the per-label width/height in `index.css` — it is chosen at runtime. §6.3 sets it
> as an inline style on each `.label-page`.

---

## 6. Web — barcode labels

### Action 6.1 — `Apps/web/src/types/label-print.types.ts` **(new file)**

Web-only (no server consumer remains after §4.2), so it belongs in the web `types` folder, not the
contract — hard rule 1. Carries the geometry rescued from `pdf.utils.ts`.

```ts
// S27 — label sizes and geometry. Web-only: S27 deleted the server-side label PDF, so nothing
// back-end reads these. The millimetre figures are carried over verbatim from S26's PDF renderer
// (pdf.utils.ts, now deleted) so the printed label keeps the layout the owner approved.

export interface LabelSize { widthMm: number; heightMm: number; }

/** S26's report records 40 x 25 mm stock as invalid and 50 x 25 mm as what the store now buys —
 *  so that is the default, and the first preset offered. */
export const LABEL_SIZE_PRESETS: readonly LabelSize[] = [
  { widthMm: 50, heightMm: 25 },
  { widthMm: 40, heightMm: 30 },
  { widthMm: 50, heightMm: 30 },
] as const;

export const DEFAULT_LABEL_SIZE: LabelSize = { widthMm: 50, heightMm: 25 };

/** Bounds on the custom size, so a typo cannot emit a 5000 mm page. */
export const LABEL_CUSTOM_MIN_MM = 15;
export const LABEL_CUSTOM_MAX_MM = 150;

/** Carried from pdf.utils.ts (S26). The store column is a fixed width at every label size — it
 *  holds one rotated line of text, which does not need to grow with the label. */
export const LABEL_PADDING_MM = 1;
export const LABEL_STORE_COLUMN_MM = 6;
export const LABEL_STORE_GAP_MM = 0.5;

/** Code 128 requires >= 10 quiet-zone modules each side and JsBarcode does not add them: its
 *  `margin` option is in the same pixel units as `width`, so margin = QUIET_ZONE_MODULES * width
 *  buys exactly ten modules. A barcode printed edge to edge will not scan. */
export const QUIET_ZONE_MODULES = 10;

/** S22/S26's recorded scanning floor. Below this a handheld reader starts failing; S26 widened
 *  the label 40 -> 50 mm purely to stay above it. A custom size that falls under it is warned
 *  about in the dialog rather than silently printed. */
export const BARCODE_MIN_MODULE_MM = 0.25;

/** localStorage key — "remember the last chosen size so the counter isn't re-picking it". */
export const LABEL_SIZE_STORAGE_KEY = "dt_label_size";
```

### Action 6.2 — `Apps/web/src/lib/barcode-svg.ts` **(new file)**

A print run may be up to `BARCODE_LABEL_SHEET_MAX_TOTAL` (1000) labels. Mounting 1000 React
components that each run JsBarcode in a `useEffect` is slow enough to look like a hang. Render each
**distinct** barcode once to an SVG string and repeat the markup.

```ts
import JsBarcode from "jsbarcode";
import { QUIET_ZONE_MODULES } from "@/types/label-print.types";

// Internal coordinate unit. Only ratios matter — the <svg> is scaled by CSS to the label — so this
// is arbitrary; 2 keeps the viewBox numbers small and integral.
const MODULE_PX = 2;

export interface RenderedBarcode {
  /** <svg> markup, ready for dangerouslySetInnerHTML. */
  svg: string;
  /** Total modules INCLUDING both quiet zones — what the label's width must be divided by to get
   *  the printed millimetres per module. */
  totalModules: number;
}

// S27 — replaces S26's server-side bwip-js render. Renders into a detached element, so nothing is
// mounted and the same string can back N identical labels.
export function renderBarcodeSvg(value: string): RenderedBarcode {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, {
    format: "CODE128",
    displayValue: true,      // the human-readable value is part of the SVG, so it scales with it
    fontSize: 14,
    height: 48,
    width: MODULE_PX,
    margin: QUIET_ZONE_MODULES * MODULE_PX, // the quiet zone JsBarcode does not add by default
    textMargin: 2,
  });
  // JsBarcode writes "0 0 <w> <h>"; w is (modules + 2 * quiet) * MODULE_PX.
  const viewBox = svg.getAttribute("viewBox") ?? "";
  const width = Number(viewBox.split(" ")[2] ?? 0);
  return { svg: svg.outerHTML, totalModules: width > 0 ? width / MODULE_PX : 0 };
}
```

### Action 6.3 — `Apps/web/src/components/shared/barcode-label-sheet.tsx` **(new file)**

The printable root shared by both dialogs.

```ts
export interface LabelSheetItem {
  barcode: string;
  quantity: number;
  topText?: string;
}

interface BarcodeLabelSheetProps {
  items: LabelSheetItem[];
  storeName?: string;
  size: LabelSize;
}
```

Behaviour:
- Wrap everything in `<div className={LABEL_ROOT_CLASS}>`.
- `useMemo` a `Map<string, RenderedBarcode>` over the **distinct** `item.barcode` values, via
  `renderBarcodeSvg`. Rebuild only when the barcode set changes — not when the size changes (the
  SVG is size-independent; CSS scales it).
- Expand to one `.label-page` div per unit of `quantity`, preserving `items` order (invoice-line
  order for a supplier invoice), keyed `` `${index}-${copy}` ``.
- Each `.label-page` carries inline `width: ${widthMm}mm; height: ${heightMm}mm; padding:
  ${LABEL_PADDING_MM}mm; box-sizing: border-box; display: flex; overflow: hidden;`.
- Inside, mirror S26's three sections — **structurally identical to `barcode-label.tsx`'s preview**,
  so the two cannot drift:
  - when `storeName?.trim()` is non-empty: a `LABEL_STORE_COLUMN_MM`-wide flex column holding the
    name with `writing-mode: vertical-rl; transform: rotate(180deg)`, one line, overflow hidden;
    then a `LABEL_STORE_GAP_MM` gap and a 1 px **solid black** vertical rule (the brief forbids
    borders lighter than 1px solid black — the preview's `bg-black/70` must become solid here);
  - the barcode column: `flex: 1; min-width: 0`, optional centred `topText` on one line, then the
    SVG injected with `dangerouslySetInnerHTML` at `width: 100%; height: auto`.
- **The component must render nothing on screen** — `.label-print-root` is `display: none` outside
  a gated print, which §5.2 already guarantees. Do not add a preview here; the dialogs keep their
  own `<BarcodeLabel>` preview.

Add a header comment stating: this replaces S26's server-side PDF; the geometry constants come from
`types/label-print.types.ts` which inherited them from the deleted `pdf.utils.ts`; and the root is
gated on `body.printing-labels` because an ungated print rule is exactly the S22-F1 regression.

### Action 6.4 — `Apps/web/src/components/shared/label-size-field.tsx` **(new file)**

The size control, shared by both dialogs so they cannot offer different sizes.

```ts
interface LabelSizeFieldProps {
  value: LabelSize;
  onChange: (size: LabelSize) => void;
  /** Millimetres per barcode module at the current size, when known — drives the scan warning. */
  moduleMm?: number;
}
```

- A `Select` listing `LABEL_SIZE_PRESETS` (option label `"50 × 25 mm"`, value `"50x25"`) plus a
  final `custom` option, using `t("admin.labelSize.custom")`.
- When `custom` is selected, reveal two number `Input`s (width, height) clamped to
  `[LABEL_CUSTOM_MIN_MM, LABEL_CUSTOM_MAX_MM]` on every keystroke — same per-keystroke clamp
  precedent as `clampQuantity` in both dialogs.
- The control is **not** self-persisting. Persistence lives in the hook (§6.5) so both dialogs get
  it identically.
- When `moduleMm != null && moduleMm < BARCODE_MIN_MODULE_MM`, render a destructive-toned note:
  `t("admin.labelSize.tooNarrow", { min: BARCODE_MIN_MODULE_MM })`. **Warn only — never disable
  Print.** The owner may knowingly print a dense label for a short barcode.

### Action 6.5 — `Apps/web/src/hooks/use-label-size.ts` **(new file)**

```ts
// S27 — "Remember the last chosen size so the counter isn't re-picking it every time."
// localStorage, not a server setting: this is a per-workstation property (the label printer
// loaded at that counter), not a store-wide one. Same try/catch-around-read shape as
// hooks/use-search.ts, because a browser with storage disabled must not crash the dialog.
export function useLabelSize(): [LabelSize, (next: LabelSize) => void];
```

Read once on mount with a validating parse (two finite numbers inside the custom bounds — anything
else falls back to `DEFAULT_LABEL_SIZE`), and write on every change.

### Action 6.6 — `barcode-label-dialog.tsx` (products page): print instead of download

1. Drop the `usePrintBarcodeLabels`, `downloadBlob` and `BarcodeLabelSheetCommand` imports.
2. Add `useLabelSize()`, `<LabelSizeField>` (placed directly under the existing quantity field, as
   the brief says "alongside the existing quantity inputs"), and a `<BarcodeLabelSheet>` rendered
   as a **sibling of `<Dialog>`, not inside `<DialogContent>`** — Radix portals and transform the
   dialog content, which would become the containing block for the sheet's `position: absolute`
   print rule and clip it. (Same trap S25 hit and documented when placing `<RepairReceipt>` outside
   `<Sheet>`.)
3. `handlePrint` becomes synchronous:
   ```ts
   const handlePrint = () => {
     printLabelSheet(size.widthMm, size.heightMm);
     onOpenChange(false);   // AFTER printLabelSheet — print.ts's teardown is afterprint-driven,
                            // and unmounting the sheet before window.print() prints a blank page.
   };
   ```
   **Verify during execution** that closing the dialog does not unmount `<BarcodeLabelSheet>`. It
   is a sibling of `<Dialog>`, so it does not — but if the implementation ends up conditioning it
   on `open`, keep it mounted until `afterprint` instead, or simply leave the dialog open and let
   the owner close it. State which you did in the report.
4. Compute `moduleMm` for the warning: barcode area = `widthMm − 2*LABEL_PADDING_MM −
   (storeName ? LABEL_STORE_COLUMN_MM + LABEL_STORE_GAP_MM : 0)`, then
   `moduleMm = barcodeAreaMm / totalModules` from `renderBarcodeSvg(barcode).totalModules`.
   Memoise on `[barcode, size, effectiveStoreName]`.
5. Rewrite the S22/S26 header comment — it states the sheet "is a server-side PDF now … not a
   hidden print portal" and that the preview "never reaches the PDF". Both are now inverted: the
   preview and the printed label are the same markup family, and there is no PDF.
6. The Print button loses its `printLabels.isPending` state; drop the
   `admin.productsList.printLabels.generating` label from this call site (the key itself is deleted
   in §8).

### Action 6.7 — `barcode-labels-dialog.tsx` (supplier invoices): same treatment

Identical changes to 6.6, plus:
- Build `items` from `printableLines` exactly as today (`barcode` now comes from
  `line.barcode`, already resolved by `useBarcodeLookup`), preserving invoice-line order.
- **Keep** the skipped-count note, the per-line editable quantities defaulting to the invoice
  quantity, the shared store-name field and the `BARCODE_LABEL_SHEET_MAX_TOTAL` guard with Print
  disabled past the cap — the brief says all of this "already agreed stays".
- The `overLimit` message key `admin.productsList.printLabels.tooMany` stays; only its comment
  changes (it now bounds a browser print run, not a PDF sheet).

> **Barcodes are now resolved client-side.** S22's service comment noted the server re-read
> barcodes so "a barcode edited since the dialog opened prints as it is *now*". With the server
> route gone, the products dialog prints `product.barcode` from the loaded row and the supplier
> dialog prints the `useBarcodeLookup` result. Both are refetched when the dialog opens, so the
> window is small — but record this as a deliberate, accepted consequence in the report.

### Action 6.8 — `barcode-label.tsx` (the preview): update its comment only

The component body stays. Its header comment claims "The printed sheet is rendered server-side as a
PDF (pdf.utils.ts's renderBarcodeLabelsPdf, PDFKit + bwip-js)". Replace with: the printed label is
now `barcode-label-sheet.tsx`, rendered in the browser from the same JsBarcode symbol, and the two
must be kept in step. Note that this preview intentionally keeps `margin: 0` (no quiet zone)
because it is a visual reference at a fixed on-screen size, while the printed label adds the quiet
zone via `renderBarcodeSvg`.

### Action 6.9 — Delete the dead web client

- `services/catalog.service.ts` — delete `renderBarcodeLabels` and its `BarcodeLabelSheetCommand`
  import. **Keep `lookupBarcodes`.**
- `hooks/useCatalogProducts.ts` — delete `usePrintBarcodeLabels` and its import.
  **Keep `useBarcodeLookup`.**
- `lib/query-client.ts` — delete the `CATALOG_ERROR.BARCODE_LABELS_EMPTY` and
  `CATALOG_ERROR.BARCODE_LABEL_TOTAL_EXCEEDED` entries from `SENTINEL_TRANSLATION_KEYS`.

---

## 7. Web — the POS receipt

### Action 7.1 — `StaffPos.tsx`: pass the new fields through

Add props to `<PosReceiptView>`: `subtotal={receipt.subtotal}`,
`discountAmount={receipt.discountAmount}`, `posClientName={receipt.posClientName}`,
`staffName={receipt.staffName}`, and change
`issuedAt={receiptAt ?? new Date().toISOString()}` → `issuedAt={receipt.soldAt ?? receiptAt ?? new Date().toISOString()}`.

Keep the `receiptAt` state and its comment — it is now the fallback for a sale whose `soldAt` is
somehow null, not the primary source. Update the comment to say so.

### Action 7.2 — `PosReceiptView.tsx`: rebuild the print subtree only

**The on-screen card (the first subtree) is not part of this set — leave it exactly as it is.**
Only the `<div className={RECEIPT_ROOT_CLASS}>` subtree is rewritten.

New props (all print-only):
```ts
subtotal: number;
discountAmount: number;
/** Absent for a walk-in sale. Gates BOTH the credit block and the client-name line (D2). */
posClientName?: string;
staffName: string;
```

Print subtree, top to bottom — exactly the brief's nine sections:

1. **Print logo** — `store?.printLogoUrl ?? store?.logoUrl`, centred,
   `style={{ maxWidth: "40mm", margin: "0 auto", display: "block" }}`. Keep S25's existing comment
   about the remote URL possibly not loading before the dialog paints; extend it to record D3.
2. **Store block** — `store.name` (bold), then `store.activityLine`, `store.address`, then the two
   labelled numbers, each rendered only when it resolves:
   - `t("staff.pos.receipt.repairPhone")` + `store.repairPhone ?? store.phone`
   - `t("staff.pos.receipt.salesPhone")` + `store.salesPhone ?? store.phone`
   The `?? store.phone` fallback is S26.1's stated Q2 behaviour — an owner who has not filled the
   two new fields still gets a number on the receipt. If **both** new fields are unset, this prints
   the same number twice under two labels; that is the intended, self-explanatory prompt to fill
   them in. Say so in a comment.
3. **Separator** — a reusable local `const rule = <div style={{ borderTop: "1px dashed #000",
   margin: "4px 0" }} />`. Keep dashed (the brief allows it explicitly).
4. **Items table** — this is the set's single most important change. Use a real `<table>` with
   `width: 100%; table-layout: fixed; border-collapse: collapse`:
   - `<thead>` with four `<th>`: `t("staff.pos.receipt.colItem")`, `.colQty`, `.colUnitPrice`,
     `.colLineTotal`. Widths `auto / 8mm / 18mm / 18mm`; the last three `text-align: right`.
   - Each line is **one `<tr>`**. The label cell gets
     `overflow-wrap: anywhere; word-break: break-word; white-space: normal` so a long name wraps
     onto as many lines as it needs, and the three figure cells get `vertical-align: top` so they
     stay on the **first** line of the row. That combination is the whole requirement — a `<div>`
     flex row cannot do it.
   - Serial numbers, when present, render as a second `<tr>` whose single cell spans all four
     columns (`colSpan={4}`), indented, at `10px`, reusing the existing
     `staff.pos.receipt.serials` key.
5. **Item summary** — two rows computed client-side, no contract change:
   `t("staff.pos.receipt.articleCount", { count: lines.length })` and
   `t("staff.pos.receipt.totalQuantity", { count: lines.reduce((s, l) => s + l.quantity, 0) })`.
6. **Money block** — three rows, **always all three** (D1): `t("staff.pos.receipt.subtotal")` →
   `subtotal`; `t("staff.pos.receipt.discount")` → `discountAmount`;
   `t("staff.pos.receipt.amountPayable")` → `total`, bold.
7. **Credit block** — wrapped in `{posClientName != null && (…)}`, four rows: previous credit,
   `t("staff.pos.receipt.purchaseTotal")` → `total`, `.paid` → `paid`, `.newCredit` → `newCredit`.
   Reuse the existing `previousCredit`/`paid`/`newCredit` keys. **A walk-in sale renders nothing
   here — not zeroes.**
8. **Client name** — `{posClientName != null && (…)}`, `t("staff.pos.receipt.client")` +
   the name.
9. **Footer** — reference (existing key), `formatDateTime(issuedAt, language)`, and
   `t("staff.pos.receipt.cashier")` + `staffName`. Keep the existing `thankYou` line below it.
   **No barcode** — do not add one, and keep the header comment sentence that says so.

Use a small local helper for the two-column money rows, mirroring the existing `row()` helper's
shape but with the print styling (`display: flex; justify-content: space-between`).

Update the component's header comment: it describes two subtrees and says the print root carries
"the five money rows unchanged". That is no longer the layout — describe the nine sections and note
that the on-screen card was intentionally left alone.

### Action 7.3 — `RepairReceipt.tsx`: logo swap only (D4)

Change `store?.logoUrl` → `store?.printLogoUrl ?? store?.logoUrl` in the one `<img>` (and its
guard). **Change nothing else** — no activity line, no second phone, no restructure. Add a
one-line comment recording that S27 deliberately restructured only the POS receipt and that this
slip still prints the single `store.phone`.

---

## 8. Translation keys

Delete two keys (their sentinels are gone in §3.4):
`common.errors.sentinel.barcodeLabelsEmpty`, `common.errors.sentinel.barcodeLabelTotalExceeded`.

Delete one key whose only call site is gone (§6.6): `admin.productsList.printLabels.generating`.

Add to `Apps/web/src/config/translations.json`:

**Receipt** (`staff.pos.receipt.*`)
| key | en | fr |
|---|---|---|
| `colItem` | Item | Article |
| `colQty` | Qty | Qté |
| `colUnitPrice` | Unit | P.U. |
| `colLineTotal` | Total | Total |
| `articleCount` | Articles: {count} | Articles : {count} |
| `totalQuantity` | Total quantity: {count} | Quantité totale : {count} |
| `subtotal` | Total | Total |
| `discount` | Discount | Remise |
| `amountPayable` | Amount payable | Net à payer |
| `purchaseTotal` | Purchase total | Total achat |
| `client` | Client | Client |
| `cashier` | Cashier | Caissier |
| `repairPhone` | Repair | Réparation |
| `salesPhone` | Sales | Vente |

**Label size** (`admin.labelSize.*`)
| key | en | fr |
|---|---|---|
| `label` | Label size | Format d'étiquette |
| `custom` | Custom | Personnalisé |
| `width` | Width (mm) | Largeur (mm) |
| `height` | Height (mm) | Hauteur (mm) |
| `helper` | Must match the label stock loaded in the printer. | Doit correspondre aux étiquettes chargées dans l'imprimante. |
| `tooNarrow` | At this size the bars fall below {min} mm and may not scan. Use a wider label. | À ce format les barres passent sous {min} mm et risquent de ne pas être lues. Utilisez une étiquette plus large. |

Keep every other `admin.productsList.printLabels.*` and `admin.supplierInvoices.printLabels.*` key.

---

## 9. Dependency order

1. §3 contract (receipt DTO first — §4.1 will not compile without it; then the label deletions).
2. §4 backend: mapper → route/controller/interface/service deletions → `pdf.utils.ts` → `package.json`.
3. §5 print infrastructure (`lib/print.ts`, `index.css`) — §6 and §7 both depend on it.
4. §6 labels: types → `barcode-svg.ts` → sheet → size field → hook → both dialogs → deletions.
5. §7 receipt: `StaffPos.tsx` → `PosReceiptView.tsx` → `RepairReceipt.tsx`.
6. §8 translations.

---

## 10. Validation gates (no test suites — hard rule 3)

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd Apps/api      && npx tsc --noEmit && npm run lint
cd Apps/web      && npx tsc --noEmit && npm run lint
```

`Apps/api`'s `tsc` has a **known pre-existing baseline of 184 errors under `test/**`** and lint has
**7 pre-existing errors** in `prisma/seed.ts`, `validate-request.middleware.ts` and
`orders.service.ts` (recorded in report-S26-1). Neither is this set's to fix; `src/**` must be
**0 errors**. Do not modify any test file.

Grep-verify what the compiler cannot:
- `grep -rn "BARCODE_LABELS\|renderBarcodeLabels\|usePrintBarcodeLabels\|BarcodeLabelSheet\|bwip" Apps --include=*.ts --include=*.tsx | grep -v node_modules` → no hits outside the new
  `LabelSheetItem`/`BarcodeLabelSheet` component names.
- Every new `t("…")` key exists in `translations.json`; the three deleted keys have no remaining
  call site.
- `grep -rn "printing-receipt\|printing-labels" Apps/web/src` → each body class appears in exactly
  two places: `lib/print.ts` and `index.css`.

---

## 11. Manual verification checklist

**Print previews are not sufficient for this set — both artefacts must be printed on the real
thermal and label hardware.** A browser preview will not reveal faint bars, a misfed roll or a
label the printer scales to fit.

### POS receipt — on screen
1. `/staff/pos` → build a ticket with **three** products, one with a deliberately long name
   (e.g. "AFFICHEUR ACE BUZZ 6 PRIME • BUZZ 7 LITE • BUZZ 7 PRIME"), confirm the sale.
2. The on-screen receipt card is **unchanged** from before this set — same five money rows, same
   lines list, same two buttons.

### POS receipt — print preview
3. Click **Print** → the preview is a narrow single-column receipt, ~80 mm, with **no A4 whitespace
   to the right** and no horizontal clipping.
4. The **print logo** appears at the top, centred. Clear it in Settings → Store and reprint → the
   colour store logo appears instead (D3 fallback); with neither set, the header starts at the
   store name and is not empty.
5. Under the name: **activity line**, address, then two separately labelled numbers —
   **Repair** and **Sales**. Set only one of the two in Settings and reprint → the other falls back
   to the general phone.
6. The items table has **four column headers** (Item / Qty / Unit / Total).
7. **The long product name wraps onto as many lines as it needs**, and its quantity, unit price and
   line total stay **right-aligned on the first line of that row**. Nothing is cut off at the right
   edge. *(This is the set's headline fix — check it specifically.)*
8. Below the table: **number of articles** and **total quantity**.
9. Money block shows **three rows** — Total, Discount (0), Amount payable — all three present.
10. Footer shows the **sale reference**, the **date and time**, and the **cashier's name** (the
    staff member who made the sale). **No barcode anywhere.**

### POS receipt — the credit block
11. Sale with **no POS client** (walk-in) → the credit block is **absent entirely**, and so is the
    client-name line. No zero rows.
12. Sale **with a POS client attached**, paying less than the total → the credit block appears with
    previous credit, purchase total, amount paid, new credit; the **client's name** prints above the
    footer. The four figures match the on-screen card.

### POS receipt — on the real thermal printer
13. **Print to the actual 80 mm thermal printer.** The text is **dark and legible, not grey** —
    compare against a receipt printed before this set if one is to hand.
14. Content fits the roll with **no right-hand truncation**; the roll cuts at the end of the content
    with no trailing blank feed.
15. A receipt with **one** line and a receipt with **fifteen** lines both print completely — height
    is content-driven, nothing forces a page break mid-receipt.

### Barcode labels — products page
16. `/admin/products` → a product **with** a barcode → **Print labels**.
17. The dialog shows the preview, store name, caption, quantity **and a new Label size field**
    defaulting to **50 × 25 mm**.
18. Choose **Custom**, enter 30 × 20 → a warning appears that the bars fall below 0.25 mm. **Print
    is still enabled** (warn, don't block).
19. Set size back to 50 × 25, quantity **3**, click **Print** → the **print dialog opens directly**.
    **No PDF is downloaded and no file-save prompt appears.**
20. The preview shows **3 pages, one label per page** — not 3 labels tiled on one sheet.
21. Each label shows the vertical store name on the left, the caption above the bars, the Code 128
    symbol and its **human-readable digits**, with visible **white margin either side of the bars**.
22. Close the dialog, reopen it → the size field still reads **50 × 25 mm** (remembered). Reload the
    whole page and reopen → still remembered.

### Barcode labels — supplier invoices
23. `/admin/supplier-invoices` → open any invoice → **Print barcodes**.
24. Rows still default to each line's **invoice quantity** and are still editable; the size field is
    present and shares the remembered value from step 22.
25. An invoice with a line whose product has **no barcode** still shows the **"N line(s) skipped"**
    note, and that line produces no label.
26. Push the quantities past 1000 → the red over-limit note appears and **Print is disabled**.
27. Print → print dialog opens directly, one label per page, in **invoice-line order**.

### Barcode labels — on the real label printer
28. **Load 50 × 25 mm stock and print for real.** Each label lands **centred on its own physical
    label** with no misfeed and no creep across the run — this is what the exact `@page` size buys.
29. **Scan the printed barcode with the handheld reader.** It reads first time. Scan one from a
    10-label run to confirm the last is as good as the first.
30. Print a run at a **different preset** (50 × 30) on matching stock → still one per label, still
    scans.

### Print-scoping regressions — S22 finding F1
31. `/staff/sales` → **Reprint** on a sale → prints the **whole A4 page**, exactly as before.
32. `/staff/invoices` → **Print** → whole A4 page, unchanged.
33. `Ctrl+P` on `/admin/products` with **the label dialog open** → the browser prints the **normal
    A4 page**; no labels leak into it.
34. `Ctrl+P` on `/staff/pos` with a receipt on screen → normal A4 page, no 80 mm receipt.
35. Print a receipt, close the dialog, then immediately `Ctrl+P` on the same page → **A4**, proving
    teardown ran.
36. Print labels, then print a POS receipt without reloading → the receipt comes out at **80 mm**,
    not at the label size. Then print labels again → back to the label size.

### Repair slip
37. `/staff/repairs` → open a ticket → **Print receipt** → it now uses the **print logo** (D4) and
    is **darker/bolder** than before (it shares the receipt CSS). Everything else about it is
    unchanged — it still prints the single store phone and no activity line.
38. With the repair sheet open, `Ctrl+P` → normal A4 page, no receipt.

### Language
39. Switch to **FR** and repeat steps 3 and 19 → every printed label and every dialog string is
    French, including the new column headers, the money-block labels, "Caissier", and the label-size
    field. No raw key, no English leak.

---

## 12. Execution protocol

Execute this set **on its own**. When finished, write
`Docs/Stage-04-Fixes/results/report-S27.md` describing what changed file by file, ending with the
checklist in §11. Record explicitly:

- that the set brief's `@page`/max-width premises were already handled by S25, and what the real
  physical fix turned out to be (§0);
- that S27 **supersedes** S25's recorded decision to omit the receipt's column headers;
- whether `streamPdf` / `PdfResult` / the `MM` helper survived the §4.2–4.3 deletions;
- the `bwip-js` removal and the grep that proved it had no other consumer;
- the accepted consequence that label barcodes are now resolved client-side (§6.7);
- how the dialog-close-vs-print ordering was resolved in §6.6 step 3;
- that `RepairReceipt` deliberately received only the logo swap, and that its header still differs
  from the POS receipt's.

The owner reviews and approves before **S28** begins.
