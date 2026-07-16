# Module: billing
Merges: invoice (outgoing snapshots from SALE | ORDER) + client-payments ledger.

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
| `BILLING_ROUTES.MY_INVOICES` | GET `/api/clients/me/invoices(/:number)(/pdf)` | client | via linked posClientId |
| `BILLING_ROUTES.STAFF_INVOICES` | GET `/api/staff/invoices(/:number)(/pdf)` | staff(STAFF_INVOICES) | **issued-by-me only** |
| `BILLING_ROUTES.ADMIN_INVOICES` | GET `/api/admin/invoices(/:number)(/pdf)` | admin | filters client/status/source/date |
| `BILLING_ROUTES.CANCEL` | POST `/api/admin/invoices/:number/cancel` | admin | reason optional |
| `BILLING_ROUTES.CLIENT_PAYMENTS` | POST `/api/(staff|admin)/client-payments` | staff(STAFF_INVOICES)\|admin | dialog shows previous→new credit |
| `BILLING_ROUTES.CLIENT_PAYMENTS_LIST` | GET `/api/admin/client-payments` | admin | ledger |

```
InvoiceStatus = 'ISSUED'|'PARTIALLY_PAID'|'PAID'|'CANCELLED'
InvoiceSource = 'SALE'|'ORDER'                              // never REPAIR
InvoiceDto { number; posClientId?; clientNameSnapshot; clientAddressSnapshot?;
  sourceType; sourceReference; status; totalAmount; paidAmount; previousCredit?; newCredit?;
  totalCost?; totalProfit?;                                 // admin mapping only
  issuedAt; dueDate?; staffName;
  lines: { label; quantity; unitPrice; costSnapshot?; profit?; lineTotal; serialNumbers?;
           currentAverageCost? }[] }                       // joined live for the admin compose/inspect view
CreateClientPaymentCommand { posClientId; invoiceNumber?; amount: positive; paidAt? }
ClientPaymentDto { reference; posClientName; invoiceNumber?; amount; previousCredit; newCredit; paidAt; staffName }
```

## Events [CONTRACT]
- Listens `sale.confirmed` → issue (sourceType SALE) from the snapshot lines — **skips origin REPAIR**; idempotent (`@@unique(sourceType, sourceId)` backs it).
- Listens `order.confirmed` → issue (sourceType ORDER); idempotent.
- Emits `invoice.issued`, `invoice.cancelled`, `payment.clientRecorded { paymentId; posClientId; invoiceNumber?; amount; previousCredit; newCredit }` — clients module and orders listen; audit narrates.
- Own listener on `payment.clientRecorded` → invoice paidAmount + status (ISSUED → PARTIALLY_PAID → PAID).

## Business Logic [BACKEND]
1. Issue copies snapshot lines, previous/new credit, cost/profit from the event; `SequenceService('INVOICE')` → `FAC-YYYY-NNNN`. The document renders identically forever — never re-derived.
2. Cancel: status only; numbers never reused, gaps never closed.
3. Payments: read the POS client's current credit → snapshot previous, `new = previous − amount` → persist → emit. On-account allowed (no invoice). Overpayment allowed (negative credit = store owes), flagged. Concurrent payments serialize on the POS-client row.
4. PDF: server-rendered from the snapshot + settings store header.

## Data Mapping [BACKEND]
Client mapping strips costSnapshot/profit/currentAverageCost and other clients' data (404 on foreign numbers). Staff list filtered `staffId = me` in the service.

## Test Scenarios [BACKEND]
sale.confirmed replay ⇒ one invoice; REPAIR origin ⇒ none. Order invoice issued without any sale row. Sequence gap survives cancel. Payment flips statuses; snapshots correct under concurrency. Client A cannot fetch B's invoice.
