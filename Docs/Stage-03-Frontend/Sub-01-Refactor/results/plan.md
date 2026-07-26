# Refactor Plan — Stage 03 · Sub-01 · Phase 01

> Companion to `codebase-map.md`. Audit/plan only — **no code in this phase.** Ordered so each step
> unblocks the next. Guiding rule: **standardize, don't add features.** Bring the `Mvp/frontend`
> features/design into `Apps/web`'s strict, rules-aligned `/src`, typed from `Apps/contract`.

Legend for fate: **DELETE** · **MERGE** (adopt web's existing version) · **PORT** (refactor MVP →
target). Contract alias is **`@dragon-telecom/contract`** (matches the package name — see
Decision #7).

> **Resolved decisions (from review, 2026-07-19)** — folded into the steps below:
> **#1 Wishlist → dropped** (delete provider/hooks/section/`WishlistItem`/mocks; the cart is the
> only client-commerce state that survives). **#2 Cart → deferred**, not wired in Sub-01 — cart
> data belongs to Sub-02 (Integration Engine) / Sub-03 (page assembly), per `workflow.md §7`.
> **#3 Public product URL → keep the MVP slug** (`/products/:productName`) as-is. **#6 → yes**,
> remove the `delivery-companies` template vertical once real verticals exist (the first refactored
> real domain becomes the new Sub-02/Sub-03 reference pattern). **#7 → rename every alias to
> `@dragon-telecom`** (package.json dep key, `tsconfig` paths, all imports). Remaining items in §6
> are non-blocking facts handled when data is typed in Sub-02.

> **Sprint 1 (Purge & Structure) — ✅ done 2026-07-19.** Executed with two corrections discovered
> mid-sprint (full report in `sprints.md`'s Sprint 1 section): **(a)** the pre-built auth engine
> referenced contract symbols (`AUTH_ROUTES`, `UserRole`, a `/auth/me` endpoint) that don't exist in
> the real contract — fixed first (JWT-decode session, no backend change) since it blocked
> everything else; **(b)** `delivery-companies` was removed **in Sprint 1**, not deferred to Sub-02
> — it doesn't compile against the real contract either, so it couldn't be kept "as a reference"
> once `tsc` had to pass. See §1.2 and §1.4 below for the resulting fate corrections.

> **Sprint 2 (UI Standardization & i18n) — ✅ done 2026-07-19.** Full report in `sprints.md`'s
> Sprint 2 section. Notable: 16 admin components (not just the ones flagged in `codebase-map.md`)
> used raw `<Table>` and were converted to the shared `DataTable`; `translations.json` grew from
> 1778 → 1891 keys (~35 additional inline strings surfaced mid-conversion, mostly in components'
> success-path render branches that had zero `t()` calls at all — see Sprint 2 Deviation #4); the
> OKLCH theme re-skin was visually verified via headless-Chrome screenshots of `/` and `/login`.

> **Sprint 3 (Layouts & Boundaries) — ✅ done 2026-07-19.** Full report in `sprints.md`'s Sprint 3
> section. All public/admin routes wired into `App.tsx`; admin subtree allows both `ADMIN` and
> `STAFF` (matches the identity module's STAFF-scoped Page registry design); `PublicHeader`/
> `PublicFooter` rebuilt from the MVP's deleted originals (recovered from the still-present
> `Mvp/frontend` reference tree), deliberately dropping the live category/brand mega-menu and search
> suggestions (both depend on providers/components not wired — would pull forward Sprint 4/Sub-02
> work). Found and fixed three real bugs while wiring routes: a `Register.tsx` crash from a missing
> `WilayaProvider`, redundant `min-h-screen` page-wrapper divs in 8 files (doubling effective page
> height inside the new layouts), and a copy-paste `aria-label`/`id` bug in `AdminSuppliers.tsx`.

> **Sprint 4 (Data Decoupling) — ✅ done 2026-07-19.** Full report in `sprints.md`'s Sprint 4 section.
> Scope-clarifying `AskUserQuestion` resolved a contradiction between the task list and this plan's
> own §5/exit note: the stub layer keeps the **existing numeric-id view-model shapes**, not the
> contract's UUID DTOs — that retype is confirmed Sub-02 work, unblocking a much narrower sprint.
> Every domain (catalog → clients+identity → purchasing+inventory → orders+statistics →
> platform+observability) got a `src/services/<domain>.service.ts` + `src/hooks/use<Name>.ts` pair
> returning typed empty defaults, wired via a uniform mutation-stub convention (no-op success for
> simple writes, `throw new Error(NOT_WIRED)` for writes that would otherwise have to fabricate a
> full entity). `src/mocks/**` and `src/lib/services/**` are fully deleted (directories removed);
> the MVP `.api.ts` stack and `VITE_API_BASE_URL` are gone; `src/types/draft-types/api.types.ts` (a
> bespoke `ApiResponse`/`SingleResponse` envelope file Task 7's directory-scoped sweep had missed)
> was caught and deleted in final validation. 13 inline form schemas converted to co-located Zod 4
> `[name].schema.ts` files. A post-Task-8 grep sweep also caught and fixed real `setTimeout`-fake-
> API-call + debug-`console.log` survivors the per-domain pass had left behind in `AdminProducts.tsx`
> and `MyAccount.tsx` (both now have real, if `NOT_WIRED`-stubbed, mutations with hook-owned toasts).
> `npm run lint` (not a stated gate) was run anyway and cross-referenced against only this sprint's
> files: ~10,200 of ~10,300 findings are pre-existing codebase-wide `prettier` quote-style noise
> (confirmed present in an untouched, already-committed Sprint-3 file too); the handful of real
> findings in Sprint-4-authored code were fixed, pre-existing findings in lightly-touched files
> (single import-line changes) were left as-is.

---

## 1. The Purge

### 1.1 Dependencies — uninstall / align (`Apps/web` is the baseline stack)
- **Bump (blocker):** `zod` → `^4`, `@hookform/resolvers` → `^5`. Nothing shared with the contract
  compiles until this is done. Verify the whole monorepo is on **one Zod major** (readiness item).
- **Add (approved):** `axios`, `@tanstack/react-table` (already in web), and the Radix/approved libs
  a ported feature actually needs: `recharts`, `embla-carousel-react`, `vaul`, `date-fns` (+ the
  Radix primitives listed in map §4.8).
- **Align major:** `sonner` → `^2`; drop `@vitejs/plugin-react-swc` in favor of web's plugin
  (optional).
- **Purge:** `lovable-tagger` (+ its `vite.config.ts` hook), the legacy shadcn `use-toast`/`toast`/
  `toaster` stack (→ `sonner`), and any MVP `zod@3`-pinned lockfile state.
- **ASK before keeping** (rules §6A — no new libs without permission): `cmdk`, `input-otp`,
  `react-day-picker`, `react-resizable-panels`. Default = drop unless a ported view needs them.

### 1.2 Files to DELETE outright (no port)
- `src/mocks/**` (19) and every `@/mocks` import (35 files). **No mock data enters `Apps/web`.**
- **Wishlist (Decision #1 — dropped):** `providers/wishlist-provider`, `hooks/use-wishlist`,
  `hooks/use-product-wishlist`, `components/shared/WishlistItem`, `components/sections/wishlist-section`,
  `mocks/wishlist`, and every wishlist import/prop/nav entry.
- `src/lib/services/**` mock bodies (19) — the mock service layer.
- `src/services/auth.service.api.ts` + MVP auth stack (`hooks/use-auth`, `hooks-v2/use-auth`,
  `providers/auth-provider`, `providers/require-auth|require-client|require-user`) → web auth wins.
- Bespoke-infra duplicates: `lib/i18n.ts`, `hooks/use-language.tsx`, `lib/utils.ts` (`cn`),
  `hooks/use-debounce`, `hooks/use-mobile`, `hooks/use-theme`, `providers/theme-provider`,
  `components/ui/{toast,toaster,use-toast,theme-toggle,language-toggle,sidebar,user-dropdown,mobile-menu}`,
  `components/shared/DataTable`,
  `components/admin/{admin-header,admin-sidebar}`, `components/layout/{header,footer}`
  (chrome stripped from ported pages; `PublicLayout`/`AdminLayout` wiring is Sprint 3),
  `layouts/AdminLayout.tsx`.
- All `components/admin/*-demo.tsx` (8) and `test-pagination.js`.
- `src/types/**` — delete after each consumer is repointed to contract DTOs (§4); keep `src/types/`
  only for genuine view models.

### 1.2b Alias rename (Decision #7)
Rename **every** contract alias to `@dragon-telecom/contract`: the dependency key in
`Apps/web/package.json`, the `paths` in `tsconfig*.json`, the Vite `resolve.alias`, and all
`from "@your-app/contract"` imports across `src/` and `tests/`. One canonical name — no
`@your-app` / `@app-template` left anywhere.

### 1.3 Structural moves into the strict `/src` layout
Target dirs (rules §1): `pages/`, `pages/admin/`, `components/{ui,shared,layout,providers,sections}`,
`hooks/`, `services/`, `lib/`, `types/`, `config/`. Create the two missing target dirs
(`components/sections/`, and populate `src/types/` as needed). Move fates:

| MVP path | → Target |
| --- | --- |
| `services/*.api.ts` + used `lib/services/*` | `src/services/<domain>.service.ts` (real axios) |
| `hooks/*`, `hooks-v2/*` (server-state) | `src/hooks/use<Name>.ts` |
| `components/sections/*` | `src/components/sections/<feature>/` |
| `components/admin/*` (page-specific) | `src/pages/admin/<feature>/components/` |
| `components/admin/*` (reusable) | `src/components/sections/` or `shared/` |
| `components/shared/*` (real composites) | `src/components/shared/` |
| `components/ui/*` (approved extras) | `src/components/ui/` |
| `pages/*` | `src/pages/` and `src/pages/admin/<feature>/<Feature>Page.tsx` |
| `config/translations.json` | merged into `Apps/web/src/config/translations.json` |
| `config/algeria-*.json`, `assets/*` | `src/config/`, `src/assets/` |

### 1.4 Remove `Apps/web` template scaffolding — ✅ done in Sprint 1 (not deferred)
Deleted the **delivery-companies** worked example (service/hook/pages/nav entry/translations/
dashboard card/tests) — it's bound to contract symbols that don't exist in `@dragon-telecom/contract`
(map §9), which meant it didn't compile once the alias pointed at the real package (§1.2b), so it
couldn't be kept "as a reference" through Sprint 1's own `tsc` gate. The Service→Hook→Page shape is
still the pattern Sub-02's first real domain should copy — it's just no longer a live example file.

---

## 2. UI Standardization & i18n

### 2.1 Merge duplicates into the shared layer (adopt web's version)
Route every ported view through web's shared components instead of the MVP re-implementations:
`DataTable` (TanStack Table), `PageHeader`, `StatCard`/`StatCardSkeleton`, `TableSkeleton`,
`EmptyState`, `NotFoundState`, `RouteErrorBoundary`, `SimplePagination`, `StatusBadge`,
`ThemeToggle`, `LanguageToggle`, `Logo`, `CopyButton`, `PageLoader`. For `ui/` primitives, keep
web's 21; add only approved extras a feature needs (map §4.8). Net effect: the MVP's ~17 shared +
55 ui shrink to "web's set + a vetted handful."

### 2.2 i18n migration (mostly mechanical — keys already dot-notation)
1. **Convert value shape:** `"key": ["EN","FR"]` → `"key": { "en": "EN", "fr": "FR", "ar": "" }`
   for all ~1500 entries. `ar` is `""` on every key (reserved, EN/FR-only toggle for now).
2. **Merge** into `Apps/web/src/config/translations.json`, **reusing** existing `common.*`, `auth.*`,
   `admin.nav.*`, `admin.dashboard.*` keys — don't duplicate. Rename MVP keys to the
   `<scope>.<feature>.<element>` convention where they diverge (e.g. `header.home` →
   `public.header.home`).
3. **Swap the hook:** every `useLanguage().t` → `useTranslation()` from
   `@/hooks/useTranslation` (reactive; re-renders on toggle). Non-component call sites use
   `translate()`.
4. **Close inline-string gaps:** replace hardcoded strings that bypass i18n — e.g. `AdminProducts`
   toast descriptions (`'Opening product editor...'`), `admin-sidebar` titles (`"Dashboard"`,
   `"Products"`…), any raw JSX text. Keep interpolation via `t('key', { count })`.

### 2.3 Theme
Re-skin `Apps/web/src/index.css` OKLCH tokens to the MVP's blue/cyan Dragon-Telecom identity; port
the hero-gradient / product-card-hover utilities and brand assets. Do **not** reintroduce the MVP's
parallel HSL token system (map §8).

---

## 3. Layouts & Granular States

### 3.1 Layout assignment (rules §6C, best-practices §UI/UX)
- **Public pages** (`Index`, `Products`, `ProductDetails`, `Register`, `MyAccount`, `Orders`) →
  `PublicLayout` (header: logo, search, auth, cart, EN/FR, theme; footer: shipping/returns/privacy/
  terms/store-locator/support/social). **Mobile-first.**
- **Admin pages** (dashboard, products, clients, suppliers, orders, statistics, settings, logs, +
  detail/add pages) → `AdminLayout` (no cart, no store-locator). **Desktop-first.** Extend
  `config/nav-links.ts` to the 8 admin sections (optionally as `NavGroup`s).
- **Login** → its own centered shell (web `LoginPage` precedent). Never mix commerce UI into admin.
- Merge MVP routes into web's `App.tsx` data-router: `React.lazy` + `<Suspense fallback={PageLoader}>`
  per top route, `RoleGuard allow={[...]}` subtrees (client vs staff via `UserType`), `errorElement`.

### 3.2 Loading / error states (rules §4 — layout must persist)
Every data-driven section must render, **inside the layout**: `isLoading` → a shape-matched shadcn
`Skeleton` (`TableSkeleton`/`StatCardSkeleton` for lists/cards), `isError`/empty → local
`<NotFoundState/>` / `<EmptyState/>` — never a full-screen spinner or a global 404 redirect. Sections
to prioritize (they currently pass `loading`/`error` props down manually or crash): dashboard cards,
product/clients/suppliers/orders/logs tables + their stats cards, statistics charts, product/supplier
detail pages.

### 3.3 State ownership
- **Server state → TanStack Query only** (no server data in `useState`/context).
- **Cart (Decision #2 — deferred):** do **not** wire cart data/logic in Sub-01. Keep the header
  cart affordance as a static/disabled shell if a ported layout needs it; the Query-backed cart
  against `CLIENT_ROUTES.CART`/`CART_ITEM` is built in Sub-02/Sub-03. The MVP `cart-provider`'s
  local logic is removed, not ported.
- **UI state** (filters, dialog open, selected row) stays in the page/component but **without**
  business logic or fetching — see §4.

---

## 4. Data Extraction (Component → Hook → Service)

**Sub-01 scope vs Sub-02:** Sub-01 *decouples* — it removes in-component `useEffect`/`fetch`/`axios`
and introduces **contract-typed hooks + service stubs that return typed empty defaults**, so
components compile and render against the right shapes. The **real axios calls, route wiring, and
MSW handlers are Sub-02** (Integration Engine, patterned on the delivery-companies precedent —
`workflow.md §7`). Sub-01 does not need a running backend.

Pattern for every domain (the shape Sub-02 will complete):

- **Service** `src/services/<domain>.service.ts` — pure TS; params/returns typed from **contract
  DTOs**; in Sub-01 the body returns a typed empty default (`[]` / `null`). Sub-02 replaces that body
  with `import { api } from '@/lib/axios'` + `apiPath`/`withParams` over **contract route constants**
  (map §5), unwrapping `ApiResponse<T>` → `T` (lists → `PaginatedResult<T>.items`), **throwing**,
  never returning `null`/`[]`.
- **Hook** `src/hooks/use<Name>.ts` — thin TanStack wrapper. Queries return
  `{ data, isLoading, isError, error, refetch }`, keyed via `lib/query-keys.ts`. Mutations expose
  `{ mutate, mutateAsync, isPending, ... }` and `invalidateQueries` on success. No toasts in hooks
  (`query-client` owns them); no manual cache mutation.
- **Component/Page** — render + call hooks + handle interaction. **No `useEffect`/`fetch`/`axios`**
  in components. Forms use RHF + Zod 4 (`[name].schema.ts` or contract schema) via `zodResolver`.

**Bootstrapping without a backend:** until each service is wired, its hook returns **typed empty
defaults** — `[]` for lists (`{ items: [], meta: {…} }` unwrapped to `[]`), `null`/`undefined` for
singletons — and the §3.2 loading/empty states carry the UI. **No mock data.**

**Extraction order (dependency-first):**
1. **catalog** (products/brands/families/models) — feeds storefront + admin products + supply.
2. **clients** (admin clients, categories) + **identity** admin accounts. *(Cart deferred — #2.)*
3. **purchasing** (suppliers/invoices) + **inventory** (supply/stock).
4. **orders** + **statistics/dashboard**.
5. **platform** (settings, delivery-fees, wilayas) + **observability** (logs).

Concrete "fetching now → hook that replaces it": `AdminProducts.tsx`/`use-admin-products` →
`useAdminProducts(filters)` + `useAdminProductStats()` (drop console.logs, `setTimeout` fakes,
in-page toast orchestration); `products.service.ts`(mock) → `catalog.service.ts` (axios);
`auth.service.api.ts` → web `useSession`/`useLogin`; `use-dashboard-stats` → `useAdminDashboard()`
over `STATS_ROUTES.ADMIN_DASHBOARD`.

---

## 5. Readiness Checklist (exit criteria for the refactor)

> Re-checked at Sprint 4 close (2026-07-19). Two items (`Data layer`, `Contract-bound`) describe
> real HTTP/contract-DTO wiring, which the Sprint-4 scope decision (§ `sprints.md` Sprint 4
> Deviation #1) confirmed is Sub-02 work — they're marked accordingly below rather than checked, per
> this same plan's own §6 item 4 ("non-blocking, handled when data is typed in Sub-02").

- [ ] **Libs:** `lovable-tagger`, mock data, legacy `use-toast`, and unapproved libs (`cmdk`/
      `input-otp`/`react-day-picker`/`react-resizable-panels` unless approved) removed. Mock data
      removal confirmed (`src/mocks/` deleted, Sprint 4). `lovable-tagger` not present in
      `package.json`. `use-toast.ts`/`cmdk`/`react-day-picker` still present and still consumed
      (shadcn `Toast`/`Command`/`Calendar` primitives) — approval status was never explicitly
      recorded by any sprint; left unchecked pending that call rather than removed unreviewed.
- [x] **One Zod major:** `Apps/web` on Zod 4 (`"zod": "^4.0.0"`) + `@hookform/resolvers ^5.2.2`,
      matching the contract (verified in `package.json`; landed in Sprint 1, all Sprint 4 schema
      extractions use the same Zod 4 API).
- [x] **Structure:** files live in the strict `/src` layout; no `mocks/`, no `services/*.api.ts`,
      no `lib/services/` mock layer, no `types/` re-declaring contract DTOs (Sprint 4 — including
      `types/draft-types/api.types.ts`, caught in final validation, see Sprint 4 Deviation #4).
- [~] **Data layer:** every service goes through the single `lib/axios` instance + contract route
      constants + envelope-unwrap + throw; **no raw `fetch`, no hardcoded URLs, no
      `VITE_API_BASE_URL`** (use `VITE_API_URL`). Partially true by design: `VITE_API_BASE_URL` is
      gone, no raw `fetch`/`axios` in components, and the real Sprint-1 auth engine already goes
      through `lib/axios` + contract routes. The Sprint-4 stub services deliberately do **not** —
      they return typed empty defaults on the existing view-model shapes, not real HTTP calls; real
      per-domain wiring through `lib/axios`+contract is Sub-02.
- [x] **No in-component data access:** zero `useEffect`/`fetch`/`axios` for fetching in components;
      all server state via TanStack Query hooks; no server data in `useState`/context (Sprint 4;
      grep-verified — only `refetch()` and the real auth engine's `axios.isAxiosError` remain).
- [x] **i18n:** all UI text via `useTranslation`; `translations.json` is `{en,fr,ar}` with `ar:""`;
      no inline strings; EN/FR toggle only (Sprint 2).
- [x] **Layouts:** public vs admin split enforced (no commerce UI in admin); routing uses
      `lazy`+`Suspense`+`RoleGuard`; every section preserves layout on `isLoading`/`isError`
      (Sprint 3).
- [~] **Contract-bound:** all API types imported from **`@dragon-telecom/contract`** (no
      `@your-app`/`@app-template` left); the delivery-companies template vertical removed once real
      verticals land. Alias rename done (Sprint 1). Contract-DTO typing and the
      `delivery-companies` removal are both intentionally deferred to Sub-02 (the stub layer keeps
      view-model shapes; `delivery-companies` stays as the reference vertical until a real one is
      wired against it).
- [x] **Wishlist fully removed; cart deferred** (no cart data/logic wired in Sub-01; Sprint 1/4).

---

## 6. Decisions & remaining notes

**Resolved (2026-07-19 review) — folded into the steps above:**
1. **Wishlist → dropped.** No contract route; feature removed entirely (§1.2).
2. **Cart → deferred** to Sub-02/Sub-03; not wired in Sub-01 (§3.3).
3. **Public product URL → keep the MVP slug** (`/products/:productName`) as-is; the
   `CATALOG_ROUTES.PRODUCT_DETAIL = /products/:id` reconciliation is a Sub-02/Sub-03 concern.
6. **Delivery-companies template vertical → remove** once real verticals exist; the first refactored
   real domain becomes the new Sub-02/Sub-03 reference pattern (§1.4).
7. **Alias → `@dragon-telecom/contract`** everywhere (§1.2b).

**Non-blocking, handled when data is typed in Sub-02 (no action needed now):**
4. **Numeric ids → UUID strings** — surfaces automatically when hooks/services are typed to contract
   DTOs; nothing in Sub-01 depends on numeric ids once mocks are gone.
5. **List envelope** — admin tables move from `{data, count}` to `PaginatedResult<T> = {items, meta}`
   when list services are wired (Sub-02).
8. **Excel import/export** — verify `PLATFORM_ROUTES.FEES_IMPORT`/`FEES_EXPORT` request/response DTOs
   exist when the platform domain is wired (Sub-02); if missing, it's a Stage-01 gap.
9. **Out-of-scope contract modules** — `repairs`, `sales` (POS), `billing` invoices, `POS_CLIENT`
   have contract support but **no MVP UI**; future features, not part of this refactor.
