# Stage 02 · Sub-02 — Inventory Module Sprint Plan (set 04)

Dependency-ordered decomposition of [`plan-inventory.md`](./plan-inventory.md) into sprints, following
the phase-02 backbone **foundation (mapper/interface) → logic (service) → API (controller/wiring)**.
**No code in this document.** Each sprint ends green (compiles + tests pass) and is committed before the
next begins. Per-sprint reports land in `results-inventory-04/report-sprint-0N-04.md` (folder created
when the sprint runs).

## Sprint sequence & rationale

The phase file's suggested 3-sprint shape (Foundation / Logic / API) is **adjusted to 4**: the module
adds **zero contract types** (plan §0, so no pre-foundation contract sprint like catalog's), but its
**logic layer splits in two** because the FIFO **engine** is the most algorithmically dense slice built
so far *and* it is the cross-module **injected dependency** (orders/sales/purchasing/repairs/catalog all
call it). It must be independently green and reviewable before the adjustment path — the engine's only
in-module caller — builds on it.

| # | Sprint | Layer | Why separate |
|---|---|---|---|
| 1 | Foundation — mapper, interfaces, factories | foundation | Pure Entity⇄DTO transforms for the 4 DTOs, the two service contracts + the injected engine port + `MovementRef`/`ICatalogPricingPort`, and contract-shaped test data; no business logic. |
| 2 | Logic A — the FIFO engine (`InventoryService`) | logic | `reserve/release/addLayer/consumeFifo/returnIn` + avgCost recompute + `balanceAfter` chain + the tx-scoped event buffer, with the full FIFO invariant test matrix. The heaviest, highest-risk slice and the injected seam downstream modules depend on — kept standalone. |
| 3 | Logic B — reads + adjustments (`InventoryReadService`) | logic | `getStock`(+CSV) / `listMovements` / `listReservations` and the `createAdjustment` orchestration (sequence + engine delegation + in-tx reprice + `adjusted` event). Builds on the Sprint-2 engine; the HTTP-facing service that returns contract DTOs. |
| 4 | API — controller, routes, wiring, catalog cross-wiring, integration & conformance | API | HTTP surface + composition root (admin guards, CSV export, exported `inventoryService` singleton) + mount + the catalog↔inventory enabling changes (stub swap, tx-aware `applyPricing`) + end-to-end / cross-module / contract proof. |

**Gate rule:** a sprint starts only when the previous one is green and committed. `test:int` first runs
in Sprint 4 (once routes are wired + the test DB is up) — **there is no Prisma migration** (all
inventory models are pre-built, plan §0), so earlier sprints run `test:unit` (+ contract conformance)
only.

**Commit style** (per project convention): `git add .` then a short `api: inventory sprint N — <topic>`
message; **no** `Co-Authored-By`.

---

### Sprint 1: Foundation — mapper, interfaces, factories   — Status: ⬜ Pending

**Goals**
- Pure Entity⇄DTO transformation for the four inventory DTOs, the two service contracts + the injected
  engine port + injected pricing port, and contract-shaped test data — no business logic.

**Tasks**
- [ ] Impl: `src/modules/inventory/inventory.mapper.ts` — pure/static `toStockRowDto(product)`, `toMovementDto(movement, product, staff, referenceLabel)`, `toReservationDto(group, product)`, `toAdjustmentResultDto(adjustment, lines)`. `Decimal.toNumber()`, `Date.toISOString()`, 1:1 enum casts (`direction`/`type`/`holderType`), derived `availableQuantity`/`stockValue`/`isLow`/`ageHours`/reservation `quantity`; optional `unitCost`/`remainingQuantity`/`costOfGoods`/`profit` **omitted when null**; `staffName = firstName + ' ' + lastName`; **never spreads the entity**; each `toDto` ends `…ResponseSchema.parse(dto)`. (plan §1.1, §1.3, §5 item 1)
- [ ] Impl: the pure per-`referenceType` `referenceLabel` resolver used by `toMovementDto` — `ADJUSTMENT → StockAdjustment.reference`, `PRODUCT → Product.name`, `SUPPLIER_INVOICE → SupplierInvoice.reference`, fallback `` `${referenceType} ${referenceId.slice(0,8)}` `` for not-yet-built document modules. (plan §1.4, §8 #2)
- [ ] Impl: `src/modules/inventory/inventory.interface.ts` — `IInventoryReadService` (`getStock`/`listMovements`/`listReservations`/`createAdjustment`, returning contract DTOs / `PaginatedResult<T>` / `ExportResult`); `IInventoryService` (the engine — `reserve`/`release`/`addLayer`/`consumeFifo`/`returnIn` returning the spec's internal transactional shapes); the internal `MovementRef { referenceType; referenceId; staffId; reason? }` + engine result types; and `ICatalogPricingPort` (`applyPricing(tx, productId, cmd)`). Reuse platform's `ExportResult` shape or declare a local equivalent. (plan §2.1, §8 #1, §8 #3)
- [ ] Test (factories): `test/data/stock-movement.factory.ts` (IN-layer / OUT / PENDING variants), `test/data/stock-adjustment.factory.ts` (command + persistence); reuse/extend `test/data/product.factory.ts` and add `test/data/staff.factory.ts` if absent (for `staffId`/`staffName`). Each returns a valid persistence payload + a matching command payload. (plan §4.1)
- [ ] Test: `test/unit/modules/inventory/inventory.mapper.spec.ts` — each `toDto` parses its schema; `Decimal→number`, `Date→ISO`; `availableQuantity`/`stockValue`/`isLow`/`ageHours` math; enum passthrough; `staffName` composition; optional cost/qty fields omitted when null; `referenceLabel` resolver incl. fallback. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run test:unit` green (mapper spec + contract conformance + existing suites).
- [ ] `npm run lint --no-color` clean.
- [ ] Mapper never spreads the entity and returns `.parse()`d contract DTOs; the HTTP-facing interface returns DTOs (the engine's non-DTO returns are the spec-mandated exception, plan §8 #1); no service/route logic yet.
- [ ] Committed on green (`api: inventory sprint 1 — foundation`).

---

### Sprint 2: Logic A — the FIFO engine (`InventoryService`)   — Status: ⬜ Pending

**Goals**
- Implement the injected FIFO engine (constructor DI on `PrismaClient`): `reserve`/`release`/`addLayer`/
  `consumeFifo`/`returnIn`, avgCost recompute, the `balanceAfter` chain, and the tx-scoped event buffer —
  with the full invariant test matrix. `InventoryReadService` is a typed stub this sprint.

**Tasks**
- [ ] Impl: create `src/modules/inventory/inventory.service.ts` with `InventoryService implements IInventoryService` (constructor DI on `PrismaClient`); `InventoryReadService` present as **typed stubs that throw `"...not implemented yet (see Sprint 3)"`** so the file compiles its `implements`. (plan §5 item 3; catalog Sprint 3 stub precedent)
- [ ] Impl (engine, all take `tx` + `ref: MovementRef`): `addLayer` (insert `IN` movement, `remainingQuantity = quantity`, `unitCost`; recompute `averageCost` **IN-only** `(oldQty×oldAvg + inQty×unitCost)/(oldQty+inQty)`, guard `oldQty+inQty=0`; `quantityOnHand += qty`; `balanceAfter`). `consumeFifo` (precondition `qty ≤ onHand − reserved`, else **409 `INSUFFICIENT_STOCK { productId, requested, available }` with zero rows**; drain oldest `remainingQuantity > 0` layers FIFO by `createdAt`, write a `StockMovementConsumption` per drained layer + decrement its `remainingQuantity`; `costOfGoods = Σ(consumed×layerUnitCost)`; `profit = revenue − COGS` or `null`; `quantityOnHand −= qty`). `reserve`/`release` (write `PENDING_*`; `quantityReserved ± qty`; **onHand untouched**; reject over-reserve; release idempotent, never below 0). `returnIn` (re-enter layer(s) at the **original consumed unit costs**, `RETURN_IN`; `quantityOnHand += qty`). Every write stamps `balanceAfter` from the freshly-read onHand inside the passed `tx`. (plan §1.2, §3.1–3.3, §3.6–3.7)
- [ ] Impl (events): the tx-scoped event buffer — append `inventory.stockChanged { productId, onHand, reserved }` after every change + `inventory.lowStock { productId, available, threshold }` **edge-triggered** on the downward cross `available ≤ reorderThreshold`; expose the **post-commit flush seam** (buffer flushed after the owning `$transaction` resolves, discarded on rollback) that the injected callers and Sprint-3 adjustment path use. (plan §2.2, §3.5, §7.3)
- [ ] Impl (errors): `INSUFFICIENT_STOCK` → `ConflictError` (409) carrying `{ productId, requested, available }` in `details`; unknown product → `NotFoundError`; `isKnownRequestError` P2002/P2025 mapped. (plan §5 item 3, §7.6)
- [ ] Test: `test/unit/modules/inventory/inventory.service.spec.ts` (engine portion) — mock Prisma (incl. `$transaction`) + spy `@common/events/event-bus`: `10@100 + 10@150` consume `15` ⇒ **COGS 1750**, remaining **5@150**, correct consumption rows; over-consume ⇒ **409 `INSUFFICIENT_STOCK`, zero rows**; `reserve→release` restores available (onHand untouched); `returnIn` at **150, not avgCost**; `balanceAfter` chain under interleaving; invariants `onHand=Σmovements`, `Σremaining=onHand`, `reserved=ΣPENDING`; avgCost **IN-only**; `stockChanged` on every change, `lowStock` **only** on the downward threshold cross. (plan §4.2, §4.5)

**Validation**
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run test:unit` green (engine spec + prior suites).
- [ ] `npm run lint --no-color` clean.
- [ ] Engine writes movement rows **and** the `Product` columns inside the **passed `tx`** (never opens its own for injected paths); throws `AppError` subclasses; buffers events (no emit before commit); zero rows on `INSUFFICIENT_STOCK`; inventory is the sole writer of `quantityOnHand`/`quantityReserved`/`averageCost`.
- [ ] Committed on green (`api: inventory sprint 2 — fifo engine`).

---

### Sprint 3: Logic B — reads + adjustments (`InventoryReadService`)   — Status: ⬜ Pending

**Goals**
- Complete `inventory.service.ts`: `InventoryReadService` with `getStock` (+CSV), `listMovements`
  (filters + pagination), `listReservations` (PENDING aggregation), and `createAdjustment` (transaction:
  sequence + engine delegation + in-tx reprice + `adjusted` event). Replace the Sprint-2 stubs.

**Tasks**
- [ ] Impl: `InventoryReadService implements IInventoryReadService`; `constructor(prisma, sequence: ISequenceService, catalogPricing: ICatalogPricingPort)`. Replace the Sprint-2 stubs. (plan §2.1, §5 item 3)
- [ ] Impl (`getStock`): read `Product` rows → `toStockRowDto`; `lowStockOnly` filters to `isLow`; `export='csv'` returns `ExportResult { filename, mime, body }` (CSV of the `StockRowDto` columns, platform `exportFees` pattern); otherwise the row list (**unpaginated per contract** — `StockQuery` has no page/limit, plan §8 #4). (plan §3, §5.1, §7.4)
- [ ] Impl (`listMovements`): map `MovementsQuery` (`productId`/`type`/`from`/`to`/`staffId`) → Prisma `where`; paginate via `paginated()`; `select`/join `Product.name` + `Staff` + resolve `referenceLabel` → `toMovementDto`. (plan §1.1, §3 cross-cutting)
- [ ] Impl (`listReservations`): aggregate **live PENDING** movements grouped by `(productId, referenceType, referenceId)`, keep net `quantity > 0`; `holderType` from movement type; `ageHours` from the earliest reserve; paginate → `toReservationDto`. (plan §1.1)
- [ ] Impl (`createAdjustment`): single `$transaction` — `sequence.nextNumber(tx, DocType.ADJUSTMENT)`; create `StockAdjustment` + a `StockAdjustmentLine` per line (`previousQuantity`/`countedQuantity`/`delta = counted − previous`); **delta>0** ⇒ `engine.addLayer(tx, …, unitCost ?? currentAvgCost, ADJUSTMENT_IN, ref)` + if `line.prices` present `catalogPricing.applyPricing(tx, productId, prices)` **in the same tx**; **delta<0** ⇒ `engine.consumeFifo(tx, …, revenue=null, ADJUSTMENT_OUT, ref)` (⇒ `profit=null`); **delta=0** ⇒ reprice-only allowed. After commit: flush the engine's `stockChanged` buffer + emit `inventory.adjusted { reference, description }`. Return `toAdjustmentResultDto`. `note?` optional. (plan §3.4, §2.2)
- [ ] Test: extend `inventory.service.spec.ts` (reads + adjustment portion) — mock Prisma + mock `ISequenceService` + **mock `ICatalogPricingPort`** + spy event-bus: `getStock` levels/`stockValue`/`isLow` + `lowStockOnly` + CSV export shape; `listMovements` filters + pagination + `referenceLabel`; `listReservations` aggregation + `ageHours` + `holderType`; `createAdjustment` COUNT/DAMAGE mixed IN/OUT ⇒ `AdjustmentResultDto`, `ADJUSTMENT` sequence reference, IN-delta default cost = avgCost, reprice calls `applyPricing` **once, in-tx**, `ADJUSTMENT_OUT` `profit=null`, `inventory.adjusted` emitted once. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run test:unit` green (full service spec + prior suites).
- [ ] `npm run lint --no-color` clean.
- [ ] Every read-service method returns a `.parse()`d DTO; `createAdjustment` is transactional (sequence + engine + reprice atomic in one tx); `inventory.adjusted` emitted **after commit**; `Decimal→number` + `Date→ISO` at every boundary.
- [ ] Committed on green (`api: inventory sprint 3 — reads and adjustments`).

---

### Sprint 4: API — controller, routes, wiring, catalog cross-wiring, integration & conformance   — Status: ⬜ Pending

**Goals**
- Expose the HTTP surface, wire the composition root (admin guards, CSV export, exported
  `inventoryService` singleton), mount the router, complete the catalog↔inventory cross-wiring, and prove
  the module end-to-end + against the contract.

**Tasks**
- [ ] Impl: `src/modules/inventory/inventory.controller.ts` — thin; `try/catch → next(error)`; reads `req.validated`; `getStock` branches on `export==='csv'` (set `Content-Type: text/csv` + `Content-Disposition`, send the buffer — platform `exportFees` mirror) else `sendSuccess(rows)`; `createAdjustment` reads `req.user.staffId` → `sendSuccess(result, 201)`; reads → `sendSuccess(…, 200)`. (plan §5 item 5)
- [ ] Impl: `src/modules/inventory/inventory.routes.ts` — composition root: `const engine = new InventoryService(prisma)`; import `sequenceService` from `platform.routes` + `catalogPricingService` from `catalog.routes`; `const readService = new InventoryReadService(prisma, sequenceService, catalogPricingService)`; controller; register the 4 routes via `INVENTORY_ROUTES` constants + `validateRequest` per segment + the `admin` guard (`requireAuth({ types:[UserType.ADMIN], checkDB:true })`, plan §5.1 map); **`export const inventoryService = engine;`** for downstream DI; `export { router }`. (plan §5.1, §6)
- [ ] Impl (wiring): add `inventoryRouter` to `src/modules/index.ts` `registerModules` at the EXTENSION POINT. (plan §6)
- [ ] Impl (catalog-side enabling changes, cross-module — plan §6, §7.1–§7.2, §8 #5): (a) **widen catalog's `IInventoryPort.addLayer`** to carry `staffId` + `{ referenceType:'PRODUCT', referenceId: product.id }`; (b) **extract a tx-aware `applyPricing(tx, productId, cmd)`** from catalog's `updatePricing` (no event emit inside — the caller emits) and **export `catalogPricingService`**; (c) in `modules/index.ts`, inject the real `inventoryService` into catalog's product service via the one-line setter, **replacing `inventory.port.stub.ts`**. *(Inventory's own unit tests use a mock port, so these are needed only for real wiring + integration — not a blocker for Sprints 1–3.)*
- [ ] Test: `test/integration/inventory.integration.spec.ts` (real test DB, `ApiResponse` envelope asserted, admin guard 401/403) — `GET /stock` levels + `stockValue` + `isLow` + `lowStockOnly` + `export=csv` headers/body; `GET /movements` filters (product/type/date/staff) + pagination; `GET /reservations` holder + `ageHours`; `POST /adjustments` COUNT/DAMAGE mixed IN/OUT ⇒ real column deltas + `ADJUSTMENT` reference + an IN line with `prices` repricing the product **atomically** (assert via catalog read); over-consume adjustment ⇒ **409, no partial write**. Auth via `auth.fixture`. (plan §4.3)
- [ ] Test: cross-module engine proof (plan §4.5) — a mock caller runs the engine inside `prisma.$transaction`: **commit** ⇒ movements + column deltas persist + buffered events flush; **throw** ⇒ full rollback, nothing persists, no events. Also assert catalog's `createProduct` (`initialQuantity>0`) now writes a real `INITIAL_STOCK` movement via the swapped-in `inventoryService`.
- [ ] Test: extend `test/contract/routes.conformance.spec.ts` — every inventory response parses against its `*ResponseSchema`; every registered route uses an `INVENTORY_ROUTES` constant (no string literals); guarded routes resolve DB-free (mirror the identity/platform/observability/catalog blocks). (plan §4.4)

**Validation**
- [ ] `npx tsc --noEmit` clean; `npm run lint --no-color` clean.
- [ ] `npm run test:unit` green (incl. conformance).
- [ ] `npm run test:int` green against the test DB (routes wired, module mounted, catalog cross-wiring live).
- [ ] Routes use `INVENTORY_ROUTES` constants only (no string literals); all responses go through `sendSuccess`; the `admin` guard is on all four routes; `inventoryService` singleton exported and catalog's `inventory.port.stub.ts` swapped for it; the in-tx reprice is proven atomic.
- [ ] Committed on green (`api: inventory sprint 4 — api and wiring`).

---

## Definition of done (module) — 4 sprints

- `Apps/api/src/modules/inventory/` has the **5 core files** (mapper, interface, service, controller,
  routes) — **no listener**; `inventory.service.ts` co-locates the FIFO **engine** (`InventoryService`) +
  the **read/admin service** (`InventoryReadService`); `inventoryRouter` mounted via `registerModules`.
- Adds **zero contract types**; all four routes use `INVENTORY_ROUTES` constants and validate each
  segment against the contract schema; every service method returns a `.parse()`d DTO; `Decimal→number`
  + `Date→ISO` at every boundary.
- **FIFO correctness**: `10@100+10@150` consume `15` ⇒ COGS 1750 / layer 5@150; over-consume ⇒ 409
  `INSUFFICIENT_STOCK` with zero rows; `returnIn` at original cost; `reserve→release` restores available;
  `balanceAfter` chain holds under interleaving; invariants `onHand=Σmovements`, `Σremaining=onHand`,
  `reserved=ΣPENDING`; avgCost recomputed on IN only; inventory is the sole writer of the owned columns.
- **Adjustments** transactional: `ADJUSTMENT` sequence reference; IN-delta default cost = current avgCost;
  optional per-line reprice through catalog's tx-aware `applyPricing` in the **same tx**; `ADJUSTMENT_OUT`
  `profit=null`.
- **Events**: `stockChanged` on every change, `lowStock` edge-triggered on the downward threshold cross,
  `adjusted` once per document — all emitted **after commit** (buffered for injected paths); inventory
  **listens to nothing**.
- **`inventoryService` singleton exported** for downstream DI; catalog's stub swapped for it at the
  aggregator (its `IInventoryPort` widened with `staffId`, `catalogPricingService` exported).
- Unit + integration + conformance + cross-module engine suites green; each sprint committed on green in
  order.
