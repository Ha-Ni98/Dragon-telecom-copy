# ADM-02 — Products list

## Layout
- Admin shell, desktop-first. Route: `/admin/products`.

## UI
- `PageHeader` + **Add product** button · `StatCard` row (total / in stock / low / out) · filter bar (search, family/brand/model cascading, stock status) · `DataTable` 20/page: image, product, barcode, taxonomy, on hand, reserved, **available**, avg cost, stock badge, published toggle, enabled toggle.

## Interactions
- Row **Edit** → ADM-04. Publish/enable optimistic toggles with rollback. Searches fire the staff-search beacon (admin searches are audited too).
- No stock entry here — stock arrives only via supplier invoices (ADM-08) or adjustments (ADM-06).

## Forms
- None (toggles are single PATCHes).

## Data dependencies
- `useAdminProducts(filters)` → `['admin','products',filters]`; `useProductStats()` → `['admin','products','stats']`.
- Mutations: `useUpdateProduct()` (toggles) invalidates both keys.

## Access
- Admin only.
