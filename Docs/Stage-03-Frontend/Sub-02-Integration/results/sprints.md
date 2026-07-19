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

### Sprint 3: Catalog — Status: ⬜ Pending

**Goals**
- Replace the `catalog.service.ts` stub with real, UUID-typed HTTP for public + staff + admin catalog (products,
  pricing, images, brands, families, models, categories, stats) per **plan §2.2**.
- Establish reusable catalog fixtures (products/brands/families) that downstream domains (cart, orders, sales) reuse.

**Tasks**
- [ ] **Services** `src/services/catalog.service.ts` — all 24 fns in plan §2.2 (`listProducts`/`getProduct`/
      `listStaffProducts`/`listAdminProducts`/`createProduct`(**FormData**)/`updateProduct`/`updatePricing`/
      `addImages`(**FormData**)/`updateImages`/`productStats`/brands·families·models·categories CRUD). Paginated:
      products/staff/admin lists → `PaginatedResult<…>`; taxonomy lists → arrays.
- [ ] **Hooks** `src/hooks/*` — queries + mutations per plan §2.2, keys under `qk.catalog.*`; product create/update/
      pricing/images **cross-invalidate** `qk.inventory.all()` + `qk.catalog.products.all()` (plan §3).
- [ ] **Fixtures** `tests/fixtures/data/catalog.mock.ts` — `ProductWithPricingResponseSchema`/`ProductDetailResponseSchema`/
      `StaffProductResponseSchema`/`AdminProductResponseSchema`/`Brand`/`Family`/`DeviceModel`/`ClientCategory`/
      `ProductStats` via `.parse`; paginated + empty variants.
- [ ] **MSW** `tests/fixtures/msw/catalog.handlers.ts` — 2xx for each; `VALIDATION_ERROR`(400) for the 5 create
      `.refine()` XORs, `RESOURCE_NOT_FOUND`(404) on detail, `RESOURCE_CONFLICT`(409) where applicable.
- [ ] **Integration tests** — services (unwrap, paginated shape, throws, FormData path) + hooks (states, invalidation).

**Validation**
- [ ] `tsc --noEmit` clean; all types from `@dragon-telecom/contract`.
- [ ] Services unwrap `ApiResponse` and **throw**; multipart create/images send `FormData`.
- [ ] Query hooks `{data,isLoading,isError,error,refetch}`; mutations `{mutate,mutateAsync,isPending,...}` + correct (incl. cross-domain) invalidations.
- [ ] MSW intercepts; fixtures parse against contract schemas; paginated fixtures use `paginated(...)`.
- [ ] Tests cover 200 **and** 4xx/5xx; no test files in `/src`.
- [ ] Committed on green: `fe: integration sprint 3 — catalog`.

**Risks**
- Guest-vs-viewer price matrix (`priceHidden`/`currentPrice`/`guestPrice`/`inStock`/`inCart` optionals) and
  admin-only cost/quantity fields — fixtures must cover present **and** absent (plan §2.2 edge cases).
- `FamilyDto.productCount` only with `withCount=true`; `ProductSort` exactly 4 values.

---

### Sprint 4: Clients & POS Clients — Status: ⬜ Pending

**Goals**
- Replace the `clients.service.ts` stub with real HTTP for the client portal (validate-phone, register, me, cart),
  admin clients (list/stats/detail/approve/reject/reset/update), and pos-clients (search/create/admin) per **plan §2.3**.

**Tasks**
- [ ] **Services** `src/services/clients.service.ts` — all 21 fns in plan §2.3; cart reuses **catalog** fixtures
      (`CartItemDto.product` nests `ProductWithPricingDto`).
- [ ] **Hooks** — `qk.clients.*` + `qk.posClients.*`; approve/reject **cross-invalidate** `qk.clients.admin.stats()`;
      pos-client search debounced (reuse `use-debounced-search`).
- [ ] **Fixtures** `tests/fixtures/data/clients.mock.ts` — `ClientMe`/`AdminClient`/`PosClient`/`CartItem`/
      `ValidatePhoneResult`/`ClientStats` via `.parse`; paginated admin list + empty variants.
- [ ] **MSW** `clients.handlers.ts` — 2xx each; **`UpdateMeCommand` extra-key (`phone`) → `VALIDATION_ERROR`(400)**
      (`.strict()`), 404 on detail, 409 on register/approve conflicts.
- [ ] **Integration tests** — incl. the `ME PATCH phone → 400` scenario and cart mutation invalidation.

**Validation**
- [ ] `tsc --noEmit` clean; types from `@dragon-telecom/contract`.
- [ ] Services unwrap + **throw**; `changeMyPassword`/`resetClientPassword` return `void`.
- [ ] Hooks shapes correct; approve/reject invalidate list **and** stats.
- [ ] MSW intercepts; fixtures parse; the `.strict()` 400 is asserted.
- [ ] 200 **and** 4xx/5xx covered; no tests in `/src`.
- [ ] Committed on green: `fe: integration sprint 4 — clients`.

**Risks**
- Several mutation response bodies (`REGISTER`/`APPROVE`/`REJECT`/cart writes) are `*(confirm)*` in the plan —
  confirm against `Apps/api/src/modules/clients/*.controller.ts` before finalizing return types (plan §6.1).
- `ClientStatus` vs lowercase `PhoneAvailability` — don't conflate the enums.

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
