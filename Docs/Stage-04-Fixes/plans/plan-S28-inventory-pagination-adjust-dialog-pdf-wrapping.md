# Plan — Set S28: Inventory — pagination, per-product adjustment & PDF wrapping

Target branch: `version-1-3`. Source set: `Docs/Stage-04-Fixes/sets-26-29.md` §S28.

**Sets that must land first:** none. The set brief states the order S26.1 → S27 → S28 → S29 but
also that **"S28 and S29 are independent"**. Nothing in this set reads the settings fields, the
print logo, the label-print path or the 80 mm receipt introduced in S26.1/S27. It can be executed
against the current `version-1-3` head regardless of whether S27 is owner-approved.

**Set-internal order:** §3 (contract) → §4 (backend stock pagination) → §5 (backend PDF wrapping)
→ §6 (web service + hook) → §7 (shared adjustment field components) → §8 (stock table + adjust
dialog) → §9 (adjustments-tab product search) → §10 (translations). §5 is independent of
§3/§4/§6–§9 and may be done first if preferred, but nothing else may start before §3.

---

## 0. Read this first — four premises in the set brief need correcting

The executor must not go looking for things that do not exist, and must not "fix" things that are
already correct.

| Brief says | Actual state | What this plan does |
|---|---|---|
| "following the pagination pattern the other admin tables already use (**`PaginationInfo`**, the shared table shell, query-key composition)" | **There is no `PaginationInfo` type anywhere in the repo.** The real primitives are the contract's `PaginatedResult<T> = { items: T[]; meta: PaginationMeta }` (`Apps/contract/src/common/types.ts:20–32`) and the web component `Apps/web/src/components/shared/SimplePagination.tsx`. The movement ledger **in this very page** already uses both. | Copy the movement-ledger pattern in `AdminInventory.tsx` exactly (§6, §8.1). Do not invent a `PaginationInfo`. |
| keys go in "`Apps/web/src/config/translation.json`" | The file is **`Apps/web/src/config/translations.json`** (plural). Flat keys, each value `{ "en": …, "fr": …, "ar": "" }`. | §10 adds keys there, in that shape, with `"ar": ""` like every neighbouring key. |
| the adjust dialog carries "the same functionality as the Adjustments tab … **plus the optional reprice sub-form prefilled with current prices**" | The Adjustments tab has **no reprice sub-form**. `CreateAdjustmentCommand.lines[].prices` exists in the contract (`inventory.command.ts:15`) and the backend honours it (`inventory.service.ts:865–867`), but `adjustment.schema.ts` never declares the field and `adjustment-line-editor.tsx` never renders it. `ADM-06-inventory.md:10` **does** require it ("an optional collapsed reprice sub-form prefilled with current prices") — it is an unbuilt spec requirement, not a lost decision. | §7.2 builds the sub-form **once**, as a shared component, and wires it into **both** the new dialog **and** the existing tab line editor. That is what makes "same functionality as the Adjustments tab" literally true, and it closes the ADM-06 gap. |
| "the product picker currently only offers the most recent 20 products" | It offers the **first 100 by the admin list's default ordering** — `useAdminCatalogProducts({ page: 1, limit: 100 })` at `AdminInventory.tsx:79`, documented as a known limitation in the comment at `AdminInventory.tsx:30–34`. | The defect is real (anything outside that page is unreachable); only the number in the brief is wrong. §9 fixes it and deletes the stale comment. |

**No test gate.** Per the Stage-04 programme rule, do not modify or run any test suite. Be aware
that §3/§4/§6 change `getStock`'s return type from `StockRowDto[]` to
`PaginatedResult<StockRowDto>`, which **will** break these existing tests. Leave them alone and
list them in the report:

- `Apps/api/test/unit/modules/inventory/inventory.service.spec.ts` (`describe('getStock')`, lines ~644–680)
- `Apps/web/tests/integration/services/inventory.service.test.ts` ("getStock returns the unwrapped array")
- `Apps/web/tests/integration/hooks/inventory.test.tsx` (`useStock()` called with no args)
- `Apps/web/tests/unit/pages/inventory/inventory-wiring.test.tsx` (mocks `useStock` returning an array)
- `Apps/web/tests/unit/pages/inventory/inventory-primitives.test.tsx` (renders `StockLevelsTable` without the new props — still compiles if the new props are optional, which §8.2 requires)

---

## 1. Facts established by reading the code — do not re-derive these

### 1.1 `getStock` today (`Apps/api/src/modules/inventory/inventory.service.ts:466–492`)

```ts
const where = query.search ? { OR: [ { name: { contains, mode: 'insensitive' } },
                                     { barcode: { startsWith: query.search } } ] } : {};
const products = await this.prisma.product.findMany({ where, orderBy: { name: 'asc' } });
const rows = products.map(p => InventoryMapper.toStockRowDto(p));
const filtered = query.lowStockOnly ? rows.filter(r => r.isLow) : rows;
if (query.export) { assertExportSize(filtered.length); … }
return filtered;
```

Three load-bearing facts:

1. **The search predicate is deliberate.** `name` is `contains`/insensitive; `barcode` is
   `startsWith` **specifically so the `Product.barcode @unique` btree index applies** (S1 finding
   F1, quoted in the comment at lines 467–469) and because a scanner emits a whole barcode.
   Do not change it, and do not duplicate it in raw SQL.
2. **`lowStockOnly` is not expressible as a Prisma `where`.** `isLow` is
   `quantityOnHand − quantityReserved <= reorderThreshold` (`inventory.mapper.ts:115–122`) — a
   three-column expression. Prisma's `fieldRef` can compare a column to one other column, not to
   an arithmetic expression. This is why it is currently an in-memory `.filter()`.
3. `assertExportSize` (line 448) throws `BadRequestError(EXPORT_ERROR.ROW_LIMIT_EXCEEDED)` above
   `EXPORT_MAX_ROWS` (5000, `Apps/contract/src/common/exports.ts:7`). `listMovements` detects the
   ceiling by asking for `take: EXPORT_MAX_ROWS + 1` (line 585); `getStock` currently does not cap
   its read at all.

### 1.2 The movement-ledger pagination pattern — the one to copy

- Contract: `MovementsQuerySchema` (`inventory.query.ts:18–35`) has
  `page: z.coerce.number().int().min(1).default(1)` and
  `limit: z.coerce.number().int().min(1).max(100).default(20)`, plus a comment saying the
  `export` branch **deliberately ignores** both.
- Service: `Promise.all([count({where}), findMany({where, skip:(page-1)*limit, take:limit})])`,
  returning `{ items, meta: { page, limit, total, totalPages: Math.ceil(total/limit) } }`
  (`inventory.service.ts:592–605`).
- Controller: unchanged — `if ('body' in result)` streams the export, otherwise `sendSuccess`.
  A `PaginatedResult` has no `body` key, so this discriminant keeps working.
- Web service: `listMovements` returns the unwrapped `PaginatedResult`; `exportMovements` takes
  `Omit<MovementsQuery, "export" | "page" | "limit">` (`inventory.service.ts:64–66` web side).
- Page: `const [movementsPage, setMovementsPage] = useState(1)`, query memo includes
  `page: movementsPage, limit: 20`, a **separate** export-query memo without page/limit, every
  filter setter also calls `setMovementsPage(1)`, and `<SimplePagination page={…meta.page}
  totalPages={…meta.totalPages} onPageChange={setMovementsPage} />` below the table
  (`AdminInventory.tsx:53–69, 95–103, 181–187`).

**`.default()` ripple warning.** Adding `.default(1)` / `.default(20)` to `StockQuerySchema` makes
`page` and `limit` **required in `z.infer`'s output type**. Every `StockQuery` literal and every
`Omit<StockQuery, "export">` on the web side must be updated (§3, §6). This is the same trap
documented on `ProductListQuerySchema.enabledStatus` (`catalog.query.ts:24–30`) — there they
avoided `.default()` because dozens of callers existed. Here `useStock` has **exactly one**
consumer (`AdminInventory.tsx:50`), so following the `MovementsQuery` precedent is correct.

### 1.3 `renderTablePdf` today (`Apps/api/src/common/utils/pdf.utils.ts:196–226`)

The defect the brief describes is one deliberate line, repeated for headers and cells:

```ts
doc.text(cell, col.x + 2, y + 3, { width: col.width - 4, align: col.align,
                                   ellipsis: true, lineBreak: false });
```

`lineBreak: false` forces one line; `ellipsis: true` truncates it. The comment at lines 193–195
says why: **`ROW_HEIGHT` is a fixed 15 pt and the pagination arithmetic depends on it.**
So the wrapping fix is not a one-line change — the row height must become measured, and the
pagination loop must use the measured height.

Four call sites, all fixed at once by changing this one function:

| Caller | Location | Orientation | Columns |
|---|---|---|---|
| Stock levels | `inventory.service.ts:516–552` | landscape | 9, fixed weights |
| Movement ledger | `inventory.service.ts:651–709` | landscape | 11, fixed weights |
| Delivery fees | `platform.service.ts:316–344` | portrait | 4, fixed weights |
| Statistics reports | `statistics.service.ts:1507–1533` | `headers.length > 6 ? landscape : portrait` | dynamic, **all `width: 1`** |

Also relevant:
- `drawHeaderRow` (180–191) paints a `#EEEEEE` rect of `HEAD_HEIGHT` (18) then draws the headers
  with the same `ellipsis`/`lineBreak:false` pair → this is the "headers are cut mid-word" half.
- `stampPageNumbers` (249–262) requires `bufferPages: true` and must run last. Untouched.
- `drawChart` (121–165) and `drawTotals` (228–243) are untouched.
- PDFKit is `^0.19.1`; `@types/pdfkit` types `heightOfString(text, options): number` and the
  `height` + `ellipsis` text options (a hard clip box). Both are used in §5.
- PDFKit 0.19 ships its own `doc.table()` API. **Do not rewrite onto it.** It would discard the
  title block, the repeating header, the totals row and the page-number second pass.
- The `reason` column is deliberately absent from `movementsPdf` **because wrapping was
  forbidden** (comment at `inventory.service.ts:688–690`). That comment becomes false in this set
  and must be updated (§5.4). The column itself is **not** re-added — the brief does not ask for
  it, and the CSV still carries it in full.

### 1.4 The adjustment form today

- `adjustment.schema.ts` — `adjustmentSchema(t, systemQuantityByProductId)` returns
  `{ reason, note?, lines: [{ productId, countedQuantity, unitCost? }] }` with a `superRefine`
  that requires `unitCost` whenever `countedQuantity > systemQuantity`. It ends with a
  compile-time guard `AdjustmentFormValues extends CreateAdjustmentCommand`. **There is no
  `prices` field.**
- `adjustment-line-editor.tsx` — product autocomplete, read-only system quantity, counted-quantity
  input, delta `Badge`, and (only when `delta > 0`) a `unitCost` input whose default is applied
  **once per selected product** via a `useRef<string|null>` guard (lines 53–61) so a value the
  user typed is never overwritten, plus the `avgStockPriceHint` / `avgStockPriceUnknown` helper
  text beneath it.
- `AdminInventory.tsx:79–93` builds `productOptions`, `systemQuantityByProductId` and
  `avgStockPriceByProductId` from one `useAdminCatalogProducts({ page: 1, limit: 100 })` call.
- Submit path: `AdjustmentForm.onSubmit(values)` → `createAdjustment.mutate(values)` — the form
  values **are** the command today.
- `useCreateAdjustment` (`useInventory.ts:55–65`) already invalidates `qk.inventory.all()` (which
  covers stock, movements **and** reservations), `qk.catalog.adminProducts.all()` and
  `qk.stats.all()`. **The brief's invalidation requirement is already satisfied — no change.**

### 1.5 The reprice sub-form that already exists elsewhere — the pattern to mirror

`Apps/web/src/pages/admin/supplier-invoices/components/reprice-prompt.tsx` is the app's existing
"reprice one product, prefilled with its current prices" form. Copy its shape, not its file:

- Fields: `guestPrice`, `defaultSalePrice`, then **one input per client category** (categories the
  product has no price for render empty — S7 I7).
- Each label carries the previous value: `"<label> -previous 1000-"` / `"-previous empty-"`.
- `<MarginDisplay price={watch(field)} cost={avgStockPrice} />` under every price input — margins
  are always against `avgStockPrice` (D10/RC-2).
- **The `valueAsNumber` trap (S3 F1).** An empty optional numeric input yields `NaN`, which
  `z.number().optional()` rejects, so `handleSubmit`'s valid callback never fires and the button
  silently does nothing. Every numeric register uses
  `{ setValueAs: (raw) => raw === "" ? undefined : Number(raw) }`. **This applies to every numeric
  input added in this set.**
- Submit mapping: `guestPrice: values.guestPrice ?? null` (blank **clears** the guest price),
  `defaultSalePrice` omitted when blank, and `categoryPrices` filtered to entries with a price.
- Categories come from `useCatalogClientCategories()` (`Apps/web/src/hooks/useClientCategories.ts`)
  — note the deliberately long name; `use-admin-settings.ts` already exports `useClientCategories`.

Backend safety confirmed: `CatalogService.applyPricing` (`catalog.service.ts:738–761`) only
`update`s `guestPrice` when the key is present (explicit `null` clears it), only sets
`defaultSalePrice` when non-null, and **upserts** category prices. It **never deletes** a category
price, so an omitted category is left untouched. A partial `prices` payload is safe.

### 1.6 `AutocompleteInput` — two behaviours that matter for §9

`Apps/web/src/components/shared/autocomplete-input.tsx`:

1. **It filters `suggestions` locally** against the typed text, matching `label` **or**
   `description` (lines 99–105). With a server-side search this local filter is normally a no-op
   for name matches — but a **barcode** match returns a product whose *name* does not contain the
   typed digits, so the local filter would hide it and the dropdown would look empty.
   **Fix: put the barcode in `option.description`** (§9.3). It also displays it, which is useful.
2. **The input displays the selected option's `label`, looked up in `suggestions`** (lines 87–95).
   If the suggestion list is re-fetched for a different search term, the selected product drops
   out of the list and the field goes blank. **Fix: the options list must always include the
   currently-selected products** (§9.2 — the `ids` query).

### 1.7 `ProductListQuery.ids` — the selected-product resolution mechanism

`Apps/contract/src/modules/catalog/catalog.query.ts:8–19`: `ids` is a **comma-separated** string of
uuids (not an array — Express 5 `querystring` would turn `ids[]=` into a key literally named
`"ids[]"`), regex-validated at the boundary. Introduced in S15 for the storefront's featured strip.
`useAdminCatalogProducts({ ids }, { enabled })` is the existing, tested way to resolve a known set
of product ids to full `AdminProductDto`s. §9.2 reuses it.

`AdminProductDto` (`catalog.dtos.ts:71–97`) carries everything both the picker and the reprice
sub-form need: `quantityOnHand`, `avgStockPrice`, `guestPrice?`, `defaultSalePrice?`,
`categoryPrices: {categoryId, categoryName, price}[]`, `barcode?`.

### 1.8 POS product search — the pattern §9 mirrors

`Apps/web/src/pages/staff/pos/StaffPos.tsx:76–89`:
`useState("")` → `useDebouncedValue(raw, 300)` → `useStaffProducts({ search: debounced || undefined,
page: 1, limit: 20 })`, always enabled (an empty search returns the first page). Mirror this
exactly; do not add an `enabled` gate.

### 1.9 UI inventory

- **No `collapsible.tsx`** in `Apps/web/src/components/ui/`. Use `checkbox.tsx` + a conditional
  render for the "collapsed by default" reprice sub-form.
- `dialog.tsx`, `checkbox.tsx`, `badge.tsx`, `tooltip.tsx`, `select.tsx`, `textarea.tsx` all exist.
- `DataTable` (`components/shared/DataTable.tsx`) renders desktop `<Table>` **and** the mobile
  `renderMobileRow` output simultaneously in jsdom; it has **no header sorting by design**.
- `SimplePagination` returns `null` when `totalPages <= 1` — safe to render unconditionally.

---

## 2. What this set delivers

1. Server-side pagination of the Stock levels tab at 20/page, filters and search intact across pages.
2. An **Adjust** action column on that table opening a per-product adjustment **dialog** with full
   Adjustments-tab functionality, including the reprice sub-form ADM-06 always required.
3. The Adjustments tab's product picker searching the whole catalogue server-side by name/barcode.
4. Wrapping cells and a measured row height in the shared table-PDF renderer, fixing all four
   S25 exports at once.

---

## 3. Contract

### 3.1 `Apps/contract/src/modules/inventory/inventory.query.ts` — paginate `StockQuerySchema`

Replace `StockQuerySchema` (lines 9–16) with:

```ts
export const StockQuerySchema = z.object({
  lowStockOnly: BooleanQuerySchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // S25 added "pdf" alongside the originally-documented "csv". S28 — export=csv|pdf returns the
  // whole filtered stock table, unpaginated: `page`/`limit` above keep their defaults (they are
  // non-optional after .default()) and are deliberately IGNORED on this branch, exactly as
  // MovementsQuerySchema does. Exporting only the page on screen would re-introduce the very
  // defect S25 fixed. The result set is capped at EXPORT_MAX_ROWS.
  export: z.enum(['csv', 'pdf']).optional(),
});
```

Keep the existing S1-finding-F1 comment above the schema (it still describes `search`), and extend
its last sentence to note that `search`/`lowStockOnly` are applied **before** both the pagination
and the export branch.

### 3.2 `Apps/contract/src/modules/inventory/inventory.command.ts` — no change

`CreateAdjustmentSchema.lines[].prices` already exists. Do not touch this file.

### 3.3 No schema/migration in this set

Nothing here changes Prisma. No migration, no backfill.

---

## 4. Backend — stock pagination

### 4.1 `Apps/api/src/modules/inventory/inventory.interface.ts`

Line 22 — change the signature and its comment:

```ts
  // S28 — paginated like listMovements below; the export branch still returns a document instead
  // of a page (`'body' in result` is the controller's discriminant, and PaginatedResult has no
  // `body` key).
  getStock(query: StockQuery): Promise<PaginatedResult<StockRowDto> | ExportResult>;
```

`PaginatedResult` is already imported (line 8).

### 4.2 `Apps/api/src/modules/inventory/inventory.service.ts` — rewrite `getStock` (lines 466–492)

Replace the method with a `where` builder plus the two branches:

```ts
  // S28 — the Stock tab is paginated server-side (20/page by schema default), so the whole
  // catalogue is no longer mapped on every page view. `lowStockOnly` cannot be a Prisma
  // predicate: isLow is `quantityOnHand - quantityReserved <= reorderThreshold`, a three-column
  // arithmetic comparison that neither `where` nor `fieldRef` can express. It is resolved as a
  // one-column id pre-query instead (buildStockWhere below), which keeps ONE `where` — and
  // therefore one search predicate, one ordering and one row count — shared by the paginated and
  // the export branch.
  async getStock(query: StockQuery): Promise<PaginatedResult<StockRowDto> | ExportResult> {
    const where = await this.buildStockWhere(query);

    if (query.export) {
      // `page`/`limit` carry schema defaults and are ignored here on purpose (contract comment on
      // StockQuerySchema.export). The +1 is what makes the EXPORT_MAX_ROWS ceiling detectable —
      // same idiom as listMovements; before S28 this branch read the table unbounded.
      const products = await this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        take: EXPORT_MAX_ROWS + 1,
      });
      assertExportSize(products.length);
      const rows = products.map((product) => InventoryMapper.toStockRowDto(product));
      if (query.export === 'pdf') return this.stockPdf(rows, query);
      return this.stockCsv(rows);
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: products.map((product) => InventoryMapper.toStockRowDto(product)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  // Name is a case-insensitive substring match; barcode is a prefix match so it can use the
  // `Product.barcode @unique` btree index (S1 finding F1 — a `contains` predicate could not).
  // A scanner emits a whole barcode, so `startsWith` also covers the exact-scan case.
  //
  // S28 — the low-stock arm is the only raw SQL in this module's read path. It selects ids only
  // (one column, and only the rows already below threshold), then feeds them back into the same
  // Prisma `where`, so paging, counting, ordering and the export all stay on one code path.
  // The predicate below MUST stay identical to InventoryMapper.isLow — if that rule ever changes,
  // change both.
  private async buildStockWhere(query: StockQuery): Promise<Prisma.ProductWhereInput> {
    const search: Prisma.ProductWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { barcode: { startsWith: query.search } },
          ],
        }
      : {};

    if (!query.lowStockOnly) return search;

    const lowStockIds = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Product" WHERE "quantityOnHand" - "quantityReserved" <= "reorderThreshold"
    `;
    // An empty id list yields `{ id: { in: [] } }`, which Prisma resolves to zero rows — the
    // correct answer when nothing is below threshold, not "no filter".
    return { ...search, id: { in: lowStockIds.map((row) => row.id) } };
  }
```

Also add the `isLow`-duplication cross-reference to `InventoryMapper.isLow`
(`inventory.mapper.ts:119–122`): extend its comment to
`// Shared with the engine's low-stock edge-trigger check (Sprint 2) — same reason as above. The
// same rule is expressed in SQL by InventoryReadService.buildStockWhere (S28); keep them in step.`

**Do not change** `stockCsv` or `stockPdf` beyond the column weights in §5.4 — they already take
`StockRowDto[]` and the `query` for the filter block.

### 4.3 `Apps/api/src/modules/inventory/inventory.controller.ts` — no change

`if ('body' in result)` still discriminates correctly. Leave the file alone.

### 4.4 `Apps/api/src/modules/inventory/inventory.routes.ts` — no change

`validateRequest({ query: StockQuerySchema })` picks up `page`/`limit` automatically.

---

## 5. Backend — PDF cell wrapping

All work is in `Apps/api/src/common/utils/pdf.utils.ts` unless stated.

### 5.1 Constants (replace lines 95–96)

```ts
const ROW_MIN_HEIGHT = 15; // the pre-S28 fixed row height, now a floor for short rows
const HEAD_MIN_HEIGHT = 18;
const CELL_PAD_X = 2;
const CELL_PAD_Y = 3;
```

Delete `ROW_HEIGHT` and `HEAD_HEIGHT`; every use is replaced below.

### 5.2 New helper — `measureRowHeight`

Insert above `drawHeaderRow`:

```ts
// S28 — cells wrap instead of being ellipsised on one line, so a row is as tall as its tallest
// cell. `heightOfString` measures with the font and size CURRENTLY set on the doc, so every
// caller must set the row's font before calling this (bold/HEAD_SIZE for the header row,
// Helvetica/BODY_SIZE for body rows) — measuring with the wrong font silently mis-paginates.
const measureRowHeight = (
  doc: PDFKit.PDFDocument,
  laidOut: LaidOutColumn[],
  cells: string[],
  minHeight: number,
): number => {
  let tallest = 0;
  laidOut.forEach((col, index) => {
    const height = doc.heightOfString(cells[index] ?? '', {
      width: col.width - CELL_PAD_X * 2,
      align: col.align,
    });
    if (height > tallest) tallest = height;
  });
  return Math.max(minHeight, tallest + CELL_PAD_Y * 2);
};
```

`measureRowHeight` must be declared **after** the `LaidOutColumn` type (line 167) — put it between
`layoutColumns` and `drawHeaderRow`.

### 5.3 Rewrite `drawHeaderRow` and `drawTable` (lines 180–226)

```ts
// The cell box: `height` is a hard clip that also stops PDFKit adding a page of its own
// mid-cell, which would desynchronise the manual `y` cursor below. `ellipsis` therefore only
// ever fires in the pathological case handled in drawTable (a single cell taller than a whole
// page); in every normal row the text wraps and fits.
const drawCell = (
  doc: PDFKit.PDFDocument,
  col: LaidOutColumn,
  text: string,
  y: number,
  rowHeight: number,
): void => {
  doc.text(text, col.x + CELL_PAD_X, y + CELL_PAD_Y, {
    width: col.width - CELL_PAD_X * 2,
    height: rowHeight - CELL_PAD_Y * 2,
    align: col.align,
    ellipsis: true,
  });
};

const drawHeaderRow = (
  doc: PDFKit.PDFDocument,
  laidOut: LaidOutColumn[],
  y: number,
  availableWidth: number,
  headHeight: number,
): void => {
  doc.fillColor('#EEEEEE').rect(PAGE_MARGIN, y, availableWidth, headHeight).fill();
  doc.font('Helvetica-Bold').fontSize(HEAD_SIZE).fillColor('#000000');
  for (const col of laidOut) drawCell(doc, col, col.header, y, headHeight);
};

// S28 — rows wrap and grow. The arithmetic that must not be improvised:
//   rowHeight = max(ROW_MIN_HEIGHT, measured + 2*CELL_PAD_Y), then clamped to maxRowHeight.
//   cell box height = rowHeight - 2*CELL_PAD_Y, which is >= `measured` in BOTH branches of the
//   max (if the floor wins, `measured` was < ROW_MIN_HEIGHT - 2*CELL_PAD_Y by definition), so a
//   normal row is never clipped. Only the clamp can clip, and that needs one cell taller than an
//   entire page. Reverting any cell to `lineBreak: false` silently breaks this pagination.
const drawTable = (doc: PDFKit.PDFDocument, data: TablePdfData, availableWidth: number): void => {
  const laidOut = layoutColumns(data.columns, availableWidth);
  const pageBottom = doc.page.height - PAGE_MARGIN - FOOTER_SIZE * 2;

  doc.font('Helvetica-Bold').fontSize(HEAD_SIZE);
  const headHeight = measureRowHeight(doc, laidOut, data.columns.map((col) => col.header), HEAD_MIN_HEIGHT);
  // The tallest a row may be: a full fresh page minus its repeated header. Measured once.
  const maxRowHeight = Math.max(ROW_MIN_HEIGHT, pageBottom - PAGE_MARGIN - headHeight);

  let y = doc.y;
  drawHeaderRow(doc, laidOut, y, availableWidth, headHeight);
  y += headHeight;
  doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#000000');

  for (const row of data.rows) {
    const rowHeight = Math.min(measureRowHeight(doc, laidOut, row, ROW_MIN_HEIGHT), maxRowHeight);
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawHeaderRow(doc, laidOut, y, availableWidth, headHeight);
      y += headHeight;
      doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#000000');
    }
    laidOut.forEach((col, index) => drawCell(doc, col, row[index] ?? '', y, rowHeight));
    doc
      .strokeColor('#DDDDDD')
      .moveTo(PAGE_MARGIN, y + rowHeight)
      .lineTo(PAGE_MARGIN + availableWidth, y + rowHeight)
      .stroke();
    y += rowHeight;
  }

  doc.y = y;
};
```

Notes the executor must respect:
- `drawHeaderRow` leaves the doc in **bold/HEAD_SIZE**; the body font must be restored immediately
  after each call, both before the loop and inside the page-break branch. Measuring a body row
  with the bold font would over-estimate every height.
- Keep `stampPageNumbers`, `drawTotals`, `drawChart`, `drawTitleBlock`, `layoutColumns` and
  `renderTablePdf` unchanged.
- Update the `TablePdfColumn.width` doc comment to say weights now govern how much room a wrapping
  column gets (a narrow weight means more wrapped lines, not truncation).

### 5.4 New export — content-derived weights, for the statistics reports

Statistics builds its columns dynamically and passes `width: 1` for all of them, so a `product`
column gets the same room as a `qty` column. Add, just below `layoutColumns`:

```ts
// S28 — statistics reports have dynamic columns, so their caller cannot hand-tune weights the way
// the inventory/platform exports do. Derive a weight from the longest string each column actually
// contains (header included), divided by a nominal characters-per-unit and clamped so one very
// long free-text column cannot squeeze every other column to nothing. The absolute value is
// irrelevant — layoutColumns normalises the weights across the row.
const WEIGHT_CHARS_PER_UNIT = 8;
const WEIGHT_MIN = 1;
const WEIGHT_MAX = 6;

export const deriveColumnWeights = (headers: string[], rows: string[][]): number[] =>
  headers.map((header, index) => {
    const longest = rows.reduce(
      (max, row) => Math.max(max, (row[index] ?? '').length),
      header.length,
    );
    return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, longest / WEIGHT_CHARS_PER_UNIT));
  });
```

### 5.5 Column-weight adjustments at the call sites

**`Apps/api/src/modules/inventory/inventory.service.ts`, `stockPdf` (lines 526–538)** — give the
product name room; everything else keeps its weight:

- `{ header: 'Product', width: 5 }` → `width: 6`

**`Apps/api/src/modules/inventory/inventory.service.ts`, `movementsPdf` (lines 676–691)** — the
brief names product, type, reference and staff as the columns that need room:

| Column | before | after |
|---|---|---|
| Date | 3 | 3 |
| Reference | 3 | 3.5 |
| Type | 3 | 3.5 |
| Dir | 1.5 | 1.2 |
| Product | 4 | 6 |
| Qty | 1.5 | 1.3 |
| Unit cost | 2.5 | 2.2 |
| Cost of goods | 2.5 | 2.4 |
| Profit | 2.5 | 2.2 |
| Balance | 2 | 1.8 |
| Staff | 3 | 3 |

And **replace the stale `reason` comment** (lines 688–690) with:

```ts
        // `reason` is deliberately dropped here: it is free text of unbounded length and would
        // dominate the row now that cells wrap and rows grow to fit (S28). The CSV
        // (movementsCsv above) carries it in full.
```

**`Apps/api/src/modules/platform/platform.service.ts`, the delivery-fees PDF (lines 326–343)** —
no weight change needed (4 columns, portrait, wilaya/commune names are short). It inherits the
wrapping fix for free. Do not edit this file.

**`Apps/api/src/modules/statistics/statistics.service.ts`, `toPdfExport` (lines 1507–1533)** —
import `deriveColumnWeights` alongside `renderTablePdf` (line 21) and replace the columns line:

```ts
    // S28 — weights derived from the rendered content, because report columns are dynamic: a
    // `productName` column and a `quantity` column used to be given identical width.
    const weights = deriveColumnWeights(headers, rows);
    …
      columns: headers.map((header, index) => ({ header, width: weights[index] ?? 1 })),
```

Leave the `orientation: headers.length > 6 ? 'landscape' : 'portrait'` heuristic as it is — it is
the brief's "landscape where the column count demands it", already implemented.

---

## 6. Web — service, hook and query key

### 6.1 `Apps/web/src/services/inventory.service.ts`

Replace lines 21–48:

```ts
// Split from the dual-return backend method (paginated rows | export-Blob) into two functions —
// a query hook can only have one result type, and `export=csv|pdf` is a distinct caller intent.
// S28 — `getStock` is now paginated server-side, so it returns PaginatedResult<StockRowDto>
// instead of a bare array; `StockListQuery` is the contract query minus `export`, and `page` /
// `limit` are required because StockQuerySchema gives them `.default()`s.
export type StockListQuery = Omit<StockQuery, "export">;

export async function getStock(query: StockListQuery): Promise<PaginatedResult<StockRowDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<StockRowDto>>>(
    apiPath(INVENTORY_ROUTES.STOCK),
    {
      params: {
        lowStockOnly: query.lowStockOnly,
        search: query.search,
        page: query.page,
        limit: query.limit,
      },
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Bypasses the envelope entirely (same pattern as platform.service.ts's exportFees — the
// backend's getStock checks `'body' in result` and sends raw Content-Type/Content-Disposition
// instead of calling sendSuccess when `export` is set).
//
// S25 — mirrors the table's own filters (search/lowStockOnly) instead of always sending none.
// S28 — `page`/`limit` are stripped: the export is the whole filtered stock table, never the page
// on screen, exactly like exportMovements below.
export async function exportStock(
  query: Omit<StockQuery, "export" | "page" | "limit">,
  format: "csv" | "pdf",
): Promise<Blob> { … unchanged body, params unchanged … }
```

`PaginatedResult` is already imported at line 11. Keep the file header comment.

### 6.2 `Apps/web/src/hooks/useInventory.ts`

```ts
export function useStock(query: inventoryService.StockListQuery) {
  return useQuery({
    queryKey: qk.inventory.stock(query),
    queryFn: () => inventoryService.getStock(query),
  });
}
```

- The `= {}` default is removed — `page`/`limit` are required now.
- `useExportStock`'s mutation variable type becomes
  `{ query: Omit<StockQuery, "export" | "page" | "limit">; format: "csv" | "pdf" }`.
- `useCreateAdjustment` is **unchanged** — it already invalidates `qk.inventory.all()` (stock +
  movements + reservations), `qk.catalog.adminProducts.all()` and `qk.stats.all()`, which is
  exactly what the brief asks for. Append to its comment:
  `// S28 — the per-product Adjust dialog submits through this same hook, so the row's quantity and
  // average refresh on close without any extra invalidation.`

### 6.3 `Apps/web/src/lib/query-keys.ts` — no change

`qk.inventory.stock(query)` already hashes the whole query object, so `page` participates in the
key automatically (same as `qk.inventory.movements.list`).

---

## 7. Web — shared adjustment field components

These are new files under `Apps/web/src/pages/admin/inventory/components/`, extracted so the tab's
line editor and the new dialog cannot drift.

### 7.1 `adjustment.schema.ts` — add the reprice draft and a command mapper

Rewrite the file as follows (keeping the existing header comment, extended):

```ts
import { z } from "zod";
import { AdjustmentReason } from "@dragon-telecom/contract";
import type { CreateAdjustmentCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// S28 — the optional reprice sub-form ADM-06 always specified ("an optional collapsed reprice
// sub-form prefilled with current prices") is finally here. It is held as a DRAFT, not as the
// contract's `prices` shape: the draft keeps `enabled` plus per-category prices that may be
// blank, neither of which the command allows. `toCreateAdjustmentCommand` below maps draft →
// command at submit time, which is also where the old
// `AdjustmentFormValues extends CreateAdjustmentCommand` guard moved to — the mapper's return
// annotation now enforces the same thing, and enforces the mapping itself as well.
const repriceDraftSchema = z.object({
  enabled: z.boolean(),
  guestPrice: z.number().min(0).optional(),
  defaultSalePrice: z.number().min(0).optional(),
  categoryPrices: z.array(z.object({ categoryId: z.uuid(), price: z.number().min(0).optional() })),
});

export function adjustmentSchema(
  t: ReturnType<typeof useTranslation>["t"],
  systemQuantityByProductId: Record<string, number>,
) {
  return z
    .object({
      reason: z.enum(AdjustmentReason, { message: t("common.validation.selectRequired") }),
      note: z.string().optional(),
      lines: z
        .array(
          z.object({
            productId: z.uuid(),
            countedQuantity: z.number().int().min(0, t("common.validation.nonNegativeNumber")),
            unitCost: z.number().min(0, t("common.validation.nonNegativeNumber")).optional(),
            reprice: repriceDraftSchema.optional(),
          }),
        )
        .min(1, t("admin.inventory.adjustment.lineRequired")),
    })
    .superRefine(/* unchanged */);
}

export type AdjustmentFormValues = z.infer<ReturnType<typeof adjustmentSchema>>;

// Draft → contract command. `guestPrice: … ?? null` is deliberate and matches reprice-prompt.tsx:
// a blank guest-price field CLEARS the guest price (UpdatePricingCommand.guestPrice is
// `number | null | undefined`, and catalog's applyPricing treats each state differently).
// `defaultSalePrice` is omitted when blank, and blank category prices are dropped — applyPricing
// upserts, never deletes, so an omitted category keeps its existing price.
export function toCreateAdjustmentCommand(values: AdjustmentFormValues): CreateAdjustmentCommand {
  return {
    reason: values.reason,
    ...(values.note != null ? { note: values.note } : {}),
    lines: values.lines.map((line) => ({
      productId: line.productId,
      countedQuantity: line.countedQuantity,
      ...(line.unitCost != null ? { unitCost: line.unitCost } : {}),
      ...(line.reprice?.enabled
        ? {
            prices: {
              guestPrice: line.reprice.guestPrice ?? null,
              ...(line.reprice.defaultSalePrice != null
                ? { defaultSalePrice: line.reprice.defaultSalePrice }
                : {}),
              categoryPrices: line.reprice.categoryPrices
                .filter((entry): entry is { categoryId: string; price: number } => entry.price != null)
                .map((entry) => ({ categoryId: entry.categoryId, price: entry.price })),
            },
          }
        : {}),
    })),
  };
}
```

Delete the old `AssertAssignable` / `_CreateAdjustmentCommandCheck` block at the bottom and its
comment — the mapper's `: CreateAdjustmentCommand` return annotation is now the compile-time guard,
and the old assertion would be false (the draft is not the command).

> `note` is passed through unchanged, including the empty string the form defaults to. That is
> pre-existing behaviour (`inventory.service.ts:828` writes it, and `MovementRef.reason` picks it
> up); do not "improve" it in this set.

### 7.2 New `adjustment-reprice-fields.tsx`

```
Apps/web/src/pages/admin/inventory/components/adjustment-reprice-fields.tsx
```

Props:

```ts
interface AdjustmentRepriceFieldsProps {
  index: number;                               // the RHF line index
  control: Control<AdjustmentFormValues>;
  setValue: UseFormSetValue<AdjustmentFormValues>;
  watch: UseFormWatch<AdjustmentFormValues>;
  avgStockPrice: number;                       // cost basis for MarginDisplay (D10)
  categories: { id: string; name: string }[];  // from useCatalogClientCategories, resolved by the parent
  current?: {                                  // undefined while the product's detail is loading
    guestPrice?: number;
    defaultSalePrice?: number;
    categoryPrices: { categoryId: string; price: number }[];
  };
  disabled?: boolean;
}
```

Behaviour:

1. Renders a `Checkbox` + `Label` bound to `lines.${index}.reprice.enabled` via `Controller`,
   labelled `admin.inventory.adjustment.reprice.toggle`. **Unchecked by default** — this is the
   "collapsed" state ADM-06 asks for, and it is what keeps an ordinary adjustment from writing
   `ProductPrice` rows.
2. When unchecked, render nothing else and leave the rest of the draft untouched.
3. When checked, render, inside a bordered block titled `admin.inventory.adjustment.reprice.title`:
   - `guestPrice` and `defaultSalePrice` inputs;
   - one input per entry in `categories`, with a hidden `categoryId` field at the matching array
     index (mirroring `reprice-prompt.tsx:146–156`);
   - `<MarginDisplay price={watch(<field>)} cost={avgStockPrice} />` beneath each input;
   - each `<Label>` carries the previous value, using the same helper text shape as
     `reprice-prompt.tsx`: `admin.inventory.adjustment.reprice.previous` /
     `…reprice.previousEmpty`.
4. **Every numeric input uses `setValueAs: (raw) => raw === "" ? undefined : Number(raw)`** — the
   S3 F1 `valueAsNumber`→`NaN` trap (§1.5). Use `Controller` + an explicit `onChange` mapping, or
   `register` with `setValueAs`; both are used elsewhere in this folder.
5. **Prefill effect.** In a `useEffect` keyed on `[current, index]`, when `current` first becomes
   available, `setValue("lines.<index>.reprice", { enabled: <keep current enabled>, guestPrice:
   current.guestPrice, defaultSalePrice: current.defaultSalePrice, categoryPrices: categories.map(
   c => ({ categoryId: c.id, price: current.categoryPrices.find(p => p.categoryId === c.id)?.price }))
   }, { shouldDirty: false })`. Guard it with a `useRef<string | null>` holding the productId it
   last prefilled for, **exactly like the unit-cost default at `adjustment-line-editor.tsx:53–61`**,
   so a value the user typed is never overwritten and a product change does re-prefill. The
   productId must therefore also be a prop (`productId: string`).

File comment: state that this is the ADM-06 §UI "optional collapsed reprice sub-form", that it is
shared by the Adjustments tab and the Stock-tab Adjust dialog, and that its shape mirrors
`supplier-invoices/components/reprice-prompt.tsx` (the app's other reprice form) down to the
`-previous …-` label convention and the `MarginDisplay` cost basis.

### 7.3 New `adjustment-unit-cost-field.tsx`

Extract lines 109–137 of `adjustment-line-editor.tsx` **and** the default-once-per-product effect
at lines 53–61 into:

```
Apps/web/src/pages/admin/inventory/components/adjustment-unit-cost-field.tsx
```

Props: `{ index, control, setValue, productId, avgStockPrice, isIncrease, unitCostError?, disabled? }`.

It renders nothing when `!isIncrease`. Move the whole D10/S4 comment block with it verbatim — it
explains why a product with `avgStockPrice <= 0` is left blank on purpose so the schema's refine
forces a real figure instead of silently creating a zero-cost layer. `adjustment-line-editor.tsx`
then renders `<AdjustmentUnitCostField … />` in place of both the effect and the JSX block.

---

## 8. Web — Stock levels: pagination + Adjust dialog

### 8.1 `Apps/web/src/pages/admin/inventory/AdminInventory.tsx` — stock tab wiring

1. Add state: `const [stockPage, setStockPage] = useState(1);`
2. Wrap the two stock filter setters so a filter change resets the page, mirroring
   `handleMovementFiltersChange`:

```ts
  const handleStockSearchChange = (value: string) => {
    setStockSearch(value);
    setStockPage(1);
  };

  const handleLowStockOnlyChange = (value: boolean) => {
    setLowStockOnly(value);
    setStockPage(1);
  };
```

3. Split the query memos — the list query paginates, the export query does not:

```ts
  // Same filters the stock table is rendered from, minus page/limit — the export is the whole
  // filtered stock table (S25/S28), never the visible page.
  const stockExportQuery = useMemo(
    () => ({ lowStockOnly, search: debouncedStockSearch.trim() || undefined }),
    [lowStockOnly, debouncedStockSearch],
  );
  const stockQuery = useMemo(
    () => ({ ...stockExportQuery, page: stockPage, limit: 20 }),
    [stockExportQuery, stockPage],
  );
```

  and change `handleExportStock` to pass `stockExportQuery`.
4. `<StockLevelsTable data={stock.data?.items ?? []} … search={stockSearch}
   onSearchChange={handleStockSearchChange} lowStockOnly={lowStockOnly}
   onLowStockOnlyChange={handleLowStockOnlyChange} onAdjust={setAdjustRow} />`
5. Render pagination under the table, inside the `stock` `TabsContent` (which must gain
   `className="space-y-4"` like the movements tab):

```tsx
  {stock.data && (
    <SimplePagination
      page={stock.data.meta.page}
      totalPages={stock.data.meta.totalPages}
      onPageChange={setStockPage}
    />
  )}
```

6. Dialog state and render:

```ts
  const [adjustRow, setAdjustRow] = useState<StockRowDto | null>(null);
```

```tsx
  <StockAdjustDialog
    row={adjustRow}
    open={adjustRow != null}
    onOpenChange={(open) => { if (!open) setAdjustRow(null); }}
    onSubmit={handleAdjustmentSubmit}
    isSubmitting={createAdjustment.isPending}
  />
```

  placed as a sibling of `<Tabs>` inside the page's root `<div className="space-y-6">`.
7. `handleAdjustmentSubmit` now maps through the command mapper and closes the dialog on success:

```ts
  const handleAdjustmentSubmit = (values: AdjustmentFormValues) => {
    createAdjustment.mutate(toCreateAdjustmentCommand(values), {
      onSuccess: (result) => {
        toast.success(t("admin.inventory.adjustment.success", { reference: result.reference }));
        setAdjustRow(null);
      },
    });
  };
```

  This one handler serves both the tab form and the dialog; `setAdjustRow(null)` is a harmless
  no-op when the submit came from the tab.
8. Import `StockRowDto` as a type from `@dragon-telecom/contract`, plus
   `toCreateAdjustmentCommand` and the new dialog.

### 8.2 `Apps/web/src/pages/admin/inventory/components/stock-levels-table.tsx` — Adjust column

- Add an **optional** prop `onAdjust?: (row: StockRowDto) => void`. Optional so the component still
  renders without it (and so the existing primitives test still compiles).
- Append a column when `onAdjust` is supplied — build the array conditionally inside the existing
  `useMemo`, with `onAdjust` added to the dependency list:

```tsx
      ...(onAdjust
        ? [
            {
              id: "adjust",
              header: t("admin.inventory.stock.table.actions"),
              cell: ({ row }) => (
                <Button variant="outline" size="sm" onClick={() => onAdjust(row.original)}>
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  {t("admin.inventory.stock.adjust")}
                </Button>
              ),
            } satisfies ColumnDef<StockRowDto>,
          ]
        : []),
```

- Add the same button to `renderMobileRow`, below the existing lines.
- Bump the loading skeleton to `columns={onAdjust ? 8 : 7}`.
- Import `SlidersHorizontal` from `lucide-react` (`Button` is already imported).
- Extend the component's header comment: the table is now **server-paginated** (the page owns
  `page`/`limit` and renders `SimplePagination`; this component still renders only the rows it is
  given), and the Adjust action opens a dialog — **it must not navigate to the Adjustments tab**.

### 8.3 New `stock-adjust-dialog.tsx`

```
Apps/web/src/pages/admin/inventory/components/stock-adjust-dialog.tsx
```

```ts
interface StockAdjustDialogProps {
  row: StockRowDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AdjustmentFormValues) => void;
  isSubmitting?: boolean;
}
```

Structure — **two components in the file**: the outer `StockAdjustDialog` renders
`<Dialog>` / `<DialogContent>` and, when `row != null`, an inner `StockAdjustForm` keyed
`key={row.productId}`. The `key` is what resets the form between two different rows; do not try to
do it with `form.reset` in an effect.

`StockAdjustForm` (props: `row: StockRowDto`, `onSubmit`, `isSubmitting`):

1. Data:
   - `const product = useAdminCatalogProduct(row.productId);` — supplies `guestPrice`,
     `defaultSalePrice`, `categoryPrices` for the reprice sub-form. Already `enabled: !!id`.
   - `const categories = useCatalogClientCategories();`
   - **`systemQuantity` and `avgStockPrice` come from `row`, not from `product`.** The row is what
     the admin clicked and what the table shows; taking them from a second source invites two
     different numbers on one screen. Say so in a comment.
2. Form:

```ts
  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema(t, { [row.productId]: row.quantityOnHand })),
    defaultValues: {
      reason: AdjustmentReason.COUNT,
      note: "",
      lines: [{ productId: row.productId, countedQuantity: row.quantityOnHand }],
    },
  });
```

   Defaulting `countedQuantity` to the current on-hand means the dialog opens at delta 0 — the
   admin types the count they actually made.
3. Layout, top to bottom, all labels through `t()`:
   - Product name (`row.name`) and barcode, read-only, in the `DialogTitle` / description.
   - Reason `Select` — the same four `AdjustmentReason` options and the same translation keys as
     `adjustment-form.tsx:61–85`.
   - Note `Textarea`.
   - System quantity (read-only, `row.quantityOnHand`) and counted-quantity `Input type="number"`
     side by side, with the live delta `Badge` using the same variant rule as
     `adjustment-line-editor.tsx:101–103` (`outline` at 0, `default` positive, `destructive`
     negative) and a `+` prefix when positive.
   - `<AdjustmentUnitCostField index={0} … isIncrease={delta > 0} avgStockPrice={row.avgStockPrice}
     productId={row.productId} unitCostError={form.formState.errors.lines?.[0]?.unitCost?.message} />`
   - `<AdjustmentRepriceFields index={0} productId={row.productId}
     avgStockPrice={row.avgStockPrice}
     categories={(categories.data ?? []).map(c => ({ id: c.id, name: c.name }))}
     current={product.data ? { guestPrice: product.data.guestPrice,
       defaultSalePrice: product.data.defaultSalePrice,
       categoryPrices: product.data.categoryPrices.map(p => ({ categoryId: p.categoryId, price: p.price })) }
       : undefined} … />`
   - Footer: Cancel (`common.actions.cancel`, `variant="outline"`, calls `onOpenChange(false)`) and
     Save (`admin.inventory.adjustment.submit`, `disabled={isSubmitting}`, shows `common.saving`).
4. `onSubmit` is `form.handleSubmit(onSubmit)` — it hands the **form values** up; the page maps
   them to the command (§8.1.7). The dialog never calls a service or a mutation itself.
5. File comment: this is S28's per-product entry point. **The adjustment model is unchanged** — it
   posts the same `POST /admin/inventory/adjustments`, gets the same `AJU-` reference from the same
   sequence, and produces the same `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` movement types as the tab; the
   only difference is that the command has exactly one line.

---

## 9. Web — Adjustments tab: server-side product search

### 9.1 `AdminInventory.tsx` — remove the 100-product ceiling

Delete `const products = useAdminCatalogProducts({ page: 1, limit: 100 })` and the three memos
built from it (lines 79–93), **and delete the "Known limitation: that query is capped at
`limit: 100`" sentence from the page's header comment** (lines 33–34) — it becomes false.

`AdjustmentForm` becomes the owner of its own picker data, because it is the component that knows
which product ids are currently selected (`watch("lines")`). Its props shrink to
`{ onSubmit, isSubmitting }`.

### 9.2 New `Apps/web/src/hooks/use-adjustment-products.ts`

```ts
export interface AdjustmentProductFacts {
  systemQuantityByProductId: Record<string, number>;
  avgStockPriceByProductId: Record<string, number>;
  currentPricesByProductId: Record<string, {
    guestPrice?: number;
    defaultSalePrice?: number;
    categoryPrices: { categoryId: string; price: number }[];
  }>;
}

export function useAdjustmentProducts(search: string, selectedProductIds: string[]): {
  options: AutocompleteOption[];
  isLoading: boolean;
} & AdjustmentProductFacts
```

Implementation:

- **Search query** — mirrors POS (§1.8):
  `useAdminCatalogProducts({ search: search.trim() || undefined, page: 1, limit: 20 })`, always
  enabled. Debouncing happens in the caller (§9.3), same as POS.
- **Selection query** — resolves the products the form has already picked, so they survive a
  changing search term:
  `useAdminCatalogProducts({ ids: uniqueIds.join(","), page: 1, limit: 100 },
   { enabled: uniqueIds.length > 0 })` where
  `uniqueIds = [...new Set(selectedProductIds.filter(Boolean))]` (memoised; an unstable array
  identity would refetch on every render).
- **Merge** both result sets into one `Map<string, AdminProductDto>` keyed by id (selection wins on
  collision — it is the authoritative row for a product the user actually picked), then derive
  `options` and the three record maps from that map.
- `options`: `{ value: p.id, label: p.name, description: p.barcode }`.
- `isLoading`: `searchQuery.isLoading || selectionQuery.isLoading`.

File comment must record the two non-obvious reasons this hook exists, both from §1.6:
1. `AutocompleteInput` re-derives the displayed text from `suggestions.find(s => s.value === value)`
   — a selected product missing from the list blanks the field, which is why the `ids` query exists.
2. `AutocompleteInput` also filters `suggestions` locally by the typed text against `label` **or**
   `description` — a **barcode** match returns a product whose name does not contain the digits, so
   the barcode **must** go in `description` or a server-side barcode hit would be filtered straight
   back out and the dropdown would look empty.

Also record that `ids` is comma-separated because Express 5's `querystring` parser would turn
`ids[]=` into a key literally named `"ids[]"` (S15, `catalog.query.ts:8–19`).

### 9.3 `adjustment-form.tsx`

- Props become `{ onSubmit, isSubmitting }`.
- Add `const [productSearch, setProductSearch] = useState("")` and
  `const debouncedProductSearch = useDebouncedValue(productSearch, 300)` — 300 ms, the app-wide
  value used by POS and by this very page's two other search boxes.
- `const selectedProductIds = useMemo(() => (watchedLines ?? []).map(l => l.productId), [watchedLines]);`
- `const { options, systemQuantityByProductId, avgStockPriceByProductId, currentPricesByProductId,
  isLoading } = useAdjustmentProducts(debouncedProductSearch, selectedProductIds);`
- The resolver still needs the quantity map:
  `resolver: zodResolver(adjustmentSchema(t, systemQuantityByProductId))`. Because the map arrives
  asynchronously, pass a **stable resolver identity per map** — RHF re-reads the resolver on each
  validation, so recreating it inline on every render is what the file already effectively does;
  leave that behaviour as is. Just be aware the refine only becomes accurate once the selected
  product's facts have loaded, which is the same as today.
- Fetch categories once here: `const categories = useCatalogClientCategories();` and pass
  `categories.data ?? []` down to each line editor.
- Pass `onProductSearchChange={setProductSearch}`, `isProductSearchLoading={isLoading}`,
  `currentPrices={currentPricesByProductId[productId]}` and `categories` to `AdjustmentLineEditor`.
- Update the file's header comment: it is no longer purely "dumb" — it owns the picker's search
  state and its data hook, because it is the component that knows which products are selected.
  One shared search string serves every line's picker; only one dropdown is open at a time, so a
  per-line search would only add queries.

### 9.4 `adjustment-line-editor.tsx`

- New props: `onSearchChange: (q: string) => void`, `isSearchLoading?: boolean`,
  `categories: { id: string; name: string }[]`,
  `currentPrices?: { guestPrice?: number; defaultSalePrice?: number; categoryPrices: {categoryId: string; price: number}[] }`,
  plus `watch: UseFormWatch<AdjustmentFormValues>` (needed by the reprice fields' `MarginDisplay`).
- The `AutocompleteInput` gains `onSearch={onSearchChange}` and `isLoading={isSearchLoading}`.
- Replace the unit-cost effect + JSX with `<AdjustmentUnitCostField … />` (§7.3).
- Add `<AdjustmentRepriceFields index={index} productId={productId} avgStockPrice={avgStockPrice}
  categories={categories} current={currentPrices} … />` in a full-width `sm:col-span-5` cell below
  the unit-cost field.
- Update the header comment to mention the reprice sub-form and that the picker now searches the
  whole catalogue server-side.

---

## 10. Translations — `Apps/web/src/config/translations.json`

Add, in the flat `{ "en", "fr", "ar": "" }` shape, alongside the existing
`admin.inventory.*` block (around line 12872 / 13037):

| Key | en | fr |
|---|---|---|
| `admin.inventory.stock.table.actions` | Actions | Actions |
| `admin.inventory.stock.adjust` | Adjust | Ajuster |
| `admin.inventory.stock.adjustDialog.title` | Adjust stock — {product} | Ajuster le stock — {product} |
| `admin.inventory.stock.adjustDialog.description` | Creates a stock adjustment for this product only. | Crée un ajustement de stock pour ce produit uniquement. |
| `admin.inventory.adjustment.reprice.toggle` | Also update this product's prices | Mettre aussi à jour les prix de ce produit |
| `admin.inventory.adjustment.reprice.title` | Prices | Prix |
| `admin.inventory.adjustment.reprice.guestPrice` | Guest price | Prix visiteur |
| `admin.inventory.adjustment.reprice.defaultSalePrice` | Default sale price | Prix de vente par défaut |
| `admin.inventory.adjustment.reprice.categoryPriceLabel` | {category} price | Prix {category} |
| `admin.inventory.adjustment.reprice.previous` | -previous {value}- | -précédent {value}- |
| `admin.inventory.adjustment.reprice.previousEmpty` | -previous empty- | -précédent vide- |
| `admin.inventory.adjustment.productSearchPlaceholder` | Search by name or barcode | Rechercher par nom ou code-barres |

Before adding any of these, **grep for each key** — `common.actions.cancel`, `common.saving`,
`common.pagination.pageOf`, `common.validation.nonNegativeNumber`, `common.margin.noCostBasis` and
every `admin.inventory.adjustment.*` key listed in §1.4 already exist and must be reused, not
duplicated. `{product}`, `{value}` and `{category}` are the app's existing interpolation syntax
(see `admin.inventory.adjustment.success`, which interpolates `{reference}`).

---

## 11. Files touched — checklist

**Contract (1)**
- `Apps/contract/src/modules/inventory/inventory.query.ts` — `StockQuerySchema` gains `page`/`limit`

**API (5)**
- `Apps/api/src/common/utils/pdf.utils.ts` — wrapping cells, measured rows, `deriveColumnWeights`
- `Apps/api/src/modules/inventory/inventory.interface.ts` — `getStock` return type
- `Apps/api/src/modules/inventory/inventory.service.ts` — `getStock` + `buildStockWhere`; PDF column weights; stale `reason` comment
- `Apps/api/src/modules/inventory/inventory.mapper.ts` — cross-reference comment on `isLow`
- `Apps/api/src/modules/statistics/statistics.service.ts` — derived column weights

**Web — new (4)**
- `Apps/web/src/hooks/use-adjustment-products.ts`
- `Apps/web/src/pages/admin/inventory/components/stock-adjust-dialog.tsx`
- `Apps/web/src/pages/admin/inventory/components/adjustment-reprice-fields.tsx`
- `Apps/web/src/pages/admin/inventory/components/adjustment-unit-cost-field.tsx`

**Web — modified (7)**
- `Apps/web/src/services/inventory.service.ts`
- `Apps/web/src/hooks/useInventory.ts`
- `Apps/web/src/pages/admin/inventory/AdminInventory.tsx`
- `Apps/web/src/pages/admin/inventory/components/stock-levels-table.tsx`
- `Apps/web/src/pages/admin/inventory/components/adjustment-form.tsx`
- `Apps/web/src/pages/admin/inventory/components/adjustment-line-editor.tsx`
- `Apps/web/src/pages/admin/inventory/components/adjustment.schema.ts`
- `Apps/web/src/config/translations.json`

**Not touched:** `inventory.controller.ts`, `inventory.routes.ts`, `platform.service.ts`,
`query-keys.ts`, `prisma/schema.prisma`, and **every test file**.

---

## 12. Validation (no test runs)

1. `npm run build` in `Apps/contract` first — both apps consume the built package.
2. `npx tsc --noEmit` in `Apps/api`, then in `Apps/web`.
3. `npm run lint` in both. Per the recorded ESLint/Node 18 issue, lint is trustworthy now — treat
   any finding it reports as real.
4. Grep sweep for leftovers: `rg "systemQuantityByProductId|avgStockPriceByProductId"` should only
   match `adjustment.schema.ts`, `adjustment-form.tsx`, `adjustment-line-editor.tsx`,
   `use-adjustment-products.ts` and the dialog — **not** `AdminInventory.tsx`.
5. Grep `rg "lineBreak: false" Apps/api/src/common/utils/pdf.utils.ts` — must return **nothing**
   in `drawTable`/`drawHeaderRow`/`drawCell` (`drawChart`'s bar labels legitimately keep it).
6. Grep `rg "t\(\"admin\.inventory" Apps/web/src` and confirm every key exists in
   `translations.json`.

---

## 13. Manual verification checklist (owner, in the browser)

**Stock levels pagination**
1. `/admin/inventory` → Stock levels. With more than 20 products, exactly 20 rows show and the
   pager reads "Page 1 of N".
2. Next page → 20 different rows, no refetch flicker of the whole page, pager advances.
3. Type a product name in Search → results filter, pager resets to page 1, page count shrinks.
4. Clear the search, go to page 3, then toggle **Low stock only** → it jumps back to page 1 and
   shows only low rows (red product names, red dot). Paging through the low-stock set works.
5. With **Low stock only** on **and** a search term, both filters apply together.
6. Export → CSV and Export → PDF while on page 3 with filters on: the file contains the **whole
   filtered set**, not the 20 rows on screen.

**Adjust dialog**
7. Click **Adjust** on a row → a dialog opens. It must **not** switch to the Adjustments tab.
8. The dialog shows the product name, its system quantity, and a counted quantity pre-set to that
   same figure with a delta of 0.
9. Enter a counted quantity **above** system → the delta chip turns positive, a unit-cost field
   appears pre-filled with the product's average stock price, with the average shown beneath it.
10. Enter a counted quantity **below** system → the delta chip turns negative (red) and **no**
    unit-cost field appears.
11. Tick **Also update this product's prices** → the price block expands with the product's
    current guest price, default sale price and one field per client category, each label showing
    the previous value, and a margin under each.
12. Save → success toast with an `AJU-…` reference, the dialog closes, and **the row's quantity and
    average stock price update in place without a manual refresh**.
13. Movement ledger tab → the new `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` movement is there with the
    `AJU-…` reference. Admin → Products → that product shows the new prices (if step 11 was used).
14. Re-open the dialog on a **different** row → every field is reset to that product's values, with
    nothing left over from the previous product.
15. Open the dialog, change nothing, Save → an adjustment with delta 0 is accepted and **no**
    movement appears in the ledger (a delta-0 line writes no movement by design).

**Adjustments tab product search**
16. Adjustments tab → type the name of a product you know is **old** (not in the first page of the
    admin product list) → it appears in the picker and is selectable.
17. Type/scan a **barcode** → the matching product appears (this is the case the local filter used
    to swallow), showing the barcode under its name.
18. Select it, then type a completely different search term → **the selected product's name stays
    in the field**, it does not blank out.
19. Add a second line, pick a different product, tick reprice on one of them only → Save → only
    that product's prices change.

**PDF exports — wrapping**
20. Stock levels → Export → PDF, with at least one product whose name is long enough to have been
    truncated before. The name **wraps onto two or more lines**, the row grows, and no text
    overlaps the neighbouring column.
21. The header row is fully readable — no word cut mid-way — and **repeats on every page**.
22. Page numbers, the title, the applied-filter lines and the generated timestamp are all still
    present and unchanged.
23. Movement ledger → Export → PDF: same checks, plus long `referenceLabel`, movement type and
    staff-name values wrap rather than truncate.
24. Statistics → any report → Export → PDF: the wide text columns are visibly wider than the
    numeric ones, and nothing overlaps.
25. Settings → Delivery fees → Export → PDF: still correct (it shares the renderer but was not
    otherwise changed).
26. **Print at least one of these PDFs to the actual office printer**, not just the on-screen
    preview — confirm the wrapped rows and the repeated header land correctly on paper and nothing
    is clipped at the page edge.

---

## 14. Questions and flags for the owner

1. **The Adjustments tab gains the reprice sub-form too.** The brief only asked for it in the new
   dialog, but the tab is the thing the dialog is supposed to mirror, and `ADM-06-inventory.md:10`
   has required it since conception. Building it once and using it in both places is the only way
   to satisfy both. If you would rather the tab stayed as it is, say so — the shared component
   simply would not be rendered by `adjustment-line-editor.tsx`.
2. **`lowStockOnly` uses one raw-SQL id pre-query.** `isLow` is a three-column arithmetic
   comparison that Prisma's `where` cannot express, so with the filter on, the ids of the
   below-threshold products are read first (one column) and fed back into the normal Prisma query.
   The alternative — keeping the whole catalogue in memory on every page view — is what this set is
   meant to stop. Flagging because it puts the low-stock rule in two places (§4.2 comments both).
3. **`getStock`'s response shape changes** from a bare array to `{ items, meta }`. Only
   `AdminInventory.tsx` consumes it, but five test files assert the old shape and will fail. Per
   the programme's no-test-gate rule they are left untouched; they will need a pass of their own
   whenever the suites are revisited.
4. **The `reason` column is still absent from the movement-ledger PDF.** The reason it was dropped
   (wrapping was forbidden) no longer holds, but the brief does not ask for it back and it is
   unbounded free text that would dominate every row. The CSV still carries it in full. Say the
   word if you want it in the PDF.
5. **20/page is fixed, not user-selectable**, matching the movement ledger and every other admin
   table. The contract allows up to 100 if you ever want a page-size control.
