# STF-04 — Staff orders

## Layout
- Staff shell, desktop-first. Route: `/staff/orders`.

## UI
- `StatCard` row (pending, confirmed, in-delivery) · status tabs (default PENDING) + search + date range · `DataTable` 14/page: reference, client/contact (name, phone, wilaya), product, qty, type, total, status, date, **age flag** (pending > 24 h).
- `OrderShowDialog` (read-only: line with frozen price + live availability re-check, contact, delivery, timeline).
- `OrderConfirmDialog` and `OrderStatusDialog`.

## Interactions
- **Staff can confirm and advance every forward state: PENDING → CONFIRMED → PACKAGED → IN_DELIVERY → COMPLETED.** Cancel and Return buttons are **absent** on this page — admin-only actions.
- Confirm: optional charged-price adjust + serial numbers + paid amount → converts the reservation, issues the invoice; 409 on stock shortfall names the gap.
- IN_DELIVERY requires delivery company + tracking number; COMPLETED stamps deliveredAt.

## Forms
- Confirm: `ConfirmOrderCommand` (RHF + zodResolver). Status: `UpdateOrderStatusCommand` — deliveryCompany/trackingNumber required conditionally by a refine.

## Data dependencies
- `useOrders(filters)` → `['orders',filters]`; `useOrderStats()` → `['orders','stats']`.
- Mutations: `useConfirmOrder` / `useUpdateOrderStatus` — invalidate `['orders']`, `['orders','stats']`, `['staff','dashboard']`.

## Access
- Staff — `RoleGuard(STAFF_ORDERS)`; admin uses ADM-09 (same components + cancel/return).
