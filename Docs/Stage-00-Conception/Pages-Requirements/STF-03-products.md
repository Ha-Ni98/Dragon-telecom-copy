# STF-03 — Staff products

## Layout
- Staff shell, desktop-first. Route: `/staff/products`.

## UI
- Filter bar (search 300 ms, family/brand/model cascading) · `DataTable`: image, name, barcode, family/brand/model, **available qty**, the **4 prices** (default + three category columns). No cost, no margin, no actions.

## Interactions
- Read-only. Every executed search fires the beacon (`POST /api/activity/staff-search`) — the "looked it up, never rang it up" inventory audit. Row click copies the barcode / jumps to POS with the product (when POS granted).

## Forms
- None.

## Data dependencies
- `useStaffProducts(filters)` → `['staff','products',filters]` (skeleton / empty / retry). Beacon mutation, no invalidation.

## Access
- Staff — `RoleGuard(STAFF_PRODUCTS)`; admin sees ADM-02 instead.
