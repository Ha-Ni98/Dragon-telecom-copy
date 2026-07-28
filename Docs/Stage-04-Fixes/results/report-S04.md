# Report — Set 4 (Inventory)

Executed against `Docs/Stage-04-Fixes/plans/plan-S04-inventory.md`, all 12 actions, 2026-07-26.
Both validation gates green (tsc + lint, contract/api/web). No test file was edited. No test
suite was run.

---

## What changed

### Contract (`Apps/contract`)

- `inventory.query.ts`: `StockQuerySchema` gains `search: z.string().optional()` (with a comment
  explaining it's resolved backend-side against the `Product.barcode` unique index — S1 finding
  F1); `MovementsQuerySchema` gains the same `search` field. Both additive/optional — no existing
  caller (including `useProductSalesHistory`'s `{ productId, page, limit }`) breaks. No barrel
  edit needed (`inventory/index.ts` re-exports with `export *`).

### Backend (`Apps/api`)

- `inventory.service.ts` `InventoryReadService.getStock`: now builds a `Prisma.ProductWhereInput`
  from `query.search` — `{ OR: [{ name: contains, insensitive }, { barcode: startsWith }] }` —
  before the `findMany`. `barcode: startsWith` (not `contains`) so the unique index is used, per
  S1's recorded instruction.
- `inventory.service.ts` `listMovements`: added the same `search` predicate as one more spread in
  the existing `where` object, applied through the `product` relation (`StockMovement` itself
  carries no name/barcode). Both `count` and `findMany` read the same `where`, so pagination meta
  stays correct.
- No controller, route, or DTO/mapper change — validation was already contract-driven and neither
  `StockRowDto` nor `MovementDto` changed shape.

### Frontend (`Apps/web`)

- `services/inventory.service.ts`: `getStock` now takes `Omit<StockQuery, "export">` instead of a
  bare `lowStockOnly` boolean, forwarding `search` as a query param. `exportStockCsv` unchanged
  (decision D-b — the export still ignores all filters), with a comment recording that choice.
- `hooks/useInventory.ts`: `useStock` takes the same query object; its query key is the object
  itself (no `query-keys.ts` edit needed — both `qk.inventory.stock` and
  `qk.inventory.movements.list` already hash an opaque query object).
- **Stock levels table** (`stock-levels-table.tsx`):
  - New search input (same markup as `admin-products-filters.tsx`'s), placed left of the
    low-stock switch.
  - Columns: `quantityReserved` now labelled "Reserved qty" (own key, was borrowing the
    reservations table's "Quantity"); `availableQuantity` now "Available" (was the unit suffix
    `common.units.inStock`); `avgStockPrice` now "Avg. stock price", rendered via `formatDZD`
    (was "Unit cost", borrowed from the adjustment form, and a bare `toLocaleString()`); new
    `stockValue` column, "Total cost", also via `formatDZD` — no new figure, this is the DTO's
    existing `stockValue` (on-hand × avgStockPrice) simply rendered for the first time.
  - Mobile row gained a third line showing the total cost.
  - `TableSkeleton columns` 6→7.
- **Movement ledger filters** (`inventory-filters.tsx`): new search input as the first filter,
  wired independently of `MovementFiltersValue` (kept out of that object on purpose — it's
  applied to the query on every keystroke, and search needs to be debounced separately by the
  page).
- **`AdminInventory.tsx`**: added `stockSearch`/`movementSearch` local state, each debounced 300ms
  via the existing `useDebouncedValue` hook; `stockQuery`/`movementsQuery` memos now include
  `search`; the movement search's change handler resets `movementsPage` to 1 (the stock tab has
  no pagination, so no reset is needed there). Added `avgStockPriceByProductId`, a third
  `Object.fromEntries` map beside the existing `productOptions`/`systemQuantityByProductId`, built
  from the same already-loaded `useAdminCatalogProducts` query — no new query, no new endpoint.
- **Adjustment line editor** (`adjustment-line-editor.tsx`):
  - New `avgStockPrice` and `setValue` props.
  - On an increasing delta, a `useEffect` (guarded by a `useRef` keyed on the selected
    `productId`) pre-fills `unitCost` with the product's `avgStockPrice` the first time that
    product is selected on this line, and re-fires if the product changes — never overwriting a
    value the user has since typed for the *same* product. A product with `avgStockPrice <= 0`
    (never stocked) is left blank, so the schema's required-on-increase check still fires.
  - Helper text beneath the input: *"The average price is {formatDZD(avgStockPrice)}"*, or *"No
    average price yet — enter the unit cost"* when there is none.
  - Fixed the unit-cost `onChange` to map a blank input to `undefined` (was
    `parseFloat(...) || 0`) — this was a latent bug (F4 in the plan): once the field carries a
    pre-filled value, clearing it would otherwise have silently submitted a **zero-cost**
    adjustment instead of tripping the "unit cost is required" validation.
- **Adjustment form** (`adjustment-form.tsx`): threads the new `avgStockPriceByProductId` prop and
  `setValue` (destructured from `useForm`) down to each line editor.
- **Adjustment schema** (`adjustment.schema.ts`): comment-only update noting the new pre-fill
  behavior and that the `superRefine` still guards the never-stocked/cleared-field cases. No
  logic change.
- **RC-1 on the adjustment product picker** — verified, not touched. S2's rebuilt
  `AutocompleteInput` (id-valued `value`, name-displaying input) and its per-row `inputId` were
  already in place for this exact call site; `AdminInventory.tsx` already builds
  `productOptions` as `{ value: p.id, label: p.name }`. No regression found — see the manual
  checklist item 18 for the owner's confirmation step.

### Translations (`Apps/web/src/config/translations.json`)

8 new keys added, 0 deleted, 0 reworded:

`admin.inventory.stock.table.reservedQuantity`, `.availableQuantity`, `.avgStockPrice`,
`.totalCost`, `admin.inventory.stock.filters.search`, `admin.inventory.movements.filters.search`,
`admin.inventory.adjustment.avgStockPriceHint`, `admin.inventory.adjustment.avgStockPriceUnknown`.

Verified via a direct `require()` of the file (2713 → 2721 keys) that it stayed valid JSON. The
three keys the stock table stopped borrowing
(`admin.inventory.reservations.table.quantity`, `common.units.inStock`,
`admin.inventory.adjustment.unitCost`) remain in use by their own screens — confirmed by grep
(reservations table still uses its own key; the stock table's *mobile* row still uses
`common.units.inStock` as a unit suffix; the adjustment form's own input placeholder still uses
`admin.inventory.adjustment.unitCost`).

---

## Findings recorded during execution

No deviations from the plan were required. Two things worth flagging that the plan already
anticipated and that held up on inspection:

- **F2 (plan) confirmed**: `StockRowDto.stockValue` was already `quantityOnHand × avgStockPrice`
  and already in the CSV export headers — the "Total cost" column needed zero backend/contract/
  mapper change, exactly as predicted. No money or stock figure changed meaning.
- **F5 (plan) confirmed**: `avgStockPriceByProductId` needed no new query — `AdminProductDto`
  already carries `avgStockPrice` (from S1) and `AdminInventory.tsx` already loads the full
  admin-products list for the other two maps.

---

## Sweep results (plan Action 12a)

```
grep -rn "useStock(" Apps/web/src
  → AdminInventory.tsx:49 (the one call site) + useInventory.ts:11 (the definition)

grep -rn "getStock(" Apps/web/src Apps/api/src
  → web: useInventory.ts (hook) + inventory.service.ts (web service definition)
  → api: inventory.service.ts (definition) + inventory.controller.ts (call site) +
    inventory.interface.ts (interface decl)

grep -rn "admin.inventory.reservations.table.quantity" Apps/web/src
  → only reservations-table.tsx + its own translations.json entry — no longer used by the stock
    table

grep -rn "admin.inventory.adjustment.unitCost" Apps/web/src
  → adjustment-line-editor.tsx (input placeholder), adjustment.schema.ts (unrelated —
    unitCostRequiredForIncrease key substring match), translations.json (both keys) — no longer
    used by the stock table

grep -rn "valueAsNumber" Apps/web/src/pages/admin/inventory
  → empty (this module never used the valueAsNumber trap; F4's fix was to the existing
    parseFloat(...) || 0 pattern, a different manifestation of the same "blank numeric input"
    class of bug)
```

All five match the plan's expected outcome exactly.

---

## Stale test files (plan Action 12b) — not edited, not run

| File | What this set makes stale |
|---|---|
| `Apps/web/tests/integration/services/inventory.service.test.ts` | `inventoryService.getStock()` still compiles (param defaults to `{}`), but no longer covers what params are actually sent. |
| `Apps/web/tests/integration/hooks/inventory.test.tsx` | `useStock()` ×2 still compiles via the default; the hook's query-key shape changed from `{ lowStockOnly }` to the full query object. |
| `Apps/web/tests/unit/pages/inventory/inventory-primitives.test.tsx` | Renders `<StockLevelsTable>` without the now-required `search`/`onSearchChange` props. **Confirmed by running `tsc --noEmit -p tsconfig.test.json`**: this file fails with `TS2739: ... missing the following properties from type 'StockLevelsTableProps': search, onSearchChange` at both render call sites (lines 13, 20) — exactly as the plan predicted. |
| `Apps/web/tests/unit/pages/inventory/inventory-wiring.test.tsx` | Mocks `useStock`; renders the page, whose column headers and `AdjustmentForm` props changed. |
| `Apps/web/tests/unit/pages/inventory/adjustment.schema.test.ts` | Schema logic unchanged (comment-only edit) — read, not run; expected to still pass whenever the suite is next run. |
| `Apps/api/test/unit/modules/inventory/inventory.service.spec.ts` | `getStock({})` / `{ lowStockOnly }` / `{ export: 'csv' }` — the mocked `product.findMany` now receives a `where` argument it didn't before. |
| `Apps/web/tests/fixtures/data/inventory.mock.ts` | Already stale since S1 (`averageCost` field) — unchanged by this set, re-noted only. |

---

## Validation gate — all green

```
Apps/contract: npx tsc --noEmit ✓ (0 errors)     npm run lint ✓ (0 problems)

Apps/api:      npx tsc --noEmit — src/** clean (0 errors originating outside test/**, confirmed
               by filtering error-header lines to non-test/ paths). All remaining errors are the
               pre-existing test/** stale-symbol fallout from S1 (SaleOrigin, averageCost,
               saleId, etc. — untouched by this set).
               npm run lint — 6 pre-existing errors, all in prisma/seed.ts (3) and
               validate-request.middleware.ts (3), both files untouched this session (same list
               reported by S1).

Apps/web:      npx tsc --noEmit (tsconfig.json, src only) ✓ (0 errors)
               npx tsc --noEmit -p tsconfig.test.json — confirms the two predicted new errors in
               inventory-primitives.test.tsx (stale props), nothing else new.
               npm run lint — full-repo run shows ~3900 pre-existing prettier-noise problems
               across unrelated files (documented since Sprint 4 of Stage-03); a targeted run
               scoped to every file this set touched
               (`src/pages/admin/inventory/**`, `src/hooks/useInventory.ts`,
               `src/services/inventory.service.ts`) is 0 problems.
```

No test file was edited. No test suite was run.

---

## Known limitations (plan §3) — not fixed here, recorded for the owner

1. **The adjustment picker is capped at 100 products** (`useAdminCatalogProducts({ page: 1, limit:
   100 })`, pre-existing, unrelated to this set). A product outside the first 100 cannot be
   picked in Adjustments, and its system-quantity/avg-price maps are empty for it. Fixing this
   means feeding the autocomplete's `onSearch` into a server-side product query — a data-flow
   change outside this set's scope.
2. **Export CSV ignores both the new search and the low-stock switch** (decision D-b, confirmed
   unchanged) — pre-existing for the switch, now also true for search by construction (the
   service call sends no params). A one-line change in `exportStockCsv` if the owner later wants
   "export what you see".
3. **`ReservationsQuery` still has no search** — out of scope per the brief (stock levels and
   movement ledger only).
4. **`MovementsQuery.staffId` still has no UI control** — pre-existing, unchanged.

**Staff parity:** confirmed by grep that `StockLevelsTable`, `MovementLedgerTable`,
`InventoryFilters` and `AdjustmentForm` each have exactly one consumer (`AdminInventory.tsx`) —
there is no staff inventory page to mirror. S18 owns adding one if the owner wants it.

---

## Manual verification checklist

The owner performs these in the browser. No automated test runs. Check colour-sensitive items in
**both light and dark mode**.

**Stock levels — search**
1. `/admin/inventory` → **Stock levels**. A search box sits left of the "Low stock only" switch,
   placeholder *"Search by name or barcode"*.
2. Type part of a **product name** → the table narrows to matching rows, and it does **not**
   refetch on every keystroke (a ~300 ms pause after you stop typing).
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
11. Narrow the window to mobile width: each card shows the product, the on-hand/available line,
    and a **Total cost** line.
12. **Export CSV** still downloads the full stock list (it deliberately ignores the search and the
    switch — decision D-b).

**Movement ledger — search**
13. `/admin/inventory` → **Movement ledger**. A search box sits before the type dropdown, same
    placeholder.
14. Search a **product name** → only that product's movements. Search a **barcode prefix** → the
    same rows.
15. Go to **page 2** of the ledger, then type in the search box → the list jumps back to
    **page 1** and the pagination footer's total page count reflects the filtered set.
16. Combine the search with the **type** dropdown and the **from/to** dates → all four filters
    apply together.
17. Every row's **Reference** cell still shows a human reference (`SAL-…`, `ORD-…`, `AJU-…`) —
    S1's RC-4 fix must be untouched.

**Adjustments — the product picker (RC-1, verify only)**
18. `/admin/inventory` → **Adjustments**. Pick a product: the input shows its **name**, not an id.
    Pick a different product on the same line, and add a second line and pick there too — both
    show names.

**Adjustments — the unit-cost default**
19. Pick a product **that has stock** and enter a counted quantity **above** the system quantity.
    The unit-cost field appears **pre-filled with the product's average stock price**, and the
    helper text beneath reads *"The average price is 1 234 DZD"* with the same figure.
20. Cross-check that figure against `/admin/products/:id` → the **Avg. stock price** stat (S3).
    They must be identical — and it must **not** be the *Avg. purchase price* stat beside it
    (D10).
21. Type your own unit cost over the default, then change the **counted quantity** again → your
    value survives (it is not overwritten on every keystroke).
22. Now change the **product** on that line → the unit cost re-defaults to the **new** product's
    average, and the helper text follows.
23. Pick a product that has **never had stock** (avg = 0): the unit-cost field stays **empty** and
    the helper text reads *"No average price yet — enter the unit cost"*. Submitting without
    typing a cost shows the "Unit cost is required…" validation message instead of silently
    posting.
24. **Clear** a pre-filled unit cost and submit → same validation message. It must **not** post a
    zero-cost adjustment.
25. Submit a valid positive adjustment leaving the default untouched → success toast with the
    `AJU-…` reference. Reopen `/admin/products/:id`: the **Avg. stock price** is **unchanged**
    (adding stock at exactly the current average cannot move it) and the on-hand quantity rose by
    the delta.
26. `/admin/inventory` → **Movement ledger**: the new `ADJUSTMENT_IN` row shows that unit cost,
    and the **Stock levels** tab's **Total cost** for that product rose accordingly.
27. Post a **negative** adjustment (counted below system): no unit-cost field, no helper text, and
    it posts as before.

---

The owner reviews and approves before S5 begins.
