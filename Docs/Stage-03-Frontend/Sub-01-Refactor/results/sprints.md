# Refactor Sprints — Stage 03 · Sub-01 · Phase 02

> Decomposes `plan.md` into a dependency-ordered playbook. **No code in this phase.**
> Ordering is fixed by the phase file: **clean → UI → layouts → data**. Constraint honored:
> purge libs + fix folders **before** extracting data or fixing layouts.

## Working model & invariants

- **"The app" = `Apps/web`.** MVP source (`Mvp/frontend`) is progressively **ported into** `Apps/web`
  and standardized; `Apps/web` must stay green at every sprint boundary.
- **Green gate (every sprint):** `tsc --noEmit` clean **and** `npm run build` succeeds **and** the UI
  still renders (no layout crash) **→ commit on green.** One sprint per fresh session.
- **Types from `@dragon-telecom/contract`** (Decision #7); no mock data ever enters `Apps/web`.
- **Two deliberate sequencing calls (to keep each sprint green):**
  1. **Mock-data deletion runs in Sprint 4**, not Sprint 1 — mocks and their consumers must die
     together (deleting `src/mocks/**` while services still import them breaks `tsc`). Sprint 1
     purges *libraries, duplicate infra, dead files, and folders*; it leaves mock files compiling.
  2. **~~The `delivery-companies` template vertical stays through Sub-01~~ — superseded during
     Sprint 1 execution.** It doesn't compile against the real `@dragon-telecom/contract` (its
     types/routes don't exist there — delivery is modeled as `PLATFORM_ROUTES` fees + a free-text
     field on orders), so it was removed in Sprint 1 rather than Sub-02: keeping broken template
     code around just to preserve it as a "reference" isn't possible once `tsc` must pass. The
     Service→Hook→Page shape is still the pattern to copy for Sub-02's first real domain — it's
     just no longer a live, compiling example in the tree.

**Status legend:** ⬜ Pending · 🟡 In progress · ✅ Done.

---

### Sprint 1: Purge & Structure — Status: ✅ Done (2026-07-19)

**Goals**
- Approved stack only, monorepo on **one Zod major (4)**, alias renamed to
  `@dragon-telecom/contract`, files in the strict `/src` layout, dead/duplicate files gone —
  `Apps/web` still `tsc`-clean and building.

**Tasks**
- [x] Bump `zod → ^4`, `@hookform/resolvers → ^5`; align `sonner → ^2`. Add approved deps a ported
      view needs: `axios`, `recharts`, `embla-carousel-react`, `vaul`, `date-fns`, and the Radix
      primitives from `codebase-map.md §4.8`. (#unapproved-lib)
- [x] Purge `lovable-tagger` (+ its `vite.config.ts` hook) and the legacy shadcn toast stack
      (`ui/{toast,toaster,use-toast}` → `sonner`). (#bespoke-infra)
- [x] **ASK** before keeping `cmdk`, `input-otp`, `react-day-picker`, `react-resizable-panels`
      (rules §6A) — user kept `cmdk`+`react-day-picker`, dropped `input-otp`+`react-resizable-panels`.
      (#unapproved-lib)
- [x] **Alias rename → `@dragon-telecom/contract`** (Decision #7): `package.json` dep key and every
      `@your-app/contract` import in `src/`+`tests/` renamed. No `@your-app`/`@app-template` left.
      (#bespoke-infra)
- [x] Created `components/sections/{landing,orders,product-details}/`, `pages/admin/<feature>/components/`
      for all 8 admin domains (rules §1).
- [x] DELETE orphans: all `components/admin/*-demo.tsx` (8), `test-pagination.js`. (#duplicate)
- [x] DELETE duplicate infra in favor of the `Apps/web` equivalents (consumers repointed in the same
      pass): MVP `lib/i18n`+`hooks/use-language` → `useTranslation`, `lib/utils` `cn` → web `utils`
      (+`formatDZD` reused for MVP's `formatPrice`), `use-debounce` → `useDebouncedValue`,
      `use-mobile`/`use-theme` dropped, `providers/{theme-provider,auth-provider,require-auth,
      require-client,require-user}` → web `AuthProvider`/`RoleGuard`/`ProtectedRoute`,
      `layout/{header,footer}` + `layouts/AdminLayout` dropped (chrome stripped from ported pages;
      `PublicLayout`/`AdminLayout` wiring is Sprint 3), `ui/{theme-toggle,language-toggle,sidebar,
      user-dropdown,mobile-menu}` dropped, `shared/DataTable` dropped (web's TanStack version wins),
      `admin/{admin-header,admin-sidebar}` dropped. (#duplicate #bespoke-infra)
- [x] **Delete wishlist entirely** (Decision #1): `providers/wishlist-provider`, `hooks/use-wishlist`,
      `hooks/use-product-wishlist`, `shared/WishlistItem`, `sections/wishlist-section`,
      `mocks/wishlist`, `shared/BulkOrderModal` (wishlist-only consumer), and all usages/nav entries
      (incl. the `Orders.tsx` wishlist tab, collapsed to a single orders view). (#state)
- [x] Moved all surviving files to targets and fixed import paths (map §1.3) — see **Deviations**
      below for the handful of files reclassified during execution.
- [x] Mock layer (`src/mocks/**`, `lib/services/*` mock bodies) ported and kept compiling, per plan —
      deletion stays deferred to Sprint 4. (#mock)

**Validation**
- [x] `tsc --noEmit` clean and `npm run build` succeeds (no broken imports after moves/renames/deletes).
- [x] App boots (`npm run dev`, HTTP 200 on `/`); currently-routed pages (Landing/Login/Admin
      Dashboard/404) unaffected — newly ported pages aren't wired into routes yet (Sprint 3).
- [x] No `@your-app`/`@app-template` alias anywhere; no unapproved libs in `package.json`; whole
      monorepo on Zod 4.
- [x] Committed on green.
- **Known gap, intentionally out of scope:** ~72 ported MVP files still contain pre-existing
  `console.*` debug calls (codebase-map §10 heaviest-debt item #6). None of the code authored in
  this sprint (auth engine, stubs, adapters) has any. Cleanup rides with Sprint 4's data-extraction
  pass, which touches the same files anyway.

**Deviations from the plan (discovered during execution, not foreseeable from the audit alone):**
1. **The pre-built auth engine didn't match the real contract at all** — `AUTH_ROUTES`,
   `AuthTokensDTO`, `SessionUserDTO`, `RefreshTokenCommand`, `UserRole`, and a `/auth/me` session
   endpoint don't exist anywhere in `@dragon-telecom/contract` or `Apps/api` (identity only exposes
   `IDENTITY_ROUTES` with `LoginResultDto`/`RefreshResultDto`/`RefreshCommand`/`UserType`, and
   `/me/permissions` — no full "who am I" route). This blocked every subsequent step (`AuthProvider`
   wraps the whole app), so it was fixed **before** any MVP file moved, per user decision: session is
   now derived client-side by decoding the access token's JWT claims (`lib/token-store.ts`
   `getSession()`), bootstrapped on cold start via the existing single-flight `refreshTokens()` —
   no backend/contract change. New frontend-only `Session` view model at `src/types/session.ts`.
   Touched: `lib/axios.ts`, `lib/token-store.ts`, `services/auth.service.ts`, `hooks/useSession.ts`,
   `hooks/useLogin.ts`, `components/providers/AuthProvider.tsx`, `components/layout/{ProtectedRoute,
   RoleGuard}.tsx`, `lib/realtime.ts`, `lib/query-keys.ts`, `App.tsx` (`UserRole`→`UserType`).
2. **The `delivery-companies` template vertical was removed now, not in Sub-02** — it doesn't
   compile against the real contract either (`DeliveryCompanyDTO` etc. don't exist; delivery is
   modeled as `PLATFORM_ROUTES` fees + a free-text field on orders), so keeping it would have failed
   Sprint 1's own `tsc` gate. Deleted its pages/service/hook/tests/nav-link/translation keys.
3. **Three genuinely-used error-boundary components were ported, not deleted** — `codebase-map.md`
   originally called `components/error-boundary.tsx`, `shared/ErrorBoundary.tsx`, and
   `shared/ProductErrorBoundary.tsx` duplicate/superseded infra. In practice 11 real ported pages
   structurally depend on them (nested `<ErrorBoundary fallback={...}>` wraps, not simple
   duplicates of route-level `RouteErrorBoundary`), so removing them meant risky JSX surgery across
   11 files for no benefit. Ported as-is (`process.env.NODE_ENV` → `import.meta.env.DEV/PROD` was
   the only fix needed). `admin/product-information-error-boundary.tsx` stayed excluded — genuinely
   unused.
4. **A temporary `hooks/use-toast.ts` compatibility shim was added** — ~20 ported files call the
   legacy shadcn `useToast()` object-call shape (`toast({ title, description, variant })`). Rewriting
   every call site now would pull Sprint 2's "mount a single sonner Toaster" work forward for no
   reason; the shim adapts that shape onto the app's real `sonner` instance (no second `<Toaster/>`)
   and is explicitly commented for deletion once Sprint 2 rewrites the call sites directly.
5. **Cart handling** (Decision #2, deferred): every ported component that touched
   `hooks/use-cart` (`ProductCard`, `ProductPricingSection`, `products-section`, `Products.tsx`) had
   its cart calls replaced with local typed-empty-default no-ops (`isProductInCart` → `false`,
   `addToCart` → no-op async) rather than left unported, so the add-to-cart UI still renders.
6. **~15 additional MVP files turned out to be dead code** (broken imports to files that don't
   exist anywhere in the MVP tree, or zero real consumers) and were excluded rather than fixed:
   `hooks/use-client-categories-query.ts`, `use-data-integration.ts`, `use-form-reset.ts`,
   `use-family-suggestions.ts`, `use-model-suggestions.ts`, `use-supplier-suggestions.ts`,
   `use-form-submission.ts`, `use-image-upload-progress.ts`, all of `hooks-v2/clinets-hooks/*` (6
   files — a whole second, never-wired client-hooks generation), `lib/utils/form-reset.ts`,
   `lib/services/suggestion.service.ts`, `components/sections/featured-products.tsx`,
   `components/ui/{search-dialog,search-suggestions}.tsx`.
7. **A handful of genuine pre-existing MVP type/logic bugs** surfaced only once files compiled
   under `Apps/web`'s stricter `tsconfig` (MVP's own `tsconfig.app.json` never actually ran clean —
   the earlier "0 errors" check was against the wrong root config) and were fixed inline: wrong
   type-import sources (e.g. `Family`/`Brand`/`ClientCategory` imported from the wrong `draft-types`
   submodule in ~15 files), a `keyof typeof import(...)` anti-pattern on two statistics-card files,
   Zod 3→4 API drift (`z.record()` arity, `ZodError.errors`→`.issues`, `required_error`→`error`),
   `NodeJS.Timeout` namespace usage (no `@types/node` globals here — `ReturnType<typeof setTimeout>`
   instead), TanStack Query v4→v5 `cacheTime`→`gcTime`, and several `Pagination` primitive misuses
   (MVP's own smart `<Pagination currentPage=…>` vs `Apps/web`'s shadcn primitive — swapped to the
   shared `SimplePagination` composite throughout).

**Risks (materialized / resolved)**
- Alias rename + folder moves touched nearly every import — done via targeted `sed`/Python codemods
  per batch, validated with `tsc` after each.
- Duplicate-infra deletion required repointing consumers in the same pass — done throughout.
- `#mock`/`#legacy-fetch` intentionally still present, tracked for Sprint 4 as planned.

---

### Sprint 2: UI Standardization & i18n — Status: ⬜ Pending

**Goals**
- Every ported view uses `Apps/web`'s shared components + `ui` primitives; all text flows through
  `useTranslation`; `translations.json` is the `{en,fr,ar}` object model; theme re-skinned to the
  Dragon-Telecom identity; **no inline strings**.

**Tasks**
- [ ] Repoint ported UI to the shared layer: tables → `DataTable`, cards → `StatCard`(+skeleton),
      pagination → `SimplePagination`, empty/error → `EmptyState`/`NotFoundState`, skeletons →
      `TableSkeleton`/`StatCardSkeleton`, toggles → shared `ThemeToggle`/`LanguageToggle`,
      headers → `PageHeader`. Rewrite MVP table column defs to `ColumnDef` (data via props, no
      fetching). (#duplicate #shared-component)
- [ ] Convert `translations.json` values `[en,fr]` → `{ en, fr, ar: "" }` for all ~1500 keys;
      **merge into** `Apps/web/src/config/translations.json`, reusing existing `common.*`/`auth.*`/
      `admin.*` keys; rename divergent keys to `<scope>.<feature>.<element>`. (#inline-string)
- [ ] Swap every `useLanguage().t` → `useTranslation()`; non-component call sites → `translate()`.
- [ ] Replace residual inline strings (toast descriptions, `admin-sidebar` titles, raw JSX text)
      with keys; extend `config/nav-links.ts` to the 8 admin sections. (#inline-string)
- [ ] Re-skin `index.css` **OKLCH** tokens to the MVP blue/cyan palette; port hero-gradient /
      product-card-hover utilities + brand assets. Keep the OKLCH structure, semantic names, and
      `components.json` `rtl:false`. (#layout)
- [ ] Mount a **single** `sonner@2` `<Toaster>`; remove the double-toaster and any `sonner@1` usage.

**Validation**
- [ ] `tsc --noEmit` clean and `npm run build` succeeds; UI renders with the correct theme.
- [ ] No inline strings in JSX; grep for `useLanguage` is clean; EN/FR toggle re-renders text;
      every key has an `ar: ""`.
- [ ] Committed on green.

**Risks**
- Key renames can orphan references → grep all `t('…')` keys after the merge.
- Shared `DataTable`/`StatCard` APIs differ from MVP components → column/prop rewrites needed.

---

### Sprint 3: Layouts & Boundaries — Status: ⬜ Pending

**Goals**
- Public/admin split enforced via `PublicLayout`/`AdminLayout`; routing merged into `App.tsx`
  (`lazy` + `Suspense` + `RoleGuard`); every data section preserves the layout on `isLoading`/
  `isError`.

**Tasks**
- [ ] Merge MVP routes into web's data-router `App.tsx`: public pages under `PublicLayout` (mobile-
      first), admin pages under `RoleGuard allow={[…]}` → `AdminLayout` (desktop-first), login under
      `PublicOnlyRoute`. **Keep the `/products/:productName` slug** (Decision #3). `React.lazy` +
      `<Suspense fallback={<PageLoader/>}>` per top route; `errorElement={<RouteErrorBoundary/>}`.
      (#layout #page)
- [ ] Replace `RequireAuth`/`RequireClient`/`RequireUser` usages with `RoleGuard`/`ProtectedRoute`
      (client vs staff derived from `UserType`, not the MVP `authType`). (#layout)
- [ ] Enforce rules §6C: commerce UI (search + **static/disabled cart shell**, Decision #2) only in
      `PublicLayout`; admin header carries none. Port footer link groups + public header content per
      best-practices §UI/UX into web's layout components.
- [ ] Wrap every data-driven section so the layout persists: `isLoading` → shape-matched `Skeleton`
      (`TableSkeleton`/`StatCardSkeleton`); `isError`/empty → local `NotFoundState`/`EmptyState`
      inside the content area — never a full-screen spinner or a global 404 redirect. Cover
      dashboards, all tables + their stats cards, statistics charts, and detail pages. (#state)

**Validation**
- [ ] `tsc --noEmit` clean and `npm run build` succeeds; all routes reachable; layout persists
      through loading/error states.
- [ ] Admin shows no cart/store-locator; public shows commerce UI; guard redirects behave.
- [ ] Committed on green.

**Risks**
- Auth semantics change (`authType` → `UserType`) → verify guard/redirect behavior on protected
  routes.
- Sections currently take `loading`/`error` props manually → some rewiring overlaps Sprint 4;
  keep them prop-driven here, hook-driven there.

---

### Sprint 4: Data Decoupling — Status: ⬜ Pending

**Goals**
- **Zero** in-component `useEffect`/`fetch`/`axios` for data; every domain has a contract-typed
  **hook + service stub returning typed empty defaults**; all mock data deleted; the app renders
  clean loading/empty states with **no backend** (real axios/routes/MSW is Sub-02).

**Tasks**
- [ ] Per domain, dependency-first (catalog → clients+identity → purchasing+inventory →
      orders+statistics → platform+observability): add `src/services/<domain>.service.ts` typed from
      **contract DTOs**, body returns a typed empty default (`[]`/`null`); add
      `src/hooks/use<Name>.ts` TanStack wrappers keyed via `lib/query-keys.ts`. (#legacy-fetch)
- [ ] Repoint pages/sections/components to those hooks; strip all `useEffect`/`fetch` data access
      and `useState`-held server data; delete in-page toast orchestration, `console.log`, and
      `setTimeout` fake calls (e.g. `AdminProducts`). Toasts belong to `query-client`. (#legacy-fetch #state)
- [ ] **DELETE `src/mocks/**`, the `lib/services` mock bodies, and every `@/mocks` import** (now
      that stubs replace them). (#mock)
- [ ] DELETE `src/services/*.api.ts` and the MVP auth stack; auth via web `useSession`/`useLogin`/
      `useLogout`; drop `VITE_API_BASE_URL` (base URL lives in `lib/axios` via `VITE_API_URL`).
      (#bespoke-infra)
- [ ] DELETE `src/types/**` DTO re-declarations; keep only genuine **view models** in `src/types/`.
      Do it per domain so `tsc` stays green. (#bespoke-types)
- [ ] Convert MVP form schemas to **Zod 4** co-located `[name].schema.ts` (or import contract
      schemas) via `zodResolver`.

**Validation**
- [ ] `tsc --noEmit` clean and `npm run build` succeeds; UI renders with typed empty defaults (lists
      empty, skeletons/empty-states show); no crashes.
- [ ] Grep clean: no `useEffect`/`fetch`/`axios` data access in components; no `@/mocks`; no
      `VITE_API_BASE_URL`; no bespoke `ApiResponse`/`SingleResponse` re-declarations.
- [ ] Committed on green.

**Risks**
- Empty-default rendering exposes weak empty states → lean on the Sprint 3 boundaries.
- Deleting `types/**` can cascade → per-domain deletion keeps `tsc` green.
- Real axios/routes/MSW are intentionally **not** built here → that is Sub-02, patterned on
  `delivery-companies` (which therefore stays until then).

---

## Exit → readiness

On Sprint 4 green, the `plan.md §5` readiness checklist should pass in full. **Deferred to Sub-02**
(not Sub-01): wiring real services/hooks/MSW per domain, the Query-backed cart, the numeric-id→UUID
and `{data,count}`→`{items,meta}` retyping that lands with real DTO wiring, and removing the
`delivery-companies` reference vertical once the first real domain is wired.
