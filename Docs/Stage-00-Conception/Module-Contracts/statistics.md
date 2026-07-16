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
4. stockValue = Σ quantityOnHand × averageCost. Every report row carries a drill id to its documents. `format=csv` streams the rows.
5. Staff dashboard strictly `staffId = me`; nothing global except low stock (read-only alert).

## Test Scenarios [BACKEND]
Profit = Σ stored line profits (no drift vs FIFO). Period-comparison math incl. empty previous period. Repair sale counted once. Discount column matches overrides. Staff dashboard leak test. CSV shape = rows.
