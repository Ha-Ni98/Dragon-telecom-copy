# Module: statistics
Read-only aggregation: admin + staff dashboards, the merged statistics page, drillable reports. Reads **stored** figures only — no recomputation.

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
| `STATS_ROUTES.ADMIN_DASHBOARD` | GET `/api/admin/dashboard` | admin | one aggregate call |
| `STATS_ROUTES.STAFF_DASHBOARD` | GET `/api/staff/dashboard` | staff | scoped to me |
| `STATS_ROUTES.OVERVIEW` | GET `/api/admin/statistics/overview` | admin | all-time cards |
| `STATS_ROUTES.FILTERED` | GET `/api/admin/statistics/filtered?from=&to=&familyId=` | admin | + % vs previous period |
| `STATS_ROUTES.CHARTS` | GET `/api/admin/statistics/charts/:chart?from=&to=&familyId=` | admin | revenue \| orders \| clients \| sales-by-family |
| `STATS_ROUTES.TOP_PRODUCTS` | GET `/api/admin/statistics/top-products?period=` | admin | |
| `STATS_ROUTES.REPORT` | GET `/api/admin/reports/:type?from=&to=&groupBy=&format=` | admin | table + chart + CSV |
| `STATS_ROUTES.CASH_REGISTER` | GET `/api/admin/cash-register?date=` | admin | S33 — the Caisse: one Africa/Algiers day (today when omitted), five sections |
| `STATS_ROUTES.STAFF_CASH_REGISTER` | GET `/api/staff/cash-register` | staff/admin | S35 — today's whole-store cash register; profit stripped in the mapper (`StaffCashRegisterDto` has no profit key); no date, no drill |
| `STATS_ROUTES.CASH_REGISTER_DOCUMENTS` | GET `/api/admin/cash-register/documents?date=&drill=&page=&limit=` | admin | S33 — the documents behind one Caisse figure (paginated, max 100) |

```
OverviewDto { totalRevenue; totalProfit; stockValue; totalClientCredit; totalSupplierCredit }
FilteredDto { revenue; profit; orders; revenueChangePct; profitChangePct; ordersChangePct }
ReportType = 'sales-by-product'|'sales-by-client'|'sales-by-category'|'sales-by-seller'
           | 'stock-movements'|'repairs'|'supplier-spend'|'ageing'|'client-browsing'
ReportDto { chart: { label; value }[]; rows: Record<string, unknown>[]; totals; drill { entity; idField } }
AdminDashboardDto { stats { totalClients; totalProducts; ordersThisWeek; revenueThisMonth; *ChangePct };
  pendingOrders[]; pendingClients[]; recentOrders[]; recentClients[]; lowStockProducts[];
  repairsByStatus; draftSalesByStaff[] }
StaffDashboardDto { mySalesToday; myRevenueToday; myDrafts[]; myPendingOrdersCount?; lowStock[] }
```

## Events [CONTRACT]
- Listens: none. Emits: none. Queries only.

## Business Logic [BACKEND]
1. Revenue/profit = Σ stored figures over COMPLETED sales (both origins) + CONFIRMED-and-later orders — repair revenue arrives once, as the repair-origin sale; never double-counted with an invoice.
2. `sales-by-category` / `by-seller` expose the discount column: Σ (resolvedPrice − unitPrice) × qty.
3. `stock-movements` totals per type; large ADJUSTMENT_OUT flagged (shrinkage signal). `ageing` buckets client + supplier credit by document age. `client-browsing` joins observability: top searches; most-viewed products with zero purchases.
4. stockValue = Σ quantityOnHand × avgStockPrice. Every report row carries a drill id to its documents. `format=csv` streams the rows.
5. Staff dashboard strictly `staffId = me`; nothing global except low stock (read-only alert).
6. **Caisse (S33):** one Africa/Algiers day via `storeDayRangeUtc(date, date)`, computed once. Sales by `soldAt` (count, Σ total, Σ paid, new credit = total − paid); returns (sale + order) by `returnedAt` (count, Σ refundAmount); repairs picked up (`pickedUpAt`, PICKED_UP|RETURNED: count, gross paid = paid + refunded, unpaid) plus refunds dated on `cancelledAt`/`returnedAt` from `Repair.refundedAmount`; orders: confirmed (`confirmedAt`), sent out (`inDeliveryAt`), completed (`deliveredAt`, Σ paidAmount); suppliers: invoices confirmed (`confirmedAt`, Σ total), payments made (`SupplierPayment.paidAt`, Σ amount), new credit = invoiced − paid. All SQL aggregates over stored values; each drill list reuses its figure's own where-builder. **S35 additions:** (a) *Which query owns which payment row* — a payment linked to a sale/order/repair belongs to that document's section (via the document's own paid figure); a Record-payment row (`ClientPayment.standalone = true`, any invoice link, plus pre-S35 rows with no invoice and no repair) belongs to **Payments → client (+)**; a supplier payment with a `supplierInvoiceId` belongs to **Suppliers → paid on invoices**, one without to **Payments → supplier (−)** — so every row is counted once; `suppliers.newCredit` stays invoiced − all supplier payments. (b) **Net cash movement** = sales paid + repairs gross paid + completed orders paid + standalone client payments − refunds (sale/order returns + repair refunds) − all supplier payments. (c) **Profit (admin only):** Σ stored `totalProfit` of the day's sales, picked-up repairs and completed orders, minus the profit reversed by the day's returns, dated on the return — sale line `unitPrice×qty − (restock ? cost share : 0)`, order line `refundAmount − (restock ? cost share : 0)`, repair `totalAmount − Σ cost of restocked parts` (a non-restocked part stays a loss). **Supplier payments are not an expense and never reduce profit**: purchased stock reaches profit as FIFO cost of goods when sold. (d) The staff variant calls the same aggregation for today, whole store (a deliberate exception to staff seeing only their own documents — one physical drawer) and the mapper drops `profit`.

## Test Scenarios [BACKEND]
Profit = Σ stored line profits (no drift vs FIFO). Period-comparison math incl. empty previous period. Repair sale counted once. Discount column matches overrides. Staff dashboard leak test. CSV shape = rows.
