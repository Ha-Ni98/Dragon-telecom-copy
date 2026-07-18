# Inventory — Sprint 4 Report: API — controller, routes, wiring, catalog cross-wiring, integration & conformance

**Status:** ✅ Done — [`sprints-inventory-04.md`](../sprints-inventory-04.md) Sprint 4 marked ✅. **Module complete (4/4 sprints).**

---

## What was implemented

### `Apps/api/src/modules/inventory/inventory.controller.ts` (new)
Thin; `try/catch → next(error)`. `getStock` branches on the service's return shape (`'body' in
result` — an `ExportResult` vs. a plain `StockRowDto[]`) to send either a CSV attachment
(`Content-Type`/`Content-Disposition`, mirrors platform's `exportFees`) or the envelope.
`createAdjustment` reads `req.user?.staffId`, throwing `AuthError` if absent (can't happen through
a real login — every ADMIN/STAFF user gets a Staff profile — but a clear boundary guard beats a
confusing downstream Prisma NOT-NULL failure).

### `Apps/api/src/modules/inventory/inventory.routes.ts` (new — composition root)
`InventoryService` (the engine) + `InventoryReadService(prisma, sequenceService, catalogPricingService, engine)`
+ controller; all four routes registered under `INVENTORY_ROUTES` with the `admin` guard
(`requireAuth({ types:[ADMIN], checkDB:true })`) and per-segment `validateRequest`. Exports
`inventoryService = engine` for downstream DI, mirroring platform's `sequenceService`/
`deliveryFeeService` export.

### Catalog-side cross-wiring (plan §6, §7.1–§7.2, §8 #5)

This is the one part of the sprint that touched **already-shipped** catalog code (all 5 catalog
sprints were previously ✅ Done), so each change below is deliberately minimal and was verified
against catalog's own existing test suites before and after.

1. **Widened `IInventoryPort.addLayer`** (`catalog.interface.ts`) to add `staffId: string` to its
   input — `StockMovement.staffId` is a required column the old stub never needed to populate.
2. **`ICatalogProductService.createProduct` gained a third parameter, `staffId: string`**
   (`catalog.interface.ts`, `catalog.service.ts`), passed straight through into
   `inventory.addLayer(tx, { ..., staffId })`. This is a real, if small, signature change to a
   shipped method — see "Blast radius" below for what it touched.
3. **`CatalogProductService.useInventory(port: IInventoryPort): void`** — a setter (not
   constructor-only injection), added specifically for the aggregator to swap the placeholder
   `InventoryPortStub` for the real engine once it exists. Deliberately **not** on
   `ICatalogProductService` — controllers never call it, only `modules/index.ts` does.
4. **Extracted `applyPricing(tx, productId, cmd): Promise<void>`** from `updatePricing`'s
   transaction body (no event emit inside — the caller emits after its own commit).
   `updatePricing` now just calls `this.prisma.$transaction((tx) => this.applyPricing(tx, id, cmd))`
   — a behavior-preserving refactor (same operations, same event, same transaction), verified by
   the pre-existing `updatePricing` unit tests passing unchanged.
5. **`catalog.routes.ts` exports `catalogProductService` and `catalogPricingService`** — both are
   the same `productService` singleton, exported under two names for clarity at each import site
   (the aggregator's `useInventory` wiring vs. inventory's pricing injection). `catalogPricingService`
   satisfies inventory's `ICatalogPricingPort` **structurally** — catalog never imports that type,
   preserving the single import direction (inventory → catalog) the plan calls for.
6. **`catalog.controller.ts`'s `createProduct`** now resolves `staffId` from `req.user` and passes
   it through (see controller note above for the guard).

### The adapter lives in the aggregator, not either module (`modules/index.ts`)

`IInventoryPort.addLayer` (object input, returns `void`) and the real engine's
`IInventoryService.addLayer` (positional args, returns `{movementId}`) are different shapes — no
amount of "widening" makes them the same type, so a real adapter is unavoidable. It's written
**inline in `modules/index.ts`**, not inside catalog's folder: catalog importing anything from
inventory would create the exact reverse-dependency the plan explicitly avoids (inventory → catalog
is the only sanctioned direction). The aggregator is the one place already allowed to know about
every module, so it's the correct home for this glue. `registerModules` now calls
`catalogProductService.useInventory(inventoryPortAdapter)` before mounting any router — this runs
at module-load time, before any request is ever served.

### Blast radius of the `createProduct`/`IInventoryPort` signature changes (mechanical, verified)

- `test/unit/modules/catalog/catalog.service.spec.ts` — the two existing `createProduct(cmd, [])`
  calls needed a third `STAFF_ID` argument; the `inventoryMock.addLayer` assertion needed
  `staffId` added to its expected payload. Both are call-site updates, not behavior changes.
- `test/integration/catalog.integration.spec.ts` — `mintToken`'s issued token carried no `staffId`
  (a test shortcut bypassing the real login flow). Fixed to include the seeded user's real
  `staff.id`, exactly matching what identity's actual `buildJwtPayload` does for every ADMIN/STAFF
  login — a correction toward reality, not a workaround. All 10 pre-existing catalog integration
  tests still pass unchanged.

---

## Tests

### `test/integration/inventory.integration.spec.ts` (new, 12 tests)
Real test DB, `ApiResponse` envelope asserted throughout. Admin guard: 401 (no token) on all four
routes, 403 (STAFF token) on one. `GET /stock`: `stockValue`/`isLow` derivation, `lowStockOnly`
filter, `export=csv` headers + body. `GET /movements`: a **real** `POST /admin/products` (through
catalog's HTTP surface) confirmed to write a genuine `INITIAL_STOCK` `StockMovement` row via the
now-swapped-in real engine (not the old stub) — the direct proof that the cross-wiring works
end-to-end; plus a filter/pagination case. `GET /reservations`: an open reservation (seeded by
calling the real `inventoryService.reserve` directly, since no order/repair module exists yet to
create one via HTTP) shows the right holder/`ageHours`. `POST /adjustments`: mixed IN/OUT lines
apply real column deltas; `DAMAGE` sets `profit=null`; an IN line's `prices` reprices the product
**atomically**, verified by a follow-up `GET /admin/products/:id`; over-consumption 409s with the
earlier line's effect **and** the `StockAdjustment` header itself rolled back; `inventory.adjusted`
emits exactly once.

### `test/integration/inventory-engine.integration.spec.ts` (new, 3 tests)
The dedicated cross-module engine proof against a **real** Postgres transaction (Sprint 2 proved
the same contract against a fake tx): commit persists the movement + column delta and only then
flushes the buffered event; a caller that throws *after* a successful engine call leaves nothing
persisted and **the already-buffered event never fires** (proving it's discarded, not delivered
late); a two-step document (add stock to product A, then over-consume product B) rolls back
product A's earlier, already-applied change too — the literal "a sale without its movement can
never happen" guarantee the spec's whole injected-service design exists for.

### `test/contract/routes.conformance.spec.ts` (extended, +1 test)
All four `INVENTORY_ROUTES` resolve on `app` (not a raw 404), DB-free — every route is
admin-guarded, so `requireAuth`'s missing-token check short-circuits before any Prisma call,
matching the platform/catalog precedent exactly (no public-route carve-out needed here, unlike
catalog).

### Bugs the tests caught before they shipped
Three integration-test-construction bugs, same root cause as Sprint 2's: seeding a product's
`quantityOnHand` directly (no backing `StockMovement` layer) and then asking the engine to
**consume** from it. The over-consumption test additionally used a negative `countedQuantity`,
which the contract schema rejects (400) before the request ever reaches the engine (which would
have produced 409) — fixed by using `quantityReserved` to shrink `available` below the countable
target instead. All three fixes were caught by the tests actually failing, not inspection.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint --no-color` | ✅ clean |
| `npm run test:unit` (290 tests / 22 files) | ✅ green |
| `npm run test:int` (70 tests / 7 files — all pre-existing integration suites re-verified alongside the 2 new inventory files) | ✅ green |
| Routes use `INVENTORY_ROUTES` constants only; all responses go through `sendSuccess` (CSV is the documented envelope exception, platform precedent) | ✅ |
| `admin` guard on all four routes | ✅ |
| `inventoryService` singleton exported; catalog's stub swapped for the real engine via `useInventory` at the aggregator | ✅ |
| In-tx reprice proven atomic (integration test + the engine's own commit/rollback proof) | ✅ |
| Every pre-existing catalog test (unit + integration) still green after the signature change | ✅ |

Test DB note (environment-specific, not project config): this sandbox's ephemeral Postgres listens
on port 5544, not the 5433 `test/setup.ts` defaults to — `test:int` needs
`TEST_DATABASE_URL=postgresql://user:password@127.0.0.1:5544/dragon_telecom_test` set explicitly.
Same constraint prior sprint reports (catalog, platform) already noted.

---

## Flagged for the owner

1. **`inventory.port.stub.ts` was left unchanged.** TypeScript's bivariant parameter checking for
   method-shorthand interface members means its narrower input type (missing `type` even before
   this sprint, now also missing `staffId`) still satisfies the widened `IInventoryPort` without
   edits. It's dead code now that the real engine is always wired in before any request is served,
   but it's cheap, harmless, and its own header comment already frames it as a pre-inventory
   placeholder — left in place rather than deleted, since removing it isn't required for
   correctness and this sprint's diff is already touching a lot of already-shipped catalog code.
2. **`ReturnInResult`'s single `movementId`** (from Sprint 2) remains a known interface
   simplification for a `returnIn` that spans multiple original costs — unchanged this sprint,
   still flagged for whenever a real caller (sales/orders returns) needs the full list.
3. **`listReservations` paginates in application memory`** (from Sprint 3) — unchanged, still
   flagged as a scalability tradeoff if the open-reservations set ever grows large.

---

## Module definition of done — all 4 sprints ✅

- `Apps/api/src/modules/inventory/` has the 5 core files (mapper, interface, service, controller,
  routes) — no listener; `inventory.service.ts` provides the FIFO engine (`InventoryService`) + the
  read/admin service (`InventoryReadService`).
- `inventoryRouter` mounted via `registerModules`; all four routes use `INVENTORY_ROUTES` constants
  and validate each segment against the contract schema; every response parses against its
  `*ResponseSchema`; `Decimal→number` and `Date→ISO` at every boundary.
- FIFO correctness (10@100+10@150 consume 15 ⇒ COGS 1750/layer 5@150; over-consume ⇒ 409 zero rows;
  `returnIn` at original cost; `reserve→release` restores available; `balanceAfter` chain;
  invariants) verified at both the unit level (fake tx) and integration level (real Postgres tx).
- avgCost recomputed on IN only; inventory is the sole writer of `quantityOnHand`/
  `quantityReserved`/`averageCost` anywhere in the codebase.
- Adjustments transactional end-to-end, proven via real HTTP + real DB: `ADJUSTMENT` sequence
  reference; IN-delta default cost = avgCost; in-tx reprice; `ADJUSTMENT_OUT` `profit=null`.
- Events: `stockChanged` every change, `lowStock` edge-triggered, `adjusted` once per document, all
  post-commit; inventory listens to nothing.
- `inventoryService` singleton exported and live-wired into catalog's `createProduct`, replacing
  the stub — verified by a real `INITIAL_STOCK` `StockMovement` row appearing after a real
  `POST /admin/products` call.
- Unit (290) + integration (70, all suites) + conformance suites green; all 4 sprints committed on
  green in order.

---

## Commit

`git add .` then `git commit -m "api: inventory sprint 4 — api and wiring"`.
