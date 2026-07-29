# Plan S4 — Inventory

*Contract (two query schemas) + backend (two `where` clauses) + frontend (stock table, movement
filters, adjustment form). Consumes S1 and S2.*

Scope, verbatim from `app-issues-01.md` §S4:

- Stock levels: search by **barcode or product name**; add a **total product cost** column; rename
  the second quantity column to **reserved qty**.
- Movement ledger: search by **barcode or product name**.
- Adjustments: the product picker shows the **name**, not the id (RC-1).
- Adjustments: on a positive delta, default the new unit cost to the product's **`avgStockPrice`**,
  with helper text beneath the input reading *"the average price is …"*.

---

## 0. Before you start

### 0.1 Sets that must land first

**S1** and **S2** — both executed and reported (`results/report-S01.md`, `report-S02.md`). **S3** is
also executed and reported (`results/report-S03.md`); S4 does not depend on it, but reuses two of
its precedents (named in F2 and F6).

Concretely inherited:

| From | What this set uses |
|---|---|
| S1 | `AdminProductDto.avgStockPrice` (the figure the adjustment default reads — D10) and the recorded barcode-search instruction reproduced in **F1**. |
| S1 | RC-4 is **already done** in this module — `MovementDto.referenceLabel` and `ReservationDto.holderReference` already carry human references. Do not re-touch `resolveReferenceLabels()`. |
| S2 | The rebuilt `AutocompleteInput` contract (`value` = entity id, label displayed) — this is what closes RC-1 for the adjustment product picker. **Verify only**, see Action 11. |
| S3 | `formatDZD(amount, language)` as the money formatter in admin tables (`admin-product-prices-table.tsx` precedent) and the debounced-search wiring pattern in `AdminProducts.tsx`. |

### 0.2 Findings from reading the code — read before acting

**F1 — barcode search must be `startsWith`, not `contains` (S1 finding F1, verbatim).**
> `Product.barcode @unique` is already a unique btree index. **S3/S4 must write barcode search as**
> `{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { barcode: { startsWith: q } }] }`.
> A `barcode: { contains: … }` predicate would **not** use this index.

S3 applied exactly this in `catalog.service.ts`'s `staffAdminWhere()` (lines 894–912). That helper
serves the catalog module only — **inventory has its own two query paths and gets nothing from it**.
Both new predicates in Action 2 must be written the same way.

**F2 — "total product cost" already exists in the DTO; no backend or contract change is needed for
it.** `StockRowDto.stockValue` is `quantityOnHand × avgStockPrice`
(`inventory.mapper.ts:44`) — that *is* the total cost of the product's stock, it is already in the
CSV export's headers, and the stock table simply never rendered it. Action 6 renders it. **Do not
add a new DTO field and do not recompute it in the component.**

**F3 — the stock table's three quantity columns are indistinguishable, and two of its headers are
borrowed from other screens.** `stock-levels-table.tsx` lines 48–55 render:

| Column | Field | Header key today | Problem |
|---|---|---|---|
| 1 | `quantityOnHand` | `admin.inventory.stock.table.quantity` → "Quantity" | fine |
| 2 | `quantityReserved` | `admin.inventory.reservations.table.quantity` → "Quantity" | **the brief's complaint** — identical to column 1, and borrowed from the *reservations* table |
| 3 | `availableQuantity` | `common.units.inStock` → "in stock" | a lowercase unit suffix used as a column header |
| 4 | `avgStockPrice` | `admin.inventory.adjustment.unitCost` → "Unit cost" | borrowed from the *adjustment form*; mislabels a D10 average as a unit cost, and would read as a near-duplicate of the new "Total cost" column |

The brief names column 2. Columns 3 and 4 are fixed in the same action because the brief's complaint
is that the quantity columns can't be told apart, and because leaving "Unit cost" next to a new
"Total cost" column would be actively misleading. All four get inventory-scoped keys of their own
(Action 5). No key is deleted — each borrowed key stays in use by the screen it belongs to.

**F4 — the adjustment unit-cost input turns a cleared field into `0`, not `undefined`.**
`adjustment-line-editor.tsx:96` — `onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}`.
Once Action 9 prefills the field, clearing it would silently submit **unit cost 0**, creating a
zero-cost FIFO layer that permanently drags `avgStockPrice` down — and the schema's
"unit cost is required when the count raises stock" refine (`adjustment.schema.ts:35`, which tests
`=== undefined`) would never fire. Action 9 maps blank → `undefined`, the same shape as
`AdminProductsAdd.tsx`'s `optionalNumber` helper and S3's `setValueAs` fixes (report-S03 F1).
`countedQuantity`'s `parseInt(...) || 0` on line 68 is **left alone** — 0 is a legitimate count.

**F5 — the adjustment form already has everything needed to source `avgStockPrice`.**
`AdminInventory.tsx:56–64` already loads `useAdminCatalogProducts({ page: 1, limit: 100 })` and
derives `productOptions` + `systemQuantityByProductId` from it. `AdminProductDto` carries
`avgStockPrice` (S1). A third map, built in the same `useMemo` style, is all that is required — **no
new query, no new endpoint, no new hook.**

**F6 — the debounced-search pattern to copy.** `AdminProducts.tsx:60–70` owns the raw input state in
the page and feeds `useDebouncedValue(searchInput, 300)` into the query. `AdminProducts` additionally
mirrors it into the URL and fires the `STAFF_SEARCH` beacon — **inventory does neither**: no
inventory filter is URL-backed today, and the search-log beacon is S6's subject, not this set's. Keep
the state local to `AdminInventory.tsx`.

**F7 — no DTO, mapper, schema (Prisma) or migration change is required by this set.** The only
contract edits are two optional query fields. `StockRowDto`, `MovementDto`, `ReservationDto`,
`CreateAdjustmentCommand` and every mapper are untouched. Nothing in this set can move a money or
stock figure: the backend's `createAdjustment` **already** defaults a missing `unitCost` to
`product.avgStockPrice` (`inventory.service.ts:610`, added by S1) — Action 9 only makes the UI show
and pre-fill the value the backend would have chosen anyway.

**F8 — the stock tab has no pagination and the movement tab does.** `getStock` returns the whole
array (no `page`/`limit` on `StockQuerySchema`), so the stock search needs no page reset;
`listMovements` is paginated, so the movement search **must** reset to page 1 (Action 8).

### 0.3 Standing rules for this set

- **No test file may be edited and no test suite may be run.** Validation is `tsc --noEmit` + lint
  on `Apps/contract`, `Apps/api`, `Apps/web`. Stale tests are *listed* in the report (Action 12), not
  touched.
- **All user-facing text goes through `t()`**, keys added to `Apps/web/src/config/translations.json`
  — flat dotted keys → `{ en, fr, ar }`, with **`ar` always `""`**.
- **Read the comment above every line you change** and update any your change falsifies. Six comments
  are named explicitly below; they are not optional.
- Layering: page → hook → service → backend. The tables and the line editor stay dumb (props in,
  callbacks out) — no component calls a service.
- Money is rendered with `formatDZD(value, language)` from `@/lib/utils`, never a bare
  `toLocaleString()`.

### 0.4 Decisions taken for this plan — do not re-open

| # | Question | Decision |
|---|---|---|
| **D-a** | Filter stock rows client-side (the list is unpaginated) or server-side? | **Server-side**, on `StockQuerySchema.search`. Same predicate, same index and same wording as the movement ledger and the products list; a client-side filter would silently diverge from them and could not use the barcode index. |
| **D-b** | Does **Export CSV** respect the search (and the low-stock switch)? | **No change to the export.** `exportStockCsv()` sends only `export=csv` today and already ignores `lowStockOnly`; it exports the full stock list. The backend applies `search` *before* the export branch, so if the owner later wants "export what you see", the entire change is passing the current filters in `services/inventory.service.ts`'s `exportStockCsv`. Out of scope here — flag it in the report. |
| **D-c** | The brief's helper text says *"the average price is …"* but D10 calls the quantity-weighted figure `avgStockPrice` (and reserves "avg price" for the unweighted supplier-invoice figure). | The **value** is `avgStockPrice` — D10 states margins, **adjustment defaults** and stock valuation read it. The **wording** follows the brief ("The average price is …") because in the adjustment context there is only one average on screen. Do **not** show `avgPrice` here. |
| **D-d** | "Total product cost" = ? | `StockRowDto.stockValue` (on-hand × `avgStockPrice`) — F2. No new figure is invented, so no existing number changes meaning. |

---

## 1. Actions

Execute in order. Actions 1→4 are the vertical slice for both searches; 5 is all text; 6→10 are the
UI; 11 is verify-only; 12 is the sweep and gate.

---

### Action 1 — Contract: add `search` to the two inventory query schemas

**File:** `Apps/contract/src/modules/inventory/inventory.query.ts`

**1a.** `StockQuerySchema` — add `search`:

```ts
// `search` matches product name (case-insensitive substring) or barcode (prefix) — resolved
// backend-side in InventoryReadService.getStock so the Product.barcode unique index applies
// (S1 finding F1). Applied before the CSV branch: an export sent with `search` exports the
// filtered set.
export const StockQuerySchema = z.object({
  lowStockOnly: BooleanQuerySchema.optional(),
  search: z.string().optional(),
  export: z.literal('csv').optional(),
});
```

**1b.** `MovementsQuerySchema` — add `search` after `staffId`:

```ts
  search: z.string().optional(),
```

with a one-line comment: *"Free-text product search (name substring / barcode prefix) — filters the
movement's product relation, not the movement itself."*

**1c.** Update the file's two existing comments that this falsifies:
- the header comment above `StockQuerySchema` (*"Only 'csv' is documented … no other format is
  named"*) is about `export`, not about the object as a whole — **leave it**, but move it so it sits
  immediately above the `export:` line rather than above the schema, or it now reads as a claim about
  `search`.
- the comment above `MovementsQuerySchema` needs no change (it documents the schema's existing
  filters).

`search` is optional and additive, so **no existing caller breaks** — including
`useProductSalesHistory` (`Apps/web/src/hooks/useProductHistory.ts:49`), which passes
`{ productId, page, limit }`.

No barrel edit: `inventory/index.ts` re-exports with `export *`.

---

### Action 2 — Backend: apply both search predicates

**File:** `Apps/api/src/modules/inventory/inventory.service.ts` (class `InventoryReadService`)

**2a. `getStock` (line 398).** Replace the unconditional `findMany` with a `where`-filtered one:

```ts
  async getStock(query: StockQuery): Promise<StockRowDto[] | ExportResult> {
    // Name is a case-insensitive substring match; barcode is a prefix match so it can use the
    // `Product.barcode @unique` btree index (S1 finding F1 — a `contains` predicate could not).
    // A scanner emits a whole barcode, so `startsWith` also covers the exact-scan case.
    const where: Prisma.ProductWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { barcode: { startsWith: query.search } },
          ],
        }
      : {};
    const products = await this.prisma.product.findMany({ where, orderBy: { name: 'asc' } });
```

The rest of the method (`rows`, `lowStockOnly` filter, CSV branch) is unchanged. `Prisma` is already
imported as a type on line 1 — no new import.

**2b. `listMovements` (line 427).** Add one spread to the existing `where` literal, after the
`staffId` spread and before the `createdAt` spread:

```ts
      // Product search — same name/barcode predicate as getStock, applied through the movement's
      // product relation (StockMovement itself carries no product name or barcode).
      ...(query.search
        ? {
            product: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' as const } },
                { barcode: { startsWith: query.search } },
              ],
            },
          }
        : {}),
```

Both the `count` and the `findMany` already read this same `where` object, so the pagination meta
stays correct with no further change.

**Do not touch** `listReservations` (the brief does not ask for search there), `createAdjustment`, or
`resolveReferenceLabels`.

No controller and no route change: `req.validated.query` is already cast to the contract type and the
route already validates with `StockQuerySchema` / `MovementsQuerySchema`.

---

### Action 3 — Web service: `getStock` takes a query object

**File:** `Apps/web/src/services/inventory.service.ts`

Replace the `getStock` signature (line 22) — `lowStockOnly` alone can no longer carry the filters:

```ts
// Split from the dual-return backend method (StockRowDto[] | export-Blob) into two functions —
// a query hook can only have one result type, and `export=csv` is a distinct caller intent.
// The query is the contract's StockQuery minus `export` (which belongs to exportStockCsv below).
export async function getStock(query: Omit<StockQuery, "export"> = {}): Promise<StockRowDto[]> {
  const res = await api.get<ApiResponse<StockRowDto[]>>(apiPath(INVENTORY_ROUTES.STOCK), {
    params: { lowStockOnly: query.lowStockOnly, search: query.search },
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
```

Add `type StockQuery` to the existing `@dragon-telecom/contract` import block.

`exportStockCsv` (line 33) is **unchanged** — decision D-b. Add one line to its comment: *"Sends no
filters: the export is always the full stock list (S4 decision D-b)."*

`listMovements` needs **no change** — it already forwards the whole `MovementsQuery` as params.

---

### Action 4 — Hook: `useStock` takes the same query object

**File:** `Apps/web/src/hooks/useInventory.ts`

```ts
export function useStock(query: Omit<StockQuery, "export"> = {}) {
  return useQuery({
    queryKey: qk.inventory.stock(query),
    queryFn: () => inventoryService.getStock(query),
  });
}
```

Add `StockQuery` to the type-only contract import.

**Query keys:** `qk.inventory.stock(query)` and `qk.inventory.movements.list(query)` both already
take an opaque query object and hash it deterministically — **`Apps/web/src/lib/query-keys.ts` needs
no edit.** The new `search` field simply becomes part of each key, so every distinct search caches
separately and `useCreateAdjustment`'s `invalidateQueries({ queryKey: qk.inventory.all() })` still
sweeps all of them.

`useCreateAdjustment`, `useMovements`, `useReservations`, `useExportStockCsv` are unchanged.

---

### Action 5 — Translation keys

**File:** `Apps/web/src/config/translations.json` (flat dotted keys, `{ en, fr, ar }`, `ar` always
`""`). Insert each next to its sibling keys in the existing `admin.inventory.*` block.

| Key | en | fr |
|---|---|---|
| `admin.inventory.stock.filters.search` | `Search by name or barcode` | `Rechercher par nom ou code-barres` |
| `admin.inventory.stock.table.reservedQuantity` | `Reserved qty` | `Qté réservée` |
| `admin.inventory.stock.table.availableQuantity` | `Available` | `Disponible` |
| `admin.inventory.stock.table.avgStockPrice` | `Avg. stock price` | `Prix de stock moyen` |
| `admin.inventory.stock.table.totalCost` | `Total cost` | `Coût total` |
| `admin.inventory.movements.filters.search` | `Search by name or barcode` | `Rechercher par nom ou code-barres` |
| `admin.inventory.adjustment.avgStockPriceHint` | `The average price is {price}` | `Le prix moyen est {price}` |
| `admin.inventory.adjustment.avgStockPriceUnknown` | `No average price yet — enter the unit cost` | `Aucun prix moyen — saisissez le coût unitaire` |

Notes for the executor:

- `admin.inventory.stock.table.avgStockPrice` deliberately matches the wording S3 gave
  `admin.productsList.table.avgCost` ("Avg. stock price" / "Prix de stock moyen") — same figure, same
  label, two screens.
- `{price}` is interpolated by `t(key, params)`, the same mechanism as the existing
  `admin.inventory.adjustment.success` → `{reference}`.
- **Delete nothing.** The three keys the stock table stops borrowing
  (`admin.inventory.reservations.table.quantity`, `common.units.inStock`,
  `admin.inventory.adjustment.unitCost`) all remain in use by their own screens — and
  `common.units.inStock` is still used by the stock table's *mobile* row as a unit suffix.

---

### Action 6 — Stock levels table: search box + the four column labels + total cost

**File:** `Apps/web/src/pages/admin/inventory/components/stock-levels-table.tsx`

**6a. New props** (the component stays dumb; the page owns the debounce):

```ts
interface StockLevelsTableProps {
  data: StockRowDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  lowStockOnly: boolean;
  onLowStockOnlyChange: (value: boolean) => void;
  onExportCsv?: () => void;
}
```

**6b. Search input** — first element of the existing toolbar row (the `flex items-center
justify-between` div, line 77), left of the low-stock switch, copying
`admin-products-filters.tsx`'s markup verbatim:

```tsx
<div className="relative w-full max-w-xs sm:w-64">
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input
    value={search}
    onChange={(e) => onSearchChange(e.target.value)}
    placeholder={t("admin.inventory.stock.filters.search")}
    className="pl-9"
  />
</div>
```

Wrap the search box + the switch in a single `flex flex-wrap items-center gap-3` div so the layout
survives on mobile, keeping the export button on the right. New imports: `Search` from `lucide-react`
(added to the existing `Package, Download` import) and `Input` from `@/components/ui/input`.

**6c. Columns** — the definitive list, replacing lines 39–61:

| # | `accessorKey` / `id` | Header key | Cell |
|---|---|---|---|
| 1 | `name` | `admin.inventory.stock.table.product` | unchanged (destructive tint when `isLow`) |
| 2 | `quantityOnHand` | `admin.inventory.stock.table.quantity` | default |
| 3 | `quantityReserved` | **`admin.inventory.stock.table.reservedQuantity`** | default |
| 4 | `availableQuantity` | **`admin.inventory.stock.table.availableQuantity`** | default |
| 5 | `avgStockPrice` | **`admin.inventory.stock.table.avgStockPrice`** | `formatDZD(row.original.avgStockPrice, language)` |
| 6 | `stockValue` | **`admin.inventory.stock.table.totalCost`** | `formatDZD(row.original.stockValue, language)` |
| 7 | `isLow` | `admin.inventory.stock.table.lowStock` | unchanged |

`language` comes from `useTranslation()` (destructure `{ t, language }`); add it to the `useMemo`
dependency array alongside `t`. Import `formatDZD` from `@/lib/utils`.

**6d. Mobile row** — add the total cost as a third line so the new column isn't desktop-only:

```tsx
<div className="text-sm text-muted-foreground">
  {t("admin.inventory.stock.table.totalCost")}: {formatDZD(row.stockValue, language)}
</div>
```

Leave the existing `{row.quantityOnHand} / {row.availableQuantity} {t("common.units.inStock")}` line
as it is — there `inStock` is a unit suffix, which is what the key means.

**6e.** `TableSkeleton rows={6} columns={6}` (line 95) → `columns={7}`.

**6f.** Update the component's header comment (lines 24–25) — it lists the DTO fields the table
renders and must now name `stockValue` and say that search is server-side:

```
// ADM-06 Stock levels tab — StockRowDto (inventory.dtos.ts): productId/name/quantityOnHand/
// quantityReserved/availableQuantity/avgStockPrice/stockValue/reorderThreshold/isLow. Search is
// server-side (StockQuery.search, S4) — this component only renders the controlled input; the page
// owns the debounce. `stockValue` is on-hand × avgStockPrice (D10) and is what the "Total cost"
// column shows.
```

---

### Action 7 — Movement ledger filters: search input

**File:** `Apps/web/src/pages/admin/inventory/components/inventory-filters.tsx`

**7a.** Add two props — **do not add `search` to `MovementFiltersValue`**. That interface is the
object the page spreads straight into the query on every change; putting a keystroke-frequency field
inside it would refetch on every character. Search is debounced separately by the page:

```ts
interface InventoryFiltersProps {
  value: MovementFiltersValue;
  onChange: (value: MovementFiltersValue) => void;
  search: string;
  onSearchChange: (value: string) => void;
  disabled?: boolean;
}
```

**7b.** Render the same search-input markup as Action 6b (with placeholder
`admin.inventory.movements.filters.search`) as the **first** child of the existing
`flex flex-wrap items-center gap-3` row, before the type `Select`. Same new imports (`Search`,
`Input` — `Input` is already imported in this file).

**7c.** Replace the stale header comment (lines 24–27), which claims the product filter has "no
obvious UI source list here yet":

```
// ADM-06 Movement ledger tab filters — MovementsQuery (inventory.query.ts): `search`/`type`/
// `from`/`to`. `search` matches the movement's product by name or barcode (S4) and is *not* part
// of MovementFiltersValue: the page debounces it separately, since MovementFiltersValue is applied
// to the query immediately on every change. The `staffId` filter still has no UI (no staff picker
// on this page); `productId` is now covered by the free-text search.
```

---

### Action 8 — `AdminInventory.tsx`: wire both searches and the avg-price map

**File:** `Apps/web/src/pages/admin/inventory/AdminInventory.tsx`

**8a. Stock search state** (after the `lowStockOnly` state, line 34):

```ts
const [stockSearch, setStockSearch] = useState("");
const debouncedStockSearch = useDebouncedValue(stockSearch, 300);
const stockQuery = useMemo(
  () => ({ lowStockOnly, search: debouncedStockSearch.trim() || undefined }),
  [lowStockOnly, debouncedStockSearch],
);
const stock = useStock(stockQuery);
```

(replacing `const stock = useStock(lowStockOnly);` on line 39.)

**8b. Movement search state** — the page resets to page 1 in the change handler rather than in an
effect (F8):

```ts
const [movementSearch, setMovementSearch] = useState("");
const debouncedMovementSearch = useDebouncedValue(movementSearch, 300);

const handleMovementSearchChange = (value: string) => {
  setMovementSearch(value);
  setMovementsPage(1);
};

const movementsQuery = useMemo(
  () => ({
    ...movementFilters,
    search: debouncedMovementSearch.trim() || undefined,
    page: movementsPage,
    limit: 20,
  }),
  [movementFilters, debouncedMovementSearch, movementsPage],
);
```

Import `useDebouncedValue` from `@/hooks/useDebouncedValue`.

**8c. Average-price map**, beside the existing `systemQuantityByProductId` (line 61):

```ts
// D10 — the adjustment default and every margin read avgStockPrice (the quantity-weighted
// figure), never avgPrice (which is supplier-invoice context only).
const avgStockPriceByProductId = useMemo(
  () => Object.fromEntries((products.data?.items ?? []).map((p) => [p.id, p.avgStockPrice])),
  [products.data],
);
```

**8d. Pass the new props:**

```tsx
<StockLevelsTable
  … 
  search={stockSearch}
  onSearchChange={setStockSearch}
  lowStockOnly={lowStockOnly}
  …
/>

<InventoryFilters
  value={movementFilters}
  onChange={handleMovementFiltersChange}
  search={movementSearch}
  onSearchChange={handleMovementSearchChange}
/>

<AdjustmentForm
  productOptions={productOptions}
  systemQuantityByProductId={systemQuantityByProductId}
  avgStockPriceByProductId={avgStockPriceByProductId}
  onSubmit={handleAdjustmentSubmit}
  isSubmitting={createAdjustment.isPending}
/>
```

**8e.** Update the file's header comment (lines 28–31) — it explains where the picker's two maps come
from and must now cover the third:

```
// ADM-06 — Sprint 5 wiring. The product picker, the adjustment form's system-quantity map and its
// avgStockPrice map (S4, D10) all come from `useAdminCatalogProducts` (AdminProductDto carries
// `quantityOnHand` and `avgStockPrice`) rather than a second `useStock()` call — one fewer query,
// and it's the same "current on-hand" figure the Stock tab itself renders. Known limitation: that
// query is capped at `limit: 100`, so only the first 100 products are pickable/adjustable here.
```

---

### Action 9 — Adjustment line editor: default the unit cost and show the hint

**File:** `Apps/web/src/pages/admin/inventory/components/adjustment-line-editor.tsx`

**9a. New props:**

```ts
interface AdjustmentLineEditorProps {
  index: number;
  control: Control<AdjustmentFormValues>;
  setValue: UseFormSetValue<AdjustmentFormValues>;
  productOptions: AutocompleteOption[];
  systemQuantityByProductId: Record<string, number>;
  avgStockPrice: number;
  countedQuantity: number;
  productId: string;
  onRemove: () => void;
  unitCostError?: string;
}
```

Imports to add: `useEffect`, `useRef` from `react`; `type UseFormSetValue` from `react-hook-form`;
`formatDZD` from `@/lib/utils`; and `language` from the existing `useTranslation()` destructure.

**9b. The default rule.** Add above the JSX, after the `isIncrease` computation:

```ts
// D10/S4 — a positive delta creates an IN layer, whose unit cost defaults to the product's
// quantity-weighted average (`avgStockPrice`). Applied once per selected product: re-applied when
// the user picks a different product (a new product means a new average), never overwriting a
// value the user has since typed for the *same* product. A product with no average yet
// (avgStockPrice <= 0) is left blank on purpose, so the schema's "unit cost is required when the
// count raises stock" refine forces a real figure instead of silently creating a zero-cost layer.
const defaultedForProductId = useRef<string | null>(null);
useEffect(() => {
  if (!isIncrease || !productId) return;
  if (defaultedForProductId.current === productId) return;
  defaultedForProductId.current = productId;
  setValue(`lines.${index}.unitCost`, avgStockPrice > 0 ? avgStockPrice : undefined, {
    shouldDirty: false,
  });
}, [isIncrease, productId, avgStockPrice, index, setValue]);
```

**9c. Fix the blank-input handler (F4)** — inside the `unitCost` `Controller`, replace
`onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}` with:

```tsx
onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
```

(the codebase's `optionalNumber` shape — report-S03 F1: *"never register an optional numeric field
with `valueAsNumber: true` in this codebase"*, same class of bug, same fix).

**9d. Helper text** — directly beneath the unit-cost `Input`, above the error paragraph:

```tsx
<p className="mt-1 text-xs text-muted-foreground">
  {avgStockPrice > 0
    ? t("admin.inventory.adjustment.avgStockPriceHint", {
        price: formatDZD(avgStockPrice, language),
      })
    : t("admin.inventory.adjustment.avgStockPriceUnknown")}
</p>
```

**9e.** Update the component's header comment (lines 21–23):

```
// ADM-06 adjustment form — one line row. Shows the counted-vs-system delta chip and reveals
// `unitCost` only when the count raises stock (an IN-delta), matching `adjustment.schema.ts`'s own
// `superRefine` rule. On an IN-delta the unit cost is pre-filled with the product's avgStockPrice
// (D10, S4) — the same value the backend's createAdjustment would default to — with the average
// shown as helper text beneath the input.
```

---

### Action 10 — Adjustment form: thread `setValue` and the per-line average

**File:** `Apps/web/src/pages/admin/inventory/components/adjustment-form.tsx`

**10a.** Add `avgStockPriceByProductId: Record<string, number>` to `AdjustmentFormProps`, beside
`systemQuantityByProductId`.

**10b.** Destructure `setValue` from `useForm` (line 39–44).

**10c.** Pass both down in the `fields.map` render (line 94):

```tsx
<AdjustmentLineEditor
  key={field.id}
  index={index}
  control={control}
  setValue={setValue}
  productOptions={productOptions}
  systemQuantityByProductId={systemQuantityByProductId}
  avgStockPrice={avgStockPriceByProductId[watchedLines?.[index]?.productId ?? ""] ?? 0}
  countedQuantity={watchedLines?.[index]?.countedQuantity ?? 0}
  productId={watchedLines?.[index]?.productId ?? ""}
  onRemove={() => remove(index)}
  unitCostError={errors.lines?.[index]?.unitCost?.message}
/>
```

`adjustment.schema.ts` is **unchanged** — its `superRefine` still requires a unit cost on an
increase, which is exactly the guard that must survive when `avgStockPrice` is 0. Add one sentence to
its header comment noting that the UI now pre-fills this field from `avgStockPrice` whenever the
product has one, so the refine fires only for never-stocked products or a deliberately cleared field.

---

### Action 11 — RC-1 on the adjustment product picker: **verify only**

No code change is expected. S2 rebuilt `AutocompleteInput` so `value` is the entity id while the
input displays the option's `label`, and gave this exact call site its `inputId`
(`adjustment-line-${index}-product`, report-S02 Action 2). `AdminInventory.tsx` builds
`productOptions` as `{ value: p.id, label: p.name }` — the shape the new contract requires.

**Do:** open `/admin/inventory` → Adjustments, select a product, confirm the input shows the name;
select a second product on the same line and on a second line, confirm both show names.

**If — and only if — an id still appears**, report it as a regression against S2 rather than patching
it locally in this file: the bug would be in the shared component and every other consumer would have
it too.

---

### Action 12 — Sweep, stale-test list, validation gate

**12a. Greps to run and report:**

```
grep -rn "useStock(" Apps/web/src                       # only AdminInventory.tsx — the signature changed
grep -rn "getStock(" Apps/web/src Apps/api/src          # web: hook only; api: controller only
grep -rn "admin.inventory.reservations.table.quantity" Apps/web/src   # must no longer appear in stock-levels-table.tsx
grep -rn "admin.inventory.adjustment.unitCost" Apps/web/src           # must remain (adjustment form) but be gone from the stock table
grep -rn "valueAsNumber" Apps/web/src/pages/admin/inventory           # must be empty
```

**12b. Stale test files — list them in the report, do not edit or run them.** Known from this
session's reading (re-verify the list, it may be longer):

| File | What this set makes stale |
|---|---|
| `Apps/web/tests/integration/services/inventory.service.test.ts` | `inventoryService.getStock()` — still compiles (the param defaults to `{}`), but the "unwrapped array" assertion no longer covers the params it now sends. |
| `Apps/web/tests/integration/hooks/inventory.test.tsx` | `useStock()` ×2 — same: compiles via the default, but the hook's key shape changed from `{ lowStockOnly }` to the full query object. |
| `Apps/web/tests/unit/pages/inventory/inventory-primitives.test.tsx` | Renders `<StockLevelsTable>` without the now-required `search` / `onSearchChange` props → **type error**. |
| `Apps/web/tests/unit/pages/inventory/inventory-wiring.test.tsx` | Mocks `useStock`; renders the page, whose column headers and adjustment-form props changed. |
| `Apps/web/tests/unit/pages/inventory/adjustment.schema.test.ts` | Schema unchanged — expected to still pass; confirm by reading, not by running. |
| `Apps/api/test/unit/modules/inventory/inventory.service.spec.ts` | `getStock({})` / `{ lowStockOnly }` / `{ export: 'csv' }` — the mocked `product.findMany` now receives a `where` argument. |
| `Apps/web/tests/fixtures/data/inventory.mock.ts` | Already stale since S1 (`averageCost` field) — unchanged by this set, re-noted only. |

**12c. Validation gate** — all three must be green, each judged against the package's pre-existing
baseline (use `git stash` to compare if an error appears on a file you touched):

```
Apps/contract: npx tsc --noEmit      &&  npm run lint
Apps/api:      npx tsc --noEmit      &&  npm run lint     # test/** errors from S1 are pre-existing
Apps/web:      npx tsc --noEmit      &&  npm run lint
```

**No test suite is run. No test file is edited.**

**12d.** Write `Docs/Stage-04-Fixes/results/report-S04.md` following `report-S03.md`'s shape: what
changed per package, findings, the stale-test list, the gate output, and the checklist below.

---

## 2. Ripple summary

| Layer | File | Change |
|---|---|---|
| contract | `modules/inventory/inventory.query.ts` | `StockQuerySchema.search`, `MovementsQuerySchema.search` |
| prisma | — | **none** (no schema change, no migration) |
| mapper | — | **none** |
| api service | `modules/inventory/inventory.service.ts` | `getStock` `where`; `listMovements` `where.product` |
| api controller/routes | — | **none** (validation already contract-driven) |
| web service | `services/inventory.service.ts` | `getStock(query)` |
| web hook | `hooks/useInventory.ts` | `useStock(query)` |
| query keys | `lib/query-keys.ts` | **none** — both keys already hash an opaque query object |
| web components | `stock-levels-table.tsx`, `inventory-filters.tsx`, `adjustment-form.tsx`, `adjustment-line-editor.tsx`, `AdminInventory.tsx` | Actions 6–10 |
| translations | `config/translations.json` | 8 new keys, 0 deleted |

**Staff parity:** there is no staff inventory page — `StockLevelsTable`, `MovementLedgerTable`,
`InventoryFilters` and `AdjustmentForm` have exactly one consumer each (`AdminInventory.tsx`),
verified by grep. **S18** owns adding one if the owner wants it; nothing in this set needs mirroring.

---

## 3. Known limitations to record in the report

1. **The adjustment picker is capped at 100 products** (`useAdminCatalogProducts({ page: 1, limit:
   100 })`, pre-existing). A product outside the first 100 cannot be picked, and its
   `systemQuantity`/`avgStockPrice` maps would be empty. The fix is to feed the autocomplete's
   `onSearch` into a server-side product query — deliberately **not** done here (it is not in the
   brief and would change the picker's data flow). Flag it; the owner decides which set takes it.
2. **Export CSV ignores both the search and the low-stock switch** (decision D-b) — pre-existing for
   `lowStockOnly`, now also true for `search`. One-line change in `exportStockCsv` if the owner wants
   "export what you see".
3. **`ReservationsQuery` still has no search.** The brief asks for search on stock levels and the
   movement ledger only; the reservations tab is unchanged.
4. **`MovementsQuery.staffId` still has no UI control** — pre-existing, unchanged.

---

## 4. Manual verification checklist

The owner performs these in the browser. No automated test runs. Check colour-sensitive items in
**both light and dark mode**.

**Stock levels — search**
1. `/admin/inventory` → **Stock levels**. A search box sits left of the "Low stock only" switch,
   placeholder *"Search by name or barcode"*.
2. Type part of a **product name** → the table narrows to matching rows, and it does **not** refetch
   on every keystroke (a ~300 ms pause after you stop typing).
3. Clear it and type a **full barcode** → that product alone.
4. Type only the **first few characters** of a barcode → still matches (prefix search).
5. Type a string that matches nothing → the empty state ("No stock rows found"), not an error.
6. Turn **Low stock only** on *while* a search is active → both filters apply together.
7. Clear the search → the full list returns.

**Stock levels — columns**
8. The columns read: Product · Quantity · **Reserved qty** · **Available** · **Avg. stock price** ·
   **Total cost** · Low stock. No two quantity columns share a header any more.
9. **Total cost** equals *Quantity × Avg. stock price* for a row you check by hand, and both money
   columns render as `1 234 DZD` (formatted), not a bare number.
10. Switch the language to **French** and confirm the headers translate ("Qté réservée",
    "Disponible", "Prix de stock moyen", "Coût total") and nothing wraps or overflows.
11. Narrow the window to mobile width: each card shows the product, the on-hand/available line, and
    a **Total cost** line.
12. **Export CSV** still downloads the full stock list (it deliberately ignores the search and the
    switch — decision D-b).

**Movement ledger — search**
13. `/admin/inventory` → **Movement ledger**. A search box sits before the type dropdown, same
    placeholder.
14. Search a **product name** → only that product's movements. Search a **barcode prefix** → the same
    rows.
15. Go to **page 2** of the ledger, then type in the search box → the list jumps back to **page 1**
    and the pagination footer's total page count reflects the filtered set.
16. Combine the search with the **type** dropdown and the **from/to** dates → all four filters apply
    together.
17. Every row's **Reference** cell still shows a human reference (`SAL-…`, `ORD-…`, `AJU-…`) — S1's
    RC-4 fix must be untouched.

**Adjustments — the product picker (RC-1, verify only)**
18. `/admin/inventory` → **Adjustments**. Pick a product: the input shows its **name**, not an id.
    Pick a different product on the same line, and add a second line and pick there too — both show
    names.

**Adjustments — the unit-cost default**
19. Pick a product **that has stock** and enter a counted quantity **above** the system quantity. The
    unit-cost field appears **pre-filled with the product's average stock price**, and the helper
    text beneath reads *"The average price is 1 234 DZD"* with the same figure.
20. Cross-check that figure against `/admin/products/:id` → the **Avg. stock price** stat (S3). They
    must be identical — and it must **not** be the *Avg. purchase price* stat beside it (D10).
21. Type your own unit cost over the default, then change the **counted quantity** again → your value
    survives (it is not overwritten on every keystroke).
22. Now change the **product** on that line → the unit cost re-defaults to the **new** product's
    average, and the helper text follows.
23. Pick a product that has **never had stock** (avg = 0): the unit-cost field stays **empty** and the
    helper text reads *"No average price yet — enter the unit cost"*. Submitting without typing a
    cost shows the "Unit cost is required…" validation message instead of silently posting.
24. **Clear** a pre-filled unit cost and submit → same validation message. It must **not** post a
    zero-cost adjustment.
25. Submit a valid positive adjustment leaving the default untouched → success toast with the `AJU-…`
    reference. Reopen `/admin/products/:id`: the **Avg. stock price** is **unchanged** (adding stock
    at exactly the current average cannot move it) and the on-hand quantity rose by the delta.
26. `/admin/inventory` → **Movement ledger**: the new `ADJUSTMENT_IN` row shows that unit cost, and
    the **Stock levels** tab's **Total cost** for that product rose accordingly.
27. Post a **negative** adjustment (counted below system): no unit-cost field, no helper text, and it
    posts as before.

---

The owner reviews and approves before S5 begins.
