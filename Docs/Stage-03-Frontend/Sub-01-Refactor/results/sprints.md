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

### Sprint 2: UI Standardization & i18n — Status: ✅ Done (2026-07-19)

**Goals**
- Every ported view uses `Apps/web`'s shared components + `ui` primitives; all text flows through
  `useTranslation`; `translations.json` is the `{en,fr,ar}` object model; theme re-skinned to the
  Dragon-Telecom identity; **no inline strings**.

**Tasks**
- [x] Repoint ported UI to the shared layer: tables → `DataTable`, cards → `StatCard`(+skeleton),
      pagination → `SimplePagination`, empty/error → `EmptyState`/`NotFoundState`, skeletons →
      `TableSkeleton`/`StatCardSkeleton`, toggles → shared `ThemeToggle`/`LanguageToggle`,
      headers → `PageHeader`. Rewrite MVP table column defs to `ColumnDef` (data via props, no
      fetching). (#duplicate #shared-component)
- [x] Convert `translations.json` values `[en,fr]` → `{ en, fr, ar: "" }` for all ~1500 keys;
      **merge into** `Apps/web/src/config/translations.json`, reusing existing `common.*`/`auth.*`/
      `admin.*` keys; rename divergent keys to `<scope>.<feature>.<element>`. (#inline-string)
- [x] Swap every `useLanguage().t` → `useTranslation()`; non-component call sites → `translate()`.
      (done in Sprint 1 alongside the file moves.)
- [x] Replace residual inline strings (toast descriptions, `admin-sidebar` titles, raw JSX text)
      with keys; extend `config/nav-links.ts` to the 8 admin sections. (#inline-string)
- [x] Re-skin `index.css` **OKLCH** tokens to the MVP blue/cyan palette; port hero-gradient /
      product-card-hover utilities + brand assets. Keep the OKLCH structure, semantic names, and
      `components.json` `rtl:false`. (#layout)
- [x] Mount a **single** `sonner@2` `<Toaster>`; remove the double-toaster and any `sonner@1` usage.
      (confirmed already correct from Sprint 1 — one `<Toaster/>` in `App.tsx`, no `sonner@1` left.)

**Validation**
- [x] `tsc --noEmit` clean and `npm run build` succeeds; UI renders with the correct theme (verified
      via headless-Chrome screenshots of `/` and `/login` — themed correctly, no layout breakage;
      `/` still shows the template placeholder home since routing/wiring is Sprint 3).
- [x] No inline strings in JSX (final re-scan: only 2 dead/commented-out JSX blocks and 1 legitimate
      language endonym — `LanguageToggle`'s "English"/"Français" — remain, both accepted); grep for
      `useLanguage` is clean; EN/FR toggle re-renders text; every key has an `ar: ""`.
- [x] Committed on green.

**Risks (materialized / resolved)**
- Key renames did not orphan references — new keys were additive, no existing key was renamed.
- Shared `DataTable`/`StatCard` APIs differ from MVP components → column/prop rewrites needed, done
  for all 16 tables and 8 stat-card grids (see Deviations).

**Deviations from the plan (discovered during execution):**
1. **16 raw-`<Table>` admin components converted to `DataTable`**, not just the ones flagged in the
   codebase map: `admin-clients-table`, `admin-orders-table`, `admin-products-table`,
   `admin-suppliers-table`, `admin-logs-table`, `recent-clients-table`, `recent-orders-table`,
   `product-suppliers-table`, `supplier-invoices-table`, `supplier-product-history-table`,
   `admin-accounts-section`, `client-categories-section`, `delivery-fees-section`,
   `pricing-history-section`, `enhanced-pricing-section`. Each got a `ColumnDef<T>[]` + a hand-built
   `renderMobileRow` (the MVP originals mostly had *no* separate mobile layout — mobile card markup
   was authored fresh per table, following the pattern of the ones that already had one) and an
   `EmptyState`/`TableSkeleton` swap for the bespoke loading/empty markup.
2. **`product-hierarchy-section.tsx` was mis-flagged as a table** — it imported `Table`/`Badge` but
   never rendered either (a three-column card+list layout, not a data table); both were genuinely
   dead imports, removed rather than converted. Same latent-dead-code pattern as Sprint 1's `Pagination`
   findings — the MVP was never strictly type-checked, so unused imports accumulated silently.
3. **`DataTable`'s own design contract has no interactive column-header sorting** (documented in its
   source comment: sorting is a pre-render, frontend concern applied to `data`). Two MVP tables
   (`supplier-invoices-table`, `supplier-product-history-table`) had client-side sortable column
   headers (click header → toggle asc/desc). Converted to a `Select` "sort by" + direction-toggle
   `Button` in the toolbar, feeding the same pre-existing `useMemo`-sorted `data` — behavior
   preserved, affordance moved off the table header to match the shared component's contract.
4. **~35 additional missed inline strings surfaced during the table/stat-card conversion**, on top of
   the sweep already completed for pages/hooks: literal English fallback branches that render
   *after* the `t()`-covered loading/error/empty states (e.g. `admin-clients-table`'s success-path
   `CardTitle`/`CardDescription`, `admin-accounts-section`, `client-categories-section`,
   `product-hierarchy-section`, `delivery-fees-section` — entire sections with **zero** `t()` calls
   in their main render path), untranslated `aria-label` template strings (`` `Edit client ${name}` ``
   style, ~15 instances across 5 files), and literal per-row badge text (`'High'/'Medium'/'Low'`
   trend labels, stock-status strings bypassing the already-existing `admin.products.statusInStock`
   family). All fixed with new scoped keys (`translations.json` grew from 1778 → 1891 keys this
   sprint). This confirms the codebase-map's "MVP already uses `t()` extensively" finding from
   Sprint 1 was true for the *first* render branch of each component but not reliably for
   later/success branches — worth double-checking success-path branches specifically in any future
   similar sweep.
5. **`StatCard`'s `trend?: ReactNode` slot absorbs both real trend indicators and generic subtext** —
   used literally for admin-dashboard's `↗/↘ {change}%` comparison arrows, and also repurposed for
   plain descriptive subtext (`admin.products.*` item-count pluralization, `admin.suppliers.*`
   description lines) where the MVP card had a second line of muted text with no numeric comparison.
   No shared-component change needed; the slot's `ReactNode` typing already covers both cases.
6. **Section-level `isError` states were intentionally left on their pre-existing `Alert`/retry-button
   markup, not migrated to `NotFoundState`** — `NotFoundState`'s own doc comment scopes section-level
   `isError` adoption to "Sprint 4 on" (once real hooks replace the mock services and error states
   become reachable); migrating now would be speculative UI for a state Sprint 2 can't yet exercise.
   `EmptyState` (a true "nothing to show" state, not an error) *was* adopted now for the various
   `!data` branches, since those are genuinely reachable today.

---

### Sprint 3: Layouts & Boundaries — Status: ✅ Done (2026-07-19)

**Goals**
- Public/admin split enforced via `PublicLayout`/`AdminLayout`; routing merged into `App.tsx`
  (`lazy` + `Suspense` + `RoleGuard`); every data section preserves the layout on `isLoading`/
  `isError`.

**Tasks**
- [x] Merge MVP routes into web's data-router `App.tsx`: public pages under `PublicLayout` (mobile-
      first), admin pages under `RoleGuard allow={[…]}` → `AdminLayout` (desktop-first), login under
      `PublicOnlyRoute`. **Keep the `/products/:productName` slug** (Decision #3). `React.lazy` +
      `<Suspense fallback={<PageLoader/>}>` per top route; `errorElement={<RouteErrorBoundary/>}`.
      (#layout #page)
- [x] Replace `RequireAuth`/`RequireClient`/`RequireUser` usages with `RoleGuard`/`ProtectedRoute`
      (client vs staff derived from `UserType`, not the MVP `authType`). (#layout) — already done;
      no such usages existed anywhere in the ported tree (verified by grep), only unrelated
      `authType` references to the real contract's `AuthType` discriminator.
- [x] Enforce rules §6C: commerce UI (search + **static/disabled cart shell**, Decision #2) only in
      `PublicLayout`; admin header carries none. Port footer link groups + public header content per
      best-practices §UI/UX into web's layout components.
- [x] Wrap every data-driven section so the layout persists: `isLoading` → shape-matched `Skeleton`
      (`TableSkeleton`/`StatCardSkeleton`); `isError`/empty → local `NotFoundState`/`EmptyState`
      inside the content area — never a full-screen spinner or a global 404 redirect. Cover
      dashboards, all tables + their stats cards, statistics charts, and detail pages. (#state)

**Validation**
- [x] `tsc --noEmit` clean and `npm run build` succeeds; all routes reachable; layout persists
      through loading/error states.
- [x] Admin shows no cart/store-locator; public shows commerce UI; guard redirects behave (verified
      `/admin` → redirects to `/login` when unauthenticated; `/login`/`/register` → redirect away
      when already authenticated).
- [x] Committed on green.

**Risks (materialized / resolved)**
- Auth semantics change (`authType` → `UserType`) → verified: no legacy guard components existed to
  migrate; `RoleGuard`/`ProtectedRoute`/`PublicOnlyRoute` (built in Sprint 1) already use `UserType`.
- Sections currently take `loading`/`error` props manually → confirmed harmless: Sprint 2's
  DataTable/StatCard conversions already made every section's own loading/error/empty branches
  layout-safe; this sprint only needed to fix the *page-level* wrapper divs (see Deviations).

**Deviations from the plan (discovered during execution):**
1. **Admin subtree allows both `ADMIN` and `STAFF`** (`RoleGuard allow={[UserType.ADMIN, UserType.STAFF]}`),
   not just `ADMIN` as the Sprint-1 template placeholder had it — the identity module's own design
   (Page registry seeds STAFF-scope keys only; see identity-sprint1-decisions memory) confirms STAFF
   is meant to reach these back-office pages, with per-page-key restriction being a separate Sub-02
   concern this sprint doesn't implement.
2. **`LandingPage.tsx` and `admin/DashboardPage.tsx` (the Sprint-1 template placeholders) were
   deleted**, replaced by the real ported `Index.tsx` (hero + categories/brands/products sections)
   and `admin/dashboard/AdminDashboard.tsx` respectively, once their routes were repointed. No other
   file referenced either.
3. **`PublicHeader`/`PublicFooter` rebuilt from the MVP's deleted `layout/{header,footer}.tsx`**
   (recovered from the still-present, untouched `Mvp/frontend` reference tree — only the `Apps/web`
   copies were deleted in Sprint 1). Ported: mobile `Sheet` menu (matching `AdminHeader`'s existing
   pattern, not a bespoke `MobileMenu`), desktop nav, Enter-to-navigate search (`useSearchState`/
   `useRecentSearches`, both self-contained), theme/language toggles, auth-aware account area
   (`DropdownMenu`, matching `AdminHeader`'s pattern) vs. a Sign-in button, and a **static/disabled**
   cart icon (Decision #2 — shows a "coming soon" toast, not wired to any cart state). Footer:
   company blurb + static social icons, session-aware quick links, MVP's placeholder contact info
   (phone/email/address — already `XXX`-style placeholders in the MVP, ported as-is), copyright via
   the existing `common.legal.copyright` key (not the MVP's hardcoded "© 2025" string).
   **Deliberately dropped**: the MVP header's live category/brand hover-mega-menu — it depends on
   `useProductData()` → a `ProductProvider` context that isn't mounted anywhere in the app (checked
   `main.tsx`/`App.tsx`); wiring it now would pull forward Sprint 4/Sub-02's data-integration work.
   Also dropped the live `SearchSuggestions` dropdown (deleted in Sprint 1 as duplicate infra) in
   favor of plain Enter-to-navigate, for the same reason.
4. **Found and fixed a real runtime crash**: `Register.tsx` calls `useWilaya()` → `useWilayaContext()`,
   which throws if no `WilayaProvider` ancestor exists — and none was mounted anywhere. Unlike
   `ProductProvider` (needs live data), `WilayaProvider` is pure static Algeria geography reference
   data (two local JSON files, no fetch, no other dependencies), so mounting it is safe and
   in-scope for this sprint (not a Sprint-4/data-decoupling concern). Wired it **locally inside
   `Register.tsx`** (wrapping a renamed `RegisterForm` inner component) rather than globally in
   `main.tsx`, so the ~480KB commune JSON stays in `/register`'s own lazy chunk instead of bloating
   every route's initial bundle.
5. **Found and fixed redundant `min-h-screen` page-wrapper divs** in 8 files (`Index`, `Products`,
   `Orders`, `MyAccount`, `Register`, `ProductDetails` ×3 branches, `AdminClients`, `AdminSuppliers`,
   `AdminLogs`) — each was a leftover from the MVP's original full-page layout (before `PublicLayout`/
   `AdminLayout` existed), and, now nested inside those layouts' own `min-h-screen flex` structure,
   would have forced an extra full-viewport-height of empty space before the footer/next content on
   any page shorter than the viewport. Also removed doubled `p-4` padding in the same 3 admin pages
   (their own inner wrapper duplicated `AdminLayout` main's `p-4 sm:p-6 lg:p-8`).
6. **Found and fixed a copy-paste bug in `AdminSuppliers.tsx`**: its page-wrapper `aria-label` and
   `aria-describedby` referenced `admin.clients.title` and `id="admin-clients-description"` (copied
   from `AdminClients.tsx`) instead of its own `admin.suppliers.title`/`admin-suppliers-description`.
7. **Visual verification**: headless-Chrome screenshots confirmed `/`, `/products`, `/register`,
   `/login` render correctly with real ported content and the Sprint-2 theme; `/admin` correctly
   redirects to `/login` when unauthenticated. Two screenshots (`/` and a product-detail page) came
   back blank on the first attempt — confirmed via DOM dump to be a headless-capture timing artifact
   (real content was present in both cases), not an app bug; resolved by adding
   `--run-all-compositor-stages-before-draw` to the screenshot command.

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
