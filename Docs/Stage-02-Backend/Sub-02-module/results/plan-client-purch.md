# Stage 02 · Sub-02 — Module Implementation Plan: `clients` + `purchasing` (set 05)

> Two modules planned together because they share the same injected-service seams
> (`SequenceService`, and each depends on a **read** port into `catalog`) and the same
> event-driven aggregate-cache pattern (`credit`/`totalPaid`/`total*` maintained by
> listeners, idempotent by source-document id, `cache = ledger` conformance).
> **No code in this document.** Files are created in a later sprint sub-stage.
>
> Standing-rule resolution: **rules** govern HOW, the **phase file** WHAT/WHEN, the
> **contract** WHICH. Everything the contract already declares is reused verbatim; nothing
> below re-declares a DTO/Command/Query/route/enum/event that exists in
> `@dragon-telecom/contract`. HOW-conflicts are resolved toward `module-implementation-rules.md`
> and noted in §D. Two genuine **prerequisite gaps** (not HOW-conflicts) are surfaced in §C —
> they were anticipated handoffs, so they are flagged with a recommended resolution rather than
> halting the plan.

---

## 0. Pre-flight verification (standing rule: confirm nothing must be newly declared)

Confirmed present in `@dragon-telecom/contract` (barrel re-exports both modules — `src/index.ts`):

**clients** (`modules/clients/`)
- Routes: `CLIENT_ROUTES` (VALIDATE_PHONE, REGISTER, ME, ME_PASSWORD, CART, **CART_ITEM**, ADMIN_LIST, **ADMIN_STATS**, ADMIN_DETAIL, APPROVE, REJECT, RESET_PASSWORD, ADMIN_UPDATE) and `POS_CLIENT_ROUTES` (SEARCH, QUICK_CREATE, ADMIN, **ADMIN_BY_ID**). *(CART_ITEM / ADMIN_STATS / ADMIN_BY_ID already exist — do not add.)*
- Commands: `RegisterClientSchema`, `UpdateMeSchema`, `ChangeMyPasswordSchema`, `ApproveClientSchema`, `RejectClientSchema`, `ResetClientPasswordSchema`, `AdminUpdateClientSchema`, `CreatePosClientSchema`, `UpdatePosClientSchema`, `AddCartItemSchema`.
- Queries/params: `AdminClientListQuerySchema`, `PosClientSearchQuerySchema`, `ClientIdParamsSchema`, `PosClientIdParamsSchema`, `CartItemParamsSchema`.
- DTOs: `ValidatePhoneResultDto`, `ClientMeDto`, `AdminClientDto`, `PosClientDto`, `CartItemDto` (nests catalog's `ProductWithPricingResponseSchema`).
- Enums: `ClientStatus` (PENDING/APPROVED/REJECTED), `PhoneAvailability` (available/registered/pending).
- Events: `ClientsEvents` — emits `client.registered`, `client.approved`, `client.rejected`, `client.passwordReset`, `posClient.creditChanged`.

**purchasing** (`modules/purchasing/`)
- Routes: `PURCHASING_ROUTES` (SUPPLIERS, **SUPPLIER_BY_ID**, SUPPLIER_DETAIL, SUPPLIER_STATS, INVOICES, **INVOICE_BY_ID**, CONFIRM, CANCEL, PAYMENTS).
- Commands: `CreateSupplierSchema`, `UpdateSupplierSchema`, `CreateSupplierInvoiceSchema` (XOR-refined), `UpdateSupplierInvoiceSchema` (mutual-exclusion-refined), `CancelSupplierInvoiceSchema`, `CreateSupplierPaymentSchema`.
- Queries/params: `SupplierListQuerySchema`, `SupplierInvoiceListQuerySchema`, `SupplierPaymentListQuerySchema`, `SupplierIdParamsSchema`, `SupplierInvoiceIdParamsSchema`.
- DTOs: `SupplierDto`, `SupplierInvoiceDto`, `ConfirmResultDto`, `SupplierPaymentDto`, `SupplierDetailDto`, `SupplierStatsDto`.
- Enum: `SupplierInvoiceStatus` (DRAFT/CONFIRMED/CANCELLED).
- Events: `PurchasingEvents` — emits `supplierInvoice.confirmed`, `supplierInvoice.cancelled`, `payment.supplierRecorded`, `supplier.creditChanged`.

Foundations reused (never redefined): `@common/db/prisma`, `@common/middlewares` (`validateRequest`, `requireAuth`), `@common/http/response` (`sendSuccess`), `@common/events/event-bus` (typed `eventBus`, already unions `ClientsEvents` + `PurchasingEvents`), `@common/errors` (`AppError`, `NotFoundError`, `ConflictError`, `BadRequestError`, `ForbiddenError`), `@common/utils/password` (Argon2id — used only through identity, see §C-1).
Injected singletons already exported by built modules: `sequenceService` (`platform.routes`), `inventoryService` (`inventory.routes`), `catalogProductService` / `catalogPricingService` (`catalog.routes`).

**Two contract/foundation gaps that block a literal implementation** — see §C:
1. `DocType` (contract, `modules/platform/platform.enums.ts`) has **no `SUPPLIER`** (for `Supplier.code`) and **no `SUPPLIER_PAYMENT`** (for `SupplierPayment.reference`). It *does* have `SUPPLIER_INVOICE`, `CLIENT`, `POS_CLIENT`.
2. `identity` `createUser` provisions **STAFF/ADMIN only** (contract `CreateUserSchema` restricts `type` to `[ADMIN, STAFF]` and the service always creates a `Staff` row). `clients.approve` needs a **CLIENT-type** user. This is the handoff noted at the end of the identity module.

---

## PART I — MODULE `clients`

Merges *client* (web identity: register → approval → self profile → cart) and *pos-client*
(commercial identity: `credit`/`totalPaid`/`totalSold` caches, counter creation).

### I.1 Step 1 — Contract & Schema analysis

Prisma models (`schema.prisma`): `Client`, `PosClient`, `ClientCart`, plus reads of `Wilaya`/`Commune` (for `wilayaFr`/`communeFr`), `ClientCategory` (category name), `User` (username).

`clients.mapper.ts` — pure/static, **lists returned fields (never spreads)**, `Date → .toISOString()`, Prisma enum → contract enum:

| Mapper method | Source → DTO | Notes |
|---|---|---|
| `toValidatePhoneDto` | derived → `ValidatePhoneResultDto` | `isValid` (phone shape ok) + `status` mapped to `PhoneAvailability` (lowercase) — never `ClientStatus`. |
| `toClientMeDto` | `Client` (+ linked `PosClient`) → `ClientMeDto` | **NO `category`, NO raw `status`.** `credit`/`totalPaid`/`totalSold` proxied from the linked `PosClient` (`Decimal → number`); `0` when no `posClientId` yet (still PENDING). `createdAt` ISO. |
| `toAdminClientDto` | `Client` (+ wilaya/commune/posClient/user) → `AdminClientDto` | `fullName = firstName+' '+lastName`; `wilayaFr`/`communeFr` from relation; `categoryName` from posClient.category; `status` = `ClientStatus`; `totalOrders`/`totalSpent`/`lastOrderDate` from order/sale aggregates (see I.3). `posClientId?`, `username?` optional. |
| `toPosClientDto` | `PosClient` (+ category) → `PosClientDto` | `credit`/`totalPaid`/`totalSold` `Decimal → number`; `linkedClientId?` from the back-relation. |
| `toCartItemDto` | `ClientCart` + resolved `ProductWithPricingDto` → `CartItemDto` | `product` is catalog's **`ProductWithPricingResponseSchema`** — resolved by the catalog read port (I.5), *not* rebuilt here; mapper only assembles `{ productId, addedAt(ISO), product }`. |

Every method ends `XxxResponseSchema.parse(dto)` (dev/test conformance guard, rules §4/§6).

Money columns are `Decimal(12,2)` — convert with a shared `Number(decimal)` helper (mirror inventory/catalog mappers). `Decimal → number` is lossy only beyond 2dp; DZD is 2dp, safe.

### I.2 Step 2 — Component definition

**Interface** `IClientsService` (`clients.interface.ts`) — one service for the merged module; every method returns a contract DTO. Derived from the routes the controller serves:

```
// Web identity (public + client)
validatePhone(phone: string): Promise<ValidatePhoneResultDto>
register(cmd: RegisterClientCommand): Promise<{ id: string }>      // PENDING, no User
getMe(clientId: string): Promise<ClientMeDto>
updateMe(clientId: string, cmd: UpdateMeCommand): Promise<ClientMeDto>
changeMyPassword(clientId: string, cmd: ChangeMyPasswordCommand): Promise<void>
// Cart (client) — favorites, no quantity
getCart(clientId: string, viewer: Viewer): Promise<CartItemDto[]>
addCartItem(clientId: string, cmd: AddCartItemCommand): Promise<void>
removeCartItem(clientId: string, productId: string): Promise<void>
// Admin client pipeline
listClients(query: AdminClientListQuery): Promise<PaginatedResult<AdminClientDto>>
clientStats(): Promise<...>                       // shape: see I.3 note
getClient(id: string): Promise<AdminClientDto>    // + /activity read (observability) — see I.5
approveClient(id: string, cmd: ApproveClientCommand, staffId: string): Promise<AdminClientDto>
rejectClient(id: string, cmd: RejectClientCommand, staffId: string): Promise<AdminClientDto>
resetClientPassword(id: string, cmd: ResetClientPasswordCommand): Promise<void>
adminUpdateClient(id: string, cmd: AdminUpdateClientCommand): Promise<AdminClientDto>
// POS clients
searchPosClients(query: PosClientSearchQuery): Promise<PosClientDto[]>
quickCreatePosClient(cmd: CreatePosClientCommand): Promise<PosClientDto>
listPosClients(query): Promise<PaginatedResult<PosClientDto>>
createPosClient(cmd: CreatePosClientCommand): Promise<PosClientDto>
updatePosClient(id: string, cmd: UpdatePosClientCommand): Promise<PosClientDto>
// Internal — invoked by the module's own listener, not HTTP:
applyCreditSnapshot(...) / recomputePosClientCaches(posClientId, tx?): Promise<void>
```

`Viewer = JWTPayload | undefined` (reuse catalog's alias shape) — the cart's product pricing is category-specific.

`ADMIN_STATS` and `/activity` have no DTO/field-list in the contract. `/activity` is an **observability read** (route note) — resolve by delegating to the already-built observability module's read surface (client activity log), *not* by clients duplicating it. `ADMIN_STATS` shape is not in the contract; model minimally (`totalClients`, `pending`, `approved`, `rejected`) and add the DTO **to the contract's `clients.dtos.ts`** in the sprint (flagged §D-1) — it is genuinely missing, unlike everything else.

**Events emitted** (service, after commit): `client.registered {clientId}`, `client.approved {clientId, posClientSeed}`, `client.rejected {clientId, reason?}`, `client.passwordReset {clientId}`, `posClient.creditChanged {posClientId, previousCredit, newCredit, cause}`.

**Events listened** → `clients.listener.ts` **is needed** (I.4).

### I.3 Business logic (the HOW behind the methods) — spec §Business Logic

1. **Phone check** (`validatePhone`, re-run inside `register`): match `Client.phone` → `APPROVED ⇒ registered`, `PENDING ⇒ pending`, none ⇒ `available`. `register` writes a **PENDING `Client` row with `userId=null`** (cannot authenticate) — `Client.code` via `SequenceService(tx, DocType.CLIENT)`. Duplicate register → `409` whose message is **status-specific** (already-registered vs already-pending). `wilayaId`/`communeId` validated (FK; `BadRequestError` on unknown). Emits `client.registered`.
2. **Approve** — one transaction: `identityService.<provisionClient>({ username, password, clientId }, tx)` (see §C-1) → set `Client.status=APPROVED, approvedAt=now, approvedByStaffId=staffId, userId` → **commit** → emit `client.approved {clientId, posClientSeed:{name: fullName, phone, categoryId}}`. The **PosClient is created by the module's own listener after commit** (idempotent by `clientId`), which also writes `Client.posClientId`. Guard: only a `PENDING` client is approvable (`409` otherwise). `username`/`password` uniqueness surfaces as `ConflictError` from identity.
3. **Reset password** (admin): `identityService.resetPassword(userId, cmd.newPassword)` (revokes refresh tokens) → emit `client.passwordReset {clientId}`. `changeMyPassword` (self): verify `currentPassword` via identity, then reset; both reject if the client has no `userId` (not yet approved) → `409/400`.
4. **Me**: `phone` immutable — `UpdateMeSchema` already omits it, so an attempt is dropped at validation; belt-and-braces the service never writes phone. Profile edits never rewrite historical document snapshots. Money figures are **proxied from the linked `PosClient`** (0 if none).
5. **Cart**: PK `(clientId, productId)` — **no quantity**. `addCartItem` upserts (idempotent — re-adding a favorite is a no-op, not a `409`). `removeCartItem` deletes by PK (`204`; missing = still `204`, idempotent). `getCart` resolves each product to `ProductWithPricingDto` **via the catalog read port** using the client's category as viewer context (I.5). Guests never touch carts (route is `client`-gated).
6. **PosClient caches** (`credit`, `totalPaid`, `totalSold`) are **event-maintained snapshots, idempotent by document id, and must equal ledger recomputation** (conformance). `createPosClient`/`quickCreatePosClient`: `PosClient.code` via `SequenceService(tx, DocType.POS_CLIENT)`; `initialCredit` seeds the opening `credit` (create-only). Category change affects **future** documents only; no category ⇒ POS default price. A **disabled** PosClient is not attachable at POS (enforced by the consuming sale/order module; clients just exposes `isEnabled`).
7. **AdminClientDto roll-ups** (`totalOrders`, `totalSpent`, `lastOrderDate`): aggregated from `Order`/`Sale` for the linked PosClient. Those emitting modules are not built yet → the rows are absent, so aggregates read `0`/`null` today and light up automatically once sales/orders land. Compute via Prisma `groupBy`/`_count` on the linked `posClientId`.

### I.4 `clients.listener.ts` (needed) — injects `IClientsService`, `setup()` subscribes:

| Event (source) | Handler | Idempotency |
|---|---|---|
| `client.approved` (**own**, post-commit) | create linked `PosClient` (code via `DocType.POS_CLIENT`), set `Client.posClientId` | by `clientId`: skip if `Client.posClientId` already set (unique constraint is the backstop). |
| `sale.confirmed` (sales — future) | apply credit snapshot; `totalPaid += paidAmount`; `totalSold += totalAmount` on `posClientId` | by `saleId` (see §D-3 idempotency strategy). |
| `order.confirmed` (orders — future) | `totalSold += totalAmount` for linked POS client (when any) | by `orderId`. |
| `payment.clientRecorded` (billing — future) | `credit ↓ / totalPaid ↑` per snapshot | by `paymentId`. |
| `return.created` (sales — future) | apply refund effect per payload | by `returnId`. |

All handlers wrapped in the same `safeRun` guard the observability listener uses (a throw/rejection must never propagate back into `eventBus.emit`'s synchronous dispatch). Every cache write emits `posClient.creditChanged` when `credit` moves (audit narrates). Sales/orders/billing emitters are **not yet built** — these four handlers are wired now and stay dormant until then (their event keys are already in the typed bus).

### I.5 Cross-module reads (dependency inversion — clients imports **no** module directly)

Two read seams, both satisfied by ports whose real implementation lives in the owning module and is injected in `modules/index.ts` (the only place allowed to know both — mirrors the `inventoryPortAdapter` precedent):

- **Catalog cart-pricing read port** `ICatalogCartPort.getCartProducts(productIds, viewer): Promise<ProductWithPricingDto[]>` — implemented by `catalogProductService` (it already computes the price matrix per viewer/category), injected into clients. Used by `getCart`. *(catalog currently exposes `listProducts(query, viewer)` which is pagination-shaped, not id-set-shaped; a thin id-set read method is the clean addition — §C-3.)*
- **Observability client-activity read** for `ADMIN_DETAIL /activity` — delegate to the observability module's existing read service via an injected read port, rather than clients re-querying `ClientActivityLog`.

Category existence on `approve`/`createPosClient` is validated by the `categoryId` FK (Prisma `P2003` → `BadRequestError`), so no catalog port is needed for that.

---

## PART II — MODULE `purchasing`

Merges *supplier* + *supplier-invoice (goods receipt)* + *supplier-payments*.

### II.1 Step 1 — Contract & Schema analysis

Prisma models: `Supplier`, `SupplierInvoice`, `SupplierInvoiceLine`, `SupplierPayment`, plus reads of `Product` (name + `averageCost`/`quantityOnHand` for landed/projection) and `Staff` (`staffName`).

`purchasing.mapper.ts` — pure/static, field-listing, `Decimal → number`, `Date → ISO`, `SupplierInvoiceStatus` passthrough:

| Method | Source → DTO | Notes |
|---|---|---|
| `toSupplierDto` | `Supplier` (+ `invoiceCount` aggregate) → `SupplierDto` | `credit/totalPaid/totalInvoiced` `Decimal→number`; `invoiceCount` from `_count.invoices`; `lastDeliveryAt?` ISO. |
| `toSupplierInvoiceDto` | `SupplierInvoice` (+ lines, supplier, staff) → `SupplierInvoiceDto` | `invoiceDate`/`dueDate` are `@db.Date` → **`z.iso.date()`** (date-only string, not datetime); `status` enum; `previousCredit?/newCredit?` present only once CONFIRMED; `lines[].projectedNewAverageCost?` injected on **DRAFT reads only** (II.3 #2), absent when CONFIRMED. `staffName` from staff relation. |
| `toConfirmResultDto` | computed → `ConfirmResultDto` | `reference` + `repriceCandidates[]` (built from the catalog reprice read port, II.5). |
| `toSupplierPaymentDto` | `SupplierPayment` (+ supplier, staff) → `SupplierPaymentDto` | snapshot `previousCredit/newCredit`; `paidAt` ISO datetime. |
| `toSupplierDetailDto` | aggregate → `SupplierDetailDto` | `{ supplier, invoices[], payments[], productHistory[] }`; productHistory from `groupBy` over confirmed invoice lines. |
| `toSupplierStatsDto` | aggregate → `SupplierStatsDto` | `{ totalSuppliers, totalCredit, totalInvoiced }`. |

### II.2 Step 2 — Component definition

**Interface** `IPurchasingService` (`purchasing.interface.ts`):

```
// Suppliers (admin)
listSuppliers(query: SupplierListQuery): Promise<PaginatedResult<SupplierDto>>
supplierStats(): Promise<SupplierStatsDto>
getSupplier(id: string): Promise<SupplierDetailDto>            // SUPPLIER_DETAIL aggregate
createSupplier(cmd: CreateSupplierCommand): Promise<SupplierDto>   // initialCredit? opening
updateSupplier(id: string, cmd: UpdateSupplierCommand): Promise<SupplierDto>   // + isEnabled toggle
// Supplier invoices (admin)
listInvoices(query: SupplierInvoiceListQuery): Promise<PaginatedResult<SupplierInvoiceDto>>
getInvoice(id: string): Promise<SupplierInvoiceDto>           // DRAFT reads carry projectedNewAverageCost
createInvoice(cmd: CreateSupplierInvoiceCommand, staffId: string): Promise<SupplierInvoiceDto>  // DRAFT
updateInvoice(id: string, cmd: UpdateSupplierInvoiceCommand): Promise<SupplierInvoiceDto>       // DRAFT only → 409
confirmInvoice(id: string, staffId: string): Promise<ConfirmResultDto>
cancelInvoice(id: string, cmd: CancelSupplierInvoiceCommand, staffId: string): Promise<SupplierInvoiceDto>
// Payments (admin ledger)
listPayments(query: SupplierPaymentListQuery): Promise<PaginatedResult<SupplierPaymentDto>>
createPayment(cmd: CreateSupplierPaymentCommand, staffId: string): Promise<SupplierPaymentDto>
// Internal — invoked by the module's own listener:
recomputeSupplierCaches(supplierId: string, tx?): Promise<void>
```

**Events emitted**: `supplierInvoice.confirmed`, `supplierInvoice.cancelled`, `payment.supplierRecorded`, `supplier.creditChanged`.
**Events listened** → `purchasing.listener.ts` **is needed** (II.4).

### II.3 Business logic — spec §Business Logic

1. **DRAFT is freely editable and touches nothing** (no stock, no credit). `amountOnly` **XOR** `lines` on create is already enforced by `CreateSupplierInvoiceSchema.refine`; on update the schema enforces mutual-exclusion. Backend still guards: a body with neither on create → `400` (schema catches it). `supplierId` is not reassignable (not in `UpdateSupplierInvoiceSchema`).
2. **Landed cost** (computed when lines/shipping are written, stored on `SupplierInvoiceLine.landedUnitCost`):
   `lineTotal = unitCost × quantity`; `landedUnitCost = unitCost + shippingCost × (lineTotal / Σ lineTotals) / quantity`.
   `totalAmount = Σ lineTotal + shippingCost` (for `amountOnly` invoices: `totalAmount = amountOnly`, no lines, no stock).
   **`projectedNewAverageCost`** is **not stored** — computed on DRAFT reads per line from the product's current `averageCost`/`quantityOnHand` (via the catalog reprice read port, II.5): `(qtyOnHand·avgCost + qty·landedUnitCost)/(qtyOnHand+qty)`. Shows the buyer the margin impact before committing.
   `productNameSnapshot` captured from `Product.name` at line-write time (via the read port).
3. **Confirm — one transaction, idempotent** (`FOR UPDATE` lock on the `Supplier` row for credit-snapshot concurrency, mirroring `SequenceService`'s `Setting` lock):
   - Guard: if already `CONFIRMED` → **no-op**, return the same `ConfirmResultDto` (recompute `repriceCandidates`), add **no** layers (spec "double-confirm no-op"). If `CANCELLED` → `409`.
   - Per line: **injected** `inventoryService.addLayer(tx, productId, quantity, landedUnitCost, MovementType.SUPPLIER_INVOICE, ref)` — this updates `Product.quantityOnHand`/`averageCost` inside the same tx.
   - Snapshot header credit: read locked supplier `credit` (previous) → `newCredit = previous + totalAmount` → write `previousCredit`/`newCredit` on the invoice header.
   - `reference` via `SequenceService(tx, DocType.SUPPLIER_INVOICE)` → status `CONFIRMED` → **commit**.
   - After commit: `inventoryService.flushEvents(tx)` (the FIFO engine's post-commit seam), then emit `supplierInvoice.confirmed {invoiceId, supplierId, totalAmount, previousCredit, newCredit}`.
   - Return `ConfirmResultDto.repriceCandidates` (built from post-`addLayer` `averageCost` via the read port) — the UI's **skippable** reprice prompt; **actual repricing goes through `CATALOG_ROUTES.PRICING`**, never here.
   - Zero-line (`amountOnly`) confirm raises credit, **zero stock movements**.
4. **Immutable after confirm**: `updateInvoice` on a non-DRAFT → `409`. **Cancel** reverses credit via the `supplierInvoice.cancelled` event (listener), reason optional. **Stock reversal is NOT automatic** — it is a deliberate `ADJUSTMENT_OUT` performed by the admin through the inventory module (the goods are physically present). Purchasing never touches stock on cancel.
5. **Payments**: snapshot math on the row (`previousCredit`/`newCredit`), `on-account` allowed (`supplierInvoiceReference?` optional), **overpayment permitted** (`credit` may go negative = supplier owes; flag it in the response/derived state). `reference` needs a sequence (§C-2). Emits `payment.supplierRecorded`. Concurrent payments on one supplier serialize via the `FOR UPDATE` supplier lock.
6. **Opening credit** from `initialCredit` on `createSupplier`. Conformance: `credit = opening + Σ confirmed invoices − Σ payments` (the `cache = ledger` property test).

### II.4 `purchasing.listener.ts` (needed) — injects `IPurchasingService`, `setup()` subscribes to its **own** post-commit events (state mirror; audit also listens independently):

| Event (own) | Handler | Idempotency |
|---|---|---|
| `supplierInvoice.confirmed` | `Supplier.credit += total`, `totalInvoiced += total`, `lastDeliveryAt = now` | by `invoiceId` (§D-3). |
| `supplierInvoice.cancelled` | reverse the confirmed effect (credit −= total, totalInvoiced −= total) | by `invoiceId`. |
| `payment.supplierRecorded` | `Supplier.credit −= amount`, `totalPaid += amount`; update the target invoice `paidAmount`/derived status | by `paymentId`. |

Recommended concrete mechanism: **recompute the supplier caches from the ledger** (`recomputeSupplierCaches`) on each event rather than blind increment — naturally replay-safe *and* it directly satisfies the `credit = opening + Σ confirmed − Σ payments` conformance test (§D-3). Same `safeRun` guard.

### II.5 Cross-module seams (dependency inversion — purchasing imports **no** module directly)

- **Inventory engine** `inventoryService` (real `IInventoryService`) — `addLayer` + `flushEvents`, imported into `purchasing.routes.ts` from `inventory.routes`. `MovementType.SUPPLIER_INVOICE` already exists (contract enum, used by inventory's `referenceLabel` batch-fetch of `SupplierInvoice.reference`).
- **Catalog reprice read port** `ICatalogRepricePort` (implemented by `catalogProductService`, injected via `modules/index.ts`):
  - `getRepriceCandidates(tx, productIds): Promise<{ productId; name; averageCost; current:{ guestPrice?; defaultSalePrice?; categoryPrices[] } }[]>` — reads `Product` (incl. post-`addLayer` `averageCost`) + `ProductPrice` **inside the confirm tx** so it sees the new average. Builds `ConfirmResultDto.repriceCandidates`.
  - `getCostBasis(productIds): Promise<{ productId; name; averageCost; quantityOnHand }[]>` — for DRAFT `projectedNewAverageCost` + `productNameSnapshot` (plain read, no tx).
  *(catalog owns Product pricing + `ProductPrice`; `averageCost`/`quantityOnHand` are columns inventory maintains but that live on `Product`. Reading them through the catalog port keeps purchasing dependency-inverted; §C-3.)*
- **SequenceService** (`platform.routes`) — `DocType.SUPPLIER_INVOICE` (invoice ref, exists), plus the two **missing** DocTypes (§C-2).

---

## PART III — SHARED: tests, files, wiring, prerequisites, deviations

### A. Step 3 — Test strategy (`test-rules.md`; mirror `delivery-company`/inventory)

**Factories** (`test/data/`, contract-shaped). Present: `client.factory`, `pos-client.factory`, `client-category.factory`, `client-activity.factory`, `product.factory`, `product-price.factory`, `wilaya.factory`, `staff.factory`. **Add:** `supplier.factory`, `supplier-invoice.factory` (+ lines), `supplier-payment.factory`, `client-cart.factory`. (Codes in factories stay random strings — real code allocation is the SequenceService's job under test.)

**Unit** (`test/unit/modules/clients/`, `.../purchasing/` — mock Prisma, spy `eventBus`, fake injected ports):
- Mappers: field-exclusion (no raw `status`/`category` in `ClientMeDto`; `Decimal→number`; `Date→ISO`; `@db.Date → date-only`), conformance `.parse` never throws on valid input.
- clients service: phone three states; duplicate register status-specific `409`; approve happy path calls the identity port + emits `client.approved`; approve on non-PENDING `409`; `changeMyPassword`/`resetPassword` revoke tokens; `updateMe` never writes phone; cart upsert/delete idempotent.
- clients listener: `client.approved` replay ⇒ exactly one PosClient; cache handlers apply snapshot once per document id.
- purchasing service: `amountOnly + lines` → `400`; landed-cost math vs hand calc; **confirm** adds one layer per line at landed cost and the resulting `averageCost` matches hand calc; **double-confirm no-op**; zero-line confirm raises credit with zero movements; `PATCH` after confirm `409`; payment snapshot math; overpayment ⇒ negative credit flagged.
- purchasing listener: confirmed/cancelled/paymentRecorded update caches; replay is a no-op (`cache = ledger`).

**Integration** (`test/integration/clients.integration.spec.ts`, `purchasing.integration.spec.ts`, real test DB, `ApiResponse` envelope asserted): every route with its real guard — phone/register/me/cart, approve→pos-client materialization, admin list/detail/stats; supplier CRUD, invoice DRAFT→confirm→(reprice candidates)→payment ledger, cancel, `PATCH`-after-confirm `409`. **Concurrency**: two parallel payments on one supplier serialize (supplier `FOR UPDATE`); two parallel confirms are safe/no-op.

**Contract conformance** (`test/contract/routes.conformance.spec.ts`): every registered route uses a `*_ROUTES` constant; every response body parses against its DTO schema. **Property test**: `PosClient.credit == ledger recompute` and `Supplier.credit == opening + Σ confirmed − Σ payments`.

### B. Step 4 — File checklist (create only what each module needs — **6 files each**, listener included)

`apps/api/src/modules/clients/`
1. `clients.mapper.ts`
2. `clients.interface.ts`
3. `clients.service.ts`
4. `clients.listener.ts`  ✅ (listens: approved self + sale/order/payment/return)
5. `clients.controller.ts`
6. `clients.routes.ts` (composition root)

`apps/api/src/modules/purchasing/`
1. `purchasing.mapper.ts`
2. `purchasing.interface.ts`
3. `purchasing.service.ts`
4. `purchasing.listener.ts`  ✅ (listens: own confirmed/cancelled/paymentRecorded)
5. `purchasing.controller.ts`
6. `purchasing.routes.ts` (composition root)

Controllers stay thin (`try/catch → next(error)`, read `req.validated`, `sendSuccess` with the right status: `201` create, `200` read/update, `204` cart delete). Arrow-method fields (no `.bind()`).

### B.1 Route registration map (guards + validation; mount prefix `env.API_PREFIX`)

**clients** — mounted paths already carry `/auth`, `/clients`, `/admin`, `/staff` prefixes in the constants:
| Route const | Guard | Validation |
|---|---|---|
| `VALIDATE_PHONE` POST | public | `body: RegisterClientSchema.pick? ` → phone only; use a small inline `{ phone }` from `AddCart* ` — **use existing** `RegisterClientSchema`’s phone by a params/body `{phone:string}`; no new schema if a `{ phone }` body schema is added to contract (§D-1). |
| `REGISTER` POST | public | `body: RegisterClientSchema` |
| `ME` GET/PATCH | `requireAuth({ types:[CLIENT] })` | PATCH `body: UpdateMeSchema` |
| `ME_PASSWORD` POST | `requireAuth({types:[CLIENT]})` | `body: ChangeMyPasswordSchema` |
| `CART` GET/POST, `CART_ITEM` DELETE | `requireAuth({types:[CLIENT]})` | POST `body: AddCartItemSchema`; DELETE `params: CartItemParamsSchema` |
| `ADMIN_LIST` GET, `ADMIN_STATS` GET | `requireAuth({types:[ADMIN], checkDB:true})` | `query: AdminClientListQuerySchema` |
| `ADMIN_DETAIL` GET | admin | `params: ClientIdParamsSchema` |
| `APPROVE`/`REJECT`/`RESET_PASSWORD` POST, `ADMIN_UPDATE` PATCH | admin | `params: ClientIdParamsSchema` + resp. body schema |
| `POS_CLIENT_ROUTES.SEARCH` GET | `requireAuth({ pages:[STAFF_POS, STAFF_POS_CLIENTS] })`* | `query: PosClientSearchQuerySchema` |
| `QUICK_CREATE` POST | `requireAuth({ pages:[STAFF_POS_CLIENTS] })` | `body: CreatePosClientSchema` |
| `ADMIN` GET/POST, `ADMIN_BY_ID` PATCH | admin | body `CreatePosClientSchema`/`UpdatePosClientSchema`, params `PosClientIdParamsSchema` |

\* `SEARCH` is `STAFF_POS **or** STAFF_POS_CLIENTS`. `requireAuth({pages})` requires **all** listed pages (AND) — a genuine HOW mismatch (§D-2): implement as a small OR check (either page present, ADMIN bypasses) rather than the AND semantics, since the contract's access column says `STAFF_POS or STAFF_POS_CLIENTS`.

**purchasing** — all admin (`requireAuth({types:[ADMIN], checkDB:true})`), constants carry `/admin`:
`SUPPLIERS` GET(`SupplierListQuerySchema`)/POST(`CreateSupplierSchema`), `SUPPLIER_STATS` GET, `SUPPLIER_DETAIL`/`SUPPLIER_BY_ID` GET+PATCH(`SupplierIdParamsSchema`+`UpdateSupplierSchema`), `INVOICES` GET(`SupplierInvoiceListQuerySchema`)/POST(`CreateSupplierInvoiceSchema`), `INVOICE_BY_ID` GET+PATCH(`SupplierInvoiceIdParamsSchema`+`UpdateSupplierInvoiceSchema`), `CONFIRM` POST, `CANCEL` POST(`CancelSupplierInvoiceSchema`), `PAYMENTS` GET(`SupplierPaymentListQuerySchema`)/POST(`CreateSupplierPaymentSchema`).
Note: `SUPPLIER_STATS` (`/admin/suppliers/stats`) must be registered **before** `SUPPLIER_BY_ID` (`/admin/suppliers/:id`) so `stats` is not captured as an `:id`.

### B.2 Wiring (`apps/api/src/modules/index.ts` — the real extension point)

Add, at the marked EXTENSION POINT, following the existing `inventoryPortAdapter` precedent (only the aggregator knows two modules):
```
// clients: inject identity (client provisioning + resetPassword), sequence, catalog cart port, observability activity port
// purchasing: inject inventory engine, sequence, catalog reprice port
apiRouter.use(clientsRouter);
apiRouter.use(purchasingRouter);
```
Each module's `routes.ts` is the composition root: `new XxxService(prisma, ...injectedPorts)`, `new XxxController(service)`, `new XxxListener(service).setup()`. The catalog reprice/cart ports and the identity client-provisioning port are adapter objects declared in `index.ts` (or exported from the owning module's `routes.ts`) and passed into the consumer's router factory — **neither consumer imports the other module's folder directly**. Confirm `catalogProductService` (already exported) is the port implementer; `inventoryService` and `sequenceService` are imported from their `routes.ts`.

### C. Prerequisites outside the 6 files (genuine gaps — flagged, not silently coded around)

1. **Identity must provision CLIENT users** (the documented handoff). `createUser` is STAFF/ADMIN-only (always creates a `Staff` row; `CreateUserSchema.type ∈ {ADMIN,STAFF}`). **Recommended:** add to `IIdentityService` a method `provisionClientUser(input:{username; password; clientId}, tx): Promise<{ userId:string }>` that creates a `type:CLIENT` `User` (no Staff row, hashes via the existing Argon2id util, emits nothing — caller emits after commit), and **export the identity service singleton** from `identity.routes.ts` (it currently exports only `router`). Alternative (worse): clients writes the `User` row itself using `@common/utils/password` — rejected, it duplicates identity's hashing/uniqueness handling and crosses the module boundary. → clients approve/reset depends on this.
2. **`DocType` needs `SUPPLIER` and `SUPPLIER_PAYMENT`** (contract enum) with seed prefixes (`settings-defaults.ts` — `Record<DocType,string>` is exhaustive, so both must be added there and are picked up by `platform.mapper` fallback). Suggested prefixes avoiding the existing `SUP` (=`SUPPLIER_INVOICE`): `SUPPLIER → 'FRN'` (supplier `code`), `SUPPLIER_PAYMENT → 'PAY'` (payment `reference`). Client/PosClient/SupplierInvoice codes already have DocTypes — no change. → purchasing supplier-create and payment-create depend on this.
3. **Catalog read ports** for cart pricing (`getCartProducts`) and reprice/cost-basis (`getRepriceCandidates`/`getCostBasis`). Small read methods on the existing `catalogProductService`; no schema change, purely additive. → clients cart + purchasing confirm/DRAFT-projection depend on these.

### D. Deviations & open decisions (resolved toward the rules per standing rules; noted)

1. **Missing contract DTOs/schemas** (add in the sprint, not invented ad hoc in the service): `ADMIN_STATS` response DTO (`clients.dtos.ts`) and a `{ phone }` body schema for `VALIDATE_PHONE` (`clients.command.ts`). Everything else exists. These are real omissions, added to the **contract** so the mapper's `.parse` guard and conformance suite cover them.
2. **`SEARCH` access is OR, `requireAuth({pages})` is AND** — implement an OR page-check for `POS_CLIENT_ROUTES.SEARCH` (either `STAFF_POS` or `STAFF_POS_CLIENTS`, ADMIN bypasses). HOW-conflict resolved toward the contract's stated access; a one-off inline guard, not a middleware redesign.
3. **Aggregate-cache idempotency = recompute-from-ledger** (both modules). The spec says "idempotent by source-document id"; there is no processed-events table. Recomputing `Supplier`/`PosClient` caches from their ledgers on each event is replay-safe by construction *and* is exactly what the `cache = ledger` conformance property asserts — chosen over blind increment (which needs an external dedupe store). HOW choice, resolved toward the rules' idempotency requirement. Header snapshots (`previousCredit`/`newCredit` on invoice/payment rows) are still computed once, inside the writing transaction, under the supplier `FOR UPDATE` lock.
4. **Cross-module coupling stays inverted**: purchasing↔inventory/catalog and clients↔identity/catalog/observability all go through injected ports assembled in `modules/index.ts`; neither new module imports another module's folder. Follows the established `inventoryPortAdapter`/`catalogPricingService` precedent (inventory plan §6/§8).
5. **Single service per module** (`IClientsService`, `IPurchasingService`) despite each merging 2–3 aggregates — the aggregates are tightly coupled (approval materializes a PosClient; invoices/payments mutate supplier credit), so one cohesive vertical slice is clearer than catalog's 3-way split. Splitting later is non-breaking.
6. **Sales/orders/billing emitters are unbuilt** — clients' `sale.confirmed`/`order.confirmed`/`payment.clientRecorded`/`return.created` handlers and the `AdminClientDto` order/sale roll-ups are wired now and stay dormant/zero until those modules land (event keys already in the typed bus; tables already in the schema).

### E. Definition of done

- 12 files (6 + 6) created; both routers mounted at the `modules/index.ts` extension point with their ports injected.
- Prerequisites §C-1/§C-2/§C-3 landed (identity client-provisioning + singleton export; two `DocType` values + seed prefixes; catalog read ports) — sequenced **before** the dependent endpoints.
- Every service method returns a DTO that `.parse`es against its contract schema; every route uses a `*_ROUTES` constant.
- Unit + integration + conformance green, including: phone three-states, approve-atomicity/replay ⇒ one PosClient, reset logs the client out everywhere, `Me PATCH phone → 400`, `amountOnly+lines → 400`, confirm one-layer-per-line + avg matches hand calc + double-confirm no-op, `PATCH`-after-confirm `409`, concurrent payments serialize, and both `cache = ledger` property tests.
