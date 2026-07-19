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
  2. **The `delivery-companies` template vertical stays through Sub-01** as the copy-me
     Service→Hook→Page reference. Its removal happens in **Sub-02** once the first real domain is
     wired (a wired vertical must exist before the reference is deleted). Tracked, not done here.

**Status legend:** ⬜ Pending · 🟡 In progress · ✅ Done.

---

### Sprint 1: Purge & Structure — Status: ⬜ Pending

**Goals**
- Approved stack only, monorepo on **one Zod major (4)**, alias renamed to
  `@dragon-telecom/contract`, files in the strict `/src` layout, dead/duplicate files gone —
  `Apps/web` still `tsc`-clean and building.

**Tasks**
- [ ] Bump `zod → ^4`, `@hookform/resolvers → ^5`; align `sonner → ^2`. Add approved deps a ported
      view needs: `axios`, `recharts`, `embla-carousel-react`, `vaul`, `date-fns`, and the Radix
      primitives from `codebase-map.md §4.8`. (#unapproved-lib)
- [ ] Purge `lovable-tagger` (+ its `vite.config.ts` hook) and the legacy shadcn toast stack
      (`ui/{toast,toaster,use-toast}` → `sonner`). (#bespoke-infra)
- [ ] **ASK** before keeping `cmdk`, `input-otp`, `react-day-picker`, `react-resizable-panels`
      (rules §6A); drop unless approved. (#unapproved-lib)
- [ ] **Alias rename → `@dragon-telecom/contract`** (Decision #7): `Apps/web/package.json` dep key,
      `tsconfig*.json` paths, Vite `resolve.alias`, and every `from "@your-app/contract"` import in
      `src/` + `tests/`. No `@your-app`/`@app-template` left. (#bespoke-infra)
- [ ] Create missing target dirs (`components/sections/`); confirm the strict `/src` layout
      (rules §1).
- [ ] DELETE orphans: all `components/admin/*-demo.tsx` (8), `test-pagination.js`. (#duplicate)
- [ ] DELETE duplicate infra in favor of the `Apps/web` equivalents, **repointing consumers in the
      same commit** so `tsc` stays green: MVP `lib/i18n` + `hooks/use-language` (→ `lib/i18n` +
      `useTranslation`), `lib/utils` `cn` (→ web `utils`), `use-debounce`/`use-mobile`/`use-theme`,
      `providers/{theme-provider,auth-provider,require-auth,require-client,require-user}`,
      `layout/{header,footer}` + `layouts/AdminLayout`,
      `ui/{theme-toggle,language-toggle,sidebar,user-dropdown,mobile-menu}`,
      `shared/{DataTable,ErrorBoundary,ProductErrorBoundary}`, `admin/{admin-header,admin-sidebar}`.
      (#duplicate #bespoke-infra)
- [ ] **Delete wishlist entirely** (Decision #1): `providers/wishlist-provider`,
      `hooks/use-wishlist`, `hooks/use-product-wishlist`, `shared/WishlistItem`,
      `sections/wishlist-section`, `mocks/wishlist`, and all usages/nav entries. (#state)
- [ ] Move surviving files to targets and fix import paths (map §1.3): `services/*` → `services/`,
      server-state `hooks/*`+`hooks-v2/*` → `hooks/`, `sections/*` → `sections/<feature>/`,
      page-specific `admin/*` → `pages/admin/<feature>/components/`, reusable composites → `shared/`,
      approved `ui/*` extras → `ui/`, `pages/*` → `pages/`(+`pages/admin/<feature>/`),
      `assets/*`/`config/*.json` → `assets/`/`config/`.
- [ ] **Do NOT delete `src/mocks/**` or the `lib/services` mock bodies yet** — deferred to Sprint 4
      with service stubbing (deleting now breaks `tsc`). They keep compiling meanwhile. (#mock)

**Validation**
- [ ] `tsc --noEmit` clean and `npm run build` succeeds (no broken imports after moves/renames/deletes).
- [ ] App boots; every route renders (data may still be mock/placeholder).
- [ ] No `@your-app`/`@app-template` alias anywhere; no unapproved libs in `package.json`; whole
      monorepo on Zod 4.
- [ ] Committed on green.

**Risks**
- Alias rename + folder moves touch nearly every import → run as a coordinated codemod; high churn.
- Deleting duplicate infra requires repointing consumers to the `Apps/web` versions **in the same
  commit**, or `tsc` breaks.
- Some `#mock`/`#legacy-fetch` intentionally survives into Sprint 4 (acceptable, tracked).

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
