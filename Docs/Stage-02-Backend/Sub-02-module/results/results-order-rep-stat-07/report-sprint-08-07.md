# Sprint 8 Report — Statistics: Logic (service)

**Set:** 07 (orders + repairs + statistics) · **Module:** statistics · **Layer:** logic
**Status:** ✅ Done

---

## What was built

- **`src/modules/statistics/statistics.service.ts`** — `StatisticsService implements
  IStatisticsService`, constructor DI `(prisma)` **only** — no injected cross-module services,
  no event bus, no writes (every method is a pure read):
  - **`computeRevenueProfit`** (shared private core) — Σ COMPLETED `Sale` rows (both origins,
    no `origin` filter at all — a REPAIR-origin sale is summed identically to a POS one) + Σ
    CONFIRMED-and-later `Order` rows (`Order.profit`/`costOfGoods`, stamped at confirm). Never
    reads the `Repair` table for money at all (§C-4) — verified in tests via
    `expect(repairFindManyMock/repairGroupByMock).not.toHaveBeenCalled()`.
  - **`getOverview`** — the above (all-time) + `stockValue = Σ quantityOnHand × averageCost`
    (reduced client-side — Prisma has no cross-column-multiply aggregate) + `Σ PosClient.credit`
    / `Σ Supplier.credit`.
  - **`getFiltered`** — `[from,to]` vs. the immediately-preceding equal-length window;
    `pctChange` guards `previous===0 ⇒ 0`.
  - **`getChart`** — day-bucketed for `revenue`/`orders`/`clients` (fetched in-range, reduced
    client-side into `{label:date; value}[]`); `sales-by-family` is a single category
    breakdown (Σ `SaleLine.lineTotal` grouped by `Product.family`), not a time series.
  - **`getTopProducts`** — Σ `SaleLine` grouped by `productId` over an optional
    week/month/year window, ranked by revenue, top 10.
  - **`getReport`** — all nine `ReportType`s (see below), each ending in
    `StatisticsMapper.toReportDto`; `format=csv` streams the identical `rows` via a small
    `toCsvExport` helper (header row from `Object.keys(rows[0])`, one line per row).
  - **`getAdminDashboard`** — `stats` (`ordersThisWeek`/`revenueThisMonth` each with their own
    period-comparison `*ChangePct`) + pending/recent orders+clients + low stock +
    `repairsByStatus` (`groupBy`) + `draftSalesByStaff` (`groupBy` + a `Staff` name join).
  - **`getStaffDashboard`** — strictly `staffId=me` for `mySalesToday`/`myRevenueToday`/
    `myDrafts`; `myPendingOrdersCount` and `lowStock` are the two non-scoped data points
    (documented below).
- **Test:** `test/unit/modules/statistics/statistics.service.spec.ts` (20 tests, mock Prisma) —
  profit sums stored `Sale.totalProfit`/`Order.profit` verbatim (no FIFO recomputation);
  `getOverview` never touches the `Repair` table (repair sale counted once, via its own `Sale`
  row); every aggregate defaults to 0 on an empty DB; `getFiltered`'s empty-previous-period
  guard (0%, no divide-by-zero) and a real non-empty comparison; `sales-by-seller`'s discount
  column matches a hand-computed `Σ(resolvedPrice−unitPrice)×qty`; CSV export's row count and
  header match the JSON response's own `rows`; `getStaffDashboard`'s leak test (every
  `sale.findMany` call scoped by `staffId`, with `myPendingOrdersCount` asserted as the one
  documented exception, not an oversight).

## Documented inferences and simplifications (statistics is unusually under-specified)

Statistics' spec is the least concretely-specified of the three modules in this set — several
fields have no exact formula, threshold, or grouping granularity anywhere in `statistics.md` or
the contract. Each below is a genuine, judgment-call inference, not a silent guess:

1. **`totalClientsChangePct`/`totalProductsChangePct`** read as each stat's own week-over-week
   *growth rate* (new clients/products created this week vs. last week) rather than a
   reconstructed "total as of one week ago" — simpler, avoids inventing a point-in-time
   snapshot query, and stays consistent with `ordersThisWeek`'s own weekly cadence.
2. **`myPendingOrdersCount`** (staff dashboard) is read as a **global** count, not personally
   scoped — `Order` has no owner-staff column at all (orders' own plan: "orders have no owner
   staff"), so a per-staff figure is architecturally impossible; treated on the same footing as
   the low-stock alert, the spec's own explicitly-named non-scoped exception.
3. **`sales-by-category`** (a `ReportType`) is read as `Product.family` — the schema has no
   separate "category" concept on `Product` (only `familyId`/`brandId`), and this is the same
   dimension the `CHARTS` route's own `sales-by-family` uses.
4. **Chart granularity** (`revenue`/`orders`/`clients`) defaults to a **day** bucket — no
   granularity parameter exists anywhere in `ChartsQuerySchema`; `sales-by-family` is instead a
   single category breakdown, matching its own name (not a time series).
5. **`TOP_PRODUCTS`'s `period`** (a free string, no enumerated values) recognizes `'week'`/
   `'month'`/`'year'`; anything else (including absent) means all-time — a minimal, defensible
   parse of an intentionally-unconstrained field.
6. **`LARGE_ADJUSTMENT_OUT_THRESHOLD = 50`** (units) for the `stock-movements` report's
   shrinkage flag — the spec says "large ADJUSTMENT_OUT flagged" with no number anywhere; a
   named constant, easy to tune later, not a magic number buried in logic.
7. **`ageing`** buckets each *invoice's own* outstanding remainder by its own age (`Invoice`
   ISSUED/PARTIALLY_PAID; `SupplierInvoice` CONFIRMED) rather than a single age per
   client/supplier — `PosClient.credit`/`Supplier.credit` are running balances with no single
   "age" of their own; bucketing the underlying documents is the only way to genuinely "age"
   anything.
8. **`getFiltered`'s `familyId`** is accepted by validation but **not yet applied** to the
   revenue/profit computation — a fully correct family-scoped split needs a line-level (not
   document-level) recomputation, the same complexity the `sales-by-category` report already
   carries per-row. Flagged as a real simplification (not silently dropped): `getReport`'s
   `sales-by-category` already gives a family-scoped breakdown as a working alternative.
9. **`recentOrders`(8)/`recentClients`(5)/`lowStockProducts`(5)`** limits are **not invented** —
   they come from the contract's own grounding comment on `AdminDashboardResponseSchema`
   (`statistics.dtos.ts`), which cites the frontend page-requirements docs directly.

None of these block the sprint; each is either a reasonable default consistent with sibling
fields, or explicitly grounded in an existing comment/precedent. All are individually callable
out for revision once real frontend/reporting requirements are confirmed — the same spirit the
contract-authoring stage itself used for `AdminDashboardDto`/`StaffDashboardDto`.

## Validation

- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green — **590/590 tests, 41 files** (20 new statistics-service tests;
  no regressions elsewhere). `test:int` not run this sprint — no route wired yet.
- [x] `npm run lint` clean (`src test prisma`) — one `no-unused-vars` finding (an unused
  type-only `Prisma` import) caught and fixed before this report was written.
- [x] Service is read-only (no writes, no emits, confirmed by the test suite never asserting
  any Prisma mutation call); reads **stored** figures only (§C-4); returns DTOs that `.parse`;
  no cross-module folder import (pure reads via the shared `prisma` singleton only).
- [x] Committed on green.

## Next sprint

Sprint 9 — Statistics: API (controller, routes, wiring, integration). No listener (statistics
listens to nothing, emits nothing). The controller's CSV branch streams `ExportResult` instead
of `sendSuccess`, mirroring the inventory/billing precedent.
