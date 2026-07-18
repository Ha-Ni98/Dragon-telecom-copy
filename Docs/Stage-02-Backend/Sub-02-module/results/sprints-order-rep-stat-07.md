# Stage 02 · Sub-02 — Orders + Repairs + Statistics Module Sprint Plan (set 07)

Decomposes [`plan-order-rep-stat.md`](./plan-order-rep-stat.md) into dependency-ordered sprints.
Order obeys the phase rule **foundation (mapper/interface) → logic (service/listener) → API
(controller/wiring)**, per module. **No code in this document.**

Standing rules carried through: contract governs WHICH (nothing re-declared that already exists —
plan §0), rules govern HOW, phase file WHAT/WHEN. The §C/§D resolutions are treated as accepted
(C-1 repairs intake-history creator anchor, C-2 orders `payment.clientRecorded` absolute mirror,
C-3 `order.confirmed` resolves `posClientId` via `Client.posClientId`, C-4 statistics reads stored
document rows, D-1…D-7). Commit style: `git add .` + short `scope: sprint N — topic`, **no
`Co-Authored-By`**. Commit each sprint **on green**.

**No prerequisites sprint (contrast set 06).** Plan §0 confirms every route/DTO/command/query/enum/
event already exists in `@dragon-telecom/contract`, `DocType.ORDER`/`REPAIR` and every needed
`MovementType` are present, and **no `schema.prisma` migration is required** (`Order`, `Repair`,
`RepairPart`, `RepairStatusHistory` all pre-exist). So set 07 opens directly on module Sprint 1.

---

## Sprint sequence & rationale

| # | Sprint | Module · Layer | Why separate / ordered here |
|---|---|---|---|
| 1 | Orders — Foundation | orders · foundation | Factories, pure `orders.mapper.ts`, `IOrdersService`, mapper unit tests. No DB writes. |
| 2 | Orders — Logic | orders · logic | `OrdersService` + `OrdersListener`; place/confirm (in-tx reserve/FIFO/sequence) / status machine / admin cancel+return; emits 5 events + handles `payment.clientRecorded`; unit tests (mock Prisma + fake injected services + spy bus). |
| 3 | Orders — API | orders · api | Controller, `orders.routes.ts` composition root, wiring into `modules/index.ts`, integration + conformance (end-to-end place→confirm→ORDER invoice via the dormant billing listener). |
| 4 | Repairs — Foundation | repairs · foundation | Factories, pure `repairs.mapper.ts`, `IRepairsService`, mapper unit tests. |
| 5 | Repairs — Logic | repairs · logic | `RepairsService` (**no listener** — repairs listens to nothing); intake(+history row)/parts/transitions; emits `repair.pickedUp`/`statusChanged`/`cancelled`; unit tests. |
| 6 | Repairs — API | repairs · api | Controller, `repairs.routes.ts`, wiring, integration (incl. pickup → REPAIR-origin sale via the dormant sales listener) + conformance. |
| 7 | Statistics — Foundation | statistics · foundation | Thin `statistics.mapper.ts` (row shapers only, §D-6), `IStatisticsService`, mapper unit tests. No new factories (reuses existing + seeds data). |
| 8 | Statistics — Logic | statistics · logic | `StatisticsService` (Prisma-only, no bus/injected services); dashboards/overview/filtered/charts/top-products/reports + CSV; stored-figure reads per §C-4; unit tests. |
| 9 | Statistics — API | statistics · api | Controller (JSON via `sendSuccess`, CSV streams), `statistics.routes.ts`, wiring, integration + conformance. |

**Build order** — orders (1-3) and repairs (4-6) precede statistics (7-9) **deliberately**:
statistics reads the stored `Order`/`Sale`(REPAIR-origin) rows those modules produce, so Sprint 8/9
can be exercised against real end-to-end data (a confirmed order, a picked-up repair's sale) rather
than only hand-seeded rows — the same "consumer follows producer" rationale set 06 used for
billing-after-sales.

**Cross-module reuse (do not re-implement):** orders/repairs reuse the inventory injected engine
(`reserve`/`release`/`consumeFifo`/`returnIn`/`flushEvents`, `MovementRef`, post-commit flush seam)
exactly as inventory documented, and take `sequenceService` (`DocType.ORDER`/`REPAIR`) + (orders
only) `deliveryFeeService` — same direct-sibling-import DI as sets 05/06. `returnIn` restock
reconstructs original `ConsumptionLine[]` from `StockMovement`/`StockMovementConsumption` by
`referenceId`, mirroring `sales.service.buildOriginalConsumptions` (§D-7). No module imports another
module's folder; cross-module data is reached only via injected ports, contract event payloads, or
pure reads of the shared `prisma` singleton (§D-4).

**Prisma:** no schema migration — every model pre-exists (plan §0). No contract change either
(contrast set 06's `DocType` additions).

---

### Sprint 1: Orders — Foundation (mapper, interface, factories)   — Status: ✅ Done

**Goals**
- Pure `orders.mapper.ts`, `IOrdersService`, factories, with mapper unit tests. No service logic.

**Tasks**
- [x] Impl: `src/modules/orders/orders.mapper.ts` — `toOrderDto(order, ctx, { includeMargins })` (**margin-gated**: omit `costOfGoods`/`profit` when `includeMargins===false`, both `.optional()` so omission still parses; admin keeps them; `wilaya`/`commune`/`address` present only for delivery orders — PICKUP omits all three; `subtotal = resolvedPrice×quantity`; `deliveryFee`/`totalAmount`/`paidAmount` from the row; `canBeCancelled = status===PENDING`; `ageHours = (now − placedAt)/3600000`; surface **both** `resolvedPrice` and `unitPrice`), `toStatsDto(counts)` (`groupBy status` roll-up → the seven `.min(0)` fields, defaulting missing statuses to 0), `toPersistencePlace(cmd, ctx)` (`status:PENDING`, `resolvedPrice=ctx.resolvedPrice` **and** `unitPrice=resolvedPrice` frozen equal, `productNameSnapshot=ctx.productName`, `deliveryFee=ctx.fee`, computed `subtotal`/`totalAmount`, `paidAmount:0`, delivery fields only for delivery orders, `contactName`/`contactPhone` from `contact`, `reference=ctx.reference`, `clientId` from resolved auth/null for guest). Each ends `OrderResponseSchema.parse(dto)`; field-listing (never spreads the entity — `confirmedByStaffId`/`cancellationReason` stay out); private `toMoney` (`Decimal→number`); `Date→ISO`; Prisma enum → contract enum cast; reuse the `serializeSerials`/`parseSerials` comma-string↔array helpers from the sales precedent for `Order.serialNumbers`. (plan §I.1)
- [x] Impl: `src/modules/orders/orders.interface.ts` — `IOrdersService` (all methods from plan §I.2, returning contract DTOs; actor threaded as the contract's own `JWTPayload`, which carries `type`/`clientId`/`staffId`, rather than a hand-rolled subset; guest PLACE passes an **absent** actor; listener-only `applyClientPaymentRecorded(payload: BillingEvents['payment.clientRecorded'])`). (plan §I.2)
- [x] Impl: factories — `test/data/order.factory.ts` (`makeOrder` + `seedOrder` DB helper for later integration sprints), `place-order.factory.ts` (`makePlaceOrderCommand`, PICKUP / DELIVERY_HOME / DELIVERY_OFFICE variants), `payment-client-recorded.factory.ts` (event payload builder, not schema-validated); reuse existing `makeProduct`/`makeClient`/`makeWilaya`/`makeCommune`/`makeStaff`. (plan §I.3)
- [x] Test: `test/unit/modules/orders/orders.mapper.spec.ts` (23 tests) — staff mapping omits `costOfGoods`/`profit`, admin keeps them (and also omits pre-confirm when the columns are null); PICKUP omits `wilaya`/`commune`/`address` and fee is 0; `ageHours`/`canBeCancelled` derivation; `resolvedPrice`≠`unitPrice` both surfaced; `serialNumbers` comma-string→array parse direction; `.parse` never throws on valid input. See [report-sprint-01-07.md](./results-order-rep-stat-07/report-sprint-01-07.md) for the `note`-column gap (flagged, not fixed — no schema migration this set).

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (mapper + conformance) — 504/504, 35 files. (`test:int` N/A this sprint — no route wired yet.)
- [x] Mapper pure/field-listing, excludes margins when gated, returns contract DTOs only; no route/DTO/enum re-declared (plan §0).
- [x] Committed on green (`orders: sprint 1 — foundation (mapper, interface, factories)`).

---

### Sprint 2: Orders — Logic (service + listener)   — Status: ✅ Done

**Goals**
- `OrdersService implements IOrdersService` + `OrdersListener`; all plan §I.2 business logic; emits
  the five order events + handles `payment.clientRecorded`; unit tests with mock Prisma + fake
  injected services + spy bus.

**Tasks**
- [x] Impl: `src/modules/orders/orders.service.ts` — constructor DI `(prisma, deliveryFee: IDeliveryFeeService, inventory: IInventoryService, sequence: ISequenceService, catalogPricing: ICatalogViewerPricingPort)` — a fourth injected port discovered mid-sprint (see [report-sprint-02-07.md](./results-order-rep-stat-07/report-sprint-02-07.md) gap #1: reuses catalog's already-public `getCartProducts`, same shape as clients' `ICatalogCartPort`, instead of a "direct read" duplicating catalog's own tier/guestPrice rule):
  - **`placeOrder`** — one `prisma.$transaction` then `inventory.flushEvents(tx)`: resolve viewer price server-side via a **direct** `Product`/`ProductPrice` read (guest ⇒ `guestPrice` must exist else `ForbiddenError` `'GUEST_PRICE_HIDDEN'` 403, §D-4; PICKUP ⇒ client token else `BadRequestError` 400; authed `cmd.clientId` must equal `actor.clientId` else `ForbiddenError` 403, §D-2) → `deliveryFee.resolve(wilayaId, communeId, mode)` for delivery (PICKUP ⇒ fee 0, delivery block already rejected by `PlaceOrderSchema`) → `sequence.nextNumber(tx, DocType.ORDER)` → `inventory.reserve(tx, productId, qty, {referenceType:'ORDER', referenceId: order.id, staffId})` → create PENDING order (`resolvedPrice=unitPrice` frozen). **Stock conflict ⇒ 409, nothing written** (reserve throws inside tx ⇒ rollback). After commit: `flushEvents(tx)`; emit `order.placed { orderId, clientId? }`.
  - **`cancelMyOrder`** — own + `status===PENDING` only (else `ForbiddenError`/`ConflictError`); `inventory.release(...)`; `CANCELLED`/`cancelledAt`; commit → `flushEvents` → emit `order.cancelled { orderId }`.
  - **`confirmOrder`** — one `$transaction`, **idempotent**: reload; if already `CONFIRMED`+ return the existing DTO with **no** re-consume / no duplicate emit; else optional `unitPrice` adjust (**`resolvedPrice` untouched**) → `inventory.release(...)` the reservation + `inventory.consumeFifo(tx, productId, qty, revenue=unitPrice×qty, MovementType.ORDER_OUT, ref)` → store returned `costOfGoods`/`profit`; `CONFIRMED`, `confirmedAt`, `confirmedByStaffId=actor.staffId`, optional `paidAmount`. Loud **409** on FIFO shortfall (order stays PENDING, no event). **No `Sale` row.** After commit: `flushEvents`; resolve `posClientId` via `Client.findUnique({ where:{id: order.clientId}, select:{posClientId:true} })` (§C-3); emit `order.confirmed { orderId, clientId?, posClientId?, snapshotLine{productId,productName,quantity,unitPrice,lineTotal}, totals{subtotal,deliveryFee,totalAmount,paidAmount}, confirmedByStaffId }`.
  - **`updateStatus`** — forward-only ≤ COMPLETED (`PENDING→CONFIRMED→PACKAGED→IN_DELIVERY→COMPLETED`): `IN_DELIVERY` requires `deliveryCompany`+`trackingNumber` (400 otherwise); `COMPLETED` sets `deliveredAt`; reject any backward/skip/beyond-COMPLETED (400). **Staff may perform every forward transition.** Emit `order.statusChanged { orderId, fromStatus, toStatus }`.
  - **`cancelOrder`** (admin) — any pre-COMPLETED state; `release` if still reserved; `CANCELLED` + `cancellationReason?`; emit `order.cancelled { orderId, reason? }`. **`returnOrder`** (admin) — from COMPLETED only; `restock ⇒ inventory.returnIn(tx, originalConsumptions(order.id), qty, ref)` at consumed cost (reconstruct per §D-7); `RETURNED`; emit `order.returned { orderId, refundAmount }`.
  - `getStats` (`groupBy status` counts → `toStatsDto`), `listMyOrders` (scope `clientId=me`), `listBackoffice` (staff==admin data — **no** staff scoping; margins gated per `actor.type`, §D-3).
- [x] Impl: `src/modules/orders/orders.listener.ts` — injects `IOrdersService`, `setup()` subscribes **`payment.clientRecorded`** → `applyClientPaymentRecorded`: resolve `Invoice.findUnique({ where:{number: invoiceNumber}, select:{sourceType, sourceId, paidAmount} })`, act only when `sourceType===InvoiceSource.ORDER`, set `Order.paidAmount = invoice.paidAmount` (**absolute mirror** ⇒ replay- and listener-order-safe, §C-2); `safeRun` guard (a throw never re-enters `eventBus.emit`).
- [x] Test: `test/unit/modules/orders/orders.service.spec.ts` (30 tests) — guest null-`guestPrice` → 403 `GUEST_PRICE_HIDDEN`; guest PICKUP → 400; `cmd.clientId` mismatch with token → 403; fee 0 for pickup; reserve→release→consume invariants; **double confirm ⇒ one `consumeFifo`, one `order.confirmed`** (second call returns existing, no extra bus/inventory calls); FIFO shortfall → propagated conflict, order stays PENDING, **no event**; forward-only status (reject backward + skip + terminal-state; `IN_DELIVERY` without company/tracking → 400); RETURNED `restock` calls `returnIn` with the reconstructed at-cost consumption, non-restock doesn't; `order.confirmed` carries the resolved `posClientId` when the client has one, omits it for guests.
- [x] Test: `test/unit/modules/orders/orders.listener.spec.ts` (4 tests) — `payment.clientRecorded` for an ORDER invoice mirrors `Order.paidAmount`; a non-ORDER invoice is ignored; **replay ⇒ identical result** (absolute set, two sequential `eventBus.emit`); a handler throw is swallowed. See [report-sprint-02-07.md](./results-order-rep-stat-07/report-sprint-02-07.md) for two more genuine gaps found+resolved (no natural `Staff` row for guest/admin-less stock movements → lazily-bootstrapped "system" staff; `ReturnOrderCommand.reason` has no persistence column → flagged, not fixed).

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (service + listener + conformance) — 538/538, 37 files.
- [x] Events emitted **post-commit**; injected engine reused (no re-implementation); `flushEvents(tx)` after every `$transaction`; listener idempotent (absolute mirror); no cross-module folder import (only `IInventoryService`/`ISequenceService`/`IDeliveryFeeService`/`ICatalogViewerPricingPort`/`ConsumptionLine` types + pure `Client`/`Invoice` reads via shared `prisma`, §D-4).
- [x] Committed on green (`orders: sprint 2 — logic (service + listener)`).

---

### Sprint 3: Orders — API (controller, routes, wiring, integration)   — Status: ✅ Done

**Goals**
- HTTP surface + composition root + aggregator wiring; integration (incl. end-to-end
  place→confirm→ORDER invoice) & conformance green.

**Tasks**
- [x] Impl: `src/modules/orders/orders.controller.ts` — thin (`try/catch → next`, reads `req.validated`, `sendSuccess` `201` place / `200` others); arrow-method fields. Reads `req.user` which **may be absent** for guest PLACE; the `STAFF_*`/`ADMIN_*` pairs bind the **same** handler, margin/scope decided in the service off the actor (§D-3). (plan §I.2, rules §4)
- [x] Impl: `src/modules/orders/orders.routes.ts` — composition root: `new OrdersService(prisma, deliveryFeeService, inventoryService, sequenceService, catalogProductService)` (four ports — `catalogProductService` for the Sprint-2-discovered `ICatalogViewerPricingPort`, structural match confirmed by a clean `tsc`); `new OrdersController(service)`; `new OrdersListener(service).setup()`. Routes use `ORDER_ROUTES` constants only, per-segment `validateRequest`, guards per plan §I.2 table (`PLACE → requireAuth({optional:true})`; `MY_LIST`/`MY_CANCEL → types:[CLIENT]`; `STAFF_* → pages:[STAFF_ORDERS]`; `ADMIN_*`/`CANCEL`/`RETURN → types:[ADMIN], checkDB`). `STAFF_STATS`/`ADMIN_STATS` registered before the confirm/status/cancel/return routes (specific-before-parametric discipline, though no genuine collision exists — every STATS route is GET, its siblings POST/PATCH). `CANCEL` validates only `reason?` via a minimal inline `z.object({ reason: z.string().optional() })` — no new contract schema (plan §I.2 footnote). (plan §I.2, §D-1/§D-2)
- [x] Impl: wired into `src/modules/index.ts` — direct import of `ordersRouter`; `apiRouter.use(ordersRouter)` at the `EXTENSION POINT (modules)`, after `billingRouter`. No aggregator adapter. The dormant `billing`/`clients`/`observability` handlers for `order.confirmed`/`order.*` wake automatically.
- [x] Test: `test/integration/orders.integration.spec.ts` (real test DB, `ApiResponse` envelope, **12 tests**) — guest vs client PLACE auth (guest PICKUP → 400; guest DELIVERY ok only when a guest price exists; client `clientId` mismatch → 403); **place→confirm end-to-end** (real FIFO stock drop via a seeded layer, `order.confirmed` fires, the dormant billing listener issues **one** ORDER invoice — polled via `waitFor` — and `PosClient.totalSold` bumps for a client that has a `posClientId`); **double confirm ⇒ one invoice**; status forward to COMPLETED (backward/`IN_DELIVERY`-without-tracking rejected); **staff cancel → 403, staff return → 403** (route gate), admin cancel/return ok with a real `RETURN_IN` restock movement; backoffice list — staff and admin see the same rows; `STAFF_STATS` counts; `payment.clientRecorded` → `Order.paidAmount` mirrored end-to-end (emit-then-replay, since orders' and billing's listeners race independently on a single emission — see [report-sprint-03-07.md](./results-order-rep-stat-07/report-sprint-03-07.md) gap #4). Two genuine bugs found+fixed along the way: `resolveSystemStaffId`'s cache went stale across `resetDatabase()` (gap #1, a real correctness fix, not test-only) and a test-fixture `??`/`null` bug (gap #3).
- [x] Test: `test/contract/routes.conformance.spec.ts` — added an `orders route resolution` block (13 cases); every `ORDER_ROUTES` path resolves DB-free (12/12 conformance tests, up from 11).

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (unit + conformance) — 539/539, 37 files. **Ran `npm run test:int`** against the reachable Postgres test DB — orders' own suite: **12/12**, run twice to confirm no flakiness. Full `test/integration`: 118/121 — the 3 remaining failures are pre-existing purchasing/billing concurrency tests, unrelated to this sprint (same characteristic set 06 already documented).
- [x] Routes use `ORDER_ROUTES` constants only; JSON via `sendSuccess`; mapper excludes margins when gated.
- [x] Committed on green (`orders: sprint 3 — api and wiring`).

---

### Sprint 4: Repairs — Foundation (mapper, interface, factories)   — Status: ✅ Done

**Goals**
- Pure `repairs.mapper.ts`, `IRepairsService`, factories, with mapper unit tests. No service logic.

**Tasks**
- [x] Impl: `src/modules/repairs/repairs.mapper.ts` — `toRepairDto(repair, parts, history, ctx, { includeMargins })` (**margin-gated**: omit `totalCost`/`totalProfit` and each part's `costOfGoods`/`profit` when staff; `device = { brand?{id,name}, model?{id,name}, label?, imei? }` inlined refs; `reportedIssues` = `String[]` cast to `ReportedIssue[]`; `technician?{id,name}`; `parts[]` from `RepairPart`; `history[]` from `RepairStatusHistory` with `staffName` from the joined `Staff`; per §C-1/§D-1 filter the synthetic `INTAKE→INTAKE` intake row out of the surfaced `history` unless the team keeps it as "ticket opened by X"; `ageHours` derived), `toPersistenceIntake(cmd, ctx)` (`status:INTAKE`, `reference=ctx.reference`, `labourPrice:0`, totals 0, prefill `customerName`/`customerPhone` from an attached `PosClient` when `posClientId` given, BL#1), `toPartCreateInput(cmd, ctx)` (`productNameSnapshot=ctx.productName`, `lineTotal=unitPrice×quantity`, cost/profit null until COMPLETED). Each ends `RepairResponseSchema.parse(dto)`; field-listing; `toMoney`; `Date→ISO`; enum casts. (plan §II.1)
- [x] Impl: `src/modules/repairs/repairs.interface.ts` — `IRepairsService` (all methods from plan §II.2, returning contract DTOs; actor threaded as `JWTPayload`; **no** listener-only method — repairs listens to nothing). `listRepairs`'s plan-hedged return type resolved concretely to plain `RepairDto[]` — `RepairListQuerySchema` has no page/limit fields (see [report-sprint-04-07.md](./results-order-rep-stat-07/report-sprint-04-07.md)). (plan §II.2)
- [x] Impl: factories — `test/data/repair.factory.ts` (`makeRepair` + `seedRepair` DB helper), `create-repair.factory.ts` (`makeCreateRepairCommand`), `repair-part.factory.ts` (`makeRepairPart`). `Repair` has no required FK relations at all, so `seedRepair` needs no brand/technician/posClient setup unless a test wants one.
- [x] Test: `test/unit/modules/repairs/repairs.mapper.spec.ts` (15 tests) — device ref assembly (brand/model/label/imei optionals); margin gating on `totalCost`/`totalProfit` + part `costOfGoods`/`profit` (incl. admin-but-not-yet-completed omission); `history` `staffName` join, intake row **kept** (reads as "ticket opened by X"); `reportedIssues` cast; `.parse` never throws.

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (mapper + conformance) — 554/554, 38 files.
- [x] Mapper pure/field-listing, margin-gated, returns contract DTOs only; no re-declared contract types.
- [x] Committed on green (`repairs: sprint 4 — foundation (mapper, interface, factories)`).

---

### Sprint 5: Repairs — Logic (service)   — Status: ✅ Done

**Goals**
- `RepairsService implements IRepairsService` (**no listener**); all plan §II.2 business logic;
  emits `repair.pickedUp`/`statusChanged`/`cancelled`; unit tests with mock Prisma + fake inventory
  + spy bus.

**Tasks**
- [x] Impl: `src/modules/repairs/repairs.service.ts` — constructor DI `(prisma, inventory: IInventoryService, sequence: ISequenceService)`:
  - **`createRepair`** (intake) — one `$transaction`: `sequence.nextNumber(tx, DocType.REPAIR)` → create `Repair` (INTAKE) → **write the intake `RepairStatusHistory` row** (`fromStatus:INTAKE`, `toStatus:INTAKE`, `staffId`, `note:'intake'`) for §C-1 scoping and downstream staff-resolution; prefill from `PosClient` when `posClientId`. Returns the DTO (claim slip = its `reference`).
  - **`addPart`** — `inventory.reserve(tx, productId, qty, {referenceType:'REPAIR', referenceId: repair.id, staffId})` (shortfall ⇒ **409 naming the product**) + create `RepairPart`; recompute `partsTotal` and `totalAmount = labourPrice + partsTotal`. **`removePart`** — `inventory.release(...)` + remove the part; recompute totals.
  - **`updateRepair`** (PATCH) — `diagnosis?`/`labourPrice?`/`technicianId?`; recompute `totalAmount` when `labourPrice` changes.
  - **`changeStatus`** — writes a `RepairStatusHistory` row + emits per transition:
    - `INTAKE→PROCESSING`: **`technicianId` required (400)**.
    - `PROCESSING→COMPLETED` (**idempotent** — re-COMPLETE is a no-op, one consumption): per part `inventory.release` its reservation + `inventory.consumeFifo(tx, productId, qty, revenue=unitPrice×qty, MovementType.REPAIR_CONSUMPTION, ref)` → store part `costOfGoods`/`profit`, roll up `Repair.totalCost`/`totalProfit`; `completedAt`.
    - `COMPLETED→PICKED_UP`: cash `paidAmount`, `pickedUpAt`; after commit emit `repair.pickedUp { repairId, posClientId?, totalAmount, paidAmount, totalCost, totalProfit, snapshotParts[…full costed lines…], labourPrice }`. **`Repair.saleId` back-link is written by the sales listener, not here.**
    - `→CANCELLED` (from any state, `reason?`): `release` **pending** parts; **already-consumed** parts return **only** via explicit `cmd.consumedPartReturns[]` (`restock ⇒ inventory.returnIn` at consumed cost, reconstruct per §D-7). Emit `repair.cancelled { repairId, reason? }`.
    - Every transition also emits `repair.statusChanged { repairId, fromStatus, toStatus }`; `flushEvents(tx)` after commit for any transition that touched stock.
  - **`listRepairs`** — admin: all; staff: `history: { some: { fromStatus:INTAKE, toStatus:INTAKE, staffId: me } }` (§C-1) + optional `status`/`technicianId` filters. Mutations are page-gated only, **not** creator-scoped (§D-5).
- [x] Impl: **no `repairs.listener.ts`** — repairs listens to nothing (rules §2 file-only-if-needed).
- [x] Test: `test/unit/modules/repairs/repairs.service.spec.ts` (15 tests) — `PROCESSING` without `technicianId` → 400; part add reserves / delete releases (shortfall propagates the injected engine's own `ConflictError`); **double COMPLETE ⇒ one consumption**; pickup emits `repair.pickedUp` **once** (spy bus); cancel post-consumption **without** `consumedPartReturns` leaves stock untouched, **with** `restock` re-enters at consumed cost via `returnIn`; totals (`partsTotal`, `totalAmount = labour+parts`) recomputed on every parts/labour change; intake writes the `INTAKE→INTAKE` history row; staff `listRepairs` filter derives created-by-me from that row. See [report-sprint-05-07.md](./results-order-rep-stat-07/report-sprint-05-07.md) for two design decisions: `createRepair` takes the full `actor` (not a bare `staffId`, plan deviation) and CANCELLED is rejected from `PICKED_UP` (spec says "any state," read as "any pre-pickup state").

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (service + conformance) — 569/569, 39 files.
- [x] Events emitted **post-commit**; injected engine reused (no re-implementation); `flushEvents(tx)` after stock-touching transactions; COMPLETE genuinely idempotent; no cross-module folder import (only `IInventoryService`/`ISequenceService`/`ConsumptionLine` + the new shared `@common/utils/system-staff.utils` — extracted from orders' Sprint 2 discovery rather than duplicated; `orders.service.ts` refactored to use it too, orders' full unit (54/54) + integration (12/12) suites re-verified green).
- [x] Committed on green (`repairs: sprint 5 — logic (service)`).

---

### Sprint 6: Repairs — API (controller, routes, wiring, integration)   — Status: ✅ Done

**Goals**
- HTTP surface + composition root + aggregator wiring; integration (incl. pickup → REPAIR-origin
  sale) & conformance green.

**Tasks**
- [x] Impl: `src/modules/repairs/repairs.controller.ts` — thin; acting user from `req.user!`; `sendSuccess` `201` create/addPart / `200` others (`removePart` returns `200` with the updated `RepairDto`, not `204` — a real body is returned); `STAFF_*`/`ADMIN_*` pairs share one handler each. (plan §II.2)
- [x] Impl: `src/modules/repairs/repairs.routes.ts` — composition root: `new RepairsService(prisma, inventoryService, sequenceService)`; `new RepairsController(service)`; **no listener**. Routes use `REPAIR_ROUTES` constants only, per-segment `validateRequest`, guards per plan §II.2 table (`STAFF_* → pages:[STAFF_REPAIRS]`, `ADMIN_* → types:[ADMIN], checkDB`). (plan §II.2, §D-1/§D-5)
- [x] Impl: wired into `src/modules/index.ts` — direct import of `repairsRouter`; `apiRouter.use(repairsRouter)` at the EXTENSION POINT. The dormant `sales` (`repair.pickedUp`) and `observability` handlers wake automatically.
- [x] Test: `test/integration/repairs.integration.spec.ts` (real test DB, envelope, **5 tests**) — intake→add parts→PROCESSING (technician required)→COMPLETED (real FIFO drop, part cost/profit stored)→PICKED_UP; **`repair.pickedUp` → exactly one REPAIR-origin `Sale`** created by the dormant sales listener with `Repair.saleId` set (polled via `waitFor`), and **no invoice** issued; **staff sees only tickets he created, admin all** (leak test); cancel-from-PROCESSING auto-releases; cancel post-COMPLETED with `restock` re-enters stock at consumed cost, without it leaves stock untouched. A test-writing mistake (asserting `totalCost` on a STAFF response, which correctly omits margins) was caught and fixed — see [report-sprint-06-07.md](./results-order-rep-stat-07/report-sprint-06-07.md).
- [x] Test: `test/contract/routes.conformance.spec.ts` — added a `repairs route resolution` block (12 cases); every `REPAIR_ROUTES` path resolves DB-free (13/13 conformance tests, up from 12).

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (unit + conformance) — 570/570, 39 files. **Ran `npm run test:int`** (DB reachable) — repairs' own suite: **5/5**, run twice to confirm no flakiness. Full `test/integration`: 123/126 — the 3 remaining failures are pre-existing `purchasing.integration.spec.ts` concurrency tests, unrelated to this sprint.
- [x] Routes use `REPAIR_ROUTES` constants only; JSON via `sendSuccess`; mapper excludes margins when gated; no repair invoice ever created.
- [x] Committed on green (`repairs: sprint 6 — api and wiring`).

---

### Sprint 7: Statistics — Foundation (mapper, interface)   — Status: ✅ Done

**Goals**
- Thin `statistics.mapper.ts` (row shapers only, §D-6) + `IStatisticsService`, with mapper unit
  tests. No new factories (statistics writes nothing — it reuses existing factories/seeds).

**Tasks**
- [x] Impl: `src/modules/statistics/statistics.mapper.ts` — the repeatable row shapers only, each ending in the matching `…ResponseSchema.parse(...)`: `toDashboardOrderSummary`, `toDashboardClientSummary`, `toLowStockItem` (`availableQuantity = quantityOnHand − quantityReserved`, `reorderThreshold` from `Product`), `toReportDto({ chart, rows, totals, drill })`, plus `toOverviewDto`/`toFilteredDto`/`toStaffDashboardDto`/`toAdminDashboardDto` assembling their aggregate inputs into the contract shape. `Decimal→number`, `Date→ISO`. Query composition stays in the service (§D-6). Two genuine, undocumented contract gaps found+resolved: `CHARTS` has no dedicated schema (reused `ReportResponseSchema.shape.chart` rather than redeclaring it) and `TOP_PRODUCTS` has no shape at all (a local, flagged `TopProductResponseSchema`) — see [report-sprint-07-07.md](./results-order-rep-stat-07/report-sprint-07-07.md). (plan §III.1)
- [x] Impl: `src/modules/statistics/statistics.interface.ts` — `IStatisticsService` (all methods from plan §III.2, returning contract DTOs; `getReport` returns `ReportDto | ExportResult`, reusing the `{ filename; mime; body }` `ExportResult` shape from the inventory/platform precedent for `format=csv`; `getStaffDashboard(staffId)` scoped to self). (plan §III.2)
- [x] Test: `test/unit/modules/statistics/statistics.mapper.spec.ts` (12 tests) — `toLowStockItem` computes `availableQuantity` and carries `reorderThreshold`; dashboard summaries shape correctly; `toReportDto` preserves `drill { entity, idField }`; `Decimal→number`/`Date→ISO`; `.parse` never throws across `Overview`/`Filtered`/`Report`/`AdminDashboard`/`StaffDashboard`.

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (mapper + conformance) — 582/582, 40 files.
- [x] Mapper thin/pure, returns contract DTOs only; no bus/injected-service dependency introduced; no re-declared contract types.
- [x] Committed on green (`statistics: sprint 7 — foundation (mapper, interface)`).

---

### Sprint 8: Statistics — Logic (service)   — Status: ✅ Done

**Goals**
- `StatisticsService implements IStatisticsService` (**Prisma-only** — no injected services, no
  event bus, no writes); all plan §III.2 aggregation logic over **stored** rows (§C-4); unit tests
  with a seeded/mock Prisma.

**Tasks**
- [x] Impl: `src/modules/statistics/statistics.service.ts` — constructor DI `(prisma)`:
  - **Revenue/profit** = `Σ` COMPLETED `Sale` rows (origins **POS + REPAIR**) + CONFIRMED-and-later `Order` rows (`Order.profit`/`costOfGoods`). **Never** sum `Repair` rows and **never** use the zeroed ORDER-invoice cost (§C-4) — guarantees "repair sale counted once" + "no FIFO drift".
  - `getOverview` — `totalRevenue`/`totalProfit` (above), `stockValue = Σ quantityOnHand × averageCost` (`Product`), `totalClientCredit = Σ PosClient.credit`, `totalSupplierCredit = Σ` supplier outstanding.
  - `getFiltered` — window `[from,to]` vs the immediately-preceding **equal-length** window; `*ChangePct` guarded against an **empty previous period** ⇒ 0 (never divide-by-zero).
  - `getChart` (`revenue`|`orders`|`clients`|`sales-by-family`), `getTopProducts(period)`.
  - `getReport(type, query)` — the nine `ReportType`s; `sales-by-category`/`by-seller` expose the discount column `Σ (resolvedPrice − unitPrice) × qty`; `stock-movements` totals per `MovementType` (large `ADJUSTMENT_OUT` flagged); `ageing` buckets client (`PosClient.credit`) + supplier credit by document age; `client-browsing` joins observability `StaffSearchLog`/`ClientActivityLog` (top searches, most-viewed products with zero purchases); every row carries `drill { entity, idField }`; **`format=csv` returns an `ExportResult` streaming the same `rows`**.
  - `getAdminDashboard` — `stats` + `*ChangePct` (period comparison, empty-previous guarded), pending/recent orders+clients, low stock, `repairsByStatus` (`groupBy` map keyed by `RepairStatus` value), `draftSalesByStaff`. `getStaffDashboard(staffId)` — **strictly `staffId = me`**: `mySalesToday` (count) + `myRevenueToday`, `myDrafts`, `myPendingOrdersCount?`, low-stock (read-only alert — the only non-scoped datum).
  - Use Prisma `groupBy`/`aggregate`/`count` (rules §5 "Use `select` for needed fields"); no recomputation of FIFO or figures.
- [x] Impl: **no listener** (contract exports no `StatisticsEvents`).
- [x] Test: `test/unit/modules/statistics/statistics.service.spec.ts` (20 tests) — `profit = Σ stored line profits` (no FIFO drift vs a hand-computed expectation); period-comparison math incl. **empty previous period** ⇒ 0; **repair sale counted once** (never reads the `Repair` table for money at all); discount column matches overrides; `stockValue` formula; **staff-dashboard leak test** (nothing global except `myPendingOrdersCount`/low stock, both documented exceptions); CSV `rows` shape == JSON `rows`. See [report-sprint-08-07.md](./results-order-rep-stat-07/report-sprint-08-07.md) for 9 documented inferences this unusually under-specified module required (chart granularity, TOP_PRODUCTS period parsing, "category"=Family, ageing bucketing, etc.).

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (service + conformance) — 590/590, 41 files.
- [x] Service is read-only (no writes, no emits); reads **stored** figures only (§C-4); returns DTOs that `.parse`; no cross-module folder import (pure reads via shared `prisma`).
- [x] Committed on green (`statistics: sprint 8 — logic (service)`).

---

### Sprint 9: Statistics — API (controller, routes, wiring, integration)   — Status: ✅ Done

**Goals**
- HTTP surface + composition root + aggregator wiring; integration + conformance green.

**Tasks**
- [x] Impl: `src/modules/statistics/statistics.controller.ts` — thin; JSON via `sendSuccess`; `getStaffDashboard` reads `req.user!.staffId` (**never** a query param); **CSV branch** — when the service returns an `ExportResult`, set `Content-Type`/`Content-Disposition` and stream the body instead of `sendSuccess` (inventory/billing export precedent, §III.2). (plan §III.2)
- [x] Impl: `src/modules/statistics/statistics.routes.ts` — composition root: `new StatisticsService(prisma)`; `new StatisticsController(service)`; **no listener**. Routes use `STATS_ROUTES` constants only, per-segment `validateRequest`, guards per plan §III.2 table (`STAFF_DASHBOARD → types:[STAFF]`; every other route `types:[ADMIN], checkDB`). (plan §III.2, §D-1)
- [x] Impl: wired into `src/modules/index.ts` — direct import of `statisticsRouter`; `apiRouter.use(statisticsRouter)` at the EXTENSION POINT (the last module in set 07). No listener, no adapter.
- [x] Test: `test/integration/statistics.integration.spec.ts` (real test DB, envelope, **5 tests**) — a real confirmed order + a real picked-up repair's REPAIR-origin sale, `OVERVIEW` revenue+profit counted each **once** (cross-checked via a direct `Sale`+`Order` aggregate); `REPORT?format=csv` streams the exact same row count as the JSON `rows`; **admin-vs-staff auth** (staff 403s every admin-only STATS route; `STAFF_DASHBOARD` leak test); `stockValue` reflects seeded `Product` state. Two test-writing bugs (not service defects) caught by real execution — a shared product fixture missing `defaultSalePrice`, and a forgotten delivery fee in a hand-computed expectation — see [report-sprint-09-07.md](./results-order-rep-stat-07/report-sprint-09-07.md).
- [x] Test: `test/contract/routes.conformance.spec.ts` — added a `statistics route resolution` block (7 cases); every `STATS_ROUTES` path resolves DB-free (14/14 conformance tests, up from 13).

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (unit + conformance) — 591/591, 41 files. **Ran `npm run test:int`** (DB reachable) — statistics' own suite: **5/5**, run twice to confirm no flakiness. Full `test/integration`: 129/131 — the 2 remaining failures are pre-existing `purchasing.integration.spec.ts` concurrency tests, unrelated to this sprint.
- [x] Routes use `STATS_ROUTES` constants only; JSON via `sendSuccess`, CSV streams an `ExportResult`; staff dashboard strictly self-scoped.
- [x] Committed on green (`statistics: sprint 9 — api and wiring`).

---

## Definition of done (set 07) — ✅ complete

- **9 sprints** complete; **16 module files** created — orders (6: mapper/interface/service/listener/controller/routes), repairs (5: no listener), statistics (5: no listener) — each router mounted at the `modules/index.ts` extension point via direct sibling import (set-05/06 pattern), no aggregator adapter.
- **No prerequisites sprint, no `schema.prisma` migration, no contract change** — every route/DTO/command/query/enum/event pre-existed (plan §0); `DocType.ORDER`/`REPAIR` and all `MovementType`s reused as-is. The two exceptions (`CHARTS`/`TOP_PRODUCTS` having no dedicated response schema) were resolved with a reused sub-schema and a local, flagged schema respectively — documented in Sprint 7's report, not a contract edit.
- Every service method returns a DTO that `.parse`es against its contract schema; every route uses a `*_ROUTES` constant; every JSON response goes through `sendSuccess`; CSV reports stream an `ExportResult`.
- Unit (591/591, 41 files) + integration (129/131 — 2 pre-existing, unrelated purchasing concurrency failures) + conformance (14/14) green, including every plan §I.3/§II.3/§III.3 scenario: orders — guest/PICKUP/`clientId`-mismatch guards, double-confirm ⇒ one consumption/one `order.confirmed` ⇒ one ORDER invoice, FIFO shortfall propagates, forward-only status, staff cancel/return 403, RETURNED restock, `payment.clientRecorded` paidAmount mirror; repairs — PROCESSING-needs-technician 400, part reserve/release, double-COMPLETE ⇒ one consumption, pickup ⇒ one REPAIR-origin sale + no invoice, created-by-me leak test, cancel-restock at cost; statistics — profit = Σ stored line profits (no FIFO drift), repair sale counted once (verified end-to-end against real data), empty-previous-period math, discount column, staff-dashboard leak test, CSV shape == rows.
- **Integration genuinely executed** against the reachable Postgres test DB (export `.env` DB vars first — memory `test-int-db-access`), every module's own suite run at least twice to confirm no flakiness, not left as "could not verify."
- The plan §C resolutions are exercised by tests: C-1 intake-history creator anchor (repairs leak test), C-2 absolute-mirror idempotency (orders listener emit-then-replay), C-3 `posClientId` resolution (order.confirmed → totalSold bump / Walk-in guest invoice), C-4 stored-figure reads (statistics "counted once", verified end-to-end).
- **Emit-only / read-only discipline held:** orders/repairs call no other module directly (all consumers — billing/clients/sales/observability — were already wired and dormant, woke automatically); statistics only reads. Every genuine gap discovered during execution is recorded in its sprint report with its resolution (9 reports total), per the set-05/06 convention — including the cross-sprint `SystemStaffResolver` extraction (orders → shared with repairs, with `orders.service.ts` refactored and re-verified) and statistics' nine documented inferences for its unusually under-specified spec.
