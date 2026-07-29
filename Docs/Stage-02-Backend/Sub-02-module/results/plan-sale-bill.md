# Stage 02 · Sub-02 — Module Implementation Plan: `sales` + `billing` (set 06)

> Two modules planned together because they are one commercial flow: a POS `sale.confirmed`
> event is the trigger that makes `billing` issue an invoice, and both share the same injected
> seams (`SequenceService`, `InventoryService`) and the same event-driven credit/ledger pattern
> already established by `clients`/`purchasing` (set 05). **No code in this document.** Files are
> created in a later sprint sub-stage.
>
> Standing-rule resolution: **rules** (`module-implementation-rules.md`) govern HOW, the **phase
> file** WHAT/WHEN, the **contract** (`@dragon-telecom/contract`) WHICH. Everything the contract
> already declares is reused verbatim; nothing below re-declares a DTO/Command/Query/route/enum/
> event. HOW-conflicts are resolved toward the rules and noted in §D. Genuine **prerequisite gaps**
> (not HOW-conflicts) are surfaced in §C with a recommended resolution rather than halting — they
> are anticipated handoffs, exactly like set 05's `DocType.SUPPLIER`/`SUPPLIER_PAYMENT` additions.

---

## 0. Pre-flight verification (standing rule: confirm nothing must be newly declared)

Confirmed present in `@dragon-telecom/contract` (barrel re-exports both modules — `src/index.ts`); **reused verbatim, never re-declared**:

**sales** (`modules/sales/`)
- Routes: `SALE_ROUTES` — `CREATE_DRAFT`, `UPDATE_DRAFT`, `CONFIRM`, `STAFF_LIST`, `ADMIN_LIST`, `STAFF_DETAIL`, `ADMIN_DETAIL`, `RETURN`. *(`STAFF_DETAIL`/`ADMIN_DETAIL` already split the spec's `(staff|admin)` notation — do not add a combined one.)*
- Commands: `SaleDraftSchema`, `UpdateSaleDraftSchema`, `ConfirmSaleSchema`, `CreateReturnSchema`.
- Queries/params: `SaleListQuerySchema`, `SaleReferenceParamsSchema`, `SaleIdParamsSchema`.
- DTOs: `SaleResponseSchema`/`SaleDto`, `ReceiptResponseSchema`/`ReceiptDto`.
- Enums: `SaleStatus` (DRAFT/COMPLETED/RETURNED/PARTIALLY_RETURNED/CANCELLED), `SaleOrigin` (POS/REPAIR), `ReturnType` (REFUND/EXCHANGE).
- Events: `SalesEvents` — **emits** `sale.confirmed`, `return.created`.

**billing** (`modules/billing/`)
- Routes: `BILLING_ROUTES` — `MY_INVOICES`, `MY_INVOICE_BY_NUMBER`, `MY_INVOICE_PDF`, `STAFF_INVOICES`, `STAFF_INVOICE_BY_NUMBER`, `STAFF_INVOICE_PDF`, `ADMIN_INVOICES`, `ADMIN_INVOICE_BY_NUMBER`, `ADMIN_INVOICE_PDF`, `CANCEL`, `STAFF_CLIENT_PAYMENTS`, `ADMIN_CLIENT_PAYMENTS`, `CLIENT_PAYMENTS_LIST`. *(Each `(/:number)(/pdf)` row is already expanded to three literals; `CLIENT_PAYMENTS` already split into STAFF/ADMIN — do not add.)*
- Commands: `CancelInvoiceSchema`, `CreateClientPaymentSchema`.
- Queries/params: `InvoiceListQuerySchema`, `ClientPaymentListQuerySchema`, `InvoiceNumberParamsSchema`.
- DTOs: `InvoiceResponseSchema`/`InvoiceDto`, `ClientPaymentResponseSchema`/`ClientPaymentDto`.
- Enums: `InvoiceStatus` (ISSUED/PARTIALLY_PAID/PAID/CANCELLED), `InvoiceSource` (SALE/ORDER — never REPAIR).
- Events: `BillingEvents` — **emits** `invoice.issued`, `invoice.cancelled`, `payment.clientRecorded`; **listens** (documented in `billing.md`, payloads owned by the source module) `sale.confirmed`, `order.confirmed`, and its own `payment.clientRecorded`.

**Foundations reused (never redefined):** `@common/db/prisma`, `@common/middlewares` (`validateRequest`, `requireAuth`), `@common/http/response` (`sendSuccess`), `@common/events/event-bus` (typed `eventBus` — already unions `SalesEvents` + `BillingEvents`), `@common/errors` (`AppError`, `NotFoundError`, `ConflictError`, `BadRequestError`, `ForbiddenError`), `paginated(schema)` factory (`@dragon-telecom/contract`, `common/types`).

**Injected singletons already exported by built modules (direct sibling import — set 05 precedent):**
`sequenceService` (`platform.routes`), `inventoryService` (`inventory.routes`), `catalogProductService` (`catalog.routes`).

**Prisma models present** (`schema.prisma`, all built in Stage 01): `Sale`, `SaleLine`, `Return`, `ReturnLine`, `Invoice` (`@@unique([sourceType, sourceId])`), `InvoiceLine`, `ClientPayment`; reads of `PosClient`, `Product`, `ProductPrice`, `Staff`, `Repair`, `Order`, `Setting`.

**Page keys present** (`PageKey`, identity enums): `STAFF_POS`, `STAFF_SALES`, `STAFF_INVOICES`.

**Observability already listens** (`observability.listener.ts`) to `sale.confirmed`, `return.created`, `order.confirmed`, `invoice.issued`, `payment.clientRecorded` — audit narration is wired and dormant; **neither module calls the audit module directly.** `clients.listener.ts` already listens to `sale.confirmed`, `return.created`, `payment.clientRecorded` (dormant caches, set 05) — those handlers wake up the moment these modules emit.

---

## C. Prerequisite gaps (surfaced, not blocking — recommended resolution each)

These are not HOW-conflicts; the contract/foundation is genuinely missing a value or the spec prose diverges from the frozen contract. Each has a recommended resolution consistent with set-05 precedent.

- **C-1 · `DocType` is missing `RETURN` and `CLIENT_PAYMENT`.** `Return.reference` (`@unique`) and `ClientPayment.reference` (`@unique`) both need `SequenceService.nextNumber(tx, DocType)`, but `DocType` (`modules/platform/platform.enums.ts`) has only `INVOICE`, `SALE`, `ORDER`, `REPAIR`, `SUPPLIER_INVOICE`, `ADJUSTMENT`, `POS_CLIENT`, `CLIENT`, `SUPPLIER`, `SUPPLIER_PAYMENT`. `SALE` and `INVOICE` (→ `FAC-YYYY-NNNN`) exist and are reused as-is. **Recommended:** add `RETURN` and `CLIENT_PAYMENT` to `DocType`, plus their prefix + `nextSequences` seed in the `invoicing` Setting — exactly how set 05 added `SUPPLIER`/`SUPPLIER_PAYMENT`. (This is the only contract enum change either module needs.)

- **C-2 · No catalog port for POS category-price resolution.** `sales` confirm must "resolve price via catalog (attached POS client's category, else `defaultSalePrice`)". Catalog owns this rule (`ProductPrice[productId, clientCategoryId]` else `Product.defaultSalePrice`) but exposes only a *private* `loadPriceMap`; there is no public method. **Recommended:** catalog exposes a narrow read port `ICatalogPosPricingPort.resolvePosPrices(productIds, categoryId | null) → { productId, productName, resolvedPrice }[]`, injected into `SalesService` and wired in `modules/index.ts` — the same consumer-declares-the-shape / provider-satisfies-structurally precedent as inventory's `ICatalogPricingPort` and clients' `ICatalogCartPort`. Rationale in §D-2. *(Fallback if catalog is frozen this set: `SalesService` reads `ProductPrice`/`Product.defaultSalePrice` directly via the shared `prisma` singleton — a pure read, like clients reading `User` — but this duplicates catalog's price rule, so the port is preferred.)*

- **C-3 · `billing.md` says "cost/profit from the event", but the frozen `sale.confirmed.snapshotLines` carries no cost/profit.** The contract's `SalesEvents['sale.confirmed'].snapshotLines` is `{ productId, productName, quantity, unitPrice, lineTotal }` only (deliberately minimal per its own comment). **Resolution (contract wins over prose):** `billing` reads the source document's already-persisted `SaleLine` rows (`costOfGoods`→`costSnapshot`, `profit`) by `saleId` — they are immutable snapshots by issuance time. The event is used as the **trigger + credit-snapshot + idempotency key**, the persisted lines for the cost/profit detail. Cross-module *read* only (permitted; mirrors clients reading `User`). See §D-4.

- **C-4 · `order.confirmed` payload is thinner than an invoice needs, and `orders` is unbuilt.** `OrdersEvents['order.confirmed']` lacks `sourceReference`, `clientNameSnapshot`, credit snapshot, and cost/profit. **Resolution:** `billing`'s `order.confirmed` handler is implemented and wired now (dormant until orders emits), reading the `Order`/`PosClient` rows for the missing snapshot fields (same read-the-source approach as C-3). Full ORDER fidelity (credit snapshot, per-line cost) is a documented handoff to the orders module set; this set issues ORDER invoices with the fields available and `totalCost/totalProfit` defaulting to 0. Integration-tested by emitting a synthetic `order.confirmed` (billing.md test scenario: "Order invoice issued without any sale row").

- **C-5 · `CREDIT_REQUIRES_CLIENT` is a spec error *name*, not a contract `ErrorCode`.** `ErrorCode` (contract) is a closed enum without it. **Recommended (no contract churn):** throw `BadRequestError` (400, `ErrorCode.VALIDATION_ERROR`) with the machine-readable name surfaced via `message`/`details` `'CREDIT_REQUIRES_CLIENT'` — consistent with how purchasing surfaced its XOR/domain rules without minting new codes. (Adding `ErrorCode.CREDIT_REQUIRES_CLIENT` is the alternative if the team prefers a typed code.)

---

# PART I — MODULE `sales`

POS drafts → confirmation (FIFO consumption, credit, invoice-triggering event), admin returns/exchanges, and a listener that records repair pickups as REPAIR-origin sales. Staff-scoped.

## I.1 Step 1 — Contract & Schema analysis → `sales.mapper.ts`

Prisma models: `Sale` (+ `SaleLine`), `Return` (+ `ReturnLine`); reads of `PosClient` (name), `Staff` (staffName), `Product` (productName snapshot at draft time).

`sales.mapper.ts` — pure/static, **lists returned fields (never spreads)**, `Decimal → number` (shared `toMoney` helper, mirror purchasing/inventory), `Date → .toISOString()`, Prisma enum → contract enum, ends every method with `XxxResponseSchema.parse(dto)` (rules §4/§6):

| Mapper method | Source → DTO | Notes |
|---|---|---|
| `toSaleDto(sale, lines, ctx, { includeMargins })` | `Sale` + `SaleLine[]` → `SaleDto` | **Margin-gated:** when `includeMargins === false` (staff) omit `totalCost`, `totalProfit`, and each line's `costOfGoods`/`profit` (they are `.optional()` in the schema, so omission still parses); admin keeps them. `origin`/`status` = contract enums; `soldAt` ISO or omitted while DRAFT; `posClientName` from the joined `PosClient`; `staffName` from `Staff`; `resolvedPrice` **and** `unitPrice` both surfaced (override is `unitPrice ≠ resolvedPrice`, BL#4). |
| `toReceiptDto(sale, lines)` | `Sale` + `SaleLine[]` → `ReceiptDto` | Customer-facing: only `productName`/`quantity`/`unitPrice`/`lineTotal`/`serialNumbers` per line; figures `total`(=subtotal−discount, i.e. `totalAmount`), `previousCredit`, `grandTotal`, `totalPaid`, `newCredit` read straight from the stored snapshot (BL#2). Never any cost/profit. |
| `toPersistenceDraft(cmd, ctx)` | `SaleDraftCommand` → `Sale` + `SaleLine[]` create-input | DRAFT: `status=DRAFT`, no money/stock. `productNameSnapshot` resolved per line at draft time; `resolvedPrice`/`costOfGoods`/`profit` left at defaults (0) until confirm; `unitPrice` = the operator's input. |

**Margin gating lives in the mapper via the `includeMargins` flag**, not in a separate DTO — the contract models one `SaleDto` with optional cost fields (unlike catalog's separate Staff/Admin DTOs). Staff list/detail pass `false`; admin list/detail pass `true`.

## I.2 Step 2 — Components

### `sales.interface.ts` — `ISalesService`
Methods return contract DTOs (rules §4). The acting user (`{ staffId, type }`) is threaded from the controller for ownership/scoping (never trusted from the body):

```
createDraft(cmd: SaleDraftCommand, staffId): Promise<SaleDto>
updateDraft(id, cmd: UpdateSaleDraftCommand, actor): Promise<SaleDto>      // DRAFT-only guard; owner|admin
confirm(id, cmd: ConfirmSaleCommand, actor): Promise<ReceiptDto>           // the transaction; owner|admin
listStaffSales(query: SaleListQuery, staffId): Promise<PaginatedResult<SaleDto>>   // scoped staffId=me
listAdminSales(query: SaleListQuery): Promise<PaginatedResult<SaleDto>>            // all sellers, DRAFTs incl.
getSale(reference, actor): Promise<SaleDto>                                // owner|admin; margins per actor.type
createReturn(cmd: CreateReturnCommand, staffId): Promise<SaleDto>          // admin-only; returns updated sale
recordRepairSale(payload: RepairsEvents['repair.pickedUp']): Promise<void> // listener-only, never HTTP
```
Plus the injected port it declares for C-2: `ICatalogPosPricingPort` (consumer-declared shape).

**`confirm` returns `ReceiptDto`** (BL#2: "Receipt built from the stored snapshot") — the POS prints on confirm; `getSale` returns the richer `SaleDto`. (§D-3.)

### Events (out) — emitted by `SalesService`, after the DB transaction commits
- `sale.confirmed { saleId, origin, posClientId?, totalAmount, paidAmount, previousCredit?, newCredit?, snapshotLines }` — emitted by **both** the confirm path (`origin: POS`) and the repair-listener path (`origin: REPAIR`). Consumers already wired: `clients` applies credit/`totalPaid`/`totalSold`; `billing` issues the SALE invoice **unless `origin===REPAIR`**; observability narrates.
- `return.created { returnId, saleId, refundAmount, posClientId?, creditEffect? }` — `creditEffect` is the signed credit delta clients applies as an increment (clients' `applyReturnCreated` already expects exactly this).

### Events (in) → `sales.listener.ts`
Listens **`repair.pickedUp`** → `recordRepairSale`. Records a `COMPLETED` `Sale` with `origin: REPAIR`, copying the repair's `totalAmount`/`paidAmount`/`totalCost`/`totalProfit` and `snapshotParts` into `SaleLine`s (cost/profit copied verbatim — no FIFO re-consumption; stock was already consumed by the repair). Computes `previousCredit`/`newCredit` from the `PosClient` (same credit formula as confirm) and **emits `sale.confirmed` with `origin: REPAIR`** so `clients` still applies the credit; `billing` skips it by origin ⇒ **no invoice** (spec + billing.md: "REPAIR origin ⇒ none"). Wrap the handler in the same `safeRun` guard the clients/observability listeners use (a throw must never re-enter `eventBus.emit`).
- **Idempotency by `repairId`:** `Repair.saleId` is `@unique` and is the designated latch. In one transaction: if `Repair.saleId` already set → no-op; else create the sale, then `repair.updateMany({ where: { id: repairId, saleId: null }, data: { saleId } })` — if it updates 0 rows a concurrent replay won, so roll back. One sale, one event, on replay (test scenario).

### `sales.controller.ts`
Thin, `try/catch → next`, reads `req.validated`, acting user from `req.user!` (`staffId`, `type`), responds via `sendSuccess` (`201` create-draft; `200` update/confirm/list/detail/return). Passes `includeMargins = req.user!.type === UserType.ADMIN` down for `getSale`; the staff-list/admin-list split is by route (service scopes, not the controller — Data Mapping note).

### `sales.routes.ts` (composition root)
Manual DI: `new SalesService(prisma, sequenceService, inventoryService, catalogPosPricingPort)`; `new SalesController(service)`; `new SalesListener(service).setup()`. Sibling singletons imported directly (set-05 one-directional pattern). Access per route (§D-1):

| Route const | Method + path | Middleware | Service-level guard |
|---|---|---|---|
| `CREATE_DRAFT` | POST `/staff/sales` | `requireAuth({ pages:[STAFF_POS] })` | — |
| `UPDATE_DRAFT` | PATCH `/staff/sales/:id` | `requireAuth({ pages:[STAFF_POS] })` | DRAFT-only + owner (staffId=me) unless admin |
| `CONFIRM` | POST `/staff/sales/:id/confirm` | `requireAuth({ pages:[STAFF_POS] })` | DRAFT-only + owner unless admin |
| `STAFF_LIST` | GET `/staff/sales` | `requireAuth({ pages:[STAFF_SALES] })` | scope `staffId=me` |
| `ADMIN_LIST` | GET `/admin/sales` | `requireAuth({ types:[ADMIN], checkDB:true })` | — |
| `STAFF_DETAIL` | GET `/staff/sales/:reference` | `requireAuth({ types:[STAFF,ADMIN], checkDB:true })` | owner unless admin; `includeMargins=false` for staff |
| `ADMIN_DETAIL` | GET `/admin/sales/:reference` | `requireAuth({ types:[ADMIN], checkDB:true })` | `includeMargins=true` |
| `RETURN` | POST `/admin/returns` | `requireAuth({ types:[ADMIN], checkDB:true })` | — |

`validateRequest` per segment before the controller: `SaleDraftSchema` (body), `SaleIdParamsSchema` + `UpdateSaleDraftSchema`, `SaleIdParamsSchema` + `ConfirmSaleSchema`, `SaleListQuerySchema` (query), `SaleReferenceParamsSchema` (params), `CreateReturnSchema` (body). `admin` bypasses `pages` (middleware already skips page checks for `ADMIN`), so `|admin` on the POS routes needs no extra branch.

## I.3 Business logic (service)

1. **Draft:** holds no stock, no money; visible only to creator + admin (enforced in list scope + detail owner guard). `subtotal`/`totalAmount` may be previewed but authoritative money is set only at confirm.
2. **Confirm — one `prisma.$transaction`, idempotent:**
   - Reload the sale `FOR`-guard on `status===DRAFT` (a second confirm finds it `COMPLETED` → return the already-built receipt / `409` per §D-5).
   - Resolve prices via `catalogPosPricingPort.resolvePosPrices(productIds, posClient?.categoryId ?? null)` → per line keep `resolvedPrice` **and** the charged `unitPrice`.
   - Per line `inventoryService.consumeFifo(tx, productId, qty, revenue = unitPrice×qty, MovementType.SALE_OUT, ref{ referenceType:'SALE', referenceId: sale.id, staffId })` → `costOfGoods`/`profit`; **stock exhaustion throws → whole tx rolls back, sale stays DRAFT → 409** (test scenario).
   - Document totals: `subtotal = Σ lineTotal`, `totalAmount = subtotal − discountAmount`, `totalCost`/`totalProfit` = Σ line values.
   - Credit: `newCredit = previousCredit + (totalAmount − paidAmount)`; **underpayment (`paidAmount < totalAmount`) with no `posClientId` → 400 `CREDIT_REQUIRES_CLIENT`** (C-5) — thrown before any commit.
   - `reference = sequenceService.nextNumber(tx, DocType.SALE)`; `status=COMPLETED`, `soldAt=now`.
   - Commit → **after** commit: `inventoryService.flushEvents(tx)` (the FIFO engine's post-commit seam) **then** `eventBus.emit('sale.confirmed', …)`. Build `ReceiptDto` from the committed snapshot.
3. **Returns (admin):** per line `quantity ≤ sold − alreadyReturned` (else 400); `restock:true` ⇒ `inventoryService.returnIn(tx, originalConsumptions, qty, ref{ referenceType:'RETURN', … })` at the line's consumed cost; `restock:false` ⇒ no movement. `refundAmount` defaults to the charged price, reducible (validated `≥0`, `≤` line charge). Flip the sale to `RETURNED` (all lines) or `PARTIALLY_RETURNED`. `reference = nextNumber(tx, DocType.RETURN)` (C-1). Commit → flush → emit `return.created` with `creditEffect` = signed credit delta.
4. **Price override** is measured, never written back to the catalog (BL#4) — `resolvedPrice` is stored alongside `unitPrice` and that's the whole feature.

## I.4 Step 3 — Test strategy (`sales`)
- **Factories** (`test/data`): `saleDraftFactory`, `confirmSaleFactory`, `createReturnFactory`, `repairPickedUpFactory` (event payload).
- **Unit — mapper:** staff mapping omits `costOfGoods`/`profit`/`totalCost`/`totalProfit`; receipt figures kept (test scenario "staff mapping hides profit"); `Decimal→number`, `Date→ISO`, override surfaced (`unitPrice≠resolvedPrice`).
- **Unit — service (mock Prisma + mock injected ports/`eventBus`):** exhausted-stock confirm → 409, sale stays DRAFT, no event; credit math + receipt figures; underpaid anonymous → 400 `CREDIT_REQUIRES_CLIENT`; **double confirm → one `consumeFifo`, one `sale.confirmed`**; return restock calls `returnIn`, non-restock doesn't; `repair.pickedUp` replay → one sale, one event, no invoice (assert idempotency latch).
- **Integration (Supertest + test DB):** staff A reads staff B's sale → 403, admin OK; STAFF_LIST scoped to me; DRAFT invisible to non-owner; confirm end-to-end (stock drops, invoice event fires); RETURN admin-only (staff → 403).
- **Conformance:** every response parses against `SaleResponseSchema`/`ReceiptResponseSchema`; every route uses a `SALE_ROUTES` constant.

---

# PART II — MODULE `billing`

Merges **invoice** (outgoing immutable snapshots issued from `SALE`|`ORDER` events — never REPAIR) and the **client-payments ledger**. No draft, **no create-invoice HTTP route** — invoices exist only as event consequences. Reads for staff/client/admin, admin cancel, staff/admin payment creation, admin ledger, and PDFs.

## II.1 Step 1 — Contract & Schema analysis → `billing.mapper.ts`

Prisma models: `Invoice` (+ `InvoiceLine`), `ClientPayment`; reads of `PosClient` (name/address snapshot source), `Staff` (staffName), `Product.averageCost` (live join for admin `currentAverageCost`).

| Mapper method | Source → DTO | Notes |
|---|---|---|
| `toInvoiceDto(invoice, lines, ctx, { audience })` | `Invoice` + `InvoiceLine[]` → `InvoiceDto` | **Audience-gated:** `client`/`staff` omit `totalCost`/`totalProfit` and each line's `costSnapshot`/`profit`/`currentAverageCost`; **`admin`** keeps them and fills `currentAverageCost` from the live `Product.averageCost` join (ctx). `sourceType`/`status` = contract enums; `issuedAt` ISO, `dueDate` date-only if present; `clientNameSnapshot`/`clientAddressSnapshot` from the stored snapshot (never re-derived). |
| `toClientPaymentDto(payment, ctx)` | `ClientPayment` → `ClientPaymentDto` | `reference`, `posClientName` (joined), `invoiceNumber?` (joined via `invoiceId`), `amount`/`previousCredit`/`newCredit` `Decimal→number`, `paidAt` ISO, `staffName`. |
| `toInvoicePersistence(source, event, lines)` | source rows + event → `Invoice`+`InvoiceLine[]` create-input | Copies the immutable snapshot at issuance (§II.3 #1). Never spreads. |

Every method ends `XxxResponseSchema.parse(dto)`. **Client mapper 404s on foreign invoice numbers** — enforced in the service query (scoped `where posClientId = my linked posClientId`), not by the mapper (Data Mapping).

## II.2 Step 2 — Components

### `billing.interface.ts` — `IBillingService`
```
getMyInvoices(query, posClientId): Promise<PaginatedResult<InvoiceDto>>       // audience: client, scoped
getMyInvoice(number, posClientId): Promise<InvoiceDto>                          // 404 on foreign
getMyInvoicePdf(number, posClientId): Promise<PdfResult>
listStaffInvoices(query, staffId): Promise<PaginatedResult<InvoiceDto>>         // audience: staff, issued-by-me
getStaffInvoice / getStaffInvoicePdf(number, staffId)
listAdminInvoices(query): Promise<PaginatedResult<InvoiceDto>>                  // audience: admin, all filters
getAdminInvoice / getAdminInvoicePdf(number)
cancelInvoice(number, cmd: CancelInvoiceCommand, staffId): Promise<InvoiceDto>  // status-only
createClientPayment(cmd: CreateClientPaymentCommand, staffId): Promise<ClientPaymentDto>
listClientPayments(query): Promise<PaginatedResult<ClientPaymentDto>>           // admin ledger
// listener-only, never HTTP:
issueFromSale(payload: SalesEvents['sale.confirmed']): Promise<void>
issueFromOrder(payload: OrdersEvents['order.confirmed']): Promise<void>
applyClientPaymentRecorded(payload: BillingEvents['payment.clientRecorded']): Promise<void>
```
`PdfResult = { filename; mime: 'application/pdf'; body: Buffer }` — local internal type mirroring platform/inventory's `ExportResult` (not a contract DTO; PDFs bypass the `ApiResponse<T>` envelope, §D-6).

### Events (out) — after commit
- `invoice.issued { invoiceNumber, sourceType, sourceReference }` (issue paths), `invoice.cancelled { invoiceNumber, reason? }` (cancel), `payment.clientRecorded { paymentId, posClientId, invoiceNumber?, amount, previousCredit, newCredit }` (client-payment). Consumers already wired: `clients` (credit/`totalPaid`) and observability; billing's **own** listener also consumes `payment.clientRecorded`.

### Events (in) → `billing.listener.ts`
- `sale.confirmed` → `issueFromSale` — **skip when `payload.origin === REPAIR`**; else issue `sourceType SALE`. Idempotent via `Invoice @@unique(sourceType, sourceId)` — a duplicate insert hits P2002 and is swallowed as a no-op (one invoice on replay). Reads `Sale`/`SaleLine` for the cost/profit + `sourceReference` the event omits (C-3).
- `order.confirmed` → `issueFromOrder` — `sourceType ORDER`; same idempotency; reads `Order`/`PosClient` for the thin-payload fields (C-4).
- `payment.clientRecorded` (own) → `applyClientPaymentRecorded` — when `invoiceNumber` present, **recompute** `invoice.paidAmount = Σ ClientPayment.amount for that invoice` and set `status` (`ISSUED → PARTIALLY_PAID → PAID`); recompute-from-ledger is idempotent by construction (§D-7), unlike a blind increment. On-account payments (no `invoiceNumber`) are a no-op here.

All three wrapped in the `safeRun` guard.

### `billing.controller.ts`
Thin. Read `req.validated` + `req.user!`. PDF handlers stream the `Buffer` with explicit `Content-Type`/`Content-Disposition` (not `sendSuccess`). Others `sendSuccess` (`201` for `createClientPayment`; `200` reads/cancel). Audience derived from the route family (client/staff/admin), scoping value (`posClientId`/`staffId`) from `req.user!`.

### `billing.routes.ts` (composition root)
Manual DI: `new BillingService(prisma, sequenceService)`; `new BillingController(service)`; `new BillingListener(service).setup()`. Access:

| Route const(s) | Access middleware | Scope |
|---|---|---|
| `MY_INVOICES` / `_BY_NUMBER` / `_PDF` | `requireAuth({ types:[CLIENT] })` | via linked `posClientId`; 404 on foreign |
| `STAFF_INVOICES` / `_BY_NUMBER` / `_PDF` | `requireAuth({ pages:[STAFF_INVOICES] })` | issued-by-me (`staffId=me`) |
| `ADMIN_INVOICES` / `_BY_NUMBER` / `_PDF` | `requireAuth({ types:[ADMIN], checkDB:true })` | filters client/status/source/date |
| `CANCEL` | `requireAuth({ types:[ADMIN], checkDB:true })` | — |
| `STAFF_CLIENT_PAYMENTS` | `requireAuth({ pages:[STAFF_INVOICES] })` | — |
| `ADMIN_CLIENT_PAYMENTS` | `requireAuth({ types:[ADMIN], checkDB:true })` | — |
| `CLIENT_PAYMENTS_LIST` | `requireAuth({ types:[ADMIN], checkDB:true })` | ledger |

`validateRequest`: `InvoiceListQuerySchema` (query), `InvoiceNumberParamsSchema` (params), `CancelInvoiceSchema` (body), `CreateClientPaymentSchema` (body), `ClientPaymentListQuerySchema` (query). **Route order:** register `/:number/pdf` and `/:number/cancel` literals before the bare `/:number` so segments aren't captured as a number (the "stats before :id" precedent from purchasing).

## II.3 Business logic (service)

1. **Issue (listener):** copy snapshot lines + previous/new credit (from the event) + cost/profit (from the persisted source lines, C-3); `number = sequenceService.nextNumber(tx, DocType.INVOICE)` → `FAC-YYYY-NNNN`; store `clientNameSnapshot`/`clientAddressSnapshot` from `PosClient` at issue time. The document renders identically forever — never re-derived. Emit `invoice.issued` after commit.
2. **Cancel (admin):** `status → CANCELLED` only; numbers never reused, gaps never closed (the sequence counter is not rolled back). Emit `invoice.cancelled`.
3. **Client payment (`createClientPayment`, one transaction serialized on the `PosClient` row):** read the POS client's current `credit` under a row lock (`SELECT … FOR UPDATE` via `$queryRaw`, or a serializable tx) → snapshot `previousCredit`, `newCredit = previous − amount` → persist `ClientPayment` (`reference = nextNumber(tx, DocType.CLIENT_PAYMENT)`, C-1; `invoiceId` resolved from `invoiceNumber?` — **on-account allowed** when absent) → commit → emit `payment.clientRecorded`. **Overpayment allowed** → negative `credit` (store owes) and flagged in the response/dialog. The dialog's previous→new credit comes straight from the snapshot. `clients` applies the credit cache; billing's own listener updates the invoice paid/status.
4. **PDF:** server-rendered from the invoice snapshot + the settings-store header (read `Setting`), returned as a streamed `Buffer` (§D-6). Never recomputed from live product/price data.

## II.4 Step 3 — Test strategy (`billing`)
- **Factories:** `createClientPaymentFactory`, plus synthetic `sale.confirmed` / `order.confirmed` event builders.
- **Unit — mapper:** client/staff audience strips `costSnapshot`/`profit`/`currentAverageCost`/`totalCost`/`totalProfit`; admin keeps + injects live `currentAverageCost`; `Decimal→number`, `Date→ISO`.
- **Unit — service (mock Prisma/`eventBus`):** `sale.confirmed` REPAIR origin → no invoice; `sale.confirmed` replay → one invoice (P2002 swallowed); order path issues with no sale row; cancel changes status only and leaves the sequence gap; `payment.clientRecorded` recompute flips `ISSUED→PARTIALLY_PAID→PAID` and is idempotent on replay; overpayment → negative credit flagged; on-account payment issues no invoice update.
- **Integration:** client A cannot fetch client B's invoice (404); staff invoice list is issued-by-me; concurrent payments serialize (snapshots correct — previous/new credit chain consistent); PDF endpoint returns `application/pdf`.
- **Conformance:** responses parse against `InvoiceResponseSchema`/`ClientPaymentResponseSchema`; every route uses a `BILLING_ROUTES` constant.

---

## Cross-cutting — `modules/index.ts` wiring (the aggregator, the only place that knows both)

Add, at the `EXTENSION POINT (modules)`:
```
import { router as salesRouter } from './sales/sales.routes';
import { router as billingRouter } from './billing/billing.routes';
…
apiRouter.use(salesRouter);
apiRouter.use(billingRouter);
```
- `sales.routes.ts` directly imports `sequenceService`, `inventoryService`, and catalog's POS-pricing provider (C-2) — one-directional, no reverse dependency, same shape as `purchasing.routes.ts`. If C-2 is resolved as a catalog port, the aggregator supplies the concrete `catalogProductService`-backed adapter (mirroring the `inventoryPortAdapter` already in `index.ts`); if resolved as a direct `prisma` read, no aggregator change is needed.
- No new listener registration in `index.ts` — each module wires its own listener in its `routes.ts` (`new XListener(service).setup()`), matching every prior module.
- `clients`' and `observability`'s dormant handlers for `sale.confirmed`/`return.created`/`payment.clientRecorded`/`invoice.issued` become live automatically once these modules emit — no change to those modules.

---

## D. HOW-decisions & conflict resolutions (rules govern HOW; noted per standing rule)

- **D-1 · Access pages the spec left blank.** `UPDATE_DRAFT`/`CONFIRM`/`STAFF_DETAIL` say only "owner staff|admin" with no page. Chosen: `CREATE/UPDATE/CONFIRM → STAFF_POS` (the POS workflow that owns the draft), `STAFF_LIST → STAFF_SALES`, `STAFF_DETAIL → any authenticated STAFF/ADMIN + owner guard` (a POS operator who just confirmed may hold `STAFF_POS` but not `STAFF_SALES`). Ownership is always enforced in the **service** (staffId match), never the middleware — data-scoping is a service concern (spec Data Mapping: "filtered in the service, not the controller").
- **D-2 · Price resolution as an injected read port, not a direct table read.** Confirm needs a value (resolved price) computed by catalog's rule inside the sale flow ⇒ the connection rule points at an injected service. Catalog owns the `ProductPrice`/`defaultSalePrice` rule; duplicating it in `sales` would fork the pricing logic. Hence C-2's `ICatalogPosPricingPort`. (Direct `prisma` read is the documented fallback only if catalog is frozen this set.)
- **D-3 · `confirm` returns `ReceiptDto`, `getSale` returns `SaleDto`.** BL#2 explicitly builds the receipt at confirm; `ReceiptDto` has no other route to be produced by. The two DTOs are thereby both reachable.
- **D-4 · Cross-module reads are allowed; cross-module writes are not.** `billing` reads `Sale`/`SaleLine`/`Order` rows (C-3/C-4) — pure reads, precedented by clients reading `User`. The one write that crosses into another module's table is `sales` setting `Repair.saleId` (I.2) — justified because the schema deliberately places that `@unique` FK on `Repair` as the pickup latch, and only `sales` knows the new `saleId`.
- **D-5 · Double-confirm outcome.** A confirm on an already-`COMPLETED` sale is idempotent-safe: no second consumption, no second event. Returning `409 RESOURCE_CONFLICT` (not silently re-emitting) is the chosen surface; the test asserts "one consumption, one event".
- **D-6 · PDF endpoints bypass the `ApiResponse<T>` envelope.** Binary responses can't be wrapped by `sendSuccess`; they stream a `Buffer` with `Content-Type: application/pdf` — the exact precedent set by platform/inventory export endpoints (`ExportResult`). Conformance tests target the JSON endpoints only.
- **D-7 · Invoice `paidAmount` is recomputed from the payment ledger, not incremented.** Guarantees the own-listener is idempotent under replay (billing.md: "listener idempotent by source-document id") and keeps `paidAmount = Σ payments` as a checkable invariant — a stronger stance than clients' documented increment caveat, appropriate because the ClientPayment rows are the authoritative ledger.
- **D-8 · `MovementType` for sale consumption/return.** Uses the existing inventory `MovementType` members (`SALE_OUT` for consume, `RETURN_IN` for restock) with `referenceType` `'SALE'`/`'RETURN'` on the `MovementRef` — no new movement type; the FIFO engine's `flushEvents(tx)` post-commit seam is honored exactly as inventory's interface documents.

---

## File checklist (created in the later sprint sub-stage — 6-file architecture each)

**`apps/api/src/modules/sales/`**
1. `sales.mapper.ts` — `toSaleDto` (margin-gated), `toReceiptDto`, `toPersistenceDraft`.
2. `sales.interface.ts` — `ISalesService` + consumer-declared `ICatalogPosPricingPort`.
3. `sales.service.ts` — draft/confirm/return/list/detail + `recordRepairSale`; injects `PrismaClient`, `SequenceService`, `InventoryService`, POS-pricing port; emits `sale.confirmed`/`return.created`.
4. `sales.listener.ts` — subscribes `repair.pickedUp` (idempotent via `Repair.saleId` latch).
5. `sales.controller.ts` — thin HTTP handlers, actor from `req.user`.
6. `sales.routes.ts` — manual DI + routes + validation (composition root).

**`apps/api/src/modules/billing/`**
1. `billing.mapper.ts` — `toInvoiceDto` (audience-gated), `toClientPaymentDto`, `toInvoicePersistence`.
2. `billing.interface.ts` — `IBillingService` + local `PdfResult`.
3. `billing.service.ts` — issue/cancel/payment/list/detail/PDF; injects `PrismaClient`, `SequenceService`; emits `invoice.issued`/`invoice.cancelled`/`payment.clientRecorded`.
4. `billing.listener.ts` — subscribes `sale.confirmed` (skip REPAIR), `order.confirmed`, own `payment.clientRecorded`.
5. `billing.controller.ts` — thin handlers; PDF streams `Buffer`.
6. `billing.routes.ts` — manual DI + routes + validation (composition root).

**Aggregator:** `apps/api/src/modules/index.ts` — mount `salesRouter`, `billingRouter`; supply the POS-pricing adapter if C-2 → port.

**Contract prerequisite (C-1):** add `DocType.RETURN`, `DocType.CLIENT_PAYMENT` + `invoicing`-setting seeds. **Catalog prerequisite (C-2):** expose `ICatalogPosPricingPort`.

**Test files:** `test/data` factories listed in §I.4/§II.4; unit specs for each mapper/service; integration specs per route family; conformance covered by the mapper `.parse()` guards + the shared route-constant assertion.
