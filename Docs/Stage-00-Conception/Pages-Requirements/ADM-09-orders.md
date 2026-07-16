# ADM-09 — Orders

## Layout
- Admin shell, desktop-first. Route: `/admin/orders`.

## UI
- STF-04's components (stat cards, tabs default PENDING, table with age flag, Show/Confirm/Status dialogs) **plus the two admin-only actions**: `CancelOrderDialog` (any pre-COMPLETED state, reason optional, releases the reservation) and `ReturnOrderDialog` (from COMPLETED: quantity ≤ ordered, restock toggle, refund amount, reason optional).

## Interactions
- Everything in STF-04, unscoped, plus cancel/return. Confirm remains idempotent; double-click safe.

## Forms
- `ConfirmOrderCommand`, `UpdateOrderStatusCommand` (as STF-04) + `ReturnOrderCommand` and the cancel reason form.

## Data dependencies
- `useOrders(filters)` → `['orders',filters]`; `useOrderStats()`.
- Mutations: confirm/status/cancel/return — invalidate `['orders']`, `['orders','stats']`, `['inventory','*']`, `['invoices','admin']`, `['admin','dashboard']`.

## Access
- Admin only (staff use STF-04, which lacks cancel/return).
