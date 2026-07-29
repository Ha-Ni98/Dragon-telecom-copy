# Report — Set 15: Public storefront

Executed against `Docs/Stage-04-Fixes/plans/plan-S15-public-storefront.md` on `stage-04-fix`,
2026-07-28. Header search/cart/account, home page from settings, mobile catalog filter drawer, an
inline product-order section, my-orders' D11 price display, and the login/register shell.

## Owner decisions carried into execution

- **R1 (header typeahead)** — implemented exactly as specified: ≤5 product rows (name, resolved
  price, `family · brand`), trailing "see all results" row, product row → `/products/:id`, registered
  client's search recorded once (product-row path only — the "see all"/Enter path lands on
  `/products`, whose own debounced effect logs the same query).
- **R2 (featuredFamilyIds now)** — added to the settings contract/defaults/public DTO; home falls
  back to `Family.isFeatured` while the list is empty. S17 still owns the admin picker.
- **R3 (shared phone rule)** — `lib/validation/phone.schema.ts`'s `phoneField(t)` is now used by
  both `register.schema.ts` and `order.schema.ts`.

## What changed

### Contract (`Apps/contract`)
- `catalog.query.ts`: `ProductListQuerySchema` gained `ids` (comma-separated uuid list, regex-
  validated — Express 5 parses query strings with `querystring`, not `qs`, so an array param
  wasn't an option).
- `platform.dtos.ts`: `SettingsResponseSchema.storefront` and `PublicSettingsResponseSchema.storefront`
  both gained `featuredFamilyIds: z.array(z.uuid())`.
- `platform.command.ts`: `StorefrontSettingsInputSchema` gained `featuredFamilyIds` (`.max(6)`).

### Backend (`Apps/api`)
- `catalog.service.ts#listProducts` (public storefront): search widened to name-or-barcode (same
  pair `staffAdminWhere` already used for staff/admin); added an `ids`-in filter for the
  settings-driven featured strip.
- `platform.mapper.ts#toSettingsDto`: `storefront` now merges **field-wise** over
  `DEFAULT_SETTINGS.storefront` instead of falling back whole-section — a pre-existing `storefront`
  row written before this set carries only `featuredProductIds`, and a whole-section fallback
  would have let that stale shape through and failed `SettingsResponseSchema.parse`.
- `prisma/settings-defaults.ts`: `storefront.featuredFamilyIds: []`.
- No Prisma migration — settings are `Setting(key, value)` JSON rows, schema untouched.

### Frontend (`Apps/web`)
- **New `components/shared/StorefrontSearch.tsx`** — the typeahead (R1). `desktop`/`mobile`
  variants, keyboard nav (Escape/↑/↓/Enter), outside-click close, `useCatalogProducts` gated by a
  new `options.enabled` (added to that hook, mirroring `useStaffProducts`' existing precedent).
- **`components/layout/PublicHeader.tsx`** rewritten:
  - search delegated to `StorefrontSearch`; the old `useSearchState`/inline `Input` are gone.
  - mobile: a search icon expands `StorefrontSearch` in place of the logo (issue: "an icon that
    expands in place of the store name"); burger stays visible throughout.
  - cart button now links to `/cart` (was a disabled toast shell); `RoleGuard` sends a guest to
    `/login` automatically.
  - account avatar reads real initials: `useClientMe` supplies the name `Session.profile` can
    never carry for a CLIENT (`types/session.ts` — `profile` is always `null` for clients), which
    was the actual cause of the blank circle, not the initials logic itself.
- **`hooks/use-search.ts`**: `useSearchState` deleted (dead — its only consumer was the old
  header); `useRecentSearches` kept, now consumed by `StorefrontSearch`.
- **Home page** (F3 — it never read settings at all before this):
  - `components/sections/landing/products-section.tsx`: reads `usePublicSettings()`, queries by
    `ids` when `featuredProductIds` is non-empty, falls back to `featured: true` otherwise.
  - `components/sections/landing/categories-section.tsx`: reads `featuredFamilyIds`, resolves
    against an unconditional `{ withCount: true }` families query, falls back to
    `Family.isFeatured` (max 6) while the list is empty.
- **`components/shared/ProductFilters.tsx`**: mobile filter `Sheet` narrowed from `w-full` to
  `w-[85%] max-w-sm` so the product list stays visible behind it (matches the header burger's
  `w-72` pattern).
- **New `components/shared/OrderPlacementSection.tsx`** — the inline order form (replaces
  `ProductOrderModal`'s dialog), generalised from one product to a caller-supplied `lines` array
  so S16 could reuse it verbatim for the cart. Owns contact/delivery-mode/wilaya-commune/fee/
  submit; fixes the prefill bug (F2) with a `reset()` effect that re-applies `useClientMe`'s data
  whenever it resolves (RHF's `defaultValues` are captured once, and the profile query resolves
  after that first render) — paired with a `key={product.id}` on the caller so navigating between
  two product pages actually remounts the form instead of carrying over edited fields.
- **New `lib/validation/phone.schema.ts`** — `phoneField(t)`, an Algerian-number regex (optional
  `+213`/`00213`/leading `0`, 9 digits), shared by register and order forms (R3).
- **`pages/product-detail/order.schema.ts`**: `productId`/`quantity` removed from the form schema
  (now caller-supplied); `delivery.address` removed (issue: "remove the optional location field
  … and send null" — implemented as omitting the key entirely, the `.optional()`-compatible
  equivalent since the contract field isn't `.nullable()`); `toPlaceOrderCommand` now takes a
  `lines` array.
- **`pages/register/register.schema.ts`**: `phone` now uses the shared `phoneField(t)` (previously
  `z.string().min(1)` with no format check at all).
- **`components/sections/product-details/ProductPricingSection.tsx`**: `onOrderNow` prop and the
  standalone Order button are gone; renders `OrderPlacementSection` inline (keyed on `product.id`)
  between the stepper and the product-info block, or the disabled out-of-stock button.
- **`pages/ProductDetails.tsx`**: all order-modal state/handlers removed (now owned by
  `OrderPlacementSection`); the product-view beacon effect is untouched.
- **`pages/order-confirmation/components/OrderConfirmationBody.tsx`**: adds full name and phone
  rows below the reference.
- **`components/shared/OrderCard.tsx`** (D11): expanded details now show a per-line block with
  `unitPrice` (the order's current charged price) and `lineTotal` — `resolvedPrice` (frozen at
  placement) was the only figure shown before.
- **Login/Register shell**: `App.tsx` nests `/login` and `/register` inside `PublicLayout` (under
  `PublicOnlyRoute`), so both render the storefront header/footer; the two bespoke `errorElement`
  wrappers collapsed to the shared `<RouteErrorBoundary />`. `LoginPage.tsx` dropped its own
  `LanguageToggle`/`ThemeToggle` pair and its `min-h-screen` wrapper (the layout now owns viewport
  height). `Register.tsx` needed no change — it was already shell-agnostic.
- **`translations.json`**: added `search.loading`, `header.openSearch`, `header.closeSearch`,
  `orderSection.title`, `orderSection.insufficientStock`.

### Verified, not re-implemented (§0.4 of the plan)
- My-orders' cancelled-by-client stat chip and "cancel any order except a completed one" were
  already live from S9/S10/S11 — confirmed in code, untouched.

## Deviations / notes for the owner

- `OrderPlacementSection`'s stock-conflict error surfaces via a form-level RHF `root` error (no
  quantity field to attach it to anymore, since quantity is caller-owned) rather than a field
  error — same user-visible text (`orderSection.insufficientStock`), different RHF mechanism than
  the old modal used.
- Orphaned translation keys left in place per the no-cleanup norm: `header.cartComingSoon`,
  `product.address`, `product.addressPlaceholder`, `product.location`, `product.quantityMin`,
  `product.quantityExceedsStock` (the last two were only ever read by the old modal, deleted in
  S16 — see that report).

## Gates

- `Apps/contract`: `npm run check` (`tsc --noEmit`) — clean.
- `Apps/api`: `npx tsc --noEmit` — clean on `src/**`. Pre-existing failures remain in `test/**`
  (orders/repairs/sales specs already stale before this set — untouched, per the "never touch the
  test folder" rule).
- `Apps/web`: `npx tsc --noEmit` — clean (verified together with S16, since S15 and S16 share
  `OrderPlacementSection`/`order.schema.ts` and the intermediate state between them doesn't
  compile on its own — `ProductOrderModal.tsx` isn't deleted until S16).
- `Apps/web`: `eslint` on every touched/created file — clean (auto-fixable prettier formatting
  applied via `eslint --fix`, no logic changes).
- No test file was read, edited, or run.

## Manual verification checklist (browser)

**Header**
1. Type 3+ letters of a real product name in the desktop header search → a dropdown of ≤5 rows
   appears: name, price on the right, `family · brand` underneath.
2. Click a row → lands on that product's page; reopening the search shows a clean, empty field.
3. Type a term and press Enter → `/products?search=…`, grid filtered, filter box shows the term.
4. Type a full barcode → the product appears in the dropdown.
5. As a signed-in client, click a dropdown row, then check Admin → Clients → that client →
   Browsing history: exactly **one** SEARCH row for that query, not two.
6. Click the cart icon: client → `/cart`; guest → `/login`.
7. Signed in as a client, the avatar shows real initials (not a blank blue circle); the dropdown
   header shows the client's full name.
8. Narrow to phone width → the logo is replaced by a search icon; tapping it expands the field in
   place (dropdown still works); the close button restores the logo.

**Home**
9. Admin → Settings → Storefront → pick 2-3 featured products, save → reload `/` → the featured
   strip shows exactly those products, in that order.
10. Clear the featured list → falls back to family-featured products (never empty).
11. Families strip still renders 6 tiles (fallback path — the picker itself is S17).

**Catalog**
12. On phone width, open the Filters drawer on `/products` → the product list stays partly visible
    behind it.

**Product info**
13. Open a product as a guest: order fields are inline between the stepper and the Order button —
    full name, phone, delivery home/office (no pickup), wilaya, commune. No address/location
    field, no second quantity input.
14. Enter `12345` as the phone → format error. Enter `0555 12 34 56` → accepted.
15. Change the quantity stepper → the section's subtotal and total follow it.
16. Place the order → confirmation shows reference, full name, phone, lines, delivery fee, total.
17. Sign in as a client, open a product: name/phone/wilaya/commune are prefilled; pickup is
    offered. Edit the phone, then navigate to another product via the related strip → the second
    product's form shows the profile values again, not the edited ones.
18. Order a quantity above stock → an inline "not enough stock" message, no crash.

**My orders**
19. `/orders` chips include *Cancelled by client* with a count; a non-completed order shows Cancel
    and cancelling moves it there.
20. Expand an order that was repriced at `PACKAGED` → the line shows the **new** unit price,
    matching the admin order page.

**Login / Register**
21. `/login` and `/register` render the storefront header and footer; theme/language toggles work
    from the header (no duplicate pair in the corner); the logo links home.
