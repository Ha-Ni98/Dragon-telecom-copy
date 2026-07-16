# Module: orders
Single-product storefront orders. Placement reserves stock; **staff (STAFF_ORDERS) drives PENDING → COMPLETED; cancel and return are admin-only.** The order line is folded into the order row.

## Shared Conventions (self-contained — no other file needed)
- Every response: `ApiResponse<T>` (`sendSuccess` wraps; frontend unwraps `data`). Zod 4; types via `z.infer`; dates as ISO strings. Inputs `XxxCommand`/`XxxQuery`, outputs `XxxDto`, routes `[MODULE]_ROUTES` with UPPERCASE keys. Lists use `PaginationInfo`.
- Money: decimal DZD. **Cash only** — no payment-method field exists anywhere.
- **No delete endpoints** — `isEnabled` PATCH toggles. Notes, reasons, email: always `.optional()`.
- Access levels: `public` · `client` (JWT type CLIENT) · `staff(PAGE_KEY)` (JWT type STAFF + page in effective set; data scoped where stated) · `admin` (type ADMIN — all pages, unscoped data).
- **Connection rule:** needs a return value inside the caller's transaction ⇒ **injected service** (`InventoryService`, `SequenceService`, `DeliveryFeeService`); mirrors state elsewhere ⇒ **domain event**, emitted after commit, listener idempotent by source-document id. Event payloads are contract DTOs, named past-tense.
- Confirmed/issued documents are immutable snapshots; corrections are cancellations or return documents. Every money/stock/status/access mutation emits an event the audit module narrates.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `ORDER_ROUTES.PLACE` | POST `/api/orders` | public\|client | guest allowed when guest-priced |
| `ORDER_ROUTES.MY_LIST` | GET `/api/clients/me/orders?status=` | client | |
| `ORDER_ROUTES.MY_CANCEL` | POST `/api/orders/:id/cancel` | client | own, PENDING only |
| `ORDER_ROUTES.BACKOFFICE_LIST` | GET `/api/(staff|admin)/orders` | staff(STAFF_ORDERS)\|admin | same data — orders have no owner staff |
| `ORDER_ROUTES.CONFIRM` | POST `/api/(staff|admin)/orders/:id/confirm` | staff(STAFF_ORDERS)\|admin | serials + price adjust optional |
| `ORDER_ROUTES.STATUS` | PATCH `/api/(staff|admin)/orders/:id/status` | staff(STAFF_ORDERS)\|admin | **forward only, ≤ COMPLETED** |
| `ORDER_ROUTES.CANCEL` | POST `/api/admin/orders/:id/cancel` | **admin** | reason optional |
| `ORDER_ROUTES.RETURN` | POST `/api/admin/orders/:id/return` | **admin** | from COMPLETED only |
| `ORDER_ROUTES.STATS` | GET `/api/(staff|admin)/orders/stats` | staff(STAFF_ORDERS)\|admin | |

```
OrderStatus = 'PENDING'|'CONFIRMED'|'PACKAGED'|'IN_DELIVERY'|'COMPLETED'|'CANCELLED'|'RETURNED'
OrderType   = 'PICKUP'|'DELIVERY_HOME'|'DELIVERY_OFFICE'
PlaceOrderCommand { clientId?: uuid|null;              // must equal the token's clientId when authed; null for guests
  productId; quantity: int.min(1); orderType: OrderType;   // PICKUP requires a client token
  contact { fullName; phone };
  delivery? { wilayaId; communeId; address? };            // required unless PICKUP
  note? }
OrderDto { id; reference; status; orderType; contactName; contactPhone;
  wilaya? { id; frName; arName }; commune? { id; frName; arName }; address?;
  deliveryCompany?; trackingNumber?;
  productId; productName; quantity; resolvedPrice; unitPrice; serialNumbers?;
  subtotal; deliveryFee; totalAmount; paidAmount; costOfGoods?; profit?;    // cost/profit admin mapping only
  placedAt; confirmedAt?; deliveredAt?; cancelledAt?; canBeCancelled; ageHours }
ConfirmOrderCommand { unitPrice?; serialNumbers?: string[]; paidAmount? }
UpdateOrderStatusCommand { status; deliveryCompany?; trackingNumber?; reason? }
ReturnOrderCommand { quantity; restock: boolean; refundAmount; reason? }
```

## Events [CONTRACT]
- Emits `order.confirmed { orderId; clientId?; posClientId?; snapshotLine; totals; confirmedByStaffId }` — **billing** issues the invoice (sourceType ORDER); **clients** bumps totalSold; audit.
- Emits `order.placed`, `order.statusChanged`, `order.cancelled`, `order.returned` (audit, dashboard).
- Listens `payment.clientRecorded` → paidAmount update when the payment targets this order's invoice.

## Business Logic [BACKEND]
1. **Place (one transaction):** resolve viewer price server-side (guest ⇒ guestPrice must exist, `403 GUEST_PRICE_HIDDEN`; PICKUP ⇒ client token, else 400) → fee via **injected** `DeliveryFeeService.resolve(wilayaId, communeId, mode)` (PICKUP ⇒ 0 and delivery block must be absent) → **injected** `InventoryService.reserve` → PENDING order, `resolvedPrice = unitPrice` frozen. Stock conflict → 409, nothing written. Idempotency key honored. Guests: `clientId = null`, contact fields carry identity.
2. Client cancel: own + PENDING only → release, cancelledAt.
3. **Confirm (one transaction, idempotent):** optional unitPrice adjust (resolvedPrice untouched) → `release` + `consumeFifo(ORDER_OUT, revenue = unitPrice×qty)` → costOfGoods/profit stored → CONFIRMED, confirmedAt/By → commit → emit. Loud 409 on shortfall. **No sale row is created** — the invoice sources ORDER directly.
4. Machine: PENDING→CONFIRMED→PACKAGED→IN_DELIVERY (deliveryCompany + trackingNumber required)→COMPLETED (deliveredAt). **Staff may perform every forward transition through COMPLETED.** CANCELLED: admin, any pre-COMPLETED state (release if still reserved). RETURNED: admin, from COMPLETED only; `restock` ⇒ `returnIn` at consumed cost.
5. Age flag: PENDING > 24 h — its reservation starves the counter.

## Test Scenarios [BACKEND]
Guest null-guestPrice → 403; guest PICKUP → 400; pickup + delivery block → 400; fee = 0 pickup. Reserve/release/consume invariants. Double confirm: one consumption, one invoice. Staff can confirm and advance to COMPLETED; staff cancel → 403; staff return → 403. Fee precedence commune→wilaya→default. RETURNED restock cost. clientId mismatch with token → 403.
