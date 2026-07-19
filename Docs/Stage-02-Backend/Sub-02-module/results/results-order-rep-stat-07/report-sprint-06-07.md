# Sprint 6 Report — Repairs: API (controller, routes, wiring, integration)

**Set:** 07 (orders + repairs + statistics) · **Module:** repairs · **Layer:** api
**Status:** ✅ Done

---

## What was built

- **`src/modules/repairs/repairs.controller.ts`** — `RepairsController`, thin (`try/catch →
  next`, reads `req.validated`, `sendSuccess` `201` for `createRepair`/`addPart` / `200`
  elsewhere — `removePart` returns `200` with the updated `RepairDto` body, not `204`, since a
  real payload is returned, not an empty one). Every `STAFF_*`/`ADMIN_*` pair binds the same
  handler, scoping/margins decided in the service off the same `req.user!` actor.
- **`src/modules/repairs/repairs.routes.ts`** (composition root) — manual DI:
  `new RepairsService(prisma, inventoryService, sequenceService)`; `new RepairsController
  (service)`; **no listener** (repairs listens to nothing). Every route uses a `REPAIR_ROUTES`
  constant with per-segment `validateRequest`. `STAFF_*` routes use `requireAuth({types:
  [STAFF,ADMIN], pages:[STAFF_REPAIRS], checkDB:true})`; `ADMIN_*` use `requireAuth({types:
  [ADMIN], checkDB:true})` — mutations are page-gated only, never creator-scoped (§D-5; the
  created-by-me restriction applies to `listRepairs` alone, resolved in the service).
- **`src/modules/index.ts`** — wired `repairsRouter` at the `EXTENSION POINT (modules)`, after
  `ordersRouter`. The dormant `sales`/`observability` handlers for `repair.pickedUp`/
  `repair.statusChanged`/`repair.cancelled` wake automatically.
- **`test/integration/repairs.integration.spec.ts`** (5 tests, real Postgres test DB) — full
  lifecycle intake→parts→PROCESSING (technician-required gate)→COMPLETED (real FIFO drop, part
  cost/profit stored — verified via direct DB reads since a STAFF caller's own response
  correctly omits margins, see below)→PICKED_UP, ending in exactly one REPAIR-origin `Sale`
  (polled via `waitFor`) with **zero** invoices ever created for it; cancel-from-PROCESSING
  auto-releases pending parts; cancel-from-COMPLETED leaves stock untouched **without**
  `consumedPartReturns` but restocks at the consumed cost **with** an explicit entry (a real
  `RETURN_IN` movement); staff-scoping leak test (staff B never sees staff A's ticket in
  `STAFF_LIST`; admin sees all).
- **`test/contract/routes.conformance.spec.ts`** — added a "repairs route resolution" block (12
  cases across all 12 `REPAIR_ROUTES` constants), bringing the file's conformance count from 12
  to 13.

## A test-writing mistake caught by the margin gate (not a service defect)

The first draft of the lifecycle test asserted `toCompleted.body.data.totalCost === 800` using
a **STAFF** token — but margin-gating correctly omits `totalCost`/`totalProfit` for staff
(Sprint 4/5's own design). The assertion was wrong, not the service: fixed by asserting the
STAFF response `.not.toHaveProperty('totalCost'/'totalProfit')` and verifying the real stored
figures via a direct `prisma.repair.findUniqueOrThrow`/`repairPart.findFirstOrThrow` read
instead — the same "test bug, not a service bug" class of finding as Sprint 3's guest-PICKUP
mistake.

## Validation

- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green — **570/570 tests, 39 files** (12 new `REPAIR_ROUTES`
  conformance cases; no regressions elsewhere).
- [x] `npm run lint` clean (`src test prisma`, no findings).
- [x] **`npm run test:int` run for real** against the reachable Postgres test DB — repairs' own
  5/5 pass, run twice to rule out flakiness. Full `test/integration` suite: **123/126** — the 3
  remaining failures are all in `purchasing.integration.spec.ts` (concurrency/property tests),
  the same pre-existing, environment-level `FOR UPDATE`-timing characteristic already
  documented in sets 06/07's prior reports; reproduced independent of any repairs code (repairs
  touches neither purchasing nor its tables).
- [x] Routes use `REPAIR_ROUTES` constants only; JSON via `sendSuccess`; mapper excludes
  margins when gated; no repair invoice ever created (verified in the integration suite).
- [x] Committed on green.

## Set 07 repairs module: complete

All 5 files (`mapper`/`interface`/`service`/`controller`/`routes` — no listener) built across
Sprints 4–6; router mounted; the full intake→pickup lifecycle verified end-to-end against a
real database, including the technician-required gate, staff-vs-admin scoping, and both cancel
paths (pending-release vs. explicit consumed-part restock).

## Next sprint

Sprint 7 — Statistics: Foundation (mapper, interface). A fresh module — read-only, no injected
services beyond `PrismaClient`, no event bus at all.
