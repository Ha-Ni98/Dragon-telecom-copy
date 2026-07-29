# Sprint 5 Report — Repairs: Logic (service)

**Set:** 07 (orders + repairs + statistics) · **Module:** repairs · **Layer:** logic
**Status:** ✅ Done

---

## What was built

- **`src/modules/repairs/repairs.service.ts`** — `RepairsService implements IRepairsService`
  (**no listener** — repairs listens to nothing), constructor DI `(prisma, inventory:
  IInventoryService, sequence: ISequenceService)`:
  - **`createRepair`** — resolves `customerName`/`customerPhone` from the attached `PosClient`
    when `cmd.posClientId` is given (BL#1 prefill), else the command's own values; one
    `$transaction`: `sequence.nextNumber(tx, DocType.REPAIR)` → create `Repair` (INTAKE) →
    write the intake `RepairStatusHistory` row (`INTAKE→INTAKE`, `note:'intake'`) for §C-1
    scoping.
  - **`addPart`** — `inventory.reserve` (shortfall throws the injected engine's own
    `ConflictError('INSUFFICIENT_STOCK', {productId,...})` — already "names the product" per
    spec, no extra wrapping needed) + create `RepairPart`; recomputes `partsTotal` (Σ remaining
    lines) and `totalAmount = labourPrice + partsTotal`. **`removePart`** — `inventory.release`
    + delete the part row; same totals recompute.
  - **`updateRepair`** — `diagnosis?`/`labourPrice?`/`technicianId?`; recomputes `totalAmount`
    only when `labourPrice` changes.
  - **`changeStatus`** — the transition machine: a `STATUS_SEQUENCE` array
    (`INTAKE→PROCESSING→COMPLETED→PICKED_UP`) validated by `toIndex === fromIndex + 1`;
    `CANCELLED` validated separately (allowed from any state **except** `CANCELLED` or
    `PICKED_UP` — see clarification below). **Idempotent re-COMPLETE** short-circuits before any
    work (mirrors `orders.confirmOrder`'s pattern). `INTAKE→PROCESSING` requires
    `existing.technicianId` already set (via a prior `updateRepair` — the command itself
    carries no `technicianId`). `PROCESSING→COMPLETED`: per part `release` + `consumeFifo(...,
    REPAIR_CONSUMPTION)`, storing part `costOfGoods`/`profit` and rolling up
    `Repair.totalCost`/`totalProfit`. `COMPLETED→PICKED_UP`: cash `paidAmount`, `pickedUpAt`,
    emits `repair.pickedUp` from the **pre-transaction** `existing` snapshot (COMPLETED already
    stamped every cost/profit field in an earlier, separate call — no need to re-read).
    `→CANCELLED`: releases only still-pending parts (`costOfGoods == null`); already-consumed
    parts restock **only** via the caller's explicit `consumedPartReturns[]`
    (`restock ⇒ returnIn` at the reconstructed consumed cost). Every transition emits
    `repair.statusChanged`; `flushEvents(tx)` runs after any transition that touched stock.
  - **`listRepairs`** — admin: unscoped; staff: `history: { some: { fromStatus: INTAKE,
    toStatus: INTAKE, staffId: me } }` (§C-1) + optional `status`/`technicianId` filters. No
    pagination (Sprint 4's clarification — the query schema has none).
- **`src/common/utils/system-staff.utils.ts`** (new, shared) — see genuine-gap section below.
- **`src/modules/orders/orders.service.ts`** — refactored to use the extracted
  `SystemStaffResolver` instead of its own private method (behavior-preserving; see below).
- **Test:** `test/unit/modules/repairs/repairs.service.spec.ts` (15 tests) — `PROCESSING`
  without `technicianId` → 400, allowed once assigned; part add reserves/shortfall propagates
  and rolls back (no part row, no total update); part remove releases and recomputes totals
  from the *remaining* parts; **double COMPLETE ⇒ one `consumeFifo` call, one emit**;
  `repair.pickedUp` emitted exactly once with the costed snapshot; `CANCELLED` releases only
  pending parts and leaves already-consumed stock untouched without `consumedPartReturns`, but
  restocks at the reconstructed consumed cost when explicitly requested; cancelling an
  already-`PICKED_UP` repair rejected (409); `createRepair` writes the intake history row,
  prefills from `PosClient`, and falls back to the system staff for an admin actor;
  `listRepairs` scoping (staff filtered by the intake marker, admin unscoped).

## Genuine gaps found and resolved

**1 — Extracted `SystemStaffResolver` to `@common/utils/system-staff.utils.ts`, refactoring
`orders.service.ts` to use it.** Repairs' `createRepair`/`addPart`/`removePart`/`changeStatus`
are all `staff(STAFF_REPAIRS)|admin` routes, and — exactly like orders' Sprint 2 discovery — an
`ADMIN` JWT never carries a `staffId` (`Staff` rows exist only for `UserType.STAFF`), yet
`RepairStatusHistory.staffId` (like `StockMovement.staffId`) is a `NOT NULL` FK. Rather than
duplicate the ~30-line self-bootstrapping "system staff" logic verbatim in a second service
(real drift risk if a future bug fix landed in only one copy), extracted it into a shared,
once-tested utility class and refactored `OrdersService` to construct one in its own
constructor instead of its original private method/field. **Behavior-preserving**: verified
with the full orders unit suite (54/54) and the full orders integration suite (12/12, run
twice) both still green after the refactor, with zero test changes needed in
`orders.service.spec.ts` — the mocked `prismaMock` object is passed through unchanged, so the
same `userUpsertMock`/`staffFindUniqueMock` still intercept the resolver's calls. Renamed the
internal placeholder username from `'system.storefront'` (orders-specific) to
`'system.internal'` (module-neutral) — purely internal, never surfaced, no test asserted on the
literal string.

**2 — `createRepair`'s interface signature changed from `(cmd, staffId: string)` to `(cmd,
actor: JWTPayload)`.** The plan's literal wording matched sales' `createDraft(cmd, staffId)`,
but sales' own `CREATE_DRAFT` route is *also* `staff|admin`-guarded and has the identical latent
gap (an admin calling it would pass `req.user!.staffId!` = `undefined` into a `NOT NULL`
column) — apparently never triggered or noticed there. Having just built the shared resolver
specifically because repairs needs it *uniformly* across its four staffId-touching mutations,
it would have been inconsistent to leave `createRepair` on the old bare-`staffId` shape while
fixing the other three. Changed the interface (Sprint 4's file) to take the full `actor` so the
service can resolve `actor.staffId ?? systemStaff.resolve()` the same way everywhere.

**3 — `CANCELLED "from any state"` interpreted as excluding `CANCELLED` and `PICKED_UP`.** The
spec's literal text is "CANCELLED from any state, reason optional" — read completely literally,
that would include `PICKED_UP`. But by the time a repair reaches `PICKED_UP`, cash has already
changed hands and `sales.recordRepairSale` has already recorded a real `Sale` from the emitted
`repair.pickedUp` event; reversing that via a plain repair-level cancel would leave a dangling,
un-reconciled sale with no corresponding mechanism to unwind it. Interpreted "any state" as "any
*pre-pickup* state" and reject (409) cancelling an already-`PICKED_UP` (or already-`CANCELLED`)
repair — a defensible, business-sensible reading, flagged here rather than silently assumed.

**4 — Known, pre-existing class of limitation inherited, not introduced: `RepairPart` rows
sharing a `productId`.** `buildOriginalConsumptions` (mirroring `sales`'/`orders`' own) finds the
*first* matching `StockMovement` by `(referenceType:'REPAIR', referenceId, productId)` — if a
repair has two separate `RepairPart` rows for the same product (added in two separate `addPart`
calls), `consumedPartReturns` restocking one of them could reconstruct the wrong row's original
per-unit cost, since `StockMovement` carries no per-part discriminator. This is the same class
of gap `billing.resolveCurrentAverageCosts` already documents for `SaleLine` correlation —
inherited, not new, and left as a documented limitation rather than a schema change (out of
scope for this set per plan §0).

## Validation

- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green — **569/569 tests, 39 files** (15 new repairs-service tests;
  orders' full suite re-verified green after the `SystemStaffResolver` refactor; no regressions
  elsewhere). `test:int` not run this sprint — no route wired yet (N/A per this sprint's own
  validation checklist); orders' own `test:int` (12/12) was re-run once, manually, to confirm
  the shared-resolver refactor didn't disturb the already-shipped module.
- [x] `npm run lint` clean (`src test prisma`, no findings).
- [x] Events emitted **post-commit** (`flushEvents(tx)` immediately after every stock-touching
  `$transaction`, before any `eventBus.emit`); the injected `IInventoryService` is reused
  verbatim; `PROCESSING→COMPLETED` is genuinely idempotent (tested via two sequential real
  calls — one `consumeFifo`, one emit); no cross-module folder import (only `IInventoryService`/
  `ISequenceService`/`ConsumptionLine` types + the shared `@common/utils/system-staff.utils`
  infrastructure helper, same footing as `@common/utils/password.utils`/`@common/events/
  event-bus`).
- [x] Committed on green.

## Next sprint

Sprint 6 — Repairs: API (controller, routes, wiring, integration). No listener to wire (repairs
listens to nothing); the dormant `sales`/`observability` handlers for `repair.pickedUp`/
`repair.statusChanged`/`repair.cancelled` wake automatically once the router is mounted.
