# ADM-12 — Web clients

## Layout
- Admin shell, desktop-first. Route: `/admin/clients`.

## UI
- `StatCard` row (total, active, pendingApprovals, newThisMonth) · filters (status — pending is the approval queue —, category) · `DataTable`: full name, store name, username (—), phone, email, wilaya/commune (fr names), category, status, totalOrders, totalSpent, lastOrder, enabled · actions: **Approve** (pending rows), Edit, Detail → ADM-12b, Disable.
- **No create button** — web clients exist only through registration.
- `ApprovalDialog`: registration recap · **username + password fields** (creates the login) · **category select** (mandatory — this switches tier pricing on) · Approve / Reject (reason optional).

## Interactions
- Approve atomically creates credentials + the linked POS client; the row flips to APPROVED with the username shown. Reject keeps the phone occupied (the register page answers accordingly).

## Forms
- `ApproveClientCommand` via RHF + zodResolver (username unique — server error lands on the field). `RejectClientCommand`. Edit: contact subset.

## Data dependencies
- `useAdminClients(filters)` → `['clients','admin',filters]`; `useClientStats()`.
- Mutations: approve/reject/update — invalidate `['clients','admin']`, `['pos-clients']`, `['admin','dashboard']`.

## Access
- Admin only.
