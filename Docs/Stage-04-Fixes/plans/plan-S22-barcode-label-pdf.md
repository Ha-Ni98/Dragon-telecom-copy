# Plan S22 — Barcode label printing as PDF

**Scope:** move the S19 product-page label printing from the browser print view to a **server-side
PDF**, and add the same capability to **supplier invoices** (all lines, editable per-line quantity,
barcode-less products skipped).

**Sets that must land first:** none. S22 is the first of S22→S25 and depends only on S19 (merged).
S25 will extend the PDF utility this set consolidates — run S22 first, as the brief states.

**Schema / migration:** **none.** `Product.barcode` (`String? @unique`) and
`SupplierInvoiceLine.{productId,quantity,productNameSnapshot}` are already exactly what this set
reads. No `prisma migrate`, no `prisma generate`, no mapper change in `purchasing`.

---

## 0. What was read, and the decisions that follow

Everything below was verified against the code, not assumed. The executor must not re-derive any
of it.

### 0.1 The existing PDF infrastructure (this is the stack to reuse)

| Layer | File | Shape |
|---|---|---|
| Renderer | `Apps/api/src/common/utils/pdf.utils.ts` | `renderInvoicePdf(data): Promise<Buffer>` — builds a `PDFDocument({size:'A4',margin:50})`, collects `data` chunks into `Buffer[]`, resolves on `end`, rejects on `error`. **PDFKit `^0.19.1` + `@types/pdfkit ^0.17.6` are already dependencies of `Apps/api`.** |
| Result type | `Apps/api/src/modules/billing/billing.interface.ts:16` | `export type PdfResult = { filename: string; mime: 'application/pdf'; body: Buffer }` — *not* a contract DTO; the comment records that PDFs deliberately bypass the `ApiResponse<T>` envelope. |
| Controller | `billing.controller.ts:131` | `private streamPdf(res, pdf)` → sets `Content-Type`, `Content-Disposition: inline; filename="…"`, then `res.send(pdf.body)`. Not `sendSuccess`. |
| Web service | `Apps/web/src/services/billing.service.ts:44,74` | `api.get<Blob>(url, { responseType: "blob" })`, returns `res.data` — no envelope unwrap. |
| Web hook | `Apps/web/src/hooks/useBilling.ts:38,68` | `useMutation` (imperative, "not cacheable domain data"). |
| Web consumer | `InvoiceDetail.tsx:18`, `StaffInvoices.tsx:92` | `onSuccess: (blob) => downloadBlob(\`${number}.pdf\`, blob)`, using `downloadBlob` from `Apps/web/src/lib/utils.ts:34`. |

**S22 follows this chain exactly**, in the `catalog` module instead of `billing`.

### 0.2 Barcode symbology and library — **decided**

- **Symbology: Code 128.** A generated barcode is 9 *alphanumeric* characters
  (`BARCODE_LENGTH = 9`, `catalog.constants.ts:7`), which EAN-13/UPC (fixed-length numeric) cannot
  encode. This is unchanged from S19.
- **Library: `bwip-js@^4.11.2` (MIT), added to `Apps/api`.** It is **not currently a dependency**
  of any package; `Apps/web` has `jsbarcode@^3.12.3` (browser-only, needs a DOM — unusable in Node).
  `bwip-js` has **zero runtime dependencies** and no native build step.
- **Vector, not raster.** `bwipjs.raw('code128', value)` returns the *module widths* of the symbol;
  the bars are then drawn as PDFKit rectangles. This was prototyped and verified: 1000 labels
  render in **76 ms** into a **180 KB**, 25-page PDF, crisp at any printer resolution. An embedded
  PNG per label would be ~2.8 MB for the same run and resolution-bound.
- **This is not a second PDF stack.** PDFKit remains the only PDF library; `bwip-js` is a barcode
  *encoder* that emits numbers, not a renderer.

**Import form — verified, do not change it.** `bwip-js`'s ESM build exports a *named* `raw` that is
the **`raw` symbology**, not the raw-encoding helper — the bundled `.d.ts` does not distinguish
them, so `import { raw } from 'bwip-js/node'` type-checks and then **fails at runtime**. The
encoding helper is only reachable through the default export:

```ts
import bwipjs from 'bwip-js/node';
const encoded = bwipjs.raw('code128', value);
```

This was compiled against `Apps/api/tsconfig.json` verbatim (`module: Preserve`,
`moduleResolution: bundler`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`) and it passes: `module: Preserve` implies `esModuleInterop`, so the default
import of an `export =` d.ts is legal. **Do not add `@types/bwip-js`** (none exists; the package
ships its own).

### 0.3 `bwipjs.raw()` output — the exact contract

`bwipjs.raw('code128', 'DIIP00001')` returns `[{ sbs, bbs, bhs, txt }]`:

- `sbs` — alternating **bar/space widths in modules, starting with a bar**. Verified: the Code 128
  Start-B pattern `11010010000` appears as the first six entries `[2,1,1,2,1,4]`. For a 9-character
  value it has 67 entries summing to 123 modules.
- `bbs` / `bhs` — per-bar baseline offset and height multiplier. For Code 128 every entry is `0`
  and `1` respectively (guard-bar extensions are an EAN/UPC concept), so **all bars are drawn full
  height** and `bbs`/`bhs` are ignored.
- `sbs` does **not** include quiet zones — the layout must add them (this plan adds 10 modules
  each side).

TypeScript note: `raw()`'s declared return type is a **union** with a pixel-based variant, and
`noUncheckedIndexedAccess` makes `sbs[i]` possibly `undefined`. The narrowing that compiles cleanly
is spelled out in **B2** — use it verbatim.

### 0.4 Label geometry — **fixed here, as the brief requires**

Prototyped and rasterised to confirm it tiles correctly:

| Quantity | Value | Why |
|---|---|---|
| Page | **A4 portrait**, `PDFDocument({ size: 'A4', margin: 0 })` | Margin 0 because every element is placed at explicit mm coordinates. |
| Page margin | **8 mm** | Same figure S19's `@page { margin: 8mm }` used. |
| Label box | **40 mm × 25 mm** | S19 owner decision **Q4**, unchanged. |
| Gutter | **2 mm** both axes | S19's `gap-[2mm]`. |
| Grid | **4 columns × 10 rows = 40 labels per A4 page** | `floor((210−16+2)/(40+2)) = 4`, `floor((297−16+2)/(25+2)) = 10`. Matches S19's documented "~40 per A4 page" and keeps S19 checklist item 17 valid. |
| Label side padding | **1 mm** | Leaves 38 mm drawable. |
| Quiet zone | **10 modules each side**, inside the 38 mm | Code 128 minimum. Module width = 38 mm ÷ (123 + 20) ≈ **0.266 mm** (10.5 mil) for a 9-char value — comfortably above the 0.25 mm floor for handheld scanners. |
| Bars | top at label-top + **3 mm**, height **15 mm** | |
| Text | value in **Helvetica 8 pt**, centred, drawn at label-top + **19 mm** | 19 mm + ~2.8 mm cap height = 21.8 mm < 25 mm. |
| Border | **none** | A printed rectangle is wrong on die-cut sheets and noise on plain paper. |

Label content is **the Code 128 symbol plus its human-readable characters, nothing else** — S19
owner decision **Q4** ("nothing on the label can go stale, and there is no single correct price").
Both entry points produce byte-identical labels because both call the same renderer.

### 0.5 Finding **F1** — S19's print CSS blanks *every* other print in the app

`Apps/web/src/index.css:172-190` ships:

```css
@media print {
  body > *:not(#barcode-print-root) { display: none !important; }
  #barcode-print-root { display: block !important; }
}
```

`#barcode-print-root` is portalled into `<body>` **only while the label dialog is open**
(`barcode-label-dialog.tsx:100-110`). When it is absent, `body > *:not(#barcode-print-root)`
matches **every** direct child of `<body>`, so `Ctrl+P` — and every existing print button — prints
a **blank page**. The affected call sites are `StaffPos.tsx:442` (POS receipt),
`StaffSales.tsx:247` (sale reprint) and `StaffInvoices.tsx:232` (invoice print).

S22 removes the rule outright (the label sheet is a PDF now, so nothing needs it). **This also
unblocks S25**, which reformats the POS receipt as a browser print view and would otherwise have
had to fight this selector. Recorded here so the report can state it was a real fix, not
housekeeping.

### 0.6 Endpoint design — and why the supplier-invoice DTO is *not* touched

The dialog must list the invoice's lines and **omit** those whose product has no barcode, with a
count of what was omitted. `SupplierInvoiceDto.lines` carries `productId`, `productNameSnapshot`
and `quantity` but **no barcode**, so the barcodes have to come from somewhere.

Three options were weighed; the chosen one is stated so the executor does not "improve" it:

- ✗ **Add `productBarcode` to `SupplierInvoiceResponseSchema.lines`.** Purchasing reaches catalog
  only through the injected `ICatalogRepricePort` (`purchasing.interface.ts:44-68`), and its one
  read method `getCostBasis` is called **only on DRAFT invoices**
  (`purchasing.service.ts:659`, guarded at :655). Since S7 made Save = create + confirm, invoices
  are essentially always CONFIRMED, so this would mean a new unconditional port call on every
  `getInvoice` **and** every `listInvoices` item — a hot-path cost for one dialog.
- ✗ **`include: { product: { select: { barcode: true } } }` in purchasing.** A cross-module Prisma
  read that bypasses the port the module deliberately established.
- ✓ **Catalog serves barcodes, because catalog owns them.** Two new admin endpoints in the
  catalog module; **`Apps/api/src/modules/purchasing/**` and `Apps/contract/src/modules/purchasing/**`
  are not touched by this set at all.**

| Route constant | URL | Method | Purpose |
|---|---|---|---|
| `CATALOG_ROUTES.BARCODE_LOOKUP` | `/admin/products/barcode-lookup` | `POST` | `{ productIds }` → `{ items: [{ productId, name, barcode }] }`, **only for products with a printable barcode**. The dialog derives its skip count from what is missing. |
| `CATALOG_ROUTES.BARCODE_LABELS` | `/admin/products/barcode-labels` | `POST` | `{ items: [{ productId, quantity }] }` → `application/pdf`. |

Both serve **both** entry points: the product page posts a single item, the supplier invoice posts
one item per printable line **in line order**.

### 0.7 Decisions taken (assumptions, stated rather than asked)

| # | Decision | Rationale |
|---|---|---|
| **A1** | **Both endpoints are `adminOnly`.** | Checked against the S18 parity work: there is **no** staff supplier-invoices page, and `StaffProducts.tsx` / `StaffProductsTable.tsx` are read-only with **no actions column** — S19 put label printing on the admin products list only. Nothing staff-visible needs it. |
| **A2** | **Confirming downloads the PDF** (`downloadBlob`), it does not auto-open a print dialog. | This is the established behaviour of every other PDF in the app (`InvoiceDetail.tsx:18`, `StaffInvoices.tsx:92`). Auto-printing would need a hidden-iframe or `window.open` dance that popup blockers break after an async request. **Called out in the verification checklist as a deliberate behaviour change from S19.** |
| **A3** | **The on-screen single-label preview stays** in the product dialog, still rendered by `jsbarcode`. | S22 says "the dialog keeps its current shape". `jsbarcode` stays a `Apps/web` dependency for the preview only; it renders no PDF, so the one-stack rule is intact. The supplier dialog shows barcode *values* as text, not symbols — a symbol per line would be noise. |
| **A4** | **Non-ASCII / unencodable barcodes are treated exactly like a missing barcode** (skipped, counted). | `Product.barcode` is admin-typed free text and Code 128 covers ASCII 0x20–0x7E only; `bwipjs.raw()` throws on anything else. One shared predicate (`isPrintableBarcode`, **B3**) is used by *both* endpoints so the dialog's skip count always matches what the PDF actually contains. |
| **A5** | **A print run is capped at 1000 labels across at most 100 lines**, on top of S19's existing per-line cap of 200. | An unbounded run must not hang the request. 1000 labels = 25 pages = 76 ms / 180 KB (measured), so the ceiling is generous. |
| **A6** | The action on a supplier invoice lives on the **detail/editor page header**, not as a row action in the list. | The brief says "add a print-barcodes action to *the supplier invoice*". "Regardless of status" means it is not gated the way *Record payment* is (which is hidden on DRAFT, `AdminSupplierInvoiceEditor.tsx:274`). |

---

# Part A — Contract (`Apps/contract`)

### A1 — `src/modules/catalog/catalog.constants.ts`

**A1.1** Update the now-stale S19 comment on `BARCODE_LABEL_MAX_QUANTITY` (lines 18-20). It says
the cap guards against "rendering tens of thousands of SVG symbols and freezing the tab" — labels
are rendered server-side as of S22. Replace those three lines with:

```ts
// Upper bound on the labels one *line* may ask for. S19 set it while the sheet was rendered
// client-side as SVG; S22 moved rendering to a server-side PDF, so the cap now bounds the work the
// API does per line rather than what the tab can survive. See BARCODE_LABEL_SHEET_MAX_TOTAL for
// the whole-run bound.
export const BARCODE_LABEL_MAX_QUANTITY = 200;
```

**A1.2** Append, after `BARCODE_LABEL_MAX_QUANTITY`:

```ts
// S22 — bounds on one label-sheet request. Named here because the API validates against them and
// the dialogs must disable Confirm on the same figures rather than letting the user submit into a
// 400. 1000 labels is 25 A4 pages (40 per page) and renders in well under 100 ms, so the ceiling
// exists to keep the request bounded, not because the renderer is slow.
export const BARCODE_LABEL_SHEET_MAX_ITEMS = 100;
export const BARCODE_LABEL_SHEET_MAX_TOTAL = 1000;

// S22 — bound on one barcode-lookup request. A supplier invoice with more product lines than this
// does not exist in practice; the cap only stops an unbounded id list reaching the database.
export const BARCODE_LOOKUP_MAX_IDS = 200;
```

**A1.3** Add two members to the existing `CATALOG_ERROR` map (keep the existing two, keep the
existing comment above it):

```ts
export const CATALOG_ERROR = {
  BARCODE_TAKEN: 'BARCODE_TAKEN',
  BARCODE_GENERATION_EXHAUSTED: 'BARCODE_GENERATION_EXHAUSTED',
  // S22 — every requested product turned out to have no printable barcode, so the sheet would be
  // an empty PDF. The dialogs prevent this, so it is a defence against a stale client, not a
  // routine path.
  BARCODE_LABELS_EMPTY: 'BARCODE_LABELS_EMPTY',
  // S22 — the run exceeds BARCODE_LABEL_SHEET_MAX_TOTAL. Raised by the request schema's refine so
  // it travels the same sentinel path as the others rather than as an English zod sentence.
  BARCODE_LABEL_TOTAL_EXCEEDED: 'BARCODE_LABEL_TOTAL_EXCEEDED',
} as const;
```

### A2 — `src/modules/catalog/catalog.routes.ts`

Add to `CATALOG_ROUTES`, immediately after `GENERATE_BARCODE` (line 19):

```ts
  // S22 — barcode label printing. Both are POSTs: BARCODE_LOOKUP takes an id array (too long for a
  // query string) and BARCODE_LABELS takes a per-line quantity map. Both are literal segments
  // under "/admin/products" and must be registered before ADMIN_PRODUCT_BY_ID for the same reason
  // PRODUCT_STATS and GENERATE_BARCODE are (see catalog.routes.ts in the api).
  BARCODE_LOOKUP: '/admin/products/barcode-lookup',
  BARCODE_LABELS: '/admin/products/barcode-labels',
```

### A3 — `src/modules/catalog/catalog.command.ts`

The file already imports `z`. Add the constants import at the top (there is none today):

```ts
import {
  BARCODE_LABEL_MAX_QUANTITY,
  BARCODE_LABEL_SHEET_MAX_ITEMS,
  BARCODE_LABEL_SHEET_MAX_TOTAL,
  BARCODE_LOOKUP_MAX_IDS,
  CATALOG_ERROR,
} from './catalog.constants';
```

Append immediately after `GenerateBarcodeSchema`/`GenerateBarcodeCommand` (line 96), before
`CreateBrandSchema`:

```ts
// S22 — which of these products actually have a printable barcode. The response omits the rest,
// and the caller reports the difference as "N lines skipped" — the absence is never silent.
// Duplicate ids are tolerated (a supplier invoice may list one product on two lines); the service
// de-duplicates before querying.
export const BarcodeLookupSchema = z.object({
  productIds: z.array(z.uuid()).min(1).max(BARCODE_LOOKUP_MAX_IDS),
});
export type BarcodeLookupCommand = z.infer<typeof BarcodeLookupSchema>;

// S22 — one label-sheet request. `items` is ordered and may repeat a productId: the sheet is laid
// out in exactly this order, which for a supplier invoice is invoice-line order.
export const BarcodeLabelSheetSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.uuid(),
          quantity: z.number().int().min(1).max(BARCODE_LABEL_MAX_QUANTITY),
        }),
      )
      .min(1)
      .max(BARCODE_LABEL_SHEET_MAX_ITEMS),
  })
  // Cross-field, so it cannot live on the array element. The message is a contract sentinel, not a
  // sentence, so the web side can translate it (query-client.ts's SENTINEL_TRANSLATION_KEYS).
  .refine(
    (value) => value.items.reduce((total, item) => total + item.quantity, 0) <= BARCODE_LABEL_SHEET_MAX_TOTAL,
    { message: CATALOG_ERROR.BARCODE_LABEL_TOTAL_EXCEEDED, path: ['items'] },
  );
export type BarcodeLabelSheetCommand = z.infer<typeof BarcodeLabelSheetSchema>;
```

> `validateRequest` types its schemas as `z.ZodType` (`validate-request.middleware.ts:4`), so a
> refined schema is accepted — no change needed there.

### A4 — `src/modules/catalog/catalog.dtos.ts`

Append after `GeneratedBarcodeResponseSchema`/`GeneratedBarcodeDto` (line 153):

```ts
// S22 — the answer to BarcodeLookupSchema. Only products with a printable barcode appear, so
// `barcode` is required here (unlike Product.barcode, which is nullable). `name` is the current
// catalog name; the supplier-invoice dialog still shows its own productNameSnapshot, and only
// falls back to this.
export const BarcodeLookupResponseSchema = z.object({
  items: z.array(
    z.object({
      productId: z.uuid(),
      name: z.string(),
      barcode: z.string(),
    }),
  ),
});
export type BarcodeLookupDto = z.infer<typeof BarcodeLookupResponseSchema>;
```

No change to `src/modules/catalog/index.ts` — `catalog.constants`, `catalog.routes`,
`catalog.command` and `catalog.dtos` are all already re-exported.

---

# Part B — Backend (`Apps/api`)

### B1 — Add the dependency

```
cd Apps/api && npm install bwip-js@^4.11.2
```

- MIT, **zero runtime dependencies**, no native build.
- **Do not install `@types/bwip-js`** — no such package; `bwip-js` ships `dist/bwip-js-node.d.ts`
  and it resolves cleanly under this repo's `tsconfig.json` (verified).

### B2 — `Apps/api/src/common/utils/pdf.utils.ts` — consolidate, then add the label sheet

**B2.1 — Extract the shared plumbing.** Replace the top of the file (imports + the promise
scaffolding currently inlined in `renderInvoicePdf`) so both renderers share it. The final file
starts:

```ts
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js/node';

// PDFKit works in PostScript points; every dimension in this file is authored in millimetres and
// converted here. 1 in = 25.4 mm = 72 pt.
const MM = 72 / 25.4;

// Shared by every renderer in this file (S22): buffer the document's own stream and resolve once
// it has ended. Extracted from renderInvoicePdf so the label sheet — and S25's exports — reuse one
// piece of plumbing rather than re-implementing the chunk collection.
const toBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
```

**B2.2 — Rewrite `renderInvoicePdf`'s body to use it.** Keep `InvoicePdfLine`, `InvoicePdfData` and
the existing block comment above the function **unchanged**; only the wrapper changes — the layout
statements are copied across verbatim, `doc.end()` is dropped (it moved into `toBuffer`):

```ts
export const renderInvoicePdf = (data: InvoicePdfData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  doc.fontSize(18).text(data.store.name);
  // …every existing statement, unchanged, down to:
  doc.text(`Paid: ${data.paidAmount.toFixed(2)}`);

  return toBuffer(doc);
};
```

**B2.3 — Append the label sheet renderer.** Everything below is new, at the end of the file:

```ts
// --- S22: Code 128 barcode label sheet ---

// Owner decision Q4 (S19) fixed the label at 40 x 25 mm carrying the symbol and its human-readable
// characters and nothing else. S22 fixes the sheet around it: A4 portrait, 8 mm page margin, 2 mm
// gutter -> 4 columns x 10 rows = 40 labels per page, which is what S19's browser sheet produced.
const LABEL_WIDTH_MM = 40;
const LABEL_HEIGHT_MM = 25;
const SHEET_MARGIN_MM = 8;
const LABEL_GUTTER_MM = 2;
const LABEL_COLUMNS = 4;
const LABEL_ROWS = 10;
const LABELS_PER_PAGE = LABEL_COLUMNS * LABEL_ROWS;

// Inside one label.
const LABEL_PADDING_MM = 1; // leaves 38 mm drawable
const BARS_TOP_MM = 3;
const BARS_HEIGHT_MM = 15;
const TEXT_TOP_MM = 19;
const TEXT_SIZE_PT = 8;
// Code 128 requires a quiet zone of at least 10 modules on each side. It is *not* part of what
// bwipjs.raw() returns, so it is added to the module budget here: with a 9-character value the
// symbol is 123 modules, giving 38 mm / 143 = 0.266 mm per module — above the ~0.25 mm floor a
// handheld scanner needs. A longer barcode narrows the bars proportionally.
const QUIET_ZONE_MODULES = 10;

export type BarcodeLabelRequest = { barcode: string; quantity: number };

// Bar/space widths in modules for one Code 128 symbol, starting with a bar.
//
// bwip-js's ESM build exports a *named* `raw` that is the "raw" symbology, NOT this encoder — only
// the default export carries it, and the bundled .d.ts does not distinguish the two. Import it as
// a default or it type-checks and then throws at runtime.
//
// raw() is declared as a union with a pixel-based variant and the array index is possibly
// undefined under noUncheckedIndexedAccess, hence the two guards below.
const barcodeModules = (value: string): number[] => {
  const encoded = bwipjs.raw('code128', value);
  const first = encoded[0];
  if (first == null || !('sbs' in first)) return [];
  return first.sbs;
};

// One label at (x, y) in points. bbs/bhs are ignored on purpose: for Code 128 every bar is
// full-height (guard-bar extensions are an EAN/UPC concept), so only the widths matter.
const drawBarcodeLabel = (doc: PDFKit.PDFDocument, x: number, y: number, value: string): void => {
  const sbs = barcodeModules(value);
  if (sbs.length === 0) return;

  const totalModules = sbs.reduce((sum, width) => sum + width, 0) + QUIET_ZONE_MODULES * 2;
  const drawableWidth = (LABEL_WIDTH_MM - LABEL_PADDING_MM * 2) * MM;
  const moduleWidth = drawableWidth / totalModules;

  let cursorX = x + LABEL_PADDING_MM * MM + QUIET_ZONE_MODULES * moduleWidth;
  doc.save().fillColor('#000000');
  for (let index = 0; index < sbs.length; index += 1) {
    const width = (sbs[index] ?? 0) * moduleWidth;
    // sbs alternates bar, space, bar, … starting with a bar — even indices are the bars.
    if (index % 2 === 0) doc.rect(cursorX, y + BARS_TOP_MM * MM, width, BARS_HEIGHT_MM * MM).fill();
    cursorX += width;
  }
  doc.restore();

  doc
    .font('Helvetica')
    .fontSize(TEXT_SIZE_PT)
    .fillColor('#000000')
    .text(value, x, y + TEXT_TOP_MM * MM, { width: LABEL_WIDTH_MM * MM, align: 'center' });
};

// Server-side counterpart of what S19 printed from the browser — the single source of label
// layout, so the products list and the supplier invoice cannot drift apart. `requests` is already
// filtered and ordered by the caller (catalog.service.ts): every barcode here is known printable,
// and the order is invoice-line order.
export const renderBarcodeLabelsPdf = (requests: BarcodeLabelRequest[]): Promise<Buffer> => {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });

  let slot = 0;
  for (const request of requests) {
    for (let copy = 0; copy < request.quantity; copy += 1) {
      const position = slot % LABELS_PER_PAGE;
      if (slot > 0 && position === 0) doc.addPage();
      const column = position % LABEL_COLUMNS;
      const row = Math.floor(position / LABEL_COLUMNS);
      drawBarcodeLabel(
        doc,
        (SHEET_MARGIN_MM + column * (LABEL_WIDTH_MM + LABEL_GUTTER_MM)) * MM,
        (SHEET_MARGIN_MM + row * (LABEL_HEIGHT_MM + LABEL_GUTTER_MM)) * MM,
        request.barcode,
      );
      slot += 1;
    }
  }

  return toBuffer(doc);
};
```

### B3 — `Apps/api/src/modules/catalog/catalog.service.ts` — the shared predicate

Add to the **value** imports from `@dragon-telecom/contract`: `CATALOG_ERROR` is already imported;
add nothing else there. Add to the **type** imports: `BarcodeLabelSheetCommand`,
`BarcodeLookupCommand`, `BarcodeLookupDto`.

Add to the top-of-file imports: `import { renderBarcodeLabelsPdf } from '@common/utils/pdf.utils';`
and `import { BadRequestError } from '@common/errors';` (check the existing errors import line —
`NotFoundError` and `ConflictError` are already imported from `@common/errors`; extend that line
rather than adding a second import).

Insert this module-level helper immediately **after** `randomBarcodeDigits()` (the S19 helper),
before `slugify()`:

```ts
// S22 — Code 128 encodes ASCII 0x20–0x7E only, and bwipjs.raw() throws on anything outside it.
// Product.barcode is admin-typed free text, so a barcode that cannot be encoded is treated exactly
// like a missing one: skipped and counted, never a 500. Both the lookup and the sheet renderer go
// through this one predicate, so the dialog's "N skipped" note can never disagree with what the
// PDF actually contains.
const isPrintableBarcode = (barcode: string | null): barcode is string =>
  barcode != null && barcode.length > 0 && /^[\x20-\x7E]+$/.test(barcode);
```

### B4 — `catalog.service.ts` — the two service methods

Add both as public methods on `CatalogProductService`, immediately **after** `generateBarcode()`
(which ends at line 901) and **before** `getCartProducts()`:

```ts
  // S22 — which of these products can actually be printed. Read-only, no transaction. Ids are
  // de-duplicated (a supplier invoice may carry one product on several lines) and the result is
  // returned in the *requested* order, so the caller can zip it back onto its own list without a
  // second sort. Products with no barcode — or with one Code 128 cannot encode — are simply
  // absent; the caller reports the difference.
  async lookupBarcodes(cmd: BarcodeLookupCommand): Promise<BarcodeLookupDto> {
    const uniqueIds = Array.from(new Set(cmd.productIds));
    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, barcode: true },
    });

    const byId = new Map(products.map((product) => [product.id, product]));
    const items = uniqueIds.flatMap((productId) => {
      const product = byId.get(productId);
      if (product == null || !isPrintableBarcode(product.barcode)) return [];
      return [{ productId, name: product.name, barcode: product.barcode }];
    });

    return { items };
  }

  // S22 — the label sheet. Barcodes are resolved here, not taken from the client, so a barcode
  // edited since the dialog opened prints as it is *now*. Unprintable products are dropped with
  // the same predicate lookupBarcodes uses, and `items` order is preserved: for a supplier invoice
  // that is invoice-line order.
  async renderBarcodeLabels(cmd: BarcodeLabelSheetCommand): Promise<PdfResult> {
    const products = await this.prisma.product.findMany({
      where: { id: { in: Array.from(new Set(cmd.items.map((item) => item.productId))) } },
      select: { id: true, barcode: true },
    });
    const barcodeById = new Map(products.map((product) => [product.id, product.barcode]));

    const requests = cmd.items.flatMap((item) => {
      const barcode = barcodeById.get(item.productId) ?? null;
      if (!isPrintableBarcode(barcode)) return [];
      return [{ barcode, quantity: item.quantity }];
    });

    // Every requested product turned out to be unprintable — an empty PDF would look like a
    // failure the user cannot explain. The dialogs never submit this; it guards a stale client.
    if (requests.length === 0) throw new BadRequestError(CATALOG_ERROR.BARCODE_LABELS_EMPTY);

    return {
      filename: 'barcode-labels.pdf',
      mime: 'application/pdf',
      body: await renderBarcodeLabelsPdf(requests),
    };
  }
```

> The `filename` here is only the `Content-Disposition` default; the web side names the download
> itself (`downloadBlob`), exactly as `InvoiceDetail.tsx` does.

### B5 — `Apps/api/src/modules/catalog/catalog.interface.ts`

Add to the type imports from `@dragon-telecom/contract`: `BarcodeLabelSheetCommand`,
`BarcodeLookupCommand`, `BarcodeLookupDto`.

Add above `export interface ICatalogProductService`:

```ts
// Mirrors billing's own PdfResult (billing.interface.ts) rather than sharing it — the same
// deliberate duplication billing's comment records for platform/inventory's ExportResult. PDFs
// bypass the ApiResponse<T> envelope and are streamed by the controller, not sent via sendSuccess.
export type PdfResult = { filename: string; mime: 'application/pdf'; body: Buffer };
```

Add two methods to `ICatalogProductService`, after `generateBarcode(...)`:

```ts
  lookupBarcodes(cmd: BarcodeLookupCommand): Promise<BarcodeLookupDto>;
  renderBarcodeLabels(cmd: BarcodeLabelSheetCommand): Promise<PdfResult>;
```

### B6 — `Apps/api/src/modules/catalog/catalog.controller.ts`

Add `BarcodeLabelSheetCommand` and `BarcodeLookupCommand` to the contract **type** imports, and add
`PdfResult` to the `./catalog.interface` type import line.

Add both handlers at the end of the `// --- Admin: products ---` block, immediately after
`generateBarcode` (which ends at line ~196):

```ts
  lookupBarcodes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.products.lookupBarcodes(req.validated.body as BarcodeLookupCommand));
    } catch (error) {
      next(error);
    }
  };

  renderBarcodeLabels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.streamPdf(res, await this.products.renderBarcodeLabels(req.validated.body as BarcodeLabelSheetCommand));
    } catch (error) {
      next(error);
    }
  };
```

Add the private helper at the very end of the class body (same shape as
`billing.controller.ts:131`, `attachment` rather than `inline` because a label sheet is never
previewed in place — the web side downloads it):

```ts
  // S22 — PDFs bypass the ApiResponse<T> envelope, streamed directly rather than via sendSuccess;
  // the same pattern billing.controller.ts uses for invoice PDFs.
  private streamPdf(res: Response, pdf: PdfResult): void {
    res.setHeader('Content-Type', pdf.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
    res.send(pdf.body);
  }
```

### B7 — `Apps/api/src/modules/catalog/catalog.routes.ts`

Add `BarcodeLabelSheetSchema` and `BarcodeLookupSchema` to the contract import list (it is
alphabetical — they go before `BrandIdParamsSchema`).

Register both **immediately after** the existing `GENERATE_BARCODE` block and **before**
`ADMIN_PRODUCTS`/`ADMIN_PRODUCT_BY_ID`:

```ts
// S22 — BARCODE_LOOKUP and BARCODE_LABELS are literal segments under "/admin/products" and follow
// the same registration rule as PRODUCT_STATS and GENERATE_BARCODE above: literal before
// ADMIN_PRODUCT_BY_ID ("/admin/products/:id"). adminOnly on both — there is no staff supplier-
// invoices page and the staff products list is read-only with no row actions (S18 parity work).
router.post(
  CATALOG_ROUTES.BARCODE_LOOKUP,
  adminOnly,
  validateRequest({ body: BarcodeLookupSchema }),
  controller.lookupBarcodes,
);
router.post(
  CATALOG_ROUTES.BARCODE_LABELS,
  adminOnly,
  validateRequest({ body: BarcodeLabelSheetSchema }),
  controller.renderBarcodeLabels,
);
```

Nothing else changes: the router is mounted, DI is unchanged, `CatalogProductService` already
receives `prisma`.

---

# Part C — Frontend plumbing (`Apps/web`)

### C1 — `src/lib/query-keys.ts`

Add inside the `catalog:` block, after `productStats: () => …`:

```ts
    // S22 — the supplier-invoice label dialog asks which of an invoice's products have a printable
    // barcode. Keyed on the id list so reopening the same invoice's dialog is served from cache;
    // barcodes change only through a product edit, which already invalidates
    // qk.catalog.adminProducts.all(), so no bespoke invalidation is added here.
    barcodeLookup: (productIds: string[]) => ["catalog", "barcode-lookup", productIds] as const,
```

### C2 — `src/services/catalog.service.ts`

Add to the contract type imports: `BarcodeLabelSheetCommand`, `BarcodeLookupCommand`,
`BarcodeLookupDto`.

Append both functions directly after `generateBarcode()` (keeping the file's product-block
ordering):

```ts
export async function lookupBarcodes(command: BarcodeLookupCommand): Promise<BarcodeLookupDto> {
  const res = await api.post<ApiResponse<BarcodeLookupDto>>(
    apiPath(CATALOG_ROUTES.BARCODE_LOOKUP),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Bypasses the ApiResponse envelope entirely (backend's PdfResult, streamed directly) — mirrors
// billing's getInvoicePdf and platform's exportFees.
export async function renderBarcodeLabels(command: BarcodeLabelSheetCommand): Promise<Blob> {
  const res = await api.post<Blob>(apiPath(CATALOG_ROUTES.BARCODE_LABELS), command, {
    responseType: "blob",
  });
  return res.data;
}
```

### C3 — `src/hooks/useCatalogProducts.ts`

Add `BarcodeLabelSheetCommand` and `BarcodeLookupCommand` to the contract type imports. Append
after `useGenerateBarcode()` (the last hook in the file):

```ts
// S22 — a query, unlike useGenerateBarcode above: the same {invoice lines} genuinely should be
// served from cache, and the dialog needs it declaratively on open rather than imperatively. A
// POST only because the id list is too long for a query string.
export function useBarcodeLookup(productIds: string[], options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.catalog.barcodeLookup(productIds),
    queryFn: () => catalogService.lookupBarcodes({ productIds }),
    enabled: (options?.enabled ?? true) && productIds.length > 0,
  });
}

// Imperative (triggers a file download) rather than a query — returns a Blob, not cacheable domain
// data. Same shape as useInvoicePdf (useBilling.ts) and useExportReportCsv.
export function usePrintBarcodeLabels() {
  return useMutation({
    mutationFn: (command: BarcodeLabelSheetCommand) => catalogService.renderBarcodeLabels(command),
  });
}
```

### C4 — `src/lib/query-client.ts` — translate the two new sentinels

Extend the existing `SENTINEL_TRANSLATION_KEYS` map added by S19 (do **not** touch `message()` or
`apiErrorMessage()`; both already work):

```ts
const SENTINEL_TRANSLATION_KEYS: Record<string, string> = {
  [CATALOG_ERROR.BARCODE_TAKEN]: "common.errors.sentinel.barcodeTaken",
  [CATALOG_ERROR.BARCODE_GENERATION_EXHAUSTED]: "common.errors.sentinel.barcodeGenerationExhausted",
  [CATALOG_ERROR.BARCODE_LABELS_EMPTY]: "common.errors.sentinel.barcodeLabelsEmpty",
  [CATALOG_ERROR.BARCODE_LABEL_TOTAL_EXCEEDED]: "common.errors.sentinel.barcodeLabelTotalExceeded",
};
```

> Known limitation, unchanged from the invoice PDFs and **not** in scope: when a `responseType:
> "blob"` request fails, axios hands back the error body as a `Blob`, so `message()` cannot read
> the sentinel out of it and falls through to the generic crash title. Both dialogs prevent the two
> label sentinels client-side, so this is defence in depth only.

---

# Part D — Translations (`Apps/web/src/config/translations.json`)

Flat keys, `{ en, fr, ar }`, `ar` stays `""` (matches every existing entry). `{count}` / `{max}`
are interpolated by `lib/i18n.ts`'s `interpolate()` — pass them as
`t(key, { count: … })`.

| Key | en | fr |
|---|---|---|
| `common.errors.sentinel.barcodeLabelsEmpty` | `None of the selected products has a printable barcode` | `Aucun des produits sélectionnés n'a de code-barres imprimable` |
| `common.errors.sentinel.barcodeLabelTotalExceeded` | `Too many labels in one run — reduce the quantities` | `Trop d'étiquettes en une fois — réduisez les quantités` |
| `admin.productsList.printLabels.generating` | `Generating…` | `Génération…` |
| `admin.productsList.printLabels.tooMany` | `Reduce the quantities — one sheet holds at most {max} labels.` | `Réduisez les quantités — une planche contient au maximum {max} étiquettes.` |
| `admin.supplierInvoices.printLabels.action` | `Print barcodes` | `Imprimer les codes-barres` |
| `admin.supplierInvoices.printLabels.title` | `Print barcode labels` | `Imprimer les étiquettes de code-barres` |
| `admin.supplierInvoices.printLabels.description` | `One row per invoice line. Each quantity defaults to the quantity received.` | `Une ligne par ligne de facture. Chaque quantité correspond par défaut à la quantité reçue.` |
| `admin.supplierInvoices.printLabels.columnProduct` | `Product` | `Produit` |
| `admin.supplierInvoices.printLabels.columnBarcode` | `Barcode` | `Code-barres` |
| `admin.supplierInvoices.printLabels.columnQuantity` | `Labels` | `Étiquettes` |
| `admin.supplierInvoices.printLabels.skipped` | `{count} line(s) skipped — those products have no barcode yet.` | `{count} ligne(s) ignorée(s) — ces produits n'ont pas encore de code-barres.` |
| `admin.supplierInvoices.printLabels.none` | `No line on this invoice has a printable barcode.` | `Aucune ligne de cette facture n'a de code-barres imprimable.` |
| `admin.supplierInvoices.printLabels.total` | `{count} labels in total` | `{count} étiquettes au total` |
| `admin.supplierInvoices.printLabels.loadError` | `Couldn't load the barcodes for this invoice` | `Impossible de charger les codes-barres de cette facture` |

**Reuse, do not duplicate** — these already exist and are kept:
`admin.productsList.printLabels.{title,preview,quantityLabel,quantityHelper,print}`,
`admin.productsList.table.{printLabels,printLabelsNoBarcode}`, `common.actions.cancel`,
`common.actions.tryAgain`.

---

# Part E — Product page: switch the existing dialog to PDF

### E1 — `src/pages/admin/products/components/barcode-label-dialog.tsx`

**E1.1 — Imports.** Remove `createPortal` from the `react-dom` import (the whole import line goes).
Add `BARCODE_LABEL_SHEET_MAX_TOTAL` to the contract import. Add
`import { usePrintBarcodeLabels } from "@/hooks/useCatalogProducts";` and
`import { downloadBlob } from "@/lib/utils";`.

**E1.2 — Replace the header comment** (lines 31-35), which describes the deleted print portal, with:

```ts
// S22 — the sheet is a server-side PDF now (POST /admin/products/barcode-labels, PDFKit + bwip-js),
// not a hidden print portal: both this dialog and the supplier-invoice one post to the same
// endpoint, so the two entry points cannot produce different labels. The on-screen <BarcodeLabel>
// below is a preview only — it renders through jsbarcode in the browser and never reaches the PDF.
// Confirming downloads the file, matching every other PDF in the app (InvoiceDetail.tsx).
```

**E1.3 — The mutation and handler.** Add after the `useState`/`useEffect` block:

```ts
  const printLabels = usePrintBarcodeLabels();

  const handlePrint = () => {
    if (!product) return;
    printLabels.mutate(
      { items: [{ productId: product.id, quantity }] },
      {
        onSuccess: (blob) => {
          downloadBlob(`labels-${barcode}.pdf`, blob);
          onOpenChange(false);
        },
      },
    );
  };
```

**E1.4 — The footer button** replaces `onClick={() => window.print()}`:

```tsx
            <Button onClick={handlePrint} disabled={printLabels.isPending}>
              <Printer className="mr-2 h-4 w-4" />
              {printLabels.isPending
                ? t("admin.productsList.printLabels.generating")
                : t("admin.productsList.printLabels.print")}
            </Button>
```

**E1.5 — Delete the print portal**: remove the whole `{open && createPortal(…, document.body)}`
block (lines 100-110) and the now-redundant `<>…</>` fragment wrapper, so the component returns the
`<Dialog>` directly.

> `BARCODE_LABEL_MAX_QUANTITY` (200) already bounds the single-product case and stays below
> `BARCODE_LABEL_SHEET_MAX_TOTAL` (1000), so this dialog needs no extra ceiling check — the import
> added in E1.1 is only needed if the executor chooses to assert it; **skip it and drop that import
> if unused** (lint would flag it).

### E2 — `src/pages/admin/products/components/barcode-label.tsx`

Component body is unchanged. **Update the header comment** — it currently claims this is what gets
printed. Replace the second paragraph (lines 11-16) with:

```ts
// S22 — this is the on-screen *preview* only. The printed sheet is rendered server-side as a PDF
// (pdf.utils.ts's renderBarcodeLabelsPdf, PDFKit + bwip-js) so the products list and the supplier
// invoice produce identical labels; keep the two in step if either changes.
//
// Code 128 is the symbology: a generated barcode is 9 *alphanumeric* characters, which the
// fixed-length numeric symbologies (EAN-13, UPC) cannot encode. JsBarcode writes a `viewBox` onto
// the <svg>, so `w-full h-auto` scales the symbol to the label box without distorting the bar
// ratios. The box is forced black-on-white regardless of theme: JsBarcode draws black bars, and a
// dark-mode card behind them would preview unreadably.
```

### E3 — `src/index.css` — delete the S19 print rule

Delete the entire trailing comment block and `@media print { … }` (lines 172-190).

**This is finding F1, and it is a real fix, not cleanup.** `#barcode-print-root` exists in the DOM
only while the label dialog is open; with it gone, `body > *:not(#barcode-print-root)` matches every
child of `<body>`, so **every** other print in the app currently produces a blank page —
`StaffPos.tsx:442`, `StaffSales.tsx:247`, `StaffInvoices.tsx:232`. Removing the rule restores them
and leaves S25 a clean slate for the 80 mm receipt stylesheet. **Do not replace it with anything.**

`jsbarcode` stays in `Apps/web/package.json` — `barcode-label.tsx` still uses it for the preview.

---

# Part F — Supplier invoices: print all labels for a receipt

### F1 — New `src/pages/admin/supplier-invoices/components/barcode-labels-dialog.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import {
  BARCODE_LABEL_MAX_QUANTITY,
  BARCODE_LABEL_SHEET_MAX_TOTAL,
  type SupplierInvoiceDto,
} from "@dragon-telecom/contract";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useBarcodeLookup, usePrintBarcodeLabels } from "@/hooks/useCatalogProducts";
import { useTranslation } from "@/hooks/useTranslation";
import { downloadBlob } from "@/lib/utils";

interface BarcodeLabelsDialogProps {
  invoice: SupplierInvoiceDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Same clamp rule as the products-list dialog: applied per keystroke so a mistyped extra digit is
// corrected in place, and a cleared field reads as NaN and falls back to 1.
const clampQuantity = (raw: number): number =>
  Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), BARCODE_LABEL_MAX_QUANTITY) : 1;

// S22 — every product line of one supplier invoice, one editable label count per line, defaulting
// to the quantity received. Lines whose product has no printable barcode are omitted entirely and
// reported as a count, so the absence is never silent (the same predicate runs server-side, so the
// note and the PDF can never disagree). Available on every invoice regardless of status: an
// amount-only invoice simply has no lines and shows the empty note.
export function BarcodeLabelsDialog({ invoice, open, onOpenChange }: BarcodeLabelsDialogProps) {
  const { t } = useTranslation();

  // Stable across renders so it can be a query key; invoice.lines is already in line order.
  const productIds = useMemo(() => invoice.lines.map((line) => line.productId), [invoice.lines]);
  const lookup = useBarcodeLookup(productIds, { enabled: open });
  const printLabels = usePrintBarcodeLabels();

  const barcodeByProduct = useMemo(
    () => new Map((lookup.data?.items ?? []).map((item) => [item.productId, item.barcode])),
    [lookup.data],
  );

  // One row per *line*, not per product — the same product on two lines is two rows with two
  // quantities, and the PDF keeps that order.
  const printableLines = useMemo(
    () =>
      invoice.lines.flatMap((line) => {
        const barcode = barcodeByProduct.get(line.productId);
        return barcode == null ? [] : [{ ...line, barcode }];
      }),
    [invoice.lines, barcodeByProduct],
  );
  const skippedCount = invoice.lines.length - printableLines.length;

  // Keyed by line id, seeded from the invoice quantity each time the dialog opens.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!open) return;
    setQuantities(
      Object.fromEntries(printableLines.map((line) => [line.id, clampQuantity(line.quantity)])),
    );
  }, [open, printableLines]);

  const totalLabels = printableLines.reduce(
    (sum, line) => sum + (quantities[line.id] ?? line.quantity),
    0,
  );
  const overLimit = totalLabels > BARCODE_LABEL_SHEET_MAX_TOTAL;

  const handlePrint = () => {
    printLabels.mutate(
      {
        items: printableLines.map((line) => ({
          productId: line.productId,
          quantity: quantities[line.id] ?? line.quantity,
        })),
      },
      {
        onSuccess: (blob) => {
          downloadBlob(`labels-${invoice.reference}.pdf`, blob);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.supplierInvoices.printLabels.title")}</DialogTitle>
          <DialogDescription>
            {t("admin.supplierInvoices.printLabels.description")}
          </DialogDescription>
        </DialogHeader>

        {lookup.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : lookup.isError ? (
          <p className="text-sm text-destructive">
            {t("admin.supplierInvoices.printLabels.loadError")}
          </p>
        ) : printableLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.supplierInvoices.printLabels.none")}
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.supplierInvoices.printLabels.columnProduct")}</TableHead>
                  <TableHead>{t("admin.supplierInvoices.printLabels.columnBarcode")}</TableHead>
                  <TableHead className="w-28">
                    {t("admin.supplierInvoices.printLabels.columnQuantity")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printableLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-sm">{line.productNameSnapshot}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {line.barcode}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={BARCODE_LABEL_MAX_QUANTITY}
                        value={quantities[line.id] ?? line.quantity}
                        onChange={(event) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [line.id]: clampQuantity(Number(event.target.value)),
                          }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="space-y-1 text-xs text-muted-foreground">
          {skippedCount > 0 && (
            <p>{t("admin.supplierInvoices.printLabels.skipped", { count: skippedCount })}</p>
          )}
          {printableLines.length > 0 && (
            <p>{t("admin.supplierInvoices.printLabels.total", { count: totalLabels })}</p>
          )}
          {overLimit && (
            <p className="text-destructive">
              {t("admin.productsList.printLabels.tooMany", { max: BARCODE_LABEL_SHEET_MAX_TOTAL })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            onClick={handlePrint}
            disabled={printableLines.length === 0 || overLimit || printLabels.isPending}
          >
            <Printer className="mr-2 h-4 w-4" />
            {printLabels.isPending
              ? t("admin.productsList.printLabels.generating")
              : t("admin.productsList.printLabels.print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### F2 — `src/pages/admin/supplier-invoices/AdminSupplierInvoiceEditor.tsx`

**F2.1 — Imports.** Add `Printer` to the existing `lucide-react` import (which currently brings in
`CreditCard` only), and add
`import { BarcodeLabelsDialog } from "@/pages/admin/supplier-invoices/components/barcode-labels-dialog";`.

**F2.2 — State**, next to the other `useState` calls (after `isPaymentOpen`):

```ts
  // S22 — the print-barcodes dialog. Unlike the payment button below it is shown on *every* saved
  // invoice regardless of status: labels are about the goods received, not the money.
  const [isLabelsOpen, setIsLabelsOpen] = useState(false);
```

**F2.3 — The button.** In the page header block (lines 274-279), the payment button is wrapped in
`status !== SupplierInvoiceStatus.DRAFT`. Add the print button as a **sibling outside** that guard,
so status cannot hide it:

```tsx
        <div className="flex flex-wrap items-center gap-2">
          {!isCreate && invoice && (
            <Button variant="outline" onClick={() => setIsLabelsOpen(true)}>
              <Printer className="mr-2 h-4 w-4" />
              {t("admin.supplierInvoices.printLabels.action")}
            </Button>
          )}
          {!isCreate && invoice && status !== SupplierInvoiceStatus.DRAFT && (
            <Button variant="outline" onClick={() => setIsPaymentOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              {t("admin.supplierInvoices.payment.title")}
            </Button>
          )}
        </div>
```

(The existing `<Button variant="outline" onClick={() => setIsPaymentOpen(true)}>…` block is moved
inside this new wrapper, unchanged.)

**F2.4 — Render the dialog** next to `<SupplierPaymentDialog>` at the end of the component, inside
the same `{!isCreate && invoice && (…)}` region — or as its own block:

```tsx
      {!isCreate && invoice && (
        <BarcodeLabelsDialog
          // Fresh mount per invoice, same reason SupplierPaymentDialog is keyed.
          key={invoice.id}
          invoice={invoice}
          open={isLabelsOpen}
          onOpenChange={setIsLabelsOpen}
        />
      )}
```

**F2.5 — Update the page's header comment** (lines 52-60). Append one sentence:

```
// S22: a Print-barcodes action sits in the header on every saved invoice regardless of status —
// it opens a dialog listing the invoice's product lines with an editable label count per line and
// downloads a server-rendered PDF; lines whose product has no barcode are omitted and counted.
```

**Not in scope:** `supplier-invoices-table.tsx` gains no row action (decision A6), and
`Apps/api/src/modules/purchasing/**` / `Apps/contract/src/modules/purchasing/**` are not touched at
all (decision §0.6).

---

# Part G — Execution order & validation

Strict dependency order:

1. **A1–A4** contract (constants → routes → command → dtos)
2. **B1** `npm install bwip-js@^4.11.2` in `Apps/api`
3. **B2** `pdf.utils.ts` (consolidate `toBuffer`, then add the label sheet)
4. **B3–B7** backend (predicate → service methods → interface → controller → routes)
5. **C1–C4** web query key → service → hooks → sentinel map
6. **D** translation keys (**before** E and F, so no component references a missing key)
7. **E1–E3** product dialog → preview comment → delete the print CSS
8. **F1–F2** supplier-invoice dialog → editor wiring

**Validation — compile and lint only. Do not run any test suite, and do not modify any test file.**

```
cd Apps/contract && npm run check && npm run lint
cd Apps/api     && npx tsc --noEmit && npm run lint
cd Apps/web     && npm run check && npm run lint
```

Known baselines the executor must not try to "fix" (all confirmed pre-existing in report-S19):
`Apps/api`'s `test/**` tsc errors and the `PRODUCT_UPLOAD_DIR`-unused lint error in
`catalog.routes.ts`; `Apps/web`'s ~3.7k repo-wide `prettier/prettier` findings in untouched files.
Only files this set creates or edits must be clean.

**No test file may be created or edited.** Note for the record, do not act on it:
`Apps/web/tests/fixtures/msw/catalog.handlers.ts` has no handler for `BARCODE_LOOKUP` or
`BARCODE_LABELS` (it has none for `GENERATE_BARCODE` either — the same gap S19 recorded).

---

# Manual verification checklist (browser)

**Product page — labels are now a PDF** (`/admin/products`, as ADMIN)

1. Click the printer icon on a product **with** a barcode → the dialog opens unchanged: one label
   preview (bars + the 9 characters), and **Number of labels** pre-filled with the product's
   on-hand quantity.
2. Set the quantity to `3` and click **Print** → the button reads "Generating…", then a file
   **`labels-<barcode>.pdf` downloads** and the dialog closes. *(This is the deliberate change from
   S19: it downloads a PDF instead of opening the browser print preview — decision A2.)*
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
    though *Record payment* is not. The action is never gated on status.
11. Click it → the dialog lists **one row per invoice line**: product name, its barcode, and a
    **Labels** input **pre-filled with that line's invoice quantity**. A 12-unit line of a display
    and a 10-unit line of a battery show `12` and `10`.
12. Ensure one line's product has **no barcode** (clear it on `/admin/products/<id>` first) →
    reopen the dialog: that row is **absent**, and a note reads "1 line(s) skipped — those products
    have no barcode yet." The running total below matches the sum of the remaining inputs.
13. Confirm → **`labels-<invoice reference>.pdf`** downloads. Open it: the labels appear **in
    invoice-line order**, with the requested count per line — 12 display labels, then 10 battery
    labels.
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
    invoice that contains it → the two PDFs' labels are **visually identical** (same size, same
    symbol, same text position). This is what proves the single renderer.
19. **Scan a printed label** with the POS barcode scanner (`/staff/pos`, F2), or type the value into
    the products search → the correct product is found. **Do this on a physically printed sheet,
    not on screen — it is the only check that proves the Code 128 symbol survives the printer at
    0.27 mm per module. Do not skip it.**

**Regression — printing elsewhere in the app is repaired (finding F1)**

20. Go to `/staff/pos`, ring up a sale, and click **Print** on the receipt → the browser print
    preview shows the **receipt**. Before this set it showed a **blank page**, because S19's
    `@media print` rule hid every element whenever the label dialog was closed. *(S25 will reformat
    this receipt for an 80 mm roll; here it only has to be visible again.)*
21. Same check on `/staff/sales` → *Reprint* on a sale, and on `/staff/invoices` → *Print* on an
    invoice: both show content, not a blank page.
22. Press `Ctrl+P` on `/admin/products` with no dialog open → the page itself prints, as any page
    should.

**Permissions**

23. Log in as a **STAFF** user holding the products page → `/staff/products` is unchanged: no
    actions column, no print action (decision A1). The two new endpoints answer **403** to a staff
    token.

---

## Execution protocol

Sets execute **one at a time**. After finishing this set the executing agent writes
`Docs/Stage-04-Fixes/results/report-S22.md` describing what changed, ending with the verification
checklist above. The owner reviews and approves before **S23** (the `avgStockPrice` audit) begins.
