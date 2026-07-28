# Plan S16 — Cart: multi-product ordering

Execution plan for **set 16** of `Docs/Stage-04-Fixes/app-issues-01.md`.
Turns `/cart` from a per-row single-product order into **one multi-line order** (**D1**), reusing
the placement section built in S15. Frontend-only: the backend already accepts a lines array.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

| Set | What S16 consumes from it | Verified present |
|---|---|---|
| **S9** | `PlaceOrderCommand.lines[]` (min 1), `OrderDto.lines[]` | ✅ `orders.command.ts:8-38`, `orders.dtos.ts:6-18` |
| **S10** | One reservation per line at placement, one delivery fee per order, stock consumed only at `COMPLETED` | ✅ `orders.service.ts:99-160` — the loop already reserves per line and `deliveryFee.resolve` is called **once** per order |
| **S15** | `components/shared/OrderPlacementSection.tsx` (lines-based), `order.schema.ts`'s `toPlaceOrderCommand(values, lines, clientId)`, the shared phone rule | ⛔ **S16 cannot start before S15.** This set is mostly "point the cart at that component". |

**No backend, contract or Prisma change in this set.** If you find yourself editing
`Apps/api` or `Apps/contract`, stop — something in S9/S10/S15 was not landed as planned.

### 0.2 Owner decisions taken while planning (settled — do not re-open)

| # | Decision |
|---|---|
| **R1** | **The cart stays quantity-less on the server.** `ClientCart` is a favorites table (`schema.prisma:351-360`, no quantity column, and `hooks/useClientPortal.ts:60` labels it "favorites, no quantity"). Quantities are chosen **at checkout**, held in the page's local state, default **1**, and are not persisted. No migration, no new endpoint. |
| **R2** | **An unorderable item is excluded, not blocking.** A row whose product is out of stock, or whose price is hidden for this viewer, is shown greyed with the reason, cannot be selected, and is simply left out of the order. The remaining lines are placed as one order. |

### 0.3 Two decisions this plan takes on its own — flag them in the report

**R3 — each row carries an include checkbox, not just "order everything".**
Today every cart row has its own Order button; sending the *whole* cart as the only option would
be a regression for a client who wants one of five favorites. One checkbox per row (default:
checked when orderable) keeps single-item ordering available from the cart without a second code
path, and is exactly the control R2's exclusion rule needs anyway.

**R4 — a successful order does not empty the cart.** `/cart` is the favorites list (heart icon,
`cart.subtitle` = "Products you've favorited for quick ordering"); silently deleting favorites
because the client ordered once would be surprising. Rows stay; the client removes them with the
heart as before. Say this in the report so the owner can ask for the opposite.

### 0.4 Behaviour that must not change

- **Single-product ordering from the product page** (S15's `ProductPricingSection` →
  `OrderPlacementSection` with one line) keeps working through the *same* lines-based command.
  Do not fork a second placement path.
- `/cart` stays CLIENT-guarded in `App.tsx`, so the checkout always has a `clientId` and pickup
  is always on offer. No guest branch belongs on this page.

### 0.5 One backend behaviour to know before writing the UI

`OrdersService.placeOrder` (`orders.service.ts:99-155`) validates the whole command atomically:
a missing product → `404`, any line with a hidden price → `403 GUEST_PRICE_HIDDEN`, and an
insufficient reservation on **any** line rolls the whole transaction back with
`409 INSUFFICIENT_STOCK` — **without naming the offending product**. That is why R2's client-side
exclusion matters, and why the error message shown on failure has to be order-wide
(`orderSection.insufficientStock`, added in S15), not attached to a row.

---

## §1 — Cart row: quantity + inclusion

### 1.1 `Apps/web/src/pages/cart/components/CartItemRow.tsx`

Add to `CartItemRowProps` (keep `item`, `onRemove`, `isRemoving`; **delete `onOrder`**):

```ts
  /** Checkout selection (R3). Forced false and disabled when `blockedReason` is set. */
  included: boolean;
  onIncludedChange: (included: boolean) => void;
  /** Local, unpersisted checkout quantity (R1). */
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  /** Translated reason this row cannot be ordered — greys the row out (R2). */
  blockedReason?: string;
```

Rendering changes:

1. A `Checkbox` (`@/components/ui/checkbox`) at the start of the row:
   `checked={included} onCheckedChange={(v) => onIncludedChange(v === true)}`,
   `disabled={!!blockedReason}`, `aria-label={t("cart.includeInOrder")}`.
2. A compact quantity stepper (mirror `ProductPricingSection`'s: `Minus` / value / `Plus` buttons,
   `size="icon"`, bounds **1 … 99**) rendered only when `!blockedReason`. Reuse the existing
   aria labels `product.decreaseQuantity` / `product.increaseQuantity`.
   ```ts
   // Same 99 ceiling the product page's stepper uses — the public DTO exposes only
   // `inStock: boolean`, so the server's 409 is still the authoritative bound (S15/§5.1).
   ```
3. When `blockedReason` is set: wrap the text block in `opacity-60` and render the reason under
   the price in `text-xs text-destructive`.
4. Line total on the right when orderable: `formatDZD(resolvedPrice * quantity, language)`.
5. Delete the `Order` button (`t("cart.order")`) — placement is now the page-level section.
   Keep the heart/remove button untouched.
6. `CartItemRowSkeleton` is unchanged.
7. Update the component's header comment: it is no longer "a per-row single-product order"; it is
   a selectable checkout line.

---

## §2 — Cart page: one order, N lines

### 2.1 `Apps/web/src/pages/cart/Cart.tsx` — rewrite the ordering half

Remove: `ProductOrderModal` import and usage, `selectedItem`, `deliveryParams`, `handleOrder`,
`handleOrderSubmit`, `usePlaceOrder`, `useWilayas`, `usePlatformDeliveryFee`,
`toPlaceOrderCommand`, `OrderFormValues`, `DeliveryParams`, `useNavigate`. All of that now lives
inside `OrderPlacementSection`.

Add:

```ts
// Checkout state is local and unpersisted (R1): ClientCart has no quantity column, and a
// favorites row is not a commitment to order that many. Keyed by productId; a row absent from
// the map is "included, quantity 1".
const [selection, setSelection] = useState<Record<string, { included: boolean; quantity: number }>>({});

const blockedReasonFor = (item: CartItemDto): string | undefined => {
  const price = item.product.currentPrice ?? item.product.guestPrice;
  if (item.product.priceHidden || price === undefined) return t("cart.blockedNoPrice");
  if (!item.product.inStock) return t("cart.blockedOutOfStock");
  return undefined;
};

const rows = (items ?? []).map((item) => {
  const blockedReason = blockedReasonFor(item);
  const state = selection[item.productId] ?? { included: true, quantity: 1 };
  return { item, blockedReason, included: !blockedReason && state.included, quantity: state.quantity };
});

const orderLines = rows
  .filter((row) => row.included)
  .map((row) => ({ product: row.item.product, quantity: row.quantity }));

const excludedCount = rows.filter((row) => row.blockedReason).length;
```

Render, below the existing item list:

```tsx
{excludedCount > 0 && (
  <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
    {t("cart.excludedNotice")}
  </p>
)}

{/* D1 — one order, N lines, one delivery fee, one reservation per line. The section is the
    same component the product page uses; only the lines array differs. */}
<OrderPlacementSection
  lines={orderLines}
  disabled={orderLines.length === 0}
  submitLabel={t("cart.orderAll")}
/>

{orderLines.length === 0 && (
  <p className="text-sm text-muted-foreground">{t("cart.nothingSelected")}</p>
)}
```

Notes for the executor:
- `OrderPlacementSection` navigates to `/order-confirmation` itself; the page needs no `onPlaced`
  handler (R4 — the cart is deliberately not cleared).
- `CartItemDto.product` **is** a `ProductWithPricingDto` (`clients.dtos.ts:87-92`), so `lines`
  type-checks with no cast.
- Keep the loading / error / empty branches exactly as they are.
- Update the page's header comment (`// PUB-04 — favorites list with a per-row single-product
  order …`): it is now a favorites list with a single multi-line checkout.

### 2.2 Wire the row props

```tsx
{rows.map(({ item, blockedReason, included, quantity }) => (
  <CartItemRow
    key={item.productId}
    item={item}
    blockedReason={blockedReason}
    included={included}
    onIncludedChange={(next) =>
      setSelection((prev) => ({ ...prev, [item.productId]: { included: next, quantity } }))
    }
    quantity={quantity}
    onQuantityChange={(next) =>
      setSelection((prev) => ({ ...prev, [item.productId]: { included, quantity: next } }))
    }
    onRemove={() => removeMutation.mutate(item.productId)}
    isRemoving={removeMutation.isPending && removeMutation.variables === item.productId}
  />
))}
```

---

## §3 — Retire `ProductOrderModal`

### 3.1 Delete `Apps/web/src/components/shared/ProductOrderModal.tsx`

Only after §2 compiles. Confirm zero importers first:
`grep -rn "ProductOrderModal" Apps/web/src` must return **only comments**.

### 3.2 Update the three comments that name it

| File | Line | Change |
|---|---|---|
| `components/shared/OrderCard.tsx` | ~33 | "matching the established shared-component convention (ProductOrderModal takes onSubmit/isSubmitting…)" → point at `OrderPlacementSection` |
| `pages/staff/pos/components/QuickAddPosClientDialog.tsx` | ~29 | same substitution |
| `pages/cart/components/CartItemRow.tsx` | ~9 | rewritten in Action 1.1 anyway |

`components/sections/product-details/ProductPricingSection.tsx`'s header comment was already
rewritten in S15 — verify it no longer mentions the modal.

---

## §4 — Translation keys

Add to `Apps/web/src/config/translations.json` (flat keys, `{en, fr, ar}`; `ar` stays `""`).

| Key | en | fr |
|---|---|---|
| `cart.includeInOrder` | Include in order | Inclure dans la commande |
| `cart.orderAll` | Order selected items | Commander les articles sélectionnés |
| `cart.nothingSelected` | Select at least one product to order | Sélectionnez au moins un produit à commander |
| `cart.blockedOutOfStock` | Out of stock — cannot be ordered | En rupture de stock — ne peut pas être commandé |
| `cart.blockedNoPrice` | No price available for your account | Aucun prix disponible pour votre compte |
| `cart.excludedNotice` | Some products can't be ordered right now and are left out of this order. | Certains produits ne peuvent pas être commandés pour le moment et sont exclus de cette commande. |

Reused as-is: `cart.pageTitle`, `cart.subtitle`, `cart.empty`, `cart.emptyBody`,
`cart.errorLoading`, `cart.errorLoadingBody`, `cart.remove`, `cart.priceOnRequest`,
`cart.outOfStock`, `product.decreaseQuantity`, `product.increaseQuantity`,
`orderSection.insufficientStock` (added in S15).

Now orphaned but **left in place**: `cart.order`.

---

## §5 — Order of execution

1. Confirm S15 landed (`components/shared/OrderPlacementSection.tsx` exists and
   `toPlaceOrderCommand` takes a `lines` argument).
2. §1 → §2 → compile (`npx tsc --noEmit` in `Apps/web`).
3. §3 (delete + comment sweep) → §4.
4. Gates: `npx tsc --noEmit` and `npm run lint`. **No test file is read, written or run.**

---

## §6 — Manual verification checklist (browser)

1. Sign in as a client, heart 3 products from the catalog, open `/cart` → three rows, each with a
   checked box, a quantity stepper at 1, and a line total.
2. Set quantities 2 / 1 / 3 → each line total updates and the section's subtotal equals the sum.
3. Uncheck the middle row → it drops out of the subtotal; the button label still reads
   "Order selected items".
4. Uncheck all three → the button is disabled and "Select at least one product to order" shows.
5. Choose **delivery – home**, pick a wilaya and commune → **one** delivery fee is added, not one
   per line; total = subtotal + fee.
6. Place the order → `/order-confirmation` shows **one reference**, one row per included product
   with the chosen quantities, the single delivery fee, name and phone.
7. `/orders` → the new order appears with all its lines; **Admin → Orders** shows the same single
   order (not N orders) with the correct total.
8. **Admin → Inventory → Stock levels**: reserved quantity rose by the ordered quantity for each
   included product, and on-hand did **not** move (D2 — consumption is at `COMPLETED`).
9. Back on `/cart`: the ordered rows are still there (R4), quantities reset to 1 on reload (R1).
10. Make one favorite go out of stock (adjust it to 0 in admin), reload `/cart` → that row is
    greyed, its checkbox disabled, the reason shown, the exclusion notice appears, and ordering
    the rest succeeds.
11. Order a quantity above stock → the order-wide "not enough stock" message appears and **no**
    order is created (check Admin → Orders).
12. **Regression:** order a single product from its product page → still works, still one order
    with one line.
