# Sprint 2 Report — Orders: Logic (service + listener)

**Set:** 07 (orders + repairs + statistics) · **Module:** orders · **Layer:** logic
**Status:** ✅ Done

---

## What was built

- **`src/modules/orders/orders.service.ts`** — `OrdersService implements IOrdersService`,
  constructor DI `(prisma, deliveryFee: IDeliveryFeeService, inventory: IInventoryService,
  sequence: ISequenceService, catalogPricing: ICatalogViewerPricingPort)`:
  - **`placeOrder`** — one `$transaction` + `flushEvents`: guest/PICKUP/clientId-mismatch guards
    → resolve viewer price via `catalogPricing.getCartProducts` (see genuine gap #1 below) →
    resolve delivery fee (0 for PICKUP) → create the `Order` row first, then `inventory.reserve`
    using the row's own generated `id` as `referenceId` (mirrors `catalog.createProduct`'s
    create-then-addLayer ordering) → commit → `flushEvents` → emit `order.placed`.
  - **`confirmOrder`** — idempotent (an already-CONFIRMED-or-later order returns its current
    state, no re-consume/no duplicate emit); `release` + `consumeFifo(ORDER_OUT)`, stores
    `costOfGoods`/`profit`; resolves `posClientId` via `Client.posClientId` (§C-3) and emits
    `order.confirmed` only with the fields that actually resolved (guests get neither
    `clientId` nor `posClientId`).
  - **`updateStatus`** — forward-only ≤ COMPLETED via a `STATUS_SEQUENCE` array
    (`indexOf`-based; CANCELLED/RETURNED aren't in it, so any attempt from those returns `-1`
    and is rejected — they're reachable only through their own dedicated methods).
    `IN_DELIVERY` requires `deliveryCompany`+`trackingNumber`.
  - **`cancelOrder`** (admin) — any pre-COMPLETED state; `release` only when still `PENDING`
    (plan's literal scoping — no stock reversal for CONFIRMED/PACKAGED/IN_DELIVERY, that's
    RETURN's job). **`returnOrder`** (admin) — COMPLETED only; `restock` reconstructs the
    original FIFO consumption via `buildOriginalConsumptions` (`StockMovement`+
    `StockMovementConsumption`, keyed by `referenceType:'ORDER'`), mirroring
    `sales.service.buildOriginalConsumptions` exactly (§D-7).
  - **`cancelMyOrder`**/`listMyOrders` (client, scoped `clientId`), **`listBackoffice`**
    (staff==admin, unscoped — "orders have no owner staff"), **`getStats`** (`groupBy` roll-up).
  - **`applyClientPaymentRecorded`** (§C-2, listener-only) — resolves the invoice by number,
    acts only on `sourceType===ORDER`, writes `Order.paidAmount` as an **absolute mirror** of
    `Invoice.paidAmount` (not an increment) for idempotency/listener-order safety.
- **`src/modules/orders/orders.listener.ts`** — `OrdersListener`, subscribes
  `payment.clientRecorded` → `applyClientPaymentRecorded`, wrapped in the same `safeRun` guard
  used by clients/sales/billing (a throw never re-enters `eventBus.emit`'s synchronous dispatch).
- **`src/modules/orders/orders.interface.ts`** (augmented from Sprint 1) — added `Viewer` type
  alias and `ICatalogViewerPricingPort` (see genuine gap #1).
- **Tests:** `orders.service.spec.ts` (30 tests, mock Prisma + fake `IDeliveryFeeService`/
  `IInventoryService`/`ISequenceService`/`ICatalogViewerPricingPort`) and
  `orders.listener.spec.ts` (4 tests, real event bus + real `OrdersService`, mirroring
  `billing.listener.spec.ts`'s structure) — covering every scenario the sprints doc lists:
  guest null-price → 403 `GUEST_PRICE_HIDDEN`; guest PICKUP → 400; `clientId` mismatch → 403;
  zero fee for PICKUP; reserve→release→consume invariants; double confirm → one `consumeFifo`/
  one emit; FIFO shortfall → propagated conflict, order stays PENDING, no event; forward-only
  status (backward, same-status, terminal-state, `IN_DELIVERY`-without-tracking all rejected);
  staff advances every forward transition; admin cancel from PENDING releases vs. from
  CONFIRMED doesn't; client cancel scoping (403 wrong owner, 409 wrong status); RETURNED
  restock calls `returnIn` at reconstructed cost, non-restock doesn't touch it;
  `order.confirmed` carries/omits `posClientId` correctly; listener idempotency (replay ⇒
  identical absolute mirror) and failure-swallowing.

## Genuine gaps found and resolved (beyond plan §C)

**1 — The plan's "direct Product/ProductPrice read" for viewer pricing undersold what
catalog already provides and already names orders as a consumer of.** Investigating the
guest-price resolution, `CatalogProductService`'s private `resolvePricing` method carries the
comment *"The one function reused by storefront/POS/orders"* — tier price (via the client's
linked `PosClient.categoryId`, when one exists) else `guestPrice`, hidden if neither. This is
exposed publicly (already, pre-existing) as `getCartProducts(productIds, viewer)`, and is
*already* consumed exactly this way by `clients.service.ts` via its own `ICatalogCartPort` (the
established consumer-declares-the-shape / provider-satisfies-structurally precedent — no
`implements` clause on catalog's side). Re-deriving guestPrice-only logic directly in
`OrdersService` would have (a) duplicated a business rule catalog already owns, (b) silently
diverged from what a registered client actually saw while browsing the storefront (tier
pricing would never apply), and (c) required a second read path for the exact same table
(`ProductPrice`) catalog already resolves correctly. **Resolution:** declared
`ICatalogViewerPricingPort` in `orders.interface.ts` (same shape as `ICatalogCartPort`,
different name to avoid confusion with inventory's differently-shaped `ICatalogPricingPort`)
and inject `catalogProductService` directly in Sprint 3's `orders.routes.ts` — zero catalog
code changes, purely additive DI wiring. Flagged here rather than silently deviating from the
plan's literal wording, since it changes what `placeOrder` injects (four ports, not three).

**2 — `StockMovement.staffId` is `NOT NULL`, but guest/client placements and admin-initiated
confirm/cancel/return have no natural `Staff` row at all.** Not covered by plan §C. A guest or
authenticated storefront `Client` never has a `staffId`; an `ADMIN` JWT never carries one
either (`Staff` rows exist only for `UserType.STAFF` — confirmed via
`identity.service.ts:515`, `staffId` is only set `if (user.staff)`). Every `MovementRef` the
injected `IInventoryService` requires is `staffId: string` (required, FK-enforced) — there is
no way to satisfy `reserve`/`release`/`consumeFifo`/`returnIn` without a real `Staff.id`.
**Resolution (self-contained to this module, no schema/seed change):** a lazily-bootstrapped,
cached "system" `Staff` row (`resolveSystemStaffId`), created via `prisma.user.upsert` keyed on
the `@unique` `username` column (`'system.storefront'`, `isEnabled: false`, a random
never-surfaced password) — race-safe under concurrency by construction, resolved once per
service instance and cached thereafter. Used as the movement-trail `staffId` for guest/client
PLACE and for any ADMIN-initiated stock mutation; **`Order.confirmedByStaffId` itself is left
`null`** for an admin confirm (not backfilled with the system placeholder) so the business
column still faithfully means "no individual staff attributed this," while the audit-trail
`StockMovement.staffId` FK constraint is satisfied. Alternatives considered and rejected:
attributing to an arbitrary existing `Staff` row (misleading audit trail); relaxing
`StockMovement.staffId` to nullable (a schema migration, explicitly out of scope for this set
per plan §0); seeding a fixed system-staff row in `prisma/seed.ts` (works, but makes every
environment's provisioning a hard prerequisite rather than self-healing — the lazy
bootstrap needs nothing from the seed script and works identically in tests, dev, and prod).

**3 — `ReturnOrderCommand.reason` has no persistence column**, mirroring Sprint 1's `note`
finding: `Order.cancellationReason` is CANCELLED-specific: reusing it for a return would
misattribute the reason in any later audit narration. Accepted and silently dropped — flagged,
not fixed (same class of gap, same non-blocking resolution).

## Validation

- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green — **538/538 tests, 37 files** (54 new orders tests: 30
  service + 4 listener + 20 mapper carried from Sprint 1; no regressions elsewhere).
  `test:int` not run this sprint — no route is wired yet (routes.ts is Sprint 3's job; N/A
  per this sprint's own validation checklist).
- [x] `npm run lint` clean (`src test prisma`, no findings).
- [x] Events emitted strictly **post-commit** (`flushEvents(tx)` immediately after every
  `$transaction`, before any `eventBus.emit`); the injected `IInventoryService` is reused
  verbatim (no FIFO/reservation logic re-implemented); the listener's `applyClientPaymentRecorded`
  is a genuinely idempotent absolute mirror (tested via two sequential real `eventBus.emit`
  calls); no cross-module folder import anywhere — only injected port types
  (`IInventoryService`, `ISequenceService`, `IDeliveryFeeService`, `ICatalogViewerPricingPort`,
  `ConsumptionLine`) plus pure reads of `Client`/`Invoice` via the shared `prisma` singleton.
- [x] Committed on green.

## Next sprint

Sprint 3 — Orders: API (controller, routes, wiring, integration). The composition root will
inject `deliveryFeeService`/`inventoryService`/`sequenceService` (existing singletons) plus
`catalogProductService` for the newly-declared `ICatalogViewerPricingPort` (structural match,
confirmed by a clean `tsc` once wired) — the same direct-sibling-import, no-adapter shape sets
05/06 established.
