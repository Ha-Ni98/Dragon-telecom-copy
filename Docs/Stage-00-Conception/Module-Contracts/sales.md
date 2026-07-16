# Module: sales
POS drafts + confirmation (FIFO, credit, invoice event), returns/exchanges, repair-sale recording. Staff-scoped.

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
| `SALE_ROUTES.CREATE_DRAFT` | POST `/api/staff/sales` | staff(STAFF_POS)\|admin | DRAFT — no stock, no money |
| `SALE_ROUTES.UPDATE_DRAFT` | PATCH `/api/staff/sales/:id` | owner staff\|admin | DRAFT only |
| `SALE_ROUTES.CONFIRM` | POST `/api/staff/sales/:id/confirm` | owner staff\|admin | the transaction |
| `SALE_ROUTES.STAFF_LIST` | GET `/api/staff/sales` | staff(STAFF_SALES) | **scoped staffId = me** |
| `SALE_ROUTES.ADMIN_LIST` | GET `/api/admin/sales` | admin | all sellers, DRAFTs included |
| `SALE_ROUTES.DETAIL` | GET `/api/(staff|admin)/sales/:reference` | owner staff\|admin | |
| `SALE_ROUTES.RETURN` | POST `/api/admin/returns` | admin | returns are admin-only |

```
SaleDraftCommand { posClientId?; discountAmount?; note?;
  lines: { productId; quantity; unitPrice; serialNumbers?: string[] }[].min(1) }
ConfirmSaleCommand { paidAmount: number.min(0) }
SaleDto { id; reference; origin: 'POS'|'REPAIR'; status: 'DRAFT'|'COMPLETED'|'RETURNED'|'PARTIALLY_RETURNED'|'CANCELLED';
  posClientId?; posClientName?; subtotal; discountAmount; totalAmount; paidAmount;
  previousCredit?; newCredit?; totalCost?; totalProfit?;     // cost/profit stripped for staff mapping? NO — seller sees own profit? admin-only: see mapping
  soldAt?; staffId; staffName; note?;
  lines: { productId; productName; quantity; resolvedPrice; unitPrice;
           costOfGoods?; profit?; lineTotal; serialNumbers? }[] }
ReceiptDto { reference; lines; total; previousCredit; grandTotal; totalPaid; newCredit }
CreateReturnCommand { saleId; type: 'REFUND'|'EXCHANGE'; reason?;
  lines: { saleLineId; quantity; restock: boolean; refundAmount }[].min(1) }
```

## Events [CONTRACT]
- Emits `sale.confirmed { saleId; origin; posClientId?; totalAmount; paidAmount; previousCredit?; newCredit?; snapshotLines }` — **clients module** applies credit/totalPaid/totalSold; **billing module** issues the invoice (sourceType SALE) *unless origin = REPAIR*; audit narrates.
- Emits `return.created { returnId; saleId; refundAmount; posClientId?; creditEffect? }` — clients, billing, audit.
- Listens `repair.pickedUp` → records a COMPLETED sale with `origin: 'REPAIR'` copying the repair's totals/cost/profit; idempotent by repairId. **No invoice follows** (billing skips REPAIR origin).

## Business Logic [BACKEND]
1. DRAFT holds no stock (a parallel sale can exhaust it — confirm then 409s) and is visible only to its creator + admin.
2. **Confirm (one transaction, idempotent):** per line resolve price via catalog (attached POS client's category, else `defaultSalePrice`) keeping resolved **and** charged → **injected** `InventoryService.consumeFifo(SALE, revenue = unitPrice×qty)` → line costOfGoods/profit + document totals → credit: `newCredit = previousCredit + (totalAmount − paidAmount)`; underpayment without posClientId → 400 `CREDIT_REQUIRES_CLIENT` → `SequenceService('SALE')` → COMPLETED, soldAt → commit → emit. Receipt built from the stored snapshot (total · previous credit · grand total · paid · new credit).
3. Returns: qty ≤ sold − already returned; `restock` ⇒ `InventoryService.returnIn` at the line's consumed cost; else no movement. Sale flips (PARTIALLY_)RETURNED. Refund defaults to charged price, reducible.
4. Per-line price override is just `unitPrice ≠ resolvedPrice` — measurable, never written back to the catalog.

## Data Mapping [BACKEND]
Staff detail mapping strips `costOfGoods/profit/totalCost/totalProfit` (margins are admin-only); receipt figures stay. Staff list filtered `staffId = me` in the service, not the controller.

## Test Scenarios [BACKEND]
Draft exhausted-stock confirm → 409, sale stays DRAFT. Credit math + receipt figures. Underpaid anonymous → 400. Double confirm: one consumption, one event. Return restock vs not. Staff A reads staff B's sale → 403; admin ok. repair.pickedUp replay ⇒ one sale, no invoice. Staff mapping hides profit.
