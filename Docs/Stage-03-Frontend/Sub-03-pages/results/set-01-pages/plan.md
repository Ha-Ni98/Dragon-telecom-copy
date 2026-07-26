# Sub-03 · Page Assembly Plan — Public Pages Set

> **Scope:** PUB-01 Home, PUB-02 Catalog, PUB-03 Product Detail, PUB-06 Login, PUB-07 Register,
> PUB-08 My Account, PUB-11 Not Found.
> **Nature:** audit/plan only — **zero code**. This document maps each page's requirements onto the
> **real Sub-02 Integration Engine hooks** (contract-typed, `qk` query keys), lists Skeletons + local
> error fallbacks, forms/Zod schemas, and the unit-test strategy.

> **Source of truth (ruling):** only `Apps/contract`, `Apps/api` (the backend), and the
> `Docs/Stage-00-Conception/Pages-Requirements/PUB-*.md` files are authoritative. `Apps/web` is a mix of
> MVP + template scaffolding and is **not** a source of truth — where existing web code (routes,
> "Decision #N" comments, view models) conflicts with the requirements/contract, **the requirement wins
> and the web code changes.** This is why D1 (`:id` route), D4 (`/staff`), and D5 (client guard) rewrite
> existing `App.tsx` routing without treating it as a constraint.

> **Template note:** the phase file cites `Apps/web/src/pages/admin/delivery-companies/` as the worked
> example. **That directory no longer exists** (delivery-companies was removed in Sub-01 Sprint 1 — see
> memory `stage-03-sprint1-complete`). Use `Apps/web/src/pages/admin/clients/AdminClients.tsx` +
> its `components/*` (real hooks, granular states, RHF+Zod dialogs, `vi.mock()` unit tests) as the
> live worked example instead.

---

## 0. The core theme of this set: **rewire, don't rebuild**

All seven pages **already exist** as Sub-01 scaffolding (`src/pages/Index.tsx`, `Products.tsx`,
`ProductDetails.tsx`, `LoginPage.tsx`, `Register.tsx`, `MyAccount.tsx`, and the `*` catch-all).
They are wired to **Sub-01 stub hooks** that return typed-empty defaults and to **numeric-id draft
view models** (`@/types/draft-types/*` — `idBrand`, `idFamily`, `clientFirstName`, …).

Assembly means three mechanical moves, repeated per page:

1. **Swap the hook import** from the kebab-case stub (`use-products`, `use-my-account`,
   `use-registration`, `use-wilaya`, `use-product-details`, `use-product-order`, `use-brands`,
   `use-models`, `use-delivery-fees`) to the **camelCase real hook** (`useCatalog*`, `useClient*`,
   `useWilayas`, `usePlatformDeliveryFee`, `usePlaceOrder`, …).
2. **Retype the props/state** from draft view models (numeric ids) to **contract DTOs**
   (uuid `string` ids: `ProductWithPricingDto`, `ProductDetailDto`, `FamilyDto`, `BrandDto`,
   `DeviceModelDto`, `ClientMeDto`, `WilayaDto`, …). This is the bulk of the work — the shared
   presentational components are all still typed on the draft models (see §D9).
3. **Delete the page-local `useEffect` fetch/derive logic** (the stubs did in-memory filtering,
   `useState` mirrors of fetched data, `document.title` SEO effects) and let TanStack + the URL be
   the single source of truth.

Do **not** delete the stub hook/service files outright (memory `stage-03-sub-02-complete`): out-of-set
pages (e.g. PUB-05 Orders) and admin pages still consume some. Flag orphaned stubs for a later cleanup
sprint once their last consumer is rewired.

---

## 1. Hook inventory (real Sub-02 hooks this set consumes)

| Requirement name (PUB doc) | **Real hook** | File | Query key / mutation target |
|---|---|---|---|
| `useFeaturedFamilies()` | `useCatalogFamilies({ featured, limit, withCount })` | `useCatalogTaxonomy.ts` | `qk.catalog.families.list(query)` → `GET /families` |
| `useBrands()` | `useCatalogBrands()` | `useCatalogTaxonomy.ts` | `qk.catalog.brands.list(false)` → `GET /brands` |
| `useModels(brandId)` | `useCatalogModels({ brandId })` | `useCatalogTaxonomy.ts` | `qk.catalog.models.list(query)` → `GET /models` |
| `useFeaturedProducts()` | `useCatalogProducts({ featured: true, limit: 8 })` | `useCatalogProducts.ts` | `qk.catalog.products.list(query)` |
| `useProducts(filters)` | `useCatalogProducts(filters)` | `useCatalogProducts.ts` | `qk.catalog.products.list(query)` → `GET /products` |
| `useProduct(id)` | `useCatalogProduct(id)` | `useCatalogProducts.ts` | `qk.catalog.products.detail(id)` → `GET /products/:id` |
| `useWilayas()` | `useWilayas()` | `usePlatform.ts` | `qk.platform.wilayas()` (staleTime 30 min) |
| `useDeliveryFee(wilayaId, communeId)` | `usePlatformDeliveryFee({ wilayaId, communeId })` | `usePlatform.ts` | `qk.platform.fee(query)` — `enabled: !!query.wilayaId` |
| `usePlaceOrder()` | `usePlaceOrder()` | `useOrdersPortal.ts` | mutates `POST /orders`, invalidates `qk.orders.all()` |
| `useToggleCart()` | `useAddToCart()` + `useRemoveFromCart()` (+ `useClientCart()`) | `useClientPortal.ts` | mutate `POST/DELETE /clients/me/cart`, invalidate `qk.clients.cart()` |
| `useLogin()` | `useAuth().login` (wraps `useLogin`) | `AuthProvider.tsx` / `useLogin.ts` | mutates `POST /auth/login`, invalidates `qk.auth.session()` |
| `useMyPermissions()` | `usePermissions()` | `usePermissions.ts` | `qk.auth.permissions()` → `GET /identity/me/permissions` |
| `useValidatePhone()` | `useValidatePhone()` | `useClientPortal.ts` | mutates `POST /clients/validate-phone` |
| `useRegister()` | `useRegisterClient()` | `useClientPortal.ts` | mutates `POST /clients/register` → returns `{ id }` |
| `useMe()` | `useClientMe()` | `useClientPortal.ts` | `qk.clients.me()` → `GET /clients/me` |
| `useUpdateMe()` | `useUpdateClientMe()` | `useClientPortal.ts` | mutates `PATCH /clients/me`, invalidates `qk.clients.me()` |
| `useChangePassword()` | `useChangeClientPassword()` | `useClientPortal.ts` | mutates `POST /clients/me/password` (no invalidation) |
| `useClientActivityBeacon()` | `useSendClientActivity()` | `useObservability.ts` | fire-and-forget `POST` (`meta.silentErrorToast`) |
| session guard | `useSession()` / `useAuth()` | `useSession.ts` / `AuthProvider.tsx` | `qk.auth.session()` (JWT-derived, no `/me` endpoint) |

**Result: every data dependency in this set maps to an existing hook. No new hook needs to be written**
(two engine-level *gaps* still exist — idempotency key and related-product hydration — see §D6/§D7).

---

## 2. Deviations & gaps to resolve first

Ordered by how much they change the plan. Items marked **[CONFIRM]** are the only ones I'd want a
decision on; the rest are resolved toward the authoritative requirements/rules and merely noted.

- **D1 — Product-detail route `:productName` → `:id`.** PUB-03 is explicit: *"by id — never by name."*
  Current `App.tsx` routes `/products/:productName` with a `// Decision #3: keep the MVP slug` note and
  resolves via `useProductDetails(name)` + `kebabCaseToProductName`. The Stage-00 requirement is
  authoritative → switch the route param to `:id`, consume `useCatalogProduct(id)`, and retire
  `use-product-details.ts`, `use-product-order.ts`, and `kebabCaseToProductName`. Update every
  `<Link to={/products/:id}>` producer (Home cards, Catalog cards, Related strip).

- **D2 — `useToggleCart` does not exist.** The cart is *favorites* (no quantity). Compose the toggle in
  the card: read `ProductWithPricingDto.inCart`; heart click calls `useRemoveFromCart(productId)` when
  `inCart`, else `useAddToCart({ productId })`. Both invalidate `qk.clients.cart()` and the product
  lists refresh their `inCart` on the next fetch. Heart is **client-only** (hidden for guests/staff/admin
  — gate on `useSession().type === CLIENT`).

- **D3 — `useFeatured*` names.** Featured is a **query flag**, not a dedicated hook:
  `useCatalogFamilies({ featured: true, limit: 6, withCount: true })` and
  `useCatalogProducts({ featured: true, limit: 8 })`. (`ProductListQuerySchema.featured` and
  `FamiliesQuerySchema.featured/withCount` confirmed in `catalog.query.ts`.)

- **D4 — Login redirect + new `/staff` surface (resolved).** PUB-06 is authoritative: admin → `/admin`,
  **staff → `/staff` (first permitted page from `usePermissions()`)**, client → back-target
  (`location.state.from`) or `/`. The MVP has no `/staff` route and sends non-admins to `/` (so STAFF
  wrongly lands on the public home); per the source-of-truth ruling the requirement wins → **add the
  `/staff` route** as a thin landing (guarded `RoleGuard allow={[STAFF, ADMIN]}`) that reads
  `usePermissions()` and `<Navigate replace>`s to the first permitted page via a `PageKey → route` map
  (keys from `identity.enums.ts`: `STAFF_POS`, `STAFF_PRODUCTS`, `STAFF_ORDERS`, …). Refine
  `PublicOnlyRoute` + the login redirect to route ADMIN→`/admin`, STAFF→`/staff`, CLIENT→back-target/`/`.
  The concrete staff destination pages are a **separate page set** (scope confinement — this set plans
  only the `/staff` redirect + landing, not those pages; until they exist the landing may render a minimal
  "no permitted pages yet" state).

- **D5 — My Account guard must be CLIENT-scoped.** PUB-08 = *"Clients only — ProtectedRoute(client)."*
  Today `/my-account` sits under the **any-authenticated** `ProtectedRoute`, so staff/admin can reach it.
  Change to a client-scoped guard (`RoleGuard allow={[CLIENT]}`, or extend `ProtectedRoute` to accept an
  allowed `UserType`). Also: PUB-07/PUB-08 want authenticated **clients** redirected to `/my-account`
  (PUB-07's current `useEffect(navigate)` becomes declarative via the guard).

- **D6 — placeOrder idempotency key (engine gap).** PUB-03 requires *"POST /api/orders with an
  idempotency key."* `orders.service.ts::placeOrder` currently posts the body with **no
  `Idempotency-Key` header**. Resolve first in the **service/hook layer** (add a client-generated
  `crypto.randomUUID()` key header per submit attempt) — out of the strict "page-only" scope, so flag it
  as a Sub-02 follow-up the page depends on.

- **D7 — Related products expose ids only (engine gap).** `ProductDetailDto.relatedIds: string[]` — there
  is **no batch product-by-ids endpoint**. Interim: hydrate a **bounded** strip (cap ≈4) via per-id
  `useCatalogProduct(id)` queries (each cached under `qk.catalog.products.detail(id)`), OR defer the strip.
  Cleaner fix is upstream: have the detail endpoint return related **summaries**, not ids — flag as a
  Stage-01 contract note (rules §2: a missing DTO is an upstream gap, not a local patch).

- **D8 — Wilaya source.** Replace the static `WilayaProvider` (name-based options, ~480 KB JSON, prior
  crash — memory `stage-03-sprint3-complete`) with the **server** `useWilayas()` → `WilayaDto[]` whose
  rows carry **nested `communes`**. Cascading commune reads `wilaya.communes` from the selected
  `WilayaDto` (no separate communes fetch). Register + Order forms now submit **uuid** `wilayaId` /
  `communeId`, not names.

- **D9 — Shared presentational components are draft-typed.** `ProductCard`, `ProductGrid`,
  `ProductFilters`, `ProductOrderModal`, `ProductPricingSection`, `ProductImageGallery`, `MoneyStatusCard`,
  `RegistrationConfirmationDialog`, `DeliveryForm` all take Sub-01 view models (`ProductWithDetails`,
  `ProductDetails`, `Brand/Family/Model`, `Client`, numeric `productId`, `balance/paid/credit`). Retype
  their prop interfaces to the contract DTOs (uuid string ids). This is a shared prerequisite touched by
  PUB-01/02/03/08 — sequence it early.

- **D10 — The one sanctioned `useEffect`.** Rules §3 forbid `useEffect` *for fetching*. The
  activity-duration beacons (`CATALOG_SESSION` on Catalog unmount, `PRODUCT_VIEW` on Detail unmount) are
  **fire-and-forget telemetry mutations**, not fetches → an unmount-cleanup `useEffect` that calls
  `useSendClientActivity().mutate(...)` is allowed and is the intended pattern. Gate on
  `useSession().type === CLIENT`.

---

## PUB-01 — Home (`/`)

### 1. Hook & Data Mapping
- `useCatalogFamilies({ featured: true, limit: 6, withCount: true })` → 6 family cards (name, `iconUrl`, `productCount`).
- `useCatalogBrands()` → brand-logo carousel (`BrandDto.logoUrl`, `name`).
- `useCatalogProducts({ featured: true, limit: 8 })` → featured `ProductGrid` (8 `ProductWithPricingDto`).
- Cart heart (client-only): `useAddToCart` / `useRemoveFromCart` keyed on `product.inCart` (D2).
- `useSession()` (via `useAuth`) → decides heart visibility.
- **Scope confinement:** Hero CTAs, category→`/products?familyId=`, brand→`/products?brandId=`,
  card→`/products/:id`, search submit→`/products?search=` are **`<Link>`/navigate only** — the Catalog
  page owns the query. Footer contact/socials stay **front-end static** (types file, no API).

### 2. UI Components
- **Reuse:** `sections/landing/{hero,categories,brands,products}-section.tsx` (already lazy-loaded in
  `Index.tsx`), `ProductGrid`, `ProductCard` (retype per D9), `ErrorBoundary`, `Skeleton`, `carousel` (ui).
- **New:** none — only rewire the three section components off stubs onto the real hooks.

### 3. Granular States (per-section, independent)
- Each section keeps its **own** `<ErrorBoundary>` + `<Suspense>` (already in `Index.tsx`) so one failing
  section never blanks the others or the `PublicLayout`.
- `isLoading` → `Skeleton` matching each shape: 6 family-card skeletons, a brand-logo strip skeleton,
  an 8-tile `ProductGrid` skeleton (`showSkeletons`).
- `isError` → local `<NotFoundState>`/inline retry **inside** the section band.
- **Empty** → the section **hides itself** (return `null` when `data.length === 0`), per PUB-01.

### 4. Forms & Mutations
- No forms (search input navigates only). Mutations: cart toggle (D2).

### 5. Optimization
- Sections already `React.lazy()` + `Suspense` — keep. No `useMemo` needed (server returns final lists).

### 6. Unit-Test Strategy — `/tests/unit/pages/home/`
- `home.spec.tsx` (or per-section specs): `vi.mock()` `useCatalogFamilies`, `useCatalogBrands`,
  `useCatalogProducts`. Assert: loading → skeletons present; error → local fallback, siblings still
  render; empty → section absent; success → correct card count + `<Link>` hrefs
  (`/products?familyId=…`, `/products/:id`). Heart hidden when session mock = guest.

### 7. Acceptance Criteria
Sections load independently from the real endpoints; failures/empties are localized; every card/CTA links
to the right target; hearts appear only for clients and toggle the server cart; footer is static.

---

## PUB-02 — Catalog (`/products`)

### 1. Hook & Data Mapping
- `useCatalogProducts(filters)` where `filters: ProductListQuery` is **parsed + validated from the URL**
  (`ProductListQuerySchema.safeParse` of `?search&brandId&familyId&modelId&inStock&sort&page`).
- `useCatalogFamilies()` (multi-select), `useCatalogBrands()` (select),
  `useCatalogModels({ brandId })` — **enabled only when a brand is set** (`ModelsQuery.brandId`; hook
  runs but returns `[]` server-side without brand — or pass `undefined` and gate).
- Cart heart: `useAddToCart`/`useRemoveFromCart` (D2, client-only).
- `useSendClientActivity()` — `SEARCH` beacon on each executed search; `CATALOG_SESSION` (with
  `durationSeconds`) on unmount (D10). Client-only, fire-and-forget, **no invalidation**.

### 2. UI Components
- **Reuse:** `ProductListHeader` (title, total vs filtered count), `ProductFilters` (retype D9; wrap in
  `drawer`/`sheet` on mobile), `ProductGrid` (1/2/4 cols, `enablePagination`, `itemsPerPage=15`),
  `pagination` (ui), `EmptyState`, `ErrorBoundary`.
- **New:** none structurally — but **remove** `Products.tsx`'s in-memory `filter()`, the two URL-sync
  `useEffect`s, and the SEO `useEffect`. **The URL is the state**: filters write query params
  (`setSearchParams`, `replace`), `useCatalogProducts` re-runs on the parsed object; back/refresh restore
  for free. **Brand change resets `modelId`.**

### 3. Granular States
- `isLoading` → skeleton grid (`ProductGrid showSkeletons skeletonCount≈15`); header count shows a
  small skeleton.
- `isError` → local error card with **retry** (`refetch`) inside the grid area; `PublicLayout` intact.
- **Empty** → `<EmptyState>` with a **clear-filters** reset action.
- Price zone per card: resolved `currentPrice` / `guestPrice`, else "Sign in to see the price"
  (`priceHidden`). Prices only for signed-in viewers where the DTO exposes them.

### 4. Forms & Mutations
- No RHF form — the filter bar is URL-bound controls. **`ProductListQuerySchema` validates the parsed URL
  params before the query fires** (guard against a hand-edited URL). Mutations: cart toggle; beacons.

### 5. Optimization
- `useMemo` for the parsed-filter object (stable query key) and for the derived model options.
- Beacon timers via `useRef` (mount timestamp) + unmount `useEffect` cleanup (D10). No route-lazy beyond
  the existing `React.lazy(Products)`.

### 6. Unit-Test Strategy — `/tests/unit/pages/catalog/`
- `catalog.spec.tsx`: `vi.mock()` `useCatalogProducts`, `useCatalogFamilies`, `useCatalogBrands`,
  `useCatalogModels`, `useSendClientActivity`, and `react-router-dom` `useSearchParams`. Assert: changing a
  filter writes the expected query params; **brand change clears `modelId`**; loading → skeleton grid;
  empty → `EmptyState` + reset clears params; guest sees no heart and the "Sign in to see the price" zone;
  a `SEARCH` beacon fires on search submit (mock `mutate` called with `{ type: 'SEARCH', query }`).

### 7. Acceptance Criteria
All filters are URL-driven and restore on back/refresh; the grid paginates at 15; empty/error are local
with a reset/retry; client hearts toggle the cart; `SEARCH` + `CATALOG_SESSION` beacons fire for
signed-in clients only and never surface an error toast.

---

## PUB-03 — Product Detail (`/products/:id`)  ← route param change (D1)

### 1. Hook & Data Mapping
- `useCatalogProduct(id)` → `ProductDetailDto` (`enabled: !!id`; **404 view** for unknown/disabled).
- `useWilayas()` → `WilayaDto[]` (nested communes; staleTime 30 min) — powers the order form cascading selects.
- `usePlatformDeliveryFee({ wilayaId, communeId })` → `FeeDto { deliveryHome, deliveryOffice, source }`.
  Hook is `enabled: !!query.wilayaId`; **pickup clears wilaya → query auto-disabled → fee 0** (satisfies
  "pickup ⇒ wilaya/commune disabled, fee 0" without extra gating).
- `usePlaceOrder()` → `POST /orders`, invalidates `qk.orders.all()`.
- Cart heart (client-only, D2). `useSendClientActivity()` → `PRODUCT_VIEW` + `durationSeconds` on unmount (D10).
- **Related strip:** `ProductDetailDto.relatedIds` → bounded per-id `useCatalogProduct` hydration (D7 gap).

### 2. UI Components
- **Reuse:** `ProductImageGallery`, `ProductCategoryTags`, `ProductPricingSection` (retype D9),
  `ProductOrderModal` (retype D9 — now drives the RHF order form), `ProductErrorBoundary`, back `<Link>`,
  `Skeleton`, `Alert`.
- **New:** `src/pages/product-detail/components/` — a `RelatedProductsStrip` (maps hydrated related
  products to `ProductCard`) if kept; the order form body inside `ProductOrderModal` (see §4).

### 3. Granular States
- `isLoading` → the existing gallery+info skeleton (keep the shape already in `ProductDetails.tsx`).
- `isError` / not-found → **local** `<NotFoundState>` inside the content area (never a global redirect),
  with links to `/` and `/products`.
- Fee: `usePlatformDeliveryFee.isLoading` → small inline spinner in the fee row; **fee row renders only
  when wilaya + commune + mode are all set** and mode ≠ pickup.
- Price block by viewer: approved client → tier `currentPrice`; guest → `guestPrice` or "Only registered
  users can see this price" + sign-in link with **Order disabled**; else "Price on request".

### 4. Forms & Mutations
- **Order form** (`src/pages/product-detail/order.schema.ts`) — RHF + `zodResolver`, aligned to
  `PlaceOrderCommand` (`orders.command.ts`):
  - `productId` (from route), `quantity` (int ≥1, **≤ `availableQuantity`** — added `.refine`/max),
    `orderType` (`PICKUP` | `DELIVERY_HOME` | `DELIVERY_OFFICE`; guest limited to the two delivery modes,
    client also `PICKUP`), `contact { fullName, phone }` (prefilled for clients, editable),
    `delivery { wilayaId, communeId, address? }` — **prefilled from the client profile, editable**;
    reuse the contract's two `.refine`s (delivery required unless PICKUP; forbidden when PICKUP).
  - Live total = `quantity × unitPrice + fee` (fee = `deliveryHome`/`deliveryOffice` by mode, or 0 pickup).
  - Submit → `usePlaceOrder().mutateAsync` **with an `Idempotency-Key`** (D6). Success → navigate **PUB-05**
    (`/orders` order-placed view). Error mapping: **409 `INSUFFICIENT_STOCK`** → `setError('quantity', …)`;
    **403 `GUEST_PRICE_HIDDEN`** → redirect to `/login`. Read `error.response.data.error.code`.
- Cart toggle mutation (heart).

### 5. Optimization
- `React.lazy(ProductDetails)` already in `App.tsx`. `useMemo` for running total and for the bounded
  `relatedIds` slice. Modal mounted lazily (only when open).

### 6. Unit-Test Strategy — `/tests/unit/pages/product-detail/`
- `product-detail.spec.tsx`: `vi.mock()` `useCatalogProduct`, `useWilayas`, `usePlatformDeliveryFee`,
  `usePlaceOrder`, `useSendClientActivity`. Assert: unknown id → local not-found; price zone per viewer
  (approved/guest/hidden); **Order now** opens the modal.
- `order-form.spec.tsx` (forms, `userEvent`): Zod `quantity > availableQuantity` error; delivery-required
  refine on a non-pickup submit; **pickup disables wilaya/commune and shows fee 0**; fee row hidden until
  wilaya+commune+mode set; mocked mutation reject with `409 INSUFFICIENT_STOCK` renders on the quantity
  field; `403 GUEST_PRICE_HIDDEN` triggers a `/login` navigation (mock `useNavigate`).

### 7. Acceptance Criteria
Detail resolves by **id**; unknown/disabled shows a local 404; price/order rules match the viewer; the
order form validates against `PlaceOrderCommand`, sends an idempotency key, routes to PUB-05 on success,
and surfaces 409/403 exactly as specified; `PRODUCT_VIEW` beacon fires on unmount for clients.

---

## PUB-06 — Login (`/login`)

### 1. Hook & Data Mapping
- `useAuth().login(command)` (wraps `useLogin` → `POST /auth/login`, invalidates `qk.auth.session()`).
- `usePermissions()` → `qk.auth.permissions()` (`GET /identity/me/permissions`) — consumed on the **new
  `/staff` landing** (not the login card) to resolve the staff first-permitted page (D4).
- Redirect is **declarative** via `PublicOnlyRoute` reacting to the session query — the login card never
  navigates itself. **Refine `PublicOnlyRoute` + add `/staff`** (D4): `ADMIN` → `/admin`; `STAFF` →
  `/staff`; `CLIENT` → `location.state.from ?? '/'`.

### 2. UI Components
- **Reuse:** existing `LoginPage.tsx` card (`Logo`, `Input`, `Label`, `Button`, `ThemeToggle`,
  `LanguageToggle`, show/hide password, shake-on-error). Keep as-is functionally.
- **New / fix:** add the **register link** (clients) — `<Link to="/register">`; replace the hardcoded
  `"App Template"` title with a `t(...)` key (no inline strings, rules §6B); add a thin **`StaffLanding`**
  route component that reads `usePermissions()` and `<Navigate>`s to the first permitted page (`PageKey →
  route` map). Staff destination pages themselves are out of scope (scope confinement).

### 3. Granular States
- `isLoggingIn` → button spinner + disabled (already present).
- Failure → **one generic** error banner (`role="alert"`) that never distinguishes unknown-user / wrong-
  password / disabled (429 lockout + network get their own copy via `loginErrorKey`). Already present.

### 4. Forms & Mutations
- **Reuse** `login.schema.ts` (`loginSchema(t)` — `username`/`password` non-empty, compile-time
  `AssertAssignable<LoginFormValues extends LoginCommand>`). Mutation: `login`.

### 5. Optimization
- `React.lazy(LoginPage)` already in `App.tsx`. None else.

### 6. Unit-Test Strategy — `/tests/unit/pages/login/`
- `login.spec.tsx`: `vi.mock()` `useAuth` (spy `login`). Assert: empty submit → Zod "fill in all fields"
  errors (mocked `t` returns the key); rejected `login` → generic banner + shake class; `isLoggingIn` →
  disabled spinner; register `<Link>` present.
- `redirect.spec.tsx` (guard/landing): `vi.mock()` `useSession`/`usePermissions`. Assert `PublicOnlyRoute`
  sends ADMIN→`/admin`, STAFF→`/staff`, CLIENT→back-target/`/`; `StaffLanding` navigates to the first
  permitted page from mocked permissions (and shows the empty state when none).

### 7. Acceptance Criteria
One card for all user types; generic failure copy; loading state on submit; register link visible; on
success the guard routes admin → `/admin`, staff → `/staff` (→ first permitted page via `usePermissions()`),
clients → back-target/`/`.

---

## PUB-07 — Register (`/register`)

### 1. Hook & Data Mapping
- `useWilayas()` → `WilayaDto[]` (replaces static `WilayaProvider`, D8); commune options = selected
  `wilaya.communes`.
- `useValidatePhone()` (mutation) → `ValidatePhoneResultDto { isValid, status }`; **debounced on blur**
  (reuse `useDebouncedValue`/`use-debounced-search`).
- `useRegisterClient()` → `POST /clients/register`, returns `{ id }`, **does not log in**, **no cache
  invalidation** needed.
- Authenticated clients redirected to `/my-account` (declarative guard, D5 — drop the current
  `useEffect(navigate)`).

### 2. UI Components
- **Reuse:** `Card`, `Input`, `Select`, `Button`, `RegistrationConfirmationDialog` (retype D9 to the new
  form values), and a success panel.
- **New:** none structurally — rewire `Register.tsx` off `use-wilaya`/`use-registration` + the
  `WilayaProvider` wrapper.

### 3. Granular States
- `useWilayas` loading → skeleton/disabled selects.
- Phone async check: `isPending` → inline spinner on the phone field; conflict → field error from
  `status`: `REGISTERED` → "This phone number is already registered."; `PENDING` → "Your request is
  pending / being processed." (`PhoneAvailability` enum values are lowercase `registered`/`pending`/`available`).
- Submit `isPending` → dialog confirm button spinner.
- Success → replace the form with the success panel: *"Thank you for registering — please wait for the
  admin's approval."*

### 4. Forms & Mutations
- **New** `src/pages/register/register.schema.ts` — RHF + `zodResolver`, aligned to `RegisterClientCommand`
  (`clients.command.ts`): `firstName*`, `lastName*`, `phone*`, `email?`, `storeName?` (**add — missing in
  the current form**), `wilayaId*`, `communeId*` (**uuid, cascading** — not names). No password fields.
  The phone async check runs on blur; **the confirmation dialog is the real submit gate** → on confirm,
  `useRegisterClient().mutateAsync`.

### 5. Optimization
- `React.lazy(Register)` already in `App.tsx`. `useMemo` for commune options derived from the selected
  wilaya. (Dropping `WilayaProvider` also drops the ~480 KB static chunk, D8.)

### 6. Unit-Test Strategy — `/tests/unit/pages/register/`
- `register.spec.tsx`: `vi.mock()` `useWilayas`, `useValidatePhone`, `useRegisterClient`. Assert (with
  `userEvent`): required-field Zod errors; **wilaya select populates commune** from `communes` and clears
  commune on wilaya change; phone-conflict messages for `registered`/`pending`; the recap dialog gates
  submit; confirm → `register` mutation called with the mapped command; success panel replaces the form.

### 7. Acceptance Criteria
Server-backed wilaya/commune (uuid) cascading; blur-debounced phone check with the two conflict messages;
recap dialog as the submit gate; no auto-login; success panel shown; authenticated clients bounced to
`/my-account`.

---

## PUB-08 — My Account (`/my-account`)  ← CLIENT-only guard (D5)

### 1. Hook & Data Mapping
- `useClientMe()` → `ClientMeDto` (`qk.clients.me()`): firstName, lastName, **phone (read-only)**, email,
  storeName, wilayaId, communeId, address, createdAt, **credit, totalPaid, totalSold**.
- `useUpdateClientMe()` → `PATCH /clients/me`, invalidates `qk.clients.me()`.
- `useChangeClientPassword()` → `POST /clients/me/password` (no invalidation; success toast + reset).
- `useWilayas()` → for the editable wilaya/commune selects (uuid, D8).

### 2. UI Components
- **Reuse:** `Tabs` (Profile / Billing), `Card`, `Input`, `Badge`, `MoneyStatusCard` (retype D9 →
  `credit`/`totalPaid`/`totalSold`), `Skeleton`, `NotFoundState`, and `PasswordResetForm` **or** a new
  password card (see §4).
- **New:** `src/pages/my-account/components/` — a profile-edit form card and a password-change card
  (RHF). **Remove** the draft-model numeric-status/category logic entirely.

### 3. Granular States
- `isLoading` → skeleton cards (profile + status + money).
- `isError` → local error/retry inside the content (layout preserved).
- **Status card:** badge **"Active" only**, member-since (`createdAt`). **Category is NEVER rendered**
  (drop `getCategoryName`/`idCategory` — `ClientMeDto` has no category by design).

### 4. Forms & Mutations
- **Profile** `update-me.schema.ts` — RHF + `zodResolver`, aligned to `UpdateMeCommand` (`.strict()`):
  `email?`, `storeName?`, `wilayaId?`, `communeId?`, `address?`. **`phone` is excluded from the schema
  entirely** (rendered read-only). Edit toggles the card into a form; Cancel restores; Save →
  `useUpdateClientMe`.
- **Password** `change-password.schema.ts` — `currentPassword`, `newPassword` (min 6), `confirmPassword`
  with a **`.refine` (match)**; **strip `confirmPassword` before submit** so the payload is the contract
  `ChangeMyPasswordCommand`. Independent form; success toast + `reset()`.

### 5. Optimization
- `React.lazy(MyAccount)` already in `App.tsx`. No memoization needed.

### 6. Unit-Test Strategy — `/tests/unit/pages/my-account/`
- `my-account.spec.tsx`: `vi.mock()` `useClientMe`, `useUpdateClientMe`, `useChangeClientPassword`,
  `useWilayas`. Assert: skeleton while loading; **phone field is read-only / absent from the editable
  schema**; **category is not rendered anywhere**; status badge shows only "Active"; Edit→Save calls
  `updateMe` with the mapped command; Cancel restores; billing tab renders `MoneyStatusCard` with
  credit/totalPaid/totalSold and the My Orders / My Invoices shortcuts.
- `password-form.spec.tsx`: mismatch → refine error; match → `changePassword` called with only
  `{ currentPassword, newPassword }` (no `confirmPassword`).

### 7. Acceptance Criteria
Two tabs; phone read-only; category never shown; status = "Active" badge only; profile Edit/Save/Cancel
patches via `UpdateMeCommand`; password change via `ChangeMyPasswordCommand` with a client-side confirm
refine; billing shows the money card from the linked POS client + shortcuts; page is CLIENT-guarded.

---

## PUB-11 — Not Found (`*`)

### 1–6.
- **No hooks, no forms, no data.** Already implemented by `CatchAllRoute` in `App.tsx` (picks
  `AdminLayout` vs `PublicLayout` by session and renders `<NotFoundState eyebrow="404" …>` with a home
  link). Verify the **public** branch renders inside `PublicLayout` with a static illustration + link home
  and all copy via `t(...)`.

### 7. Acceptance Criteria
Unknown public routes render the 404 inside `PublicLayout` (header/footer intact) with a working home link;
no data fetch; no console errors.

---

## 3. Cross-cutting requirements (apply to every page)

- **Layout preservation (rules §4):** loading → shape-matched `Skeleton`; error/404 → **local**
  `NotFoundState`/inline retry inside the content area. Never a full-screen spinner (except the pre-mount
  `AuthRestoring` gate) and never a global redirect on a content error.
- **Component→Hook→Service (rules §2):** pages call hooks only; **no `useEffect` for fetching** (the only
  `useEffect`s introduced are the D10 unmount beacons and RHF/URL sync that is *not* fetching).
- **i18n (rules §6B):** **no inline strings** — every label/message is a `t('scope.feature.element')` key in
  `src/config/translations.json` (flat dot-map, `{ en, fr, ar:"" }`). New keys per page/form; reuse
  existing `common.*`. Fix the two existing inline strings noted (Login title, plus any success-path
  clusters flagged in memory `stage-03-sprint2-complete`).
- **Envelope/DTO (rules §3, test-rules §3):** services already unwrap `ApiResponse<T>`; fixtures must
  return the **`{ success, data }` envelope** and be `Schema.parse(...)`-validated from
  `@dragon-telecom/contract`.
- **Tests location (test-rules §1):** all specs under `/tests/unit/pages/[page]/` — **never in `/src`**.
  Unit tests **`vi.mock()` the hook** (not the network) and **mock `useTranslation`**
  (`() => ({ t: (k) => k })`); forms use `userEvent` and assert Zod messages on invalid submit.

---

## 4. Prerequisites / "resolve first" checklist

1. **D4** — add the `/staff` route (RoleGuard STAFF/ADMIN) as a `usePermissions()`-driven
   first-permitted-page landing (`PageKey → route` map); refine `PublicOnlyRoute` + the login redirect
   (ADMIN→`/admin`, STAFF→`/staff`, CLIENT→back-target/`/`).
2. **D6** — add an `Idempotency-Key` header to `orders.service.ts::placeOrder` (engine follow-up PUB-03
   depends on).
3. **D7** — decide related-products hydration: bounded per-id `useCatalogProduct` (interim) vs. an upstream
   contract change to return summaries.
4. **D9** — retype the shared presentational components (`ProductCard`, `ProductGrid`, `ProductFilters`,
   `ProductOrderModal`, `ProductPricingSection`, `MoneyStatusCard`, `RegistrationConfirmationDialog`,
   `DeliveryForm`) onto contract DTOs — shared prerequisite for PUB-01/02/03/08; do this first.
5. **D5** — introduce a CLIENT-scoped route guard for `/my-account` (and redirect authenticated clients
   away from `/login` `/register` to `/my-account`).
6. **D1** — change the product-detail route to `:id`; update all card/link producers; retire
   `use-product-details`, `use-product-order`, `kebabCaseToProductName`.

**No missing hooks** — every data need maps to an existing Sub-02 hook. The only true engine gaps are the
idempotency key (D6) and related-product hydration (D7); all other items are page-level rewires.
