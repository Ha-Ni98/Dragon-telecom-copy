# Module: purchasing
Merges: supplier + supplier-invoice (goods receipt) + supplier-payments.

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
| `PURCHASING_ROUTES.SUPPLIERS` | GET/POST/PATCH `/api/admin/suppliers(/:id)` | admin | POST takes `initialCredit?` |
| `PURCHASING_ROUTES.SUPPLIER_DETAIL` | GET `/api/admin/suppliers/:id` | admin | aggregate: invoices, payments, product history |
| `PURCHASING_ROUTES.SUPPLIER_STATS` | GET `/api/admin/suppliers/stats` | admin | |
| `PURCHASING_ROUTES.INVOICES` | GET/POST/PATCH `/api/admin/supplier-invoices(/:id)` | admin | PATCH: DRAFT only |
| `PURCHASING_ROUTES.CONFIRM` | POST `/api/admin/supplier-invoices/:id/confirm` | admin | |
| `PURCHASING_ROUTES.CANCEL` | POST `/api/admin/supplier-invoices/:id/cancel` | admin | reason optional |
| `PURCHASING_ROUTES.PAYMENTS` | GET/POST `/api/admin/supplier-payments` | admin | ledger |

```
SupplierDto { id; code; name; contactName?; phone?; email?; location?;
              credit; totalPaid; totalInvoiced; invoiceCount; lastDeliveryAt?; isEnabled }
CreateSupplierCommand { name; contactName?; phone?; email?; location?; initialCredit? }
SupplierInvoiceDto { id; reference; supplierReference?; supplierId; supplierName;
  status: 'DRAFT'|'CONFIRMED'|'CANCELLED'; invoiceDate; dueDate?; shippingCost; amountOnly?;
  totalAmount; paidAmount; previousCredit?; newCredit?; note?; staffName;
  lines: { id; productId; productNameSnapshot; quantity; unitCost; landedUnitCost; lineTotal;
           serialNumbers?; projectedNewAverageCost? }[] }      // projection on DRAFT reads
CreateSupplierInvoiceCommand { supplierId; supplierReference?; invoiceDate; dueDate?;
  shippingCost?; amountOnly?; note?;
  lines?: { productId; quantity; unitCost; serialNumbers? }[] }   // amountOnly XOR lines
ConfirmResultDto { reference; repriceCandidates: { productId; name; averageCost;
  current: { guestPrice?; defaultSalePrice?; categoryPrices } }[] }
CreateSupplierPaymentCommand { supplierId; supplierInvoiceReference?; amount: positive; paidAt? }
SupplierPaymentDto { reference; supplierName; supplierInvoiceReference?; amount;
                     previousCredit; newCredit; paidAt; staffName }
```

## Events [CONTRACT]
- Emits `supplierInvoice.confirmed { invoiceId; supplierId; totalAmount; previousCredit; newCredit }`, `supplierInvoice.cancelled`, `payment.supplierRecorded { paymentId; supplierId; supplierInvoiceReference?; amount; previousCredit; newCredit }`, `supplier.creditChanged` — audit listens to all.
- Listens (own listeners): confirmed → supplier `credit += total`, `totalInvoiced += total`, `lastDeliveryAt`; cancelled → reverse; paymentRecorded → `credit −= amount`, `totalPaid += amount`, invoice paidAmount/status. All idempotent by document id.

## Business Logic [BACKEND]
1. DRAFT freely editable, touches nothing. `amountOnly` XOR `lines` (400 otherwise).
2. Landed cost: `unitCost + shippingCost × (lineTotal/Σ lineTotals) / quantity`. DRAFT reads include `projectedNewAverageCost` per line so the buyer sees the margin impact before committing.
3. **Confirm (one transaction, idempotent):** per line **injected** `InventoryService.addLayer(SUPPLIER_INVOICE, qty, landedUnitCost)` → header credit snapshot previous→new → `SequenceService('SUPPLIER_INVOICE')` → CONFIRMED → commit → emit. Returns `repriceCandidates` — the UI's skippable prompt; actual repricing goes through `CATALOG_ROUTES.PRICING`.
4. Immutable after confirm (PATCH → 409). Cancel reverses credit via event; **stock reversal is a deliberate ADJUSTMENT_OUT by the admin, never automatic** — the goods are physically there.
5. Payments: snapshot math on the row; on-account allowed; overpayment permitted (credit negative = supplier owes) and flagged.
6. Opening credit from `initialCredit`; conformance: `credit = opening + Σ confirmed invoices − Σ payments`.

## Test Scenarios [BACKEND]
amountOnly+lines → 400. Confirm: one layer per line at landed cost, avg matches hand calc, double-confirm no-op. Zero-line raises credit, zero movements. PATCH after confirm 409. Payment snapshots + concurrent payments serialize. Cache = ledger.
