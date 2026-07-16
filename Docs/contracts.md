# Module Contracts — Shared Conventions

Read once; every module spec assumes these. They extend the global laws in `workflow.md`.

## Envelope, types, naming
- Every response is `ApiResponse<T>`; backend wraps with `sendSuccess`, frontend unwraps `data`.
- Zod 4 everywhere; types via `z.infer`; dates cross the wire as ISO strings (`z.iso.datetime()`).
- Inputs: `XxxCommand` (write) / `XxxQuery` (read). Outputs: `XxxDto`. Routes: `[MODULE]_ROUTES`, UPPERCASE keys.
- Money: `z.number()` decimal DZD. Cash is the only payment method — no method field anywhere.
- Lists paginated with `PaginationInfo { currentPage; totalPages; totalItems; itemsPerPage; hasNextPage; hasPreviousPage }`.
- `isEnabled` everywhere; **no delete endpoints exist in any module** — PATCH toggles.
- Notes, reasons, email: always `.optional()`.

## Access levels (used in every route table)
- `public` — no token.
- `client` — JWT with type CLIENT.
- `staff` — JWT with type STAFF **and** the named page key in the user's effective page set; data scoped to `staffId = me` where stated.
- `admin` — JWT with type ADMIN (bypasses the page matrix, sees unscoped data).
- `staff|admin` — staff with the page, or any admin.

## Events vs injected services (the decoupling rule)
Two connection mechanisms, chosen by one test — *does the caller need a return value inside its transaction?*

1. **Injected service (synchronous, transactional):** the inventory FIFO engine (`reserve / release / consumeFifo / addLayer` — consume returns `{ costOfGoods, consumptions[] }`) and the settings sequence service (`nextNumber(docType)`). Wired in `routes.ts` (composition root) like any other dependency. A sale cannot store `profit` without the FIFO result, so this is not optional.
2. **Domain events (after-commit, idempotent listeners):** everything that mirrors state elsewhere — supplier/POS-client credit, invoice issuance, audit narration, activity logging, low-stock signals. Emitted **after** the emitting transaction commits; every listener is idempotent (keyed by the event's document id) because the bus is at-least-once in spirit.

Event payloads are contract DTOs (`XxxEvent`), named past-tense (`sale.confirmed`, `payment.clientRecorded`). If it isn't in the contract, the event doesn't exist.

## Cross-module invariants (tested in conformance suites)
- `products.quantityOnHand` = Σ signed IN/OUT movements; `quantityReserved` = Σ PENDING; Σ `remainingQuantity` over IN layers = onHand.
- FIFO drains the oldest layer with remaining > 0; OUT never exceeds available (onHand − reserved).
- OUT `costOfGoods` = Σ consumption rows; `profit` = revenue − costOfGoods; document totals = Σ lines.
- `averageCost` recomputes only on IN — display reference; profit is strictly FIFO.
- Restocked returns re-enter at the consumed cost (from consumption rows).
- CONFIRMED supplier invoices, COMPLETED sales, ISSUED invoices: immutable. DRAFTs touch no stock, no money.
- Confirmations and repair completion are idempotent.
- Credit caches (pos_clients, suppliers) must equal ledger recomputation.
- Every money/stock/status/access mutation produces an audit event.

---

# Module: activity

The two behavioural logs: client browsing (price-snooping audit) and staff/admin product searches (inventory audit). Append-only.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `ACTIVITY_ROUTES.CLIENT_BEACON` | POST `/api/activity/client` | client | fire-and-forget |
| `ACTIVITY_ROUTES.STAFF_SEARCH` | POST `/api/activity/staff-search` | staff\|admin | beacon |
| `ACTIVITY_ROUTES.CLIENT_QUERY` | GET `/api/admin/clients/:id/activity` | admin | served via client module's route, backed here |
| `ACTIVITY_ROUTES.SEARCH_QUERY` | GET `/api/admin/activity/staff-searches` | admin | filters user/date/query |

```
ClientActivityCommand { type: 'SEARCH'|'PRODUCT_VIEW'|'CATALOG_SESSION';
                        query?; productId?; durationSeconds?: int.min(0) }
ClientActivityDto { type; query?; product? { id; name }; durationSeconds?; createdAt }
StaffSearchDto { userId; userName; query; matchedProduct? { id; name }; createdAt }
```

## Events [CONTRACT]
- **Listens** `product.searched` (staff/admin list searches) → writes a staff_search_log row.
- **Emits:** none — this module is a sink.

## Business Logic [BACKEND]
Beacons validate lightly, never block the caller (202 fast path), and rate-limit per subject. Retention is a DB concern, not an endpoint. Exposes a read service to the client module (detail Browsing tab) and to statistics (most-searched, viewed-no-purchase).

## Test Scenarios [BACKEND]
Beacon with junk → 400 without write. Duration only meaningful for PRODUCT_VIEW/CATALOG_SESSION (reject on SEARCH). product.searched event lands exactly one row. Query filters + pagination.

# Module: audit

The narrated audit trail. One human-readable description per mutation — no before/after JSON.

## API Interface [CONTRACT]

| Route const | Method + path | Access |
|---|---|---|
| `AUDIT_ROUTES.LIST` | GET `/api/admin/logs?search=&userId=&actionType=&from=&to=&page=&limit=20` | admin |
| `AUDIT_ROUTES.STATS` | GET `/api/admin/logs/stats` | admin |

```
AuditLogDto { id; user? { id; username }; actionType: string;   // open string, no enum
              entityType; entityId; description; ipAddress?; createdAt }
AuditStatsDto { totalLogs; logsToday; logsThisWeek; logsThisMonth }
```

## Events [CONTRACT]
- **Listens (wildcard set):** `auth.loggedIn`, `user.*`, `client.registered|approved|rejected|statusChanged`, `posClient.creditChanged`, `clientCategory.changed`, `taxonomy.changed`, `product.created|repriced`, `inventory.adjusted`, `supplier.creditChanged`, `supplierInvoice.confirmed|cancelled`, `order.*`, `sale.confirmed`, `return.created`, `repair.statusChanged|pickedUp|cancelled`, `invoice.issued|cancelled`, `payment.*`, `deliveryFees.changed`, `settings.changed`.
- **Emits:** none.

## Business Logic [BACKEND]
Each listener renders one narration including the before/after values in prose — e.g. "Order ORD-2026-0113: status confirmed → packaged", "POS client POS-0042: credit 1 500 → 3 200 (sale SAL-2026-0088)". Append-only; no update/delete path exists anywhere. Adding a new actionType = adding a listener, zero schema change.

## Test Scenarios [BACKEND]
One row per event, replay-safe (keyed by event id). Filters. Narration contains both values for status/credit changes. No mutation endpoint exists (404 by construction).

# Module: auth

Session lifecycle only (login / refresh / logout). Registration lives in `client`; identities in `user`. Template's auth module is the base — this spec is the delta.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `AUTH_ROUTES.LOGIN` | POST `/api/auth/login` | public | username accepts username, email, or phone |
| `AUTH_ROUTES.REFRESH` | POST `/api/auth/refresh` | public | rotation |
| `AUTH_ROUTES.LOGOUT` | POST `/api/auth/logout` | any authed | revokes the refresh token |

```
LoginCommand { username: string.min(1); password: string.min(4) }
LoginResultDto { authType: 'client'|'staff'|'admin'; accessToken; refreshToken;
                 profile: ClientSessionDto | StaffSessionDto }
RefreshCommand { refreshToken: string }
RefreshResultDto { accessToken; refreshToken }
LogoutCommand { refreshToken: string }
JwtPayload { sub: userId; type: 'CLIENT'|'STAFF'|'ADMIN'; clientId?; staffId? }   // in contract common/
```

## Events [CONTRACT]
- **Emits** `auth.loggedIn` → `AuthLoggedInEvent { userId; authType; ipAddress? }` (audit listens).
- **Listens:** none.

## Business Logic [BACKEND]
1. Login: find enabled user by username/email/phone (join clients.phone) → Argon2 verify → issue access JWT (15 min) + refresh token (7 d, random 256-bit, **hash stored**) → set `lastLoginAt` → emit.
2. Failure is one generic message for unknown user, wrong password, and disabled user — no enumeration oracle.
3. Refresh: match by hash, reject expired/revoked; **rotate** (revoke old, `replacedByTokenId`, issue new pair). Reuse of a revoked token revokes the whole chain.
4. Logout: revoke. Disabling a user kills all his refresh tokens immediately.

## Data Mapping [BACKEND]
Never expose `passwordHash`, token hashes, or token ids. Profile DTOs come from client/user mappers.

## Technical Constraints [BACKEND]
Argon2id; JWT secret from env; refresh tokens never logged; rate-limit login per IP + username.

## Test Scenarios [BACKEND]
Login ok per type → correct authType + redirect target data. Wrong password / unknown user / disabled → identical 401 body. Refresh rotates; reused revoked token kills chain (401). Logout revokes. Pending client (no users row) cannot log in by construction.

# Module: client-category

Pricing tiers. Name only — no rank, no default flag.

## API Interface [CONTRACT]

| Route const | Method + path | Access |
|---|---|---|
| `CLIENT_CATEGORY_ROUTES.LIST` | GET `/api/admin/client-categories` | staff\|admin (needed by POS + product forms) |
| `CLIENT_CATEGORY_ROUTES.CREATE` | POST `/api/admin/client-categories` | admin |
| `CLIENT_CATEGORY_ROUTES.UPDATE` | PATCH `/api/admin/client-categories/:id` | admin |

```
ClientCategoryDto { id; name; isEnabled; memberCount; pricedProductCount }
CreateClientCategoryCommand { name }        // unique
UpdateClientCategoryCommand { name?; isEnabled? }
```

## Events [CONTRACT]
- **Emits** `clientCategory.changed` → `{ categoryId; description }` (audit).
- **Listens:** none.

## Business Logic [BACKEND]
Name unique. Disabling requires zero enabled POS-client members (reject `CATEGORY_IN_USE` naming the count). Creating a category creates **no** product prices — `pricedProductCount` warns how sparse the tier is. Front-end hardcodes three price fields for now; nothing here assumes three.

## Test Scenarios [BACKEND]
Duplicate name 409. Disable with members 409 + count. memberCount/pricedProductCount correctness.

# Module: client

Web clients: registration (no password), phone check, approval (creates credentials + POS client), self profile, admin management, browsing-audit surface.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `CLIENT_ROUTES.VALIDATE_PHONE` | POST `/api/auth/validate-phone` | public | pre-submit check |
| `CLIENT_ROUTES.REGISTER` | POST `/api/auth/register` | public | creates PENDING client |
| `CLIENT_ROUTES.ME` | GET/PATCH `/api/clients/me` | client | phone read-only |
| `CLIENT_ROUTES.ME_PASSWORD` | POST `/api/clients/me/password` | client | |
| `CLIENT_ROUTES.ADMIN_LIST` | GET `/api/admin/clients` | admin | filters status/category |
| `CLIENT_ROUTES.ADMIN_DETAIL` | GET `/api/admin/clients/:id` | admin | aggregate + stats |
| `CLIENT_ROUTES.ACTIVITY` | GET `/api/admin/clients/:id/activity` | admin | browsing tab |
| `CLIENT_ROUTES.APPROVE` | POST `/api/admin/clients/:id/approve` | admin | |
| `CLIENT_ROUTES.REJECT` | POST `/api/admin/clients/:id/reject` | admin | reason optional |
| `CLIENT_ROUTES.ADMIN_UPDATE` | PATCH `/api/admin/clients/:id` | admin | contact, isEnabled |
| `CLIENT_ROUTES.STATS` | GET `/api/admin/clients/stats` | admin | |

```
ValidatePhoneCommand { phone }
ValidatePhoneResultDto { isValid; status: 'available'|'registered'|'pending' }
RegisterClientCommand { firstName; lastName; phone; email?; storeName?; wilayaCode; communeId }
ClientMeDto { id; firstName; lastName; phone; email?; storeName?; wilayaCode; communeId; address?;
              createdAt; credit; totalPaid }              // NO category, NO raw status
UpdateMeCommand { email?; storeName?; wilayaCode?; communeId?; address? }
ChangePasswordCommand { currentPassword; newPassword }
AdminClientDto { id; code; fullName; storeName?; username?; phone; email?; wilaya; commune;
                 categoryName?; status: 'PENDING'|'APPROVED'|'REJECTED'; isEnabled;
                 totalOrders; totalSpent; lastOrderDate?; createdAt; posClientId? }
ApproveClientCommand { username; password; categoryId }
RejectClientCommand { reason? }
ClientActivityQuery { type?; from?; to?; page? }
```

## Events [CONTRACT]
- **Emits** `client.registered` → `{ clientId }` (audit); `client.approved` → `ClientApprovedEvent { clientId; posClientSeed { name; phone; categoryId } }` (**pos-client listens** and creates the linked commercial identity); `client.rejected` / `client.statusChanged` (audit).
- **Listens** `posClient.created(from client.approved)` → stores the back-link `posClientId` (or the pos-client listener writes it — one owner, see backend note).

## Business Logic [BACKEND]
1. Phone check: match `clients.phone` → APPROVED ⇒ `registered`; PENDING ⇒ `pending`; none ⇒ `available`. Register re-runs it server-side.
2. Register: PENDING row, no users row — cannot authenticate by construction.
3. **Approve (one transaction):** create users row via injected `UserService.createUser` (type CLIENT) → set status APPROVED, approvedBy/At, link userId → commit → emit `client.approved`. The pos-client listener creates the POS client and writes `clients.posClientId` (idempotent on clientId).
4. Reject: status REJECTED, optional reason; phone stays occupied → future checks answer per status.
5. Me PATCH: phone immutable; profile edits never rewrite document snapshots.
6. Activity endpoint reads the activity module's store (injected read service) — searches, product views + duration, sessions.

## Data Mapping [BACKEND]
ClientMeDto hides category and status entirely (a logged-in client is APPROVED by definition; badge is a front-end constant "Active"). credit/totalPaid proxied from the linked POS client.

## Test Scenarios [BACKEND]
Phone check three states. Register duplicate phone → 409 with the status-specific code. Approval atomicity: user + status + (async) POS client; double-approve idempotent. Rejected/pending cannot log in. Me PATCH cannot change phone (400). Activity pagination + date filters.

# Module: delivery

Wilayas, communes, fees (wilaya-level + explicit commune overrides), fee resolution service, Excel import/export. The template's `delivery-company` reference module stays as the companies list source.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `DELIVERY_ROUTES.WILAYAS` | GET `/api/wilayas` | public | with communes |
| `DELIVERY_ROUTES.FEE` | GET `/api/delivery-fees?wilayaCode=&communeId=` | public | resolved pair |
| `DELIVERY_ROUTES.ADMIN_FEES` | GET/PUT `/api/admin/delivery-fees` | admin | wilaya rows + overrides |
| `DELIVERY_ROUTES.IMPORT` | POST `/api/admin/delivery-fees/import` | admin | Excel, validated |
| `DELIVERY_ROUTES.EXPORT` | GET `/api/admin/delivery-fees/export?format=` | admin | excel/csv/json |

```
WilayaDto { code; name; communes: { id; name }[] }
FeeDto { deliveryHome; deliveryOffice; source: 'commune'|'wilaya'|'default' }
UpsertFeesCommand { rows: { wilayaCode; communeId?: uuid|null; deliveryHome; deliveryOffice }[] }
```

## Events [CONTRACT]
- **Emits** `deliveryFees.changed` → `{ description }` (audit). **Listens:** none.

## Injected service [CONTRACT]
`DeliveryFeeService.resolve(wilayaCode, communeId, mode) → number` — commune override → wilaya row → settings default; PICKUP callers never ask (fee 0 by rule). Used by the order module inside its placement transaction.

## Business Logic [BACKEND]
58 wilayas + communes seeded. `communeId = null` row = the wilaya fee. Import validates codes/names and reports row-level errors without partial writes.

## Test Scenarios [BACKEND]
Resolution precedence; unknown commune → wilaya fee; neither → default. Import with one bad row → 400 listing it, zero writes. Export round-trips.

# Module: inventory

The FIFO ledger: movements, layers, reserve/release/consume engine, adjustments. Owns the quantity + averageCost columns on products.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `INVENTORY_ROUTES.STOCK` | GET `/api/admin/inventory/stock?lowStockOnly=` | admin | levels + value |
| `INVENTORY_ROUTES.MOVEMENTS` | GET `/api/admin/inventory/movements` | admin | filters product/type/date/staff |
| `INVENTORY_ROUTES.RESERVATIONS` | GET `/api/admin/inventory/reservations` | admin | holder + age |
| `INVENTORY_ROUTES.ADJUSTMENTS` | POST `/api/admin/inventory/adjustments` | admin | |

```
StockRowDto { productId; name; barcode?; quantityOnHand; quantityReserved; availableQuantity;
              averageCost; stockValue; reorderThreshold; isLow }
MovementDto { id; productId; productName; direction: 'IN'|'OUT'|'PENDING'; type: MovementType;
              quantity; unitCost?; remainingQuantity?;          // IN rows
              costOfGoods?; profit?;                            // OUT rows
              balanceAfter; referenceType; referenceId; referenceLabel; reason?; staffName; createdAt }
MovementType = 'SUPPLIER_INVOICE'|'INITIAL_STOCK'|'ADJUSTMENT_IN'|'RETURN_IN'
             | 'SALE'|'ORDER_OUT'|'REPAIR_CONSUMPTION'|'ADJUSTMENT_OUT'
             | 'PENDING_ORDER'|'PENDING_REPAIR'|'PENDING_RELEASE'
ReservationDto { productId; productName; quantity; holderType: 'ORDER'|'REPAIR'; holderReference; ageHours }
CreateAdjustmentCommand { reason: 'COUNT'|'DAMAGE'|'LOSS'|'CORRECTION'; note?;
  lines: { productId; countedQuantity;
           unitCost?;                                   // IN deltas; defaults to averageCost
           prices?: UpdatePricingCommand }[] }          // optional reprice per line
AdjustmentResultDto { reference; lines: { productId; delta; movementId }[] }
```

## Events [CONTRACT]
- **Emits** `inventory.stockChanged` → `{ productId; onHand; reserved }` (dashboard/observers); `inventory.lowStock` → `{ productId; available; threshold }`; `inventory.adjusted` → `{ reference; description }` (audit).
- **Listens:** nothing. **All state changes arrive through the injected service** (see below) — events cannot return FIFO results.

## Injected service (the contract other backends depend on) [CONTRACT]
```
InventoryService {
  reserve(tx, productId, qty, ref)                       // PENDING_ORDER / PENDING_REPAIR
  release(tx, productId, qty, ref)                       // PENDING_RELEASE
  addLayer(tx, productId, qty, unitCost, type, ref)      // IN: layer + avgCost recompute → { movementId }
  consumeFifo(tx, productId, qty, revenue|null, type, ref)
      → { movementId; costOfGoods; profit|null; consumptions: { inMovementId; qty; unitCost }[] }
  returnIn(tx, saleLineConsumptions, qty, ref)           // RETURN_IN at consumed cost
}
```
Callers: product (initial stock), supplier-invoice (addLayer per line), order (reserve/release/consume), sale (consume/returnIn), repair (reserve/release/consume/returnIn), adjustments (internal).

## Business Logic [BACKEND]
1. Every call updates movement rows **and** the product's quantity/averageCost columns in the caller's transaction; `balanceAfter` written per row.
2. consumeFifo drains oldest layers with `remainingQuantity > 0`; writes `stock_movement_consumptions`; rejects when qty > available (`INSUFFICIENT_STOCK { productId, requested, available }`).
3. avgCost: `(oldQty×oldAvg + inQty×unitCost) / (oldQty+inQty)` on IN only.
4. ADJUSTMENT_OUT has `profit = null` (no revenue). Adjustment IN lines with `prices` call product pricing service after the movement, same transaction.
5. Low-stock check after every change; emits when available crosses ≤ threshold.

## Test Scenarios [BACKEND]
Two layers (10 @100, 10 @150), consume 15 → COGS 1750, layer remains 5 @150. Consume > available → 409 and no rows. Reserve then release restores available. returnIn re-enters at consumed cost (150 not avg). balanceAfter chain correct under interleaving. Invariants: onHand = Σ movements, Σ remaining = onHand. Adjustment with reprice updates prices atomically.

# Module: invoice

Outgoing invoices — snapshot documents from sales and orders only. PDF, cancel, payment status.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `INVOICE_ROUTES.MY_LIST` | GET `/api/clients/me/invoices` | client | own, via linked posClientId |
| `INVOICE_ROUTES.MY_DETAIL` | GET `/api/clients/me/invoices/:number(/pdf)` | client | |
| `INVOICE_ROUTES.STAFF_LIST` | GET `/api/staff/invoices` | staff(STAFF_INVOICES) | **issued-by-me only** |
| `INVOICE_ROUTES.ADMIN_LIST` | GET `/api/admin/invoices` | admin | filters client/status/source/date |
| `INVOICE_ROUTES.DETAIL` | GET `/api/admin/invoices/:number(/pdf)` | admin | |
| `INVOICE_ROUTES.CANCEL` | POST `/api/admin/invoices/:number/cancel` | admin | reason optional |

```
InvoiceStatus = 'ISSUED'|'PARTIALLY_PAID'|'PAID'|'CANCELLED'
InvoiceSource = 'SALE'|'ORDER'                       // never REPAIR
InvoiceDto { number; posClientId?; clientNameSnapshot; clientAddressSnapshot?;
  sourceType: InvoiceSource; sourceReference; status;
  totalAmount; paidAmount; previousCredit?; newCredit?;
  totalCost?; totalProfit?;                          // admin mapping only
  issuedAt; dueDate?; staffName;
  lines: { label; quantity; unitPrice; costSnapshot?; profit?; lineTotal; serialNumbers? }[] }
```

## Events [CONTRACT]
- **Listens** `sale.confirmed` → issue invoice (sourceType SALE) from the event's snapshot lines; idempotent by saleId.
- **Listens** `order.confirmed` → issue (sourceType ORDER); idempotent by orderId.
- **Listens** `payment.clientRecorded` → paidAmount/status update on the targeted invoice.
- **Emits** `invoice.issued` / `invoice.cancelled` → `{ number; sourceType; sourceId; total }` (audit).

## Business Logic [BACKEND]
1. Issue copies snapshot lines + previous/new credit + cost/profit from the event; number from the settings sequence (`FAC-YYYY-NNNN`). The invoice renders identically forever — never re-derived from live data.
2. Repair sales (origin REPAIR) do not trigger issuance — the sale listener in this module skips them; nothing repair-shaped ever reaches a client invoice list.
3. Cancel: status only; numbers never reused, gaps never closed.
4. When the admin invoice UI shows a product row, the **current avg cost** is displayed beside the snapshot price (join, not stored twice).

## Data Mapping [BACKEND]
Client mapping strips costSnapshot/profit/credit-of-others. Staff list filtered `staffId = me`.

## Test Scenarios [BACKEND]
sale.confirmed replay → one invoice. Repair-origin sale → no invoice. Sequence gap after cancel stays. Payment flips ISSUED→PARTIALLY_PAID→PAID. Client of POS client A cannot fetch B's number (404).

# Module: order

Single-product storefront orders: placement reserves, staff/admin drive the status machine, FIFO consumption at confirm, returns after completion.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `ORDER_ROUTES.PLACE` | POST `/api/orders` | public\|client | guest allowed when guest-priced |
| `ORDER_ROUTES.MY_LIST` | GET `/api/clients/me/orders?status=` | client | |
| `ORDER_ROUTES.MY_CANCEL` | POST `/api/orders/:id/cancel` | client | PENDING only |
| `ORDER_ROUTES.ADMIN_LIST` | GET `/api/admin/orders` | admin | search/status/date; age flag |
| `ORDER_ROUTES.CONFIRM` | POST `/api/admin/orders/:id/confirm` | admin | serials optional |
| `ORDER_ROUTES.STATUS` | PATCH `/api/admin/orders/:id/status` | admin | forward machine |
| `ORDER_ROUTES.RETURN` | POST `/api/admin/orders/:id/return` | admin | post-completion |
| `ORDER_ROUTES.STATS` | GET `/api/admin/orders/stats` | admin | |

```
OrderStatus = 'PENDING'|'CONFIRMED'|'PACKAGED'|'IN_DELIVERY'|'COMPLETED'|'CANCELLED'|'RETURNED'
OrderType   = 'PICKUP'|'DELIVERY_HOME'|'DELIVERY_OFFICE'
PlaceOrderCommand { clientId?: uuid|null;            // must equal token's clientId when authed; null for guest
  productId; quantity: int.min(1);
  orderType: OrderType;                               // PICKUP requires client token
  contact { fullName; phone };
  delivery? { wilayaCode; communeId; address? };      // required unless PICKUP
  note? }
OrderDto { id; reference; status; orderType; contactName; contactPhone;
  wilayaCode?; communeId?; address?; deliveryCompany?; trackingNumber?;
  subtotal; deliveryFee; totalAmount; paidAmount;
  placedAt; confirmedAt?; deliveredAt?; cancelledAt?; canBeCancelled;
  line { productId; productName; quantity; resolvedPrice; unitPrice; lineTotal; serialNumbers? } }
ConfirmOrderCommand { unitPrice?; serialNumbers?: string[]; paidAmount? }   // staff price adjust at confirm
UpdateOrderStatusCommand { status; deliveryCompany?; trackingNumber?; reason? }
ReturnOrderCommand { quantity; restock: boolean; refundAmount; reason? }
```

## Events [CONTRACT]
- **Emits** `order.confirmed` → `OrderConfirmedEvent { orderId; posClientId?; snapshotLines; totals; previousCredit?; newCredit? }` (**invoice listens** → issues sourceType ORDER; audit listens).
- **Emits** `order.placed`, `order.cancelled`, `order.statusChanged`, `order.returned` (audit; dashboard).
- **Listens** `payment.clientRecorded` → update paidAmount when targeting this order's invoice.

## Business Logic [BACKEND]
1. **Place (one transaction):** resolve viewer price server-side (guest ⇒ guestPrice must exist; PICKUP ⇒ client token required) → resolve fee via delivery module service (commune override → wilaya → default; PICKUP ⇒ 0, wilaya/commune must be absent) → `inventory.reserve` → create order PENDING. Stock conflict → 409 `INSUFFICIENT_STOCK`, nothing written. Idempotency key honored. Guest orders store `clientId = null` (no auto client row).
2. Client cancel: PENDING only → `inventory.release`, cancelledAt set.
3. **Confirm (one transaction, idempotent):** `inventory.release` + `inventory.consumeFifo(ORDER_OUT, revenue = unitPrice×qty)` → store costOfGoods/profit → status CONFIRMED → emit (invoice issues after commit).
4. Machine: PENDING→CONFIRMED→PACKAGED→IN_DELIVERY→COMPLETED (`deliveredAt`); CANCELLED from any pre-COMPLETED state (release if still reserved); RETURNED only from COMPLETED via ReturnOrderCommand → `inventory.returnIn` when restock.
5. `resolvedPrice` frozen at placement; staff `unitPrice` adjustment recorded beside it.

## Test Scenarios [BACKEND]
Guest + null guestPrice → 403. Guest + PICKUP → 400. Pickup fee 0 and delivery block rejected if present. Reserve at place, release on cancel, consume on confirm — invariant checks. Double confirm: one consumption, one invoice event. Fee resolution override>wilaya>default. RETURNED restock re-enters at consumed cost. Age flag >24h in admin list DTO.

# Module: payment

Both ledgers: client payments and supplier payments. Cash only. Every row snapshots previous→new credit.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `PAYMENT_ROUTES.CLIENT_CREATE` | POST `/api/(staff|admin)/client-payments` | staff(STAFF_INVOICES)\|admin | against invoice or on account |
| `PAYMENT_ROUTES.CLIENT_LIST` | GET `/api/admin/client-payments` | admin | ledger |
| `PAYMENT_ROUTES.SUPPLIER_CREATE` | POST `/api/admin/supplier-payments` | admin | |
| `PAYMENT_ROUTES.SUPPLIER_LIST` | GET `/api/admin/supplier-payments` | admin | |

```
CreateClientPaymentCommand { posClientId; invoiceNumber?; amount: number.positive(); paidAt? }
ClientPaymentDto { reference; posClientId; posClientName; invoiceNumber?; amount;
                   previousCredit; newCredit; paidAt; staffName }
CreateSupplierPaymentCommand { supplierId; supplierInvoiceReference?; amount; paidAt? }
SupplierPaymentDto { reference; supplierId; supplierName; supplierInvoiceReference?; amount;
                     previousCredit; newCredit; paidAt; staffName }
```

## Events [CONTRACT]
- **Emits** `payment.clientRecorded` → `{ paymentId; posClientId; invoiceNumber?; amount; previousCredit; newCredit }` (**pos-client**, **invoice**, order, audit listen).
- **Emits** `payment.supplierRecorded` → `{ paymentId; supplierId; supplierInvoiceReference?; amount; previousCredit; newCredit }` (**supplier**, **supplier-invoice**, audit listen).

## Business Logic [BACKEND]
Read the counterpart's current credit → snapshot previous, compute new = previous − amount (client) / previous − amount (supplier debt) → persist → emit. The dialog response returns both figures. Overpayment allowed (credit goes negative = store owes) — flagged in the DTO. Amount > 0 enforced.

## Test Scenarios [BACKEND]
Snapshot math; concurrent payments serialize on the counterpart row (no lost update). On-account payment (no invoice) updates credit only. Listeners' caches converge with the ledger.

# Module: pos-client

The commercial identity: category, credit, totalPaid. Exists with or without a web account.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `POS_CLIENT_ROUTES.SEARCH` | GET `/api/staff/pos-clients/search?q=` | staff(STAFF_POS_CLIENTS or STAFF_POS)\|admin | name/phone |
| `POS_CLIENT_ROUTES.QUICK_CREATE` | POST `/api/staff/pos-clients` | staff(STAFF_POS_CLIENTS)\|admin | counter add |
| `POS_CLIENT_ROUTES.ADMIN_LIST` | GET `/api/admin/pos-clients` | admin | |
| `POS_CLIENT_ROUTES.ADMIN_CREATE` | POST `/api/admin/pos-clients` | admin | the ONLY manual client creation |
| `POS_CLIENT_ROUTES.ADMIN_UPDATE` | PATCH `/api/admin/pos-clients/:id` | admin | category, isEnabled |
| `POS_CLIENT_ROUTES.DETAIL` | GET `/api/admin/pos-clients/:id` | admin | sales/payments/credit history |

```
PosClientDto { id; code; name; phone?; categoryId?; categoryName?; credit; totalPaid;
               linkedClientId?; isEnabled; createdAt }
CreatePosClientCommand { name; phone?; categoryId?; initialCredit? }
UpdatePosClientCommand { name?; phone?; categoryId?; isEnabled? }
```

## Events [CONTRACT]
- **Listens** `client.approved` → creates the linked POS client from `posClientSeed`, writes `clients.posClientId` (idempotent).
- **Listens** `sale.confirmed` → applies the credit delta already computed by the sale (event carries `{ posClientId; previousCredit; newCredit; paidAmount }`), bumps totalPaid.
- **Listens** `payment.clientRecorded` → lowers credit / raises totalPaid per the event's snapshot.
- **Listens** `return.created` → applies refund effect when refunded against credit (payload states it).
- **Emits** `posClient.creditChanged` → `{ posClientId; previousCredit; newCredit; cause }` (audit).

## Business Logic [BACKEND]
1. credit/totalPaid are stored caches; every listener applies the event's **snapshot** (not a recomputation) and is idempotent by source document id.
2. Category change re-resolves prices for future documents only.
3. A conformance check recomputes credit from sales + payments − returns and compares.
4. No category ⇒ POS resolves `defaultSalePrice`.

## Test Scenarios [BACKEND]
client.approved creates exactly one POS client (replayed event: still one). Sale with underpayment raises credit by the delta; payment lowers it; cache equals ledger recomputation. Disabled POS client not attachable at POS.

# Module: product

Products, images, category prices, price resolution, storefront + staff listings, search logging hook, initial stock.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `PRODUCT_ROUTES.LIST` | GET `/api/products` | public | storefront; viewer-resolved pricing |
| `PRODUCT_ROUTES.DETAIL` | GET `/api/products/:id` | public | + related ids |
| `PRODUCT_ROUTES.STAFF_LIST` | GET `/api/staff/products` | staff(STAFF_PRODUCTS)\|admin | available qty + 4 prices, read-only |
| `PRODUCT_ROUTES.ADMIN_LIST` | GET `/api/admin/products` | admin | full columns |
| `PRODUCT_ROUTES.CREATE` | POST `/api/admin/products` | admin | multipart; initial stock |
| `PRODUCT_ROUTES.UPDATE` | PATCH `/api/admin/products/:id` | admin | core fields, isEnabled/isPublished |
| `PRODUCT_ROUTES.PRICING` | PATCH `/api/admin/products/:id/pricing` | admin | also the reprice-prompt target |
| `PRODUCT_ROUTES.IMAGES` | POST/PATCH `/api/admin/products/:id/images` | admin | |
| `PRODUCT_ROUTES.STATS` | GET `/api/admin/products/stats` | admin | total/in/low/out |

```
ProductListQuery { search?; familyId?; brandId?; modelId?; inStock?; featured?; sort?; page?; limit=15 }
ProductWithPricingDto { id; name; description?; barcode?; createdAt;
  brand{id;name}; model?{id;name}; family{id;name;iconUrl?};
  images: ImageDto[]; currentPrice?; guestPrice?; priceHidden: boolean;
  inStock: boolean; inCart: boolean }                    // inCart false for guests
StaffProductDto { id; name; barcode?; family; brand; model?; availableQuantity;
  defaultSalePrice?; categoryPrices: { categoryId; categoryName; price }[] }
AdminProductDto { ...core; quantityOnHand; quantityReserved; availableQuantity; averageCost;
  reorderThreshold; stockStatus: 'in_stock'|'low_stock'|'out_of_stock'; isPublished; isEnabled }
CreateProductCommand { barcode?; name; description?;
  familyId|newFamilyName; brandId|newBrandName; modelId?|newModelName?;
  initialQuantity: int.min(0); initialUnitCost?;          // required iff initialQuantity>0
  guestPrice?; defaultSalePrice?; categoryPrices?: { categoryId; price }[];   // allowed iff initialQuantity>0
  reorderThreshold? }
UpdatePricingCommand { guestPrice?: number|null; defaultSalePrice?; categoryPrices?: { categoryId; price }[] }
```

## Events [CONTRACT]
- **Emits** `product.created` / `product.repriced` → `{ productId; description }` (audit); `product.searched` → `ProductSearchedEvent { userId; query; matchedProductId? }` (activity listens — fired by staff/admin list searches).
- **Listens** `inventory.lowStock` → none here (dashboard reads a query); nothing critical.

## Business Logic [BACKEND]
1. **Price resolution** (one function, used by storefront, cart validation, orders, POS):
   viewer's POS-client category tier row → storefront: `guestPrice`; POS: `defaultSalePrice` → else `priceHidden` / "price on request". Guests with null guestPrice: hidden and unorderable.
2. `initialQuantity > 0` ⇒ calls inventory `addLayer(INITIAL_STOCK, qty, initialUnitCost)` in the same transaction and unlocks pricing; `= 0` ⇒ pricing fields rejected (`PRICING_REQUIRES_STOCK`), product born price-less.
3. `inCart` joined from client_carts for a CLIENT token.
4. Staff/admin list search with a non-empty `search` emits `product.searched` (after response, fire-and-forget).
5. quantity/avgCost columns are **owned by inventory** — this module never writes them.

## Data Mapping [BACKEND]
Storefront DTO never leaks cost, onHand numbers (only boolean inStock), reserved, or margins. Staff DTO adds availableQuantity + 4 sale prices, still no cost. Admin DTO adds everything.

## Test Scenarios [BACKEND]
Resolution matrix (client+tier / client no tier / guest priced / guest null). initialQuantity 0 + prices → 400; >0 without cost → 400; >0 creates layer + avg cost. inCart true/false. Guest DTO leaks nothing. Search emits event with userId.

# Module: repair

Back-office only. Technicians (no user account), intake with common-issue multi-select, parts reserve/consume, pickup creates the repair sale.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `REPAIR_ROUTES.LIST` | GET `/api/(staff|admin)/repairs` | staff(STAFF_REPAIRS: own)\|admin | board data |
| `REPAIR_ROUTES.CREATE` | POST `/api/(staff|admin)/repairs` | staff\|admin | intake |
| `REPAIR_ROUTES.UPDATE` | PATCH `.../repairs/:id` | staff\|admin | diagnosis?, labour, technician |
| `REPAIR_ROUTES.PARTS` | POST/DELETE `.../repairs/:id/parts(/:partId)` | staff\|admin | reserve / release |
| `REPAIR_ROUTES.STATUS` | POST `.../repairs/:id/status` | staff\|admin | transitions |
| `REPAIR_ROUTES.TECHNICIANS` | GET/POST/PATCH `/api/admin/technicians(/:id)` | admin | name, phone?, isEnabled |

```
RepairStatus = 'INTAKE'|'PROCESSING'|'COMPLETED'|'PICKED_UP'|'CANCELLED'
ReportedIssue = 'charging'|'display'|'battery'|'camera'|'speaker'|'microphone'|'water-damage'|'software'|'other'
CreateRepairCommand { posClientId?; customerName; customerPhone;
  brandId?; deviceModelId?; deviceLabel?; deviceImei?;
  reportedIssues: ReportedIssue[].min(1); reportedIssueOther?; technicianId? }
AddRepairPartCommand { productId; quantity; unitPrice; serialNumbers? }
RepairStatusCommand { toStatus; note?; paidAmount? }        // paidAmount at PICKED_UP
RepairDto { id; reference; status; customerName; customerPhone; posClientId?;
  device { brand?; model?; label?; imei? }; reportedIssues; reportedIssueOther?; diagnosis?;
  technician? { id; name }; labourPrice; partsTotal; totalAmount; paidAmount;
  totalCost?; totalProfit?; intakeAt; completedAt?; pickedUpAt?;
  parts: { id; productId; productName; quantity; unitPrice; costOfGoods?; profit?; lineTotal; serialNumbers? }[];
  history: { fromStatus; toStatus; note?; staffName; changedAt }[] }
TechnicianDto { id; name; phone?; isEnabled }
```

## Events [CONTRACT]
- **Emits** `repair.pickedUp` → `RepairPickedUpEvent { repairId; posClientId?; totals; cost; profit; paidAmount }` (**sale listens** → repair sale record; audit).
- **Emits** `repair.statusChanged` (audit), `repair.cancelled` (audit).
- **Listens:** none — stock via injected inventory service.

## Business Logic [BACKEND]
1. Intake prints a claim slip (reference) — the customer's only handle; no public surface exists.
2. Add part → `inventory.reserve(PENDING_REPAIR)`; remove → release. Availability errors name the product.
3. `INTAKE→PROCESSING` requires technicianId. `PROCESSING→COMPLETED` (idempotent): per part release + `consumeFifo(REPAIR_CONSUMPTION, revenue = unitPrice×qty)` → part cost/profit, totals. `COMPLETED→PICKED_UP`: cash paidAmount, pickedUpAt, emit. `CANCELLED` anywhere, reason optional: release pending; already-consumed parts require explicit `returnIn` lines in the command.
4. Diagnosis and all notes optional. Technicians have no users row — plain reference rows.

## Test Scenarios [BACKEND]
Processing without technician → 400. Part add reserves; shortfall 409 names product. Double COMPLETE consumes once. Pickup emits once (replay-safe on the sale side). Cancel releases reservations. reportedIssues validated against the enum, `other` allows free text.

# Module: sale

POS: drafts, confirmation (FIFO + credit + invoice), returns/exchanges, repair-sale recording. Staff-scoped.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `SALE_ROUTES.CREATE_DRAFT` | POST `/api/staff/sales` | staff(STAFF_POS)\|admin | DRAFT |
| `SALE_ROUTES.UPDATE_DRAFT` | PATCH `/api/staff/sales/:id` | owner staff\|admin | DRAFT only |
| `SALE_ROUTES.CONFIRM` | POST `/api/staff/sales/:id/confirm` | owner staff\|admin | |
| `SALE_ROUTES.MY_LIST` | GET `/api/staff/sales` | staff(STAFF_SALES) | **scoped staffId=me**; admin variant below |
| `SALE_ROUTES.ADMIN_LIST` | GET `/api/admin/sales` | admin | all sellers |
| `SALE_ROUTES.DETAIL` | GET `/api/(staff|admin)/sales/:reference` | owner staff\|admin | |
| `SALE_ROUTES.RETURN` | POST `/api/admin/returns` | admin | staff returns: out of scope for now |

```
SaleStatus = 'DRAFT'|'COMPLETED'|'RETURNED'|'PARTIALLY_RETURNED'|'CANCELLED'
SaleDraftCommand { posClientId?; discountAmount?; note?;
  lines: { productId; quantity; unitPrice; serialNumbers?: string[] }[] }
ConfirmSaleCommand { paidAmount: number.min(0) }
SaleDto { id; reference; status; posClientId?; posClientName?;
  subtotal; discountAmount; totalAmount; paidAmount;
  previousCredit?; newCredit?; totalCost?; totalProfit?;      // cost/profit admin-only mapping
  soldAt?; staffId; staffName; note?;
  lines: { productId; productName; quantity; resolvedPrice; unitPrice;
           costOfGoods?; profit?; lineTotal; serialNumbers? }[] }
ReceiptDto { reference; lines; total; previousCredit; grandTotal; totalPaid; newCredit }
CreateReturnCommand { saleId; type: 'REFUND'|'EXCHANGE'; reason?;
  lines: { saleLineId; quantity; restock: boolean; refundAmount }[] }
```

## Events [CONTRACT]
- **Emits** `sale.confirmed` → `SaleConfirmedEvent { saleId; posClientId?; totalAmount; paidAmount;
  previousCredit?; newCredit?; snapshotLines }` (**pos-client** applies credit; **invoice** issues sourceType SALE; audit).
- **Emits** `return.created` → `{ returnId; saleId; refundAmount; posClientId?; creditEffect? }` (pos-client, invoice, audit).
- **Listens** `repair.pickedUp` → records a COMPLETED sale flagged `origin: 'REPAIR'` (revenue reporting) — **no invoice event is re-emitted for repair sales**.

## Business Logic [BACKEND]
1. DRAFT: no stock, no money; visible only to its creator (+admin); editable until confirm.
2. **Confirm (one transaction, idempotent):** per line resolve price (attached POS client's category, else defaultSalePrice) → keep both resolved and charged → `inventory.consumeFifo(SALE, revenue)` → line cost/profit + document totals → credit math: `newCredit = previousCredit + (totalAmount − paidAmount)`; underpayment without posClientId → 400 `CREDIT_REQUIRES_CLIENT` → sequence number → COMPLETED → commit → emit. Receipt built from the stored snapshot.
3. Return: bounds qty ≤ sold − returned; restock ⇒ `inventory.returnIn` at consumed cost; sale flips (PARTIALLY_)RETURNED.
4. Repair-sale listener: idempotent by repairId; copies repair totals/cost/profit.

## Test Scenarios [BACKEND]
Draft holds no stock (parallel confirm elsewhere can exhaust it → confirm fails 409). Credit math + receipt figures. Underpaid anonymous sale → 400. Double confirm single consumption. Return restock vs non-restock movements. Staff A cannot read staff B's sale (403); admin can. Repair pickup creates exactly one sale, replay-safe.

# Module: settings

Key–value configuration + the document-number sequence service every module injects.

## API Interface [CONTRACT]

| Route const | Method + path | Access |
|---|---|---|
| `SETTINGS_ROUTES.GET` | GET `/api/admin/settings` | admin |
| `SETTINGS_ROUTES.PATCH` | PATCH `/api/admin/settings` | admin |
| `SETTINGS_ROUTES.PUBLIC` | GET `/api/settings/public` | public — invoice-irrelevant storefront bits (featured products) |

```
SettingsDto { store { name; address?; phone?; logoUrl? };            // invoice header only — footer is front-end static
  invoicing { prefixes: Record<DocType, string>; nextSequences: Record<DocType, number>; footerNote? };
  delivery { defaultHome; defaultOffice };
  storefront { featuredProductIds: uuid[] } }
DocType = 'INVOICE'|'SALE'|'ORDER'|'REPAIR'|'SUPPLIER_INVOICE'|'ADJUSTMENT'|'POS_CLIENT'|'CLIENT'
```

## Events [CONTRACT]
- **Emits** `settings.changed` → `{ description }` (audit). **Listens:** none.

## Injected service [CONTRACT]
`SequenceService.nextNumber(tx, docType) → string` — `PREFIX-YYYY-NNNN`, transactional, gap-tolerant, never reused. Every document module injects it.

## Business Logic [BACKEND]
Lowering a next-sequence is refused (`SEQUENCE_DECREASE_FORBIDDEN`). No localisation keys exist. Values JSON-encoded per key.

## Test Scenarios [BACKEND]
Sequence monotonic under concurrency. Decrease → 409. settings.changed narrated with old → new.

# Module: statistics

Read-only aggregation: dashboards (admin + staff) and the merged statistics/reports page. Everything reads **stored** figures (profit, credit, quantities) — no recomputation.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `STATS_ROUTES.ADMIN_DASHBOARD` | GET `/api/admin/dashboard` | admin | one aggregate call |
| `STATS_ROUTES.STAFF_DASHBOARD` | GET `/api/staff/dashboard` | staff | scoped to me |
| `STATS_ROUTES.OVERVIEW` | GET `/api/admin/statistics/overview` | admin | all-time cards |
| `STATS_ROUTES.FILTERED` | GET `/api/admin/statistics/filtered?from=&to=&familyId=` | admin | + % vs previous period |
| `STATS_ROUTES.CHARTS` | GET `/api/admin/statistics/charts/:chart?from=&to=&familyId=` | admin | revenue \| orders \| clients \| sales-by-family |
| `STATS_ROUTES.TOP_PRODUCTS` | GET `/api/admin/statistics/top-products?period=` | admin | |
| `STATS_ROUTES.REPORT` | GET `/api/admin/reports/:type?from=&to=&groupBy=` | admin | drillable table + chart + CSV |

```
OverviewDto { totalRevenue; totalProfit; stockValue; totalClientCredit; totalSupplierCredit }
FilteredDto { revenue; profit; orders; revenueChangePct; profitChangePct; ordersChangePct }
ReportType = 'sales-by-product'|'sales-by-client'|'sales-by-category'|'sales-by-seller'
           | 'stock-movements'|'repairs'|'supplier-spend'|'ageing'|'client-browsing'
ReportDto { chart: { label; value }[]; rows: Record<string, unknown>[]; totals; drill { entity; idField } }
AdminDashboardDto { stats { totalClients; totalProducts; ordersThisWeek; revenueThisMonth; *ChangePct };
  pendingOrders[]; pendingClients[]; recentOrders[]; recentClients[]; lowStockProducts[];
  repairsByStatus; draftSalesByStaff[] }
StaffDashboardDto { mySalesToday; myRevenueToday; myDrafts[]; lowStock[] }
```

## Events [CONTRACT]
- **Listens:** none (queries only). **Emits:** none.

## Business Logic [BACKEND]
Revenue/profit sum sale + confirmed-order stored figures (repair revenue arrives as repair-origin sales — not double-counted with any invoice). sales-by-category and by-seller expose Σ(resolvedPrice−unitPrice)×qty as the discount column. stock-movements report totals per type; large ADJUSTMENT_OUT flagged. client-browsing joins activity (top searches; most-viewed products with zero purchases). Every report row carries a drill id.

## Test Scenarios [BACKEND]
Profit = Σ stored line profits (no recompute drift). Period comparison math. Repair sale counted once. Staff dashboard leaks nothing outside staffId=me. CSV shape matches rows.

# Module: supplier-invoice

Goods receipt (DRAFT → CONFIRMED), zero-line amount invoices, landed cost, reprice prompt handoff.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `SUPPLIER_INVOICE_ROUTES.LIST` | GET `/api/admin/supplier-invoices` | admin | filters supplier/status/date; overdue flag |
| `SUPPLIER_INVOICE_ROUTES.CREATE` | POST `/api/admin/supplier-invoices` | admin | DRAFT |
| `SUPPLIER_INVOICE_ROUTES.UPDATE` | PATCH `/api/admin/supplier-invoices/:id` | admin | DRAFT only |
| `SUPPLIER_INVOICE_ROUTES.CONFIRM` | POST `/api/admin/supplier-invoices/:id/confirm` | admin | |
| `SUPPLIER_INVOICE_ROUTES.CANCEL` | POST `/api/admin/supplier-invoices/:id/cancel` | admin | reason optional |
| `SUPPLIER_INVOICE_ROUTES.DETAIL` | GET `/api/admin/supplier-invoices/:id` | admin | |

```
SupplierInvoiceDto { id; reference; supplierReference?; supplierId; supplierName;
  status: 'DRAFT'|'CONFIRMED'|'CANCELLED'; invoiceDate; dueDate?; shippingCost; amountOnly?;
  totalAmount; paidAmount; previousCredit?; newCredit?; note?; staffName;
  lines: SupplierInvoiceLineDto[] }
SupplierInvoiceLineDto { id; productId; productNameSnapshot; quantity; unitCost;
  landedUnitCost; lineTotal; serialNumbers?; projectedNewAverageCost? }   // projection on DRAFT reads
CreateSupplierInvoiceCommand { supplierId; supplierReference?; invoiceDate; dueDate?;
  shippingCost?; amountOnly?; note?;
  lines?: { productId; quantity; unitCost; serialNumbers? }[] }   // amountOnly XOR lines
ConfirmResultDto { reference; repriceCandidates: { productId; name; averageCost;
  current: { guestPrice?; defaultSalePrice?; categoryPrices } }[] }   // feeds the prompt; UI calls product.PRICING
```

## Events [CONTRACT]
- **Emits** `supplierInvoice.confirmed` → `SupplierInvoiceConfirmedEvent { invoiceId; supplierId; totalAmount; previousCredit; newCredit }` (**supplier listens**; audit listens).
- **Emits** `supplierInvoice.cancelled` → reversal payload (supplier, audit).
- **Listens** `payment.supplierRecorded` → update paidAmount/status of the targeted invoice.

## Business Logic [BACKEND]
1. DRAFT freely editable, touches nothing. `amountOnly` and `lines` mutually exclusive.
2. Landed cost: `unitCost + shippingCost × (lineTotal/Σ lineTotals) / quantity`.
3. **Confirm (one transaction):** per line `inventory.addLayer(SUPPLIER_INVOICE, qty, landedUnitCost)` (injected) → snapshot supplier previous/new credit on the header → status CONFIRMED → sequence number via settings service → commit → emit. Returns `repriceCandidates` so the UI can offer the prefilled reprice form (skippable; actual reprice goes through product module).
4. Immutable after confirm; cancel reverses credit (event) — stock reversal is an explicit ADJUSTMENT_OUT decision by the admin, not automatic (received goods are physically there).
5. Inline product creation is the product module's POST, called by the UI before adding the line.

## Test Scenarios [BACKEND]
amountOnly + lines → 400. Confirm creates one layer per line at landed cost; avg cost recompute matches hand calc; double-confirm idempotent. Zero-line invoice raises credit, no movements. Serial count free-form (no qty match enforced — quantity tracking only). PATCH after confirm → 409.

# Module: supplier

Suppliers with stored credit/totalPaid, initial credit, history views.

## API Interface [CONTRACT]

| Route const | Method + path | Access |
|---|---|---|
| `SUPPLIER_ROUTES.LIST` | GET `/api/admin/suppliers` | admin |
| `SUPPLIER_ROUTES.CREATE` | POST `/api/admin/suppliers` | admin |
| `SUPPLIER_ROUTES.UPDATE` | PATCH `/api/admin/suppliers/:id` | admin |
| `SUPPLIER_ROUTES.DETAIL` | GET `/api/admin/suppliers/:id` | admin |
| `SUPPLIER_ROUTES.STATS` | GET `/api/admin/suppliers/stats` | admin |

```
SupplierDto { id; code; name; contactName?; phone?; email?; location?;
              credit; totalPaid; invoiceCount; lastDeliveryAt?; isEnabled }
CreateSupplierCommand { name; contactName?; phone?; email?; location?; initialCredit? }
SupplierDetailDto { supplier; invoices: SupplierInvoiceSummaryDto[]; payments: SupplierPaymentDto[];
                    productHistory: { productId; name; quantity; unitCost; landedUnitCost; date }[] }
```

## Events [CONTRACT]
- **Listens** `supplierInvoice.confirmed` → raise credit per event snapshot; set lastDeliveryAt.
- **Listens** `supplierInvoice.cancelled` → reverse.
- **Listens** `payment.supplierRecorded` → lower credit, raise totalPaid.
- **Emits** `supplier.creditChanged` (audit).

## Business Logic [BACKEND]
initialCredit becomes the opening `credit`. Listeners idempotent by document id; cache verifiable against invoices − payments (+ opening). Disable hides from pickers; history intact.

## Test Scenarios [BACKEND]
Opening credit honored. Confirm/cancel/pay sequence leaves cache = ledger. Replayed events no-op.

# Module: taxonomy

Brands, device models, families, and the model↔family many-to-many.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `TAXONOMY_ROUTES.BRANDS` | GET `/api/brands` | public | enabled only; logos for Home carousel |
| `TAXONOMY_ROUTES.FAMILIES` | GET `/api/families?featured=&withCount=` | public | icons; `featured=true&limit=6` feeds Home |
| `TAXONOMY_ROUTES.MODELS` | GET `/api/models?brandId=` | public | cascade source |
| `TAXONOMY_ROUTES.ADMIN_BRANDS` | GET/POST/PATCH `/api/admin/brands(/:id)` | admin | PATCH incl. isEnabled |
| `TAXONOMY_ROUTES.ADMIN_FAMILIES` | GET/POST/PATCH `/api/admin/families(/:id)` | admin | |
| `TAXONOMY_ROUTES.ADMIN_MODELS` | GET/POST/PATCH `/api/admin/models(/:id)` | admin | **no releaseYear** |
| `TAXONOMY_ROUTES.MODEL_FAMILIES` | PUT `/api/admin/models/:id/families` | admin | `{ familyIds: uuid[] }` |

```
BrandDto { id; name; slug; logoUrl?; isEnabled }
FamilyDto { id; name; slug; iconUrl?; parentId?; isUniversal; isFeatured; isEnabled; productCount? }
DeviceModelDto { id; brandId; name; slug; isEnabled; familyIds: uuid[] }
CreateBrandCommand { name; logoUrl? } · CreateFamilyCommand { name; iconUrl?; parentId?; isUniversal?; isFeatured? }
CreateModelCommand { brandId; name }
```

## Events [CONTRACT]
- **Emits** `taxonomy.changed` → `{ entity: 'brand'|'family'|'model'; id; description }` (audit).
- **Listens:** none.

## Business Logic [BACKEND]
Names unique (model unique per brand); slugs generated. One nesting level for families. **Disable only** — disabling hides the entity from public lists and product-form pickers; existing products keep their references and stay orderable. Inline create supported through the plain POST endpoints (the product form calls them). Featured families capped at 6 enabled.

## Test Scenarios [BACKEND]
Duplicate model name within brand 409, same name across brands ok. Disabled brand vanishes from GET /api/brands but its products' DTOs still resolve. PUT model families replaces the set. featured limit enforced.

# Module: user

Users (admin/staff types), staff profiles, roles, page registry, effective permissions.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `USER_ROUTES.ME_PERMISSIONS` | GET `/api/me/permissions` | staff\|admin | effective page keys |
| `USER_ROUTES.LIST` | GET `/api/admin/users` | admin | filter role, type, isEnabled |
| `USER_ROUTES.CREATE` | POST `/api/admin/users` | admin | |
| `USER_ROUTES.UPDATE` | PATCH `/api/admin/users/:id` | admin | |
| `USER_ROUTES.ROLES` | GET/POST/PATCH `/api/admin/roles(/:id)` | admin | |
| `USER_ROUTES.ROLE_PAGES` | PUT `/api/admin/roles/:id/pages` | admin | staff-scope pages only |
| `USER_ROUTES.PAGES` | GET `/api/admin/pages?scope=staff` | admin | seeded registry |

```
CreateUserCommand { username; email?; password; type: 'ADMIN'|'STAFF';
                    profile { firstName; lastName; phone?; jobTitle? };
                    roleIds?: uuid[] }        // required non-empty when type=STAFF; forbidden when ADMIN
UpdateUserCommand { isEnabled?; roleIds?; profile?; password? }
UserDto { id; username; email?; type; isEnabled; lastLoginAt?; profile; roles: RoleDto[]; effectivePages: string[] }
RoleDto { id; code; name; description?; isEnabled; pageKeys: string[] }
PageDto { key; label; group; scope: 'ADMIN'|'STAFF' }
SetRolePagesCommand { pageIds: uuid[] }
```

## Events [CONTRACT]
- **Emits** `user.created`, `user.updated`, `user.roleChanged` → `UserChangedEvent { userId; description }` (audit listens).
- **Listens:** none. (Client approval calls this module's service via DI to create credentials atomically — see client.md.)

## Business Logic [BACKEND]
1. Effective pages = union of enabled roles' pages; ADMIN type = all pages, matrix ignored.
2. `role_pages` accepts STAFF-scope pages only (reject others with `VALIDATION_ERROR`).
3. Guard: the last enabled ADMIN cannot be disabled, demoted to STAFF, or have his password-reset path removed — reject with `LAST_ADMIN_PROTECTED`.
4. Permission changes take effect on next request (page set resolved per request, not baked into the JWT).
5. Exposes `createUser` service (used by client approval) — creates user + optional staff profile in the caller's transaction.

## Data Mapping [BACKEND]
Never expose passwordHash. `effectivePages` computed in the mapper.

## Test Scenarios [BACKEND]
Union of two roles' pages. ADMIN ignores roles. Assigning an ADMIN-scope page to a role → 400. Last-admin guard on disable/demote. Disabled role's pages drop from the union immediately.
