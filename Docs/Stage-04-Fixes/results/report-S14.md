# Report — Set 14: Statistics

Executed against `Docs/Stage-04-Fixes/plans/plan-S14-statistics.md` on `stage-04-fix`, 2026-07-27,
immediately after S13 (repairs) in the same session. Closes **RC-5**, restores repairs as a
direct revenue source (**D8**/**D9**), confirms **D2**/**D10**, and audits the statistics stack
end to end.

## Owner decision carried into execution

**R1 (settled during planning)** — every per-dimension report and chart now reads the same three
revenue-recognising documents the headline figure already did: `Sale` (COMPLETED), `Order`
(COMPLETED, D2) and `Repair` (PICKED_UP, D8). Implemented literally: `sales-by-product`,
`sales-by-client`, `sales-by-seller`, `sales-by-category`, `top-products`, the revenue chart and
the family-breakdown chart all fold in orders and repairs now, not sales alone.

## What changed

### Backend (`Apps/api/src/modules/statistics/statistics.service.ts`) — full rewrite

- **RC-5 is a frontend-only defect** (see below) — no backend change was needed for it.
- **`computeRevenueProfit`** — added a third `repair.aggregate` (status `PICKED_UP`, dated
  `pickedUpAt`) to both the revenue and profit sums. This is the single fold-in point that
  automatically fixes `getOverview`, `getAdminDashboard`, `getStaffDashboard` and `getFiltered`'s
  headline figures — none of those methods needed their own edit. **No double-count**: a
  picked-up repair produces exactly one `Invoice` (`sourceType = REPAIR`) and never a `Sale` or
  `Order`; `computeRevenueProfit` never reads `Invoice`. Verified by re-reading the S13 pickup
  transaction, not assumed.
- **`computeRevenueProfit`/`countRecognizedOrders`** gained an optional `familyId` parameter
  (**F1** — the Family filter was previously validated and silently ignored). When set, both
  switch from document totals to **line-level** sums (`SaleLine`/`OrderLine`/`RepairPart` joined
  to `product.familyId`) — a document's delivery fee or labour belongs to no single family and
  is deliberately excluded from the family-filtered figure. This asymmetry is commented at the
  method.
- **New `productLineTotals(range)`** — the one shared per-product reader (`SaleLine` +
  `OrderLine` + `RepairPart`, merged by `productId`), consumed by **both** `getTopProducts` and
  `reportSalesByProduct` so the three-source union exists exactly once, per the plan's "fix the
  root cause once" instruction. One field-name reconciliation was needed:
  `productLineTotals`'s map uses `quantity` (matching `reportSalesByProduct`'s existing row
  shape), but `TopProductRow` (statistics.mapper.ts) names the same field `quantitySold` —
  `getTopProducts` renames at its own call site rather than forcing one name on both consumers.
- **`chartDailyRevenue`** — folds in `Repair` (dated `pickedUpAt`); gained the same `familyId`
  line-level branch as `computeRevenueProfit`.
- **`chartDailyOrderCounts`** — gained `familyId` (`lines: { some: { product: { familyId } } }`).
- **`chartDailyNewClients`** — unchanged, commented as deliberately family-agnostic (a client has
  no family).
- **`chartSalesByFamily`** — folds in `OrderLine`/`RepairPart` alongside `SaleLine`. No
  `familyId` special-case (a familyId would just collapse the existing per-family breakdown to
  one bar, which needs no code).
- **`reportSalesByClient`** — folds in `Order` (via `client.posClient` — an order whose client
  was never approved as a `PosClient` is skipped, same as a sale with `posClientId: null`) and
  `Repair` (`posClientId` is direct on `Repair`, no proxy needed).
- **`reportSalesByCategory`** — folds in `Order` (full per-line treatment, since `OrderLine`
  carries both `resolvedPrice` and `unitPrice`, D11) and `Repair` (document-level only —
  `resolvedRevenue = revenue`, `discount = 0`, `quantity` uncontributed — a repair has no
  per-part resolved/charged price pair to discount against).
- **`reportSalesBySeller`** — folds in `Order` (bucketed under a new `Unassigned` constant,
  **D-b**: `Order.confirmedByStaffId` is who confirmed it, not who sold it, and is nullable) and
  `Repair` (seller = the staff on that repair's `PICKED_UP` `RepairStatusHistory` row, read in
  **one batched query** for every recognized repair, not per-repair). Rows for the unassigned
  bucket carry `staffId: null` so the (removed, see F3 below) drill link never fires on it.
- **`reportRepairs`** rewritten (**F7**) — rows stay grouped/dated by `intakeAt` (a workload
  view) but gain `revenue`/`cost`/`profit` columns that are **zero for every status except
  `PICKED_UP`**; `totals` gains `recognizedRevenue`/`recognizedCost`/`recognizedProfit`,
  deliberately computed on a **different date basis** (`pickedUpAt`, not `intakeAt`) — commented
  explicitly so a future reader doesn't take the mismatch for a bug.
- **`reportAgeing`** — confirmed correct, **not changed** (**F9**): a repair invoice is just
  another `Invoice` row with `sourceType = REPAIR`, already covered.
- **`reportClientBrowsing`** — the "ever purchased" set (**F6**) now unions `SaleLine` +
  `OrderLine` + `RepairPart` distinct `productId`s, was `SaleLine` alone. Still deliberately
  carries no date filter (a lifetime fact, not scoped to `range`) — same as before S14, now
  commented as intentional.
- **Confirmed already correct, unchanged** (**F8**): `getOverview`'s stock valuation reads
  `avgStockPrice`, never `avgPrice` (grepped — `avgPrice` appears nowhere in the file outside one
  comment); `ORDER_RECOGNIZED_STATUSES = ['COMPLETED']` dated on `deliveredAt`; `reportSalesByCategory`
  groups by client pricing tier (audit fix A1); `getTopProducts` carries brand/family/image
  (audit fix B4).

### Frontend (`Apps/web`)

- **New `src/lib/chart-theme.ts`** — RC-5's actual fix. Root cause: every chart wrote
  `hsl(var(--primary))`, but this project's design tokens are bare **OKLCH** channel triplets
  (`index.css`, consumed everywhere else as `oklch(var(--x))`). `hsl(0.552 0.228 260.9)` is not a
  colour — the declaration was silently dropped and the element fell back to its initial value,
  which is why every chart read as blank in light mode. `useChartTheme()` returns literal OKLCH
  strings (not `var()` references — Recharts writes these as SVG presentation attributes, and
  `var()` support there isn't something to depend on) for both `:root` and `.dark`, read via
  `next-themes`' `resolvedTheme`.
- Applied to all five chart-rendering files: `revenue-chart.tsx`, `clients-chart.tsx`,
  `orders-trend-chart.tsx`, `sales-by-family-chart.tsx`, `report-picker.tsx`. Each: series colour
  from `chart.series[...]`, grid/axis from `chart.grid`/`chart.axis` (the `opacity-30` className
  compensating for an uncontrolled grid default is removed — the grid now has a real colour),
  `Tooltip` gets an explicit `contentStyle`/`itemStyle`/`labelStyle` so it's never
  theme-transparent. `sales-by-family-chart.tsx`'s module-level `COLORS` array is deleted in
  favour of `chart.series`.
- **`grep -rn "hsl(var(" src` returns zero hits outside comments** (three files reference the
  string only inside an explanatory comment) — the grep gate passes.
- **New `report-columns.ts`** (**F4**) — a flat field-name → translation-key map (every field
  name emitted across all nine `ReportType` methods, enumerated from the rewritten service).
  `report-picker.tsx`'s column header (`report-picker.tsx:74`) and its mobile-row label now read
  `t(REPORT_COLUMN_KEY[key] ?? key)` instead of the raw field name.
- **`report-picker.tsx`** — **F2**: the `groupBy` text input, its state, and its query field are
  deleted (UI-only removal — `ReportQuerySchema.groupBy` and the service signature are
  untouched, same precedent S7 used for save-draft). **F3**: `DRILL_ROUTES`'s dead `client` entry
  is removed (no report ever emitted it — the service emits `posClient`); `product`/`supplier`
  kept, both routes confirmed still present in `App.tsx`.
- **`admin-statistics-filtered-cards.tsx`** — **F5**: its local `formatCurrency` (hardcoded
  `"en-US"`) is deleted; money renders through the shared `formatDZD(value, language)`.
- **`admin-statistics-overview-cards.tsx`** — **the plan flagged this file for a check, not a
  confirmed fix; the check found the same bug.** Its `formatCurrency(value, locale = "en-US")`
  *did* accept a locale parameter, but the one call site never passed one, so it silently always
  formatted as en-US regardless of the app's language — identical defect class to F5, just not
  separately numbered in the plan. Fixed the same way (`formatDZD`), noted here rather than
  silently expanding scope.
- **Translations**: 30 new `admin.statistics.reports.columns.*` keys (one per field name in
  `REPORT_COLUMN_KEY`); the now-dead `admin.statistics.reports.groupBy` key deleted (confirmed
  via grep it had no other consumer first). Every `t()` call in every S14-touched file
  cross-checked against `translations.json` — zero unresolved keys.

## Deviations / notes

- **Pre-existing gap noticed, left alone**: `admin-statistics-filters.tsx` (untouched by S14)
  references `t("admin.statistics.filters.description")`, which has no entry in
  `translations.json`. It predates this set and is outside its brief — flagging rather than
  silently expanding scope to fix it.
- **`admin-statistics-overview-cards.tsx` fix beyond the plan's letter, within its spirit** — see
  above; the plan explicitly asked to check this file "since it takes a locale" and the check
  surfaced a live bug of the same class as F5.

## Validation gate (D12 — no test file read, edited, or run)

| Package | `tsc --noEmit` | `lint` |
|---|---|---|
| `Apps/contract` | clean (untouched by S14) | clean |
| `Apps/api` | `src/**` clean; one fix needed (`quantitySold`/`quantity` field-name mismatch under `exactOptionalPropertyTypes`, fixed at the `getTopProducts` call site) | `statistics` module lint clean |
| `Apps/web` | clean | zero errors in any S14-touched file — confirmed by diffing the full `npm run lint` error-file list against `git status --porcelain` for both S13 and S14 combined |

`Apps/api`'s `test/**` staleness (not read/edited): `test/integration/statistics.integration.spec.ts`
references `repair.saleId`, already stale since S1/S13 removed that field — no new staleness
category introduced by S14's own changes.

## Reconciliation (traced against the actual code, per §4 of the plan)

No automated test run was available to verify this against seeded data (D12 forbids the test
suite); the six checks below were traced by re-reading the rewritten service against the S13
pickup transaction and the S10 order-completion transaction, the same "worked example, verified
by hand" method S13's own report used for its money arithmetic.

| # | Check | Result |
|---|---|---|
| 1 | **No double-count** | `computeRevenueProfit` sums `Sale`/`Order`/`Repair` — three disjoint tables — and never reads `Invoice`. A picked-up repair's `Invoice` row is never counted a second time. ✅ |
| 2 | **Nothing lost** | Repair parts reach `top-products`/`sales-by-family` via `productLineTotals`/`chartSalesByFamily`; repair totals reach `sales-by-client` (direct `posClientId`) and `sales-by-seller` (via `RepairStatusHistory`). ✅ |
| 3 | **D-a (labour/delivery-fee gap) holds structurally** | `sales-by-product`/`chartSalesByFamily` sum only `lineTotal` fields (no labour, no delivery fee); `sales-by-client`/`sales-by-seller`/`sales-by-category` sum full document `totalAmount` (labour and delivery fee included). The gap between the two is exactly Σ labour + Σ delivery fee over the recognized window — by construction, not by coincidence. ✅ |
| 4 | **D2 holds** | `ORDER_RECOGNIZED_STATUSES = ['COMPLETED']` gates every order read in the file (verified: `computeRevenueProfit`, `countRecognizedOrders`, `chartDailyRevenue`, `chartDailyOrderCounts`, `chartSalesByFamily`, `productLineTotals`, `reportSalesByProduct/Client/Category/Seller` all reference the same constant). `Order.totalCost`/`totalProfit` are stamped only at `COMPLETED` (S10) — nothing to read before then regardless. ✅ |
| 5 | **D8 holds** | `REPAIR_RECOGNIZED_STATUS = 'PICKED_UP'` gates every repair-money read the same way; `Repair.totalCost`/`totalProfit`/`pickedUpAt` are stamped only inside S13's `pickUpRepair` transaction. ✅ |
| 6 | **D10 holds** | `getOverview`'s `stockValue` is unchanged: `Σ quantityOnHand × avgStockPrice`. `avgPrice` (the unweighted, supplier-invoice-only figure) appears nowhere in `statistics.service.ts` outside one explanatory comment — grepped, not assumed. ✅ |

## Manual verification checklist (browser)

Unchanged from the plan's §6 — reproduced here for the reviewer's convenience. **This set cannot
be meaningfully verified until S13 is approved and at least one repair has been picked up** — every
repairs-related row below depends on S13's `pickUpRepair` having actually stamped a `Repair` row.

### RC-5 — charts in both themes
1. `/admin/statistics` in **light** mode: revenue line, orders bars, clients line and the
   sales-by-family pie are all visible and coloured.
2. Axis tick labels and grid lines are legible against the page background.
3. Hover any chart — the tooltip has a solid background with readable text.
4. Toggle to **dark** mode without reloading — every chart re-colours, nothing goes invisible,
   the tooltip stays readable.
5. The report chart under Reports behaves the same in both themes.

### Repairs as a revenue source (D8/D9)
6. Note the overview's Total revenue and Total profit.
7. Pick up a repair (S13 flow). Reload — revenue rose by the repair's **total** (parts and
   labour), profit by `total − cost`.
8. Reports → Sales by product: the repair's parts are listed.
9. Reports → Sales by client: the repair's client row includes the repair total.
10. Reports → Sales by seller: the staff member who performed the pickup carries the repair.
11. Reports → Repairs: the `PICKED_UP` row shows revenue/cost/profit; every other status row
    shows zeros.
12. Sales by family chart and Top selling products: the repair's parts contribute.
13. `/admin/invoices` — the repair's invoice exists exactly once; revenue did not double.

### Orders at completion only (D2)
14. Move an order to `PACKAGED`. Reload `/admin/statistics` — no figure moves.
15. Complete it — revenue, profit and the orders count all move together.

### Stock valuation (D10)
16. Overview → Total product value tracks `avgStockPrice`. Post a positive stock adjustment at a
    unit cost different from the current average and confirm the figure follows the weighted
    average.

### Audit fixes
17. Change the Family filter — the filtered cards and the revenue chart **change** (previously
    inert, F1).
18. Report column headers read as words ("Product", "Revenue"), not `productId`/`revenue` (F4).
19. The `groupBy` text box is gone from the report card (F2).
20. Sales-by-client rows are not links (no per-POS-client detail page exists) and no longer
    render a broken link either (F3).
21. Switch the app to French — both the filtered cards **and** the overview cards' currency
    formatting follow the language now.
22. Client browsing report: a product only ever sold through an order or fitted in a repair is
    no longer listed under "viewed, never purchased" (F6).

### Regression sweep
23. `/admin/dashboard` and `/staff/dashboard` still load, revenue-this-month now including
    repairs.
24. CSV export still downloads and its header row matches the on-screen columns (the CSV keeps
    raw field names — headers are translated in the table only; this is an intentional
    boundary, not a gap, since `toCsvExport` streams `dto.rows` verbatim).

---

Awaiting owner review of **both S13 and S14** before **S15 (public storefront)** starts.
