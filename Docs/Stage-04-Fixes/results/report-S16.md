# Report — Set 16: Cart — multi-product ordering

Executed against `Docs/Stage-04-Fixes/plans/plan-S16-cart-multi-product-ordering.md` on
`stage-04-fix`, 2026-07-28, immediately after S15 (this set reuses S15's
`OrderPlacementSection`/`order.schema.ts` and cannot compile standalone against the pre-S15 cart).
Turns `/cart` from a per-row single-product order into one multi-line order (D1). Frontend-only —
no contract, backend, or Prisma change.

## Owner decisions carried into execution

- **R1 (cart stays quantity-less on the server)** — confirmed. No `ClientCart` migration, no new
  endpoint. Checkout quantities live in `Cart.tsx`'s own `selection` state, default 1, not
  persisted.
- **R2 (exclude, don't block)** — an unorderable row (out of stock / no price for this viewer) is
  greyed out, its checkbox disabled, and simply left out of the order; the rest place normally.

## Decisions taken during planning, confirmed here

- **R3 (per-row include checkbox)** — implemented: every row has a checkbox, default checked when
  orderable, unchecked/disabled when blocked.
- **R4 (order doesn't clear the cart)** — implemented: `OrderPlacementSection` is not given an
  `onPlaced` handler that touches the cart; favorites rows survive a successful order.

## What changed

### `Apps/web/src/pages/cart/components/CartItemRow.tsx`
Rewritten from a per-row single-product order row into a selectable checkout line:
- `onOrder` prop removed; new props `included`/`onIncludedChange`, `quantity`/`onQuantityChange`,
  `blockedReason?`.
- A `Checkbox` (new import, `@/components/ui/checkbox`) at the row's start, disabled when blocked.
- A compact `Minus`/value/`Plus` quantity stepper (bounds 1–99, same ceiling the product page's
  stepper uses), hidden when the row is blocked.
- Blocked rows: text block at `opacity-60`, the reason rendered in `text-xs text-destructive`
  beneath the price/stock chip.
- Line total (`resolvedPrice × quantity`) shown when orderable.
- The `Order` button is gone — placement is now page-level.

### `Apps/web/src/pages/cart/Cart.tsx`
Rewritten:
- Removed: `ProductOrderModal`, `selectedItem`/`deliveryParams` state, `handleOrder`/
  `handleOrderSubmit`, `usePlaceOrder`/`useWilayas`/`usePlatformDeliveryFee`/
  `toPlaceOrderCommand`/`useNavigate` — all now owned by `OrderPlacementSection`.
- Added: a `selection: Record<productId, { included, quantity }>` state; a `blockedReasonFor`
  helper (out-of-stock → `cart.blockedOutOfStock`, hidden/missing price → `cart.blockedNoPrice`);
  derived `rows`/`orderLines`/`excludedCount`.
- Renders one `<OrderPlacementSection lines={orderLines} disabled={orderLines.length === 0}
  submitLabel={t("cart.orderAll")} />` below the item list — the same component the product page
  uses (S15), with N lines instead of one. Not cleared on success (R4).
- An exclusion notice (`cart.excludedNotice`) shows when any row is blocked; a "select at least
  one" hint (`cart.nothingSelected`) shows when nothing is included.

### `Apps/web/src/components/shared/ProductOrderModal.tsx` — deleted
Confirmed zero non-comment importers before deletion (`grep -rn "ProductOrderModal" Apps/web/src`
returned only comment references). Its two remaining comment mentions were updated to point at
`OrderPlacementSection`:
- `pages/staff/pos/components/QuickAddPosClientDialog.tsx`
- `components/shared/OrderCard.tsx`

### `Apps/web/src/config/translations.json`
Added `cart.includeInOrder`, `cart.orderAll`, `cart.nothingSelected`, `cart.blockedOutOfStock`,
`cart.blockedNoPrice`, `cart.excludedNotice`.

Orphaned but left in place per the no-cleanup norm: `cart.order` (was the per-row Order button's
label).

## Gates

- `Apps/web`: `npx tsc --noEmit` — clean (checked together with S15; the deletion of
  `ProductOrderModal.tsx` and the rewrite of `Cart.tsx` are what make S15's schema changes
  compile cleanly across the whole app).
- `Apps/web`: `eslint` on every touched file — clean (prettier auto-fix applied, no logic
  changes).
- `Apps/contract` / `Apps/api`: untouched by this set: `npm run check` / `npx tsc --noEmit` still
  clean on `src/**` (re-verified after S16's changes).
- No test file was read, edited, or run.

## Manual verification checklist (browser)

1. Sign in as a client, heart 3 products from the catalog, open `/cart` → three rows, each with a
   checked box, a quantity stepper at 1, and a line total.
2. Set quantities 2 / 1 / 3 → each line total updates and the section's subtotal equals the sum.
3. Uncheck the middle row → it drops out of the subtotal; the button still reads "Order selected
   items".
4. Uncheck all three → the button is disabled and "Select at least one product to order" shows.
5. Choose delivery – home, pick a wilaya and commune → **one** delivery fee is added, not one per
   line; total = subtotal + fee.
6. Place the order → `/order-confirmation` shows one reference, one row per included product with
   the chosen quantities, the single delivery fee, name and phone.
7. `/orders` → the new order appears with all its lines; Admin → Orders shows the same single
   order (not N orders) with the correct total.
8. Admin → Inventory → Stock levels: reserved quantity rose by the ordered quantity for each
   included product; on-hand did **not** move (D2 — consumption is at `COMPLETED`).
9. Back on `/cart`: the ordered rows are still there (R4); quantities reset to 1 on reload (R1).
10. Make one favorite go out of stock (set it to 0 in admin), reload `/cart` → that row is greyed,
    its checkbox disabled, the reason shown, the exclusion notice appears, and ordering the rest
    still succeeds.
11. Order a quantity above stock → the order-wide "not enough stock" message appears and no order
    is created (check Admin → Orders).
12. Regression: order a single product from its product page → still works, still one order with
    one line.
