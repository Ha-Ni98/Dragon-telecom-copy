# Plan — Set 25: Receipt printing & document exports

Executes `Docs/Stage-04-Fixes/sets-22-25.md` §S25 on branch `version-1-2`, **plus the repair
receipt (§K), added by owner request on 2026-08-12** and folded in here rather than given its own
set because it reuses this set's print helper, print stylesheet and public store header verbatim.

**Sets that must land first:** S22 (done — supplies `pdf.utils.ts`'s `toBuffer` plumbing and the
"one PDF stack" precedent this set extends). S23/S24 are audits with their own fix work already
merged; nothing here depends on them beyond `avgStockPrice` being the figure the stock exports
carry.

**Sections:** §0 findings & decisions · §A contract · §B backend utils · §C POS receipt ·
§D CSV audit & fixes · §E movement-ledger CSV · §F PDF exports · §G export menu · §H translations ·
§I execution order · §J export/POS verification · **§K repair receipt** · **§L repair-receipt
verification**.

---

## §0 — Findings that changed the brief, and the owner's decisions

The brief was written against an assumed codebase state that differs from the real one in four
places. All four were put to the owner before planning; the decisions below are settled and the
plan implements them. **The executor must not revisit them.**

### 0.1 The "movement ledger CSV export" does not exist

The brief asks to audit the CSV exports for *delivery fees and the movement ledger*. There is no
movement-ledger export of any kind — no query param, no service branch, no button in
`movement-ledger-table.tsx`. There are three CSV exports, and the third is **stock levels**:

| Export | Backend | Frontend trigger |
|---|---|---|
| Delivery fees | `platform.service.ts` `exportFees` (`format=csv\|excel\|json`) | `delivery-fees-section.tsx` |
| Stock levels | `inventory.service.ts` `getStock` (`export=csv`) | `AdminInventory.tsx` → `StockLevelsTable` |
| Statistics reports | `statistics.service.ts` `toCsvExport` (`format=csv`) | `report-picker.tsx` |
| **Movement ledger** | **absent** | **absent** |

**Owner decision:** build the missing movement-ledger CSV (§E) *and* audit/fix all three that
exist (§D). Every one of the four export surfaces then offers both CSV and PDF.

### 0.2 The POS receipt cannot reach the store header

`GET /platform/settings` is `adminOnly` (`platform.routes.ts:58`), and `SETTINGS_PUBLIC` returns
only the `storefront` block — deliberately, per the comment at `platform.dtos.ts:50-52`
("store/invoicing/delivery are internal-only"). The POS is `PageKey.STAFF_POS`, so a cashier has
no way to fetch name/address/phone/logo.

**Owner decision:** add the `store` block to `PublicSettingsResponseSchema` (§A6, §C1). Rationale
to carry into the code comment: these same three fields are already printed on every invoice PDF
handed to a customer, so they are not confidential. `invoicing` (prefixes, next sequence numbers)
and `delivery` stay internal.

The repair receipt (§K) hits the identical blocker — `/staff/repairs` is `PageKey.STAFF_REPAIRS` —
and is fixed by this same change. Two receipts, one store-header fix.

### 0.3 There is no `@media print` CSS anywhere in the app

S22 deleted the last one. `window.print()` on the POS, on `/staff/sales` *Reprint*
(`StaffSales.tsx:247`) and on `/staff/invoices` *Print* (`StaffInvoices.tsx:232`) currently prints
the **whole page**, sidebar included. An `@page { size: 80mm auto }` rule is a document-level
at-rule and **cannot be scoped by a selector**, so a naive receipt stylesheet would silently
reformat the other two — precisely the S22 finding-F1 failure mode.

**Owner decision:** scope the 80 mm rules to the receipt only; `/staff/sales` and
`/staff/invoices` keep today's whole-page behaviour, untouched. §C3 specifies the mechanism
(dynamic `<style>` injection for `@page` + a `body` class for the rest).

### 0.4 The receipt shows no lines today

`PosReceiptView.tsx` renders five money rows and nothing else — no lines, no reference, no
timestamp — although `ReceiptDto` (`sales.dtos.ts:52-68`) carries `reference` and `lines[]` with
optional `serialNumbers`. The brief's "keep every figure the receipt shows today: **lines**,
total, …" describes the target, not the present.

**Proceeding on:** the 80 mm receipt *adds* the line table plus the sale reference and a
timestamp; the five money rows keep their exact current meaning and order.

### 0.5 Statistics charts are client-side Recharts

**Owner decision:** draw the chart server-side in PDFKit from `ReportDto.chart`'s
`{label, value}[]` (§B2). One PDF stack, no browser rasterisation, and the endpoint stays usable
outside the page. The result is visually *similar to*, not pixel-identical with, the on-screen
Recharts bar chart — that is accepted.

### 0.6 Standing decisions the executor must respect

- **Statistics report filters are `from`/`to` only.** `ReportQuerySchema` has no `familyId` or
  `source`; those live on `FilteredQuerySchema`/`ChartsQuerySchema` and drive the overview and
  chart widgets, not the reports. "Respects the currently active filters" therefore means from/to
  for the report exports. **Do not extend reports with `familyId`/`source`** — that would change
  what every report means and is not this set's business.
- **Permissions need no work.** `FEES_EXPORT`, `INVENTORY_ROUTES.STOCK`, `INVENTORY_ROUTES.MOVEMENTS`
  and `STATS_ROUTES.REPORT` are all already `adminOnly`, and inventory/statistics/settings have no
  `PageKey`, so none of them is staff-visible. The S22-style parity check yields nothing here. **Add
  no new routes and change no guard.** All four exports extend an existing endpoint via a query
  parameter.
- **Rule 2 (`t()`) does not reach inside a server-rendered document.** `renderInvoicePdf` already
  writes English literals (`Invoice`, `Issued:`, `Bill to:`, `Total:`, `Paid:`), and the existing
  CSV headers are English field names. PDF and CSV text produced on the server stays English
  literals — do **not** try to thread translations into PDFKit or into `csv.utils.ts`. Rule 2
  applies in full to every *browser* string this set adds: buttons, menu items, toasts, the
  receipt's own labels, error messages.
- **No test file is read, edited or run.** Validation is `tsc --noEmit`, lint, and import/syntax
  correctness only.
- **No data backfill**, no corrective migration. There is no schema change in this set at all.

### 0.7 A limitation to carry, not to fix

PDFKit's built-in Helvetica is WinAnsi-encoded and **cannot render Arabic glyphs**. A product name
in Arabic will print as garbage in every PDF this set adds — exactly as it already does in
`renderInvoicePdf`. Fixing it means embedding a Unicode TTF, and no font asset exists in the repo
(`find Apps/api -iname '*.ttf'` returns only bwip-js's own barcode fonts). **Out of scope.** Note
it in the §B2 header comment so the next reader knows it is known, not overlooked. The CSV path is
unaffected — §B1's BOM makes Arabic open correctly in Excel, which is what the brief asked for.

### 0.8 The repair receipt (§K) — scope added after the brief

Requested by the owner on 2026-08-12, after the rest of this plan was written. Four decisions were
taken before planning it and are settled:

- **Folded into S25**, not given its own set — it reuses §C2's print helper, §C3's stylesheet and
  §C1's public store header without modification.
- **80 mm thermal, browser print** — the same roll and pipeline as the POS receipt, not a PDF.
- **One layout with conditional sections**, printable at every status, rather than four
  status-specific documents. Parts appear only if any exist, labour only if non-zero, IMEI only if
  captured; totals and paid state always.
- **No barcode or QR** of the repair reference — reference as large monospace text, matching the
  POS receipt decision in §C4.

The audit behind it (§K0) found that `RepairDto` already carries every requested field, so §K adds
**no contract, schema, endpoint or hook change** — it is frontend-only.

---

## §A — Contract (do first; everything else imports from here)

### A1. New file `Apps/contract/src/common/exports.ts`

Lives in `common/` rather than a module folder because three separate modules raise the same
ceiling and the frontend maps one sentinel to one message.

```ts
// S25 — shared by every server-rendered export (delivery fees, stock levels, movement ledger,
// statistics reports). An unbounded ledger export would hold a request open while it serialised
// an arbitrary number of rows; this is the ceiling-with-a-clear-message strategy the set brief
// asked the plan to fix, chosen over streaming because every one of the four exports is a single
// in-memory document (a PDF cannot be streamed row-by-row anyway) and because the same number
// then bounds the CSV and the PDF identically.
export const EXPORT_MAX_ROWS = 5000;

// Travels as the error *message*, not error.code — same sentinel convention as CATALOG_ERROR
// (see query-client.ts's SENTINEL_TRANSLATION_KEYS comment).
export const EXPORT_ERROR = {
  ROW_LIMIT_EXCEEDED: 'EXPORT_ROW_LIMIT_EXCEEDED',
} as const;
export type ExportErrorSentinel = (typeof EXPORT_ERROR)[keyof typeof EXPORT_ERROR];
```

No shared `ExportFormat` enum: each module already owns a format member with its own legal values
(statistics has `ReportFormat`, platform has an inline `excel|csv|json`, inventory has a literal),
and collapsing them would force three unrelated endpoints to accept values they cannot serve.

### A2. `Apps/contract/src/index.ts`

Add `export * from './common/exports';` immediately after the `./common/auth` line.

### A3. `Apps/contract/src/modules/statistics/statistics.enums.ts`

`ReportFormat` gains `PDF = 'pdf'`. The comment above it currently reads *"Only 'csv' is confirmed
(Test Scenarios: 'CSV shape = rows'); 'table' is the inferred complement"* — append (rule 4, the
comment is now stale):

```
// S25 adds PDF: the same rows, rendered server-side through pdf.utils.ts's renderTablePdf with
// the report's chart and totals. CSV is unchanged and stays alongside it.
```

### A4. `Apps/contract/src/modules/inventory/inventory.query.ts`

- `StockQuerySchema.export`: `z.literal('csv').optional()` → `z.enum(['csv', 'pdf']).optional()`.
  Replace the comment *"Only 'csv' is documented … no other format is named in the spec"* with a
  note that S25 added `pdf` alongside it.
- The existing header comment already claims *"Applied before the CSV branch: an export sent with
  `search` exports the filtered set."* That was true of the backend and false of the caller (§D2) —
  leave the sentence, it becomes true end-to-end once D2 lands.
- `MovementsQuerySchema` gains:

```ts
  // S25 — export=csv|pdf returns the whole filtered ledger, unpaginated. `page`/`limit` above keep
  // their defaults (they are non-optional after .default()) and are deliberately IGNORED on this
  // branch: exporting only the page on screen is the defect the set brief calls out by name. The
  // result set is capped at EXPORT_MAX_ROWS.
  export: z.enum(['csv', 'pdf']).optional(),
```

### A5. `Apps/contract/src/modules/platform/platform.query.ts`

`FeesExportQuerySchema.format`: `z.enum(['excel', 'csv', 'json'])` → `z.enum(['excel', 'csv', 'json', 'pdf'])`.

### A6. `Apps/contract/src/modules/platform/platform.dtos.ts`

`PublicSettingsResponseSchema` gains the store block. Replace the whole existing comment (it
asserts the opposite of what the schema will now do — rule 4):

```ts
// SETTINGS_PUBLIC route note: "featured products and families only" — plus, since S25, the store
// header. The POS receipt is printed by a STAFF cashier and must carry the shop's name, address,
// phone and logo, but GET /platform/settings is adminOnly; these four fields are already printed
// on every invoice PDF handed to a customer, so exposing them publicly discloses nothing new.
// `invoicing` (prefixes, next sequence numbers) and `delivery` stay internal — they are not here.
export const PublicSettingsResponseSchema = z.object({
  store: z.object({
    name: z.string(),
    address: z.string().optional(),
    phone: z.string().optional(),
    logoUrl: z.string().optional(),
  }),
  storefront: z.object({
    featuredProductIds: z.array(z.uuid()),
    featuredFamilyIds: z.array(z.uuid()),
  }),
});
```

The `store` sub-object is field-for-field identical to `SettingsResponseSchema.store` — keep them
literally identical so §C1's mapper is a straight assignment.

---

## §B — Backend shared utilities

### B1. New file `Apps/api/src/common/utils/csv.utils.ts`

One RFC 4180 writer for all four CSV exports. Header comment must state the defect it replaces:

```ts
// S25 — one RFC 4180 writer for every CSV export (delivery fees, stock levels, movement ledger,
// statistics reports). Each module previously joined its fields with a bare `,`: a product name
// or a client name containing a comma silently split into two columns and shifted every later
// column of that row, and no export emitted a BOM, so Excel read UTF-8 accented and Arabic text
// as mojibake. statistics.service.ts was worse still — it escaped with JSON.stringify, which
// backslash-escapes an inner quote where CSV requires doubling it.

// Excel picks its CSV separator from the machine's list separator. `,` is kept because it is
// RFC 4180 and because the delivery-fee *importer* (platform.service.ts importFees) round-trips
// this same file. If the owner's Excel is French/Algerian-locale and drops every row into a
// single column, CSV_SEPARATOR and CSV_DECIMAL below are the two lines to flip together
// (';' and ',') — they must always move as a pair or the decimals become field breaks.
export const CSV_SEPARATOR = ',';
const CSV_DECIMAL = '.';
const CSV_EOL = '\r\n';   // RFC 4180; Excel on Windows needs it
const CSV_BOM = '\uFEFF'; // makes Excel read the payload as UTF-8 rather than the ANSI codepage
export const CSV_MIME = 'text/csv; charset=utf-8';
```

Exports:

- `export type CsvValue = string | number | boolean | null | undefined;`
- `escapeField(value: CsvValue): string` (module-private)
  - `null`/`undefined` → `''` (unquoted empty field).
  - `boolean` → `'true'`/`'false'`.
  - `number` → `Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : csvMoney(v)) : ''`.
  - `string` → quote when it contains `CSV_SEPARATOR`, `"`, `\r`, `\n`, or has leading/trailing
    whitespace; inside quotes every `"` becomes `""`.
- `export const csvMoney = (n: number): string` → `n.toFixed(2)` with `.` swapped for
  `CSV_DECIMAL`. Fixed 2 dp both formats a money column consistently and avoids
  `0.30000000000000004` reaching the sheet.
- `export const csvDate = (value: string | Date): string` → `YYYY-MM-DD HH:mm` in **UTC**,
  locale-free and lexically sortable. Comment why: a locale-formatted date (`12/08/2026`) is
  ambiguous between fr and en and Excel re-parses it against its own locale.
- `export const toCsv = (headers: string[], rows: CsvValue[][]): string` →
  `CSV_BOM + [headers, ...rows].map(r => r.map(escapeField).join(CSV_SEPARATOR)).join(CSV_EOL) + CSV_EOL`.
  The trailing EOL is intentional (POSIX-clean final line).

### B2. `Apps/api/src/common/utils/pdf.utils.ts` — add the export/report renderer

Append below `renderBarcodeLabelsPdf`. Reuse the existing `toBuffer` and `MM` — do **not** add a
second PDF library or a second buffering helper.

**Types (exported):**

```ts
export type TablePdfColumn = {
  header: string;
  width: number;                        // relative weight, normalised across the row
  align?: 'left' | 'right';             // default 'left'; money/quantity columns pass 'right'
};

export type TablePdfData = {
  title: string;                        // e.g. "Stock levels"
  filters: { label: string; value: string }[];  // [] renders as "Filters: none"
  generatedAt: Date;
  orientation: 'portrait' | 'landscape';
  columns: TablePdfColumn[];
  rows: string[][];                     // already formatted by the caller — this function lays out only
  totals?: { label: string; value: string }[];
  chart?: { label: string; value: number }[];   // omitted or empty = no chart
};
```

`rows` are **pre-formatted strings**. Same division of labour as `renderInvoicePdf`, whose header
comment says every value is already resolved by the caller and the function only lays it out —
keep that contract, so money formatting stays in one place per module.

**Layout constants** (author in points; A4 is 595.28 × 841.89 pt):

```ts
const PAGE_MARGIN = 36;          // 12.7 mm — a printable margin on any consumer printer
const TITLE_SIZE = 16;
const META_SIZE = 9;             // filter lines + generated-at
const HEAD_SIZE = 9;
const BODY_SIZE = 8.5;
const ROW_HEIGHT = 15;
const HEAD_HEIGHT = 18;
const FOOTER_SIZE = 8;
const CHART_HEIGHT = 140;
const CHART_MAX_BARS = 20;       // beyond this the labels are unreadable; the table still has every row
```

**Construction:** `new PDFDocument({ size: 'A4', layout: data.orientation, margin: PAGE_MARGIN,
bufferPages: true })`. `bufferPages: true` is **required** — page numbers can only be stamped in a
second pass over `doc.bufferedPageRange()` once the total is known. Say so in a comment; without
it `switchToPage` throws.

**Render order:**

1. **Title block** (page 1 only) — `title` at `TITLE_SIZE` bold; then one `META_SIZE` line per
   filter as `"<label>: <value>"`; then `"Filters: none"` when `filters` is empty; then
   `"Generated: <YYYY-MM-DD HH:mm UTC>"`. Then `doc.moveDown()`.
2. **Chart** (page 1 only, when `chart` is non-empty) — see below.
3. **Table** — header band, then rows, paginating.
4. **Totals** (after the last row, when present) — a rule, then `"<label>: <value>"` entries laid
   out left to right, wrapping.
5. **Page numbers** — second pass.

**Table mechanics (the part that must not be improvised):**

- Available width = `doc.page.width - PAGE_MARGIN * 2`. Each column's absolute width =
  `available * col.width / Σ widths`.
- `drawHeaderRow(y)`: a `#EEEEEE` filled rect spanning the full available width and `HEAD_HEIGHT`
  tall, then each header at `HEAD_SIZE` in `Helvetica-Bold`, `#000000`, clipped to its column
  width with `{ width, align, ellipsis: true }`.
- Row loop: before each row, if `y + ROW_HEIGHT > doc.page.height - PAGE_MARGIN - FOOTER_SIZE * 2`,
  call `doc.addPage()`, reset `y = PAGE_MARGIN` and **redraw the header band** — this is the
  brief's "repeated header row across pages".
- Cells: `Helvetica`, `BODY_SIZE`, `{ width: colWidth - 4, align, ellipsis: true, lineBreak: false }`.
  `lineBreak: false` + `ellipsis` keeps every row exactly one line tall, which is what makes the
  fixed `ROW_HEIGHT` pagination arithmetic correct. Comment that dependency — someone will
  otherwise "improve" it to wrap and silently break pagination.
- A hairline `#DDDDDD` rule under each row.

**Chart mechanics:**

- Take `chart.slice(0, CHART_MAX_BARS)`.
- `max = Math.max(...values, 0)`; when `max <= 0` skip the chart entirely (all-zero data draws
  nothing meaningful).
- Plot area = full available width × `CHART_HEIGHT`, leaving 12 pt at the bottom for labels and
  10 pt at the top for value labels.
- Bar width = `plotWidth / n * 0.7`, gap = the remaining 0.3. Bar height =
  `value / max * usablePlotHeight`. Fill `#2563EB`.
- Baseline: a `#999999` line across the bottom of the plot area.
- Value label above each bar at 7 pt, centred; x label below at 7 pt, centred, truncated to 12
  characters with `ellipsis: true`.
- Comment: this is a deliberately plain bar chart matching `ReportDto.chart`'s single-series
  `{label, value}` shape — it is not, and does not try to be, a pixel copy of the page's Recharts
  render (owner decision §0.5).

**Page numbers (second pass, after all content):**

```ts
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i += 1) {
  doc.switchToPage(range.start + i);
  doc.font('Helvetica').fontSize(FOOTER_SIZE).fillColor('#666666')
     .text(`Page ${i + 1} / ${range.count}`,
           PAGE_MARGIN, doc.page.height - PAGE_MARGIN + 4,
           { width: doc.page.width - PAGE_MARGIN * 2, align: 'center' });
}
```

Comment that writing into the bottom margin is intentional and that `flushPages()` must not be
called before this loop.

Return `toBuffer(doc)`.

Also update the file's existing `toBuffer` comment: it says "and S25's exports" as a forward
reference — that is now true, so change "S25's exports" to "the S25 export renderer below".

---

## §C — POS receipt: 80 mm thermal

§C1 (public store header), §C2 (print helper) and §C3 (print CSS) are **shared with §K's repair
receipt** — build them once here, and §K consumes them unchanged.

### C1. `Apps/api/src/modules/platform/platform.mapper.ts` — `toPublicSettingsDto`

```ts
  // SETTINGS_PUBLIC — the public-safe subset of an already-assembled SettingsDto. S25 added
  // `store` (see the schema comment in platform.dtos.ts for why the shop header is public);
  // `invoicing` and `delivery` remain internal.
  static toPublicSettingsDto(settings: SettingsDto): PublicSettingsDto {
    const dto: PublicSettingsDto = { store: settings.store, storefront: settings.storefront };
    return PublicSettingsResponseSchema.parse(dto);
  }
```

`platform.service.ts`'s `getPublicSettings` needs no change — it already builds the full
`SettingsDto` and hands it to the mapper.

**Frontend ripple:** none required. `platform.service.ts`'s `getPublicSettings` and
`usePlatform.ts`'s `usePublicSettings` are both typed off `PublicSettingsDto` and pick up `store`
for free. `qk.platform.publicSettings()` is unchanged. Verify no existing consumer of
`usePublicSettings` breaks — it is additive, so none should.

### C2. New file `Apps/web/src/lib/print.ts`

**Shared by two receipts** — the POS receipt (§C4) and the repair receipt (§K). Both are 80 mm
thermal and both go through this one helper; do not fork it.

```ts
// S25 — printing an 80 mm thermal receipt. Two callers: the POS receipt (PosReceiptView) and the
// repair receipt (RepairReceipt). Both mark their printable subtree with RECEIPT_ROOT_CLASS.
//
// `@page` is a document-level at-rule: it cannot be scoped by a class or an :is()/:has() selector.
// So the roll size is injected as a <style> element for the duration of one print and removed
// afterwards, and everything that CAN be selector-scoped is gated on `body.printing-receipt` in
// index.css. Without this, Ctrl+P anywhere in the app — and the /staff/sales Reprint and
// /staff/invoices Print buttons, which still print a whole A4 page on purpose (S25 owner
// decision) — would come out on an 80 mm page. Same scoping lesson as S22 finding F1.
//
// A class, not an id, because two components declare a root. They live on different routes and
// are never mounted at the same time; if that ever changes, both would print and the fix is to
// pass the wanted root in rather than to widen this.
export const RECEIPT_ROOT_CLASS = 'receipt-print-root';
const STYLE_ID = 'receipt-page-style';
const BODY_CLASS = 'printing-receipt';
const RECEIPT_PAGE_CSS = '@page { size: 80mm auto; margin: 0; }';
```

`export function printReceipt(): void`:

1. `teardown()` first (idempotent, guards a double-click while a previous print is open).
2. Create `<style id={STYLE_ID}>` with `RECEIPT_PAGE_CSS`, append to `document.head`.
3. `document.body.classList.add(BODY_CLASS)`.
4. Register `window.addEventListener('afterprint', teardown, { once: true })`.
5. Safety net: `setTimeout(teardown, 60_000)` — `afterprint` is not fired by every browser/driver
   combination, and leaving the class on would make the app's own screen render wrong on the next
   Ctrl+P. 60 s is long enough that it can never fire while the print dialog is still open.
6. `window.print()`.

`teardown()` removes the style element if present and drops the body class — safe to call any
number of times. Do **not** call it synchronously after `window.print()`: the call is not reliably
blocking, and tearing the style down early yields a blank or A4 page.

### C3. `Apps/web/src/index.css` — the receipt print block

Append (the file currently has no `@media print` rule at all — S22 removed the last one):

```css
/* S25 — 80 mm thermal receipts (POS and repair). Every rule is gated on `body.printing-receipt`,
   which lib/print.ts adds only for the duration of a receipt's own window.print() call. The
   companion `@page { size: 80mm auto }` is injected by that same helper because @page cannot be
   selector-scoped. Anything else in the app that prints keeps the browser's default A4 page and
   its normal whole-page render — /staff/sales Reprint and /staff/invoices Print rely on that.

   visibility, not display, for the *masking*: `display: none` on an ancestor would take the
   receipt out of flow with it, so the subtree could never be shown again by a descendant rule.
   visibility:hidden is inherited but individually overridable, which is what this needs.

   The root's own hiding is the opposite case and must be `display`, below. */

/* Hidden at all times on screen, and hidden during any print that is NOT a gated receipt print —
   so Ctrl+P on /staff/repairs with the ticket sheet open does not sneak the receipt into the A4
   page. Deliberately NOT Tailwind's `hidden` class on the element and NOT the `print:block`
   variant: `hidden` is display:none, which the print rule below would have to fight with
   !important, and `print:block` is not gated on the body class, so it would leak into every
   other print. */
.receipt-print-root {
  display: none;
}

@media print {
  body.printing-receipt * {
    visibility: hidden;
  }
  body.printing-receipt .receipt-print-root,
  body.printing-receipt .receipt-print-root * {
    visibility: visible;
  }
  body.printing-receipt .receipt-print-root {
    display: block;
    position: absolute;
    inset: 0 auto auto 0;
    width: 80mm;
    padding: 3mm;
    color: #000;
    background: #fff;
    font-family: ui-monospace, "Courier New", monospace;
    font-size: 11px;
    line-height: 1.35;
  }
}
```

**`display: block` in the print rule is load-bearing.** `visibility: visible` alone cannot reveal
a `display: none` element — the two properties are independent, and a receipt root that is hidden
by `display` and revealed only by `visibility` prints a **blank page**. Both receipts hit this.

**The containing-block trap (§K depends on this).** `position: absolute` resolves against the
nearest ancestor with a `transform`, `filter` or `contain` — not against the page. A Radix
`SheetContent` animates with a `transform`, so a receipt root rendered *inside* the repair sheet
would be positioned relative to the sheet and print clipped or off-page. §K therefore renders its
root as a **sibling of** `<Sheet>`, not inside it. The POS receipt has no transformed ancestor and
is unaffected. Note this in the CSS comment — it is invisible in code review and painful to debug.

### C4. `Apps/web/src/pages/staff/pos/components/PosReceiptView.tsx` — rewrite

Keep it **props-only** (its header comment says "Dumb, props-only" — that stays true; do not add a
hook here).

New props on top of the existing six:

```ts
  reference: string;
  lines: ReceiptDto["lines"];
  issuedAt: string;                  // ISO, captured by StaffPos when the sale confirmed
  store?: PublicSettingsDto["store"]; // optional — the settings query may still be in flight
```

Import `ReceiptDto` and `PublicSettingsDto` as types from `@dragon-telecom/contract`.

The component renders **two** subtrees:

**(a) The on-screen card** — today's markup, unchanged in shape, plus a lines list above the
`total` row (product name, `xN`, line total; serial numbers under the name in muted small text
when present). This is what the cashier sees; it is not the printed artefact.

**(b) The print-only receipt**, `<div className={RECEIPT_ROOT_CLASS}>` (imported from
`@/lib/print`). Do **not** add Tailwind's `hidden` — §C3's base rule already hides the class at
all times and its print rule is the only thing that reveals it. Contents, top to bottom, single
column, no table wider than the roll:

1. `store.logoUrl` when present — `<img>` at `max-width: 40mm`, centred. Comment: a remote R2 URL
   may not finish loading before the print dialog paints; the store name below is always text, so
   the header is never empty.
2. `store.name` — bold, centred.
3. `store.address`, `store.phone` — centred, when present.
4. A dashed rule.
5. `t("staff.pos.receipt.reference")`: `reference`, and `formatDateTime(issuedAt, language)`.
6. A dashed rule.
7. The lines: **one line per row is not enough at 80 mm.** Use two rows per line — the product
   name on its own full-width row (wrapping), then a second row with `qty × unitPrice` on the left
   and `lineTotal` right-aligned. Serial numbers, when present, on a third indented row at 10 px.
8. A dashed rule.
9. The five money rows, in today's exact order and with today's exact translation keys:
   `staff.pos.ticket.total`, `staff.pos.receipt.previousCredit`, `staff.pos.receipt.grandTotal`
   (bold), `staff.pos.receipt.paid`, `staff.pos.receipt.newCredit`. Each is
   `label … formatDZD(value, language)` right-aligned via `justify-between`.
10. `t("staff.pos.receipt.thankYou")`, centred, with `6mm` of bottom padding so the roll advances
    past the tear bar.

**No barcode of the sale reference** — the brief says so explicitly. Do not import `jsbarcode`
here.

### C5. `Apps/web/src/pages/staff/pos/StaffPos.tsx`

- Import `printReceipt` from `@/lib/print` and `usePublicSettings` from `@/hooks/usePlatform`.
- Add `const [receiptAt, setReceiptAt] = useState<string | null>(null);` beside the existing
  `receipt` state (line ~109).
- In the `onSuccess` at line ~326, alongside `setReceipt(receiptResult)`, add
  `setReceiptAt(new Date().toISOString())`. Comment why the timestamp is captured here and not
  derived at render: the receipt view stays mounted until "New sale", so a render-time `new Date()`
  would creep forward on every re-render.
- Clear `setReceiptAt(null)` wherever `setReceipt(null)` is called (the `onNewSale` handler at
  line ~443 and `resetTicketState`'s site at line ~368).
- `const publicSettings = usePublicSettings();`
- Replace `onPrint={() => window.print()}` with `onPrint={printReceipt}`, and pass the new props:
  `reference={receipt.reference}`, `lines={receipt.lines}`, `issuedAt={receiptAt ?? new Date().toISOString()}`,
  `store={publicSettings.data?.store}`.

**Do not touch** `StaffSales.tsx:247` or `StaffInvoices.tsx:232`. Their bare `window.print()` is
out of scope by owner decision §0.3.

---

## §D — CSV audit and fixes

Three real defects were confirmed by reading the code; each fix is listed with the behaviour it
produces. The brief's other CSV concerns (columns, completeness) are addressed inline.

### D1. Delivery fees — the button downloads an XLSX payload named `.csv`

**Defect.** `delivery-fees-section.tsx:131` calls `exportFees.mutate({})` — no `format` — so
`platform.service.ts:290` falls through to its `?? 'excel'` default and returns an
`xlsx.writeBuffer()`. The frontend then saves it as `downloadBlob("delivery-fees.csv", blob)`. The
user gets an XLSX file with a `.csv` extension; Excel warns, and a text editor shows a ZIP header.
The button's own label (`admin.settings.delivery.exportExcel`) is the only honest part.

**Fix, backend** — `Apps/api/src/modules/platform/platform.service.ts` `exportFees`:

- CSV branch: build with `toCsv(FEE_ROW_HEADERS, rows.map(...))`; `mime: CSV_MIME`. Money via
  `csvMoney`. A wilaya/commune name is not in this export (it is a code round-trip file for the
  importer) so the escaping matters less here than elsewhere, but it goes through the same writer
  so the BOM lands and the file opens with correct accents if a name column is ever added.
- New `'pdf'` branch, placed after the CSV branch (see §F2).
- The excel branch is unchanged.

**Fix, frontend** — `delivery-fees-section.tsx`: replace the single Export button with the shared
`ExportMenu` (§G) carrying three items — CSV, Excel, PDF — each passing an explicit `format` and
each saving under the **matching** extension: `delivery-fees.csv`, `delivery-fees.xlsx`,
`delivery-fees.pdf`. The existing `admin.settings.delivery.exportExcel` key is reused for the
Excel item; two new keys for CSV and PDF (§H).

**Filters:** this screen has none (the table is client-paginated only, no search box), so the
export is the full set and that is correct. The PDF's title block will state "Filters: none".

### D2. Stock levels — the export deliberately ignores the active filters

**Defect.** `Apps/web/src/services/inventory.service.ts:36` sends `params: { export: "csv" }` and
nothing else; its comment says so outright ("Sends no filters"). The backend
(`inventory.service.ts` `getStock`) applies `search` and `lowStockOnly` *before* the CSV branch and
would honour them. So an admin who filters to "low stock only" and clicks Export gets **every**
product — the exact defect the brief names.

**Fix, backend** — `getStock`'s export branch:

- Build via `toCsv(STOCK_ROW_CSV_HEADERS, filtered.map(...))`, `mime: CSV_MIME`.
- `avgStockPrice` and `stockValue` through `csvMoney`; the quantity and threshold columns are
  integers and pass through as numbers; `isLow` is a boolean and `escapeField` renders it
  `true`/`false`. `barcode` keeps its `?? ''`.
- The header list `STOCK_ROW_CSV_HEADERS` is already complete against `StockRowDto` — no column
  changes.
- Apply the `EXPORT_MAX_ROWS` guard (§E3's helper) before serialising.
- Add the `'pdf'` branch (§F3).

**Fix, frontend:**

- `services/inventory.service.ts` — `exportStockCsv()` becomes
  `exportStock(query: Omit<StockQuery, "export">, format: "csv" | "pdf"): Promise<Blob>`, sending
  `{ ...query, export: format }`. **Replace the stale "Sends no filters" comment** (rule 4) with
  one stating the export now mirrors the table's own query.
- `hooks/useInventory.ts` — `useExportStockCsv` becomes `useExportStock`, mutation variables
  `{ query, format }`.
- `AdminInventory.tsx` — `handleExportCsv` becomes `handleExportStock(format)`, passing the same
  `stockQuery` memo the table is rendered from (so search + lowStockOnly always agree with what is
  on screen), and saving as `stock.csv` / `stock.pdf`.
- `stock-levels-table.tsx` — the `onExportCsv?: () => void` prop becomes
  `onExport?: (format: "csv" | "pdf") => void`, and the single Button becomes `ExportMenu` (§G).

### D3. Statistics reports — JSON escaping, and columns derived from the first row only

**Defect A (escaping).** `statistics.service.ts:1440` `toCsvExport` writes
`JSON.stringify(value ?? '')`. JSON escapes an inner `"` as `\"`; CSV requires `""`. A client named
`Ets "El Fath"` produces a field no spreadsheet parses correctly. Newlines inside a value get
JSON's `\n` escape rather than a quoted literal newline — different, but also wrong. Numbers come
out bare (fine) and `null` becomes `""`, an empty *quoted* field where an unquoted empty is
conventional.

**Defect B (columns).** `const headers = dto.rows.length > 0 ? Object.keys(dto.rows[0]!) : []` —
the union problem S24 already fixed on the UI side (report-picker.tsx's A9 comment). The
`client-browsing` report emits two row shapes (`{kind:'search',query,count}` and
`{kind:'viewedNoPurchase',productId,productName,viewCount}`); the CSV renders whichever shape
happens to be first and silently drops the other group's columns.

**Defect C (totals).** `dto.totals` is not exported at all. S24 (A4) established that the repairs
report's `recognizedRevenue`/`Cost`/`Profit` live *only* in `totals` — its rows no longer carry
them — so the CSV of the repairs report currently contains none of its D8-correct money.

**Fix** — rewrite `toCsvExport`:

```ts
  // S25 — was JSON.stringify-per-field (JSON escaping, not CSV: an inner quote came out \" where
  // CSV needs ""), with headers taken from rows[0] alone. Columns are now the union of every
  // row's keys in first-seen order — the same fix S24/A9 applied to report-picker.tsx, and for
  // the same reason (client-browsing emits two row shapes). `totals` is appended after a blank
  // line as label,value pairs: S24/A4 established that the repairs report's recognised revenue,
  // cost and profit exist ONLY in totals, so a rows-only CSV of that report carries no money at
  // all. The trailing block costs strict rectangularity; Excel reads it fine and the alternative
  // is exporting a report without its headline figures.
```

- `const headers = [...new Set(dto.rows.flatMap((row) => Object.keys(row)))]`.
- Rows: `headers.map((h) => row[h] as CsvValue)` — `escapeField` handles string/number/boolean/
  null/undefined. A non-primitive value (none is emitted today) would stringify as `[object Object]`;
  guard it to `''` and comment that no current report emits one.
- Body: `toCsv(headers, rows)`, then when `Object.keys(dto.totals).length > 0`, append
  `CSV_EOL` + a `toCsv(['Total', 'Value'], totalsRows)` **without** its BOM. Export a
  `toCsvSection(headers, rows)` from `csv.utils.ts` (BOM-free) for exactly this, so the BOM is
  never emitted twice — a second BOM mid-file shows up as a stray `` character in Excel.
- `mime: CSV_MIME`.
- Apply `EXPORT_MAX_ROWS` to `dto.rows.length`.

**Filters:** the report card sends `{ from, to }` and those already reach the CSV — correct today,
keep it. Per §0.6, do not add `familyId`/`source`.

### D4. Encoding, line endings and BOM — all three exports

Delivered by §B1 for all four CSVs at once: UTF-8 BOM, CRLF, RFC 4180 quoting, `YYYY-MM-DD HH:mm`
UTC dates, 2-dp decimals. No per-module work beyond routing through `toCsv`.

---

## §E — Movement ledger CSV (new)

### E1. Contract

Done in §A4 (`MovementsQuerySchema.export`).

### E2. `Apps/api/src/modules/inventory/inventory.interface.ts`

`listMovements(query: MovementsQuery): Promise<PaginatedResult<MovementDto> | ExportResult>` —
same dual-return shape `getStock` already has, with a comment pointing at it as the precedent.

### E3. `Apps/api/src/modules/inventory/inventory.service.ts` — `listMovements`

Add a shared private guard first, next to `STOCK_ROW_CSV_HEADERS`:

```ts
// S25 — every export in this module is a single in-memory document, so an unbounded result set
// would hold the request open while it serialised. Callers ask for EXPORT_MAX_ROWS + 1 rows and
// hand the count here; the sentinel reaches the user as a translated message via
// query-client.ts's SENTINEL_TRANSLATION_KEYS, telling them to narrow the filters.
const assertExportSize = (total: number): void => {
  if (total > EXPORT_MAX_ROWS) {
    throw new BadRequestError(EXPORT_ERROR.ROW_LIMIT_EXCEEDED, { limit: EXPORT_MAX_ROWS, total });
  }
};
```

`BadRequestError` is already imported in this file. Apply the same guard in `getStock`'s export
branch (§D2).

Then, in `listMovements`, **after** the `where` is built and **before** the paginated
`Promise.all`:

```ts
    if (query.export) {
      // `page`/`limit` carry schema defaults and are ignored here on purpose (contract comment on
      // MovementsQuerySchema.export): an export of only the page on screen is the defect S25 fixes.
      const movements = await this.prisma.stockMovement.findMany({
        where,
        include: { product: { select: { name: true } }, staff: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: EXPORT_MAX_ROWS + 1,   // one extra row is what makes the ceiling detectable
      });
      assertExportSize(movements.length);
      const items = /* identical label resolution + mapping as the paginated branch below */;
      return query.export === 'pdf' ? this.movementsPdf(items, query) : this.movementsCsv(items);
    }
```

**Extract the label-resolution + mapping block into a private helper** rather than duplicating it —
the paginated branch and the export branch must produce identical `MovementDto`s, and
`resolveReferenceLabels`'s RETURN fallback chain (documented at length in that method) is exactly
the kind of logic that drifts when copied. Add
`private async toMovementDtos(movements): Promise<MovementDto[]>` holding today's
`resolveReferenceLabels` call plus the `.map`, and call it from both branches.

`movementsCsv(items: MovementDto[]): ExportResult`:

```ts
const MOVEMENT_ROW_CSV_HEADERS = [
  'createdAt', 'reference', 'referenceType', 'type', 'direction',
  'productId', 'productName', 'quantity', 'unitCost', 'costOfGoods',
  'profit', 'balanceAfter', 'staffName', 'reason',
];
```

`createdAt` via `csvDate`; `unitCost`/`costOfGoods`/`profit` via `csvMoney` when present, empty
string when absent (they are optional on `MovementDto` — a PENDING row has no cost); `reference` is
`referenceLabel` (the human `ORD-…`/`SAL-…`/`FAC-…` string RC-4 resolves), and `referenceType` is
kept beside it so a spreadsheet can filter by document class. `filename: 'movements.csv'`,
`mime: CSV_MIME`.

### E4. `Apps/api/src/modules/inventory/inventory.controller.ts` — `listMovements`

Add the export branch, copying `getStock`'s exactly (lines 13-18): `if ('body' in result)` → set
`Content-Type`/`Content-Disposition: attachment` → `res.status(200).send(result.body)`; otherwise
`sendSuccess`. `attachment` (not `inline`) — a ledger export is always a download, never previewed
in place, matching S22's `streamPdf` reasoning in `catalog.controller.ts`.

### E5. `Apps/web/src/services/inventory.service.ts`

```ts
// Bypasses the envelope (backend streams the body directly) — same pattern as exportStock above.
// `page`/`limit` are stripped: the export is the whole filtered ledger, never the page on screen.
export async function exportMovements(
  query: Omit<MovementsQuery, "export" | "page" | "limit">,
  format: "csv" | "pdf",
): Promise<Blob>
```

`api.get(apiPath(INVENTORY_ROUTES.MOVEMENTS), { params: { ...query, export: format }, responseType: "blob" })`.

Note: `MovementsQuery`'s `page`/`limit` are non-optional after `.default()`, so `Omit` is the right
tool and the backend's own defaults fill them harmlessly.

### E6. `Apps/web/src/hooks/useInventory.ts`

```ts
export function useExportMovements() {
  return useMutation({
    mutationFn: ({ query, format }: { query: Omit<MovementsQuery, "export" | "page" | "limit">; format: "csv" | "pdf" }) =>
      inventoryService.exportMovements(query, format),
  });
}
```

A mutation, not a query — it triggers a download and is not cacheable. Same reasoning as the
existing `useExportStockCsv` comment.

### E7. `Apps/web/src/pages/admin/inventory/AdminInventory.tsx` + `movement-ledger-table.tsx`

- In `AdminInventory.tsx`, derive the export query from the same source as `movementsQuery` but
  without pagination:

```ts
  // Same filters the ledger table is rendered from, minus page/limit — the export is the whole
  // filtered result set (S25), never the visible page.
  const movementsExportQuery = useMemo(
    () => ({ ...movementFilters, search: debouncedMovementSearch.trim() || undefined }),
    [movementFilters, debouncedMovementSearch],
  );
```

- `handleExportMovements(format)` → `exportMovements.mutate({ query: movementsExportQuery, format },
  { onSuccess: (blob) => downloadBlob(\`movements.${format}\`, blob) })`.
- `movement-ledger-table.tsx` gains an optional `onExport?: (format: "csv" | "pdf") => void` and
  renders `ExportMenu` (§G) in its toolbar, mirroring `stock-levels-table.tsx`'s placement.

### E8. `Apps/web/src/lib/query-client.ts`

Extend `SENTINEL_TRANSLATION_KEYS`:

```ts
  [EXPORT_ERROR.ROW_LIMIT_EXCEEDED]: "common.errors.sentinel.exportRowLimitExceeded",
```

Import `EXPORT_ERROR` from `@dragon-telecom/contract` alongside the existing `CATALOG_ERROR`.

---

## §F — PDF exports

All four reuse `renderTablePdf` (§B2). None adds a route; each extends its existing `adminOnly`
endpoint with a `pdf` format value (§0.6).

### F1. Prerequisite

§B2 must be complete.

### F2. Delivery fees — `platform.service.ts` `exportFees`, new `'pdf'` branch

- Columns (portrait, 4 columns fit comfortably): `Wilaya` (weight 3), `Commune` (3),
  `Home delivery` (2, right), `Office delivery` (2, right).
- The CSV/Excel branches export **codes** because they round-trip through the importer; the PDF is
  read by a human, so emit `fee.wilaya.frName` and `fee.commune?.frName ?? '—'`. `include: { wilaya: true, commune: true }`
  already loads both — no extra query. Comment the divergence so nobody "fixes" it back to codes.
- Money via `.toFixed(2)`.
- `title: 'Delivery fees'`, `filters: []`, `orientation: 'portrait'`.
- `filename: 'delivery-fees.pdf'`, `mime: 'application/pdf'`.
- Apply `EXPORT_MAX_ROWS` to `rows.length` (58 wilayas plus overrides will never approach it, but
  the guard is uniform).

### F3. Stock levels — `inventory.service.ts` `getStock`, `export === 'pdf'`

- **Landscape** — nine columns.
- Columns: `Product` (5), `Barcode` (3), `On hand` (2, right), `Reserved` (2, right),
  `Available` (2, right), `Avg stock price` (3, right), `Stock value` (3, right),
  `Threshold` (2, right), `Low` (1.5).
- `avgStockPrice`/`stockValue` via `.toFixed(2)`; `isLow` as `'Yes'`/`'No'`.
- Filter block: `Search: <query.search>` when set, `Low stock only: Yes` when
  `query.lowStockOnly`; empty array when neither, which renders "Filters: none".
- `title: 'Stock levels'`, `filename: 'stock.pdf'`.
- Comment that `avgStockPrice` here is the quantity-weighted figure S23 corrected — never
  `avgPrice`, which is supplier-invoice context only.

### F4. Movement ledger — `inventory.service.ts` `movementsPdf(items, query)`

- **Landscape** — eleven columns.
- Columns: `Date` (3), `Reference` (3), `Type` (3), `Dir` (1.5), `Product` (4),
  `Qty` (1.5, right), `Unit cost` (2.5, right), `Cost of goods` (2.5, right),
  `Profit` (2.5, right), `Balance` (2, right), `Staff` (3). `reason` is dropped from the PDF —
  it is free text of unbounded length and would force wrapping, which §B2's fixed-row-height
  pagination forbids; the CSV carries it in full. **Comment that trade-off** at the column list.
- `Date` via the same `YYYY-MM-DD HH:mm` UTC form as the CSV (reuse `csvDate` — it is a general
  formatter despite the name; note that in its own comment).
- Optional money columns render `''` when absent.
- Filter block: resolve the ids to names so the header is readable —
  - `query.productId` → one `prisma.product.findUnique({ select: { name: true } })` → `Product: <name>`
  - `query.staffId` → one `prisma.staff.findUnique({ select: { firstName, lastName } })` → `Staff: <first last>`
  - `query.type` → `Type: <type>`; `query.from`/`query.to` → `From:`/`To:`; `query.search` → `Search:`.
  - Both lookups are skipped when the filter is unset. Comment that printing a raw UUID in the
    title block is useless, which is why the two extra reads are worth it.
- `title: 'Stock movement ledger'`, `filename: 'movements.pdf'`.

### F5. Statistics reports — `statistics.service.ts`

- In `getReport`, after `buildReport`, branch on `query.format`: `CSV` → `toCsvExport` (§D3),
  `PDF` → a new `private toPdfExport(type, dto, query): Promise<ExportResult>`, otherwise the DTO.
  `getReport`'s return type is already `Promise<ReportDto | ExportResult>` — unchanged.
- `toPdfExport`:
  - Columns = the same **union of every row's keys, first-seen order** as §D3. Headers are the raw
    field names — the `REPORT_COLUMN_KEY` label map lives in the frontend
    (`Apps/web/src/pages/admin/statistics/report-columns.ts`) and the backend must not import
    across apps. Comment that explicitly, with the §0.6 note that server-rendered document text is
    English literals by established precedent.
  - Equal weight `1` per column; `orientation: columns.length > 6 ? 'landscape' : 'portrait'`.
  - Cell values: `String(value)` with `null`/`undefined` → `''`; non-integer numbers to 2 dp.
  - `chart: dto.chart` — §B2 skips it automatically when empty or all-zero.
  - `totals: Object.entries(dto.totals).map(([label, value]) => ({ label, value: String(value) }))`.
  - Filters: `From:`/`To:` from `query`. For `ReportType.AGEING`, emit
    `Note: point-in-time snapshot — the date range does not apply` instead — S24 (A11) established
    that `reportAgeing` takes no range at all, and the UI already says so
    (`admin.statistics.reports.ageingSnapshotNote`). A PDF that printed a date range on an ageing
    report would be lying.
  - `title` = the report type humanised (`type.replace(/-/g, ' ')` with an initial capital);
    `filename: \`${type}.pdf\``, `mime: 'application/pdf'`.
  - `assertExportSize(dto.rows.length)` — declare the same guard locally in this module
    (statistics has no shared error helper with inventory; both import `EXPORT_MAX_ROWS` and
    `EXPORT_ERROR` from the contract).
- `statistics.controller.ts` `getReport` needs **no change** — its `'body' in result` branch already
  streams any `ExportResult`. Confirm and leave alone.
- Frontend `services/statistics.service.ts`: rename `exportReportCsv` →
  `exportReport(type, query, format: ReportFormat.CSV | ReportFormat.PDF)`, sending
  `{ ...query, format }`. Update the comment that says "format=csv".
- `hooks/useStatistics.ts`: `useExportReportCsv` → `useExportReport`, variables gain `format`.
- `report-picker.tsx`: replace the single Export CSV button with `ExportMenu` (§G), saving
  `${type}.csv` / `${type}.pdf`. Keep the existing `disabled={... || rows.length === 0}` guard.

---

## §G — Shared frontend export menu

### G1. New file `Apps/web/src/components/shared/ExportMenu.tsx`

One dropdown used by all four export surfaces, so a fifth export never invents a fifth toolbar
idiom. Built on `@/components/ui/dropdown-menu` (already in the project; see `LanguageToggle.tsx`
and `OrderActionsMenu.tsx` for the idiom).

```ts
export type ExportMenuItem = {
  key: string;          // stable react key, e.g. "csv" | "xlsx" | "pdf"
  labelKey: string;     // translation key — the caller owns the wording
  onSelect: () => void;
};

interface ExportMenuProps {
  items: ExportMenuItem[];
  disabled?: boolean;
  isPending?: boolean;  // renders the "exporting…" label and blocks the trigger
}
```

- Trigger: `<Button variant="outline" size="sm">` with a `Download` icon and
  `t("common.actions.export")`, or `t("common.actions.exporting")` while `isPending`; `disabled`
  when `disabled || isPending`.
- Content: `align="end"`, one `DropdownMenuItem` per entry rendering `t(item.labelKey)`.
- Comment that the caller supplies the labels because the format set differs per surface (delivery
  fees also offers Excel, to pair with its Excel importer).

### G2. Consumers

| File | Items |
|---|---|
| `pages/admin/settings/components/delivery-fees-section.tsx` | CSV, Excel (`admin.settings.delivery.exportExcel`, reused), PDF |
| `pages/admin/inventory/components/stock-levels-table.tsx` | CSV, PDF |
| `pages/admin/inventory/components/movement-ledger-table.tsx` | CSV, PDF |
| `pages/admin/statistics/components/report-picker.tsx` | CSV, PDF |

The now-unused `admin.inventory.stock.exportCsv` and `admin.statistics.reports.exportCsv` keys are
**reused** as the CSV menu items — do not delete them and do not add duplicates.

---

## §H — Translations (`Apps/web/src/config/translations.json`)

The file is a **flat map of dotted keys** to `{ en, fr, ar }`. Every one of its 2953 existing
entries has `"ar": ""` — new keys follow that convention exactly.

| Key | en | fr |
|---|---|---|
| `common.actions.export` | Export | Exporter |
| `common.actions.exporting` | Exporting… | Exportation… |
| `common.errors.sentinel.exportRowLimitExceeded` | This export is too large. Narrow the filters and try again. | Cet export est trop volumineux. Affinez les filtres et réessayez. |
| `common.export.csv` | Export CSV | Exporter en CSV |
| `common.export.pdf` | Export PDF | Exporter en PDF |
| `staff.pos.receipt.reference` | Receipt no. | Reçu n° |
| `staff.pos.receipt.item` | Item | Article |
| `staff.pos.receipt.serials` | Serial no. | N° de série |
| `staff.pos.receipt.thankYou` | Thank you for your visit | Merci de votre visite |
| `admin.inventory.movements.export.csv` | Export CSV | Exporter en CSV |
| `admin.inventory.movements.export.pdf` | Export PDF | Exporter en PDF |
| `admin.settings.delivery.exportCsv` | Export CSV | Exporter en CSV |
| `admin.settings.delivery.exportPdf` | Export PDF | Exporter en PDF |
| `admin.statistics.reports.exportPdf` | Export PDF | Exporter en PDF |
| `admin.inventory.stock.exportPdf` | Export PDF | Exporter en PDF |

`common.export.csv`/`common.export.pdf` exist for any future surface; the four consumers above use
their own namespaced keys where one already exists (`admin.inventory.stock.exportCsv`,
`admin.statistics.reports.exportCsv`, `admin.settings.delivery.exportExcel`) so no existing key is
orphaned.

**Reused unchanged:** `staff.pos.ticket.total`, `staff.pos.receipt.previousCredit`,
`staff.pos.receipt.grandTotal`, `staff.pos.receipt.paid`, `staff.pos.receipt.newCredit`,
`staff.pos.receipt.print`, `staff.pos.receipt.newSale`, `staff.pos.receipt.title`.

### H2. Repair receipt keys (§K)

| Key | en | fr |
|---|---|---|
| `staff.repairs.receipt.print` | Print receipt | Imprimer le reçu |
| `staff.repairs.receipt.title` | Repair ticket | Bon de réparation |
| `staff.repairs.receipt.reference` | Ticket no. | Bon n° |
| `staff.repairs.receipt.intakeAt` | Received on | Reçu le |
| `staff.repairs.receipt.status` | Status | Statut |
| `staff.repairs.receipt.customer` | Customer | Client |
| `staff.repairs.receipt.device` | Device | Appareil |
| `staff.repairs.receipt.imei` | IMEI | IMEI |
| `staff.repairs.receipt.issues` | Reported issues | Pannes signalées |
| `staff.repairs.receipt.diagnosis` | Diagnosis | Diagnostic |
| `staff.repairs.receipt.technician` | Technician | Technicien |
| `staff.repairs.receipt.parts` | Parts | Pièces |
| `staff.repairs.receipt.labour` | Labour | Main-d'œuvre |
| `staff.repairs.receipt.partsTotal` | Parts total | Total pièces |
| `staff.repairs.receipt.total` | Total | Total |
| `staff.repairs.receipt.paid` | Paid | Payé |
| `staff.repairs.receipt.due` | Amount due | Reste à payer |
| `staff.repairs.receipt.statusPaid` | PAID | PAYÉ |
| `staff.repairs.receipt.statusPartial` | PARTIALLY PAID | PARTIELLEMENT PAYÉ |
| `staff.repairs.receipt.statusUnpaid` | UNPAID | NON PAYÉ |
| `staff.repairs.receipt.invoiceNumber` | Invoice no. | Facture n° |
| `staff.repairs.receipt.serials` | Serial no. | N° de série |
| `staff.repairs.receipt.footer` | Please keep this ticket — it is required to collect your device | Conservez ce bon — il est exigé pour retirer votre appareil |

**Reused unchanged:** `staff.repairs.board.intake` / `.processing` / `.completed` / `.pickedUp` /
`.cancelled` (via `REPAIR_STATUS_LABEL_KEY`), and the nine
`staff.repairs.intake.issue.*` keys (via the `ISSUE_LABEL_KEY` map §K1 extracts). Add no
duplicates of either set.

---

## §I — Execution order

1. §A (contract) — everything imports from it.
2. §B1, §B2 (backend utils) — every export depends on them.
3. §D1, §D2, §D3 (CSV fixes) — backend then frontend per item.
4. §E (movement ledger CSV) — new end-to-end slice.
5. §F2–F5 (PDF branches) — each sits beside the CSV branch it mirrors.
6. §G (ExportMenu) then rewire the four consumers.
7. §C (POS receipt) — independent of everything above; can be done in parallel but is listed here
   so the export work lands as one coherent change. **§C1 (public store header), §C2 (print
   helper) and §C3 (print CSS) are prerequisites of §K** — build them once, use them twice.
8. §K (repair receipt) — after §C2/§C3 exist. Nothing else depends on it.
9. §H (translations) — as each consumer is wired.
10. Validation gate: `tsc --noEmit` in `Apps/contract`, `Apps/api`, `Apps/web`, plus lint on every
    touched file. **No test file is read, edited or run.**

---

## §J — Manual verification checklist (browser)

### POS receipt — 80 mm

1. `/staff/pos` as STAFF: ring up a sale with **three lines**, one of them a serialised product,
   confirm it. The on-screen receipt card now lists the three lines above the five money rows, and
   the five rows read exactly as before.
2. Click **Print** → the print preview shows a **narrow single-column receipt**, roughly 80 mm
   wide, with no page margins and **no sidebar, header or navigation**.
3. The receipt top carries the **store name, address and phone from Settings → Store**, and the
   logo if one is configured.
4. It carries the **sale reference** and a **date/time**, then the three lines (name, then
   `qty × price` and line total), then the five money rows in today's order, then "Thank you for
   your visit".
5. **No barcode anywhere on the receipt.**
6. Change the store name in `/admin/settings` → Store, return to the POS, print a new receipt →
   the new name appears.
7. Print on the actual thermal printer: the content fits the roll without truncation on the right,
   and the paper advances past the tear bar.

### Print regression — the other two buttons are untouched

8. `/staff/sales` → **Reprint** on a sale → prints the **whole A4 page** exactly as it did before
   this set (not an 80 mm strip).
9. `/staff/invoices` → **Print** on an invoice → same: whole A4 page, unchanged.
10. `Ctrl+P` on `/admin/products` with nothing open → the page prints normally on A4.
11. Print a POS receipt, close the dialog, then immediately `Ctrl+P` on the same page → **A4
    again**, not 80 mm. (This is the teardown working; if it stays 80 mm, `afterprint` never fired.)

### Delivery fees

12. `/admin/settings` → Delivery fees → **Export** now opens a menu with **CSV, Excel, PDF**.
13. **Excel** → downloads `delivery-fees.xlsx` (was `.csv` with XLSX content — the bug) and opens
    in Excel without a format warning.
14. **CSV** → downloads `delivery-fees.csv`; opening it in Excel shows **accented wilaya names
    correctly** (not `Ã©`), one value per column.
15. **PDF** → downloads `delivery-fees.pdf`: portrait, title "Delivery fees", "Filters: none", a
    generation timestamp, wilaya and commune **names** (not codes), and `Page 1 / N` at the foot of
    every page. Scroll to page 2 → the **header row repeats**.

### Stock levels

16. `/admin/inventory` → Stock tab: type a search that matches a handful of products, and tick
    **Low stock only**.
17. **Export → CSV** → the file contains **only the filtered rows**, not the whole catalogue.
    (Before this set it always contained everything.)
18. Give a product a name containing a comma and a double quote (e.g. `Écran "OLED", 6.5"`), then
    export → that name occupies **one column**, with the quotes intact, and the following columns
    are not shifted.
19. **Export → PDF** → landscape, nine columns, the title block lists `Search: …` and
    `Low stock only: Yes`, and the row count matches the filtered table.

### Movement ledger — new

20. `/admin/inventory` → Movements tab: filter by a product, a movement type and a date range.
21. The toolbar now has an **Export** menu (it had none before).
22. **CSV** → `movements.csv` containing **every** matching movement, not just page 1. Cross-check
    the row count against the table's pagination total.
23. Clear the filters and export again → the row count grows accordingly.
24. **PDF** → `movements.pdf`: landscape, the title block naming the product, type and date range
    **by name** (not a UUID), repeated header row, page numbers.
25. Confirm the ledger export contains **no reservation rows appearing as stock in/out** beyond
    what the on-screen table shows — the export uses the same `where` clause, so the two must agree
    exactly.

### Statistics reports

26. `/admin/statistics`: set a date range, pick **Sales by client**.
27. **Export → CSV** → open in Excel: a client name containing a double quote renders correctly in
    one cell (this was `\"`-escaped before and broke the row).
28. Pick **Client browsing** (the two-row-shape report) and export CSV → the header row contains
    the columns of **both** shapes, and neither group's cells are blank.
29. Pick **Repairs** and export CSV → after the rows there is a blank line and a **Totals** block
    carrying recognised revenue, cost and profit. (These exist only in `totals`; the old CSV had
    none of them.)
30. **Export → PDF** on Sales by product → the PDF opens with the **bar chart** at the top, the
    table below, the totals block after it, the date range in the title block, and page numbers.
31. Pick **Ageing** and export PDF → the title block says the report is a **point-in-time
    snapshot** and does **not** print a date range.

### Row ceiling

32. With more than 5000 movements in the database, export the ledger with no filters → a toast
    reads "This export is too large. Narrow the filters and try again.", **no file downloads**, and
    the request returns promptly rather than hanging.
33. Apply a date filter that brings it under 5000 → the export succeeds.

### Permissions

34. As a **STAFF** user, `/admin/inventory`, `/admin/statistics` and `/admin/settings` remain
    unreachable, and `GET /admin/inventory/movements?export=csv` with a staff token answers
    **403**.
35. As a STAFF user the POS receipt still prints with the full store header — confirming
    `SETTINGS_PUBLIC` now carries it. `GET /platform/settings` (the admin one) still answers **403**
    to that same token.

---

## §K — Repair receipt (added by owner request, 2026-08-12)

Print a repair ticket from the repair detail sheet, **at every status**, carrying the customer,
the device, the parts, the labour price and the paid state.

### K0. Audit result — what already exists, and what does not

**Nothing is missing from the data layer.** `RepairResponseSchema`
(`Apps/contract/src/modules/repairs/repairs.dtos.ts`) already carries every field this receipt
needs. **Make no contract change, no Prisma change, no migration, no new endpoint, and no new
hook** for this section:

| Receipt needs | Field on `RepairDto` |
|---|---|
| Client name / phone | `customerName`, `customerPhone` |
| Type of phone | `device.brand.name`, `device.model.name`, `device.label` (all optional) |
| IMEI if found | `device.imei` (optional) |
| Products if found | `parts[]` → `productName`, `quantity`, `unitPrice`, `lineTotal`, `serialNumbers` |
| Labour price if set | `labourPrice` (plus `partsTotal`, `totalAmount`) |
| Paid or not | `paidAmount` vs `totalAmount` |
| Every step | `status` |
| Ticket identity / date | `reference`, `intakeAt` |
| Extras already present | `diagnosis`, `reportedIssues`, `reportedIssueOther`, `technician`, `invoiceNumber` |

`useRepair(scope, id)` in `StaffRepairs.tsx` already fetches the whole DTO for the open ticket —
the sheet renders from it today.

**One component serves both pages.** `AdminRepairs.tsx` is exactly
`return <StaffRepairs scope="admin" />;`, and both scopes render the same
`RepairTicketDetail.tsx` sheet. A print action added there appears on `/admin/repairs` **and**
`/staff/repairs` with no second wiring.

### K1. Extract the reported-issue label map

`ISSUE_LABEL_KEY` is currently module-private inside
`Apps/web/src/pages/staff/repairs/components/IntakeDialog.tsx:35-45`. The receipt needs the same
map, and `repair-status-labels.ts` already exists in this cluster as the "single source of truth
for label keys … was duplicated across files before this extraction" (its own header comment).

- **Move** `ISSUE_LABEL_KEY` into `Apps/web/src/pages/staff/repairs/repair-status-labels.ts`,
  exported as `REPORTED_ISSUE_LABEL_KEY`, keeping all nine entries byte-identical.
- Import it back into `IntakeDialog.tsx`; delete the local const. Extend that file's header
  comment to cover the second map.
- **Do not invent new issue translation keys** — the nine `staff.repairs.intake.issue.*` keys
  already exist and are already translated.

### K2. New file `Apps/web/src/pages/staff/repairs/components/RepairReceipt.tsx`

Props-only, no hooks, mirroring `PosReceiptView`'s print subtree (§C4b):

```ts
interface RepairReceiptProps {
  repair: RepairDto;
  store?: PublicSettingsDto["store"];   // optional — the settings query may still be in flight
}
```

Renders exactly one thing: `<div className={RECEIPT_ROOT_CLASS}>` (imported from `@/lib/print`).
No on-screen markup of its own — the sheet already shows all of this; this component exists only
to be printed. Add no Tailwind `hidden`: §C3's base rule hides the class already.

**Hard rule — never print margins.** `repairs.mapper.ts:79,98` gate `totalProfit` and per-part
`costOfGoods`/`profit` behind `includeMargins`, so an **admin** viewing the sheet genuinely
receives them in the DTO. This receipt is handed to the customer. It must render
**none** of `totalCost`, `totalProfit`, `part.costOfGoods`, `part.profit`, in either scope. State
that in the component's header comment — the fields are right there on the object and the next
person will otherwise add them without thinking. The `scope` prop is deliberately **not** passed
in: the receipt is scope-independent by design, and having no scope to branch on makes the leak
impossible rather than merely discouraged.

**Layout**, top to bottom, single column, nothing wider than the roll:

1. `store.logoUrl` when present — `<img>`, `max-width: 40mm`, centred. Same caveat as §C4: a
   remote R2 URL may not load before the dialog paints, so the name below is always text.
2. `store.name` bold centred; `store.address`, `store.phone` centred when present.
3. Dashed rule.
4. `t("staff.repairs.receipt.title")` centred, bold.
5. `t("staff.repairs.receipt.reference")` + `repair.reference` — large monospace, the line the
   customer quotes at pickup. Then `intakeAt` via `formatDateTime(repair.intakeAt, language)` and
   `t(REPAIR_STATUS_LABEL_KEY[repair.status])`.
6. Dashed rule. **Customer:** `customerName`, `customerPhone`.
7. **Device:** `[device.brand?.name, device.model?.name].filter(Boolean).join(" ")`, falling back
   to `device.label` when both refs are absent, and omitting the whole row when all three are
   (every one of them is optional on the DTO). `IMEI: <imei>` on its own row only when present.
8. **Reported issues** when `reportedIssues.length > 0` — the translated labels joined with `·`,
   with `reportedIssueOther` appended when `reportedIssues` includes `ReportedIssue.OTHER` and the
   free-text field is set.
9. **Diagnosis** when `diagnosis` is a non-empty string. **Technician** when `technician` is set.
10. Dashed rule. **Parts** when `parts.length > 0` — two rows per part, exactly as §C4's line
    layout: name on a full-width wrapping row, then `qty × unitPrice` left and `lineTotal` right;
    serial numbers on a third indented 10 px row when present. Omit the whole block when there
    are no parts (a ticket at INTAKE normally has none).
11. **Labour** as a `label … value` row **only when `repair.labourPrice > 0`** — this is the
    "if the price of labour is set" condition. `labourPrice` is `@default(0)`, never null, so test
    `> 0` and not `!= null`.
12. **Totals:** `partsTotal` (only when parts exist), `labour` (only when > 0), then
    `total` = `totalAmount`, bold.
13. **Paid state**, always shown at every status:
    - `t("staff.repairs.receipt.paid")` → `formatDZD(repair.paidAmount, language)`
    - `t("staff.repairs.receipt.due")` → `formatDZD(repair.totalAmount - repair.paidAmount, language)`,
      shown only when that difference is `> 0`
    - a boxed stamp line derived as: `paidAmount >= totalAmount && totalAmount > 0` → `statusPaid`;
      `paidAmount > 0` → `statusPartial`; otherwise → `statusUnpaid`. Comment the
      `totalAmount > 0` guard: a fresh INTAKE ticket has `total = 0` and `paid = 0`, and stamping
      that "PAID" would be wrong — it is UNPAID until there is something to pay.
14. `invoiceNumber` row when present (PICKED_UP tickets only).
15. `t("staff.repairs.receipt.footer")` centred, with `6mm` bottom padding so the roll advances
    past the tear bar.

All money through `formatDZD(value, language)`, all dates through `formatDateTime(iso, language)`,
all text through `t()` — these are browser strings, so rule 2 applies in full here (unlike the
server-rendered PDFs of §B2).

### K3. `RepairTicketDetail.tsx` — the print button and the receipt root

- New prop `store?: PublicSettingsDto["store"]`, passed straight through to `RepairReceipt`.
- Import `printReceipt` from `@/lib/print` and `Printer` from `lucide-react`.
- **Button placement:** in the sheet header row beside the title, as a `variant="outline"
  size="sm"` button labelled `t("staff.repairs.receipt.print")` with the `Printer` icon. It is
  **outside every `!readOnly` guard** — a PICKED_UP or CANCELLED ticket must still print, which is
  what "in every step" means. Verify against the existing `readOnly` blocks at
  `RepairTicketDetail.tsx:154` (remove-part), `:162` (add-part form), `:253` (record payment) and
  `:297` (status button): the print button is a sibling of none of them.
- **Render `<RepairReceipt>` as a sibling of `<Sheet>`, inside the existing top-level fragment** —
  next to `<RecordRepairPaymentDialog>`, *not* inside `<SheetContent>`. §C3 explains why: Radix
  animates `SheetContent` with a `transform`, which becomes the containing block for the receipt's
  `position: absolute` and would print it clipped or off-page.
- The component already early-returns `if (!repair) return null;` at line 81, so `RepairReceipt`
  can take a non-nullable `repair`.

### K4. `StaffRepairs.tsx` — supply the store header

- `const publicSettings = usePublicSettings();` (from `@/hooks/usePlatform`; §C1 puts the `store`
  block on that response).
- Pass `store={publicSettings.data?.store}` to `<RepairTicketDetail>`.
- Nothing else changes: `selectedRepair` from `useRepair(scope, selectedRepairId ?? "")` is
  already the full `RepairDto` the receipt needs, and `AdminRepairs` inherits all of it through
  `<StaffRepairs scope="admin" />`.

### K5. What §K explicitly does not do

- **Does not touch the invoice.** A PICKED_UP repair still has its own `Invoice` (source `REPAIR`)
  and its existing server-rendered PDF. The repair receipt is a second, different document,
  available at every status; it neither replaces nor suppresses the invoice PDF.
- **No barcode or QR** of the repair reference (owner decision) — the reference prints as large
  monospace text. Do not import `jsbarcode` or call S22's label renderer here.
- **No per-status document variants** (owner decision) — one template, conditional sections.
- **No backend work at all**: no route, no controller, no service, no mapper, no DTO.

---

## §L — Manual verification checklist: repair receipt

Run after §J. Do all of it as **STAFF** first, then spot-check 41–42 as ADMIN.

36. `/staff/repairs` → open a ticket at **INTAKE** (no parts, no labour set yet) → the detail
    sheet header now shows a **Print receipt** button.
37. Click it → the print preview shows a **narrow 80 mm receipt**: store header, "Repair ticket",
    the reference in large monospace, the intake date, status **Intake**, the customer's name and
    phone, and the device with its IMEI if one was captured.
38. That same INTAKE preview shows **no parts block** and **no labour row** (neither is set), and
    the paid stamp reads **UNPAID** — not "PAID", even though paid and total are both zero.
39. Move the ticket to **PROCESSING**, add **two parts** and set a **labour price**. Print again →
    both parts appear with `qty × price` and line totals, the **Labour** row appears with the
    price you set, and the totals read parts total + labour = total.
40. Set the labour price back to **0** and print → the **Labour row disappears** entirely, and the
    total drops to the parts total.
41. Record a **partial** payment → the stamp reads **PARTIALLY PAID** and an **Amount due** row
    shows the remainder. Record the rest → the stamp reads **PAID** and the Amount due row is gone.
42. Take the ticket to **PICKED_UP** → the print button is **still there** (the ticket is now
    read-only, and add-part / record-payment / change-status are all correctly hidden), the
    receipt prints with status **Picked up**, and an **Invoice no.** row appears.
43. **CANCELLED** ticket → the print button is still present and the receipt still prints.
44. A ticket for a device with **no IMEI** → the IMEI row is absent, not an empty label. Same for
    a ticket with no diagnosis and no technician.
45. A ticket whose device has **only a free-text label** (no brand/model refs) → the device row
    shows that label rather than a blank.
46. Reported issues print as **translated labels** ("Charging", "Display"), never as raw enum
    values like `water-damage`. Tick **Other** with free text at intake → the free text appears.
47. **Margin leak check — the important one.** Log in as **ADMIN**, open `/admin/repairs`, open a
    ticket with parts, and confirm the on-screen sheet **does** show per-part profit (it is
    admin-gated and should). Print → the receipt shows **no profit, no cost, anywhere**. Compare
    the two side by side.
48. Switch the language to **FR** and print → every label on the receipt is French, including the
    status, the reported issues and the paid stamp.
49. **Print scoping regression:** with the repair sheet open, press **Ctrl+P** (do not use the
    button) → the browser prints the **normal A4 page**, and the receipt does **not** appear
    anywhere in it.
50. Print a repair receipt, close the dialog, then print a **POS** receipt from `/staff/pos` →
    both come out correctly at 80 mm and neither bleeds into the other.
51. Print on the actual thermal printer: the ticket fits the roll with no right-hand truncation,
    long product names wrap rather than clip, and the paper advances past the tear bar.
