# Stage 03 · Sub-02 · Phase 02 — Integration Engine Sprints

> **No code.** Bottom-up decomposition of [`plan.md`](./plan.md) into sprints, built **core-out**: Axios +
> Query Client + harness first, then Auth, then feature domains — each fully typed, MSW-backed, and tested
> before the next. One sprint per fresh session in Phase-03.

---

## Reading notes (apply to every sprint)

- **Contract package is `@dragon-telecom/contract`** — the phase/rules docs' `@app-template/contract` is a
  placeholder (plan §0.1 C1). Every `import` and every "types from contract" check below means the real package.
- **The core engine already exists** (Sub-01 Sprint 1): `lib/axios.ts`, `lib/api-path.ts`, `lib/query-client.ts`,
  `lib/token-store.ts`, `services/auth.service.ts`, `hooks/useSession|useLogin|useLogout`, and the MSW harness
  *scaffold*. So Sprints 1–2 are **audit + retype + rebuild-stale-tests**, not build-from-scratch (plan §1).
- **Route → service → hook → key tables are NOT duplicated here** — each feature sprint cites the exact `plan.md §`
  to build against, so the two docs can't drift. Follow the plan's tables verbatim.
- **Route builder reality:** routes are full literal paths; use `apiPath(CONST)` + `withParams(CONST,{…})`, never
  `.BASE`+fragment composition (plan §0.1 C3). Handlers use the same builder via `apiUrl(...)`.

### The service / hook / fixture / MSW pattern (every domain repeats it)

1. **Service** (`src/services/<domain>.service.ts`, pure TS): import the singleton `api` + route consts; type the
   call `api.<verb><ApiResponse<T>>(...)`; `if (!res.data.success) throw`; `return res.data.data` (the unwrapped
   DTO). **Throw, never swallow.** Handle the envelope exceptions (plan §0.2): 204/202-null → `void`; `Blob` for
   PDF/CSV/export; `FormData` for multipart uploads.
2. **Hook** (`src/hooks/use<Name>.ts`): query hooks → `{data,isLoading,isError,error,refetch}` keyed by `qk.*`;
   mutation hooks → `{mutate,mutateAsync,isPending,isError,error}` + `queryClient.invalidateQueries` on success,
   including the **cross-domain** sweeps in plan §3.
3. **Fixture** (`tests/fixtures/data/<domain>.mock.ts`): build via `XResponseSchema.parse({...})`; lists via
   `paginated(ItemSchema).parse({items,meta})`. Provide a populated **and** an empty variant. Never a bare mock.
4. **MSW** (`tests/fixtures/msw/<domain>.handlers.ts`): `apiUrl(CONST)` URLs; export a happy-path array (register
   in `server.ts`) + a named `*ErrorHandlers` map; every route gets a 2xx handler **and** ≥1 explicit 4xx/5xx that
   matches the contract's own failure modes. Wrap bodies with the harness `ok()/fail()/noContent()`.
5. **Integration tests** (`tests/integration/{services,hooks}/`): services → unwrap + mapping + **throws** on
   4xx/5xx + paginated shape + Blob branch; hooks → state transitions + mutation invalidation refetch.

### What NOT to test (all sprints)

TanStack internals; `sonner` rendering (once, in `tests/unit/lib/query-client.test.ts`); "axios attaches a header"
as a goal; `apiPath`/`withParams` per service (once, in `tests/unit/lib/api-path.test.ts`); any `src/**` path with
no test-only branch. Unit tests mock the **hook** (`vi.mock`), never the network; i18n tests mock `useTranslation`
and assert on **keys**, not translated strings.

---

## Sprint order & scope

| # | Sprint | Domains (plan §) | ~Svc fns | Tier | Rationale |
|---|---|---|---|---|---|
| 1 | Core Pipeline | infra + `qk` + MSW harness (§1, §3) | — | Core | Everything depends on it; define **all** keys up front so later cross-invalidations resolve. |
| 2 | Auth / Identity-session | auth (§2.1 top) | 4 | 2 | Token pipeline proven; **rebuild stale auth tests**; add `ME_PERMISSIONS`. |
| 3 | Catalog | catalog (§2.2) | 24 | 3–4 | Foundational DTOs reused by cart/orders/sales; biggest domain → solo. |
| 4 | Clients & POS Clients | clients+pos (§2.3) | 21 | 3–4 | Portal + cart (reuses catalog fixtures) + admin clients + pos-clients. |
| 5 | Platform & Orders | platform (§2.5) + orders (§2.6) | 18 | 3–4 | Storefront delivery (wilayas/fees/settings) + order lifecycle. |
| 6 | Inventory & Purchasing | inventory (§2.4) + purchasing (§2.7) | 18 | 4 | Stock + procurement; both cross-invalidate catalog. |
| 7 | Statistics & Observability | statistics (§2.8) + observability (§2.9) | 14 | 4 | Admin dashboards/reports + audit logs/beacons. |
| 8 | Identity Admin | identity-admin (§2.1 bottom) | 12 | 4 | Users/roles/pages/technicians (technicians feed repairs). |
| 9 | Sales & Repairs & Billing | sales (§2.10) + repairs (§2.11) + billing (§2.12) | 19 | 5 | POS/staff back-office; no MVP UI yet — data layer ahead of Sub-03. |

*Every feature sprint (3–9) implements Services + Hooks + fixtures + MSW handlers + integration tests for its
domain(s), per the pattern above.*

---

### Sprint 1: Core Pipeline — Status: ✅ Done

**Goals**
- Finalize the shared data-layer foundation: one Axios instance, route builder, Query Client, token store, and the
  full central `qk` registry (all 13 domains + cross-invalidation matrix) — so no later sprint touches infra.
- Stand up the reusable MSW/Vitest harness so every later sprint only adds a handler set + fixtures.

**Tasks**
- [x] **Audit `src/lib/axios.ts`** (exists): confirmed one instance, `baseURL=VITE_API_URL`, Bearer request
      interceptor, single-flight `refreshTokens()`, 401 → refresh + replay-once → else `clear()`+redirect,
      `TOKEN_ENDPOINTS` loop-prevention. **Extension done:** populated `PUBLIC_PATH_PREFIXES` (catalog public
      products/brands/families/models, `WILAYAS`, `FEE`, `SETTINGS_PUBLIC`, `VALIDATE_PHONE`, `REGISTER`).
- [x] **Audit `src/lib/api-path.ts`** (exists, verbatim rules §3B): kept as-is; no fragment composition (plan §0.1 C3).
- [x] **Audit `src/lib/query-client.ts`** (exists): confirmed cache-level `onError`, background-refetch-only query
      toasts, `meta.silentErrorToast` escape hatch, 401/`isCancel` silent (plan §1.1). No changes needed.
- [x] **Audit `src/lib/token-store.ts` / `src/types/session.ts`** (exist): confirmed JWT-derived session (plan §1.1). No changes.
- [x] **`src/lib/query-keys.ts` — retyped + extended:** all 13 domains added, ids `string` (UUID), `all()` prefixes +
      filter-embedding list keys, per the full registry in **plan §3**.
- [x] **MSW harness — reused & verified** (`tests/fixtures/msw/{envelope,api-url,server}.ts`, `tests/fixtures/wrappers/*`):
      confirmed `ok/fail/noContent` mirror `sendSuccess`, `apiUrl` uses the same `apiPath`, `server.ts` extension
      point, `setup.ts` `onUnhandledRequest:'error'` + per-test `tokenStore.clear()`, `.env.test` `VITE_API_URL`.
- [x] **Verified `vitest.config.ts`** and `tests/unit/lib/{axios,api-path,query-client,token-store,realtime,utils}.test.ts`.

**Scope note — two adjustments made during execution, both documented here rather than silently absorbed:**
1. **`qkLegacy` compatibility shim added** (not in the original plan). Retyping `qk` broke 5 pre-existing Sub-01
   stub hooks (`use-products.ts`, `use-product-details.ts`, `use-admin-products.ts`, `use-admin-orders.ts`,
   `use-my-account.ts`) that reference numeric-id / MVP-only key shapes (`adminList`, `myAccount`, `productByName`,
   `byStatus`, `search`, numeric `.detail()`) with no contract equivalent. Rewriting those hooks' bodies now would
   be throwaway work — Sprints 3/5/4 replace them wholesale against real services/DTOs. Instead, `query-keys.ts`
   now exports a clearly-labeled, temporary `qkLegacy` object (see its header comment) holding exactly the 10 old
   key-builders those 5 files still need; each entry states which future sprint retires it. The real `qk` registry
   stays 100% aligned to plan §3 with zero legacy shapes mixed in.
2. **`tests/fixtures/data/auth.mock.ts` + `tests/fixtures/msw/auth.handlers.ts` rebuilt in Sprint 1, not Sprint 2**
   (originally planned there). Reason: `tests/fixtures/wrappers/setup.ts` (the global Vitest setup file) imports
   `server.ts`, which unconditionally imports `auth.handlers.ts`, which imports the (stale) `auth.mock.ts` — a
   module-load-time crash (`AuthTokensResponseSchema.parse` on `undefined`) there took down **every** test file in
   the suite at collection time, not just auth-domain tests. This is core-pipeline infrastructure breakage, not an
   isolated auth-domain gap, so it had to be fixed here. Rebuilt to the real shapes: `IDENTITY_ROUTES.{LOGIN,REFRESH,LOGOUT}`
   (no `.BASE` split), `LoginResultResponseSchema`/`LoginResultDto`, `RefreshResultResponseSchema`/`RefreshResultDto`.
   **Scope kept minimal — only what the already-real `auth.service.ts` (`login`/`logout`/`refresh`) needs.**
   `ME_PERMISSIONS` fixtures/handlers and the two **integration test files**
   (`tests/integration/services/auth.service.test.ts`, `tests/integration/hooks/auth.test.tsx`, which still call
   the not-yet-existing `authService.me()`/`qk.auth.me()`) remain Sprint 2's job — see Sprint 2 below, now narrower.
3. **Also reconciled 3 pre-existing test files** referencing the same stale `AUTH_ROUTES`/`UserRole`/`AuthTokensDTO`
   symbols directly (not just via the auth fixtures): `tests/unit/lib/axios.test.ts` (→ `IDENTITY_ROUTES`,
   `RefreshResultDto`, dropped the nonexistent `role` field), `tests/unit/lib/realtime.test.ts` (`UserRole.ADMIN` →
   `UserType.ADMIN`), `tests/unit/components/layout/ProtectedRoute.test.tsx` (mock session rebuilt to the real
   `Session` shape `{userId,type,clientId,staffId,profile}` — the component itself, `ProtectedRoute.tsx`, was
   already correct against `UserType`; only its test was stale). All three are `/src/lib`-scoped or directly
   blocked `tests/unit/lib/*` from being a meaningful vitest-run gate, so within Sprint 1's own risk note ("existing
   `axios.test.ts` may assert stale auth shapes — reconcile if so").

**Validation**
- [x] `tsc --noEmit` clean on `/src`; `tsc --noEmit -p tsconfig.test.json` clean **except** the two Sprint-2-owned
      integration test files (`auth.service.test.ts`, `auth.test.tsx`) — confirmed via `npm run check`.
- [x] `qk` covers all 13 domains with `string` ids; cross-invalidation targets (plan §3) all exist as keys.
- [x] MSW server boots; `onUnhandledRequest:'error'`; harness helpers produce envelope-shaped bodies — confirmed:
      the whole non-Sprint-2 suite (9 files / 60 tests) now runs instead of crashing at collection.
- [x] `vitest run` green on `tests/unit/lib/*`: **46/46 passing** (6 files).
- [x] No test files inside `/src`.
- [x] Committed on green: `fe: integration sprint 1 — core pipeline`.

**Risks (resolved)**
- `qk` numeric→string retype ripple — resolved via `qkLegacy` (see scope note #1), not by prematurely rewriting
  Sprint 3/4/5-owned hooks.
- `tests/unit/lib/axios.test.ts` stale shapes — confirmed and reconciled (see scope note #3).

---

### Sprint 2: Auth / Identity-session — Status: ✅ Done

**Goals**
- Prove the auth service + session hooks against the **real** contract.
- Add the only real "me" endpoint (`ME_PERMISSIONS`) and finish rebuilding the auth integration tests.

**Narrowed scope (Sprint 1 already rebuilt `auth.mock.ts` + `auth.handlers.ts` — see Sprint 1's scope note #2):**
only the `ME_PERMISSIONS` addition and the two integration test files remained.

**Tasks**
- [x] **Audit `src/services/auth.service.ts`** (exists): confirmed `login → LoginResultDto` (+`setLoginSession`),
      `logout → void` (204), `refresh` re-export of the single-flight `refreshTokens`, `IDENTITY_ROUTES`,
      no `/auth/me` (plan §2.1). No changes needed to the existing three functions.
- [x] **`src/services/auth.service.ts` — added** `getMyPermissions(): Promise<string[]>` mapping
      `IDENTITY_ROUTES.ME_PERMISSIONS` (bare `string[]`, no dedicated contract schema — matches
      `IIdentityService.getEffectivePages` on the backend).
- [x] **Hooks:** audited `useSession`/`useLogin`/`useLogout` (all correct, no changes); **added**
      `src/hooks/usePermissions.ts` → `qk.auth.permissions()`.
- [x] **Extended fixtures** `tests/fixtures/data/auth.mock.ts`: added `mockPermissions` (real `PageKey` values) and
      — beyond the planned scope, but necessary — a `makeFakeAccessToken()` helper + `mockJwtPayload` so
      `mockLoginResult`/`mockRefreshResult.accessToken` are now syntactically real (unsigned) JWTs instead of
      opaque strings. Reason: `useSession`'s real behavior is to **decode** the access token
      (`token-store.ts#getSession`), so a plain string never exercised that path — every prior "session" fixture
      assertion was really just checking the JWT-decode failed silently. Added `mockSessionAfterLogin` /
      `mockSessionAfterRefresh` as the two distinct expected `Session` shapes (profile populated only after a real
      `login()`/`setLoginSession()`, never after a bare `setTokens()`/refresh).
- [x] **Extended handlers** `tests/fixtures/msw/auth.handlers.ts`: added `authUrls.mePermissions`, the
      `ME_PERMISSIONS` 200 handler, and `mePermissionsUnauthorized` 401 override.
- [x] **Rebuilt** `tests/integration/services/auth.service.test.ts` and `tests/integration/hooks/auth.test.tsx` —
      see "Finding" below for why this was a behavioral rewrite, not a symbol rename.

**Finding — `useSession`'s queryFn never throws; the old test's "surfaces an error when unauthorized" scenario
doesn't exist for it.** Reading `src/hooks/useSession.ts` closely: every branch resolves to `Session | null` —
no access token + no refresh token → `null`; refresh fails → `catch { clear(); return null; }`; refresh succeeds
or an access token is already present → decode and return. There is no live network call that can surface as
`isError` for this hook (unlike `usePermissions`, a real authenticated GET with no internal catch, which does
throw on 401 — used as the contrast case in the new test file). Replaced the fictitious "surfaces an error"
scenario with the 4 real branches: no-tokens→null, access-token-present→decoded session,
cold-start-refresh-succeeds→decoded session, cold-start-refresh-fails→null (tokens cleared). `useLogin`'s
invalidation test now asserts against a real post-login decoded session (not a fixed mock object) — before login
`useSession` resolves `null` (no tokens), after the invalidated refetch it resolves `mockSessionAfterLogin`.

**Validation**
- [x] `tsc --noEmit` clean (`npm run check`) — **zero errors, whole project**, including the two rebuilt integration files.
- [x] Services unwrap `ApiResponse` and **throw** on error (`getMyPermissions` included); `logout` returns `void` on 204.
- [x] Query hooks return `{data,isLoading,isError,error,refetch}`; `useLogin`/`useLogout` invalidate/clear the right keys.
- [x] MSW intercepts via the route builder; fixtures parse against contract schemas (`LoginResultResponseSchema`,
      `RefreshResultResponseSchema`, `JWTPayloadSchema`).
- [x] Tests cover 200 **and** 401/500 (`getMyPermissions`: 200, 401, cold-start-refresh-then-200; `usePermissions`:
      200, 401). No test files inside `/src`.
- [x] Full suite: **11/11 files, 76/76 tests passing** (up from 60/72 with 2 failing files at Sprint 1 close).
- [x] Committed on green: `fe: integration sprint 2 — auth`.

**Risks (resolved)**
- The single-flight refresh + cold-start path is subtle — reused the existing (working) axios engine as-is; no
  token logic duplicated in the service. Confirmed via the cold-start tests in both rebuilt files.

---

### Sprint 3: Catalog — Status: ✅ Done

**Goals**
- Add real, UUID-typed HTTP for public + staff + admin catalog (products, pricing, images, brands, families,
  models, categories, stats) per **plan §2.2**.
- Establish reusable catalog fixtures (products/brands/families) that downstream domains (cart, orders, sales) reuse.

**Scope correction — "replace the stub" was not possible; added a real service alongside it instead.** Before
writing code, checked which pages/components consume the Sub-01 stub catalog hooks (`use-products.ts`,
`use-product-details.ts`, `use-admin-products.ts`, `use-brands.ts`, `use-models.ts`): **8 files**
(`Products.tsx`, `ProductDetails.tsx`, `AdminProducts.tsx`, `AdminProductsAdd.tsx`, and 4 section/filter
components) import them directly. The global "never touch `/src/pages`/`/src/components`" constraint applies to
every Sub-02 sprint, not just this one — so replacing those hooks' return shapes now would break 8 files this
sprint is barred from fixing. **Resolution:** kept the Sub-01 stub functions/hooks completely untouched (still
serving those 8 pages), and added the real, contract-typed service + hooks **alongside** them under new names.
Real hook rewiring onto the 8 pages is Sub-03 work, not Sub-02 — corrects Sprint 1's handoff note, which
over-optimistically implied catalog `qkLegacy` entries retire "by Sprint 3."

**Tasks**
- [x] **Services** `src/services/catalog.service.ts` — appended all 24 real fns (§2.2), clearly separated from
      the Sub-01 stub section by a header comment; zero name collisions with the 29 existing stub exports
      (contract verbs `listX`/`getX` vs. the stubs' `getXs`/`getXById`). Paginated: products/staff/admin lists →
      `PaginatedResult<…>`; taxonomy/category lists → arrays — confirmed against `Apps/api`'s real router
      (`catalog.routes.ts`) for every HTTP verb, not guessed.
- [x] **Hooks** — 3 new files (mirroring the backend's own `ICatalogProductService`/`ICatalogTaxonomyService`/
      `ICatalogCategoryService` split): `src/hooks/useCatalogProducts.ts` (11 hooks), `useCatalogTaxonomy.ts`
      (9 hooks), `useClientCategories.ts` (3 hooks). Product create/update/pricing/images cross-invalidate
      `qk.inventory.all()` (plan §3); brand/family/model mutations invalidate `.all()` (both the public **and**
      admin cached variant — see qk registry extension below).
- [x] **`qk` registry extension**: `brands`/`families`/`models` were flat parameterized leaf keys with no
      `.all()` prefix, so a mutation couldn't invalidate both the public and admin cached variants together —
      restructured to nested `{all,list}` objects (matching `products`/`adminProducts`). Non-breaking: nothing
      in real Sub-02 code consumed the old flat shape yet.
- [x] **Fixtures** `tests/fixtures/data/catalog.mock.ts` — all DTOs via `.parse`, incl. guest-hidden vs.
      authenticated-pricing product variants, `withCount` vs. without family variant, paginated + (products)
      empty variant.
- [x] **MSW** `tests/fixtures/msw/catalog.handlers.ts` — 27 handler registrations (24 fns, 3 share a URL across
      methods) + 9 named error overrides (400/404/409/500). Registered in `server.ts`.
- [x] **Integration tests** — `tests/integration/services/catalog.service.test.ts` (26 tests) +
      `tests/integration/hooks/catalog.test.tsx` (13 tests) — unwrap, paginated shape, throws, FormData path,
      hook state transitions, mutation invalidation.

**2 real bugs found and fixed while writing tests (not pre-existing — introduced this sprint, caught before commit):**
1. **MSW handler registration order matters exactly like Express route order.** `PRODUCT_STATS`
   (`/admin/products/stats`) was registered *after* `ADMIN_PRODUCT_BY_ID` (`/admin/products/:id`) in the
   handlers array — msw, like the real backend, matches the first registered handler, so the `:id` pattern
   greedily matched "stats" and `productStats()` silently got a full `AdminProductDto` back instead of stats.
   The real `catalog.routes.ts` has an explicit comment about this exact ordering requirement; the MSW array
   needed the same discipline. Fixed by moving `productStats` before `adminProductById`.
2. **Genuine contract gap, not fixed (out of frontend scope): `AddProductImagesCommand.images` collides with
   multer's file-field name.** The command's own metadata array is named `images` (per-image `alt`/`position`/
   `isPrimary`), and multer's `.array('images')` expects file blobs under that exact same multipart field name.
   A `commandToFormData` encoding sends both under one FormData key, so `body.getAll("images")` returns 2
   entries (1 JSON string + 1 File), not 1. Documented in the service (`commandToFormData`'s comment) and
   asserted as the real observed behavior in the test rather than a false "exactly 1 file" expectation — flagged
   for a contract/backend fix (rename one of the two), added to plan.md §6's open-items list.
- [x] Also confirmed (same investigation): `CreateProductSchema`/`AddProductImagesSchema` use strict
      `z.number()`/`z.boolean()` (not `.coerce`) with no JSON-parse preprocessing in
      `validate-request.middleware.ts` — a real multipart body (all-string fields from multer) will 400 against
      the live backend regardless of frontend encoding. Same category of gap as #2 above, also flagged, not
      fixed (backend/contract work).

**Validation**
- [x] `tsc --noEmit` clean (`npm run check`) — whole project, zero errors.
- [x] Services unwrap `ApiResponse` and **throw**; `createProduct`/`addImages` send real `multipart/form-data`
      (verified via `request.headers.get("content-type")` + `request.formData()` in tests).
- [x] Query hooks `{data,isLoading,isError,error,refetch}`; mutations `{mutate,mutateAsync,isPending,...}` +
      correct invalidations (verified via handler-call-count assertions, not just "no crash").
- [x] MSW intercepts (with the route-ordering fix above); fixtures parse against contract schemas; paginated
      fixtures use `paginated(...)`.
- [x] Tests cover 200 **and** 4xx/5xx (26 + 13 = **39 new tests**, all passing); no test files in `/src`.
- [x] Full suite: **13/13 files, 115/115 tests passing** (up from 76/76 at Sprint 2 close).
- [x] Committed on green: `fe: integration sprint 3 — catalog`.
- [x] Lint: new code clean; pre-existing stub-section quote-style debt in `catalog.service.ts` left untouched
      (same precedent as Sprint 1) — confirmed via a reconstruct-and-diff check that `eslint --fix` hadn't
      silently reformatted the untouched 173 pre-existing lines.

**Risks (resolved)**
- Guest-vs-viewer price matrix (`priceHidden`/`currentPrice`/`guestPrice`/`inStock`/`inCart` optionals) —
  covered by two distinct product fixtures (`mockProductGuestHidden`, `mockProductWithPricing`).
- `FamilyDto.productCount` only with `withCount=true` — covered by a real query-flag branch in the MSW handler
  (not a separate named override) plus a dedicated test.
- **New risk discovered, resolved:** the "never touch pages" constraint is stage-wide, not sprint-local — see
  the scope correction above. Every remaining feature sprint (4–9) should assume the same: new hooks under new
  names, `qkLegacy`-style shims only where an existing stub hook's key shape breaks incidentally.

---

### Sprint 4: Clients & POS Clients — Status: ✅ Done

**Goals**
- Add real HTTP for the client portal (validate-phone, register, me, cart), admin clients
  (list/stats/detail/approve/reject/reset/update), and pos-clients (search/create/admin) per **plan §2.3**.

**Scope note (same pattern as Sprint 3):** checked page/component consumers first — `MyAccount.tsx` (3 stub
hooks), `Register.tsx`, and `AdminClients.tsx` (3 more) import the Sub-01 stub clients hooks directly. Kept
those stub functions/hooks untouched; added the real service + 3 new hook files alongside, with names distinct
from all 10 existing stub hook exports (`useClientMe`/`useUpdateClientMe`/`useChangeClientPassword` vs.
`useMyAccount`/`useUpdateMyAccount`/`useResetMyAccountPassword`; `useClientDirectory*` vs. `useAdminClients*`).
No `qkLegacy` additions needed — the 4 stub hooks that import `clients.service.ts` (`use-admin-clients.ts`,
`use-admin-clients-stats.ts`, `use-registration.ts`, `use-modify-client.ts`) use their own local, inline key
registries, never the central `qk`.

**Resolved plan.md §6 `*(confirm)*` items** by reading `Apps/api/src/modules/clients/clients.interface.ts` (the
`IClientsService` interface) directly instead of guessing from the DTO list:
- `register()` → `{ id: string }`, **not** `ClientMeDto` — register does not log the client in or issue tokens.
- `addCartItem`/`changeMyPassword`/`resetClientPassword` → `void`, not an echoed DTO.
- `POS_CLIENT_ROUTES.ADMIN_BY_ID` is **PATCH-only** — there is no GET-by-id POS-client route at all; a
  `getPosClient(id)` function (implied by the plan's naming symmetry) would have no route to call, so it was
  correctly not implemented.

**Tasks**
- [x] **Services** `src/services/clients.service.ts` — 20 real fns appended (not 21 — plan's count included the
      nonexistent `getPosClient`; see above). Cart reuses **catalog** fixtures.
- [x] **Hooks** — 3 new files: `useClientPortal.ts` (8 hooks: identity+cart), `useClientDirectory.ts` (7 hooks:
      admin pipeline), `usePosClients.ts` (5 hooks). Approve/reject invalidate `qk.clients.admin.all()`, which
      — confirmed by test, not assumed — **already sweeps** `qk.clients.admin.stats()` via TanStack's prefix
      matching (`stats()` is nested under the `admin` family in the `qk` registry), satisfying plan §2.3's
      cross-invalidation requirement with no extra invalidation call needed.
- [x] **Fixtures** `tests/fixtures/data/clients.mock.ts` — all DTOs via `.parse`; cart item reuses
      `catalog.mock.ts`'s `mockProductWithPricing` directly (not duplicated) since `CartItemDto.product` nests
      `ProductWithPricingDto`.
- [x] **MSW** `clients.handlers.ts` — 20 handler registrations + 5 named error overrides, with `ADMIN_STATS`
      registered before `ADMIN_DETAIL` (same `:id`-pattern greedy-match risk as Sprint 3's `PRODUCT_STATS`,
      confirmed present here too via the backend's own route-ordering comment).
- [x] **Integration tests** — `clients.service.test.ts` (21 tests) + `clients.test.tsx` (6 tests), incl. the
      `.strict()` extra-key 400 and cart/directory/pos-client mutation invalidation.

**Cross-cutting finding (not clients-specific — corrects Sprint 1/2 fixtures too): the MSW harness's `noContent()`
premise was backwards.** Investigating a `removeFromCart` test crash led to discovering that **every** `204` in
this backend's controllers (there is exactly one — clients' `removeCartItem`) is still routed through
`sendSuccess()`, which always calls `.json(body)` regardless of status. But the WHATWG Fetch spec forbids a body
on null-body statuses (204/205/304) — msw/undici enforce this, and a real browser's fetch/XHR would too — so
that body cannot reliably survive the wire no matter what the backend source code does.
- **Fixed:** `removeFromCart` no longer reads `.data.success` at all (mirrors `logout()`'s existing pattern —
  bare `await`, rely on axios's automatic non-2xx rejection). `clients.handlers.ts` uses `noContent()` (correct).
- **Also fixed retroactively:** Sprint 2's `auth.handlers.ts` had `logout` returning `noContent()` (204,
  bodyless) — but `identity.controller.ts` shows the real logout is `sendSuccess(res, null, 200)`, a real 200
  **with** a genuine envelope (200 isn't a null-body status). Wrong status *and* wrong body shape, silently
  masked because `auth.service.ts`'s `logout()` never read the body either way. Corrected to `ok(null, 200)`.
- **`envelope.ts`'s `noContent()` comment rewritten** to state the corrected rule and point future sprints at
  the right pattern (bare `await`, no body read) for any endpoint that turns out to be a genuine 204.

**Validation**
- [x] `tsc --noEmit` clean (`npm run check`) — whole project, zero errors.
- [x] Services unwrap + **throw**; `changeMyPassword`/`addToCart`/`resetClientPassword` return `void` (200/201
      with a real envelope); `removeFromCart` returns `void` via the corrected bare-await 204 pattern.
- [x] Hook shapes correct; approve/reject invalidate list **and** stats (verified via handler-call-count
      assertions, per-request, not just "no crash").
- [x] MSW intercepts (with the `ADMIN_STATS`/`ADMIN_DETAIL` ordering fix baked in from the start this time);
      fixtures parse against contract schemas; the `.strict()` 400 is asserted.
- [x] Tests cover 200 **and** 4xx/5xx (21 + 6 = **27 new tests**, all passing); no test files in `/src`.
- [x] Full suite: **15/15 files, 142/142 tests passing** (up from 115/115 at Sprint 3 close).
- [x] Committed on green: `fe: integration sprint 4 — clients`.
- [x] Lint: new code clean; pre-existing stub-section debt in `clients.service.ts` (5 pre-existing quote/wrap
      issues) left untouched via the same reconstruct-and-diff technique as Sprint 3.

**Risks (resolved)**
- Mutation response bodies (`REGISTER`/`APPROVE`/`REJECT`/cart writes) were `*(confirm)*` in the plan — resolved
  by reading `clients.interface.ts` directly (see "Resolved plan.md §6 items" above), not guessed.
- `ClientStatus` vs lowercase `PhoneAvailability` — kept distinct in fixtures (`ClientStatus.PENDING`/`APPROVED`
  vs. `PhoneAvailability.AVAILABLE`/`REGISTERED`), no conflation.
- **New risk found, resolved:** the MSW harness's `noContent()` helper's own documented premise was wrong for
  this backend — see the cross-cutting finding above. Any future sprint reaching for `noContent()` should read
  its corrected comment first rather than assuming a bodyless 204 needs no special service-side handling.

---

### Sprint 5: Platform & Orders — Status: ⬜ Pending

**Goals**
- New `platform.service.ts` (wilayas, delivery fees, settings — absorbs the `admin-settings`/`checkout-delivery`
  stubs) per **plan §2.5**, and replace `orders.service.ts` with the full order lifecycle per **plan §2.6**.

**Tasks**
- [ ] **Services** `src/services/platform.service.ts` — 9 fns (§2.5): `listWilayas`/`getFee`/`getAdminFees`/
      `upsertFees`/`importFees`(**FormData**)/`exportFees`(**Blob**)/`getSettings`/`updateSettings`/`getPublicSettings`.
- [ ] **Services** `src/services/orders.service.ts` — 9 fns (§2.6), `STAFF_*`/`ADMIN_*` scope-parameterized;
      `MY_LIST` → array, backoffice list → `PaginatedResult<OrderDto>`.
- [ ] **Hooks** — `qk.platform.*` / `qk.orders.*`; order confirm/return **cross-invalidate**
      `qk.inventory.all()`+`qk.billing.all()`+`qk.clients/posClients`+`qk.stats.all()` (plan §3).
- [ ] **Fixtures** `platform.mock.ts` (`Wilaya`/`Fee`/`Settings`/`PublicSettings`/`AdminFees`) + `orders.mock.ts`
      (`Order`/`OrderStats`, paginated + empty).
- [ ] **MSW** `platform.handlers.ts` + `orders.handlers.ts` — 2xx each; **order-place `.refine()` (delivery⇔PICKUP)
      → two `VALIDATION_ERROR`(400)** cases; fee/settings anonymous 200s.
- [ ] **Integration tests** — incl. Blob export path, PICKUP-vs-delivery validation, scope-parameterized list/confirm.

**Validation**
- [ ] `tsc --noEmit` clean; types from `@dragon-telecom/contract`.
- [ ] Services unwrap + **throw**; `exportFees` returns `Blob`; `importFees` sends `FormData`.
- [ ] Hook shapes correct; cross-domain invalidations present (order confirm/return).
- [ ] MSW intercepts; fixtures parse; `Record<DocType,…>` settings keyed for every `DocType`.
- [ ] 200 **and** 4xx/5xx covered; no tests in `/src`.
- [ ] Committed on green: `fe: integration sprint 5 — platform & orders`.

**Risks**
- `deliveryCompany` is a **free-text string** on orders, not an entity (confirms `delivery-companies` deletion).
- `UpsertFees`/`FEES_IMPORT` result shapes `*(confirm)*` (plan §6.1); `FeeDto.source` must be asserted both ways.

---

### Sprint 6: Inventory & Purchasing — Status: ⬜ Pending

**Goals**
- New `inventory.service.ts` (stock/movements/reservations/adjustments, §2.4) and `purchasing.service.ts`
  (suppliers/invoices/payments — absorbs `admin-suppliers`/`supplier-information` stubs, §2.7).

**Tasks**
- [ ] **Services** `inventory.service.ts` — `getStock`/`exportStockCsv`(**dual-return array vs Blob**),
      `listMovements`/`listReservations` (paginated), `createAdjustment`.
- [ ] **Services** `purchasing.service.ts` — 13 fns (§2.7): suppliers CRUD + detail + stats; invoices CRUD +
      confirm + cancel; payments list + create.
- [ ] **Hooks** — `qk.inventory.*` / `qk.purchasing.*`; `createAdjustment` **cross-invalidates**
      `qk.catalog.adminProducts.all()`+`qk.stats.all()`; `confirmSupplierInvoice` cross-invalidates
      inventory+catalog+supplier; payments invalidate supplier credit (plan §3).
- [ ] **Fixtures** `inventory.mock.ts` (`StockRow`/`Movement`/`Reservation`/`AdjustmentResult`) + `purchasing.mock.ts`
      (`Supplier`/`SupplierInvoice`/`ConfirmResult`/`SupplierPayment`/`SupplierDetail`/`SupplierStats`).
- [ ] **MSW** handlers — 2xx each; **invoice `.refine()` (`amountOnly` XOR `lines`) → 400** (both-absent + both-present);
      DRAFT-only PATCH-after-confirm → `RESOURCE_CONFLICT`(409); stock CSV branch.
- [ ] **Integration tests** — dual-return stock, adjustment cross-invalidation, invoice XOR + 409, confirm reprice.

**Validation**
- [ ] `tsc --noEmit` clean; types from `@dragon-telecom/contract`.
- [ ] Services unwrap + **throw**; `getStock` handles array **and** `Blob`.
- [ ] Hook shapes correct; cross-domain invalidations (adjustment/confirm/payment) present.
- [ ] MSW intercepts; fixtures parse; `Movement` optional numerics tested present+absent.
- [ ] 200 **and** 4xx/5xx covered; no tests in `/src`.
- [ ] Committed on green: `fe: integration sprint 6 — inventory & purchasing`.

**Risks**
- `ConfirmResultDto.repriceCandidates` and line `projectedNewAverageCost` (DRAFT-only) — model both states.
- `getStock` dual-return and `referenceType` open-string on movements.

---

### Sprint 7: Statistics & Observability — Status: ⬜ Pending

**Goals**
- New `statistics.service.ts` (dashboards/overview/filtered/charts/top-products/report — absorbs `dashboard`/
  `admin-statistics` stubs, §2.8) and `observability.service.ts` (activity beacons/logs — absorbs `admin-logs`, §2.9).

**Tasks**
- [ ] **Services** `statistics.service.ts` — 7–8 fns; `getReport`/`exportReportCsv` **dual-return (JSON vs Blob)**.
- [ ] **Services** `observability.service.ts` — beacons (`sendClientActivity`/`sendStaffSearch` → **void, 202+null**),
      `getClientActivity`/`listStaffSearches` (arrays), `listLogs` (paginated), `logStats`.
- [ ] **Hooks** — `qk.stats.*` / `qk.observability.*`; beacons are fire-and-forget mutations with
      `meta:{silentErrorToast:true}` so a failed beacon never toasts (plan §2.9).
- [ ] **Fixtures** `statistics.mock.ts` (`AdminDashboard`/`StaffDashboard`/`Overview`/`Filtered`/`Report`) +
      `observability.mock.ts` (`ClientActivity`/`StaffSearch`/`AuditLog`/`LogStats`).
- [ ] **MSW** handlers — 2xx each; **activity `.refine()` (`SEARCH`+duration) → 400**; report CSV branch;
      **beacons use `ok(null, 202)`**, not 204.
- [ ] **Integration tests** — dual-return report, 202-null beacon returns void, silent-toast beacon, logs pagination.

**Validation**
- [ ] `tsc --noEmit` clean; types from `@dragon-telecom/contract`.
- [ ] Services unwrap + **throw**; beacons return `void` on 202-null; report handles JSON **and** `Blob`.
- [ ] Hook shapes correct; beacon hooks suppress error toasts via `meta`.
- [ ] MSW intercepts; fixtures parse (dashboards validated carefully — most-inferred DTOs).
- [ ] 200 **and** 4xx/5xx covered; no tests in `/src`.
- [ ] Committed on green: `fe: integration sprint 7 — statistics & observability`.

**Risks**
- `AdminDashboardDto`/`StaffDashboardDto` are the **most-inferred DTOs** in the contract (author-flagged) —
  validate against schemas and confirm shapes vs `Apps/api` if fixtures resist (plan §2.8, §6.1).
- `repairsByStatus` is `Record<string,number>`; `CHARTS`/`TOP_PRODUCTS` DTOs `*(confirm)*`.

---

### Sprint 8: Identity Admin — Status: ⬜ Pending

**Goals**
- New `identity.service.ts` for users/roles/pages/technicians (§2.1 bottom) — access-control back-office, separate
  from the auth-session service.

**Tasks**
- [ ] **Services** `src/services/identity.service.ts` — 12 fns (§2.1): `listUsers`(paginated)/`createUser`/`getUser`/
      `updateUser`; `listRoles`/`createRole`/`updateRole`/`setRolePages`; `listPages`; `listTechnicians`/
      `createTechnician`/`updateTechnician`.
- [ ] **Hooks** — `qk.identity.{users,roles,pages,technicians}.*`; create/update mutations invalidate their family.
- [ ] **Fixtures** `identity.mock.ts` — `User`/`Role`/`Page`/`Technician`/`StaffProfile` via `.parse`; paginated
      users + empty variants.
- [ ] **MSW** `identity-admin.handlers.ts` — 2xx each; **create-user `.refine()` (STAFF w/o `roleIds`; ADMIN w/
      `roleIds`) → 400**; 404 on `USER_BY_ID`; 409 on duplicate username.
- [ ] **Integration tests** — both `.refine()` 400s, paginated users, role/technician mutation invalidation.

**Validation**
- [ ] `tsc --noEmit` clean; types from `@dragon-telecom/contract`.
- [ ] Services unwrap + **throw**; `roles`/`pages`/`technicians` lists are arrays, `users` is paginated.
- [ ] Hook shapes correct; family invalidations present.
- [ ] MSW intercepts; fixtures parse; both create-user refine 400s asserted.
- [ ] 200 **and** 4xx/5xx covered; no tests in `/src`.
- [ ] Committed on green: `fe: integration sprint 8 — identity admin`.

**Risks**
- `UserDto.profile`/`email`/`lastLoginAt` optionals; `effectivePages` empty-vs-populated; `roles[]` empty for ADMIN.

---

### Sprint 9: Sales & Repairs & Billing — Status: ⬜ Pending

**Goals**
- New `sales.service.ts` (POS drafts/confirm/returns, §2.10), `repairs.service.ts` (repairs + parts + status,
  §2.11), `billing.service.ts` (invoices + client-payments, §2.12) — the staff/POS back-office. **No MVP UI yet;**
  this builds the data layer ahead of Sub-03.

**Tasks**
- [ ] **Services** `sales.service.ts` — `createDraft`/`updateDraft`/`confirmSale`(→**`ReceiptDto`**)/`listSales`
      (paginated)/`getSale`(by **`reference` string**)/`createReturn`.
- [ ] **Services** `repairs.service.ts` — `listRepairs`(**array**, no pagination)/`createRepair`/`updateRepair`/
      `addRepairPart`/`removeRepairPart`/`updateRepairStatus`; `STAFF_*`/`ADMIN_*` scope-parameterized.
- [ ] **Services** `billing.service.ts` — `getMyInvoices`/`listInvoices`(paginated)/`getInvoice`(by **`number`**)/
      `getInvoicePdf`(**Blob**)/`cancelInvoice`/`createClientPayment`/`listClientPayments`.
- [ ] **Hooks** — `qk.sales.*`/`qk.repairs.*`/`qk.billing.*`; sale confirm/return + repair add-part/complete
      **cross-invalidate** inventory+billing+clients-credit; client-payment invalidates client/pos-client credit (plan §3).
- [ ] **Fixtures** `sales.mock.ts` (`Sale`/`Receipt`), `repairs.mock.ts` (`Repair`), `billing.mock.ts`
      (`Invoice`/`ClientPayment`).
- [ ] **MSW** handlers — 2xx each; `SaleDraft.lines.min(1)` + repair `reportedIssues.min(1)` → 400; state-guard 409s;
      invoice PDF Blob branch; string-keyed detail routes (`:reference`/`:number`).
- [ ] **Integration tests** — receipt-not-sale on confirm, repairs array (no `{items,meta}`), invoice PDF Blob,
      cross-domain credit invalidation, string-key routing.

**Validation**
- [ ] `tsc --noEmit` clean; types from `@dragon-telecom/contract`.
- [ ] Services unwrap + **throw**; `getInvoicePdf` returns `Blob`; `confirmSale` returns `ReceiptDto`.
- [ ] Hook shapes correct; cross-domain (stock/billing/credit) invalidations present.
- [ ] MSW intercepts; fixtures parse; repairs list is a bare array, sales/billing detail keyed by string.
- [ ] 200 **and** 4xx/5xx covered; no tests in `/src`.
- [ ] Committed on green: `fe: integration sprint 9 — sales, repairs & billing`.

**Risks**
- Admin-only cost/profit optionals across all three (staff mapper strips); `InvoiceSource` never REPAIR.
- Several delete/cancel/return response bodies `*(confirm)*` (plan §6.1–6.2) — confirm 204-vs-DTO vs `Apps/api`.
- Tier-5: no consuming UI until Sub-03 — hooks are validated by tests only this stage.

---

## Exit criteria (all sprints ✅)

Every one of the **115 contract routes** (plan §5) has a Service (unwrapped DTO / `void` / `Blob`), a Hook (correct
`qk` key + invalidations incl. cross-domain), an MSW 2xx **and** ≥1 explicit 4xx/5xx handler, and a schema-validated
envelope-shaped fixture — with `tsc --noEmit` clean and `vitest run` green (200 + 4xx/5xx) at each commit. The stale
auth harness is gone (Sprint 2). No test files in `/src`; no UI touched. Ready to plug into the UI in **Sub-03**.

**Phase-03 note:** execute one sprint per fresh session; load only the rules, `plan.md`, `sprints.md`, and the
current sprint's contract module files; commit on green; write `report-sprint-NN.md`; wait for `next`.
