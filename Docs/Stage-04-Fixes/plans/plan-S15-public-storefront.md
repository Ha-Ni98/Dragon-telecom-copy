# Plan S15 — Public storefront

Execution plan for **set 15** of `Docs/Stage-04-Fixes/app-issues-01.md`.
Covers the guest/client-facing surface: header (search, cart, account, mobile), home page,
catalog on mobile, product-info ordering, my-orders, and the login/register shell.
Consumes **D4** and **D11**; introduces the shared order-placement section that **S16** reuses.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

| Set | What S15 consumes from it | Verified present |
|---|---|---|
| **S1** | `Product.barcode` index (public search widens onto it) | ✅ `catalog.service.ts:895-906` already uses the `startsWith`-on-index pattern for staff/admin |
| **S2** | `ScrollToTop`, sign-out redirect, badge palettes | ✅ `components/layout/ScrollToTop.tsx`, `PublicHeader.tsx:53-56` |
| **S9 / S10** | `OrderDto.lines[]`, `OrderStatus.CANCELLED_BY_CLIENT`, `canBeCancelled`, line price editable at `PACKAGED` with order totals recomputed | ✅ `orders.dtos.ts:6-18`, `orders.mapper.ts:85`, `orders.service.ts:516-560` |

S15 is **not** blocked by S13/S14. It is blocked by **S9/S10** only because `OrderDto.lines`
already exists — which it does.

### 0.2 Owner decisions taken while planning (settled — do not re-open)

| # | Decision |
|---|---|
| **R1** | **The header search is a typeahead, not a submit box.** Typing shows a dropdown of at most **5** matching products — each row: product name on the left, resolved price on the right, `family · brand` underneath in muted text. A **last row** reads "See all results" and navigates to `/products?search=…`. Clicking a product row navigates to `/products/:id`. `Enter` behaves like the last row. The search activity of a **registered client** must be recorded. |
| **R2** | **Featured families get a settings field now.** `storefront.featuredFamilyIds` is added to the settings contract, defaults, public settings DTO and the home page in this set. **S17** builds the admin picker (max 6). While the stored list is empty, both home sections fall back to today's behaviour (`Family.isFeatured` / `featured=true`) so the home page is never blank. |

### 0.3 One decision this plan takes on its own — flag it in the report

**R3 — one shared phone rule, applied to both the register form and the order form.**

The issue says the order form must "apply the register form's phone validation". The register form
has **no format rule** today — `register.schema.ts:15` is `z.string().min(1)`, and the only real
check is the async availability call on blur (which is about *conflicts*, not format, and is
meaningless on a guest order form). Taking the issue literally would copy nothing.

So: a shared `phoneField(t)` schema is created (Algerian mobile/landline, optional `+213`/`00213`
prefix, spaces and dashes tolerated) and used by **both** `register.schema.ts` and the order form.
This tightens registration too. **Put it at the top of the report so the owner can object** — if
the owner enters foreign numbers anywhere, the regex is the one thing to relax.

### 0.4 Already done — verify, do not re-implement

Two bullets of the issue text landed with earlier sets. **Check them in the browser, change no
code:**

| Issue bullet | Where it already lives |
|---|---|
| "My orders — add the cancelled-by-client stat (D4)" | `pages/my-orders/components/OrderStatusFilters.tsx:20,32` — the chip and its count are in `FILTER_ORDER` and `STATUS_LABEL_KEY` |
| "the client may cancel any order except a completed one" | `orders.service.ts:172-182` (`cancelMyOrder` rejects only terminal statuses; `COMPLETED` is terminal) + `orders.mapper.ts:85` (`canBeCancelled`) + `OrderCard.tsx` renders the button off that flag |

What is genuinely missing on that page is **D11's price display** — Action 6.2.

### 0.5 Root causes found while reading (not obvious from the issue text)

| # | Finding | Fixed by |
|---|---|---|
| **F1** | **The account circle is blank because `Session.profile` is `null` for every CLIENT.** `types/session.ts:13` says so explicitly, `AuthProvider.tsx:45` derives `displayName` from `session.profile`, and `PublicHeader.tsx:145-149` renders `displayName?.split(" ")…` — an empty string inside a `bg-primary` circle. Nothing is wrong with the initials code; the name never arrives. | Action 2.4 |
| **F2** | **Prefill "leaks between pages" because the order form never remounts.** `ProductOrderModal` reads `prefill` in `useForm({ defaultValues })` (`ProductOrderModal.tsx:95-104`), which RHF captures **once**. `useClientMe` resolves *after* that first render, so a client's name/phone/wilaya/commune usually never land; and `ProductDetails` is the same component instance across `/products/:id` changes, so whatever was typed for product A is still in the form for product B. | Actions 5.1, 5.4 |
| **F3** | **The home page never reads settings.** `products-section.tsx:24-28` calls `useCatalogProducts({ featured: true })`, which the backend maps to `family.isFeatured` (`catalog.service.ts:397`) — i.e. *products whose family is featured*, not the admin's chosen list. `categories-section.tsx:13-17` reads `Family.isFeatured`. `settings.storefront.featuredProductIds` is written by the admin settings page and read by nobody. | Actions 1.1, 1.2, 3.2, 3.3 |
| **F4** | **`SettingsDto.storefront` is stored as one whole JSON blob per section** (`platform.mapper.ts:57` falls back per *section*, not per field). Adding a required `featuredFamilyIds` to the DTO makes `SettingsResponseSchema.parse` **throw** for any database that already has a `storefront` row written without it. The mapper must merge field-wise. | Action 1.4 |
| **F5** | **Express 5 parses query strings with `querystring`, not `qs`.** `ids[]=a&ids[]=b` would arrive as a key literally named `ids[]`. The new `ids` filter is therefore a **comma-separated string**, validated by regex in the contract — not an array. | Action 1.1 |

### 0.6 Scope note — `ProductOrderModal` survives this set

`components/shared/ProductOrderModal.tsx` has two consumers: `ProductDetails.tsx` (replaced here)
and `pages/cart/Cart.tsx` (replaced in **S16**). **Do not delete it in S15** — S16 deletes it once
the cart stops importing it.

---

## §1 — Contract & backend (land first; everything in §2-§6 compiles against it)

### 1.1 `Apps/contract/src/modules/catalog/catalog.query.ts` — an `ids` filter on the product list

Add to `ProductListQuerySchema`, directly under `search`:

```ts
// S15 — the home page's featured strip asks for exactly the products named in
// settings.storefront.featuredProductIds. Comma-separated, not an array: Express 5 parses query
// strings with `querystring`, so `ids[]=…` would arrive as a key literally called "ids[]".
// The regex validates every element at the boundary, so the service can split blindly without
// risking a Postgres "invalid input syntax for type uuid" 500.
ids: z
  .string()
  .regex(
    /^[0-9a-fA-F-]{36}(,[0-9a-fA-F-]{36})*$/,
    'ids must be a comma-separated list of uuids',
  )
  .optional(),
```

`ProductListQuery` is re-inferred; no other contract file changes.

### 1.2 `Apps/api/src/modules/catalog/catalog.service.ts#listProducts` — honour `ids`, widen `search`

In the `where` object (currently line 390-401):

- Replace the search clause with the same name-or-barcode pair `staffAdminWhere` uses:
  ```ts
  ...(query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { barcode: { startsWith: query.search } },
        ],
      }
    : {}),
  ```
- Add, after it:
  ```ts
  // S15 — settings-driven featured strip. Public list only: staff/admin lists have their own
  // filters and never need it.
  ...(query.ids ? { id: { in: query.ids.split(',') } } : {}),
  ```
- Update the method comment above it to mention both.
- Leave `featured` (`family: { isFeatured: true }`) exactly as it is — it is the documented
  fallback when the settings list is empty (§0.2 R2).

### 1.3 Settings contract — `featuredFamilyIds`

1. `Apps/contract/src/modules/platform/platform.dtos.ts`
   - `SettingsResponseSchema.storefront`: add `featuredFamilyIds: z.array(z.uuid()),`
   - `PublicSettingsResponseSchema.storefront`: add the same field.
   - Update the comment above `PublicSettingsResponseSchema` ("featured products only") to say
     *featured products and families*.
2. `Apps/contract/src/modules/platform/platform.command.ts` — in `StorefrontSettingsInputSchema`:
   ```ts
   // Max 6 — the home page's family strip is a 6-tile grid (S17 builds the picker that enforces
   // it in the UI; this is the server-side bound).
   featuredFamilyIds: z.array(z.uuid()).max(6).optional(),
   ```

### 1.4 `Apps/api/src/modules/platform/platform.mapper.ts#toSettingsDto` — merge storefront field-wise (F4)

Replace the `storefront:` line with:

```ts
// Field-wise, unlike the other three sections: `storefront` gained `featuredFamilyIds` in S15,
// and any row written before that carries only `featuredProductIds` — a whole-section fallback
// would let that stale row through and fail SettingsResponseSchema.parse below.
storefront: {
  ...DEFAULT_SETTINGS.storefront,
  ...((byKey.get('storefront') as Partial<SettingsDto['storefront']> | undefined) ?? {}),
},
```

### 1.5 `Apps/api/prisma/settings-defaults.ts`

```ts
storefront: { featuredProductIds: [] as string[], featuredFamilyIds: [] as string[] },
```

**No Prisma migration.** Settings live in `Setting(key, value)` JSON rows; the schema is untouched.

### 1.6 Compile gate

`npm run build` in `Apps/contract`, then `npx tsc --noEmit` in `Apps/api` and `Apps/web`.
`AdminSettings.tsx` reads `settings.storefront.featuredProductIds` only — the added field is
additive and must not break it.

---

## §2 — Header

### 2.1 New file `Apps/web/src/components/shared/StorefrontSearch.tsx` (R1)

One component, two variants; no page owns search state any more.

```
Props: { variant: "desktop" | "mobile"; onDone?: () => void; autoFocus?: boolean }
```

Behaviour, exactly:

1. Local `input` state; `const q = useDebouncedValue(input, 300)` (`hooks/useDebouncedValue.ts`).
2. `const enabled = q.trim().length >= 2;`
   `const { data, isFetching } = useCatalogProducts({ search: q.trim(), page: 1, limit: 5 }, { enabled });`
   — the `options` argument is added in Action 2.2.
3. Dropdown is open when `input` is focused **and** `input.trim().length >= 2`. Close on
   `Escape`, on click outside (a `mousedown` listener on `document` guarded by a container ref),
   and after any navigation.
4. Rows (`data.items`, ≤ 5), each a `<button role="option">`:
   - left: `product.name` (truncate);
   - right: `formatDZD(product.currentPrice ?? product.guestPrice, language)` — when
     `product.priceHidden || resolved === undefined`, render `t("cart.priceOnRequest")` in muted
     text instead;
   - second line, muted `text-xs`: `` `${product.family.name} · ${product.brand.name}` ``.
   - `onClick` → `addRecentSearch(input.trim())`, **emit the activity beacon** (step 6),
     `navigate(\`/products/${product.id}\`)`, clear input, `onDone?.()`.
5. Footer row: `t("search.seeAllResults")` → `addRecentSearch`, then
   `navigate(\`/products?search=${encodeURIComponent(input.trim())}\`)`, clear, `onDone?.()`.
   `Enter` in the input does the same. `ArrowDown`/`ArrowUp` move a highlighted index across the
   5 rows + the footer row; `Enter` activates the highlighted one.
6. **Activity beacon (registered clients only).** `const { data: session } = useSession();`
   `const sendActivity = useSendClientActivity();` — emit
   `{ type: ClientActivityType.SEARCH, query: input.trim() }` **only on the product-row path**.
   Write this comment verbatim above it:
   ```ts
   // Emitted here only when the user jumps straight to a product — the "see all" / Enter path
   // lands on /products, whose own debounced effect (Products.tsx) already logs the same query.
   // Logging in both places would double-count every header search.
   ```
7. Empty/loading/short states inside the dropdown: `isFetching` → `t("search.loading")`;
   `enabled && items.length === 0` → `t("search.noResults")`; `!enabled` → nothing rendered.
8. Markup: `variant === "desktop"` → `w-full max-w-sm` relative wrapper with the existing
   `Search` icon + `Input` (placeholder `t("header.search")`, `aria-label t("accessibility.search")`);
   `variant === "mobile"` → same input at `w-full`, `autoFocus`, plus a close button
   (`aria-label t("header.closeSearch")`) calling `onDone`.
   Dropdown panel: `absolute left-0 right-0 top-full z-40 mt-1 rounded-lg border border-border
   bg-popover shadow-lg overflow-hidden`. Accessibility: input gets
   `role="combobox" aria-expanded aria-controls="storefront-search-listbox"`, panel
   `role="listbox" id="storefront-search-listbox"`.

### 2.2 `Apps/web/src/hooks/useCatalogProducts.ts` — `options.enabled` on `useCatalogProducts`

Mirror the existing `useStaffProducts` signature (same file, line 34):

```ts
export function useCatalogProducts(query: ProductListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.catalog.products.list(query),
    queryFn: () => catalogService.listProducts(query),
    enabled: options?.enabled,
  });
}
```
Every existing caller omits `options` and keeps today's always-on behaviour
(`enabled: undefined` is "enabled" in TanStack Query). Copy `useStaffProducts`' comment rationale.

### 2.3 `Apps/web/src/components/layout/PublicHeader.tsx` — search, cart, mobile

1. Delete the inline search block (lines 110-123) and the
   `useSearchState` / `submitSearch` / `addRecentSearch` code (lines 43-51); the imports of
   `useSearchState`, `useRecentSearches`, `Input` and `toast` go with them.
2. Desktop: `<div className="hidden flex-1 max-w-sm md:flex"><StorefrontSearch variant="desktop" /></div>`.
3. **Mobile search (issue: "an icon that expands in place of the store name").** Add
   `const [mobileSearchOpen, setMobileSearchOpen] = useState(false);`
   - When `mobileSearchOpen` is true, replace the `<Link to="/"><Logo/></Link>` **and** the
     right-hand icon cluster on `< md` with a full-width
     `<StorefrontSearch variant="mobile" autoFocus onDone={() => setMobileSearchOpen(false)} />`.
     Concretely: wrap the logo in `className={mobileSearchOpen ? "hidden md:flex" : "flex"}` and
     render the mobile search in a `md:hidden flex-1` slot beside it.
   - When false, render a `md:hidden` ghost icon button (`Search`, `aria-label t("header.openSearch")`)
     in the right-hand cluster that sets it true.
   - The burger `Sheet` stays visible in both states.
4. **Cart button** — replace the toast shell (lines 129-138) with:
   ```tsx
   <Button variant="ghost" size="icon" asChild aria-label={t("accessibility.cart")}>
     <Link to="/cart"><ShoppingCart className="h-5 w-5" aria-hidden="true" /></Link>
   </Button>
   ```
   Delete the stale `{/* Cart is a static/disabled shell — cart wiring is deferred to Sub-02 … */}`
   comment and the `opacity-50` class. `/cart` is CLIENT-guarded (`App.tsx`), so a guest is sent to
   `/login` by `RoleGuard` — that is the intended behaviour, no extra branch here.
   Leave the now-unused key `header.cartComingSoon` in `translations.json`.

### 2.4 `PublicHeader.tsx` — real initials for clients (F1)

```ts
const { data: session } = useSession();
const { data: clientMe } = useClientMe({ enabled: session?.type === UserType.CLIENT });
// Session.profile is null for every CLIENT (types/session.ts) — AuthProvider's displayName is
// therefore null on the storefront and the avatar rendered an empty circle. The client's own
// profile is the only source of a name here.
const accountName =
  displayName ?? (clientMe ? `${clientMe.firstName} ${clientMe.lastName}` : null);
const initials = accountName
  ? accountName.split(" ").filter(Boolean).map((s) => s[0]).join("").slice(0, 2).toUpperCase()
  : null;
```
Render `initials` in the circle, falling back to `<UserIcon className="h-4 w-4" />` when null.
Use `accountName ?? t("header.account")` in `DropdownMenuLabel`.
Imports: `useSession` (`@/hooks/useSession`), `useClientMe` (`@/hooks/useClientPortal`),
`UserType` (`@dragon-telecom/contract`).

### 2.5 `Apps/web/src/hooks/use-search.ts` — drop the dead hook

Delete `useSearchState` (its only consumer was the old header). **Keep `useRecentSearches`** — the
new component still calls `addRecentSearch`. Update the file's top comment.

---

## §3 — Home page from settings (F3, R2)

### 3.1 Shared helper — no new file

Both sections need "the ids from settings, else fall back". Keep it local to each section (two
lines each); do **not** add a hook for it.

### 3.2 `Apps/web/src/components/sections/landing/products-section.tsx`

```ts
const { data: publicSettings } = usePublicSettings();           // @/hooks/usePlatform
const featuredIds = publicSettings?.storefront.featuredProductIds ?? [];
// S15 — the admin's explicit pick wins; `featured: true` (products whose *family* is featured)
// stays as the fallback until a pick exists, so the home page is never empty.
const productQuery: ProductListQuery = featuredIds.length
  ? { ids: featuredIds.join(","), page: 1, limit: Math.min(featuredIds.length, 24) }
  : { featured: true, page: 1, limit: 8 };
const { data: productsResult, isLoading, isError, refetch } = useCatalogProducts(productQuery, {
  enabled: publicSettings !== undefined,
});
```
Everything below (`products`, the grid, the search form, the family select) is unchanged.

### 3.3 `Apps/web/src/components/sections/landing/categories-section.tsx`

Replace the single query with one unconditional "all families with counts" query and derive:

```ts
const { data: publicSettings } = usePublicSettings();
const featuredFamilyIds = publicSettings?.storefront.featuredFamilyIds ?? [];
const { data: families, isLoading, isError, refetch } = useCatalogFamilies({ withCount: true });
// S15 — settings first, in the admin's own order; `Family.isFeatured` is the fallback while no
// pick exists (S17 builds the picker). Six tiles either way.
const items = featuredFamilyIds.length
  ? featuredFamilyIds
      .map((id) => (families ?? []).find((f) => f.id === id))
      .filter((f): f is FamilyDto => !!f)
  : (families ?? []).filter((f) => f.isFeatured).slice(0, 6);
```
`FamilyDto` type import from `@dragon-telecom/contract`. The existing loading/error/empty
(`items.length === 0 → return null`) branches stay. Note the query key changes
(`{ withCount: true }` instead of `{ featured: true, limit: 6, withCount: true }`) — the sibling
`products-section.tsx` comment claiming a shared cache hit is now wrong; update it there.

---

## §4 — Catalog page on mobile

### 4.1 `Apps/web/src/components/shared/ProductFilters.tsx:325`

```tsx
<SheetContent side="right" className="w-[85%] max-w-sm overflow-y-auto">
```
(was `w-full … sm:max-w-md`). Matching the header burger's `w-72`, this leaves the product list
visible behind the scrim. Add: `{/* Not w-full: the list must stay partly visible behind the
drawer, like the header's burger menu (S15). */}`

---

## §5 — Product info: inline order section

This is the largest action. The component built here is **reused verbatim by S16**, so keep it
lines-based from the start.

### 5.1 New file `Apps/web/src/components/shared/OrderPlacementSection.tsx`

Replaces `ProductOrderModal`'s form for the product page (and, in S16, for the cart).

```ts
export interface OrderPlacementLine {
  product: ProductWithPricingDto;
  quantity: number;
}
interface Props {
  lines: OrderPlacementLine[];
  /** Disables the submit button (out of stock, price hidden, nothing selected). */
  disabled?: boolean;
  /** Defaults to t("product.orderNow"). */
  submitLabel?: string;
  /** Fired after a successful placement, before the navigation to /order-confirmation. */
  onPlaced?: (order: OrderDto) => void;
  className?: string;
}
```

It owns, in this order:

1. `useSession()` → `isClient = session?.type === UserType.CLIENT`;
   `useClientMe({ enabled: isClient })` → prefill;
   `useWilayas()`; `usePlaceOrder()`; `useTranslation()`; `useNavigate()`.
2. RHF: `useForm<OrderFormValues>({ resolver: zodResolver(orderSchema(t)), defaultValues: { orderType: isClient ? OrderType.PICKUP : OrderType.DELIVERY_HOME, contact: { fullName: "", phone: "" }, delivery: isClient ? undefined : { wilayaId: "", communeId: "" } } })`.
3. **Prefill effect (F2)** — the fix for "prefill leaks between pages":
   ```ts
   // RHF captures defaultValues once, and useClientMe resolves after that first render, so the
   // profile has to be pushed in with reset() when it arrives — and again whenever it changes.
   // Without this the fields stay empty for a signed-in client (and kept whatever the previous
   // product page left in them, since this component is not remounted by a :id change alone).
   useEffect(() => {
     if (!clientMe) return;
     reset((current) => ({
       ...current,
       contact: { fullName: `${clientMe.firstName} ${clientMe.lastName}`, phone: clientMe.phone },
       delivery:
         current.orderType === OrderType.PICKUP
           ? undefined
           : { wilayaId: clientMe.wilayaId, communeId: clientMe.communeId },
     }));
   }, [clientMe, reset]);
   ```
   The caller additionally passes `key` so a different product/cart truly remounts (Action 5.4).
4. Delivery-fee resolution **inside** the component (the parent no longer holds
   `deliveryParams`): watch `delivery.wilayaId` / `delivery.communeId` / `orderType`, then
   `usePlatformDeliveryFee({ wilayaId: isPickup ? "" : (watchedWilayaId ?? ""), communeId: watchedCommuneId })`
   — the hook is already `enabled: !!query.wilayaId`.
5. Fields, in the modal's existing order and with the same translation keys, **minus two**:
   - **no quantity input** — quantity comes from the caller's stepper / cart row;
   - **no address input** — issue: *"remove the optional 'location' field from the UI and send
     null"*. Drop the `product.address` `<Input>` and the `product.location` heading; keep the
     wilaya/commune selects under the `product.deliveryInfo` heading.
   - Order mode radio group: `PICKUP` rendered **only when `isClient`** (unchanged rule).
6. Totals block: `subtotal = Σ line.quantity × (currentPrice ?? guestPrice ?? 0)`,
   `deliveryFee = isPickup ? 0 : (fee?.deliveryHome ?? 0)`, `total = subtotal + deliveryFee`.
   Render one row per line (`name × qty` + line total) so the cart's N lines read correctly,
   then subtotal / delivery fee / grand total — same keys as the modal
   (`product.subtotal`, `product.deliveryFee`, `product.totalPrice`).
7. Submit button: `type="submit"`, `disabled={disabled || placeOrder.isPending}`, label
   `submitLabel ?? t("product.orderNow")`, spinner + `t("common.processing")` while pending.
8. Submit handler:
   ```ts
   const command = toPlaceOrderCommand(values, lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })), isClient ? (session?.clientId ?? null) : null);
   const order = await placeOrder.mutateAsync(command);
   onPlaced?.(order);
   navigate("/order-confirmation", { state: { order } });
   ```
   Error handling, kept from the modal but re-targeted (there is no quantity field to attach to):
   - `INSUFFICIENT_STOCK` → local `setFormError(t("orderSection.insufficientStock"))`, rendered as
     a destructive alert above the button;
   - `GUEST_PRICE_HIDDEN` → `navigate("/login")`;
   - anything else propagates to the global mutation toast.

### 5.2 `Apps/web/src/pages/product-detail/order.schema.ts` — de-couple from a single product

- Remove `productId` and `quantity` from `orderSchema` (both now live outside the form) and drop
  `MAX_ORDER_QUANTITY` from this file — the stepper in `ProductPricingSection` already owns it.
- Remove `address` from the `delivery` object.
- `contact.phone` becomes the shared rule: `phone: phoneField(t)` (Action 5.3).
- New signature:
  ```ts
  export function toPlaceOrderCommand(
    values: OrderFormValues,
    lines: { productId: string; quantity: number }[],
    clientId: string | null,
  ): PlaceOrderCommand
  ```
  Body unchanged otherwise (`lines`, `orderType`, `contact`, conditional `delivery`).
- Update the file header comment: the quantity ceiling and the 409 note now belong to the stepper
  and to `OrderPlacementSection` respectively.

### 5.3 New file `Apps/web/src/lib/validation/phone.schema.ts` (R3)

```ts
import { z } from "zod";
import type { useTranslation } from "@/hooks/useTranslation";

// One phone rule for the whole storefront (S15/R3): registration and order placement must agree,
// and the register form had no format rule at all before this. Accepts an optional +213 / 00213
// prefix, an optional leading 0, then 9 digits; spaces, dots and dashes anywhere are ignored.
const DZ_PHONE = /^(?:(?:\+|00)213|0)\s?[1-9](?:[\s.-]?\d){8}$/;

export function phoneField(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .string()
    .min(1, t("register.phoneRequired"))
    .refine((v) => DZ_PHONE.test(v.replace(/[\s.-]/g, "")), t("common.validation.invalidPhone"));
}
```
`common.validation.invalidPhone` already exists in `translations.json`.
Use it in `pages/register/register.schema.ts` (`phone: phoneField(t)`) — the
`_RegisterClientCommandCheck` assertion still holds (output type is `string`).

### 5.4 `Apps/web/src/components/sections/product-details/ProductPricingSection.tsx`

- Drop the `onOrderNow` prop and its handler.
- Between the quantity stepper block and the action-button block, render:
  ```tsx
  <Separator />
  <OrderPlacementSection
    key={product.id}
    lines={[{ product, quantity }]}
    disabled={orderDisabled}
    className="pt-2"
  />
  ```
  `key={product.id}` is the second half of the F2 fix: navigating between two product pages keeps
  the same `ProductDetails` instance mounted, so only a changed key discards the previous form.
- Delete the old `Order Now` `<Button>` (the section owns the submit button now) but keep the
  out-of-stock branch: when `!product.inStock`, render the disabled `t("products.outStock")`
  button and **do not** render the section at all.
- `ProductDetailDto` is assignable to `ProductWithPricingDto`, so `lines` type-checks with no cast.

### 5.5 `Apps/web/src/pages/ProductDetails.tsx`

Delete: `isOrderModalOpen`, `deliveryParams`, `quantity`, `handleOrderNow`,
`handleOrderModalClose`, `handleOrderSubmit`, `prefill`, `useWilayas`,
`usePlatformDeliveryFee`, `useClientMe`, `usePlaceOrder`, `toPlaceOrderCommand`,
`OrderFormValues`, `DeliveryParams`, `ProductOrderModal` — all of it now lives inside
`OrderPlacementSection`. `<ProductPricingSection product={product} />` loses `onOrderNow`.
Keep: the `useSession`/`isClient` line (still used by the PRODUCT_VIEW beacon) and the beacon
effect. Update the stale comments at lines 53-58 and 86-92 that describe the modal flow.

### 5.6 `Apps/web/src/pages/order-confirmation/components/OrderConfirmationBody.tsx`

After the reference row and before the first `<Separator/>`, add two rows using the existing
keys `product.fullName` and `product.phone`:

```tsx
<div className="mt-2 flex justify-between text-sm">
  <span className="text-muted-foreground">{t("product.fullName")}</span>
  <span className="font-medium">{order.contactName}</span>
</div>
<div className="mt-1 flex justify-between text-sm">
  <span className="text-muted-foreground">{t("product.phone")}</span>
  <span className="font-medium">{order.contactPhone}</span>
</div>
```

---

## §6 — My orders (D4 / D11)

### 6.1 Verify only — no code

Re-read §0.4 before touching this page.

### 6.2 `Apps/web/src/components/shared/OrderCard.tsx` — the order's *current* price (D11)

The card shows only `productName × quantity`. D11 says the client's order page shows the order's
**current** price, which is `line.unitPrice` (rewritten at `PACKAGED` for delivery orders /
`COMPLETED` for pickup — `orders.service.ts:516-560`), never the frozen `line.resolvedPrice`.

In the expandable details, add a lines block above the delivery information:

```tsx
<div>
  <h4 className="font-medium mb-2">{t("orders.items")}</h4>
  <div className="space-y-1">
    {order.lines.map((line) => (
      <div key={line.id} className="flex justify-between text-sm">
        <span className="text-muted-foreground">{line.productName} × {line.quantity}</span>
        <span>{formatDZD(line.unitPrice)} · {formatDZD(line.lineTotal)}</span>
      </div>
    ))}
  </div>
</div>
```
`orders.items` already exists. Comment it:
`{/* D11 — unitPrice, the order's current charged price (resolvedPrice is what the catalog showed at placement and never changes). */}`

---

## §7 — Login / Register shell

### 7.1 `Apps/web/src/App.tsx`

Nest the two pages inside the public shell, keeping the guard outermost:

```tsx
{
  element: <PublicOnlyRoute />,
  children: [
    {
      element: <PublicLayout />,
      children: [
        { path: "/login", element: withSuspense(LoginPage), errorElement: <RouteErrorBoundary /> },
        { path: "/register", element: withSuspense(Register), errorElement: <RouteErrorBoundary /> },
      ],
    },
  ],
}
```
The two bespoke `errorElement` wrappers (the `min-h-screen` centred boxes) collapse to the plain
`<RouteErrorBoundary />` used everywhere else, since the shell now provides the page frame.
`PublicLayout`'s `children` prop stays unused — leave its comment accurate.

### 7.2 `Apps/web/src/pages/LoginPage.tsx`

- Outer wrapper `min-h-screen` → `relative overflow-hidden py-12` (the layout owns the viewport
  height); inner `flex min-h-screen items-center justify-center px-4` → `flex items-center justify-center px-4`.
- Delete the absolutely-positioned `LanguageToggle`/`ThemeToggle` block (lines 61-64) and their
  imports — `PublicHeader` renders both.
- Keep the `[background:var(--login-glow)]` layer, the logo block and the shake animation.

### 7.3 `Apps/web/src/pages/Register.tsx`

Already a plain `<div><main className="container …">` — no change needed beyond confirming the
header/footer render around it. Do not re-style the card.

---

## §8 — Translation keys

Add to `Apps/web/src/config/translations.json` (flat keys, `{en, fr, ar}`; `ar` stays `""`, per
every key added in S13/S14).

| Key | en | fr |
|---|---|---|
| `search.loading` | Searching… | Recherche… |
| `header.openSearch` | Open search | Ouvrir la recherche |
| `header.closeSearch` | Close search | Fermer la recherche |
| `orderSection.title` | Order information | Informations de commande |
| `orderSection.insufficientStock` | Not enough stock for this order | Stock insuffisant pour cette commande |

Reused as-is (do **not** re-add): `header.search`, `accessibility.search`, `accessibility.cart`,
`header.account`, `search.noResults`, `search.seeAllResults`, `cart.priceOnRequest`,
`common.validation.invalidPhone`, `register.phoneRequired`, `product.fullName`, `product.phone`,
`product.orderNow`, `product.subtotal`, `product.deliveryFee`, `product.totalPrice`,
`product.deliveryInfo`, `orders.items`, `common.processing`, `products.outStock`.

Now-orphaned but **left in place**: `header.cartComingSoon`, `product.address`,
`product.addressPlaceholder`, `product.location`.

---

## §9 — Order of execution

1. §1 (contract + backend + settings) → build contract, `tsc --noEmit` both apps.
2. §2 (header) — needs 2.2 before 2.1 compiles.
3. §3 (home) — needs 1.1/1.3 and 2.2.
4. §4 (mobile drawer) — independent.
5. §5 (order section) — 5.3 → 5.2 → 5.1 → 5.4 → 5.5 → 5.6.
6. §6, §7, §8.
7. Gates: `npx tsc --noEmit` (api, web, contract) and `npm run lint`. **No test file is read,
   written or run.**

---

## §10 — Manual verification checklist (browser)

**Header**
1. Type `iph` (or any 3 letters of a real product) in the desktop header search → a dropdown of
   at most 5 rows appears, each with name, price on the right, `family · brand` underneath.
2. Click a row → lands on that product's page. Click the header search again → dropdown re-opens
   clean (no stale text).
3. Type a term and press `Enter` → `/products?search=…` with the grid filtered; the page's own
   search box shows the same term.
4. Type a full **barcode** → the product appears in the dropdown (S1's index path).
5. As a signed-in client, click a dropdown row, then open **Admin → Clients → that client →
   Browsing history**: exactly **one** SEARCH row for that query — not two.
6. Click the cart icon: as a client → `/cart`; as a guest → `/login`.
7. Signed in as a client, the avatar shows the client's initials (not an empty blue circle) and
   the dropdown header shows their full name.
8. Narrow the window to phone width → the store logo is replaced by a search icon; tapping it
   expands the field in place, and the dropdown works there too; the close button restores the logo.

**Home**
9. Admin → Settings → Storefront → pick 2-3 featured products, save. Reload `/` → the featured
   strip shows exactly those products, in that order.
10. Clear the featured list → the strip falls back to the family-featured products (never empty).
11. Families strip still renders 6 tiles (fallback path — the picker arrives in S17).

**Catalog**
12. On phone width, open the Filters drawer on `/products` → the product list is still partly
    visible on the left behind the drawer.

**Product info**
13. Open a product as a **guest**: the order fields are inline between the quantity stepper and
    the Order button — full name, phone, delivery home/office (no pickup), wilaya, commune. There
    is **no** address/location field and **no** second quantity input.
14. Enter `12345` as the phone → format error. Enter `0555 12 34 56` → accepted.
15. Change the quantity with the stepper → the section's subtotal and total follow it.
16. Place the order → confirmation page shows the reference, **full name and phone**, lines,
    delivery fee and total.
17. Sign in as a client, open a product: name, phone, wilaya and commune are **prefilled**; pickup
    is offered. Edit the phone, navigate to another product via the related strip → the second
    product's form is back to the profile values, not the edited ones.
18. Order a quantity above stock → an inline "not enough stock" message, no crash.

**My orders**
19. `/orders` chips include *Cancelled by client* with a count; a non-completed order shows Cancel
    and cancelling moves it to that chip.
20. Expand an order that was repriced at `PACKAGED` → the line shows the **new** unit price and
    the totals match the admin order page.

**Login / Register**
21. `/login` and `/register` render the storefront header and footer; the theme and language
    toggles work from the header (no duplicate pair in the corner); the logo links home.
