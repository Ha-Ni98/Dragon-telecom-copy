# Sales+Billing — Sprint 3 Report: Sales — Logic (service + listener)

**Status:** ✅ Done — [`sprints-sale-bill-06.md`](../sprints-sale-bill-06.md) Sprint 3 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/sales/sales.service.ts`
`SalesService implements ISalesService`, constructor DI `(prisma, sequence: ISequenceService,
inventory: IInventoryService, catalogPricing: ICatalogPosPricingPort)`.

- **`createDraft`/`updateDraft`** — DRAFT-only guard (409 `ConflictError` off-DRAFT), owner-or-admin
  guard (403 `ForbiddenError`). `updateDraft`'s optional `cmd.lines` fully replaces the line set
  (`deleteMany: {} , create: [...]`, mirroring purchasing's own invoice-update pattern) via the new
  shared `SalesMapper.toLineCreateInput` (see mapper note below).
- **`confirm`** — one `prisma.$transaction`. Sequenced to fail fast: `subtotal`/`totalAmount` are
  computed from the already-stored lines (unitPrice/quantity never change between draft and
  confirm) **before** touching catalog or inventory, so the `CREDIT_REQUIRES_CLIENT` gate and the
  POS-price resolution/validation both run pre-transaction — no wasted FIFO work if either would
  abort. Inside the transaction: locks the `PosClient` row (if any) for `previousCredit`, calls
  `inventory.consumeFifo(tx, …, MovementType.SALE, …)` per line (stock exhaustion throws inside the
  loop → the whole transaction rolls back, sale stays DRAFT — spec test scenario), updates each
  `SaleLine`'s `resolvedPrice`/`costOfGoods`/`profit`, allocates `DocType.SALE`, flips
  `COMPLETED`/`soldAt`. Commit → `inventory.flushEvents(tx)` → `eventBus.emit('sale.confirmed', …)`.
  Returns `ReceiptDto` re-read from the committed row.
- **`createReturn`** (admin) — validates `quantity ≤ sold − already-returned` per line before
  opening the transaction. Restock lines reconstruct the original FIFO consumption from
  `StockMovement`/`StockMovementConsumption` (see "Reconstructing original consumptions" below) and
  hand it to `inventory.returnIn`. Sale flips `RETURNED` (every line now fully returned) or
  `PARTIALLY_RETURNED`. Emits `return.created` with a **negative** `creditEffect` (see "Credit sign
  convention" below).
- **`listStaffSales`/`listAdminSales`/`getSale`** — margin-gated the same way `updateDraft`/`getSale`
  are (`includeMargins = actor.type === ADMIN`); staff list/detail scoped by `staffId` **in the
  service**, never the controller (Data Mapping note); non-owner staff reading another staff's sale
  → 403.
- **`recordRepairSale`** (listener-only) — see "Genuine gap: repair.pickedUp has no staffId" below.

### Reconstructing original consumptions (`buildOriginalConsumptions`)
`inventory.returnIn(tx, originalConsumptions, qty, ref)` **requires** `Σ originalConsumptions.qty
=== qty` (verified against the real implementation, `inventory.service.ts`'s own `returnIn`) — it
cannot simply be handed "whatever the line originally consumed" on a **partial** return. Since
`SaleLine` has no column recording which specific `StockMovementConsumption` rows it drained, the
service reconstructs them by querying `StockMovement` (`referenceType:'SALE', referenceId:saleId,
productId, direction:OUT` — exactly the composite the schema's own `@@index([referenceType,
referenceId])` anticipates) for the original consuming movement, then its
`StockMovementConsumption` rows, greedily taking `qty` from them in `id` order (their only
available ordering — the table carries no timestamp) until the target is met. This is a genuine
design decision beyond what the plan specified (the plan's Test Scenarios only cover "restock vs
not", not partial-return cost fidelity); documented here for future reference for orders/repairs'
own eventual return flows if they hit the same gap.

### Credit sign convention (`return.created.creditEffect`)
Neither `sales.md` nor `billing.md` states the sign. `PosClient.credit` is "owed to the store"
(schema comment); a refund should **reduce** what the client owes, so `creditEffect = -refundAmount`
(applied by `clients.applyReturnCreated` as a plain increment — already built, Sprint-05). This can
push `credit` negative (store owes the client), mirroring purchasing's own
overpayment-allowed convention. `creditEffect`/`posClientId` are only emitted when the sale has a
linked `PosClient` (cash anonymous sales carry no credit concept at all).

### Genuine gap: `repair.pickedUp` has no `staffId`
`Sale.staffId` is `NOT NULL`, but the frozen `RepairsEvents['repair.pickedUp']` payload carries no
staff identifier at all (only `repairId`, money fields, `snapshotParts`, `labourPrice`) — this
wasn't caught during planning. **Resolution:** `recordRepairSale` reads the repair's most recent
`RepairStatusHistory` row (`orderBy: changedAt desc`) and uses **its** `staffId` — the repairs
module's own transition-audit trail already records who performed each status change, including
presumably the PICKED_UP transition that triggers this very event, in the same moment it emits.
This is a **read-only cross-module dependency** (permitted, mirrors billing's own planned
`sale.confirmed`-triggers-a-read-of-`SaleLine` pattern), not a contract change. If the repairs
module (unbuilt) doesn't actually write a status-history row at pickup before emitting, this
listener will 404 (`NotFoundError('RepairStatusHistory')`) and the throw is swallowed by
`safeRun` — **flagged as a cross-module integration risk to verify once the repairs module is
built.**

### Mapper refinement: `SalesMapper.toLineCreateInput`
Extracted the per-line create-input logic (`resolvedPrice=0`, `lineTotal` preview,
`productNameSnapshot` fallback, serial serialization) out of `toPersistenceDraft`'s inline map into
a shared public static method, since `updateDraft`'s line-replacement path needs the identical
logic and duplicating the serial-comma-join rule in two places would fork it. `toPersistenceDraft`
now delegates to it. No observable change to Sprint 2's mapper tests (verified still green).

### `Apps/api/src/modules/sales/sales.listener.ts`
`SalesListener`, injects `ISalesService`, subscribes `repair.pickedUp` → `recordRepairSale`,
wrapped in the same `safeRun` guard `clients.listener.ts`/`purchasing.listener.ts` established (a
throw/rejection never propagates back into `eventBus.emit`'s synchronous dispatch).

### Tests
- `test/unit/modules/sales/sales.service.spec.ts` (22 tests): `createDraft` productNameSnapshot
  resolution + unknown-productId 400; `updateDraft` 403 non-owner, 409 off-DRAFT, wholesale line
  replacement, admin-may-edit-any; `confirm` 409 on non-DRAFT (double-confirm surface), exhausted
  stock → propagated 409 + no `sale.update`/no emit, underpaid-anonymous → 400
  `CREDIT_REQUIRES_CLIENT`, full credit-math + receipt-figures happy path (asserts the exact
  `consumeFifo` call args, the `sale.update` data, `flushEvents` once, the emitted payload, and the
  returned `ReceiptDto`'s `grandTotal`), and the double-confirm scenario (first call succeeds with
  exactly one `consumeFifo`/one emit; a second call on the now-COMPLETED sale 409s with **no**
  additional `consumeFifo`/emit calls); `getSale` 403/admin-sees-margins/owner-hides-margins/404;
  `createReturn` restock calls `returnIn` with the reconstructed consumption + at-cost unitCost,
  non-restock never calls it, over-quantity 400, `creditEffect=-refundAmount` emitted + applied to
  `PosClient.credit`; `recordRepairSale` creates a COMPLETED REPAIR sale + emits, is a no-op when
  `Repair.saleId` is already set, and never calls `consumeFifo` (no FIFO re-consumption).
- `test/unit/modules/sales/sales.listener.spec.ts` (3 tests): one `repair.pickedUp` → one sale + one
  `sale.confirmed(origin:REPAIR)` (asserted via a **plain subscriber on the real eventBus**, not a
  re-mock of the event-bus module — mocking `TypedBus`'s `emit` by object-spread breaks `this`
  binding for `on`, since `on` reads `this.emitter` internally; a genuine `eventBus.on(...)` spy
  avoids that trap entirely and mirrors how `clients.listener.ts` actually consumes the event in
  production); replaying the same `repairId` ⇒ exactly one sale/one emit (the idempotency latch,
  genuinely exercised via two sequential `eventBus.emit` calls with different `repair.findUnique`
  mock responses); a handler throw is swallowed (asserted via `loggerErrorMock`, no re-emit).

---

## Validation

| Check | Result |
|---|---|
| `Apps/api`: `npx tsc --noEmit` | ✅ clean |
| `Apps/api`: `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 447/447 (31 files) |
| `Apps/api`: `npm run lint` | ✅ clean (one `consistent-type-imports` auto-fix applied to the new service file) |
| `Apps/contract`: `npx tsc --noEmit` | ✅ clean (unchanged this sprint) |
| Events emitted post-commit; `flushEvents(tx)` called after each `$transaction` that touches inventory (`confirm`/`createReturn`); `recordRepairSale` calls no inventory method at all (no FIFO re-consumption), so it calls no `flushEvents` either | ✅ |
| Repair-pickup idempotency genuinely tested (not just asserted by inspection) — replay produces exactly one sale/one emit | ✅ |
| No cross-module folder import beyond `ISequenceService`/`IInventoryService`/`ConsumptionLine` (shared infra, direct-import precedent) + the locally-declared `ICatalogPosPricingPort` | ✅ |
| `npm run test:int` | not run — no `sales` route exists yet; first applicable at Sprint 4 |

---

## Notes for later sprints

- **Sprint 4** (sales API): wire `SalesService`/`SalesController`/`SalesListener` in
  `sales.routes.ts`; per-route access per plan §I.2/§D-1 table.
- **Sprint 6/7** (billing): billing's `issueFromSale` reads persisted `SaleLine` rows for
  cost/profit (plan §C-3) — those rows are now genuinely populated by `confirm` above (not just
  planned).
- **Flagged for the eventual repairs-module build:** verify `RepairStatusHistory` actually has a
  row for the PICKED_UP transition committed before `repair.pickedUp` is emitted — `recordRepairSale`
  depends on it and currently 404s (silently, via `safeRun`) if it's missing.

---

## Commit

`git add .` then `git commit -m "sales: sprint 3 — logic (service + listener)"`.
