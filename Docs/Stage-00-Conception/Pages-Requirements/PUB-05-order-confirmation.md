# PUB-05 — Order confirmation

## Layout
- Public shell, mobile-first. Route: `/order-confirmation` (state-driven, not fetch-driven).

## UI
- Success icon, order reference, product line, fee, total, mode, and the message: **the order is pending confirmation — the store will call the contact number**.

## Interactions
- CTA back to catalog; clients get a link to My Orders. Direct navigation without router state redirects to `/`.

## Forms
- None.

## Data dependencies
- None (renders the `usePlaceOrder` result passed through router state).

## Access
- Public (guests keep the reference as their only handle).
