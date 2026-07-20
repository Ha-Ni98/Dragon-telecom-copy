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

### Sprint 1: Schemas & i18n (Foundation) — Status: ⬜ Pending

**Goals**
- All co-located Zod schemas exist and are **compile-time-checked against their contract Command**.
- All translation keys for the seven pages exist (`en`/`fr` real copy, `ar:""`), with the known inline
  strings removed.

**Tasks**
- [ ] Verify/keep `src/pages/login.schema.ts` (already `loginSchema(t)` + `AssertAssignable<LoginCommand>`). (#foundation)
- [ ] `src/pages/register/register.schema.ts` → aligned to `RegisterClientCommand` (`firstName`, `lastName`,
      `phone`, `email?`, `storeName?`, `wilayaId`, `communeId`; **uuid ids**, no password). Add the
      `AssertAssignable` guard. (#foundation)
- [ ] `src/pages/product-detail/order.schema.ts` → aligned to `PlaceOrderCommand` (`productId`, `quantity`
      int≥1 **`.refine(q ≤ availableQuantity)`**, `orderType`, `contact{fullName,phone}`,
      `delivery{wilayaId,communeId,address?}` with the two contract refines: delivery required unless
      PICKUP / forbidden when PICKUP). (#foundation)
- [ ] `src/pages/my-account/update-me.schema.ts` → aligned to `UpdateMeCommand` (`.strict()`; `email?`,
      `storeName?`, `wilayaId?`, `communeId?`, `address?`; **`phone` excluded entirely**). (#foundation)
- [ ] `src/pages/my-account/change-password.schema.ts` → `currentPassword`, `newPassword` (min 6),
      `confirmPassword` + **`.refine` match**; document that `confirmPassword` is stripped before the
      `ChangeMyPasswordCommand` payload. (#foundation)
- [ ] Note (no file): Catalog validates parsed URL params with the contract `ProductListQuerySchema`
      before the query fires — no new schema. (#foundation)
- [ ] Add translation keys per scope: `home.*`, `catalog.*`, `productDetail.*`, `auth.login.*` (+ register
      link, replace the hardcoded `"App Template"` title), `register.*` (+ success/approval panel,
      phone-conflict `registered`/`pending`), `account.*`, `staff.landing.*`, and reuse
      `common.errors.notFound*`, `common.actions.*`. (#i18n)
- [ ] Remove inline-string/SEO debt this set touches: `Register.tsx` inline success SVG/text → keys;
      `Products.tsx` `document.title`/meta `useEffect` deleted (SEO is not this set's concern). (#i18n)

**Validation**
- [ ] Each schema's inferred type is assignable to its contract Command (compile guard present).
- [ ] `tsc --noEmit` clean; no new inline strings introduced.

**Risks**
- `UpdateMeSchema` is `.strict()` — the RHF form must not register a `phone` field or submit will 400.
- `order.schema.ts` needs `availableQuantity` injected (schema factory takes the max), mirroring
  `loginSchema(t)`'s factory pattern.

---

### Sprint 2: Routing, Guards, Lazy & Engine-gap prep (Foundation) — Status: ⬜ Pending

**Goals**
- The route table matches the requirements (id-based detail, `/staff` surface, client-scoped account).
- The two engine gaps (idempotency key, related hydration) are unblocked at the service/decision level.

**Tasks**
- [ ] **D1:** change `/products/:productName` → `/products/:id` in `App.tsx`; retire the by-name path,
      `use-product-details.ts`, `use-product-order.ts`, and `kebabCaseToProductName`. (#routing)
- [ ] **D4:** add the `/staff` route under `RoleGuard allow={[STAFF, ADMIN]}` → a thin `StaffLanding`
      component; add a `PageKey → route` map module (keys from `identity.enums.ts`). (#routing)
- [ ] **D4:** refine `PublicOnlyRoute` + login redirect: `ADMIN`→`/admin`, `STAFF`→`/staff`,
      `CLIENT`→`location.state.from ?? '/'`. (#routing)
- [ ] **D5:** make `/my-account` **CLIENT-scoped** (`RoleGuard allow={[CLIENT]}` or a `ProtectedRoute`
      that accepts an allowed `UserType`); redirect authenticated clients away from `/login` & `/register`
      to `/my-account`. (#routing)
- [ ] Confirm every page keeps `React.lazy()` + `<Suspense fallback={<PageLoader/>}>` (already in place);
      add lazy entries for `StaffLanding`. (#routing)
- [ ] **D6 (engine gap):** add an `Idempotency-Key` header (client `crypto.randomUUID()` per attempt) to
      `orders.service.ts::placeOrder`, surfaced through `usePlaceOrder`. (#wiring)
- [ ] **D7 (engine gap):** decide related-products hydration — implement a bounded (≈4) per-id
      `useCatalogProduct` fan-out for `ProductDetailDto.relatedIds`; record the upstream note (detail
      endpoint should return summaries). (#wiring)

**Validation**
- [ ] `tsc --noEmit` clean after the route/param type changes ripple through link producers.
- [ ] Guards preserve the pre-mount `AuthRestoring` behavior (no `/login` flash on cold start).
- [ ] Layout survives `isError` on any lazily-loaded route (RouteErrorBoundary intact).

**Risks**
- Changing the detail param breaks every `<Link>` producer (Home/Catalog cards, Related strip) — must
  update all in the same sprint to keep `tsc` green.
- Client-scoping `/my-account` must not regress PUB-05 `/orders` (stays any-authenticated).

---

### Sprint 3: Shared DTO-typed primitives (Primitives & States) — Status: ⬜ Pending

**Goals**
- The shared presentational components consumed by this set are **retyped from Sub-01 numeric-id draft
  view models to contract DTOs** (uuid `string` ids) — the D9 prerequisite for all wiring.

**Tasks**
- [ ] `ProductCard` / `ProductGrid` → `ProductWithPricingDto` (uuid `id`, `inStock`, `inCart`,
      `currentPrice`/`guestPrice`/`priceHidden`, `family`/`brand`/`model`, `images`); callbacks keyed on
      `string` id. (#ui)
- [ ] `ProductFilters` → `FamilyDto[]` / `BrandDto[]` / `DeviceModelDto[]`; value model = uuid strings. (#ui)
- [ ] `ProductPricingSection` / `ProductImageGallery` → `ProductDetailDto`. (#ui)
- [ ] `ProductOrderModal` → drive the `order.schema.ts` RHF form; props typed on `ProductDetailDto` +
      `WilayaDto[]` + fee. (#ui)
- [ ] `MoneyStatusCard` → `credit` / `totalPaid` / `totalSold` (from `ClientMeDto`), replacing
      `balance`/`paid`/`credit`. (#ui)
- [ ] `RegistrationConfirmationDialog` → the new register form values (uuid wilaya/commune, `storeName`). (#ui)
- [ ] `DeliveryForm` → server `useWilayas()` (`WilayaDto` nested communes, uuid) — or fold its role into
      `ProductOrderModal` if no other consumer remains. (#ui)

**Validation**
- [ ] `tsc --noEmit` clean — no residual `draft-types` imports in the retyped components.
- [ ] Components stay presentational (no hook/service calls added); text still via `useTranslation`.

**Risks**
- These components are shared with out-of-set pages; retyping may surface callers still on draft models —
  bridge or flag, do not silently break them.

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
