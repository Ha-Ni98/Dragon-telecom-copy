# Stage 02 · Sub-02 — Module Implementation Plan: `inventory`

> Set: inventory (the FIFO ledger — movements, layers, reserve/release/consume engine, adjustments).
> **Owns `Product.quantityOnHand` / `quantityReserved` / `averageCost`.** Reference module shape:
> `delivery-company` as realised by the built `identity`/`platform`/`observability`/`catalog` modules.
> 6-file architecture, manual DI, **no code yet**. Standing rules applied: **rules = HOW,
> phase = WHAT/WHEN, contract = WHICH**; every type/enum/route below was confirmed to already exist in
> `@dragon-telecom/contract` before being named (§0). HOW gaps are resolved toward the rules and flagged
> (§7–§8); none is a genuine authority-vs-authority conflict, so I did not stop to ask.

---

## 0. Pre-flight verification (standing rule: confirm nothing must be newly declared)

The **entire HTTP surface already exists** in `@dragon-telecom/contract/modules/inventory` — this module
adds **zero contract types**. Confirmed pre-existing:

- **Routes** — `INVENTORY_ROUTES` (`inventory.routes.ts`): `STOCK` (`/admin/inventory/stock`),
  `MOVEMENTS` (`/admin/inventory/movements`), `RESERVATIONS` (`/admin/inventory/reservations`),
  `ADJUSTMENTS` (`/admin/inventory/adjustments`). All four are distinct static paths — **no `:id`
  ordering hazard**.
- **Enums** (`inventory.enums.ts`): `MovementDirection` (`IN|OUT|PENDING`), `MovementType` (11 values:
  `SUPPLIER_INVOICE|INITIAL_STOCK|ADJUSTMENT_IN|RETURN_IN|SALE|ORDER_OUT|REPAIR_CONSUMPTION|ADJUSTMENT_OUT|PENDING_ORDER|PENDING_REPAIR|PENDING_RELEASE`),
  `AdjustmentReason` (`COUNT|DAMAGE|LOSS|CORRECTION`), `ReservationHolderType` (`ORDER|REPAIR`).
- **DTOs** (`inventory.dtos.ts`): `StockRowDto`, `MovementDto`, `ReservationDto`, `AdjustmentResultDto`
  (each with its `*ResponseSchema`). Note `MovementResponseSchema.referenceType` is an **open
  `z.string()`** (documented as AuditLog-style, not a Prisma enum).
- **Commands** (`inventory.command.ts`): `CreateAdjustmentCommand` — nests catalog's **real**
  `UpdatePricingSchema` (value import) for the optional per-line `prices` reprice payload.
- **Queries** (`inventory.query.ts`): `StockQuery` (`lowStockOnly?`, `export: 'csv'?`), `MovementsQuery`
  (`productId?/type?/from?/to?/staffId?` + `page`/`limit`), `ReservationsQuery` (pagination only).
- **Events (out)** — `InventoryEvents` (`inventory.events.ts`): `inventory.stockChanged { productId,
  onHand, reserved }`, `inventory.lowStock { productId, available, threshold }`, `inventory.adjusted
  { reference, description }`. The **event bus already merges `InventoryEvents`**
  (`common/events/event-bus.ts`); the **observability listener already subscribes to
  `inventory.adjusted`** (`observability.listener.ts:160`; `stockChanged`/`lowStock` are intentionally
  not audited). ⇒ **inventory only emits; it needs no `inventory.listener.ts`.**
- **Injected `SequenceService`** — `ISequenceService.nextNumber(tx, DocType)` exists
  (`platform.interface.ts`); **`DocType.ADJUSTMENT` exists** (`platform.enums.ts`); the singleton
  `sequenceService` is exported from `platform.routes.ts` for downstream DI.
- **Auth** — `UserType.ADMIN` exists; the built `admin` guard is
  `requireAuth({ types:[UserType.ADMIN], checkDB:true })` (platform/catalog precedent). All four routes
  are **admin** (spec API table).

**Prisma models** (all pre-built, `Apps/api/prisma/schema.prisma`): `StockMovement`,
`StockMovementConsumption`, `StockAdjustment`, `StockAdjustmentLine`, and the inventory-owned columns on
`Product` (`quantityOnHand`, `quantityReserved`, `averageCost`, `reorderThreshold`). `MovementDirection`
/ `MovementType` / `AdjustmentReason` exist as **Prisma enums with identical values** to the contract
enums (1:1 map, no translation needed).

> **The injected `InventoryService` is not a contract type.** The contract carries only the HTTP DTOs.
> The spec's "Injected service [CONTRACT]" block (reserve/release/addLayer/consumeFifo/returnIn) is a
> **cross-module runtime port** whose methods return **internal transactional shapes** (`{ movementId,
> costOfGoods, profit|null, consumptions[] }`), not DTOs. It is declared in `inventory.interface.ts`
> and exported as a composition-root singleton (§2.1, §6). This is the one place the module returns
> non-DTO values — mandated by the spec's connection rule and flagged in §8 #1.

---

## 1. Step 1 — Contract & Schema analysis

### 1.1 Prisma model ⇄ contract DTO mapping (`inventory.mapper.ts` — pure/static, never spreads the entity)

| DTO | Source | Convert / derive | Excluded / notes |
|---|---|---|---|
| `StockRowDto` | `Product` | `availableQuantity = quantityOnHand − quantityReserved`; `stockValue = quantityOnHand × averageCost`; `isLow = availableQuantity ≤ reorderThreshold`; `averageCost` `Decimal→number`; `barcode?` passthrough | admin-only surface ⇒ full visibility (cost included by design) |
| `MovementDto` | `StockMovement` + `Product.name` + `Staff` + derived label | `direction`/`type` Prisma enum → contract enum (**identical values**); `unitCost?`/`remainingQuantity?` (IN), `costOfGoods?`/`profit?` (OUT) `Decimal→number` **only when non-null** (else omit — `.optional()`); `balanceAfter` passthrough; `createdAt→ISO`; `productName` from join; `staffName = firstName + ' ' + lastName`; `referenceLabel` **derived** (§1.4, §8 #2) | `reason?` passthrough; `referenceType` stays open string |
| `ReservationDto` | aggregate of **live PENDING movements** grouped by `(productId, referenceType, referenceId)` | `quantity` = net open PENDING (Σ `PENDING_ORDER`/`PENDING_REPAIR` − `PENDING_RELEASE` for that holder, keep > 0); `holderType` from movement type (`PENDING_ORDER→ORDER`, `PENDING_REPAIR→REPAIR`); `holderReference` = `referenceLabel`/`referenceId`; `ageHours = (now − earliest reserve.createdAt)/3600000` | `productName` from join |
| `AdjustmentResultDto` | `StockAdjustment` + `StockAdjustmentLine[]` | `reference` passthrough; `lines[] = { productId, delta (signed), movementId }` (the `StockMovement` id written for that line) | — |

Each `toDto` ends with `XxxResponseSchema.parse(dto)` (dev/test conformance guard, rules §4). Money
leaves as `number` (`Decimal.toNumber()`); `Date` leaves as `.toISOString()`.

### 1.2 The FIFO engine — the core reused logic (spec §Business Logic)

One cohesive engine backs both the injected port and the internal adjustment path:

- **`addLayer` (IN)** — insert a `StockMovement` (`direction=IN`, `remainingQuantity = quantity`,
  `unitCost`); recompute `averageCost = (oldQty×oldAvg + inQty×unitCost)/(oldQty+inQty)` (**IN only**,
  spec BL#3); `quantityOnHand += qty`; `balanceAfter = new onHand`.
- **`consumeFifo` (OUT)** — precondition `qty ≤ onHand − reserved` else **409 `INSUFFICIENT_STOCK
  { productId, requested, available }`** with **zero rows written**; drain oldest `IN` layers with
  `remainingQuantity > 0` (FIFO by `createdAt`), writing a `StockMovementConsumption` per drained layer
  and decrementing its `remainingQuantity`; `costOfGoods = Σ(consumed × layerUnitCost)`;
  `profit = revenue − costOfGoods` when `revenue` given, else `null` (ADJUSTMENT_OUT); `quantityOnHand −= qty`.
- **`reserve` (PENDING)** — write `PENDING_ORDER`/`PENDING_REPAIR`; `quantityReserved += qty`
  (**onHand unchanged**); reject if `qty > onHand − reserved`.
- **`release` (PENDING)** — write `PENDING_RELEASE`; `quantityReserved −= qty` (idempotent by
  source-document id — never drive reserved below 0).
- **`returnIn` (IN)** — re-create layer(s) at the **original consumed unit costs** (from the passed
  `originalConsumptions`, **not** current avgCost — spec Test Scenarios); `type=RETURN_IN`;
  `quantityOnHand += qty`.

Invariants the engine preserves (spec Test Scenarios): `onHand = Σ(IN/OUT signed movements)`;
`Σ(live remainingQuantity) = onHand`; `reserved = Σ(open PENDING signed)`. Every write sets
`balanceAfter` from the **current** onHand read inside the caller's tx (serialised) → correct
`balanceAfter` chain under interleaving.

### 1.3 Money / enum / derived columns

- **Money**: all `Decimal(12,2)` (`unitCost`, `costOfGoods`, `profit`, `averageCost`) → `number` via
  `.toNumber()` at the mapper boundary. DZD, cash-only, **no payment field** anywhere (spec Shared
  Conventions).
- **Enums**: Prisma `MovementDirection`/`MovementType`/`AdjustmentReason` map 1:1 onto the contract enums
  (same string values) — a plain `as`-cast in the mapper, no lookup table.
- **Derived (never persisted)**: `availableQuantity`, `stockValue`, `isLow`, `ageHours`,
  reservation `quantity`.

### 1.4 `referenceLabel` derivation (no stored column — §8 #2)

`StockMovement` stores `referenceType` + `referenceId` but **no `referenceLabel`** column, while
`MovementDto.referenceLabel` is required. The mapper/service composes it **best-effort** via a
per-`referenceType` resolver: `ADJUSTMENT → StockAdjustment.reference`, `PRODUCT → Product.name`
(INITIAL_STOCK), `SUPPLIER_INVOICE → SupplierInvoice.reference`; **fallback** `` `${referenceType}
${referenceId.slice(0,8)}` `` for document types whose modules are not yet built (SALE/ORDER/REPAIR/
RETURN). The resolver is extended as those modules land — the read endpoint stays decoupled from
unbuilt modules. Flagged §8 #2.

---

## 2. Step 2 — Component definition

### 2.1 Interfaces (`inventory.interface.ts`) — one HTTP surface + one injected engine port

Following the **platform/catalog precedent** (multiple cohesive interfaces, one `service.ts` file):

- **`IInventoryReadService`** (HTTP-facing, returns **contract DTOs** — rules §4 honoured):
  - `getStock(query: StockQuery): Promise<StockRowDto[] | ExportResult>` — `export='csv'` returns the
    platform-style `ExportResult { filename, mime, body }` (§5.1, §7.4); else the row list
    (admin, small N — see §8 #4 on pagination).
  - `listMovements(query: MovementsQuery): Promise<PaginatedResult<MovementDto>>`.
  - `listReservations(query: ReservationsQuery): Promise<PaginatedResult<ReservationDto>>`.
  - `createAdjustment(cmd: CreateAdjustmentCommand, staffId: string): Promise<AdjustmentResultDto>`.
- **`IInventoryService`** (the injected engine — **tx-aware, spec-mandated internal returns**, §8 #1):
  - `reserve(tx, productId, qty, ref): Promise<void>`
  - `release(tx, productId, qty, ref): Promise<void>`
  - `addLayer(tx, productId, qty, unitCost, type, ref): Promise<{ movementId: string }>`
  - `consumeFifo(tx, productId, qty, revenue: number | null, type, ref): Promise<{ movementId; costOfGoods; profit: number | null; consumptions: { inMovementId; qty; unitCost }[] }>`
  - `returnIn(tx, originalConsumptions, qty, ref): Promise<{ movementId: string }>`
  - **`MovementRef`** (internal type, declared here — not contract): `{ referenceType: string;
    referenceId: string; staffId: string; reason?: string }`. Carries the acting-staff identity the
    Prisma `StockMovement.staffId` (required) needs and the `referenceType`/`referenceId` provenance;
    this is why the engine takes `ref` rather than the spec's bare positional (§8 #3).
- **`ICatalogPricingPort`** (injected **dependency inventory needs**, implemented by catalog) —
  `applyPricing(tx, productId, cmd: UpdatePricingCommand): Promise<void>`. Lets an adjustment line's
  `prices` reprice run **inside inventory's transaction** (spec BL#4). Declaring the port here inverts
  the dependency (§7.1, §8 #5).

Controllers depend on `IInventoryReadService`; the read service injects `PrismaClient` +
`ISequenceService` + `ICatalogPricingPort`; the engine injects `PrismaClient`. Everything linked in
`inventory.routes.ts`.

### 2.2 Events

- **Emits (payloads contract-typed, emitted after the owning transaction commits — §7.3):**
  - `inventory.stockChanged { productId, onHand, reserved }` — after **every** engine call that moves a
    product's stock/reservation.
  - `inventory.lowStock { productId, available, threshold }` — **edge-triggered** when `available`
    crosses from `> reorderThreshold` to `≤ reorderThreshold` (spec BL#5; avoids re-emitting while it
    stays low).
  - `inventory.adjusted { reference, description }` — once per adjustment document (audit narrates it).
- **Listens: nothing** (spec §Events — state changes arrive only through the injected engine; events
  can't return FIFO results and splitting the tx could leave a sale without its movement). ⇒ **no
  `inventory.listener.ts`.**
- **Emit-after-commit seam (§7.3):** for the **injected** engine paths the caller owns the tx boundary,
  so the engine appends its `stockChanged`/`lowStock` payloads to a tx-scoped buffer that is **flushed
  after the caller's `$transaction` resolves**; inventory's own `createAdjustment` (which owns its tx)
  flushes after its own commit and then emits `inventory.adjusted`.

---

## 3. Business logic (the HOW behind the methods) — spec §Business Logic

1. **Every engine call writes movement rows AND the `Product` quantity/`averageCost` columns inside the
   caller's transaction**, stamping `balanceAfter` from the freshly-read onHand (BL#1). The columns are
   **inventory-owned** — this module is the only writer (catalog reads them, spec §catalog).
2. **`consumeFifo`** drains oldest `remainingQuantity > 0` layers, writes `StockMovementConsumption`
   rows, and rejects **409 `INSUFFICIENT_STOCK { productId, requested, available }`** when
   `qty > onHand − reserved` — **zero rows on rejection** (BL#2, transactional). `available` accounts
   for reservations, so reserved stock can't be sold twice.
3. **`averageCost` on IN only**: `(oldQty×oldAvg + inQty×unitCost)/(oldQty+inQty)` (BL#3). OUT/PENDING
   never touch avgCost. Guard `oldQty+inQty = 0`.
4. **Adjustments** (single `$transaction`, `createAdjustment`):
   - Allocate `reference` via `sequenceService.nextNumber(tx, DocType.ADJUSTMENT)`.
   - Create `StockAdjustment` + a `StockAdjustmentLine` per line (`previousQuantity`, `countedQuantity`,
     `delta = counted − previous`).
   - **IN delta** (`delta > 0`): `addLayer(tx, …, unitCost ?? currentAvgCost, ADJUSTMENT_IN, ref)`
     (default cost = current avgCost, BL#4); if `line.prices` present, `catalogPricing.applyPricing(tx,
     productId, prices)` **in the same tx** (atomic reprice — spec Test Scenarios "Adjustment reprice
     atomic").
   - **OUT delta** (`delta < 0`): `consumeFifo(tx, …, revenue=null, ADJUSTMENT_OUT, ref)` ⇒ **`profit =
     null`** (spec Test Scenarios "ADJUSTMENT_OUT profit null").
   - `delta = 0`: no movement (still allowed to carry a reprice-only line).
   - After commit: emit `inventory.adjusted { reference, description }` + the per-line `stockChanged`.
   - `note?` optional (spec Shared Conventions).
5. **Low-stock check after every change**; emit `inventory.lowStock` on the downward cross of
   `available ≤ reorderThreshold` (BL#5, edge-triggered §2.2).
6. **Reservations lifecycle**: `reserve` raises `quantityReserved` (not onHand); `release` lowers it;
   both idempotent by source-document id (a repeated release for an already-released holder is a no-op),
   so the connection rule's "listener idempotent by source-document id" holds symmetrically for the
   injected caller.
7. **Returns** re-enter stock at the **original consumed cost** via `returnIn` (BL / Test Scenarios),
   preserving FIFO cost accuracy rather than re-valuing at current avgCost.

**Cross-cutting:** `listMovements`/`listReservations` paginate via their contract queries + the
`paginated()` factory; `MovementsQuery` filters (`productId`/`type`/`from`/`to`/`staffId`) map to a
Prisma `where`; `select` fetches only needed columns; every state mutation emits the event the audit
module narrates (BL / Shared Conventions).

---

## 4. Step 3 — Test strategy (`test-rules.md`)

### 4.1 Factories (`test/data/`, contract-shaped)

`stock-movement.factory.ts` (IN layer + OUT + PENDING variants), `stock-adjustment.factory.ts`
(command + persistence), reuse the existing `product.factory.ts`/`staff.factory.ts` (add if a
`staff.factory` is absent, for `staffId`/`staffName`). Each returns a valid persistence payload and a
matching command payload.

### 4.2 Unit (`test/unit/modules/inventory/`, mock Prisma + spy `eventBus`)

- **`inventory.mapper.spec.ts`** — each `toDto` parses its schema; `Decimal→number`, `Date→ISO`,
  `availableQuantity`/`stockValue`/`isLow` math; `direction`/`type` enum passthrough;
  `staffName = firstName + lastName`; optional `unitCost`/`costOfGoods`/`profit`/`remainingQuantity`
  omitted when null; `referenceLabel` resolver incl. fallback.
- **`inventory.service.spec.ts`** — the **spec's FIFO scenarios verbatim**:
  - Layers `10@100 + 10@150`, consume `15` ⇒ **COGS 1750**, remaining layer **5@150** (older layer
    fully drained, `StockMovementConsumption` rows correct).
  - Over-consume (`qty > available`) ⇒ **409 `INSUFFICIENT_STOCK`**, **zero rows** written (assert no
    movement/consumption persisted).
  - `reserve` then `release` **restores available**; `quantityReserved` returns to baseline; onHand
    untouched.
  - `returnIn` re-enters at **150 (original cost), not avgCost**.
  - `balanceAfter` chain correct under interleaved calls.
  - Invariants: `onHand = Σ movements`; `Σ remaining = onHand`; `reserved = Σ PENDING`.
  - `ADJUSTMENT_OUT` ⇒ `profit = null`; adjustment reprice calls `catalogPricing.applyPricing` **once,
    in-tx** (mock the port); IN-delta default cost = current avgCost.
  - `stockChanged` emitted on every change; `lowStock` emitted **only** on the downward threshold cross
    (spy `eventBus`); `adjusted` emitted once per adjustment.

### 4.3 Integration (`test/integration/inventory.integration.spec.ts`, real test DB, envelope asserted)

Hit the real `/api/admin/inventory/*` prefix via Supertest; assert the `ApiResponse` envelope and admin
guard (401/403 without an ADMIN token). Cover: `GET /stock` levels + `stockValue` + `isLow`, and
`lowStockOnly=true` filter; `GET /stock?export=csv` returns CSV headers/body; `GET /movements` filters
(product/type/date/staff) + pagination; `GET /reservations` holder + `ageHours`; `POST /adjustments`
COUNT/DAMAGE with mixed IN/OUT lines ⇒ `AdjustmentResultDto`, real column deltas, `ADJUSTMENT` sequence
`reference`, and an IN line with `prices` repricing the product **atomically** (assert via catalog
read). Over-consume adjustment ⇒ 409, no partial write. Auth via `auth.fixture`.

### 4.4 Contract conformance (`test/contract/routes.conformance.spec.ts`)

Extend the existing suite: every inventory response parses against its `*ResponseSchema`; every
registered route uses an `INVENTORY_ROUTES` constant (no string literals).

### 4.5 Cross-module (engine) test

A focused spec proving the injected engine runs **inside a caller's tx**: a mock caller opens
`prisma.$transaction`, calls `addLayer`/`consumeFifo`, and either commits (movements + column deltas
persist, buffered events flush) or throws (full rollback, **nothing** persists, **no** events emitted) —
guarantees "a sale without its movement" can never happen (spec §Events rationale).

---

## 5. Step 4 — File checklist (create only what the module needs)

Inside `Apps/api/src/modules/inventory/`, in order:

1. **`inventory.mapper.ts`** — pure/static: `toStockRowDto`, `toMovementDto(mvmt, product, staff,
   refLabel)`, `toReservationDto(group, product)`, `toAdjustmentResultDto(adj, lines)`. `Decimal.toNumber()`,
   `Date.toISOString()`, enum casts, derived fields; each ends `…ResponseSchema.parse(dto)`.
2. **`inventory.interface.ts`** — `IInventoryReadService`, `IInventoryService` (+ internal `MovementRef`
   / result types), `ICatalogPricingPort` (§2.1).
3. **`inventory.service.ts`** — `InventoryService` (the engine; injects `PrismaClient`; `reserve/
   release/addLayer/consumeFifo/returnIn`; buffers domain events) **and** `InventoryReadService`
   (injects `PrismaClient` + `ISequenceService` + `ICatalogPricingPort`; `getStock`/`listMovements`/
   `listReservations`/`createAdjustment`, the last delegating to the engine), co-located, each
   `implements` its interface. Throws `AppError` subclasses (`ConflictError` for `INSUFFICIENT_STOCK`
   with `{ productId, requested, available }` detail; `NotFoundError` for unknown product);
   `isKnownRequestError` (P2002/P2025) mapped; emits `InventoryEvents` after commit. *(Co-location keeps
   the strict single service file — platform §8.7 / catalog §5 precedent.)*
4. *(no `inventory.listener.ts` — inventory listens to nothing; observability owns `inventory.adjusted`.)*
5. **`inventory.controller.ts`** — thin; `try/catch → next(error)`; reads `req.validated`; `getStock`
   branches on `export==='csv'` to set `Content-Type`/`Content-Disposition` and send the buffer (mirrors
   platform `exportFees`); `createAdjustment` reads `req.user.staffId`; `sendSuccess` (`201` adjustment,
   `200` reads).
6. **`inventory.routes.ts`** — composition root: `const engine = new InventoryService(prisma)`;
   `const readService = new InventoryReadService(prisma, sequenceService, catalogPricingService)`;
   controller; four route registrations using `INVENTORY_ROUTES` + `validateRequest` per segment + the
   `admin` guard. **`export const inventoryService = engine;`** for downstream document-module DI
   (§6). `export { router }`.

### 5.1 Route registration map (guards + validation)

| Route const | Method | Guard | `validateRequest` |
|---|---|---|---|
| `STOCK` | GET | `admin` | `{ query: StockQuerySchema }` |
| `MOVEMENTS` | GET | `admin` | `{ query: MovementsQuerySchema }` |
| `RESERVATIONS` | GET | `admin` | `{ query: ReservationsQuerySchema }` |
| `ADJUSTMENTS` | POST | `admin` | `{ body: CreateAdjustmentSchema }` |

`admin = requireAuth({ types:[UserType.ADMIN], checkDB:true })` (the built pattern). No route-ordering
hazard (all paths static).

---

## 6. Wiring (the real extension point)

Add `inventoryRouter` to the aggregator `Apps/api/src/modules/index.ts` at the `EXTENSION POINT
(modules)`: `apiRouter.use(inventoryRouter)`. `INVENTORY_ROUTES` paths compose under `env.API_PREFIX`
(`/api`) to `/api/admin/inventory/stock`, `/movements`, `/reservations`, `/adjustments` — exactly per
spec.

**Injected `inventoryService` singleton** — exported from `inventory.routes.ts` on the shared `prisma`,
mirroring platform's `sequenceService`/`deliveryFeeService` export (plan-platform §6). Consumers
(catalog INITIAL_STOCK · purchasing addLayer · orders/sales/repairs reserve/release/consume/returnIn ·
adjustments internal) import it into their own composition roots.

**Catalog ↔ inventory cross-wiring (breaking the cycle — §7.1, §8 #5).** Two cross edges exist:
catalog needs inventory's `addLayer` (INITIAL_STOCK); inventory needs catalog's tx-aware
`applyPricing`. To keep a **single import direction** and avoid a require cycle:
`inventory.routes.ts` **imports `catalogPricingService`** from `catalog.routes.ts` (inventory → catalog,
one way); the real `inventoryService` is injected into catalog's product service **at the aggregator**
(`modules/index.ts`, one-line setter `catalogProductService.useInventory(inventoryService)`), replacing
catalog's `inventory.port.stub.ts`. Catalog must (a) **widen `IInventoryPort`** so `addLayer` passes
`staffId` + `{ referenceType:'PRODUCT', referenceId: product.id }` (the stub's own TODO — it currently
carries no acting-staff identity), and (b) **export a `catalogPricingService`** implementing
`ICatalogPricingPort.applyPricing(tx, productId, cmd)` (a thin tx-aware extract of its existing
`updatePricing`). Both are catalog-side follow-ups coordinated here, not inventory files.

---

## 7. Prerequisites / dependencies outside the 6 files (flagged)

1. **Catalog↔inventory bidirectional injection — DECIDED: dependency-inversion + aggregator wiring.**
   Inventory defines `ICatalogPricingPort` (the port it needs) and imports catalog's exported
   `catalogPricingService`; the real `inventoryService` is injected into catalog at `modules/index.ts`
   via a one-line setter, replacing `inventory.port.stub.ts`. The one cross-edge that uses **setter (not
   constructor) injection** is a controlled exception to rules §3 (§8 #5). No sprint is blocked — until
   catalog exposes `applyPricing`, adjustment-with-reprice tests inject a **mock port**.
2. **Catalog must expose a tx-aware `applyPricing(tx, productId, cmd)`.** Catalog's current
   `updatePricing(id, cmd)` owns its own write and **is not tx-aware**, so it can't run inside
   inventory's adjustment transaction. Catalog adds a tx-accepting `applyPricing` (extract of its
   pricing upsert, no event emit inside — the caller emits) and exports it as `catalogPricingService`.
   Catalog-side follow-up, flagged for that module's next sprint.
3. **Emit-after-commit for injected engine paths — DECIDED: tx-scoped buffer + post-commit flush.** The
   engine can't emit after a commit it doesn't own, so it buffers `stockChanged`/`lowStock` payloads
   keyed to the caller's tx and flushes them once `$transaction` resolves; on rollback the buffer is
   discarded (no phantom events). Inventory's own `createAdjustment` flushes after its commit. Resolves
   the spec's "emitted after commit" + "listener idempotent by source-document id" toward the rules
   without a new infra dependency. Flagged §8 #6.
4. **CSV export for `GET /stock?export=csv`.** Reuse the platform `ExportResult { filename, mime, body }`
   controller pattern (`Content-Type: text/csv` + `Content-Disposition`); no new dependency. Columns =
   the `StockRowDto` fields. Non-CSV responses are the plain row list (§8 #4).
5. **`StockMovement.staffId` is required on every row.** The injected engine takes `ref: MovementRef`
   carrying `staffId` (the acting user); document callers pass their `req.user.staffId`, catalog's
   INITIAL_STOCK passes the creating admin's `staffId` (needs the port widening, §6). `MovementRef` is
   an **internal** interface type (not contract), declared in `inventory.interface.ts`. Flagged §8 #3.
6. **Symbolic error code `INSUFFICIENT_STOCK` not in `ErrorCode`.** Mapped to `ConflictError` (409) with
   the symbolic name in the message + `{ productId, requested, available }` in `details` — same pattern
   as catalog's `CATEGORY_IN_USE` / identity's `LAST_ADMIN_PROTECTED`. **No contract change.**

---

## 8. Deviations & open decisions (resolved toward the rules; noted per standing rules)

| # | Item | Resolution |
|---|---|---|
| 1 | **Injected `IInventoryService` methods return non-DTO shapes** (`{ movementId, costOfGoods, profit, consumptions[] }`), conflicting with rules §4 "methods return DTOs". | **Resolved toward the contract (WHICH).** The spec's connection rule *defines* these internal returns (events can't carry FIFO results back into the caller's tx). The **HTTP-facing `IInventoryReadService` strictly returns contract DTOs** (rules §4 honoured there); only the injected engine returns the spec-mandated transactional shapes. Not an authority conflict — the contract explicitly specifies it. |
| 2 | **`MovementDto.referenceLabel` has no backing column.** | Derived best-effort at read time via a per-`referenceType` resolver with a `` `${type} ${shortId}` `` fallback for unbuilt document modules (§1.4). Alternative (denormalise a `referenceLabel` column) is a schema change the spec's `StockMovement` column list doesn't include — avoided. **Flagged.** |
| 3 | **Spec's injected signatures use bare positional `ref`; the engine needs `staffId`.** | `ref` is modelled as an internal `MovementRef { referenceType, referenceId, staffId, reason? }` so the required `StockMovement.staffId` and provenance are carried without a contract type. **Flagged.** |
| 4 | **`GET /stock` returns an unpaginated array** (contract `StockRowResponseSchema` is a bare object, `StockQuery` has no `page`/`limit`). | The stock view is the full catalogue snapshot (+ CSV export) — the contract deliberately omits pagination here, unlike movements/reservations. Return the full list per the contract; revisit if the owner wants it paginated (would be a contract change). **Flagged.** |
| 5 | **Catalog↔inventory cycle uses one setter injection.** | Single import direction (inventory → catalog for pricing); the reverse edge (inventory → catalog's product service) is injected at the aggregator via a setter — a controlled exception to constructor-only DI (rules §3), chosen over a fragile require cycle. Catalog also widens `IInventoryPort` (staffId) and exports `applyPricing`/`catalogPricingService` (§6, §7.1–2). **Flagged for catalog's next sprint.** |
| 6 | **Emit-after-commit on injected paths** where inventory doesn't own the tx. | Tx-scoped event buffer flushed post-commit (§7.3); discarded on rollback. Honours "emitted after commit" + idempotent listeners with no new infra. **Flagged.** |
| 7 | **`stockChanged`/`lowStock` currently have no subscriber** (observability audits only `inventory.adjusted`). | Emit unconditionally anyway (spec §Events) — the dashboard/statistics module is the intended future consumer; emitting is the producer's contract regardless of present listeners. |

No item rises to a genuine authority-vs-authority conflict, so per the standing rules I did not stop to
ask — each is resolved toward the rules/contract and flagged for the owner.

---

## 9. Definition of done

- `Apps/api/src/modules/inventory/` has **5 files** (mapper, interface, service, controller, routes);
  **no listener**. `inventory.service.ts` provides the FIFO **engine** (`InventoryService`) + the
  **read/admin service** (`InventoryReadService`).
- `inventoryRouter` mounted via `registerModules`; all four routes use `INVENTORY_ROUTES` constants (no
  string literals) and validate each segment against the contract schema; every response parses against
  its `*ResponseSchema` (mapper-enforced); `Decimal→number` and `Date→ISO` at every boundary.
- **FIFO correctness**: `10@100+10@150` consume `15` ⇒ COGS 1750 / layer 5@150; over-consume ⇒ 409
  `INSUFFICIENT_STOCK` with zero rows; `returnIn` at original cost; `reserve→release` restores available;
  `balanceAfter` chain holds under interleaving; invariants `onHand=Σmovements`, `Σremaining=onHand`,
  `reserved=ΣPENDING` all hold.
- **avgCost recomputed on IN only**; **inventory is the sole writer** of `quantityOnHand`/
  `quantityReserved`/`averageCost`.
- **Adjustments** transactional: `ADJUSTMENT` sequence reference; IN-delta default cost = current
  avgCost; optional per-line reprice applied through catalog's `applyPricing` **in the same tx**;
  ADJUSTMENT_OUT `profit=null`.
- **Events**: `stockChanged` on every change, `lowStock` edge-triggered on the downward threshold cross,
  `adjusted` once per document — all emitted **after commit** (buffered for injected paths); inventory
  **listens to nothing**.
- **`inventoryService` singleton exported** for downstream DI; catalog's `inventory.port.stub.ts` swapped
  for it at the aggregator (catalog port widened with `staffId`).
- Unit + integration + conformance + cross-module engine suites green.
