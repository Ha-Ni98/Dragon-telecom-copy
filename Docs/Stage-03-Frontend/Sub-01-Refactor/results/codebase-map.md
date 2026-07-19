# Codebase Map — Stage 03 · Sub-01 · Phase 01

> Audit only. No code was changed. This maps **what exists now → what it must become** under
> the strict `/src` layout in `front-end-rules.md`, cross-referenced against `Apps/contract`.

## 0. Scope, sources & method

Three trees are in play. They are **not** peers — each has one role:

| Tree | Role | Treat as |
| --- | --- | --- |
| `Apps/contract` | Source of truth for DTOs / routes / enums (Zod 4) | **WHICH** types & routes exist. Never re-declared locally. |
| `Apps/web` | The strict, rules-aligned React template (infra + one worked example) | **The destination architecture.** Reuse its `lib/`, layouts, providers, shared components, auth. |
| `Mvp/frontend` | AI-generated (Lovable) MVP: the real feature/design breadth, but non-conforming | **The source to standardize.** Mine components / theme / UX; discard mocks, bespoke data layer, bespoke types. |

**Interpretation of the phase file:** `Apps/web` already satisfies the infra/auth/layout parts of
the rules, so this map audits `Mvp/frontend` file-by-file and assigns each a fate against the
`Apps/web` `/src` layout: **PORT** (refactor into the target), **MERGE** (an equal/better version
already exists in `Apps/web` — adopt that one), or **DELETE** (mock/bespoke-infra/duplicate). It
also flags the one piece of `Apps/web` template scaffolding to remove (§9).

Counts below are from `Mvp/frontend/src` (382 `.ts`/`.tsx` files).

---

## 1. Stack & tooling delta (`package.json`)

Approved stack = `front-end-rules.md` + `front-end-best-practices.md`, as already pinned in
`Apps/web/package.json`.

| Package | MVP | Approved / `Apps/web` | Verdict |
| --- | --- | --- | --- |
| **zod** | `^3.25.76` | **`^4.0.0`** (contract + web) | ❌ **Major mismatch — the blocker.** A Zod 3/4 split breaks shared contract schemas and `zodResolver`. Must bump to 4. |
| **@hookform/resolvers** | `^3.10.0` | `^5.2.2` | ❌ Bump to 5 (pairs with Zod 4). |
| **axios** | *absent* | `^1.7.9` | ❌ MVP has **no axios**; it uses raw `fetch`. Add + route everything through `lib/axios.ts`. |
| **@tanstack/react-table** | *absent* | `^8.20.5` | ❌ MVP hand-rolls tables. Adopt the shared `DataTable`. |
| **sonner** | `^1.7.4` | `^2.0.7` | ⚠️ Approved lib, wrong major — align to 2. Also drop the legacy `use-toast`/`<Toaster>` (§6). |
| **date-fns** | `^3.6.0` | *(not in web, but rules-approved replacement for moment)* | ⚠️ Allowed; pin one major. Used in 6 files. |
| **recharts** | `^2.15.4` | rules §6A "available" | ✅ Approved (statistics/charts). 5 files. |
| **vaul** | `^0.9.9` | rules §6A "available" | ✅ Approved (drawer). 1 file. |
| **embla-carousel-react** | `^8.6.0` | rules §6A "available" | ✅ Approved. |
| **cmdk** | `^1.1.1` | *not listed* | ❓ Command palette / search. **ASK** before keeping (rules §6A: do not add libs without permission). |
| **input-otp** | `^1.4.2` | *not listed* | ❓ OTP field. **ASK** — no OTP flow in contract; likely drop. |
| **react-day-picker** | `^8.10.1` | *not listed* | ❓ Calendar. **ASK** — keep only if a date-range filter needs it. |
| **react-resizable-panels** | `^2.1.9` | *not listed* | ❓ Resizable panes. **ASK** — likely drop. |
| **lovable-tagger** (dev) | `^1.1.9` | — | ❌ Lovable build artifact. Purge (and from `vite.config.ts`). |
| **@vitejs/plugin-react-swc** | `^3.11.0` | `@vitejs/plugin-react` | ⚠️ Cosmetic; align to web's plugin unless SWC is wanted. |
| testing (vitest/msw/testing-library) | *absent* | present in web | ❌ MVP has ad-hoc tests only; test setup comes from web (see `front-end-test-rules.md`). |

Also: MVP `name` is `vite_react_shadcn_ts`; the contract package is `@dragon-telecom/contract`;
`Apps/web` currently imports it aliased as `@your-app/contract`; the rules doc calls it
`@app-template/contract`. → **Resolved (Decision #7): rename every alias to
`@dragon-telecom/contract`** (package.json dep key, `tsconfig` paths, Vite alias, all imports).

---

## 2. Tag legend

`#ui-primitive` shadcn/Radix primitive · `#shared-component` reusable composite ·
`#page` route page · `#section` page-specific section · `#legacy-fetch` in-component/raw
`fetch`/`useEffect` data access · `#mock` mock data or mock-backed service · `#inline-string`
hardcoded UI text · `#unapproved-lib` lib needing permission · `#bespoke-infra` re-implements
something `lib/` owns · `#bespoke-types` re-declares contract DTOs · `#duplicate` an equal/better
version already exists in `Apps/web` · `#layout` · `#state` provider/context state.

---

## 3. What `Apps/web` already provides (reuse — do NOT re-port from MVP)

These are conformant and become the shared foundation; the MVP equivalents are `#duplicate`/DELETE:

- **`lib/`** — `axios.ts` (single instance, Bearer, single-flight refresh, 401→`/login` bridge),
  `api-path.ts` (`apiPath`/`withParams`), `query-client.ts` (cache-level error toasts, silent
  401/cancel), `i18n.ts` (`translate`/`getLanguage`, `{en,fr,ar}` model), `query-keys.ts`,
  `token-store.ts`, `realtime.ts`, `utils.ts`.
- **`hooks/`** — `useTranslation`, `useSession`, `useLogin`, `useLogout`, `useDebouncedValue`,
  `useRealtimeStatus`, `use-mobile`.
- **`components/providers/`** — `AuthProvider`, `ThemeProvider` (next-themes, no FOUC),
  `LanguageProvider` (EN/FR).
- **`components/layout/`** — `PublicLayout`, `AdminLayout`, `PublicHeader`, `PublicFooter`,
  `AdminHeader`, `AdminSidebar` (config-driven via `config/nav-links.ts`), `ProtectedRoute`/
  `PublicOnlyRoute`, `RoleGuard`.
- **`components/shared/`** — `DataTable` (TanStack Table + mobile rows), `PageHeader`, `StatCard`
  (+`StatCardSkeleton`), `TableSkeleton`, `EmptyState`, `NotFoundState`, `RouteErrorBoundary`,
  `SimplePagination`, `StatusBadge`, `ThemeToggle`, `LanguageToggle`, `Logo`, `CopyButton`,
  `PageLoader`.
- **`components/ui/`** — 21 shadcn primitives, already on the web stack.
- **`App.tsx`** — data-router with `React.lazy`+`Suspense`, `RoleGuard` subtree, `setRedirect`
  bridge. This is the routing shape MVP routes migrate into.

**Gaps in `Apps/web` to create as features land:** `components/sections/` (does not exist yet);
`src/types/` exists but is empty (fill with genuine **view models** only).

---

## 4. MVP directory-by-directory map

### 4.1 `src/services/*.service.api.ts` (6 files) — `#legacy-fetch #bespoke-infra #bespoke-types`
`auth`, `user`, `client`, `order`, `product`, `supplier`.
**Now:** raw `fetch('${API_BASE_URL}/api/...')` with hardcoded paths; `API_BASE_URL =
import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'`; bespoke envelopes
(`result.data || []`); 404→`return null` (swallows). Auth stores a single `auth_data` blob in
`localStorage`.
**Becomes:** `src/services/<domain>.service.ts` — pure TS, import `{ api }` from `lib/axios`,
compose routes with `apiPath`/`withParams` from **contract** route constants (§5), type params/
returns from **contract DTOs**, unwrap `ApiResponse<T>` → `T`, **throw** (never return `null`/`[]`).
Auth is **DELETE** — `Apps/web` already has the correct token/refresh/session flow.

### 4.2 `src/lib/services/*.service.ts` (19 files) — `#mock #legacy-fetch`
`admin-products`, `admin-clients`, `admin-clients-stats`, `admin-suppliers`, `admin-statistics`,
`admin-logs`, `admin-settings`, `admin-product-information`, `supplier-information`, `suppliers`,
`brands`, `families`, `products`, `dashboard`, `search`, `delivery`, `suggestion`,
`phone-validation`. **Now:** `await sleep(ms); return mockX`. **Becomes:** folded into the real
`src/services/<domain>.service.ts` above; the mock bodies are **DELETED** and replaced with real
axios calls (data-extraction hooks return **typed empty defaults**, per plan §4).

### 4.3 `src/mocks/*` (19 files) — `#mock`
`products`, `enhanced-products`, `admin-products`, `admin-suppliers`, `admin-statistics`,
`admin-logs`, `admin-settings`, `admin-product-information`, `suppliers`, `brands`, `families`,
`models`, `clients`, `orders`, `dashboard`, `search`, `wishlist`, `delivery-fees`, `auth`.
35 files import `@/mocks`. **Becomes:** **DELETE all.** No mock data enters `Apps/web` (explicit
user constraint). Loading/empty UI states cover the gap until services are wired.

### 4.4 `src/hooks/` (64) + `src/hooks-v2/` (72 incl. `clinets-hooks/`) — mixed
Three buckets:
- **Server-state query/mutation hooks** (`use-products`, `use-admin-products`, `use-admin-clients`,
  `use-orders`, `use-suppliers-query`, `use-dashboard-stats`, `use-admin-statistics`,
  `use-admin-logs`, `use-brands-query`, `use-families-query`, `hooks-v2/clinets-hooks/*`, …) →
  **PORT** to `src/hooks/use<Name>.ts` as thin TanStack wrappers over the new services, keyed via
  `lib/query-keys.ts`, typed from contract DTOs. Drop bespoke query keys / inline fetchers.
- **UI/util hooks** (`use-debounce`, `use-mobile`, `use-responsive`, `use-toast`,
  `use-theme`, `use-language`, `use-form-*`, `use-keyboard-navigation`, `use-focus-management`,
  `use-loading-states`) → `use-debounce`/`use-mobile` are **`#duplicate`** of web's
  `useDebouncedValue`/`use-mobile` (DELETE); `use-toast`/`use-theme`/`use-language` are
  `#bespoke-infra` (DELETE — use `sonner`, `ThemeProvider`, `useTranslation`); the rest PORT only
  if a ported component still needs them.
- **`hooks-v2/` + `hooks/` overlap** (two `use-auth`, duplicate client hooks) → `#duplicate`.
  Collapse to one hook per concern; auth → web's `useSession`/`useLogin`.
- **Anti-pattern:** 62 files use `useEffect`; several fetch-in-effect or hold server data in
  `useState`. All such data access must move into query hooks (rules §2/§3, "Never `useEffect` for
  fetching").

### 4.5 `src/types/` (37 files) — `#bespoke-types`
`draft-types/*` (product, client, supplier, order, logs, dashboard, admin, admin-*, api, enums,
routes, wilaya, main-page) **and** `data-base-types/{domain-types,api-request-response-types}/*`.
**Now:** local re-declarations of domain models — **numeric ids** (`idProduct: number`), bespoke
envelopes (`ApiResponse<T> = {success, data: T[], count}`, `SingleResponse<T>`), local `routes.ts`.
**Becomes:** **DELETE the vast majority.** All API shapes come from `@your-app/contract`
(UUID string ids, discriminated `ApiResponse<T>`, `PaginatedResult<T> = {items, meta}`). `src/types`
keeps **only** genuine frontend view models (e.g. a table-row VM, a filter-state shape) — never an
API DTO. See §6 for the envelope/id conflicts this forces.

### 4.6 `src/config/` (3)
- `translations.json` (1529 lines, keys already dot-notation, e.g. `header.home`) — `#inline-string`
  adjacent. **Now:** value shape is a **`[en, fr]` tuple**. **Becomes:** convert every entry to the
  rules' `{ en, fr, ar: "" }` object and **merge into** `Apps/web/src/config/translations.json`
  (reuse existing `common.*`/`auth.*`/`admin.*` keys; don't duplicate). See §8 (i18n) in plan.
- `algeria-wilayas.json`, `algeria-commun.json` — static reference data → move to `src/config/`;
  but wilaya data should come from `PLATFORM_ROUTES.WILAYAS` at runtime → treat local JSON as a
  seed/fallback only (**Open Question #? / platform**).

### 4.7 `src/lib/` (utils) — mixed
- `i18n.ts` + `hooks/use-language.tsx` → `#bespoke-infra #duplicate`, DELETE (web's
  `lib/i18n.ts` + `LanguageProvider` + `useTranslation` win; note web's `t` is **reactive via
  hook**, MVP's tuple `t` is not).
- `constants.ts` (`API_BASE_URL`, `STORAGE_KEYS`) → `#bespoke-infra`; API base moves to
  `VITE_API_URL` in `lib/axios`; keep only real app constants in `config/constants.ts`.
- `utils.ts` (`cn`) → `#duplicate` of web `lib/utils.ts`, DELETE.
- `date-utils.ts`, `order-utils.ts`, `utils/*` (revenue-calculator, product-utils, logging,
  image-validation, thumbnail-generator, accessibility-*, form-reset, performance-optimization) →
  PORT the pure domain helpers actually used by ported components into `src/lib/`; drop dead ones.
- `validation/*.schemas.ts`, `__tests__/*` → re-express form schemas as co-located
  `[name].schema.ts` on **Zod 4**, or import from contract.

### 4.8 `src/components/ui/` (55) — `#ui-primitive`
Superset of web's 21. **MERGE:** for the 21 that overlap, keep **web's** version (correct stack/
tokens). PORT the extra primitives **only if** a ported feature uses them and the lib is approved:
`chart` (recharts ✅), `carousel` (embla ✅), `drawer` (vaul ✅), `avatar`/`accordion`/`alert`/
`popover`/`progress`/`switch`/`radio-group`/`slider`/`breadcrumb`/`scroll-area`/`collapsible`/
`hover-card`/`aspect-ratio`/`toggle`/`navigation-menu` (Radix ✅, add dep). **ASK/DELETE:**
`command`+`search-dialog`+`search-suggestions` (cmdk ❓), `input-otp` (❓), `calendar`
(react-day-picker ❓), `resizable` (react-resizable-panels ❓). **DELETE (bespoke, not shadcn):**
`toast`/`toaster`/`use-toast` (→ sonner), `theme-toggle`/`language-toggle` (→ web's shared
toggles), `sidebar` (web uses config-driven `AdminSidebar`), `user-dropdown`, `mobile-menu`.

### 4.9 `src/components/shared/` (17) — `#shared-component`
`DataTable`, `ErrorBoundary`, `ProductErrorBoundary` → `#duplicate` (use web `DataTable` /
`RouteErrorBoundary`), DELETE. **PORT (real reusable composites, no MVP equivalent in web):**
`ProductCard`, `ProductGrid`, `ProductFilters`, `ProductListHeader`, `ProductCategoryTags`,
`OrderCard`, `CancelOrderDialog`, `BulkOrderModal`, `ProductOrderModal`, `MoneyStatusCard`,
`DeliveryForm`, `PasswordResetForm`, `RegistrationConfirmationDialog` — each refactored to:
contract-typed props, `useTranslation` text, shared `ui/` primitives, no data fetching inside
(data arrives via props from a page/hook). **`WishlistItem` → DELETE** (Decision #1, wishlist
dropped).

### 4.10 `src/components/sections/` (9) — `#section`
`hero-section`, `featured-products`, `categories-section`, `products-section`, `brands-section`,
`orders-list-section`, `ProductImageGallery`, `ProductPricingSection`.
**Becomes:** `src/components/sections/<feature>/` (create the folder in web). These carry the
storefront **UI/UX & design** worth keeping — port markup/layout, strip mock imports, feed data
via props/hooks. **`wishlist-section` → DELETE** (Decision #1).

### 4.11 `src/components/admin/` (91) — `#section` (+ heavy `#inline-string`, some `#state`)
The bulk of the MVP. Families: dashboard cards/sections, products (table/filters/stats/actions/
supply dialog/pricing/images/name-generator/hierarchy), clients (table/filters/stats/modify/
categories), suppliers (table/stats/add/modify/invoices/history/financial), orders (table/stats/
actions/edit/show dialogs), statistics (charts/overview/filters/filtered cards), logs
(table/filters/stats), settings (accounts/delivery-fees/client-categories), plus `excel-file-
uploader`, `drag-drop-area`, `autocomplete-input`, `admin-header`, `admin-sidebar`,
`admin-search-input`.
**Becomes:** split by ownership — page-specific pieces → `pages/admin/<feature>/components/`
(mirrors web's `delivery-companies/components/` precedent); broadly reusable ones → `sections/` or
`shared/`. `admin-header`/`admin-sidebar` are `#duplicate` (web's `AdminHeader`/`AdminSidebar` +
`nav-links.ts` win — extend the nav config to the 8 sections). **DELETE all `*-demo.tsx`**
(`admin-clients-table-demo`, `admin-orders-table-demo`, `admin-order-edit-dialog-demo`,
`admin-order-show-dialog-demo`, `admin-orders-stats-cards-demo`, `admin-clients-filters-demo`,
`admin-clients-stats-demo`, `admin-client-modify-dialog-demo`) — scaffolding duplicates.

### 4.12 `src/components/providers/` (9) — `#state`
- `theme-provider`, `auth-provider` → `#duplicate` of web providers, DELETE.
- `require-auth` / `require-client` / `require-user` → `#duplicate` of web `ProtectedRoute`/
  `RoleGuard`, DELETE (re-express role gating via `RoleGuard allow={[...]}`).
- `wishlist-provider` → **DELETE** (Decision #1, wishlist dropped; no contract route).
- `cart-provider` → **DEFER (Decision #2).** Contract has a **server cart**
  (`CLIENT_ROUTES.CART`/`CART_ITEM`), so cart becomes TanStack-Query-backed — but that wiring is
  Sub-02/Sub-03, not Sub-01. Remove the MVP local cart logic; don't port it now.
- `wilaya-provider`, `product-provider` → `wilaya` data should come from `PLATFORM_ROUTES.WILAYAS`
  (hook, not a context of static JSON); `product-provider` likely collapses into query hooks.

### 4.13 `src/components/layout/` + `src/layouts/AdminLayout.tsx` — `#layout #duplicate`
`header.tsx`, `footer.tsx`, `layouts/AdminLayout.tsx`. **Becomes:** DELETE — web's
`PublicHeader`/`PublicFooter`/`AdminLayout`/`PublicLayout` are the canonical layouts. Port only
**content specifics** (nav items, footer link groups per best-practices §UI/UX) into web's layout
components and `nav-links.ts`. Storefront header commerce UI (search, cart) belongs in
`PublicLayout` only — never admin (rules §6C).

### 4.14 `src/pages/` (19) — `#page`
Public: `Index`, `Products`, `ProductDetails`, `Login`, `Register`, `MyAccount`, `Orders`,
`NotFound`. Admin: `AdminDashboard`, `AdminProducts`, `AdminClients`, `AdminSuppliers`,
`AdminOrders`, `AdminStatistics`, `AdminSettings`, `AdminLogs`, `AdminProductsAdd`,
`AdminProductInformation`, `AdminSupplierInformation`.
**Now (e.g. `AdminProducts.tsx`):** filter/dialog **state + business logic in the page**,
`console.log` debugging, hand-rolled `toast.loading/success/error` orchestration, `setTimeout`
"simulate API", `useLanguage().t`, `useState`-held server data. **Becomes:** `pages/<Name>.tsx` /
`pages/admin/<feature>/<Feature>Page.tsx` (kebab folders like web's `delivery-companies/`) that
**only** render + call hooks + wire interaction: data via query hooks, mutations via mutation hooks
(toasts handled by `query-client`, not the page), text via `useTranslation`, `isLoading`→Skeleton /
`isError`→`NotFoundState` inside the layout. `Login`/`NotFound` are `#duplicate` (web `LoginPage`/
`CatchAllRoute`). Routing merges into web's `App.tsx` router with `lazy`+`Suspense`+`RoleGuard`.

---

## 5. MVP feature → contract module map (the "WHICH")

| MVP surface | Contract module | Route constants (in `Apps/contract`) |
| --- | --- | --- |
| Login / session / logout | identity | `IDENTITY_ROUTES.LOGIN`/`REFRESH`/`LOGOUT`/`ME_PERMISSIONS` |
| Client register / phone-validate | clients | `CLIENT_ROUTES.REGISTER`/`VALIDATE_PHONE` |
| Products / brands / families / models (public + admin) | catalog | `CATALOG_ROUTES.*` |
| Client **categories** | catalog | `CATALOG_ROUTES.CATEGORIES*` *(note: under catalog, not clients)* |
| Admin clients + stats | clients | `CLIENT_ROUTES.ADMIN_LIST`/`ADMIN_STATS`/`ADMIN_DETAIL`/`APPROVE`/`REJECT`/`RESET_PASSWORD` |
| POS clients (counter) | clients | `POS_CLIENT_ROUTES.*` *(no MVP UI yet)* |
| Cart | clients | `CLIENT_ROUTES.CART`/`CART_ITEM` *(server cart — **deferred to Sub-02**, Decision #2)* |
| Suppliers + invoices + payments | purchasing | `PURCHASING_ROUTES.*` |
| Supply / stock / movements | inventory | `INVENTORY_ROUTES.STOCK`/`MOVEMENTS`/`RESERVATIONS`/`ADJUSTMENTS` |
| Orders (client + admin/staff) | orders | `ORDER_ROUTES.*` |
| POS sales | sales | `SALE_ROUTES.*` *(no MVP UI yet)* |
| Invoices / client payments | billing | `BILLING_ROUTES.*` *(no MVP UI yet)* |
| Dashboard + statistics | statistics | `STATS_ROUTES.ADMIN_DASHBOARD`/`OVERVIEW`/`FILTERED`/`CHARTS`/`TOP_PRODUCTS`/`REPORT` |
| Logs | observability | `OBS_ROUTES.LOGS`/`LOG_STATS` |
| Settings | platform | `PLATFORM_ROUTES.SETTINGS`/`SETTINGS_PUBLIC` |
| Delivery **fees** (+ Excel import/export) | platform | `PLATFORM_ROUTES.ADMIN_FEES`/`FEES_IMPORT`/`FEES_EXPORT` |
| Wilayas | platform | `PLATFORM_ROUTES.WILAYAS` |
| Admin accounts / technicians | identity | `IDENTITY_ROUTES.USERS`/`TECHNICIANS`/`ROLES`/`PAGES` |
| **Wishlist** | — **none** — | ❌ no contract route → **dropped (Decision #1)** |
| Repairs | repairs | `REPAIR_ROUTES.*` *(contract has it; MVP has **no** UI — future feature, out of scope here)* |

---

## 6. Envelope, pagination & id conflicts (forces a re-type of every list hook)

| Concern | MVP shape | Contract shape | Consequence |
| --- | --- | --- | --- |
| Success envelope | `{ success, data: T[], count }` / `{ success, data, message }` | discriminated `{ success:true, data:T } \| { success:false, error }` | Services unwrap to `T`; `success:false` throws. |
| Lists / pagination | `data: T[]` + `count` | `PaginatedResult<T> = { items: T[]; meta: PaginationMeta }` | Every list hook reads `items`/`meta`, not `data`/`count`. |
| Entity ids | numeric (`idProduct: number`, `idSupplier`) | **UUID strings** (`z.uuid()`, `:id` params) | All id-typed props/params/keys become `string`. |
| Public product detail | `/products/:productName` (kebab slug) | `CATALOG_ROUTES.PRODUCT_DETAIL = /products/:id` | **Keep the slug as-is (Decision #3);** reconcile in Sub-02/Sub-03. |
| Env var | `VITE_API_BASE_URL` (→ `localhost:5000`) | `VITE_API_URL` (includes `/api/v1`) | Rename; delete hardcoded fallbacks. |

---

## 7. Auth model delta

**MVP:** `authApiService.authenticate()` → stores one `auth_data` JSON blob in `localStorage`;
`useAuth` exposes `authType: 'client' | 'user'`; no tokens, no refresh; `require-*` guards read the
blob. **Contract/web:** JWT (`JWTPayloadSchema` with `type: UserType`, `clientId`/`staffId`),
access+refresh tokens, `token-store.ts`, single-flight `refreshTokens()`, session via
`GET /auth/me`, `RoleGuard`/`ProtectedRoute`. → **Adopt web's auth wholesale; DELETE the MVP auth
stack.** Client-vs-staff routing derives from `UserType`, not a bespoke `authType`.

---

## 8. Design system / theme

| | MVP | `Apps/web` (target) |
| --- | --- | --- |
| Token format | **HSL** (`217 91% 50%`) | **OKLCH** (`0.5 0.24 295`) |
| Identity | "Dragon Telecom — Professional Tech E-commerce": blue primary + cyan accent, gradients (`--gradient-hero`), `product-card` hover, glass | Purple template default; semantic tokens (`surface`, `primary-light`, `primary-hover`, `success`, `warning`, `destructive`), `--shadow-card`, motion keyframes |
| Semantic naming | partial | ✅ matches rules §6B |

**Decision (design):** keep `Apps/web`'s **token *structure*** (OKLCH, semantic names, `tailwind.config.ts`
wiring, `components.json` `rtl:false`) — it's the rules-conformant contract — but **re-skin the
brand palette to the MVP's blue/cyan Dragon-Telecom identity** by editing the OKLCH values in
`index.css`. Port the MVP's *visual* niceties (hero gradient, product-card hover, brand imagery in
`src/assets/`) as utilities/tokens, not as a second HSL system. This is design mining, not a token
rewrite. (Palette is not governed by the rules → noting, not blocking.)

---

## 9. `Apps/web` template content to remove (the "suits our project" cleanup)

`Apps/web` ships one worked example — **delivery-companies** — that is **not backed by the real
contract**: `DELIVERY_COMPANY_ROUTES`, `DeliveryCompanyDTO`, `GetDeliveryCompaniesQuery`,
`CreateDeliveryCompanyCommand`, `UpdateDeliveryCompanyCommand` are imported from the contract but
**do not exist in `Apps/contract`** (delivery is modeled as `PLATFORM_ROUTES` delivery-**fees** +
a free-text `deliveryCompany` string on orders). Affected files:
`services/delivery-companies.service.ts`, `hooks/useDeliveryCompanies.ts`,
`pages/admin/delivery-companies/**`, its `nav-links` entry + `admin.deliveryCompanies.*`/
`admin.settings.companies.*` translation keys, dashboard card, and the delivery-companies tests/
fixtures/MSW handlers.

**Fate:** this vertical is the **pattern reference** (it demonstrates the exact
Service→Hook→Page→schema shape every real feature must adopt) — keep it as the copy-me template
**until** real verticals exist, then **remove it** (it would otherwise fail typecheck against
`@dragon-telecom/contract`). Tracked as **Open Question #6**.

---

## 10. Heaviest technical debt (ranked)

1. **Data layer (largest lift).** 33 files use raw `fetch`, 0 use axios; 8 hardcode
   `http://localhost:5000` via the wrong env var; two bespoke envelopes; 19 mock services +
   35 mock importers. Every service must be rewritten (axios + contract routes + envelope-unwrap +
   throw) and every hook re-typed to contract DTOs.
2. **Type system.** 37 local type files re-declare domain models with **numeric ids** and bespoke
   envelopes — deleted wholesale in favor of contract DTOs (forces the id/pagination remap in §6).
3. **Zod 3 → 4** (+ `@hookform/resolvers` 3 → 5). Blocks sharing contract schemas / `zodResolver`;
   gates every form.
4. **i18n.** 1529-line `[en,fr]` tuple map + non-reactive `useLanguage` across 131 files →
   convert to `{en,fr,ar}`, swap to reactive `useTranslation`, merge into web's `translations.json`,
   and fill the inline-string gaps (toasts, sidebar titles).
5. **Component sprawl.** 188 components incl. 91 admin + duplicate `DataTable`/`ErrorBoundary`/
   theme+language toggles/headers/sidebars that already exist (better) in `Apps/web`, plus 8
   `*-demo` files. Merge/DELETE aggressively before porting.
6. **In-component effects/state.** 62 `useEffect` files; pages (e.g. `AdminProducts`) carry
   business logic, `console.log`, manual toast orchestration, and `setTimeout` fake calls → push
   all data/side-effects into hooks + `query-client`.
