# Sub-03 · Page Assembly Sprint Plan — Public Pages Set

> **Input plan:** `./plan.md` (PUB-01 Home, PUB-02 Catalog, PUB-03 Product Detail, PUB-06 Login,
> PUB-07 Register, PUB-08 My Account, PUB-11 Not Found).
> **Nature:** planning only — **no code yet**.
> **Source of truth:** `Apps/contract`, `Apps/api`, and the `PUB-*.md` requirements. `Apps/web` is
> MVP+template scaffolding; where it conflicts with the requirements, the requirement wins.

## Strategy — inside-out, layer-first across the whole set

The phase file mandates **Foundation → Primitives & States → Assembly & Wiring → Polish → Tests**, and
"wiring never precedes primitives." Because this is a **7-page set** with shared prerequisites (DTO
retype of shared components, routing/guards, the `/staff` surface, the wilaya swap), the layers are built
**globally** and, where a layer is large, split into lettered sprints. Global order is preserved: **all
Foundation lands before any Primitives; all Primitives before any Wiring.**

| # | Sprint | Layer |
|---|---|---|
| 1 | Schemas & i18n | Foundation |
| 2 | Routing, Guards, Lazy & Engine-gap prep | Foundation |
| 3 | Shared DTO-typed primitives (retype) | Primitives & States |
| 4 | Page-local primitives, Skeletons & local fallbacks | Primitives & States |
| 5 | Wiring — public browse cluster (Home / Catalog / Detail / 404) | Assembly & Wiring |
| 6 | Wiring — auth & account cluster (Login+/staff / Register / My-Account) | Assembly & Wiring |
| 7 | Polish — responsive, memo/callback, beacons, i18n sweep | Polish |
| 8 | Unit tests — pages, forms, guards | Tests |

### Conventions applied to **every** sprint (not repeated in each Validation block below)
- **`useTranslation` only** — no inline JSX strings; every string is a `t('scope.feature.element')` key
  present in `src/config/translations.json` with `{ en, fr, ar:"" }`.
- **No `useEffect` for fetching.** The only permitted effects are the unmount **beacon** mutations
  (`CATALOG_SESSION`/`PRODUCT_VIEW`, plan D10) and RHF/URL sync (not fetching).
- **`tsc --noEmit` clean** and **`vitest run` green** (existing suite stays green; new page specs are
  authored in Sprint 8) before commit.
- **No test files in `/src`** (tests live under `/tests`, test-rules §1).
- **Component → Hook → Service** only; services already unwrap `ApiResponse<T>`.
- **Commit on green**, one commit per sprint: `fe: sub-03 sprint N — <topic>` (repo style; `git add .`,
  no Co-Authored-By).

---

### Sprint 1: Schemas & i18n (Foundation) — Status: ✅ Done

**Goals**
- All co-located Zod schemas exist and are **compile-time-checked against their contract Command**.
- All translation keys for the seven pages exist (`en`/`fr` real copy, `ar:""`), with the known inline
  strings removed.

**Tasks**
- [x] Verify/keep `src/pages/login.schema.ts` (already `loginSchema(t)` + `AssertAssignable<LoginCommand>`). (#foundation)
- [x] `src/pages/register/register.schema.ts` → aligned to `RegisterClientCommand` (`firstName`, `lastName`,
      `phone`, `email?`, `storeName?`, `wilayaId`, `communeId`; **uuid ids**, no password). Add the
      `AssertAssignable` guard. (#foundation)
- [x] `src/pages/product-detail/order.schema.ts` → aligned to `PlaceOrderCommand` (`productId`, `quantity`
      int≥1 **`.refine(q ≤ availableQuantity)`**, `orderType`, `contact{fullName,phone}`,
      `delivery{wilayaId,communeId,address?}` with the two contract refines: delivery required unless
      PICKUP / forbidden when PICKUP). (#foundation)
- [x] `src/pages/my-account/update-me.schema.ts` → aligned to `UpdateMeCommand` (`.strict()`; `email?`,
      `storeName?`, `wilayaId?`, `communeId?`, `address?`; **`phone` excluded entirely**). (#foundation)
- [x] `src/pages/my-account/change-password.schema.ts` → `currentPassword`, `newPassword` (min 6),
      `confirmPassword` + **`.refine` match**; document that `confirmPassword` is stripped before the
      `ChangeMyPasswordCommand` payload. (#foundation)
- [x] Note (no file): Catalog validates parsed URL params with the contract `ProductListQuerySchema`
      before the query fires — no new schema. (#foundation)
- [x] Add translation keys per scope (28 new + 1 updated — see report-sprint-01.md for the full list and
      the scope-reuse correction: existing `hero.*`/`categories.*`/`brands.*`/`products.*`/`products.filters.*`
      already cover Home + Catalog in full, so no `home.*`/`catalog.*`/`productDetail.*` scopes were added;
      new keys landed under the already-established `auth.login.*`, `register.*`, `account.*`, `product.*`,
      plus a new `staff.landing.*`), reusing `register.wilayaRequired`/`communeRequired`/`passwordMismatch`
      and `common.brand.pageTitle` instead of duplicating. (#i18n)
- [x] Remove inline-string/SEO debt this set touches: `Products.tsx` `document.title`/meta `useEffect`
      deleted (SEO is not this set's concern). `Register.tsx` audited — **already fully keyed, no inline
      strings found** (task description was stale); the one real hardcoded string in this set was
      `LoginPage.tsx`'s `"App Template"` h1, fixed to `t("common.brand.pageTitle")`. (#i18n)

**Validation**
- [x] Each schema's inferred type is assignable to its contract Command (compile guard present).
- [x] `tsc --noEmit` clean; no new inline strings introduced.
- [x] `vitest run` — 299/299 passed (no regressions).
- [x] `eslint` on all touched/new files — 0 new errors (Products.tsx's pre-existing prettier debt dropped
      84→65 as a side effect of the deletion; not otherwise touched, per the documented out-of-scope
      lint-noise decision).

**Risks**
- `UpdateMeSchema` is `.strict()` — the RHF form must not register a `phone` field or submit will 400.
  *(Still applies — schema alone doesn't prevent a future RHF form from registering it; carry into
  Sprint 6.)*
- `order.schema.ts` needs `availableQuantity` injected (schema factory takes the max), mirroring
  `loginSchema(t)`'s factory pattern. *(Implemented as planned.)*

---

### Sprint 2: Routing, Guards, Lazy & Engine-gap prep (Foundation) — Status: ✅ Done

**Goals**
- The route table matches the requirements (id-based detail, `/staff` surface, client-scoped account).
- The two engine gaps (idempotency key, related hydration) are unblocked at the service/decision level.

**Tasks**
- [x] **D1:** change `/products/:productName` → `/products/:id` in `App.tsx`; retire the by-name path and
      `kebabCaseToProductName`/`productNameToKebabCase` (deleted `lib/utils/product-utils.ts` entirely —
      every export was dead once its two consumers were fixed). **`use-product-details.ts` adapted
      in place** (id-based query now; still the Sub-01 stub underneath) rather than deleted — see
      "Corrections" below. **`use-product-order.ts` deferred to Sprint 5** — not a by-name-routing
      artifact; belongs with the real order-form wiring. (#routing)
- [x] **D4:** add the `/staff` route under `RoleGuard allow={[STAFF, ADMIN]}` → a thin `StaffLanding`
      component; add a `PageKey → route` map module (`lib/staff-pages.ts`, keys from `identity.enums.ts`,
      currently empty — populated as staff destination pages ship). (#routing)
- [x] **D4:** refine `PublicOnlyRoute` + login redirect: `ADMIN`→`/admin`, `STAFF`→`/staff`,
      `CLIENT`→`/register`-path→`/my-account`, else `location.state.from ?? '/'`. (#routing)
- [x] **D5:** make `/my-account` **CLIENT-scoped** (`RoleGuard allow={[UserType.CLIENT]}`, split out of
      the any-authenticated `ProtectedRoute` block); `/register`'s already-authenticated-client redirect
      now goes to `/my-account` (folded into the `PublicOnlyRoute` refinement above, not a separate
      per-page effect). (#routing)
- [x] Confirm every page keeps `React.lazy()` + `<Suspense fallback={<PageLoader/>}>` (already in place);
      add lazy entries for `StaffLanding`. (#routing)
- [x] **D6 (engine gap):** add an `Idempotency-Key` header (client `crypto.randomUUID()` per attempt) to
      `orders.service.ts::placeOrder`. **Discovery:** `Apps/api`'s `ORDER_ROUTES.PLACE` handler has no
      idempotency-key middleware at all — the header is sent but currently inert server-side; documented
      inline and in the report as a backend follow-up, not a frontend gap. (#wiring)
- [ ] **D7 (engine gap):** ~~implement a bounded (≈4) per-id `useCatalogProduct` fan-out~~ — **descoped to
      a decision-only task** (already recorded in plan.md D7); the actual fan-out is UI work that belongs
      in Sprint 5 (Wiring) after Sprint 4 builds its skeleton primitive, not Sprint 2. See "Corrections"
      below. (#decision)

**Validation**
- [x] `tsc --noEmit` clean (both `tsconfig.json` and `tsconfig.test.json`) after the route/param changes
      rippled through the one real link producer (`ProductCard.tsx`).
- [x] Guards preserve the pre-mount `AuthRestoring`/`SessionResolving` behavior (no `/login` flash on cold
      start) — unchanged in both `ProtectedRoute` and `RoleGuard`, only their post-ready branches changed.
- [x] Layout survives `isError` on any lazily-loaded route (`RouteErrorBoundary` unchanged, `/staff` wired
      the same way as every other `AdminLayout` child route).
- [x] `vitest run` — 299/299 passed, including the pre-existing `ProtectedRoute.test.tsx` (unchanged
      ADMIN/CLIENT assertions still hold under the refined guard logic).
- [x] `eslint` on all 11 touched/new files — 0 new errors on 9 of them; 2 files (`App.tsx`,
      `ProductCard.tsx`) each gained exactly 1 new pre-existing-style prettier line (verified via
      before/after diff, not a new error class) — see report for detail.

**Risks**
- Changing the detail param breaks every `<Link>` producer (Home/Catalog cards, Related strip) — must
  update all in the same sprint to keep `tsc` green. *(Confirmed only one real producer existed —
  `ProductCard.tsx` — fixed; no "Related strip" exists yet to break, since it's a Sprint 5 new
  component.)*
- Client-scoping `/my-account` must not regress PUB-05 `/orders` (stays any-authenticated). *(Verified —
  `/orders` stays under the original `ProtectedRoute` block, untouched.)*

**Corrections to this sprint's own task list (transparently noted, same pattern as Sprint 1):**
1. `use-product-details.ts` was **adapted**, not deleted — deleting it would force `ProductDetails.tsx`'s
   body (pricing/gallery/order-modal, still Sub-01-draft-typed until Sprint 3) to be rewritten twice
   (once as an interim stopgap now, again for real in Sprint 5). Adapting the existing stub to be
   id-keyed satisfies D1's actual concern (no more name-based lookup) without that churn.
2. `use-product-order.ts`'s retirement doesn't belong in a routing sprint — it's a data-wiring concern,
   deferred to Sprint 5/6 alongside the real `usePlaceOrder` RHF wiring.
3. D7's "implement a bounded fan-out" was UI work smuggled into a Foundation sprint — the decision was
   already made in `plan.md`; the implementation stays in Sprint 5 per the "primitives before wiring"
   ordering this very plan establishes.

---

### Sprint 3: Shared DTO-typed primitives (Primitives & States) — Status: ✅ Done

**Goals**
- The shared presentational components consumed by this set are **retyped from Sub-01 numeric-id draft
  view models to contract DTOs** (uuid `string` ids) — the D9 prerequisite for all wiring.

**Tasks**
- [x] `ProductCard` / `ProductGrid` → `ProductWithPricingDto` (uuid `id`, `inStock`, `inCart`,
      `currentPrice`/`guestPrice`/`priceHidden`, `family`/`brand`/`model`, `images`); callbacks keyed on
      `string` id. `inCart` replaces the old fake `isProductInCart()` local stub — it's a real DTO field
      now. Dropped `isNew`/`Star`/rating JSX (no such fields on the DTO). (#ui)
- [x] `ProductFilters` → `FamilyDto[]` / `BrandDto[]` / `DeviceModelDto[]`; value model = uuid strings
      (dropped the `.toString()` numeric-id coercions). (#ui)
- [x] `ProductPricingSection` / `ProductImageGallery` → `ProductDetailDto`. PricingSection: dropped
      `useProductOrder()` entirely — it no longer owns order-submission state (that's
      `ProductOrderModal`'s job per plan.md §4); viewer price branches on `currentPrice ?? guestPrice`
      + `priceHidden`, not a separate `userCategory`. Gallery: `ProductImageDto.alt` is optional (was
      required on the draft type) — falls back to `productName` everywhere. (#ui)
- [x] `ProductOrderModal` → fully rebuilt as an RHF + `order.schema.ts` form (was a manual 4-step wizard
      with local `useState` fields) — quantity, contact, cascading wilaya/commune selects (folds in what
      was `DeliveryForm`), mode radio (pickup gated on `isAuthenticated`), fee display, live total. Props:
      `product: ProductDetailDto`, `wilayas: WilayaDto[]`, `fee?: FeeDto`, `onDeliveryParamsChange`
      (lets the parent own the live `usePlatformDeliveryFee` call in Sprint 5), `onSubmit`. 409
      `INSUFFICIENT_STOCK`/403 `GUEST_PRICE_HIDDEN` interpreted inside the modal's own submit handler
      (a presentation concern — see Corrections). (#ui)
- [x] `MoneyStatusCard` → `credit` / `totalPaid` / `totalSold` (from `ClientMeDto`), replacing
      `balance`/`paid`/`credit`. (#ui)
- [x] `RegistrationConfirmationDialog` → the new register form values (uuid wilaya/commune, `storeName`) —
      props take `Omit<RegisterFormValues,'wilayaId'|'communeId'> & {wilayaName, communeName}` since a
      confirmation dialog should show names, not raw uuids. (#ui)
- [x] `DeliveryForm` → **folded into `ProductOrderModal`** (confirmed zero other consumers) and deleted
      (`DeliveryForm.tsx` + `DeliveryForm.schema.ts`). (#ui)

**Validation**
- [x] `tsc --noEmit` clean (both configs) — no residual `draft-types` imports in the 9 retyped components.
- [x] Components stay presentational — no new TanStack Query hook calls added inside any of the 9 (RHF's
      `useForm` in the modal is client-side form state, not a data hook); text still via `useTranslation`.
- [x] `vitest run` — 299/299 passed, no regressions.
- [x] `eslint` before/after diff on all 17 touched files — 14 flat or *improved* (rewrites incidentally
      fixed pre-existing prettier noise along the way); 3 unchanged; 1 (`ProductCard.tsx`) +2, confirmed
      via message-frequency diff to be the same pre-existing indentation/quote noise class, not a new
      issue.

**Risks**
- These components are shared with out-of-set pages; retyping may surface callers still on draft models —
  bridge or flag, do not silently break them. *(Confirmed via a full consumer sweep before touching
  anything: `useBrands`/`useCategories`/`useModels` [use-brands.ts/use-models.ts] are shared with
  out-of-set admin pages — left untouched; `Products.tsx`'s filters bridge via empty DTO-typed
  placeholder arrays instead. `useProducts`/`useFeaturedProducts` have zero admin consumers — safely
  retyped. `MyAccount.tsx`/`Register.tsx` bridge via inline field-mapping adapters at the call site,
  touching nothing else on those pages.)*

**Corrections found during this sprint (transparently noted, same pattern as Sprints 1–2):**
1. **`order.schema.ts`'s `availableQuantity` param removed** (Sprint 1 premise was wrong) —
   `ProductDetailDto` (catalog.dtos.ts) deliberately has no exact quantity field for public/client
   viewers ("no cost, no exact quantities, boolean inStock only"); the schema now enforces `min(1)` +
   a generous UI ceiling, trusting the server's 409 as the authoritative bound.
2. **409/403 error-code mapping lives inside `ProductOrderModal`, not deferred to Sprint 5** — this is
   how the FORM reacts to a rejected submission (a presentation concern, same precedent as
   `LoginPage.tsx`'s own `loginErrorKey` mapping), not the mutation call itself (`onSubmit` stays an
   injected prop; Sprint 5 wires the real `usePlaceOrder` behind it).
3. **`ProductDetails.tsx` no longer calls `useProductOrder()`** — the Sprint-2 plan deferred its full
   retirement to Sprint 5, but the natural, non-throwaway bridge for this page's placeholder submit
   handler (mirroring the existing `handleAddToCart` toast-only pattern) doesn't need it. The
   `use-product-order.ts` *file* is left in place, now fully orphaned, for Sprint 5 to delete or
   repurpose.

---

### Sprint 4: Page-local primitives, Skeletons & local fallbacks (Primitives & States) — Status: ✅ Done

**Goals**
- Every page's loading/error/empty **shape-matched** states exist as local, layout-preserving primitives
  (Shadcn `Skeleton`, `NotFoundState`, `EmptyState`) — before any hook is wired.

**Tasks**
- [x] Home: `BrandsSection`/`ProductsSection` (both real, stub-backed hooks already) gained a local
      `isError` branch (`NotFoundState` + retry) alongside their existing skeleton/empty states — a real
      gap (query failures were previously silently swallowed into the empty state). `CategoriesSection`'s
      "6 family cards" skeleton **deferred to Sprint 5** — see Corrections. (#ui)
- [x] Catalog: `ProductGrid`'s bespoke error/empty divs replaced with the shared `NotFoundState`/
      `EmptyState`; added `onRetry`/`onClearFilters` props, wired from `Products.tsx` (`refetch`/
      `handleClearFilters` — both already existed, no new hook). `ProductListHeader`'s count skeleton was
      already present and shape-matched — no change needed. (#ui)
- [x] Product Detail: gallery+info skeleton was already present (Sub-01). Not-found view converted from a
      bespoke `Alert` block to `NotFoundState` (consistent with the rest of the set); dropped 4 now-fully-
      dead icon/component imports (`Star`, `Truck`, `Store`, `Alert`/`AlertDescription`) surfaced by the
      swap. Fee-row spinner was already built in Sprint 3. Related-strip skeleton **deferred to Sprint 5**
      — see Corrections. (#ui)
- [x] Login / `/staff`: `StaffLanding`'s empty state (built in Sprint 2) now also distinguishes a failed
      `usePermissions()` fetch from a legitimately empty permission set (`isError` branch, distinct copy
      + retry) — a real gap, not just a verify. Login's error banner/submitting state were already
      correct — verified only. (#ui)
- [x] Register: verified only — see Corrections (`useWilaya()` has no loading state to skeleton; the
      phone-check spinner and success panel already existed and are correct as-is). (#ui)
- [x] My Account: skeleton improved from one generic block to two card-shaped placeholders matching the
      real Personal-Info/Status card layout; added `isError` + retry to the existing not-found gate;
      status card simplified to **"Active" badge only, no category** (dropped
      `getStatusBadgeVariant`/`getStatusText`/`getCategoryName`). (#ui)
- [x] Not Found: verified — `CatchAllRoute` (App.tsx) already renders `NotFoundState` inside
      `PublicLayout`/`AdminLayout` with a home link; no change needed. (#ui)

**Validation**
- [x] Each skeleton matches the real content's shape (no layout shift on resolve) — confirmed for every
      skeleton improved or added this sprint.
- [x] `tsc --noEmit` clean (both configs); all copy (new and reused) via `useTranslation` — 7 new keys
      added (`brands.errorLoading[Body]`, `staff.landing.errorLoading[Body]`), rest reused existing keys.
- [x] `vitest run` — 299/299 passed, no regressions.
- [x] `eslint` before/after diff, all 7 touched `.tsx` files — every new lint line is `prettier/prettier`
      (confirmed via rule-class breakdown, not just counted); zero new rule categories.

**Risks**
- Skeleton dimensions drifting from real content cause CLS — size them to the DTO-driven layout.
  *(Addressed for every skeleton touched this sprint.)*

**Corrections found this sprint (same transparent-correction pattern as Sprints 1–3):** three task-list
items assumed an async hook or component that doesn't exist yet on the current (pre-Sprint-5/6) code —
building a skeleton with nothing real to gate it on would be dead code, so each is deferred to the sprint
that actually introduces the trigger:
1. **`CategoriesSection`'s skeleton** — the component is 100% hardcoded today (no `useCatalogFamilies`
   call at all, confirmed by grep), unlike `BrandsSection`/`ProductsSection` which already have real
   (if stub-backed) `useQuery` hooks to extend. Deferred to Sprint 5, built together with the real query.
2. **The related-products strip's skeleton** — `RelatedProductsStrip` doesn't exist as a component yet
   (plan.md D7/scope confinement: it's new UI, not a retype). Deferred to Sprint 5 alongside the real
   component.
3. **Register's "disabled/skeleton selects while `useWilayas` loads"** — the current wilaya source is
   `useWilaya()`/`WilayaProvider`, a synchronous static-JSON context, not an async query; there is no
   loading state to skeleton until Sprint 6 swaps it for the real server `useWilayas()` (plan.md D8).

Applied a fourth, established rule everywhere else in this sprint that *does* have a real hook already:
**extend the existing `isLoading`/`isError` states rather than defer** — this is what produced the new
`isError` branches on `BrandsSection`, `ProductsSection` (both views), `StaffLanding`, and `MyAccount`,
none of which existed before this sprint despite their hooks already being real `useQuery` calls.

---

### Sprint 5: Wiring — public browse cluster (Assembly & Wiring) — Status: ✅ Done

**Goals**
- Home, Catalog, Product Detail, and Not-Found consume the real hooks with granular states; the order
  form and cart toggles work end-to-end against mocked/real endpoints.

**Tasks**
- [x] **Home:** wired `useCatalogFamilies({featured,limit:6,withCount})` (CategoriesSection — was 100%
      hardcoded, now real, plus the skeleton deferred from Sprint 4), `useCatalogBrands()`
      (BrandsSection), `useCatalogProducts({featured:true,limit:8})` (ProductsSection — **substantially
      simplified**, not just retyped: PUB-01 only calls for a fixed 8-item featured grid, so the old
      "show all products" embedded mini-catalog view was removed entirely — full browsing already exists
      at `/products`). Cart heart via `useAddToCart`/`useRemoveFromCart`, keyed on `inCart`, gated
      client-only through `useSession().type` (moved inside `ProductCard` itself — see Corrections).
      Links only for category/brand/search/card targets. (#wiring)
- [x] **Catalog:** `Products.tsx` rewired onto `useCatalogProducts(filters)` with **URL-as-state**
      (`ProductListQuerySchema.safeParse`, `setSearchParams` replace, brand-change resets `modelId`);
      `useCatalogFamilies`/`useCatalogBrands`/`useCatalogModels({brandId}, false, {enabled: !!brandId})`
      (the `enabled` option didn't exist on `useCatalogModels` — added, see Corrections); `SEARCH` +
      `CATALOG_SESSION` beacons via `useSendClientActivity`, client-only. **Deleted** both old
      in-memory-filter/URL-sync `useEffect`s. Server-side pagination (`PaginatedResult.meta` +
      `SimplePagination`) replaces `ProductGrid`'s internal client-side pagination for this page
      (`enablePagination={false}`). (#wiring)
- [x] **Product Detail:** wired `useCatalogProduct(id)` (404 view), `useWilayas()`,
      `usePlatformDeliveryFee({wilayaId,communeId})` reactively via the modal's
      `onDeliveryParamsChange` (pickup clears wilaya → query auto-disabled → fee 0),
      `usePlaceOrder()` (idempotency key already added in Sprint 2). New `RelatedProductsStrip` +
      `RelatedProductCard` (`src/pages/product-detail/components/`) — bounded (≤4) per-id
      `useCatalogProduct` fan-out, one hook call per component instance (Rules-of-Hooks-legal). Submit →
      `/orders` on success (PUB-05 itself isn't part of this build); 409/403 handling was already built
      into the modal in Sprint 3. Client prefill via `useClientMe({enabled: isClient})` (the `enabled`
      option didn't exist here either — added, same reasoning as `useCatalogModels`). (#wiring)
- [x] Beacons `PRODUCT_VIEW` (ProductDetails, keyed on `id` so navigating between two products via the
      related strip reports each product's own view time) / `CATALOG_SESSION` (Products.tsx, on unmount)
      via effect, client-only, fire-and-forget. (#wiring)

**Validation**
- [x] No `useEffect` fetching remains in `Products.tsx`/`ProductDetails.tsx` — only URL-sync/beacon
      effects (verified: 4 in `Products.tsx`, 1 in `ProductDetails.tsx`, none fetch data for render).
- [x] `tsc --noEmit` clean (both configs); all viewer/price/stock branches localized (`NotFoundState`
      everywhere, no redirect on a content error — the one redirect, 403→`/login`, is spec-required, not
      generic); 401 still handled by the axios interceptor, not a toast.
- [x] `vitest run` — 299/299 passed, no regressions.
- [x] `eslint` before/after diff, all touched files — 9 of 10 flat-or-much-improved (several rewrites
      happen to match Prettier's quote/spacing preference far better than the Sub-01 code they replaced:
      `ProductCard` 278→211, `Products.tsx` 56→9, `categories-section.tsx` 19→2); 1
      (`ProductDetails.tsx`) +2, confirmed 100% `prettier/prettier` via rule-class breakdown.

**Risks**
- Fee gating: ensure pickup truly disables the query (wilaya undefined) rather than sending a bad
  request. *(Confirmed — `onDeliveryParamsChange(null)` fires whenever `orderType === PICKUP`, and
  `usePlatformDeliveryFee`'s own `enabled: !!query.wilayaId` gate does the rest.)*
- Beacon effects must not double-fire under React 18 StrictMode double-invoke. *(Each beacon effect's
  cleanup only fires the mutation once per real unmount/dependency-change, matching the existing
  StrictMode-safe pattern already used elsewhere in this codebase — not independently re-verified beyond
  that structural match.)*

**Corrections & real gaps found this sprint (same transparent pattern as Sprints 1–4):**
1. **`useAddToCart`/`useRemoveFromCart` didn't patch product caches** — plan.md's PUB-01 line explicitly
   requires "invalidates `['cart']` and patches `inCart` in product caches," but the Sub-02
   implementation only did the invalidation half. Without the patch, a heart click wouldn't visually
   flip until an unrelated refetch happened to occur. Added `patchInCartInProductCaches` (handles both
   cached shapes under `qk.catalog.products.all()`: `PaginatedResult` list pages and bare detail DTOs).
2. **`useCatalogModels`/`useClientMe` had no `enabled` option** — both needed one this sprint
   (models: "enabled only with a brand"; clientMe: must never fire for a guest, or a doomed 401 hits the
   axios interceptor's redirect-to-login). Added as an optional 3rd/1st param on each — backward
   compatible, zero risk (grep-confirmed neither hook had any other consumer yet).
3. **`ProductCard` simplified beyond a pure retype.** The old card had both a heart *and* a separate
   "Add to Cart" button doing the same underlying action — Sub-01 UI conflating a favorites pattern with
   a shopping-cart-with-checkout pattern that doesn't exist anywhere in the real contract
   (`CartItemDto` has no quantity; ordering happens on the product detail page's Order Now flow, not
   from a catalog card). Consolidated to the heart + a single "View Details" button; dropped the now-
   dead `isAuthenticated` override prop (2 call sites, both in the same `products-section.tsx` this
   sprint already rewrites).
4. **Cleaned up newly-orphaned stub files** — `use-product-details.ts`, `use-product-order.ts`,
   `use-products.ts` (hooks), `getProducts`/`getFeaturedProducts`/`getProductById`
   (`catalog.service.ts`), and their `qkLegacy` keys all lost their last real consumer as a direct
   consequence of this sprint's wiring (grep-confirmed before deleting each).

---

### Sprint 6: Wiring — auth & account cluster (Assembly & Wiring) — Status: ✅ Done

**Goals**
- Login (+ `/staff` landing), Register, and My-Account consume the real hooks/forms with granular states.

**Tasks**
- [x] **Login:** `useAuth().login` wiring confirmed unchanged; added the register `<Link>` (the JSX itself
      was deferred here from Sprint 1, which only prepared the translation keys); error banner +
      submitting state were already correct — verified only. (#wiring)
- [x] **/staff landing:** already fully satisfied `StaffLanding`'s spec — built in Sprint 2
      (`usePermissions()` + `<Navigate replace>`) and extended with an `isError` empty state in Sprint 4.
      Verified only, no changes this sprint. (#wiring)
- [x] **Register:** fully rewired onto `useWilayas()` (`WilayaProvider` + `use-wilaya.ts` dropped, D8 —
      uuid + nested `communes` cascade via `Controller`), `useValidatePhone()` on blur (**not debounced**
      — see Corrections), `useRegisterClient()` (no auto-login, no invalidation, matches the real hook's
      existing behavior). Recap dialog is the submit gate; phone `registered`/`pending` map to field
      messages via the Sprint-1 keys. Removed the redundant `useEffect(isAuthenticated => navigate(...))`
      — `PublicOnlyRoute` (Sprint 2) already handles this declaratively. (#wiring)
- [x] **My Account:** fully rewired onto `useClientMe()`, profile RHF (`update-me.schema` →
      `useUpdateClientMe`, Edit/Save/Cancel via RHF's `values` option — see Corrections — phone stays a
      plain read-only `<Input>`, never registered with RHF), password RHF (`change-password.schema` →
      `useChangeClientPassword`, `confirmPassword` stripped before submit, success toast + reset); billing
      tab `MoneyStatusCard` now fed directly from `ClientMeDto` (no bridge adapter); My Orders (existing)
      + **My Invoices** (new — see Corrections) shortcuts. Status/category simplification (Sprint 4)
      untouched, just repointed to `clientMe.createdAt`. `PasswordResetForm` retired — folded into a new
      inline change-password form (its old schema had no `currentPassword` field, so it couldn't drive
      the real command; same "fold into the one real consumer" precedent as Sprint 3's `DeliveryForm`).
      (#wiring)

**Validation**
- [x] `UpdateMeCommand` payload never contains `phone` — confirmed: `update-me.schema.ts` has no `phone`
      field, and the profile form's phone `<Input>` is plain (`value=`/`disabled readOnly`), never
      `register()`ed with RHF.
- [x] `ChangeMyPasswordCommand` never contains `confirmPassword` — confirmed: destructured out
      (`const { confirmPassword: _confirmPassword, ...command }`) before `.mutate(command)`.
- [x] `tsc --noEmit` clean (both configs); My-Account never renders category (unchanged from Sprint 4);
      authenticated clients bounce from login/register to `/my-account` via `PublicOnlyRoute` (Sprint 2,
      untouched — Register.tsx's own redundant redirect effect was removed, not duplicated).
- [x] `vitest run` — 299/299 passed (including `LoginPage.test.tsx`, unaffected by the added register
      link), no regressions.
- [x] `eslint` before/after diff, all 9 touched files — `Register.tsx` and `clients.service.ts` improved
      (68→38, 5→3); `MyAccount.tsx` +27, confirmed 100% `prettier/prettier` via rule-class breakdown; rest
      flat.

**Risks**
- Dropping `WilayaProvider` changes the register bundle; ensure no other consumer relies on it. *(Grep-
  confirmed zero other consumers before deleting — see Corrections for the full orphaned-file chain this
  triggered.)*
- `usePermissions()` first-page resolution must handle the empty-permissions case gracefully. *(Already
  handled — built in Sprint 2/4, unchanged this sprint.)*

**Corrections & real gaps found this sprint (same transparent pattern as Sprints 1–5):**
1. **Phone validation is a plain `onBlur` handler, not debounced.** `sprints.md`'s own wording said
   "blur, debounced via `useDebouncedValue`," but PUB-07's actual source text just says "async-validated
   on blur" — no debounce requirement. Blur is already a discrete, naturally rate-limited event (you
   don't blur ten times a second while typing), so layering a debounce on top would be unnecessary
   complexity the requirement never asked for.
2. **RHF's `values` option replaces a manual `useEffect` for seeding the profile form.** The original
   `MyAccount.tsx` (and my own plan) used `useEffect(() => { if (accountData) setUserInfo(accountData) },
   [accountData])`. RHF 7.x's `useForm({ values })` does this natively — the form's defaults re-sync
   whenever the referenced object changes by reference (including after `useUpdateClientMe`'s own
   invalidation triggers a refetch) — a cleaner, effect-free equivalent.
3. **A large orphaned-file chain, two sprints deep.** Rewiring Register/MyAccount orphaned
   `use-my-account.ts`, `use-registration.ts`, `use-wilaya.ts`, `wilaya-provider.tsx`,
   `PasswordResetForm.tsx`/`.schema.ts`, plus their now-dead call chains in `clients.service.ts`
   (`getMyAccount`/`updateMyAccount`/`resetMyAccountPassword`/`registerClient`/`checkPhoneExists`/
   `validatePhoneNumber`) and `draft-types/client.types.ts` (`UserAccountData`/`PasswordResetData`).
   While checking these, also found `use-delivery-fees.ts` and `checkout-delivery.service.ts` **already
   orphaned since Sprint 3** (when `DeliveryForm.tsx` — their only consumer — was deleted) and missed at
   the time; cleaned up now. Every deletion was grep-verified for zero remaining consumers first, same
   discipline as every prior sprint's cleanup.
4. **"My Invoices" shortcut links to `/invoices`, a route that doesn't exist in this build.** PUB-08
   requires the shortcut; the contract does have a real `MY_INVOICES` route (`billing.routes.ts`), but no
   frontend page for it exists in this page set — same scope-confinement precedent as Sprint 2's `/staff`
   (plan the link, not a destination outside this set's scope).

---

### Sprint 7: Polish — responsive, memo/callback, beacons, i18n sweep (Polish) — Status: ✅ Done

**Goals**
- Mobile-first public responsiveness, targeted memoization per the plan, and a clean i18n/no-inline pass.

**Tasks**
- [x] Responsive: Catalog filters as `drawer`/`sheet` on mobile; grid 1/2/4 cols; Home sections and
      Detail two-column collapse; account tabs stack on mobile. (#ui)
- [x] `useMemo` only where the plan calls for it: parsed-filter object (stable query key), derived
      model/commune options, order running total, bounded `relatedIds`. `useCallback` for child-passed
      handlers. (#ui)
- [x] Beacon timing via `useRef(mountTs)` + unmount cleanup; confirm `meta.silentErrorToast` suppresses
      failure toasts. (#ui)
- [x] i18n sweep across all seven pages — no inline strings, keys resolve in EN/FR, `ar:""` uniform. (#i18n)

**Validation**
- [x] `tsc --noEmit` clean (both configs); no over-memoization (clarity over premature optimization, rules §5).
- [x] Global `PublicLayout`/`AdminLayout` intact across loading/error on every page (unchanged this sprint).
- [x] `vitest run` — 299/299 passed, no regressions.
- [x] `eslint` before/after diff on all 10 touched files — 6 flat or improved; 4 increased
      (`MoneyStatusCard.tsx` +3, `ProductCategoryTags.tsx` +1, `ProductFilters.tsx` +16,
      `ProductGrid.tsx` +10), confirmed via rule-class breakdown to be 100% `prettier/prettier`
      (pre-existing formatting noise), zero new rule violations.

**Risks**
- Drawer/sheet filter state must stay URL-synced (don't fork state into the drawer). *(Confirmed: the
  Sheet has no state of its own beyond open/closed — the same URL-bound props render inline on desktop
  and inside the Sheet on mobile, one set of controls, two places it renders.)*

**Corrections & real gaps found this sprint (transparently noted, same pattern as Sprints 1–6):**
1. **`ProductFilters` had no mobile drawer at all** — PUB-02's own UI line is explicit: *"`ProductFilters`
   (drawer on mobile)"*. It was a plain always-visible block since Sprint 3's retype. Wrapped the same
   controls in a `Sheet` (shadcn, already used by `PublicHeader`'s mobile nav — matches existing
   convention) behind a `sm:hidden` trigger button; the identical JSX still renders inline on `sm:`+ so
   no state was forked between the two surfaces.
2. **`ProductFilters`/`Products.tsx` never exposed `inStock` or `sort`** — PUB-02's UI line also lists
   *"in-stock toggle, sort"* alongside the brand/family/model selects that Sprint 3 did retype; both
   fields exist on `ProductListQuerySchema` (`catalog.query.ts`) but no UI ever surfaced them. Added a
   `Switch` + a `Select` (backed by the real `ProductSort` enum) and wired both through to the URL the
   same way every other filter already works (`updateParams`, cleared to `undefined` at the default).
   **Correction to PUB-02.md's "Family multi-select" wording:** the contract's `familyId` is a single
   `uuid`, not an array — single-select (the existing, Sprint-3 behavior) is what the contract actually
   supports; the requirement doc's "multi-select" phrasing doesn't match the schema and the contract wins
   (source-of-truth ruling, plan.md).
3. **`ProductGrid`'s responsive columns were built from Tailwind's #1 documented anti-pattern.**
   `getGridClasses()` built class names via string interpolation — `` `grid-cols-${mobileCols} sm:grid-cols-${tabletCols} lg:grid-cols-${desktopCols}` `` — which Tailwind's JIT content scanner cannot see past
   (it only recognizes complete literal class tokens in the source text). The specific combinations this
   page set happens to use were accidentally safe (each literal token already appears elsewhere in the
   app from unrelated static grids), so nothing visibly broke — but it was one caller change away from
   silently shipping a grid that never collapses at `sm:`/`lg:`. Replaced with three static
   number→literal-class lookup tables so every possible class name is guaranteed present in the
   scanned source, independent of runtime `columns` values. While in the file: removed the two
   `onProductClick`/`onAddToCart` props (grep-verified zero callers anywhere) and ~20 lines of
   commented-out dead handlers left over from the Sub-01 template.
4. **Account tabs ("Profile" / "Credits & Balance") don't actually fit `grid-cols-2` on mobile.**
   The task bullet's "stack on mobile" was initially assessed as unnecessary (2 short tabs, seemed to
   fit) — but `account.billing`'s real copy is *"Credits & Balance"* (`"Crédits et Solde"` in FR), and
   shadcn's `TabsTrigger` is `whitespace-nowrap` by design, so at a 320–375px viewport that label
   overflows its 50%-width grid cell. Fixed: `grid-cols-1 sm:grid-cols-2` (stacked below `sm`, matching
   the task's literal wording, which was right — my first read of it wasn't).
5. **A CardHeader button row on My Account could overflow on mobile.** "Personal Information" +
   description on the left and two buttons ("Edit" + "Change Password", or "Cancel" + "Save") on the
   right, all in one non-wrapping `flex justify-between` row — tight-to-broken under ~375px. Changed to
   `flex-col sm:flex-row` with `flex-wrap` on the button group.
6. **Register's two 2-column field grids had no mobile breakpoint at all** (`grid-cols-2`, not
   `grid-cols-1 sm:grid-cols-2` like every other multi-field grid in this page set) — a plain leftover
   from the Sub-01 template that Sprint 3/6 didn't touch since they only retyped/rewired the form, not
   its layout. Fixed both (name row, wilaya/commune row) to match the mobile-first convention used
   everywhere else.
7. **Five confirmed-reachable hardcoded English strings**, found by tracing every `aria-label`/JSX text
   node in the seven pages' full component tree back to whether a real caller actually reaches that
   branch (not just grepping for quotes): `ProductListHeader`'s no-filter results text (`"{n} products
   available"` — the *default* state of the Catalog page, reachable on every unfiltered visit, not an
   edge case); `MoneyStatusCard`'s three aria-labels (`` `Credit: ${n} DA` `` etc. — reused the existing
   `t('account.credit')` etc. labels already rendered as visible text in the same component instead of
   inventing new keys); `hero-section.tsx`'s `alt="Spare Parts"` (reused `t('hero.sparePartsTitle')`);
   `ProductImageGallery`'s zoom aria-label (reused the existing `gallery.zoomIn`/`zoomOut` keys already
   used by the dedicated zoom button two lines away). `ProductListHeader`'s other three inline strings
   (`"{n} of {n}"`, `"{n} Featured"`, `"Avg Rating"`) and `ProductCategoryTags`' `"+{n} more"` are
   currently unreachable with this page set's real callers (no caller passes `featuredCount`/
   `averageRating`, and the only `ProductCategoryTags` caller never exceeds `maxDisplay`) — fixed anyway
   since they're inline in components this sprint already touched and cheap to close out now rather than
   leave as latent gaps for the next caller.
8. **`RelatedProductsStrip`'s `boundedIds` was *not* wrapped in the `useMemo` the plan named.** The
   plan's task list explicitly says "bounded `relatedIds`" — but the real implementation is a single
   `.slice(0, 4)` on an already-short array, re-run only when `RelatedProductsStrip` itself re-renders
   (i.e., when `relatedIds` — its own prop — changes). Memoizing a cheaper operation than the memo's own
   comparison would be the over-memoization the validation checklist explicitly warns against (rules
   §5) — left as a plain slice, this is a correction to the plan, not a gap.
9. **No browser available in this session to visually verify the new mobile Sheet/Switch/Select
   controls.** Validation for this sprint is `tsc`/`vitest`/`eslint` plus a structural JSX read-through
   (Sheet open-state wiring, prop threading Products.tsx → ProductFilters, URL round-trip via the same
   `updateParams` helper every other filter already uses) — not an actual rendered-viewport check. Flagging
   this explicitly per the project's own rule: type/test checks verify correctness, not that it *looks*
   right at 375px.

---

### Sprint 8: Unit tests — pages, forms, guards (Tests) — Status: ⬜ Pending

**Goals**
- `/tests/unit/pages/**` covers each page's reaction to `isLoading`/`isError`/`isSuccess`/empty and each
  form's Zod validation, with **hooks mocked** (no MSW), `useTranslation` mocked.

**Tasks**
- [ ] `pages/home/` — mock `useCatalogFamilies`/`useCatalogBrands`/`useCatalogProducts`: skeletons, local
      error (siblings survive), empty section hidden, card link hrefs, guest heart hidden. (#testing)
- [ ] `pages/catalog/` — mock catalog hooks + `useSendClientActivity` + `useSearchParams`: filter→URL sync,
      brand change clears `modelId`, skeleton grid, `EmptyState` reset, guest price zone, `SEARCH` beacon
      fired. (#testing)
- [ ] `pages/product-detail/` — mock `useCatalogProduct`/`useWilayas`/`usePlatformDeliveryFee`/
      `usePlaceOrder`/`useSendClientActivity`: 404 view, price zone by viewer, modal open; `order-form.spec`
      — quantity>available, delivery-required refine, pickup disables wilaya/fee=0, fee row gating, 409 on
      quantity field, 403 → `/login`. (#testing)
- [ ] `pages/login/` — `login.spec` (Zod empties, generic banner, submitting, register link) +
      `redirect.spec` (PublicOnlyRoute ADMIN/STAFF/CLIENT targets; `StaffLanding` first-permitted-page +
      empty). (#testing)
- [ ] `pages/register/` — mock `useWilayas`/`useValidatePhone`/`useRegisterClient`: required errors,
      commune cascade + reset, `registered`/`pending` messages, dialog gate, success panel. (#testing)
- [ ] `pages/my-account/` — mock `useClientMe`/`useUpdateClientMe`/`useChangeClientPassword`/`useWilayas`:
      skeleton, phone read-only/absent from schema, **category not rendered**, "Active" badge only,
      Edit→Save mapped command, Cancel restore, money card values; `password-form.spec` mismatch refine +
      stripped `confirmPassword`. (#testing)
- [ ] `pages/not-found/` — static render + home link. (#testing)

**Validation**
- [ ] `vitest run` green; assertions on DOM/behavior, not internal state (test-rules §2).
- [ ] `useTranslation` mocked (`t: (k)=>k`) — no real translated strings asserted; **no tests in `/src`**.
- [ ] `tsc --noEmit` clean (typed fixtures from `/tests/fixtures/data`, no `as any` on real assertions).

**Risks**
- Fixtures must be built from contract schemas (`Schema.parse`) so a DTO drift fails the fixture, not a
  silent green.

---

## Sequencing notes & dependencies
- **Hard order:** Sprint 3 (retype) gates Sprints 5–6 (wiring) — components must speak DTOs first.
  Sprint 2 (routes/guards + engine gaps) gates Sprint 5 (detail id route + idempotency) and Sprint 6
  (`/staff`, client guard).
- **Regression safety:** Sprints 3–7 keep the existing suite green; the comprehensive page/form/guard
  specs are authored in Sprint 8 (the phase file's dedicated Tests layer).
- **Out of scope (scope confinement):** the concrete staff destination pages behind `/staff`, PUB-04/05
  cart/orders pages, and any admin surfaces — this set plans only the `<Link>`/redirect to them.
- **Upstream flags to carry forward:** D7 (detail endpoint should return related *summaries*, not ids)
  is a Stage-01 contract note; D6's idempotency-key contract (header name) should be confirmed against
  `Apps/api`.
