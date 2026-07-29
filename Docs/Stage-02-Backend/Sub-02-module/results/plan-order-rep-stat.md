# Stage 02 · Sub-02 — Module Implementation Plan: `orders` + `repairs` + `statistics` (set 07)

> Three modules planned together because they close the transactional core: `orders` and
> `repairs` are the last two **document** modules (they reserve/consume stock through the same
> injected `InventoryService`/`SequenceService` seams as `sales`/`purchasing`, and emit the events
> that `billing`/`sales`/`clients` already listen for), and `statistics` is the **read-only**
> aggregator that finally reads every stored figure those documents leave behind. Planning them as
> one set makes the emit→consume and write→read contracts explicit in one place. **No code in this
> document.** Files are created in a later sprint sub-stage.
>
> Standing-rule resolution: **rules** (`module-implementation-rules.md`) govern HOW, the **phase
> file** WHAT/WHEN, the **contract** (`@dragon-telecom/contract`) WHICH. Everything the contract
> already declares is reused verbatim; nothing below re-declares a DTO/Command/Query/route/enum/
> event. HOW-conflicts are resolved toward the rules and noted in §D. Genuine **prerequisite gaps**
> (spec prose needing something the frozen contract/schema does not directly provide) are surfaced
> in §C with a recommended resolution rather than halting — same working style as sets 05/06.

---

## 0. Pre-flight verification (standing rule: confirm nothing must be newly declared)

Confirmed already present in `@dragon-telecom/contract` (barrel re-exports all three — `src/index.ts` exports `./modules/orders`, `./modules/repairs`, `./modules/statistics`); **reused verbatim, never re-declared**:

**orders** (`modules/orders/`)
- Routes: `ORDER_ROUTES` — `PLACE`, `MY_LIST`, `MY_CANCEL`, `STAFF_LIST`, `ADMIN_LIST`, `STAFF_CONFIRM`, `ADMIN_CONFIRM`, `STAFF_STATUS`, `ADMIN_STATUS`, `CANCEL`, `RETURN`, `STAFF_STATS`, `ADMIN_STATS`. *(The `(staff|admin)` rows are already split into `STAFF_*`/`ADMIN_*` literal pairs — do not add a combined route.)*
- Commands: `PlaceOrderSchema`, `ConfirmOrderSchema`, `UpdateOrderStatusSchema`, `ReturnOrderSchema`. *(`PlaceOrderSchema` already carries both delivery-block refinements — required unless PICKUP, forbidden when PICKUP.)*
- Queries/params: `MyOrdersQuerySchema`, `BackofficeOrdersQuerySchema` (paginated: `page`/`limit`/`status`/`search`), `OrderIdParamsSchema`. *(No `OrderStatsQuery` — STATS takes no query params, by contract comment.)*
- DTOs: `OrderResponseSchema`/`OrderDto`, `OrderStatsResponseSchema`/`OrderStatsDto` (per-status count roll-up).
- Enums: `OrderStatus` (PENDING/CONFIRMED/PACKAGED/IN_DELIVERY/COMPLETED/CANCELLED/RETURNED), `OrderType` (PICKUP/DELIVERY_HOME/DELIVERY_OFFICE).
- Events: `OrdersEvents` — **emits** `order.confirmed`, `order.placed`, `order.statusChanged`, `order.cancelled`, `order.returned`; **listens** `payment.clientRecorded` (documented in the spec; payload owned by `billing`, see §C-2).

**repairs** (`modules/repairs/`)
- Routes: `REPAIR_ROUTES` — `STAFF_LIST`/`ADMIN_LIST`, `STAFF_CREATE`/`ADMIN_CREATE`, `STAFF_UPDATE`/`ADMIN_UPDATE`, `STAFF_PARTS`/`ADMIN_PARTS`, `STAFF_PART_BY_ID`/`ADMIN_PART_BY_ID`, `STAFF_STATUS`/`ADMIN_STATUS`. *(Every `(staff|admin)` row already split — do not add combined.)*
- Commands: `CreateRepairSchema`, `UpdateRepairSchema` (all-optional PATCH), `AddRepairPartSchema`, `RepairStatusSchema` (with `consumedPartReturns?`).
- Queries/params: `RepairListQuerySchema` (`status?`/`technicianId?`), `RepairIdParamsSchema`, `RepairPartParamsSchema` (`id`+`partId`).
- DTOs: `RepairResponseSchema`/`RepairDto` (with `parts[]` and `history[]`).
- Enums: `RepairStatus` (INTAKE/PROCESSING/COMPLETED/PICKED_UP/CANCELLED), `ReportedIssue` (charging…other).
- Events: `RepairsEvents` — **emits** `repair.pickedUp`, `repair.statusChanged`, `repair.cancelled`; **listens none**.

**statistics** (`modules/statistics/`)
- Routes: `STATS_ROUTES` — `ADMIN_DASHBOARD`, `STAFF_DASHBOARD`, `OVERVIEW`, `FILTERED`, `CHARTS` (`/:chart`), `TOP_PRODUCTS`, `REPORT` (`/:type`).
- Queries/params: `FilteredQuerySchema`, `ChartsQuerySchema`, `ChartParamsSchema` (`ChartType`), `TopProductsQuerySchema` (`period?` free string), `ReportQuerySchema` (`from`/`to`/`groupBy`/`format`), `ReportParamsSchema` (`ReportType`).
- DTOs: `OverviewResponseSchema`/`OverviewDto`, `FilteredResponseSchema`/`FilteredDto`, `ReportResponseSchema`/`ReportDto`, `AdminDashboardResponseSchema`/`AdminDashboardDto`, `StaffDashboardResponseSchema`/`StaffDashboardDto`.
- Enums: `ReportType` (9 values), `ChartType` (revenue/orders/clients/sales-by-family), `ReportFormat` (table/csv).
- Events: **none** (listens none, emits none — the contract exports no `StatisticsEvents`, and the event-bus union deliberately omits it).

**Foundations reused (never redefined):** `@common/db/prisma`, `@common/middlewares` (`validateRequest`, `requireAuth`), `@common/http/response` (`sendSuccess`), `@common/events/event-bus` (typed `eventBus` — already unions `OrdersEvents` + `RepairsEvents`; `statistics` needs no bus), `@common/errors` (`AppError`, `NotFoundError`, `ConflictError`, `BadRequestError`, `ForbiddenError`), `paginated(schema)` factory + `PaginationMeta` (`common/types`), the shared `toMoney` `Decimal → number` helper pattern (mirror sales/purchasing/inventory mappers).

**Injected singletons already exported by built modules (direct sibling import — set 05/06 one-directional precedent, no adapter in `modules/index.ts`):**
- `sequenceService` (`platform.routes`) — `ISequenceService.nextNumber(tx, DocType)`.
- `deliveryFeeService` (`platform.routes`) — `IDeliveryFeeService.resolve(wilayaId, communeId|null, 'home'|'office')`. **orders only.**
- `inventoryService` (`inventory.routes`) — `IInventoryService` (`reserve`/`release`/`consumeFifo`/`returnIn`/`flushEvents`). **orders + repairs.**

**Enums confirmed present — nothing to add this set (contrast set 06, which had to extend `DocType`):**
- `DocType.ORDER`, `DocType.REPAIR` — both present; `nextNumber(tx, DocType.ORDER|REPAIR)` reused as-is.
- `MovementType.ORDER_OUT`, `MovementType.REPAIR_CONSUMPTION`, `MovementType.PENDING_ORDER`, `MovementType.PENDING_REPAIR`, `MovementType.PENDING_RELEASE`, `MovementType.RETURN_IN` — all present. Reservation type is derived by the engine from `MovementRef.referenceType` (`'ORDER'`→`PENDING_ORDER`, `'REPAIR'`→`PENDING_REPAIR`); `reserve`/`release` take **no** `type` argument (see `InventoryService.reservationType`). So orders passes `referenceType:'ORDER'`, repairs passes `referenceType:'REPAIR'`.

**Prisma models present** (`schema.prisma`, built in Stage 01):
- orders: `Order` (single-product — line folded into the row: `productId`/`productNameSnapshot`/`quantity`/`resolvedPrice`/`unitPrice`/`serialNumbers`; `@@index([status, placedAt])`, `@@index([clientId])`); reads of `Product`, `Wilaya`, `Commune`, `Client` (→ `posClientId`), `Staff`.
- repairs: `Repair` (`saleId @unique`), `RepairPart`, `RepairStatusHistory` (`fromStatus`/`toStatus`/`staffId`/`changedAt`); reads of `Product`, `Brand`, `DeviceModel`, `Technician`, `PosClient`, `Staff`.
- statistics: read-only across `Sale`+`SaleLine`, `Order`, `Invoice`, `ClientPayment`, `StockMovement`+`StockMovementConsumption`, `Product`, `Repair`+`RepairPart`, `Client`, `PosClient`, `Supplier`+`SupplierInvoice`+`SupplierPayment`, `Staff`, and observability's `StaffSearchLog`/`ClientActivityLog` (for `client-browsing`).

**Page keys present** (`PageKey`, identity enums): `STAFF_ORDERS`, `STAFF_REPAIRS`. `STAFF_DASHBOARD` needs **no** page key (any STAFF, scoped to self).

**Consumers already wired and dormant — these three modules therefore only EMIT / are only READ; none of them calls another module directly:**
- `observability.listener.ts` already narrates every order/repair event: `order.confirmed`, `order.placed`, `order.statusChanged`, `order.cancelled`, `order.returned`, `repair.pickedUp`, `repair.statusChanged`, `repair.cancelled` → `AuditLog`. Wake automatically on first emit.
- `billing.listener.ts` already listens `order.confirmed` → `issueFromOrder` (ISSUES the ORDER invoice; `@@unique([sourceType, sourceId])` makes it idempotent).
- `clients.listener.ts` already listens `order.confirmed` → `applyOrderConfirmed` (bumps `PosClient.totalSold`, but **only when `payload.posClientId` is set** — see §C-3).
- `sales.listener.ts` already listens `repair.pickedUp` → `recordRepairSale` (records the REPAIR-origin `Sale`, writes the `Repair.saleId` back-link, and re-emits `sale.confirmed` with `origin:REPAIR` so `billing` issues **no** invoice). `statistics` reads that REPAIR-origin `Sale`, never the `Repair` row, for revenue (see §C-4).

---

## C. Prerequisite gaps (surfaced, not blocking — recommended resolution each)

Not HOW-conflicts — each is a place where the spec prose needs something the frozen contract/schema does not hand over directly. Recommended resolutions stay inside the rules and the existing schema (no schema migration, no contract churn).

- **C-1 · `repairs` "created-by-me" scoping has no creator column.** `REPAIR_ROUTES.STAFF_LIST` is `staff(STAFF_REPAIRS: created-by-me)` and the test scenario is "Staff sees only tickets he created; admin all." But `Repair` has **no `createdByStaffId`** — the only staff anchor on a repair is `RepairStatusHistory.staffId`. **Recommended (no schema change):** at intake, write the **first `RepairStatusHistory` row** (`fromStatus:INTAKE`, `toStatus:INTAKE`, `staffId:` acting staff, `note:'intake'`). "Created-by-me" then = repairs whose **earliest** history row (`min(changedAt)`) has `staffId = me`; implemented as a `Repair` filter `history: { some: { fromStatus: INTAKE, toStatus: INTAKE, staffId: me } }` (the intake row is the unique INTAKE→INTAKE marker). This is independently forced by an already-shipped dependency: `sales.recordRepairSale` derives the acting staff for the repair-origin sale from the repair's status-history rows (`repair.pickedUp` carries no `staffId`) — so an intake history row must exist regardless. Surfacing that same row in `RepairDto.history` reads naturally as "ticket opened by X"; if the team prefers to hide it, filter `fromStatus===toStatus` out of the mapper's `history` while keeping it for scoping. *(Alternative, out of scope this set: add `Repair.createdByStaffId` — cleaner but a schema migration.)*

- **C-2 · `orders` `payment.clientRecorded` listener — the event payload carries no order/source link.** Spec: orders "Listens `payment.clientRecorded` → paidAmount update when the payment targets this order's invoice." The frozen `BillingEvents['payment.clientRecorded']` is `{ paymentId, posClientId, invoiceNumber?, amount, previousCredit, newCredit }` — it has `invoiceNumber` but **no `orderId`/`sourceId`**. **Recommended:** the orders listener resolves the link with a cross-module **read** (permitted — mirrors `billing` reading `Order`, `clients` reading `User`): `Invoice.findUnique({ where: { number: invoiceNumber }, select: { sourceType, sourceId, paidAmount } })`; act only when `sourceType === InvoiceSource.ORDER`; then set `Order.paidAmount = invoice.paidAmount`. **Idempotency + listener-order safety:** write the **absolute** invoice `paidAmount` (not `+= amount`), so replay is a no-op and the handler is insensitive to the fact that `billing.applyClientPaymentRecorded` and this handler both fire on the same event (an absolute mirror self-heals on the next event even if it momentarily reads a pre-recompute value). Guard with the same `safeRun` wrapper the clients/sales/billing listeners use. *(Exact-value alternative if a stale read is unacceptable: recompute `Order.paidAmount = Σ ClientPayment.amount WHERE invoiceId = <resolved id>` — order-independent, still a pure read, at the cost of touching `ClientPayment`.)*

- **C-3 · `order.confirmed` needs `posClientId`, but `Order` stores only `clientId`.** The frozen `order.confirmed` payload has both `clientId?` and `posClientId?`, and the two dormant consumers split by them: `billing.issueFromOrder` prefers `clientId` for the invoice name-snapshot but stamps `Invoice.posClientId` from `posClientId`; `clients.applyOrderConfirmed` **early-returns unless `posClientId` is set**. `Order` has only `clientId` (a storefront `Client`). **Recommended (schema already supports it):** at confirm, resolve `posClientId` via `Client.posClientId` (`@unique`, "auto-created at approval") — `Client.findUnique({ where: { id: order.clientId }, select: { posClientId: true } })`. Emit `order.confirmed { orderId, clientId: order.clientId ?? undefined, posClientId: client?.posClientId ?? undefined, snapshotLine, totals, confirmedByStaffId }`. Guest orders (`clientId=null`) emit neither → `billing` issues a "Walk-in" invoice, `clients` no-ops (correct: guests have no credit ledger). This is the "clientId-vs-posClientId" handoff flagged in set 06, resolved here at the emitter.

- **C-4 · statistics must read **stored document rows**, not invoices — to avoid the ORDER-invoice cost=0 gap and repair double-counting.** Two frozen facts collide with a naïve "sum invoices" reading: (a) `billing.issueFromOrder` writes ORDER invoices with `totalCost/totalProfit = 0` (set-06 handoff — the ORDER invoice does not carry FIFO cost); (b) repairs issue **no** invoice, and their revenue is carried by the REPAIR-origin `Sale`. **Resolution (matches spec BL#1 verbatim — "Reads stored figures only"):** revenue/profit = `Σ` over **COMPLETED `Sale` rows (both `origin` POS+REPAIR)** + **CONFIRMED-and-later `Order` rows** (`Order.costOfGoods`/`Order.profit`, stamped at confirm by `consumeFifo`). The `Repair` row is **never** summed for revenue (its money already lives in its REPAIR-origin `Sale`), and the ORDER invoice's zeroed cost is never used (the `Order` row's own `profit` is). Documented so the stats service reads the right tables and the "repair sale counted once" / "no profit drift vs FIFO" test scenarios pass.

---

## D. HOW-conflicts resolved toward the rules (noted, not asked)

- **D-1 · Access enforcement split: middleware gate + service scope.** Rules put `requireAuth`/`validateRequest` in the route file before the controller; the specs add data-scoping ("created-by-me", "staffId = me", "own + PENDING"). Resolution (sales/purchasing precedent): the **route** enforces type/page (`requireAuth({ pages:[…] })` / `{ types:[…] }`), the **service** enforces row-level ownership from the acting user threaded off `req.user!` (never the body). `requireAuth({ pages:[STAFF_ORDERS] })` already admits ADMIN (the middleware bypasses the page matrix for `UserType.ADMIN`), so a `/staff/...` path is reachable by admin — intended, same as set 06.

- **D-2 · `PLACE` is `public|client` → `requireAuth({ optional: true })`.** One handler serves guest and client. The service applies the contract's auth-context rules the schema deliberately left to the backend (comment in `orders.command.ts`): PICKUP ⇒ a client token is required (else `400`); an authed `PlaceOrderCommand.clientId` must equal `req.user!.clientId` (else `403`); a guest (`req.user` absent) forces `clientId=null` and is allowed only when a guest price exists (else `403 GUEST_PRICE_HIDDEN`).

- **D-3 · Split `(staff|admin)` routes share one controller method; the split is by wiring, not branching.** Each `STAFF_*`/`ADMIN_*` pair binds the **same** controller handler under two `router` registrations with different `requireAuth`. Margin/scope differences are decided in the service from `req.user!.type` (admin ⇒ `includeMargins:true`, unscoped; staff ⇒ margins off / scoped), mirroring `sales` `STAFF_DETAIL`/`ADMIN_DETAIL`.

- **D-4 · No new `ErrorCode`s.** `GUEST_PRICE_HIDDEN` and any stock-shortfall name are surfaced as `message`/`details` on existing subclasses (`ForbiddenError`→403, `ConflictError`→409, `BadRequestError`→400) — the closed `ErrorCode` enum is untouched, exactly as set 06 handled `CREDIT_REQUIRES_CLIENT`.

- **D-5 · Repairs mutation routes are page-gated, not creator-scoped.** The spec attaches "created-by-me" only to `LIST`; `UPDATE`/`PARTS`/`STATUS` are `staff|admin`. Resolution: gate mutations on the `STAFF_REPAIRS` page (any holder) + admin, matching the prose. *(If the team later wants a staff to mutate only his own tickets, add the same `history`-derived owner check in the service — noted, not applied, to avoid over-reading the spec.)*

- **D-6 · `statistics` mapper is thin / mostly folded into the service.** The rules' "pure Entity⇄DTO mapper" assumes a single owning entity; statistics DTOs are aggregates over many tables with no single entity. Resolution: keep a small `statistics.mapper.ts` for the repeatable row shapers only (dashboard order/client summaries, low-stock row, `ReportDto.chart`/`rows` assembly) each ending in `…ResponseSchema.parse(...)`; the query composition lives in the service. This honors §4 conformance (every response parses) without inventing a fake entity round-trip.

- **D-7 · Original-consumption reconstruction for restock reuses the `sales` pattern.** `returnIn` needs the original `ConsumptionLine[]`; `Order`/`RepairPart` don't store them. `sales.service.buildOriginalConsumptions(tx, referenceId, …)` already reconstructs them from `StockMovement`+`StockMovementConsumption` by `referenceId`. Orders (`referenceId=order.id`) and repairs (`referenceId=part.id` / repair id) mirror that read. *(Candidate future dedup: lift it to an `IInventoryService` read helper — noted, not required this set.)*

---

# PART I — MODULE `orders`

Single-product storefront orders. Public/client placement reserves stock (frozen `resolvedPrice`); staff drive PENDING→COMPLETED and confirm (FIFO consume + invoice-triggering event); cancel/return are admin-only. Emits five events; listens `payment.clientRecorded`.

## I.1 Step 1 — Contract & Schema analysis → `orders.mapper.ts`

Model `Order` (line folded in). Reads join `Wilaya`/`Commune` (bilingual names), `Product` (name snapshot lives on the row already). `orders.mapper.ts` — pure/static, **lists returned fields (never spreads the entity — sensitive/internal columns like `confirmedByStaffId`, `cancellationReason` stay out unless mapped)**, `Decimal → number` (`toMoney`), `Date → .toISOString()`, Prisma enum → contract enum, every method ends in `OrderResponseSchema.parse(dto)`:

| Mapper method | Source → DTO | Notes |
|---|---|---|
| `toOrderDto(order, ctx, { includeMargins })` | `Order` (+ joined wilaya/commune) → `OrderDto` | **Margin-gated:** omit `costOfGoods`/`profit` when `includeMargins===false` (both `.optional()`, so omission parses); admin keeps them. `wilaya`/`commune` present only for delivery orders (PICKUP ⇒ omit both + `address`). `serialNumbers?` = split of the stored string (or omit). `subtotal = resolvedPrice×quantity`; `deliveryFee`, `totalAmount`, `paidAmount` from the row. `canBeCancelled` = derived (client rule: `status===PENDING`). `ageHours` = `(now − placedAt)/3600000`. `resolvedPrice` **and** `unitPrice` both surfaced (unit may be adjusted at confirm; resolved is frozen). |
| `toStatsDto(counts)` | grouped counts → `OrderStatsDto` | Maps a `groupBy status` roll-up to the seven `.min(0)` count fields (default missing statuses to 0). |
| `toPersistencePlace(cmd, ctx)` | `PlaceOrderCommand` → `Order` create-input | `status:PENDING`, `resolvedPrice = ctx.resolvedPrice` (server-resolved viewer price) **and** `unitPrice = resolvedPrice` (frozen equal at placement, BL#1), `productNameSnapshot = ctx.productName`, `deliveryFee = ctx.fee`, `subtotal`/`totalAmount` computed, `paidAmount:0`, `wilayaId`/`communeId`/`address` only for delivery, `contactName`/`contactPhone` from `contact`, `reference = ctx.reference`. `clientId` from resolved auth (null for guest). |

## I.2 Step 2 — Components

### `orders.interface.ts` — `IOrdersService`
Methods return contract DTOs. Acting user `{ clientId?, staffId?, type }` threaded from the controller, never the body:
```
placeOrder(cmd: PlaceOrderCommand, actor): Promise<OrderDto>                 // public|client; guest ⇒ actor absent
listMyOrders(query: MyOrdersQuery, clientId): Promise<OrderDto[]>            // client; scoped clientId=me
cancelMyOrder(id, clientId): Promise<OrderDto>                              // client; own + PENDING only
listBackoffice(query: BackofficeOrdersQuery): Promise<PaginatedResult<OrderDto>>  // staff==admin data; margins per actor.type
confirmOrder(id, cmd: ConfirmOrderCommand, actor): Promise<OrderDto>         // the confirm transaction; STAFF_ORDERS|admin
updateStatus(id, cmd: UpdateOrderStatusCommand, actor): Promise<OrderDto>    // forward-only ≤ COMPLETED
cancelOrder(id, cmd, actor): Promise<OrderDto>                              // admin-only; any pre-COMPLETED
returnOrder(id, cmd: ReturnOrderCommand, actor): Promise<OrderDto>          // admin-only; from COMPLETED
getStats(): Promise<OrderStatsDto>                                          // per-status counts
applyClientPaymentRecorded(payload: BillingEvents['payment.clientRecorded']): Promise<void>  // listener-only, never HTTP
```
`includeMargins` for list/detail is derived in the controller from `actor.type === UserType.ADMIN`.

### Injected dependencies (constructor, manual DI in routes)
`PrismaClient`, `IDeliveryFeeService`, `IInventoryService`, `ISequenceService`. (No catalog port needed: the viewer-price resolution for PLACE reads `ProductPrice`/`Product` guest/default price directly via the shared `prisma` singleton — a pure read; or reuses `catalogProductService`'s pricing port if the team prefers symmetry with sales. **Recommended:** direct read for the guest/default price, since orders needs the *guest* price rule PLACE-side, which is a `Product`/`ProductPrice` read, not the POS-category rule sales uses.)

### Business logic (the two transactions + the machine)
1. **Place (one `$transaction`, then `flushEvents`):** resolve viewer price server-side (guest ⇒ `guestPrice` must exist else `403 GUEST_PRICE_HIDDEN`; PICKUP ⇒ client token else `400`; authed `clientId` must equal token's else `403`) → `deliveryFeeService.resolve(wilayaId, communeId, mode)` for delivery (PICKUP ⇒ fee 0 **and** delivery block already rejected by schema refinement) → `sequenceService.nextNumber(tx, DocType.ORDER)` → `inventoryService.reserve(tx, productId, qty, { referenceType:'ORDER', referenceId: order.id, staffId: SYSTEM/actor })` → create PENDING `Order` with `resolvedPrice=unitPrice` frozen. **Stock conflict ⇒ 409, nothing written** (reserve throws inside tx ⇒ rollback). Honor idempotency key if present. After commit: `inventoryService.flushEvents(tx)`; emit `order.placed { orderId, clientId? }`.
2. **Client cancel:** own + PENDING only → `inventoryService.release(...)` (still reserved) → `status:CANCELLED`, `cancelledAt` → commit → `flushEvents` → emit `order.cancelled { orderId }`.
3. **Confirm (one `$transaction`, idempotent):** if already `CONFIRMED`+ ⇒ return existing DTO (no re-consume, no duplicate emit — "double confirm: one consumption, one invoice"). Else optional `unitPrice` adjust (**`resolvedPrice` untouched**) → `inventoryService.release(...)` the reservation + `inventoryService.consumeFifo(tx, productId, qty, revenue=unitPrice×qty, MovementType.ORDER_OUT, ref)` → store returned `costOfGoods`/`profit` on the row → `status:CONFIRMED`, `confirmedAt`, `confirmedByStaffId=actor.staffId`, optional `paidAmount`. Loud **409** on FIFO shortfall. **No `Sale` row** (invoice sources ORDER directly). After commit: `flushEvents`; resolve `posClientId` from `Client.posClientId` (§C-3); **emit `order.confirmed { orderId, clientId?, posClientId?, snapshotLine{productId,productName,quantity,unitPrice,lineTotal}, totals{subtotal,deliveryFee,totalAmount,paidAmount}, confirmedByStaffId }`** → billing issues the ORDER invoice, clients bumps totalSold, observability narrates.
4. **Status machine (`updateStatus`, forward-only ≤ COMPLETED):** `PENDING→CONFIRMED→PACKAGED→IN_DELIVERY→COMPLETED`. `IN_DELIVERY` requires `deliveryCompany`+`trackingNumber` (400 otherwise); `COMPLETED` sets `deliveredAt`. Reject any non-forward or beyond-COMPLETED transition (400). **Staff may perform every forward transition.** Emit `order.statusChanged { orderId, fromStatus, toStatus }`.
5. **Admin cancel** (`cancelOrder`): any pre-COMPLETED state; `release` if still reserved; `status:CANCELLED`, `cancellationReason?`; emit `order.cancelled { orderId, reason? }`. **Admin return** (`returnOrder`): from COMPLETED only; `restock ⇒ inventoryService.returnIn(tx, originalConsumptions(order.id), qty, ref)` at consumed cost (reconstruct per D-7); `status:RETURNED`; emit `order.returned { orderId, refundAmount }`.
6. **Stats/age:** `getStats` = `groupBy status` counts. `canBeCancelled`/age: PENDING > 24h flagged (mapper `ageHours`).

### Events (in) → `orders.listener.ts`
Injects `IOrdersService`; `setup()` subscribes **`payment.clientRecorded`** → `applyClientPaymentRecorded` (per §C-2: resolve `invoiceNumber → Invoice(sourceType=ORDER) → sourceId`, mirror `Order.paidAmount = invoice.paidAmount`, absolute/idempotent). Wrap in the shared `safeRun` guard (throw must never re-enter `eventBus.emit`).

### `orders.controller.ts`
Thin, `try/catch → next`, reads `req.validated`, acting user from `req.user` (may be **absent** for guest PLACE), `sendSuccess` (`201` place, `200` others). Derives `includeMargins = req.user?.type === UserType.ADMIN`.

### `orders.routes.ts` (composition root)
Manual DI: `new OrdersService(prisma, deliveryFeeService, inventoryService, sequenceService)`; `new OrdersController(service)`; `new OrdersListener(service).setup()`. Sibling singletons imported directly (set-05/06 one-directional shape — no adapter in `modules/index.ts`; add `apiRouter.use(ordersRouter)` at the EXTENSION POINT). Routes:

| Route const | Method + path | Middleware | Service guard |
|---|---|---|---|
| `PLACE` | POST `/orders` | `requireAuth({ optional:true })` + `validateRequest({ body: PlaceOrderSchema })` | guest/client rules (D-2) |
| `MY_LIST` | GET `/clients/me/orders` | `requireAuth({ types:[CLIENT] })` + `validateRequest({ query: MyOrdersQuerySchema })` | scope `clientId=me` |
| `MY_CANCEL` | POST `/orders/:id/cancel` | `requireAuth({ types:[CLIENT] })` + `validateRequest({ params: OrderIdParamsSchema })` | own + PENDING |
| `STAFF_LIST` | GET `/staff/orders` | `requireAuth({ pages:[STAFF_ORDERS] })` + `validateRequest({ query: BackofficeOrdersQuerySchema })` | margins off |
| `ADMIN_LIST` | GET `/admin/orders` | `requireAuth({ types:[ADMIN] })` + same query | margins on (same data) |
| `STAFF_CONFIRM` / `ADMIN_CONFIRM` | POST `/{staff,admin}/orders/:id/confirm` | `pages:[STAFF_ORDERS]` / `types:[ADMIN]` + `validateRequest({ params, body: ConfirmOrderSchema })` | — |
| `STAFF_STATUS` / `ADMIN_STATUS` | PATCH `/{staff,admin}/orders/:id/status` | as above + `validateRequest({ params, body: UpdateOrderStatusSchema })` | forward-only ≤ COMPLETED |
| `CANCEL` | POST `/admin/orders/:id/cancel` | `requireAuth({ types:[ADMIN] })` + `validateRequest({ params, body: UpdateOrderStatusSchema })`¹ | pre-COMPLETED |
| `RETURN` | POST `/admin/orders/:id/return` | `requireAuth({ types:[ADMIN] })` + `validateRequest({ params, body: ReturnOrderSchema })` | from COMPLETED |
| `STAFF_STATS` / `ADMIN_STATS` | GET `/{staff,admin}/orders/stats` | `pages:[STAFF_ORDERS]` / `types:[ADMIN]` | — |

¹ `CANCEL` needs only `reason?` — validate with a minimal body (reuse `UpdateOrderStatusSchema`, ignoring non-`reason` fields, or a bare `{ reason?: string }`; do not mint a new contract schema — keep it in the route via `z.object({ reason: z.string().optional() })` inline is acceptable, but preferred is reusing an existing optional-reason shape).

## I.3 Step 3 — Test strategy (`orders`)
- **Factories** (`test/data`): `makeOrder`, `makePlaceOrderCommand` (PICKUP / DELIVERY variants), plus reuse existing `makeProduct`/`makeClient`/`makeWilaya`/`makeCommune`/`makeStaff`.
- **Unit — mapper:** margin gating (staff omits cost/profit, admin includes), PICKUP omits wilaya/commune/address & fee 0, `ageHours`/`canBeCancelled` derivation, `OrderResponseSchema.parse` guard.
- **Unit — service (mock Prisma + mock injected services):** guest null-guestPrice → 403; guest PICKUP → 400; PICKUP + delivery block → 400 (schema); fee 0 for pickup; `clientId` mismatch with token → 403; reserve→release→consume invariants; **double confirm ⇒ one `consumeFifo`, one emit**; FIFO shortfall → 409; forward-only status (reject backward / skip); staff can confirm + advance to COMPLETED; staff cancel/return → 403; RETURNED restock at consumed cost; `applyClientPaymentRecorded` idempotent (absolute mirror, replay-safe, ignores non-ORDER invoices).
- **Integration (Supertest, test DB):** place→confirm→status→completed happy path; guest vs client PLACE auth; backoffice list staff==admin content; `order.confirmed` emitted once (spy the bus) and drives a single ORDER invoice; stats counts.
- **Conformance:** every 2xx body parses against `OrderResponseSchema` / `OrderStatsResponseSchema`; every route uses an `ORDER_ROUTES` constant.

---

# PART II — MODULE `repairs`

Back-office only (no public/client surface, no repair invoices). Intake→processing→completed→picked-up, with parts that reserve/consume through `InventoryService`. Emits `repair.pickedUp` (→ sales records the repair-origin sale), `repair.statusChanged`, `repair.cancelled`. Listens none.

## II.1 Step 1 — Contract & Schema analysis → `repairs.mapper.ts`
Models `Repair` (+ `RepairPart[]`, `RepairStatusHistory[]`); reads join `Brand`/`DeviceModel` (device refs), `Technician` (name), `Staff` (history `staffName`). `RepairPart.productNameSnapshot` already on the row. `repairs.mapper.ts` — pure/static, lists returned fields, `Decimal → number`, `Date → ISO`, enums mapped, ends every method with `RepairResponseSchema.parse(dto)`:

| Mapper method | Source → DTO | Notes |
|---|---|---|
| `toRepairDto(repair, parts, history, ctx, { includeMargins })` | `Repair` (+relations) → `RepairDto` | **Margin-gated:** omit `totalCost`/`totalProfit` and each part's `costOfGoods`/`profit` when staff. `device` = `{ brand?{id,name}, model?{id,name}, label?, imei? }` (inlined refs). `reportedIssues` = the `String[]` cast to `ReportedIssue[]`; `reportedIssueOther?`. `technician?{id,name}`. `parts[]` mapped from `RepairPart`; `history[]` from `RepairStatusHistory` with `staffName` from `Staff` (per D-1 optionally filter the synthetic INTAKE→INTAKE row per §C-1). `ageHours` derived. |
| `toPersistenceIntake(cmd, ctx)` | `CreateRepairCommand` → `Repair` create-input | `status:INTAKE`, `reference=ctx.reference`, `labourPrice:0`, totals 0, prefill name/phone from attached `PosClient` when `posClientId` given (BL#1). |
| `toPartCreateInput(cmd, ctx)` | `AddRepairPartCommand` → `RepairPart` create-input | `productNameSnapshot=ctx.productName`, `lineTotal=unitPrice×quantity`, cost/profit null until COMPLETED. |

## II.2 Step 2 — Components

### `repairs.interface.ts` — `IRepairsService`
```
listRepairs(query: RepairListQuery, actor): Promise<PaginatedResult<RepairDto> | RepairDto[]>  // staff⇒created-by-me; admin⇒all
createRepair(cmd: CreateRepairCommand, staffId): Promise<RepairDto>          // + intake history row (§C-1)
updateRepair(id, cmd: UpdateRepairCommand, actor): Promise<RepairDto>        // diagnosis?/labourPrice/technicianId; recompute totals
addPart(id, cmd: AddRepairPartCommand, actor): Promise<RepairDto>            // reserve(PENDING_REPAIR)
removePart(id, partId, actor): Promise<RepairDto>                           // release
changeStatus(id, cmd: RepairStatusCommand, actor): Promise<RepairDto>       // transitions + history + events
```
Injected deps: `PrismaClient`, `IInventoryService`, `ISequenceService`. (No catalog port — part `productName` snapshot is a direct `Product` read, sales precedent.)

### Business logic
1. **Intake (`createRepair`):** `sequenceService.nextNumber(tx, DocType.REPAIR)` → create `Repair` (INTAKE) → **write the intake `RepairStatusHistory` row** (`INTAKE→INTAKE`, `staffId`) for §C-1 scoping and downstream staff-resolution. Prefill from `PosClient` if `posClientId`. Claim slip = the returned `reference`.
2. **Parts:** `addPart` → `inventoryService.reserve(tx, productId, qty, { referenceType:'REPAIR', referenceId: repair.id, staffId })` (shortfall **409 naming the product**) + create `RepairPart`; `removePart` → `inventoryService.release(...)` + delete/void the part. Maintain `partsTotal` and `totalAmount = labourPrice + partsTotal` on every parts/labour change.
3. **Transitions (`changeStatus`, writes a history row + emits):**
   - `INTAKE→PROCESSING`: **`technicianId` required (400)**.
   - `PROCESSING→COMPLETED` (**idempotent** — re-COMPLETE is a no-op, "one consumption"): per part `release` its reservation + `consumeFifo(tx, productId, qty, revenue=unitPrice×qty, MovementType.REPAIR_CONSUMPTION, ref)` → store part `costOfGoods`/`profit`, roll up `Repair.totalCost`/`totalProfit`; `completedAt`.
   - `COMPLETED→PICKED_UP`: cash `paidAmount`, `pickedUpAt`; **emit `repair.pickedUp { repairId, posClientId?, totalAmount, paidAmount, totalCost, totalProfit, snapshotParts[…full costed lines…], labourPrice }`** → `sales.recordRepairSale` records the REPAIR-origin sale and writes back `Repair.saleId` (that back-link is sales' job — repairs does not set it). Emit-once; sales is replay-safe via `Repair.saleId @unique`.
   - `→CANCELLED` (from any state, `reason?`): `release` **pending** parts; **already-consumed** parts return **only** via explicit `consumedPartReturns[]` (`restock ⇒ returnIn` at consumed cost, reconstruct per D-7). Emit `repair.cancelled { repairId, reason? }`.
   - Every transition also emits `repair.statusChanged { repairId, fromStatus, toStatus }`.
4. **Validation:** `reportedIssues` already enum-validated by the schema; `other` unlocks `reportedIssueOther` (free text); diagnosis + notes optional.
5. **Scoping (D-1/§C-1):** `listRepairs` — admin: all; staff: `history: { some: { fromStatus:INTAKE, toStatus:INTAKE, staffId: me } }` + optional `status`/`technicianId` filters. Mutations gated by `STAFF_REPAIRS` page (D-5).

### `repairs.listener.ts`
**Not created** — repairs listens to nothing (contract: "Listens: none"). (File-only-if-needed, rules §2.)

### `repairs.controller.ts` / `repairs.routes.ts`
Controller thin, acting user from `req.user!` (`staffId`, `type`), `sendSuccess` (`201` create, `200` others), `includeMargins = type===ADMIN`. Manual DI: `new RepairsService(prisma, inventoryService, sequenceService)`; `new RepairsController(service)`; **no listener**. Routes (each `STAFF_*`/`ADMIN_*` pair → same handler, different gate):

| Route const(s) | Method + path | Middleware | Guard |
|---|---|---|---|
| `STAFF_LIST` / `ADMIN_LIST` | GET `/{staff,admin}/repairs` | `pages:[STAFF_REPAIRS]` / `types:[ADMIN]` + `validateRequest({ query: RepairListQuerySchema })` | staff⇒created-by-me |
| `STAFF_CREATE` / `ADMIN_CREATE` | POST `/{staff,admin}/repairs` | as above + `validateRequest({ body: CreateRepairSchema })` | — |
| `STAFF_UPDATE` / `ADMIN_UPDATE` | PATCH `/{staff,admin}/repairs/:id` | as above + `validateRequest({ params: RepairIdParamsSchema, body: UpdateRepairSchema })` | — |
| `STAFF_PARTS` / `ADMIN_PARTS` | POST `/{staff,admin}/repairs/:id/parts` | as above + `validateRequest({ params: RepairIdParamsSchema, body: AddRepairPartSchema })` | — |
| `STAFF_PART_BY_ID` / `ADMIN_PART_BY_ID` | DELETE `/{staff,admin}/repairs/:id/parts/:partId` | as above + `validateRequest({ params: RepairPartParamsSchema })` | — |
| `STAFF_STATUS` / `ADMIN_STATUS` | POST `/{staff,admin}/repairs/:id/status` | as above + `validateRequest({ params: RepairIdParamsSchema, body: RepairStatusSchema })` | transition rules |

Wire `apiRouter.use(repairsRouter)` at the EXTENSION POINT.

## II.3 Step 3 — Test strategy (`repairs`)
- **Factories:** `makeRepair`, `makeCreateRepairCommand`, `makeRepairPart`; reuse `makeProduct`/`makePosClient`/`makeTechnician`/`makeStaff`.
- **Unit — mapper:** device ref assembly, margin gating on totals + part cost/profit, history `staffName`, intake-row filtering choice, `RepairResponseSchema.parse`.
- **Unit — service:** PROCESSING without technician → 400; part add reserves / delete releases (shortfall 409 names product); **double COMPLETE ⇒ one consumption**; pickup emits once (spy bus) & is replay-safe; cancel post-consumption **without** `consumedPartReturns` leaves stock untouched, **with** `restock` re-enters at consumed cost; totals (`partsTotal`, `totalAmount = labour+parts`) recomputed on every change.
- **Integration:** intake→processing→completed→pickup; staff sees only own tickets, admin all (leak test); `repair.pickedUp` → a single REPAIR-origin `Sale` and `Repair.saleId` set (assert no invoice issued).
- **Conformance:** bodies parse `RepairResponseSchema`; routes use `REPAIR_ROUTES` constants.

---

# PART III — MODULE `statistics`

Read-only aggregation over **stored** figures — admin/staff dashboards, the merged statistics page, drillable reports + CSV. No recomputation, no events, no writes.

## III.1 Step 1 — Analysis → `statistics.mapper.ts` (thin, D-6)
No owning entity. `statistics.mapper.ts` holds only the repeatable row shapers, each ending in the matching `…ResponseSchema.parse(...)`: `toDashboardOrderSummary`, `toDashboardClientSummary`, `toLowStockItem` (`availableQuantity = quantityOnHand − quantityReserved`, `reorderThreshold` from `Product`), and `toReportDto({ chart, rows, totals, drill })`. Query composition lives in the service.

## III.2 Step 2 — Components

### `statistics.interface.ts` — `IStatisticsService`
```
getAdminDashboard(): Promise<AdminDashboardDto>
getStaffDashboard(staffId): Promise<StaffDashboardDto>          // strictly staffId=me
getOverview(): Promise<OverviewDto>                            // all-time cards
getFiltered(query: FilteredQuery): Promise<FilteredDto>        // + % vs previous equal-length period
getChart(chart: ChartType, query: ChartsQuery): Promise<ReportDto['chart'] | ...>
getTopProducts(query: TopProductsQuery): Promise<...>
getReport(type: ReportType, query: ReportQuery): Promise<ReportDto | ExportResult>  // CSV streams
```
Injected deps: **`PrismaClient` only** (pure reads; no InventoryService/SequenceService/DeliveryFeeService, no event bus). Reuse the `{ filename, mime, body }` `ExportResult` shape (inventory/platform precedent) for `format=csv`.

### Business logic (spec BL, grounded on §C-4 stored-figure reads)
1. **Revenue/profit** = `Σ` COMPLETED `Sale` rows (origins POS **and** REPAIR) + CONFIRMED-and-later `Order` rows (`Order.profit`/`costOfGoods`). **Never** sum `Repair` rows (counted via their REPAIR-origin `Sale`) and **never** use ORDER-invoice cost (zeroed) — see §C-4. Guarantees "repair sale counted once" and "no profit drift vs FIFO".
2. **`sales-by-category`/`by-seller`** expose the discount column: `Σ (resolvedPrice − unitPrice) × qty` over the relevant lines.
3. **`stock-movements`** totals per `MovementType`; large `ADJUSTMENT_OUT` flagged (shrinkage). **`ageing`** buckets client credit (`PosClient.credit`) + supplier credit by document age. **`client-browsing`** joins observability (`StaffSearchLog`/`ClientActivityLog`): top searches; most-viewed products with zero purchases.
4. **`stockValue`** = `Σ quantityOnHand × averageCost` (`Product`). **`totalClientCredit`** = `Σ PosClient.credit`; **`totalSupplierCredit`** = `Σ` supplier outstanding. Every report row carries a `drill { entity, idField }` to its documents. `format=csv` streams `rows` (shape == JSON `rows`).
5. **Staff dashboard** strictly `staffId = me` (sales today count + revenue, my drafts, my pending orders count, low-stock read-only alert). Admin dashboard: `stats` + `*ChangePct` (period comparison, incl. **empty previous period** ⇒ 0 / guarded division), pending/recent orders+clients, low stock, `repairsByStatus` (`groupBy` map), `draftSalesByStaff`.
6. **Filtered %-change:** compare `[from,to]` vs the immediately-preceding equal-length window; empty previous ⇒ `0` (never divide-by-zero).

### `statistics.listener.ts` — **not created** (no events). `statistics.controller.ts` / `statistics.routes.ts`
Controller thin; `getStaffDashboard` reads `req.user!.staffId` (never a query). CSV branch: when the service returns `ExportResult`, set headers + stream instead of `sendSuccess` (inventory export precedent). Manual DI: `new StatisticsService(prisma)`; `new StatisticsController(service)`; no listener. Routes:

| Route const | Method + path | Middleware | Notes |
|---|---|---|---|
| `ADMIN_DASHBOARD` | GET `/admin/dashboard` | `requireAuth({ types:[ADMIN] })` | one aggregate |
| `STAFF_DASHBOARD` | GET `/staff/dashboard` | `requireAuth({ types:[STAFF] })` | scoped `staffId=me` |
| `OVERVIEW` | GET `/admin/statistics/overview` | `requireAuth({ types:[ADMIN] })` | — |
| `FILTERED` | GET `/admin/statistics/filtered` | admin + `validateRequest({ query: FilteredQuerySchema })` | %-vs-previous |
| `CHARTS` | GET `/admin/statistics/charts/:chart` | admin + `validateRequest({ params: ChartParamsSchema, query: ChartsQuerySchema })` | — |
| `TOP_PRODUCTS` | GET `/admin/statistics/top-products` | admin + `validateRequest({ query: TopProductsQuerySchema })` | — |
| `REPORT` | GET `/admin/reports/:type` | admin + `validateRequest({ params: ReportParamsSchema, query: ReportQuerySchema })` | table+chart or CSV |

Wire `apiRouter.use(statisticsRouter)` at the EXTENSION POINT.

## III.3 Step 3 — Test strategy (`statistics`)
- **Factories:** reuse existing (`Sale`, `Order`, `Product`, `PosClient`, `Supplier*`, `StockMovement`, `StaffSearchLog`) — statistics writes no rows, so it needs seed data, not new factories.
- **Unit — service (mock/seeded Prisma):** `profit = Σ stored line profits` (no FIFO drift); period-comparison math incl. **empty previous period**; **repair sale counted once** (a repair + its REPAIR-origin sale sum to the sale only); discount column matches overrides; `stockValue` formula; **staff-dashboard leak test** (nothing global except low stock); CSV `rows` shape == JSON `rows`.
- **Integration:** each endpoint returns a schema-valid body; `REPORT?format=csv` streams; admin-vs-staff auth (staff hitting `/admin/*` → 403).
- **Conformance:** bodies parse `Overview/Filtered/Report/AdminDashboard/StaffDashboard` schemas; routes use `STATS_ROUTES` constants.

---

## File checklist (create only what each module needs — rules §2)

**`orders`** (`apps/api/src/modules/orders/`) — 6 files:
1. `orders.mapper.ts`
2. `orders.interface.ts`
3. `orders.service.ts`
4. `orders.listener.ts` — **needed** (listens `payment.clientRecorded`)
5. `orders.controller.ts`
6. `orders.routes.ts` (composition root; `+ modules/index.ts` mount)

**`repairs`** (`apps/api/src/modules/repairs/`) — 5 files (no listener):
1. `repairs.mapper.ts`
2. `repairs.interface.ts`
3. `repairs.service.ts`
4. `repairs.controller.ts`
5. `repairs.routes.ts` (composition root; `+ modules/index.ts` mount)

**`statistics`** (`apps/api/src/modules/statistics/`) — 5 files (no listener):
1. `statistics.mapper.ts` (thin, D-6)
2. `statistics.interface.ts`
3. `statistics.service.ts`
4. `statistics.controller.ts`
5. `statistics.routes.ts` (composition root; `+ modules/index.ts` mount)

Plus `test/data` factories (`makeOrder`, `makePlaceOrderCommand`, `makeRepair`, `makeCreateRepairCommand`, `makeRepairPart`) and unit/integration/conformance suites mirroring `sales`/`billing`.

---

## Vertical slice (one line per module)
- **orders:** `POST /orders` (guest/client) → validate → reserve+freeze price (PENDING) → staff `confirm` (FIFO consume + `order.confirmed`) → billing invoices / clients totalSold / observability audits → forward status to COMPLETED → admin cancel/return (restock). Listens `payment.clientRecorded` to mirror `paidAmount`.
- **repairs:** staff `intake` (+history row) → add parts (reserve) → `PROCESSING` (technician req) → `COMPLETED` (consume, cost/profit) → `PICKED_UP` (cash) → `repair.pickedUp` → sales records the REPAIR-origin sale (no invoice). Back-office only, staff sees own tickets.
- **statistics:** admin/staff GET dashboards + overview/filtered/charts/top-products/reports → pure reads of **stored** `Sale`/`Order`/`Product`/credit/movement/browsing figures (never recomputed, never double-counted) → schema-valid DTOs, CSV stream for reports.

## Standing-rule conflict check
No **genuine conflict** requiring a stop-and-ask: every route/DTO/command/query/enum/event these three modules need already exists in `@dragon-telecom/contract` (verified in §0), and every gap in §C is resolvable inside the existing schema + rules. The one item closest to a schema conflict — repairs' missing creator column (§C-1) — is resolved without a migration via the intake history row, and is independently required by already-shipped `sales` behavior. Proceeding on that basis.
