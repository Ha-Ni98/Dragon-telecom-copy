# PUB-09 — My Orders

## Layout
- Public shell, mobile-first. Route: `/orders`.

## UI
- Summary chips (counts by status) · status filter (all / pending / confirmed / packaged / in-delivery / completed / cancelled / returned) · `OrderCard` list: reference, date, product (price frozen at placement), fee, total, paid, status badge · expandable detail: mode, wilaya/commune, delivery company + tracking (when in-delivery), status timeline, linked invoice link.

## Interactions
- Filter refetches. **Cancel** button on PENDING cards only → `CancelOrderDialog` (reason optional) → releases the reservation.

## Forms
- Cancel dialog: optional reason textarea → POST /api/orders/:id/cancel.

## Data dependencies
- `useMyOrders(status, page)` → `['orders','me',status,page]` (skeleton cards / EmptyState per filter / error retry).
- Mutations: `useCancelOrder()` invalidates `['orders','me']`.

## Access
- Clients only — `ProtectedRoute(client)`.
