# Report — Set 24: statistics correctness (fix) + revenue-source filter

Executed against `Docs/Stage-04-Fixes/plans/plan-S24-statistics.md` on `version-1-2`, 2026-08-12.
Follows the audit in `Docs/Stage-04-Fixes/results/findings-S24-statistics.md`, with the owner's
decisions: **Q1 delegated** (read-time netting, restated into the original document's period),
**Q2** (delivery fee is not revenue), **Q3** (repair labour is revenue), plus the requested
**revenue-source filter** (all / products / repairs).

All 4 phases executed as planned, in order (Phase 1 → 2 → 3 → 4). No test file was edited. No
test suite was run. One migration was created (Phase 1's schema change) — non-destructive, no
backfill.

---

## What changed

### Schema & migration (`Apps/api/prisma`)

- **`Return`/`ReturnLine` made polymorphic over `Sale` and `Order`** — `saleId`/`saleLineId` are
  now nullable, with new nullable `orderId`/`orderLineId` and their FKs. Migration
  `20260812130640_order_returns` applied to the dev database; verified both existing `Return` rows
  and both existing `ReturnLine` rows preserved their `saleId`/`saleLineId` values after the
  migration ran. No column was dropped, no data was touched beyond the two new nullable columns.

### Backend — orders (`Apps/api/src/modules/orders/orders.service.ts`)

- **`returnOrder` now writes a `Return`/`ReturnLine` record** (previously it wrote none at all —
  the only trace of an order return was a negative `ClientPayment` row, absent entirely for a
  credit-only order). Written inside the existing transaction, before the stock/credit
  mutations. Each line's `refundAmount` is the one order-level `cmd.refundAmount` split
  proportionally by `unitPrice × quantity` across the returned lines (`ReturnOrderCommand` carries
  one document-level figure, unlike sales' per-line one). `cmd.restock` (order-level) is copied
  onto every line. Every order return is stamped `ReturnType.REFUND` — `ReturnOrderCommand` has no
  `type`/`reason` field.

### Backend — sales (`Apps/api/src/modules/sales/sales.service.ts`, `sales.mapper.ts`)

Not in the original plan's file list — required by Phase 1's schema change, discovered at compile
time:

- **`sales.service.ts` `listReturns`** now filters `saleId: { not: null }` explicitly. This route
  is sales' own returns tab; without the filter it would have started returning order-sourced
  `Return` rows too (whose `sale` relation is null), which its mapper cannot render. An
  order-return listing is a separate, not-yet-built concern.
- **`sales.service.ts` `createReturn`** — one `returnLine.saleLineId` read narrowed with a
  documented non-null assertion (the query already filters on the `saleLine` relation existing).
- **`sales.mapper.ts` `ReturnRow`** — narrowed `saleId`/`saleLineId` back to non-null in the type
  (every caller of this mapper reads sale-scoped rows only, per the `listReturns` fix above)
  rather than threading an optional shape through every field of `toReturnDto`.

### Backend — statistics (`Apps/api/src/modules/statistics/statistics.service.ts`)

- **New recognised-status constants** — `SALE_RECOGNIZED_STATUSES` (`COMPLETED`,
  `PARTIALLY_RETURNED`, `RETURNED`) alongside the existing `ORDER_RECOGNIZED_STATUSES`, now also
  including `RETURNED`. Every sale/order query in the file switched from a literal `'COMPLETED'`
  filter to these.
- **`returnAdjustments()`** — new shared reader (A1). For every `ReturnLine`, computes: revenue
  (the refund given), cost (the line's proportional stored `costOfGoods`, **only if restocked**),
  profit (the difference), and carries `productId`/`familyId`/`posClientId`/`categoryId`/
  `sellerStaffId`/`recognizedAt` so every consumer can subtract it from the right bucket. Dated by
  the **parent document's own recognition date**, not `returnedAt` — a return restates the period
  the sale happened in (Q1), it does not create a contra entry in the period the refund was
  issued. Returns `[]` immediately for `source: REPAIRS` (repairs have no return path).
- **`computeRevenueProfit`** — orders now contribute `subtotal`, never `totalAmount` (Q2 — the
  delivery fee is not revenue; `Order.totalProfit` needed no change, it was already fee-free).
  Gained `source: RevenueSource` (default `ALL`), gating each of the three document types.
  Subtracts `returnAdjustments()`'s totals (A1).
- **`countRecognizedOrders`** — an order now counts unless **every** line was returned in full
  (Q1: "as if never bought"); a partial return still counts as one real order. Gained `source`
  (returns 0 for `REPAIRS`).
- **`dateRangeFilter`** (A2) — `to` is now an **exclusive next-day bound**
  (`new Date(range.to.getTime() + DAY_MS)`), matching the pattern already established in
  `inventory.service.ts#listMovements`. Previously `lte` against a bare `YYYY-MM-DD` (midnight)
  silently dropped the entire final day — and the UI's default range always ends *today*.
- **Four inline `lte: to` sites** that bypassed the helper — `countRecognizedOrders`,
  `chartDailyRevenue` (both branches), `chartDailyOrderCounts`, `chartSalesByFamily`, and
  **`chartDailyNewClients`** — all converted to the same exclusive bound.
- **`productLineTotals`** — gained `familyId`/`source`; nets returned quantity/revenue via
  `returnAdjustments()`, dropping a product whose net quantity and revenue both reach 0.
- **Charts** — `chartDailyRevenue`: orders use `subtotal` (Q2), gated on `source`, returns
  subtracted per day. `chartDailyOrderCounts`: gated on `source`. **`chartSalesByFamily`** (A6):
  now actually reads `familyId` — previously accepted nowhere and every family rendered regardless
  of the selection, despite a comment claiming otherwise; gated on `source`; returns subtracted per
  family.
- **`reportSalesByProduct`** — unchanged logic, inherits A1 via `productLineTotals`.
- **`reportSalesByClient`** — orders contribute `subtotal` (Q2); returns subtracted per client
  (A1).
- **`reportSalesByCategory`** (A10) — three corrections: sales now sum the stored `lineTotal` and
  subtract the sale's own `discountAmount` once per document (previously `unitPrice × quantity`,
  which ignored a document-level discount); orders were already correct and left unchanged; repair
  parts now add to `quantity` (previously silently excluded); returns subtracted per category.
- **`reportSalesBySeller`** — orders contribute `subtotal` (Q2); returns subtracted per seller,
  order returns folding into `UNASSIGNED_SELLER_BUCKET` (matching how order revenue itself is
  bucketed).
- **`reportStockMovements`** (A3) — `where: { direction: { in: ['IN', 'OUT'] } }` added.
  `PENDING_ORDER`/`PENDING_REPAIR`/`PENDING_RELEASE` — reservations that move no layers — can no
  longer appear as stock movement in or out.
- **`reportRepairs`** (A5) — rows no longer carry `revenue`/`cost`/`profit` computed on the
  `intakeAt` basis (which contradicted `totals.recognized*`, the correct `pickedUpAt`-basis
  figures, for any repair whose intake and pickup fall in different report ranges). Rows now carry
  only `accruedAmount` (a workload figure); `totals.recognized*` is the report's one money answer.
- **`reportClientBrowsing`** (A7) — the three "purchased" queries (previously unfiltered — a
  product in a DRAFT sale or a CANCELLED order counted as purchased) now gate on each document
  type's own recognised statuses.

### Contract (`Apps/contract/src/modules/statistics`)

- **`RevenueSource` enum** added (`ALL | PRODUCTS | REPAIRS`) — the new filter's shared vocabulary
  (hard rule 1: crosses front/back, lives in the contract).
- **`source: z.enum(RevenueSource).optional()`** added to both `FilteredQuerySchema` and
  `ChartsQuerySchema`. Additive/optional — no existing caller breaks; omitted means `ALL`.

### Frontend (`Apps/web`)

- **`admin-statistics-filters.tsx`** — new third filter (`selectedSource`/`onSourceChange`), grid
  `md:grid-cols-2` → `md:grid-cols-3`; `hasActiveFilters`/`handleClearFilters` extended; new
  "current selection" panel and active-filter badge; a note beneath the whole filter grid when a
  family is selected, stating repair labour is excluded from it (Q3).
- **`AdminStatistics.tsx`** — `selectedSource` state, URL-synced (`?source=`) exactly like
  `selectedFamily`; `filterQuery` gains `source`; both `useFiltered` and all four `useChart` calls
  pick it up automatically (their query keys hash the whole object — **no `query-keys.ts` change
  needed**). Top-selling products gained an "all time" caption (A12 — `TopProductsQuery` carries no
  date/family/source, so the widget cannot follow the page filters; not silently left to read as
  filtered).
- **`admin-statistics-overview-cards.tsx`** — all three render branches (loading/error/success)
  gained an "all time" caption (A13). `totalRevenue`/`totalProfit` description copy reworded to
  drop "from all sales" (repairs produce no `Sale` row and are included in the figure) and to state
  the figure is net of returns.
- **`report-picker.tsx`** — `formatCellValue` replaced with key-aware `formatReportValue` routing
  money columns through `formatDZD(value, language)` (A8 — was a bare `toLocaleString()` with no
  currency and no locale argument). Column derivation now unions every row's own keys rather than
  reading `rows[0]` alone (A9 — `client-browsing` returns two row shapes; one always rendered
  blank). `report.data.totals` now renders as a summary strip beneath the table (A4 — computed by
  all nine reports, never displayed). An "ageing is a snapshot" note appears when that report type
  is selected (A11).
- **`report-columns.ts`** — new `REPORT_MONEY_KEYS` set; new column-key entries for `totals`
  fields and `reportRepairs`' renamed `accruedAmount`.
- **`translations.json`** — 22 new keys (filter labels/notes, report totals/notes, new column
  labels), `en`/`fr` populated, `ar` left empty matching the file's existing convention; 2 existing
  keys reworded (A13).

---

## Validation gates

Per hard rule 3 — compile and lint only, no test run.

| Gate | Result |
|---|---|
| `Apps/contract` `tsc --noEmit` | Clean |
| `Apps/api` `tsc --noEmit`, full incl. `test/**` | **228 lines, byte-identical** to the S23 baseline (`git stash` A/B comparison), zero new errors — **the schema widening (nullable `saleId`/`saleLineId`) needed no test-fixture changes**: existing fixtures construct these fields with concrete non-null values, which remain valid against a widened (now-optional) type. Two `src/**` breaks it *did* cause (`sales.mapper.ts`, `sales.service.ts`, both reading `ReturnLine.saleLineId` without a null check) were found and fixed — see above. |
| `Apps/api` `npm run lint` | **8 pre-existing errors, identical** to baseline |
| `Apps/web` `tsc --noEmit` | Clean |
| `Apps/web` `npm run lint` | **3414 problems, identical** to the pre-existing baseline — an initial pass found 7 new prettier-only findings in the files this set touched, auto-fixed with `eslint --fix` (formatting only, no logic change), then reverified at parity |
| `grep -n "'COMPLETED'" statistics.service.ts` | 3 hits: the two new recognised-status constant definitions, plus `getStaffDashboard`'s "sales rung up today" till count — the one deliberate case the plan named to leave alone |
| `grep -n "lte:"` / `"lte: to"` in statistics.service.ts | Empty — confirmed during review that `chartDailyNewClients` had been missed on the first pass (A2 applies to **all four** charts, not three) and fixed before this gate was run clean |

---

## Manual verification checklist

Copied and adapted from the plan, with concrete expected figures computed against the dev database
at execution time — cross-checked by direct SQL, not just code review.

**Before starting, record the baseline** — *Admin → Statistics* → **Total Revenue 129,600.00**,
**Total Profit 61,300.00**.

1. **A1 — returns net instead of erasing.** After the fix, **Total Revenue reads 178,600.00** and
   **Total Profit reads 82,200.00**. (Note this is 500.00 lower than the audit's earlier
   179,100.00 estimate — that estimate predated the Q2 delivery-fee decision, which independently
   removes ORD-2026-0003's 500.00 fee from revenue.) Cross-check: `SAL-2026-0002` should now
   contribute 23,000.00 (24,800 − 1,800 refunded) with 8,400.00 profit (9,200 − 800 cost
   reversed); `SAL-2026-0003` should contribute 26,500.00 with 12,500.00 profit.
2. **A1 — a fresh return behaves.** Complete a POS sale of two products. Return one line at full
   price **with restock**: revenue falls by exactly that line's total, profit by exactly that
   line's profit, the other line still counts. Return another sale's line **without restock**:
   revenue falls by the refund but profit falls by the *whole* refund (cost stays — the goods
   never came back).
3. **Q1 — order returns are now recorded.** Return part of a `COMPLETED` order. Confirm the row
   exists:
   ```sql
   SELECT r.reference, r."orderId", rl."orderLineId", rl.quantity, rl."refundAmount"
   FROM "Return" r JOIN "ReturnLine" rl ON rl."returnId" = r.id WHERE r."orderId" IS NOT NULL;
   ```
   Then confirm the order's kept lines still contribute revenue in *Admin → Statistics*.
4. **A2 — today counts.** Set the range to **This Month**, note revenue, ring up a sale **today**,
   refresh — the figure moves (it did not before this fix). Also check the **Clients** chart
   moves when a client registers today — `chartDailyNewClients` was the one chart missed on the
   first implementation pass and fixed before this report was written.
5. **Q2 — the delivery fee is out.** *Reports → Sales by client* for ORD-2026-0003's client now
   shows **23,000.00**, matching *Sales by category*. The two previously disagreed by exactly
   500.00.
6. **Q3 — labour is in.** *Reports → Repairs* → totals → **recognizedRevenue includes
   REP-2026-0001's 2,500.00 labour** (total 4,100.00 = 2,500 labour + 1,600 parts). Rows no longer
   show a revenue column at all (A5) — only `accruedAmount`; the totals strip is the money answer.
7. **New filter.** Set **Revenue source → Products only**: revenue drops by the repair total
   (13,100.00 on current data, to 165,500.00). Set **Repairs only**: shows only 13,100.00, and the
   orders chart is empty. Set **All**: back to 178,600.00. Reload the page — the selection
   survives via `?source=`.
8. **A3 — no reservations in stock movements.** *Reports → Stock movements* no longer lists
   `PENDING_ORDER`, `PENDING_REPAIR` or `PENDING_RELEASE`.
9. **A4 — totals appear.** Every report now shows a totals strip beneath its table.
10. **A6 — the family chart filters.** Pick a family: **Sales by family** collapses to that
    family's bar; the labour-exclusion note appears beneath the filter card.
11. **A7 — cancelled documents are not "purchased".** *Reports → Client browsing*: a product that
    only appeared in `ORD-2026-0002` (`CANCELLED_BY_CLIENT`) is eligible again for "viewed, never
    purchased".
12. **A8/A9 — presentation.** Money columns read `23 000,00 DA`, not `23,000`, and follow the
    language switch. *Client browsing* renders both row groups with their own columns instead of
    one group showing blanks.
13. **A11/A12/A13 — captions.** Ageing shows its snapshot note when selected; top products shows
    "all time"; the overview block shows "all time" and no longer says "from all sales".
14. **No regression elsewhere.** POS sale, order completion, repair pickup, and a plain (non-return)
    order return all still work end to end; admin and staff dashboards still load; S23's stock
    valuation figure is unaffected (this set touches no `avgStockPrice` read).
