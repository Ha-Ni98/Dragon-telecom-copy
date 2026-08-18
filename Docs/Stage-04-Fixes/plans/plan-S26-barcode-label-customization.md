# Plan S26 — Barcode label customization (store name + top text) & supplier-invoice list action

**Scope:** two user-visible changes, one shared renderer change underneath.

1. **Label content becomes customizable.** Every label gains an optional **store name** (printed
   vertically down a left-hand column, separated from the rest by a rule) and an optional **top
   text** (printed horizontally above the bars, defaulting to the product's model name). Both are
   editable in the print dialog; neither is required.
2. **Supplier-invoice list gains a print action.** `/admin/supplier-invoices` gets an actions
   column with a printer icon that opens the **same** dialog the invoice detail page already opens —
   no new dialog, no duplicated logic.

**Sets that must land first:** none. S22–S25 are all merged; this builds directly on S22's
`renderBarcodeLabelsPdf` and its two catalog endpoints.

**Schema / migration:** **none.** `Product.barcode`, `Product.deviceModel` and
`SupplierInvoiceLine.{productId,quantity,productNameSnapshot}` are already exactly what this reads.
No `prisma migrate`, no `prisma generate`, no mapper change in `purchasing`.

---

## 0. What was read, and the decisions that follow

Everything below was verified against the code or prototyped and rasterised. The executor must not
re-derive any of it.

### 0.1 Owner decisions — do not re-open

| # | Question | Resolution |
|---|---|---|
| **Q1** | The store column squeezes the barcode. Keep 40×25 mm or widen? | **Widen the label to 50×25 mm.** At 40 mm the bars fell to ~0.21 mm/module (8.3 mil), below the 0.25 mm floor S22 recorded for reliable handheld scanning. At 50 mm they are **0.287 mm (11.3 mil)**. Cost: page density drops from 40 to **30 labels per A4** (3 columns × 10 rows). **The owner must buy 50×25 mm label stock.** |
| **Q2** | On a multi-product supplier invoice, is the top text one shared field or one per line? | **Per line**, each defaulting to its own product's model name — a third editable column beside *Labels*. The **store name stays a single shared field** for the whole run. |
| **Q3** | What does the top text default to for a universal part with no model? | **Empty** — the label simply shows the bars and their digits, as today. The field is optional; the admin may still type something. |
| **Q4** | Which way does the vertical store name read? | **Bottom-to-top** (rotated −90°), the usual shelf/spine-label convention. |

**Q4 of S19 is partially superseded by this set.** S19 recorded "the symbol and its digits only — no
product name, no price", reasoning that nothing on the label may go stale. That still holds for
*price* (never printed, still never printed). It no longer holds for the store name and the model
text, which the owner now wants and which are admin-entered per print run rather than derived from
mutable pricing. The executor must update the comments that still cite Q4 as "nothing else" —
listed explicitly in **B2.1** and **E2**.

### 0.2 The label geometry — fixed here, prototyped and rasterised

Verified by rendering a real PDF through the actual PDFKit + bwip-js stack and inspecting the
raster at 200 dpi, including every optional-field combination (both fields, store only, top text
only, neither) and an over-long name in each field.

| Quantity | Value | Why |
|---|---|---|
| Page | A4 portrait, `PDFDocument({ size:'A4', margin: 0 })` | Unchanged — every element is placed at explicit mm coordinates. |
| Page margin | 8 mm | Unchanged. |
| **Label box** | **50 × 25 mm** | Q1. Was 40 × 25. |
| Gutter | 2 mm both axes | Unchanged. |
| **Grid** | **3 columns × 10 rows = 30 per A4 page** | `floor((210−16+2)/(50+2)) = 3`, `floor((297−16+2)/(25+2)) = 10`. Was 4 × 10 = 40. |
| Label padding | 1 mm | Unchanged — leaves 48 mm drawable. |
| **Store column width** | **6 mm** | Holds ~17 characters of 6.5 pt text rotated along the 23 mm height. |
| **Separator gap** | **1 mm** between the rule and the bars | The rule itself sits at `padding + 6 mm`, drawn from `y+1 mm` to `y+24 mm`, 0.4 pt. |
| **Barcode area width** | **41 mm** (`50 − 2×1 − 6 − 1`) | 41 mm ÷ 143 modules = **0.287 mm/module** for a 9-character value. |
| Quiet zone | 10 modules each side, inside the 41 mm | Unchanged — Code 128 minimum, still not part of `raw()`'s output. |
| **Top text** | 7 pt Helvetica, centred on the barcode area, at label-top + **2.5 mm** | |
| **Bars** | top at label-top + **6 mm**, height **12 mm** | Was top 3 mm / height 15 mm; shortened to make room for the top text. 12 mm still exceeds the 15 % -of-width rule of thumb. |
| **Digits** | 7 pt Helvetica, centred, at label-top + **18.5 mm** | Was 8 pt at 19 mm. |
| **Store text** | **6.5 pt Helvetica-Bold**, rotated −90°, centred in the 6 mm column | Size is load-bearing — see 0.3. |
| Border | none | Unchanged. |

### 0.3 Two verified traps the executor must not rediscover

**Trap 1 — 7 pt is half a point too big, and PDFKit will silently wrap.**
Measured with `doc.widthOfString`: at **7 pt** Helvetica-Bold, `"Dragon Telecom HA"` is **65.7 pt**
against a 23 mm (65.2 pt) box — it overflows by 0.5 pt and **wraps onto a second line**. That string
is exactly the supplier default this set introduces, so it is the *common* case, not an edge case.
At **6.5 pt** it is **61.0 pt** and fits on one line. `STORE_TEXT_SIZE_PT = 6.5` is therefore a
required value, not a taste call.

**Trap 2 — `lineBreak: false` does not reliably stop the wrap here.** The prototype passed
`{ lineBreak: false, ellipsis: true }` and PDFKit **still wrapped** the store name onto two lines;
`doc.heightOfString(s, { lineBreak: false })` returns the same two-line height as without it. Do
**not** rely on PDFKit's own ellipsis for these three text runs. Truncate in code with the
`fitText` helper specified in **B2.2**, which measures with `widthOfString` and appends `…`.
Verified output: `"Dragon Telecom Superlongname"` → `"Dragon Telecom S…"` (62.5 pt, one line).

### 0.4 Where the defaults come from — and why the server does not compute them

Both defaults are computed **on the web side** and sent as plain strings; the API stores no policy
about them and `catalog` gains **no settings port**.

- **Products page** store-name default → `usePlatformSettings()` → `settings.store.name`.
- **Supplier invoice** store-name default → `settings.store.name` + `" "` + the **first two
  alphanumeric characters of `invoice.supplierName`, uppercased**. `"Dragon Telecom"` +
  `"Hamdid Teck"` → **`"Dragon Telecom HA"`**.
- **Top text** default → the product's model name (`AdminProductDto.model?.name` on the products
  page; a new `modelName` field on the barcode-lookup response for the supplier dialog).

Rationale, so the executor does not "improve" this into a server-side default: the field is
**editable**, so the sheet must print exactly the string the admin was looking at when they
confirmed. If the server re-derived it, an admin who cleared the field would still get a store name,
and an admin who edited it would silently get something else. `PLATFORM_ROUTES.SETTINGS` is
`adminOnly` (`platform.routes.ts:60`) and both dialogs live on admin-only pages, so
`usePlatformSettings()` is reachable from both.

### 0.5 Why the supplier-invoice list action needs no new dialog

`listInvoices` uses the same `INVOICE_INCLUDE` as `getInvoice` (`purchasing.service.ts:46-50`,
`lines: true`), and `SupplierInvoiceResponseSchema` carries `lines`, `reference` and `supplierName`.
So **every row of the list already holds the complete `SupplierInvoiceDto` the existing
`BarcodeLabelsDialog` takes as its only data prop.** The list action is therefore pure wiring: a
column, a piece of page state, and the same `<BarcodeLabelsDialog>` element. **Do not copy the
dialog, do not lift its internals, do not add a purchasing endpoint.**

### 0.6 Decisions taken (stated rather than asked)

| # | Decision | Rationale |
|---|---|---|
| **A1** | The **on-screen preview** in the products dialog is updated to show the new three-section label. | It is presented to the user as a preview of what prints. Leaving it as a bare barcode after the printed label gained two sections would make it actively misleading. It stays a `jsbarcode` render — no PDF in the browser. |
| **A2** | Both fields are **trimmed, and omitted from the request when empty**. An absent store name means **no column and no separator rule** — the barcode area is *not* widened to reclaim the space. | Keeping the bar geometry identical whether or not a store name is present means a scanner sees the same symbol either way, and two labels printed from different entry points stay comparable. Verified in the prototype: the "no store name" labels have the same bar width as the others. |
| **A3** | Field length caps: **60 characters** each, enforced by the contract schema *and* `maxLength` on the inputs. | The renderer truncates visually anyway; the cap only bounds the payload and stops a pasted essay reaching the API. |
| **A4** | `BARCODE_LABEL_MAX_QUANTITY` (200) and `BARCODE_LABEL_SHEET_MAX_TOTAL` (1000) are **unchanged**. | Still bounded work. Only the page count implied by 1000 changes (25 → 34 pages), which is a comment fix, not a limit change. |
| **A5** | The new list action is **admin-only**, like everything else on that page. | Unchanged from S22 decision A1: there is no staff supplier-invoices page. |
| **A6** | The supplier-invoice **top-text column has no "apply to all" control**. | Three edits on a three-line invoice is not friction worth new UI; the defaults are already per-product-correct. |

---

# Part A — Contract (`Apps/contract`)

### A1 — `src/modules/catalog/catalog.constants.ts`

**A1.1** The S22 comment on `BARCODE_LABEL_SHEET_MAX_ITEMS`/`BARCODE_LABEL_SHEET_MAX_TOTAL` says
"1000 labels is 25 A4 pages (40 per page)". That is now wrong. Replace that sentence so the block
reads:

```ts
// S22 — bounds on one label-sheet request. Named here because the API validates against them and
// the dialogs must disable Confirm on the same figures rather than letting the user submit into a
// 400. S26 widened the label to 50 x 25 mm, so 1000 labels is now 34 A4 pages (30 per page, was 40);
// it still renders in well under 100 ms, so the ceiling exists to keep the request bounded, not
// because the renderer is slow.
export const BARCODE_LABEL_SHEET_MAX_ITEMS = 100;
export const BARCODE_LABEL_SHEET_MAX_TOTAL = 1000;
```

**A1.2** Append after `BARCODE_LOOKUP_MAX_IDS`:

```ts
// S26 — caps on the two customizable label texts (store name, top text). The renderer truncates
// visually to fit the label regardless, so these only bound the request payload. Declared here
// because the schema validates against them and the inputs set maxLength from them.
export const BARCODE_LABEL_TEXT_MAX = 60;
```

### A2 — `src/modules/catalog/catalog.command.ts`

Add `BARCODE_LABEL_TEXT_MAX` to the existing import from `./catalog.constants`.

Replace the whole `BarcodeLabelSheetSchema` block with:

```ts
// S22 — one label-sheet request. `items` is ordered and may repeat a productId: the sheet is laid
// out in exactly this order, which for a supplier invoice is invoice-line order.
// S26 — plus the two customizable texts. `storeName` is top-level because one print run is one
// store; `topText` is per item because each line is a different product with a different model
// (owner decision Q2). Both optional: omitted (or blank) prints the label without that section.
export const BarcodeLabelSheetSchema = z
  .object({
    storeName: z.string().trim().max(BARCODE_LABEL_TEXT_MAX).optional(),
    items: z
      .array(
        z.object({
          productId: z.uuid(),
          quantity: z.number().int().min(1).max(BARCODE_LABEL_MAX_QUANTITY),
          topText: z.string().trim().max(BARCODE_LABEL_TEXT_MAX).optional(),
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

> `z.string().trim()` transforms, so a whitespace-only value arrives as `''`. The service treats
> `''` as absent — see **B3.2**.

### A3 — `src/modules/catalog/catalog.dtos.ts`

Add `modelName` to `BarcodeLookupResponseSchema`'s item, and extend its comment:

```ts
// S22 — the answer to BarcodeLookupSchema. Only products with a printable barcode appear, so
// `barcode` is required here (unlike Product.barcode, which is nullable). `name` is the current
// catalog name; the supplier-invoice dialog still shows its own productNameSnapshot, and only
// falls back to this.
// S26 — `modelName` is what the supplier-invoice dialog seeds each line's "text above the barcode"
// with. Optional because a universal part has no model, which per owner decision Q3 means the
// label simply prints no top text.
export const BarcodeLookupResponseSchema = z.object({
  items: z.array(
    z.object({
      productId: z.uuid(),
      name: z.string(),
      barcode: z.string(),
      modelName: z.string().optional(),
    }),
  ),
});
export type BarcodeLookupDto = z.infer<typeof BarcodeLookupResponseSchema>;
```

No change to `src/modules/catalog/index.ts` — all four files are already re-exported.

---

# Part B — Backend (`Apps/api`)

**No new dependency.** PDFKit and bwip-js are already installed; nothing else is needed.

### B1 — `src/modules/catalog/catalog.service.ts` — `lookupBarcodes` returns the model name

In `lookupBarcodes`, extend the `select` and the mapped item. The Prisma relation is
**`deviceModel`** (schema.prisma:406; `catalog.service.ts:74` already uses it) — *not* `model`:

```ts
    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      // S26 — deviceModel feeds the dialog's default "text above the barcode". Optional relation:
      // a universal part has none, and that prints as no top text (owner decision Q3).
      select: { id: true, name: true, barcode: true, deviceModel: { select: { name: true } } },
    });

    const byId = new Map(products.map((product) => [product.id, product]));
    const items = uniqueIds.flatMap((productId) => {
      const product = byId.get(productId);
      if (product == null || !isPrintableBarcode(product.barcode)) return [];
      return [
        {
          productId,
          name: product.name,
          barcode: product.barcode,
          ...(product.deviceModel != null ? { modelName: product.deviceModel.name } : {}),
        },
      ];
    });
```

> The conditional spread (not `modelName: x ?? undefined`) is required — `Apps/api`'s tsconfig sets
> `exactOptionalPropertyTypes`, under which an explicit `undefined` is not assignable to an
> optional property.

### B2 — `src/common/utils/pdf.utils.ts` — the label renderer

**B2.1 — Replace the geometry constants block.** The current block (from the
`// --- S22: Code 128 barcode label sheet ---` banner down to `const QUIET_ZONE_MODULES = 10;`)
becomes:

```ts
// --- S22: Code 128 barcode label sheet (S26: three-section label) ---

// S19 owner decision Q4 originally fixed the label at 40 x 25 mm carrying the symbol and its
// human-readable characters and nothing else. S26 supersedes the "nothing else" half of that: the
// label now has three sections — an optional store name running bottom-to-top down a left column,
// a vertical rule, and the barcode with an optional caption above it and its digits below. Q4's
// actual reasoning (nothing printed may go stale) is intact: both new texts are typed per print
// run by the admin, and the *price* is still never printed.
//
// The box widened 40 -> 50 mm to pay for the store column. At 40 mm the bars would have fallen to
// 0.21 mm/module (8.3 mil), under the ~0.25 mm floor a handheld scanner needs; at 50 mm they are
// 0.287 mm (11.3 mil). The cost is page density: 3 columns x 10 rows = 30 labels per A4, was 40.
const LABEL_WIDTH_MM = 50;
const LABEL_HEIGHT_MM = 25;
const SHEET_MARGIN_MM = 8;
const LABEL_GUTTER_MM = 2;
const LABEL_COLUMNS = 3;
const LABEL_ROWS = 10;
const LABELS_PER_PAGE = LABEL_COLUMNS * LABEL_ROWS;

// Inside one label. The store column and its rule are drawn only when a store name is supplied,
// but the barcode area keeps the same width either way (S26 decision A2) — so the same product
// scans identically whether or not the run carried a store name.
const LABEL_PADDING_MM = 1; // leaves 48 mm drawable
const STORE_COLUMN_WIDTH_MM = 6;
const STORE_SEPARATOR_GAP_MM = 1; // between the rule and the bars
const TOP_TEXT_TOP_MM = 2.5;
const BARS_TOP_MM = 6;
const BARS_HEIGHT_MM = 12;
const DIGITS_TOP_MM = 18.5;
const TOP_TEXT_SIZE_PT = 7;
const DIGITS_SIZE_PT = 7;
// 6.5, not 7, and this is load-bearing: at 7 pt Helvetica-Bold the string "Dragon Telecom HA" —
// the exact default this set gives a supplier-invoice run — measures 65.7 pt against the 65.2 pt
// (23 mm) column height and wraps onto a second line. At 6.5 pt it is 61.0 pt and fits.
const STORE_TEXT_SIZE_PT = 6.5;
// Code 128 requires a quiet zone of at least 10 modules on each side. It is *not* part of what
// bwipjs.raw() returns, so it is added to the module budget here: with a 9-character value the
// symbol is 123 modules, giving 41 mm / 143 = 0.287 mm per module. A longer barcode narrows the
// bars proportionally.
const QUIET_ZONE_MODULES = 10;

// Drawable width of the barcode half of the label, in points.
const BARCODE_AREA_WIDTH =
  (LABEL_WIDTH_MM - LABEL_PADDING_MM * 2 - STORE_COLUMN_WIDTH_MM - STORE_SEPARATOR_GAP_MM) * MM;
```

**B2.2 — Extend the request type and add the truncation helper.** Replace the
`export type BarcodeLabelRequest = …` line with:

```ts
// S26 — `storeName` is repeated on every request rather than passed once alongside the array,
// because renderBarcodeLabelsPdf's only input is this list; the caller copies the run-level value
// onto each entry. Both texts are already trimmed and are absent (not empty) when unused.
export type BarcodeLabelRequest = {
  barcode: string;
  quantity: number;
  storeName?: string;
  topText?: string;
};

// S26 — PDFKit's own `{ lineBreak: false, ellipsis: true }` does NOT reliably prevent a wrap here:
// the prototype still wrapped "Dragon Telecom HA" onto two lines with both options set, and
// heightOfString reports the same two-line height either way. Measuring and cutting in code is
// deterministic, so every text run on a label goes through this. The caller must have already
// selected the font and size on `doc` — widthOfString reads the current ones.
const fitText = (doc: PDFKit.PDFDocument, text: string, maxWidth: number): string => {
  if (doc.widthOfString(text) <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && doc.widthOfString(`${clipped}…`) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
};
```

**B2.3 — Replace `drawBarcodeLabel` entirely.** Keep `barcodeModules` above it unchanged.

```ts
// One label at (x, y) in points, laid out in three sections (S26):
//
//   +-------+--------------------------------+
//   |   ^   |          top text              |
//   | store | ||| ||| || |||| || ||| |       |
//   | name  |          digits                |
//   +-------+--------------------------------+
//     6 mm  |            41 mm
//
// bbs/bhs from raw() are ignored on purpose: for Code 128 every bar is full-height (guard-bar
// extensions are an EAN/UPC concept), so only the widths matter.
const drawBarcodeLabel = (doc: PDFKit.PDFDocument, x: number, y: number, request: BarcodeLabelRequest): void => {
  const sbs = barcodeModules(request.barcode);
  if (sbs.length === 0) return;

  const barcodeAreaX = x + (LABEL_PADDING_MM + STORE_COLUMN_WIDTH_MM + STORE_SEPARATOR_GAP_MM) * MM;

  // --- Left column: store name, rotated -90 so it reads bottom-to-top (owner decision Q4) ---
  const storeName = request.storeName?.trim();
  if (storeName != null && storeName !== '') {
    const centreX = x + (LABEL_PADDING_MM + STORE_COLUMN_WIDTH_MM / 2) * MM;
    const centreY = y + (LABEL_HEIGHT_MM / 2) * MM;
    // After the rotation the text box's *width* runs along the label's height.
    const boxWidth = (LABEL_HEIGHT_MM - LABEL_PADDING_MM * 2) * MM;

    doc.save().font('Helvetica-Bold').fontSize(STORE_TEXT_SIZE_PT).fillColor('#000000');
    const text = fitText(doc, storeName, boxWidth);
    doc
      .rotate(-90, { origin: [centreX, centreY] })
      .text(text, centreX - boxWidth / 2, centreY - STORE_TEXT_SIZE_PT / 2 - 1, {
        width: boxWidth,
        align: 'center',
        lineBreak: false,
      });
    doc.restore();

    // The rule only exists when there is something to separate.
    doc
      .save()
      .strokeColor('#000000')
      .lineWidth(0.4)
      .moveTo(x + (LABEL_PADDING_MM + STORE_COLUMN_WIDTH_MM) * MM, y + LABEL_PADDING_MM * MM)
      .lineTo(x + (LABEL_PADDING_MM + STORE_COLUMN_WIDTH_MM) * MM, y + (LABEL_HEIGHT_MM - LABEL_PADDING_MM) * MM)
      .stroke()
      .restore();
  }

  // --- Caption above the bars ---
  const topText = request.topText?.trim();
  if (topText != null && topText !== '') {
    doc.font('Helvetica').fontSize(TOP_TEXT_SIZE_PT).fillColor('#000000');
    doc.text(fitText(doc, topText, BARCODE_AREA_WIDTH), barcodeAreaX, y + TOP_TEXT_TOP_MM * MM, {
      width: BARCODE_AREA_WIDTH,
      align: 'center',
      lineBreak: false,
    });
  }

  // --- The symbol ---
  const totalModules = sbs.reduce((sum, width) => sum + width, 0) + QUIET_ZONE_MODULES * 2;
  const moduleWidth = BARCODE_AREA_WIDTH / totalModules;

  let cursorX = barcodeAreaX + QUIET_ZONE_MODULES * moduleWidth;
  doc.save().fillColor('#000000');
  for (let index = 0; index < sbs.length; index += 1) {
    const width = (sbs[index] ?? 0) * moduleWidth;
    // sbs alternates bar, space, bar, … starting with a bar — even indices are the bars.
    if (index % 2 === 0) doc.rect(cursorX, y + BARS_TOP_MM * MM, width, BARS_HEIGHT_MM * MM).fill();
    cursorX += width;
  }
  doc.restore();

  // --- Human-readable digits ---
  doc
    .font('Helvetica')
    .fontSize(DIGITS_SIZE_PT)
    .fillColor('#000000')
    .text(request.barcode, barcodeAreaX, y + DIGITS_TOP_MM * MM, {
      width: BARCODE_AREA_WIDTH,
      align: 'center',
      lineBreak: false,
    });
};
```

**B2.4 — `renderBarcodeLabelsPdf`: pass the whole request through.** Only the
`drawBarcodeLabel(...)` call changes — its last argument becomes `request` instead of
`request.barcode`:

```ts
      drawBarcodeLabel(
        doc,
        (SHEET_MARGIN_MM + column * (LABEL_WIDTH_MM + LABEL_GUTTER_MM)) * MM,
        (SHEET_MARGIN_MM + row * (LABEL_HEIGHT_MM + LABEL_GUTTER_MM)) * MM,
        request,
      );
```

Everything else in that function — the slot arithmetic, the `addPage()` rule, `toBuffer(doc)` —
is unchanged.

### B3 — `src/modules/catalog/catalog.service.ts` — `renderBarcodeLabels` carries the texts

**B3.1** The method already resolves barcodes and filters unprintable products. Only the mapped
request object changes, so the run-level `storeName` lands on every entry and each item's own
`topText` travels with it:

```ts
    const requests = cmd.items.flatMap((item) => {
      const barcode = barcodeById.get(item.productId) ?? null;
      if (!isPrintableBarcode(barcode)) return [];
      return [
        {
          barcode,
          quantity: item.quantity,
          // S26 — a blank string is not a value: z.string().trim() means whitespace-only input
          // arrives as '', which must print no section rather than an empty one.
          ...(storeName !== '' ? { storeName } : {}),
          ...(item.topText != null && item.topText !== '' ? { topText: item.topText } : {}),
        },
      ];
    });
```

**B3.2** Directly above that, resolve the run-level value once:

```ts
    const storeName = cmd.storeName?.trim() ?? '';
```

**B3.3** Extend the method's doc comment (it currently ends at "…that is invoice-line order"):

```ts
  // S26 — `storeName` is one value for the whole run and is copied onto every request; `topText`
  // is per item. Both are printed verbatim, never re-derived server-side: the field is editable,
  // so the sheet must carry exactly the string the admin confirmed (an admin who cleared the store
  // name must get labels without one).
```

No change to `catalog.interface.ts`, `catalog.controller.ts` or `catalog.routes.ts` — the command
type widened underneath them and the handlers are already generic.

---

# Part C — Frontend plumbing (`Apps/web`)

**No service or hook signature changes.** `lookupBarcodes` and `renderBarcodeLabels` already take
the contract command types, which widened in Part A; `useBarcodeLookup`/`usePrintBarcodeLabels` are
untouched. **Do not edit `services/catalog.service.ts`, `hooks/useCatalogProducts.ts`,
`lib/query-keys.ts` or `lib/query-client.ts` in this set.**

---

# Part D — Translations (`Apps/web/src/config/translations.json`)

Flat keys, `{ en, fr, ar }`, `ar` stays `""` (matches every existing entry).

| Key | en | fr |
|---|---|---|
| `admin.productsList.printLabels.storeNameLabel` | `Store name (optional)` | `Nom du magasin (facultatif)` |
| `admin.productsList.printLabels.storeNameHelper` | `Printed vertically down the left of each label. Leave empty to omit it.` | `Imprimé verticalement à gauche de chaque étiquette. Laissez vide pour l'omettre.` |
| `admin.productsList.printLabels.topTextLabel` | `Text above the barcode (optional)` | `Texte au-dessus du code-barres (facultatif)` |
| `admin.productsList.printLabels.topTextHelper` | `Defaults to the product's model. Leave empty to omit it.` | `Par défaut, le modèle du produit. Laissez vide pour l'omettre.` |
| `admin.supplierInvoices.printLabels.storeNameLabel` | `Store name (optional)` | `Nom du magasin (facultatif)` |
| `admin.supplierInvoices.printLabels.storeNameHelper` | `Applies to every label in this run. Defaults to your store name plus the supplier's initials.` | `S'applique à toutes les étiquettes de cette impression. Par défaut, le nom de votre magasin suivi des initiales du fournisseur.` |
| `admin.supplierInvoices.printLabels.columnTopText` | `Text above` | `Texte au-dessus` |
| `admin.supplierInvoices.table.actions` | `Actions` | `Actions` |
| `admin.supplierInvoices.table.printLabels` | `Print barcodes` | `Imprimer les codes-barres` |

**Reuse, do not duplicate** — these already exist and are kept:
`admin.productsList.printLabels.{title,preview,quantityLabel,quantityHelper,print,generating,tooMany}`,
`admin.supplierInvoices.printLabels.{action,title,description,columnProduct,columnBarcode,columnQuantity,skipped,none,total,loadError}`,
`common.actions.cancel`.

---

# Part E — Products page

### E1 — `src/pages/admin/products/components/barcode-label.tsx` — preview the real label

The component currently renders a bare 40×25 mm barcode box. Rewrite it to mirror the three-section
printed label (decision A1). Keep the `jsbarcode` call and its options exactly as they are — only
the wrapper markup and the props change.

**E1.1 — Props:**

```tsx
interface BarcodeLabelProps {
  value: string;
  /** S26 — optional, mirrors the printed label; absent means the column and its rule are not drawn. */
  storeName?: string;
  topText?: string;
}
```

**E1.2 — Replace the header comment** (the S19 + S22 block) with:

```tsx
// S19/S22/S26 — the on-screen *preview* of one printed label. The printed sheet is rendered
// server-side as a PDF (pdf.utils.ts's renderBarcodeLabelsPdf, PDFKit + bwip-js); this only has to
// look like it, so the two must be kept in step. Layout as of S26: 50 x 25 mm, an optional store
// name running bottom-to-top down a 6 mm left column, a vertical rule, then the optional caption,
// the symbol and its digits.
//
// Code 128 is the symbology: a generated barcode is 9 *alphanumeric* characters, which the
// fixed-length numeric symbologies (EAN-13, UPC) cannot encode. JsBarcode writes a `viewBox` onto
// the <svg>, so `w-full h-auto` scales the symbol to the box without distorting the bar ratios. The
// box is forced black-on-white regardless of theme: JsBarcode draws black bars, and a dark-mode
// card behind them would preview unreadably.
```

**E1.3 — Replace the returned markup** (the component body's `return`, not the `useEffect`):

```tsx
  return (
    <div className="flex h-[25mm] w-[50mm] items-stretch overflow-hidden border border-dashed border-black/40 bg-white p-[1mm] text-black">
      {storeName?.trim() ? (
        <>
          <div className="flex w-[6mm] shrink-0 items-center justify-center">
            {/* vertical-rl + rotate(180deg) is the standard bottom-to-top idiom; it matches the
                PDF's rotate(-90). truncate keeps a long name on one line, as fitText does server-side. */}
            <span
              className="max-h-full truncate text-[5pt] font-bold leading-none"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              {storeName.trim()}
            </span>
          </div>
          <div className="mx-[0.5mm] w-px shrink-0 bg-black/70" />
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {topText?.trim() ? (
          <span className="truncate text-center text-[5pt] leading-none">{topText.trim()}</span>
        ) : null}
        <svg ref={svgRef} className="h-auto w-full" />
      </div>
    </div>
  );
```

> The preview's `text-[5pt]` is deliberately not the PDF's 6.5/7 pt — a browser at ~96 dpi renders
> `mm` boxes larger than print, and 5 pt is what reads proportionally right in the dialog. It is a
> preview, not a proof; the PDF is the artefact.

### E2 — `src/pages/admin/products/components/barcode-label-dialog.tsx`

**E2.1 — Imports.** Add `BARCODE_LABEL_TEXT_MAX` to the `@dragon-telecom/contract` import. Add
`import { usePlatformSettings } from "@/hooks/usePlatform";`.

**E2.2 — Header comment.** Append to the existing S22 block:

```tsx
// S26 — the label also carries an optional store name (vertical, left column) and an optional
// caption above the bars. Both are seeded from data (settings / the product's model) but are the
// admin's to edit, so what is sent is exactly what the field shows — see the `?? default` reads
// below, which is why an untouched field is `undefined` rather than pre-filled state.
```

**E2.3 — Defaults and state.** Add below the existing `printLabels` mutation:

```tsx
  const settings = usePlatformSettings();
  const defaultStoreName = settings.data?.store.name ?? "";
  const defaultTopText = product?.model?.name ?? "";

  // `undefined` means "untouched, show the default" — deliberately not pre-filled state seeded by
  // an effect. Settings arrive asynchronously, and a seeded field would either overwrite what the
  // admin just typed or freeze an empty default in place if the query resolved late.
  const [storeName, setStoreName] = useState<string | undefined>(undefined);
  const [topText, setTopText] = useState<string | undefined>(undefined);

  const effectiveStoreName = storeName ?? defaultStoreName;
  const effectiveTopText = topText ?? defaultTopText;
```

**E2.4 — Reset on open.** The existing `useEffect` re-seeds `quantity`; extend its body so both new
fields return to "untouched" whenever the dialog opens on a product:

```tsx
  useEffect(() => {
    if (open && product) {
      setQuantity(clampQuantity(product.quantityOnHand));
      setStoreName(undefined);
      setTopText(undefined);
    }
  }, [open, product]);
```

**E2.5 — Send the effective values.** In `handlePrint`, replace the `items` argument:

```tsx
    printLabels.mutate(
      {
        ...(effectiveStoreName.trim() !== "" ? { storeName: effectiveStoreName.trim() } : {}),
        items: [
          {
            productId: product.id,
            quantity,
            ...(effectiveTopText.trim() !== "" ? { topText: effectiveTopText.trim() } : {}),
          },
        ],
      },
      { onSuccess: (blob) => { downloadBlob(`labels-${barcode}.pdf`, blob); onOpenChange(false); } },
    );
```

**E2.6 — The preview reflects the fields.** Change the existing `<BarcodeLabel value={barcode} />`
to:

```tsx
              <BarcodeLabel
                value={barcode}
                storeName={effectiveStoreName}
                topText={effectiveTopText}
              />
```

**E2.7 — The two inputs.** Insert between the preview block and the existing quantity block, inside
the same `space-y-4` container:

```tsx
            <div className="space-y-1">
              <Label htmlFor="label-store-name">
                {t("admin.productsList.printLabels.storeNameLabel")}
              </Label>
              <Input
                id="label-store-name"
                maxLength={BARCODE_LABEL_TEXT_MAX}
                value={effectiveStoreName}
                onChange={(event) => setStoreName(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.productsList.printLabels.storeNameHelper")}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="label-top-text">
                {t("admin.productsList.printLabels.topTextLabel")}
              </Label>
              <Input
                id="label-top-text"
                maxLength={BARCODE_LABEL_TEXT_MAX}
                value={effectiveTopText}
                onChange={(event) => setTopText(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.productsList.printLabels.topTextHelper")}
              </p>
            </div>
```

---

# Part F — Supplier invoices

### F1 — `src/pages/admin/supplier-invoices/components/barcode-labels-dialog.tsx`

**F1.1 — Imports.** Add `BARCODE_LABEL_TEXT_MAX` to the contract import; add `Label` from
`@/components/ui/label`; add `usePlatformSettings` from `@/hooks/usePlatform`.

**F1.2 — Header comment.** Append to the existing S22 block:

```tsx
// S26 — plus the two customizable texts. The store name is one field for the whole run (defaulting
// to the store name from settings followed by the supplier's initials, e.g. "Dragon Telecom HA");
// the caption above the bars is *per line*, defaulting to that line's own product model, because a
// single shared caption could only ever be right for one product on a multi-line invoice
// (owner decision Q2).
```

**F1.3 — The supplier-initials helper.** Add at module level, beside `clampQuantity`:

```tsx
// "Hamdid Teck" -> "HA". Diacritics are stripped and non-alphanumerics dropped before taking the
// first two characters, so "Élec-Tronique" gives "EL" rather than "ÉL" or "E-". Same normalisation
// idea as the api's barcodePrefix (S19), but with no padding: this is a display string, and a
// one-character supplier name should contribute one character, not an invented filler.
const supplierInitials = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip the combining marks NFD just split off
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
```

**F1.4 — Defaults and state.** Add after the existing `printLabels` mutation:

```tsx
  const settings = usePlatformSettings();
  // Both halves are optional: no settings yet, or a supplier whose name has no usable characters,
  // simply contributes nothing rather than a stray separator space.
  const defaultStoreName = [settings.data?.store.name, supplierInitials(invoice.supplierName)]
    .filter((part) => part != null && part !== "")
    .join(" ");

  // undefined = untouched, show the default (same reason as the products dialog: settings resolve
  // asynchronously, so seeding state from them would race the admin's typing).
  const [storeName, setStoreName] = useState<string | undefined>(undefined);
  const effectiveStoreName = storeName ?? defaultStoreName;

  // Per line, keyed by line id; a missing key means "untouched, use that product's model name".
  // Mirrors how `quantities` already defaults to the line's invoice quantity.
  const [topTexts, setTopTexts] = useState<Record<string, string>>({});
```

**F1.5 — Per-line model name.** `printableLines` currently attaches `barcode` from the lookup map.
Attach the model too — replace the `barcodeByProduct` map and the `printableLines` memo with:

```tsx
  const lookupByProduct = useMemo(
    () => new Map((lookup.data?.items ?? []).map((item) => [item.productId, item])),
    [lookup.data],
  );

  // One row per *line*, not per product — the same product on two lines is two rows with two
  // quantities and two captions, and the PDF keeps that order.
  const printableLines = useMemo(
    () =>
      invoice.lines.flatMap((line) => {
        const found = lookupByProduct.get(line.productId);
        return found == null ? [] : [{ ...line, barcode: found.barcode, modelName: found.modelName ?? "" }];
      }),
    [invoice.lines, lookupByProduct],
  );
```

**F1.6 — Reset on open.** The existing `useEffect` seeds `quantities`; add the two resets:

```tsx
  useEffect(() => {
    if (!open) return;
    setQuantities(
      Object.fromEntries(printableLines.map((line) => [line.id, clampQuantity(line.quantity)])),
    );
    setTopTexts({});
    setStoreName(undefined);
  }, [open, printableLines]);
```

**F1.7 — The store-name field.** Insert immediately after `<DialogHeader>` closes, before the
loading/error/table branch:

```tsx
        <div className="space-y-1">
          <Label htmlFor="invoice-label-store-name">
            {t("admin.supplierInvoices.printLabels.storeNameLabel")}
          </Label>
          <Input
            id="invoice-label-store-name"
            maxLength={BARCODE_LABEL_TEXT_MAX}
            value={effectiveStoreName}
            onChange={(event) => setStoreName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t("admin.supplierInvoices.printLabels.storeNameHelper")}
          </p>
        </div>
```

**F1.8 — The per-line caption column.** Add a header cell between *Barcode* and *Labels*:

```tsx
                  <TableHead>{t("admin.supplierInvoices.printLabels.columnTopText")}</TableHead>
```

and the matching body cell, between the barcode cell and the quantity cell:

```tsx
                    <TableCell>
                      <Input
                        maxLength={BARCODE_LABEL_TEXT_MAX}
                        value={topTexts[line.id] ?? line.modelName}
                        onChange={(event) =>
                          setTopTexts((prev) => ({ ...prev, [line.id]: event.target.value }))
                        }
                      />
                    </TableCell>
```

Widen the dialog so four columns are comfortable: `<DialogContent className="max-w-2xl">` becomes
`max-w-3xl`.

**F1.9 — Send both.** Replace `handlePrint`'s mutate argument:

```tsx
    printLabels.mutate(
      {
        ...(effectiveStoreName.trim() !== "" ? { storeName: effectiveStoreName.trim() } : {}),
        items: printableLines.map((line) => {
          const caption = (topTexts[line.id] ?? line.modelName).trim();
          return {
            productId: line.productId,
            quantity: quantities[line.id] ?? line.quantity,
            ...(caption !== "" ? { topText: caption } : {}),
          };
        }),
      },
      {
        onSuccess: (blob) => {
          downloadBlob(`labels-${invoice.reference}.pdf`, blob);
          onOpenChange(false);
        },
      },
    );
```

### F2 — `src/pages/admin/supplier-invoices/components/supplier-invoices-table.tsx`

**F2.1 — Imports.** Add `Printer` to the `lucide-react` import (it currently brings in `FileText`).

**F2.2 — Props.** Add to `SupplierInvoicesTableProps`:

```tsx
  /** S26 — the page owns the dialog (the table stays dumb); this only reports which row was
   *  picked. Available on every row regardless of status, exactly like the detail page's own
   *  action — labels are about the goods received, not the money. */
  onPrintBarcodes: (invoice: SupplierInvoiceDto) => void;
```

**F2.3 — The actions column.** Append to the `columns` array, after the `paidDate` column:

```tsx
      {
        id: "actions",
        header: t("admin.supplierInvoices.table.actions"),
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPrintBarcodes(row.original)}
            aria-label={t("admin.supplierInvoices.table.printLabels")}
            title={t("admin.supplierInvoices.table.printLabels")}
          >
            <Printer className="h-4 w-4" />
          </Button>
        ),
      },
```

**F2.4 — `useMemo` deps.** The columns memo currently closes over `[t, language]`; it becomes
`[t, language, onPrintBarcodes]`.

**F2.5 — Mobile row.** The feature must not be desktop-only. Inside `renderMobileRow`, replace the
existing supplier/total line with:

```tsx
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {invoice.supplierName} · {formatCurrency(invoice.totalAmount)}
        </div>
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => onPrintBarcodes(invoice)}
        >
          {t("admin.supplierInvoices.table.printLabels")}
        </button>
      </div>
```

**F2.6 — `TableSkeleton`** at the bottom of the component is `columns={8}`; the table now has nine.
Change it to `columns={9}`.

### F3 — `src/pages/admin/supplier-invoices/AdminSupplierInvoices.tsx`

**F3.1 — Imports.** Add `import { BarcodeLabelsDialog } from "@/pages/admin/supplier-invoices/components/barcode-labels-dialog";`
and `import type { SupplierInvoiceDto } from "@dragon-telecom/contract";`.

**F3.2 — State**, beside `currentPage`:

```tsx
  // S26 — which row's labels are being printed; null closes the dialog. The list rows already carry
  // the complete SupplierInvoiceDto (listInvoices uses the same INVOICE_INCLUDE as getInvoice), so
  // the row action reuses the detail page's dialog verbatim rather than fetching anything.
  const [labelsInvoice, setLabelsInvoice] = useState<SupplierInvoiceDto | null>(null);
```

**F3.3 — Pass the handler:** add `onPrintBarcodes={setLabelsInvoice}` to `<SupplierInvoicesTable …>`.

**F3.4 — Render the dialog** as the last element inside the page's root `<div>`:

```tsx
      {labelsInvoice && (
        <BarcodeLabelsDialog
          // Fresh mount per invoice, same reason the editor page keys it.
          key={labelsInvoice.id}
          invoice={labelsInvoice}
          open={labelsInvoice !== null}
          onOpenChange={(open) => !open && setLabelsInvoice(null)}
        />
      )}
```

**F3.5 — Update the page's header comment.** It currently ends noting that no filter primitive was
built for this page. Append:

```tsx
// S26: each row also carries a print-barcodes action, opening the same dialog ADM-08's editor page
// uses — the list rows already hold the full DTO, so nothing extra is fetched.
```

**Not in scope:** `AdminSupplierInvoiceEditor.tsx` is **not touched** — its S22 header button and
its `<BarcodeLabelsDialog>` already work and pick the new fields up for free.
`Apps/api/src/modules/purchasing/**` and `Apps/contract/src/modules/purchasing/**` stay untouched.

---

# Part G — Execution order & validation

Strict dependency order:

1. **A1–A3** contract (constants → command → dtos)
2. **B1** `lookupBarcodes` returns `modelName`
3. **B2** `pdf.utils.ts` (constants → `fitText` + request type → `drawBarcodeLabel` → call site)
4. **B3** `renderBarcodeLabels` passes the texts through
5. **D** translation keys (**before** E and F, so no component references a missing key)
6. **E1–E2** products preview → products dialog
7. **F1** supplier dialog → **F2** table → **F3** list page

**Validation — compile and lint only. Do not run any test suite, and do not modify any test file.**

```
cd Apps/contract && npm run check && npm run lint
cd Apps/api     && npx tsc --noEmit && npm run lint
cd Apps/web     && npm run check && npm run lint
```

Known baselines the executor must not try to "fix" (all confirmed pre-existing in report-S22):
`Apps/api`'s `test/**` tsc errors and its 8 lint errors (`prisma/seed.ts`,
`validate-request.middleware.ts`, `orders.service.ts`, and `PRODUCT_UPLOAD_DIR`-unused in
`catalog.routes.ts`); `Apps/web`'s 41 `tests/**` tsc errors and ~3.4k repo-wide
`prettier/prettier` findings in untouched files. **Only files this set creates or edits must be
clean.**

**Recommended extra check (not a test suite, no test file involved).** Because the geometry is the
whole point of this set, render one sheet through the real renderer before handing over. Write a
throwaway script *outside* the repo (a scratch directory), import
`renderBarcodeLabelsPdf` from `Apps/api/src/common/utils/pdf.utils`, call it with a handful of
requests covering **all four** field combinations plus one over-long value in each field, write the
buffer to a file, and open it. Delete the script afterwards; it is not part of the deliverable.

**No test file may be created or edited.** Note for the record, do not act on it:
`Apps/web/tests/fixtures/msw/catalog.handlers.ts` still has no handler for `BARCODE_LOOKUP` or
`BARCODE_LABELS` — the same gap S19 and S22 recorded.

---

# Manual verification checklist (browser)

**Products page — the two new fields** (`/admin/products`, as ADMIN)

1. Click the printer icon on a product **with** a barcode and **with** a model (e.g. a display for
   iPhone 15 Pro Max) → the dialog opens with **Store name** pre-filled from Settings (e.g.
   `Dragon Telecom`) and **Text above the barcode** pre-filled with the **model** (`15 pro max`) —
   not the family, not the full product name.
2. The preview at the top of the dialog shows all three sections: the store name running
   **bottom-to-top** down the left, a vertical rule, then `15 pro max` above the bars and the
   9 characters below them.
3. Type into either field → the preview updates as you type.
4. Print 3 labels → the PDF's labels match the preview: same three sections, store name reading
   upward, rule present.
5. **Clear the store name** and print → the labels have **no left column and no rule**, and the bars
   are **the same width as before** (not stretched into the freed space). Compare against step 4's
   PDF side by side.
6. Clear **both** fields and print → bars and digits only, i.e. what S22 produced (at the new size).
7. Open the dialog on a product with **no model** (a universal part) → **Text above the barcode** is
   **empty**, not the product name; printing gives labels with no caption.
8. Paste a very long store name (60+ characters) → the input stops at 60, and the printed label
   shows it truncated with `…` **on one line** — never wrapped, never overflowing the column.

**The new page size**

9. Print **30** labels → **exactly one full A4 page**, **3 columns × 10 rows**.
10. Print **31** → **two pages**, the second holding one label.
11. Measure a printed label: **50 mm × 25 mm**. *(This set changes the label size — 40×25 mm stock
    no longer fits. Confirm your label sheets before a big run.)*
12. **Scan a printed label** with the POS scanner (`/staff/pos`, F2) → the correct product is found.
    **Do this on a physically printed sheet.** The store column narrowed the bars; this is the check
    that proves 0.287 mm/module still reads on your printer and scanner.

**Supplier invoices — the new list action**

13. Go to `/admin/supplier-invoices` → the table has an **Actions** column with a printer icon on
    **every** row, whatever the row's status (CONFIRMED, DRAFT, CANCELLED alike).
14. Click it → the **same** dialog the detail page opens: one row per invoice line, product name,
    barcode, **Text above**, **Labels**.
15. **Store name** is pre-filled as your store name **plus the supplier's first two letters,
    uppercased** — e.g. store `Dragon Telecom` + supplier `Hamdid Teck` → **`Dragon Telecom HA`**.
16. Each line's **Text above** is pre-filled with **that line's own product model** — a display line
    shows `15 pro max`, a battery line shows `F12`. They are **not** all the same value.
17. Edit one line's caption, leave the others → print → in the PDF only that product's labels carry
    the edited caption; the rest keep their own model names, in invoice-line order.
18. Open the same invoice from its **detail page** (`/admin/supplier-invoices/<id>`, *Print
    barcodes*) → identical dialog, identical defaults, identical PDF. This is what proves the row
    action reuses the dialog rather than duplicating it.
19. Narrow the browser to mobile width on the list → each card shows a **Print barcodes** link that
    opens the same dialog.
20. Steps 12–17 of S22's checklist (skipped lines, the 1000-label cap, the amount-only invoice, the
    all-barcodes-cleared invoice) still behave exactly as they did — this set did not touch that
    logic.

**Regression**

21. Print an **invoice PDF** (`/staff/invoices` → a row → the PDF action) → unchanged: the shared
    `toBuffer` refactor and the new label constants must not have disturbed `renderInvoicePdf`.
22. Download a **statistics / stock-levels / movement-ledger / delivery-fees PDF export** (S25) →
    unchanged, for the same reason.

---

## Execution protocol

Sets execute **one at a time**. After finishing this set the executing agent writes
`Docs/Stage-04-Fixes/results/report-S26.md` describing what changed, ending with the verification
checklist above. The owner reviews and approves before any further work begins.
