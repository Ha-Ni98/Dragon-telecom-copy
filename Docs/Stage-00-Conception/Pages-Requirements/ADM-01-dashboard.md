# ADM-01 — Admin dashboard

## Layout
- Admin shell (`AdminLayout`: full sidebar + header), desktop-first. Route: `/admin`.

## UI
- `StatCard` row: totalClients, totalProducts, ordersThisWeek, revenueThisMonth — each with % change vs previous period.
- **Pending online orders** widget (5, actionable) and **Pending registrations** widget (5) — the two work queues.
- Recent orders (8), recent clients (5), low stock (5, threshold-flagged), repairs by status, draft sales by staff.

## Interactions
- Pending-order row → ADM-09 confirm dialog; pending-client row → ADM-12 approval dialog; low-stock row → ADM-04. Widgets load independently.

## Forms
- None.

## Data dependencies
- `useAdminDashboard()` → `['admin','dashboard']` → GET /api/admin/dashboard. Per-widget skeleton; a failed widget shows a retry chip without blanking the page.

## Access
- Admin only — `ProtectedRoute(staff|admin)` + `RoleGuard(admin)`.
