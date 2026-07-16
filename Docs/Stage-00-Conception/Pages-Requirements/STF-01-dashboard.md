# STF-01 — Staff dashboard

## Layout
- Staff shell (`StaffLayout`: sidebar of permitted pages + header), desktop-first. Route: `/staff`.

## UI
- `StatCard` row: my sales today (count + revenue), my open drafts.
- My drafts list (reference, client, total, age) — each links into the POS to finish it.
- Pending orders count (when STAFF_ORDERS granted) → `/staff/orders`.
- Low-stock alert list (read-only).

## Interactions
- Widgets render only when the corresponding page key is in the effective set; each loads independently.

## Forms
- None.

## Data dependencies
- `useStaffDashboard()` → `['staff','dashboard']` → GET /api/staff/dashboard (per-widget skeleton / silent-hide on error).

## Access
- Staff — `ProtectedRoute(staff)` + `RoleGuard(STAFF_DASHBOARD)`. Admin uses ADM-01 instead.
