# PUB-04 — Cart (favorites)

## Layout
- Public shell, mobile-first. Route: `/cart`.

## UI
- Item list: image, name, live resolved price, availability chip, remove (heart off), **Order** button per row.
- `EmptyState` with a link to the catalog.

## Interactions
- **Order** opens the same single-product order modal as PUB-03 — there is no multi-product checkout.
- A product no longer priced for this viewer shows "Price on request" with Order disabled. Remove deletes the favorite.

## Forms
- The shared order form (see PUB-03).

## Data dependencies
- `useCart()` → `['cart']` → GET /api/clients/me/cart (prices re-resolved server-side on each load). Skeleton list / empty state / error retry.
- Mutations: `useRemoveFromCart()` invalidates `['cart']`; `usePlaceOrder()`.

## Access
- Clients only — nested under `ProtectedRoute(client)`. Guests hitting `/cart` are redirected to login.
