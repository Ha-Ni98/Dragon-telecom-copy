# ADM-15 — Reports & statistics

## Layout
- Admin shell, desktop-first. Route: `/admin/statistics?dateRange=&familyId=` (URL-synced filters).

## UI
- **Overview cards** (all-time): totalRevenue, **totalProfit** (Σ stored FIFO line profits), stockValue, totalClientCredit, totalSupplierCredit.
- **Filtered cards**: revenue / profit / orders with % change vs the previous period; presets weekly/monthly/yearly/custom; family filter.
- **Charts**: revenue over time (per-family option), orders trend (total/completed/cancelled/pending), clients growth, sales by family (pie).
- **Top-selling products** ranked table.
- **Report picker** → each report renders chart + `DataTable` + CSV export: sales by product (qty, revenue, cost, profit) · by client / by category (**resolved vs charged = real discount**) · by seller · stock movements summary (large adjustments flagged) · repairs (volume, turnaround, labour vs parts, per technician) · supplier spend · receivables/payables ageing · **client browsing** (top searches; most-viewed never-purchased).

## Interactions
- Every figure drills to its underlying documents (row carries the drill id). Date range + family sync to the URL; comparison recomputes.

## Forms
- None (filter bar only).

## Data dependencies
- `useOverview()` → `['stats','overview']`; `useFiltered(range, familyId)` → `['stats','filtered',range,familyId]`; `useChart(chart, range)`; `useTopProducts(period)`; `useReport(type, range, groupBy)` → `['reports',type,range,groupBy]`. Independent loading per widget; CSV via the same endpoint with `format=csv`.

## Access
- Admin only.
