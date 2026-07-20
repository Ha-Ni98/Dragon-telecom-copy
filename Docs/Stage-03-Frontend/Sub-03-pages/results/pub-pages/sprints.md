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

### Sprint 4: Page-local primitives, Skeletons & local fallbacks (Primitives & States) — Status: ⬜ Pending

**Goals**
- Every page's loading/error/empty **shape-matched** states exist as local, layout-preserving primitives
  (Shadcn `Skeleton`, `NotFoundState`, `EmptyState`) — before any hook is wired.

**Tasks**
- [ ] Home: per-section skeletons (6 family cards, brand strip, 8-tile grid) + per-section local error
      inside each `ErrorBoundary`/`Suspense`; empty-section hides itself. (#ui)
- [ ] Catalog: skeleton grid (`ProductGrid showSkeletons`), header count skeleton, `EmptyState` with a
      clear-filters action, inline error+retry. (#ui)
- [ ] Product Detail: gallery+info skeleton, local `NotFoundState` for unknown/disabled id, inline fee-row
      spinner, related-strip skeleton. (#ui)
- [ ] Login / `/staff`: `StaffLanding` "no permitted pages yet" empty state; login error banner already
      present. (#ui)
- [ ] Register: disabled/skeleton selects while `useWilayas` loads; phone-check inline spinner slot;
      success/approval panel. (#ui)
- [ ] My Account: skeleton profile/status/money cards; inline error+retry; status card renders **"Active"
      badge only** and **no category**. (#ui)
- [ ] Not Found: verify the public `CatchAllRoute` branch renders inside `PublicLayout` with a home link. (#ui)

**Validation**
- [ ] Each skeleton matches the real content's shape (no layout shift on resolve).
- [ ] `tsc --noEmit` clean; all placeholder copy via `useTranslation`.

**Risks**
- Skeleton dimensions drifting from real content cause CLS — size them to the DTO-driven layout.

---

### Sprint 5: Wiring — public browse cluster (Assembly & Wiring) — Status: ⬜ Pending

**Goals**
- Home, Catalog, Product Detail, and Not-Found consume the real hooks with granular states; the order
  form and cart toggles work end-to-end against mocked/real endpoints.

**Tasks**
- [ ] **Home:** wire `useCatalogFamilies({featured,limit:6,withCount})`, `useCatalogBrands()`,
      `useCatalogProducts({featured:true,limit:8})`; cart heart via `useAddToCart`/`useRemoveFromCart`
      keyed on `inCart` (client-only). Links only for category/brand/search/card targets. (#wiring)
- [ ] **Catalog:** wire `useCatalogProducts(filters)` with **URL-as-state** (parse+validate via
      `ProductListQuerySchema`, `setSearchParams` replace, brand-change resets `modelId`);
      `useCatalogFamilies`/`useCatalogBrands`/`useCatalogModels({brandId})` (enabled with brand); cart
      heart; `useSendClientActivity` `SEARCH` beacon. **Delete** the in-memory filter + URL-sync
      `useEffect`s. (#wiring)
- [ ] **Product Detail:** wire `useCatalogProduct(id)` (404 view), `useWilayas()`,
      `usePlatformDeliveryFee({wilayaId,communeId})` (pickup clears wilaya → auto-disabled → fee 0),
      `usePlaceOrder()` with idempotency key; related strip (bounded per-id). RHF order form: live total,
      submit → PUB-05, **409 `INSUFFICIENT_STOCK`** → quantity field, **403 `GUEST_PRICE_HIDDEN`** →
      `/login`. (#wiring)
- [ ] Beacons `PRODUCT_VIEW`/`CATALOG_SESSION` via unmount-cleanup effect (client-only, fire-and-forget). (#wiring)

**Validation**
- [ ] No `useEffect` fetching remains in `Products.tsx`/`ProductDetails.tsx` (only beacon/URL effects).
- [ ] `tsc --noEmit` clean; all viewer/price/stock branches localized (no full-page error/redirect on a
      content error); 401 still handled by the axios interceptor, not a toast.

**Risks**
- Fee gating: ensure pickup truly disables the query (wilaya undefined) rather than sending a bad request.
- Beacon effects must not double-fire under React 18 StrictMode double-invoke.

---

### Sprint 6: Wiring — auth & account cluster (Assembly & Wiring) — Status: ⬜ Pending

**Goals**
- Login (+ `/staff` landing), Register, and My-Account consume the real hooks/forms with granular states.

**Tasks**
- [ ] **Login:** confirm `useAuth().login` wiring; add the register `<Link>`; keep the generic error
      banner + submitting state. (#wiring)
- [ ] **/staff landing:** `StaffLanding` consumes `usePermissions()` and `<Navigate replace>`s to the
      first permitted page (`PageKey → route` map); empty state when none. (#wiring)
- [ ] **Register:** wire `useWilayas()` (drop `WilayaProvider`, D8 — uuid + nested communes cascade),
      `useValidatePhone()` (blur, debounced via `useDebouncedValue`), `useRegisterClient()`; recap dialog
      is the submit gate; success panel on `{ id }` (no auto-login, no invalidation). Map phone
      `registered`/`pending` → field messages. (#wiring)
- [ ] **My Account:** wire `useClientMe()`, profile RHF (`update-me.schema` → `useUpdateClientMe`,
      Edit/Save/Cancel; phone read-only), password RHF (`change-password.schema` → `useChangeClientPassword`,
      strip `confirmPassword`, success toast + reset); billing tab `MoneyStatusCard`
      (credit/totalPaid/totalSold) + My Orders / My Invoices shortcuts. **Remove** the draft-model
      numeric-status/category logic and the `useState`/`useEffect` mirror. (#wiring)

**Validation**
- [ ] `UpdateMeCommand` payload never contains `phone`; `ChangeMyPasswordCommand` never contains
      `confirmPassword`.
- [ ] `tsc --noEmit` clean; My-Account never renders category; authenticated clients bounce from
      login/register to `/my-account`.

**Risks**
- Dropping `WilayaProvider` changes the register bundle; ensure no other consumer relies on it.
- `usePermissions()` first-page resolution must handle the empty-permissions case gracefully.

---

### Sprint 7: Polish — responsive, memo/callback, beacons, i18n sweep (Polish) — Status: ⬜ Pending

**Goals**
- Mobile-first public responsiveness, targeted memoization per the plan, and a clean i18n/no-inline pass.

**Tasks**
- [ ] Responsive: Catalog filters as `drawer`/`sheet` on mobile; grid 1/2/4 cols; Home sections and
      Detail two-column collapse; account tabs stack on mobile. (#ui)
- [ ] `useMemo` only where the plan calls for it: parsed-filter object (stable query key), derived
      model/commune options, order running total, bounded `relatedIds`. `useCallback` for child-passed
      handlers. (#ui)
- [ ] Beacon timing via `useRef(mountTs)` + unmount cleanup; confirm `meta.silentErrorToast` suppresses
      failure toasts. (#ui)
- [ ] i18n sweep across all seven pages — no inline strings, keys resolve in EN/FR, `ar:""` uniform. (#i18n)

**Validation**
- [ ] `tsc --noEmit` clean; no over-memoization (clarity over premature optimization, rules §5).
- [ ] Global `PublicLayout`/`AdminLayout` intact across loading/error on every page.

**Risks**
- Drawer/sheet filter state must stay URL-synced (don't fork state into the drawer).

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
