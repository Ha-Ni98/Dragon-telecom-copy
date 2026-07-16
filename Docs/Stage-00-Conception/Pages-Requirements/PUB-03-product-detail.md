# PUB-03 — Product details

## Layout
- Public shell, mobile-first. Route: `/products/:id` (by id — never by name).

## UI
- Back link · `ProductImageGallery` (≤3 images, zoom) · header (family/brand badges, name, model, heart) · description card.
- `ProductPricingSection`: the price block by viewer, quantity stepper (1 → available), running total, **Order now**.
- Related products strip (same family + model).

## Interactions
- Price block: approved client → tier price, else guestPrice, else "Price on request"; guest → guestPrice, or "Only registered users can see this price" + sign-in link with Order disabled.
- **Order now** opens `ProductOrderModal`. Heart toggles favorites (clients). Product-view duration beaconed on unmount (`PRODUCT_VIEW`).

## Forms
- **Order form** (in the modal), `PlaceOrderCommand` via RHF + zodResolver:
  - quantity (≤ available) · fullName + phone (prefilled for clients, editable) · **wilaya + commune prefilled from the profile, editable** (cascading selects) · mode: guest = delivery-home | delivery-office; client also pickup.
  - Fee renders only when wilaya + commune + mode are all set; **pickup ⇒ wilaya/commune disabled, fee 0**. Live total = line + fee.
  - Submit → POST /api/orders with an idempotency key; success → PUB-05; 409 INSUFFICIENT_STOCK renders on the quantity field; 403 GUEST_PRICE_HIDDEN redirects to login.

## Data dependencies
- `useProduct(id)` → `['products', id]` (404 view for unknown/disabled). `useWilayas()` → `['wilayas']` (staleTime ∞).
- `useDeliveryFee(wilayaId, communeId)` → `['delivery-fee', wilayaId, communeId]` — enabled only when both set and mode ≠ pickup.
- Mutations: `usePlaceOrder()` invalidates `['orders','me']`; `useToggleCart()`.

## Access
- Public (ordering constraints enforced server-side per viewer).
