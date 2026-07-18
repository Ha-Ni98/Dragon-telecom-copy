# Sprint 9 Report — Statistics: API (controller, routes, wiring, integration)

**Set:** 07 (orders + repairs + statistics) · **Module:** statistics · **Layer:** api
**Status:** ✅ Done

---

## What was built

- **`src/modules/statistics/statistics.controller.ts`** — `StatisticsController`, thin
  (`try/catch → next`, `sendSuccess` `200` everywhere — every route is a read). `getStaffDashboard`
  reads `req.user!.staffId!` — never a query param (spec BL#5). `getReport`'s CSV branch mirrors
  the inventory/platform precedent exactly (`if ('body' in result) { ...stream...; return; }`).
- **`src/modules/statistics/statistics.routes.ts`** (composition root) — manual DI:
  `new StatisticsService(prisma)` (Prisma-only); `new StatisticsController(service)`; **no
  listener**. `STAFF_DASHBOARD` uses `requireAuth({types:[STAFF], checkDB:true})`; every other
  route uses `requireAuth({types:[ADMIN], checkDB:true})` (no public routes at all).
- **`src/modules/index.ts`** — wired `statisticsRouter` at the `EXTENSION POINT (modules)`, the
  last module in set 07.
- **`test/integration/statistics.integration.spec.ts`** (5 tests, real Postgres test DB) —
  `OVERVIEW` reflects a real confirmed order + a real picked-up repair's REPAIR-origin sale,
  summing exactly once each (independently cross-checked via a direct `Sale`+`Order` aggregate,
  confirming the `Repair` row is never separately added); `REPORT?format=csv` streams the exact
  same row count as the JSON response; admin-vs-staff auth (staff 403s every admin-only STATS
  route); `STAFF_DASHBOARD` leak test (staff B never sees staff A's `mySalesToday`); `OVERVIEW`'s
  `stockValue` matches a real seeded product's `quantityOnHand × averageCost`.
- **`test/contract/routes.conformance.spec.ts`** — added a "statistics route resolution" block
  (7 cases across all 7 `STATS_ROUTES` constants), bringing the file's conformance count from
  13 to 14.

## Two test-writing bugs caught by real execution (not service defects)

1. **Wrong product fixture for a sales-confirm flow.** The `STAFF_DASHBOARD` leak test drafted
   and confirmed a real POS sale using a `seedStockedProduct` helper borrowed from orders'
   pattern — which sets `guestPrice` (orders' viewer-pricing need) but not `defaultSalePrice`
   (what sales' own `resolvePosPrices` actually reads). The confirm silently 400'd, leaving the
   sale in `DRAFT`, and `mySalesToday` correctly reported `0` — exposing that the test's own
   confirm call was never checked for success. Fixed by setting both price fields on the shared
   helper (this file backs both an orders-PLACE flow and a sales-confirm flow) — the service's
   scoping logic was correct throughout.
2. **Forgot the delivery fee in the expected revenue total.** The `OVERVIEW` test first
   expected `1500` order revenue as just its `1000` subtotal — but a `DELIVERY_HOME` order's
   `totalAmount` also carries the default delivery fee (`500`, same default orders' own Sprint 3
   tests established), making the real total `1500`, and the combined expectation `2100`, not
   `1600`. `Order.profit` is unaffected (FIFO revenue is `unitPrice × qty` only, never the
   delivery fee) — fixed the test's arithmetic, not the service.

## Validation

- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green — **591/591 tests, 41 files** (7 new `STATS_ROUTES`
  conformance cases; no regressions elsewhere).
- [x] `npm run lint` clean (`src test prisma`, no findings).
- [x] **`npm run test:int` run for real** against the reachable Postgres test DB — statistics'
  own 5/5 pass, run twice to rule out flakiness. Full `test/integration` suite: **129/131** — the
  2 remaining failures are both in `purchasing.integration.spec.ts` (concurrency tests), the same
  pre-existing, environment-level `FOR UPDATE`-timing characteristic already documented across
  sets 06/07's prior reports; reproduced independent of any statistics code (statistics touches
  neither purchasing nor its tables — it only reads them).
- [x] Routes use `STATS_ROUTES` constants only; JSON via `sendSuccess`, CSV streams an
  `ExportResult`; staff dashboard strictly self-scoped (verified in the leak test).
- [x] Committed on green.

## Set 07 statistics module: complete

All 5 files (`mapper`/`interface`/`service`/`controller`/`routes` — no listener) built across
Sprints 7–9; router mounted; real end-to-end figures (a confirmed order, a picked-up repair's
sale) verified against a real database to sum exactly once each, with CSV export and both
dashboards exercised for real.

---

## Set 07 (orders + repairs + statistics): complete

All **9 sprints** done; all **3 modules** built and wired (16 files total: orders 6, repairs 5,
statistics 5); no prerequisites sprint needed, no schema migration, no contract change. Every
route uses a `*_ROUTES` constant; every response goes through `sendSuccess` or streams a
`Buffer`/CSV `ExportResult`. Full unit suite: 591/591. Full integration suite: 129/131 (the 2
remaining failures are pre-existing purchasing concurrency tests, unrelated to this set).

A handful of genuine cross-cutting findings emerged along the way, each documented in its own
sprint report rather than silently fixed or silently skipped:
- **Orders** discovered and resolved the "admin has no `Staff` row" gap (`SystemStaffResolver`,
  later shared with repairs) and a real catalog-port reuse opportunity
  (`ICatalogViewerPricingPort`, reusing `getCartProducts` instead of duplicating catalog's
  pricing rule).
- **Repairs** reused that same `SystemStaffResolver`, refactoring `orders.service.ts` in the
  process rather than duplicating the bootstrap a second time — verified behavior-preserving
  against orders' own full test suite.
- **Statistics**, the least contract-specified of the three, required nine documented
  inferences (chart granularity, `TOP_PRODUCTS`' shape — entirely unspecified anywhere in the
  contract — "category" read as `Product.family`, an ageing-bucket strategy, etc.), each
  grounded in an existing precedent or sibling-field convention rather than invented from
  nothing.
- Several **test-writing mistakes** (not service defects) were caught by real database
  execution across sprints — guest PICKUP attempted where only DELIVERY is valid, a `??`/`null`
  fixture bug, a margin-gated assertion on a STAFF token, a missing `defaultSalePrice` on a
  shared product fixture, and a forgotten delivery fee in a hand-computed expectation — each
  fixed at the test layer once traced to its root cause, never by loosening the service's own
  behavior to make a wrong assertion pass.
