# Stage 03 · Sub-02 · Phase 01 — Integration Engine Plan

> **Audit + plan only. Zero code.** This maps the type-safe data pipeline (Axios → Services → Hooks
> → TanStack Query + MSW tests) from `@dragon-telecom/contract` before any wiring is written.
> No UI thinking — 100% the data layer.

---

## 0. Executive summary & how to read this

- The **contract** (`Apps/contract`, package `@dragon-telecom/contract`) is the single source of truth for
  routes and DTOs. Everything below traces to a file there.
- **The core engine already exists and is real** (from Sub-01 Sprint 1): `lib/axios.ts`, `lib/api-path.ts`,
  `lib/query-client.ts`, `lib/token-store.ts`, `services/auth.service.ts`, `hooks/useSession|useLogin|useLogout`,
  and a partial MSW harness. Sub-02 is **not** "build the engine from scratch" — it is: (a) audit/retype the
  core, (b) **rebuild the stale auth test fixtures**, (c) replace every remaining stub service body with real
  Axios calls typed to contract DTOs, and add the hook + MSW + tests for each.
- Every other `src/services/*.service.ts` today returns **typed empty defaults on numeric-id view models**
  (Sub-01 stub layer). Sub-02 replaces those bodies with real HTTP and **retypes to the contract's UUID DTOs
  and `{items,meta}` pagination**.

### 0.1 HOW-conflicts resolved (rules vs. reality) — read before executing

Standing rule: *rules govern HOW, phase files WHAT/WHEN, the contract WHICH; resolve HOW conflicts toward the
rules and note them.* Several rule/phase statements are **illustrative** and already contradicted by the
built, contract-accurate engine. Each is resolved toward the **contract + the shipped Sprint-1 engine** (which
is authoritative and passing), and flagged here rather than silently followed:

| # | Rules / phase say | Reality (contract + `Apps/api` + shipped engine) | Resolution |
|---|---|---|---|
| C1 | Package `@app-template/contract` (rules, phase-02/03) | Package is `@dragon-telecom/contract`; web imports it directly | Use `@dragon-telecom/contract`. Treat rules' name as placeholder. |
| C2 | **Cookie auth**; "attach auth from cookies"; 401 redirect (rules §3A, phase §Step2/Step3) | Backend reads **`Authorization: Bearer`** only (no cookie-parser, no `Set-Cookie`). Engine uses an in-memory access token + persisted refresh token + single-flight refresh (`lib/token-store.ts`, `lib/axios.ts`) | Keep **Bearer + token-store + single-flight refresh** (already built, user-approved Sprint 1). 401 loop-prevention still applies. |
| C3 | Routes are `BASE` + fragments, composed via `apiPath(USER_ROUTES.BASE, GET_BY_ID)` (rules §3B example) | Every route constant is a **full literal path** (`IDENTITY_ROUTES.USER_BY_ID = '/admin/users/:id'`) — no `.BASE` split anywhere | `apiPath(CONST)` normalizes a single full path; `withParams(CONST, {id})` fills `:id`/`:reference`/`:number`/`:partId`/`:productId`/`:chart`/`:type`. Composition-of-fragments does not apply. |
| C4 | Pattern new domains "on `delivery-companies`" (phase baseline note) | `delivery-companies` was **deleted in Sub-01 Sprint 1** (never existed in the real contract) | Reference pattern = the **auth vertical** (`auth.service.ts` + `services`/`hooks` shapes) and the MSW harness helpers (`envelope.ts`, `api-url.ts`), **not** its stale tests (see C5). |
| C5 | "MSW test harness … already exists" (phase baseline) | The harness *scaffold* exists (`server.ts`, `envelope.ts`, `api-url.ts`, `createQueryWrapper`, `setup.ts`) but the **auth fixtures/tests are stale**: they import `AUTH_ROUTES`, `AuthTokensResponseSchema`, `SessionUserDTO`, `UserRole`, `authService.me()`, `qk.auth.me()` — **none exist** in the real contract/code | **Rebuild** `auth.mock.ts`, `auth.handlers.ts`, `integration/services/auth.service.test.ts`, `integration/hooks/auth.test.tsx` against `IDENTITY_ROUTES` / `LoginResultDto` / `UserType` / JWT-derived `Session` / `qk.auth.session()`. This is a Sub-02 Sprint-1/2 task, not "already done". |
| C6 | `qk` registry is the key source (rules §C) | `lib/query-keys.ts` exists but is **partial** (auth/catalog/clients/orders only) and uses **numeric ids** (`productById:(id:number)`) | Retype every id param to `string` (UUID) and extend `qk` to all 13 domains (see §3). |

None of these rise to a *genuine* blocking conflict (the engine already shipped this way with user approval in
Sub-01), so execution proceeds — but each must be honored, not "corrected back" to the rule's illustrative form.

### 0.2 The envelope & pagination contract (the spine of every service)

From `Apps/contract/src/common/types.ts` + `Apps/api/src/common/http/response.ts` (`sendSuccess`):

- **Success envelope:** `{ success: true, data: T, message?: string }`.
- **Error envelope:** `{ success: false, error: { code: ErrorCode, message: string, details?: unknown } }`.
- `ApiResponse<T>` is **type-only** (discriminated on `success`) — **there is no `ApiResponseSchema`.** Fixtures
  wrap the *inner* parsed DTO manually: `{ success: true, data: XResponseSchema.parse(...) }` (the harness's
  `ok()`/`fail()` helpers already do this — reuse them).
- **Services unwrap:** type the call `api.get<ApiResponse<T>>(...)`; axios rejects non-2xx (errors throw and
  bubble), so on resolve check `if (!res.data.success) throw new Error(res.data.error.message)` (defensive) and
  `return res.data.data` — the inner `T`, never the envelope.
- **Lists:** the inner `T` is either `PaginatedResult<Dto> = { items: Dto[]; meta: { page, limit, total, totalPages } }`
  **or a bare `Dto[]`**. Rule confirmed against `Apps/api` interfaces: **a list is paginated iff its `*Query`
  schema carries `page`+`limit`; otherwise it is a bare array.** (e.g. `listProducts → PaginatedResult<…>`,
  `listBrands/listFamilies/listModels/listRoles/listTechnicians → Dto[]`, `getStock → StockRowDto[]`.) This
  **replaces** the MVP's `{data[], count}` numeric shape everywhere.
- **Envelope exceptions (do NOT unwrap `.data.data`):**
  - **204 no body:** `logout` and (likely) `DELETE` routes → service returns `void`; use the harness `noContent()`.
  - **202 + null-data envelope:** observability beacons (`sendSuccess(res, null, 202)`) → service returns `void`
    but the body *is* `{success:true,data:null}`.
  - **Binary/file responses:** billing `*_PDF`, `PLATFORM_ROUTES.FEES_EXPORT`, `INVENTORY_ROUTES.STOCK?export=csv`,
    `STATS_ROUTES.REPORT?format=csv` → `responseType:'blob'`, return the `Blob`, no envelope.
  - **Multipart uploads (request side):** catalog product create + `IMAGES` (image files), `PLATFORM_ROUTES.FEES_IMPORT`
    (Excel) → send `FormData`, not JSON; the Zod command is the *accompanying metadata*, files travel outside it.

### 0.3 Scope & sprint-tiering (feeds phase-02 `sprints.md`)

"Every contract route → a Service → a Hook" is the completeness bar (§5). Routes are tiered by build order and
by whether MVP UI exists to consume them (UI wiring itself is **Sub-03**, out of scope here — but the data layer
is built now for all of them):

- **Tier 1 — Core pipeline (exists; audit + retype + rebuild stale tests).** §1.
- **Tier 2 — Identity/session auth (exists; rebuild fixtures/tests).** §2.1.
- **Tier 3 — Public storefront** (has MVP UI): catalog-public, platform-public (wilayas/fee/public-settings),
  clients-public (validate-phone/register/me/cart), orders (place/my), client activity beacon. §2.3–2.6.
- **Tier 4 — Admin (has MVP UI):** catalog-admin, clients-admin, purchasing, platform-admin (fees/settings),
  statistics, observability (logs), inventory, identity-admin (users/roles/pages/technicians). §2.
- **Tier 5 — Staff/POS (no MVP UI yet; build for contract-completeness + Sub-03):** sales/POS, pos-clients,
  repairs, billing (invoices/client-payments), orders-staff endpoints, staff dashboards, staff-search beacon. §2.

---

## 1. Core Setup (Axios · route builder · Query Client · token store · MSW harness)

### 1.1 What already exists (audit — mostly keep as-is)

| File | State | Sub-02 action |
|---|---|---|
| `src/lib/api-path.ts` | ✅ Verbatim from rules §3B (`apiPath`, `withParams`) | Keep. No fragment-composition needed (C3). |
| `src/lib/axios.ts` | ✅ Real: one instance, `baseURL=VITE_API_URL`, Bearer request interceptor, **single-flight `refreshTokens()`**, 401 → refresh+replay-once → else `clear()`+`redirectToLogin()`, `TOKEN_ENDPOINTS` + `PUBLIC_PATH_PREFIXES` loop-prevention, `setRedirect()` bridge | Keep. Only extension: populate `PUBLIC_PATH_PREFIXES` for anonymous client-portal GETs (catalog/wilayas/fee/register/validate-phone) so a 401 there isn't treated as an expired session. |
| `src/lib/query-client.ts` | ✅ Real, richer than rules sketch: cache-level `onError`; `isSilent` (401 + `axios.isCancel`); query toast **only on background-refetch** (`query.state.data !== undefined`); mutation toast with `meta.silentErrorToast` escape hatch; `translate()` i18n; retry `<1` on 5xx/network only | Keep. Satisfies rules §C + phase Step 2. |
| `src/lib/token-store.ts` | ✅ Real: in-memory access token, persisted refresh + display-only profile cache, `setLoginSession`/`setTokens`/`getSession()` (JWT-decode), `clear()` | Keep. |
| `src/types/session.ts` | ✅ Frontend view model (`userId/type/clientId/staffId/profile`) from JWT claims | Keep. |
| `src/lib/query-keys.ts` (`qk`) | ⚠️ Partial + **numeric ids** | **Retype ids → `string`; extend to all domains** (§3). |

### 1.2 MSW harness — what exists vs. what to rebuild

- ✅ **Keep:** `tests/fixtures/msw/envelope.ts` (`ok`/`fail`/`noContent` — mirror `sendSuccess`), `msw/api-url.ts`
  (`apiUrl(...)` uses the *same* `apiPath`), `msw/server.ts` (append-handlers extension point),
  `wrappers/createQueryWrapper.tsx`, `wrappers/setup.ts` (`onUnhandledRequest:'error'`, JSDOM stubs, per-test
  `tokenStore.clear()`), `wrappers/mockTranslation.ts`, `.env.test` (`VITE_API_URL`).
- 🔴 **Rebuild (stale — C5):** `tests/fixtures/data/auth.mock.ts`, `tests/fixtures/msw/auth.handlers.ts`,
  `tests/integration/services/auth.service.test.ts`, `tests/integration/hooks/auth.test.tsx`. They reference
  `AUTH_ROUTES`, `AuthTokens*`, `SessionUser*`, `UserRole`, `authService.me()`, `qk.auth.me()` — all nonexistent.
  Retarget to `IDENTITY_ROUTES.{LOGIN,REFRESH,LOGOUT,ME_PERMISSIONS}`, `LoginResultResponseSchema`/`LoginResultDto`,
  `UserType`, the JWT-decoded `Session`, and `qk.auth.session()`.

### 1.3 Core test boundaries (what NOT to test)

- **Don't** assert "axios attaches a header" as a goal in itself; **do** assert the *interceptor's observable
  reactions*: 401 → single-flight refresh → replay once → 2nd 401 → `clear()`+redirect; a `TOKEN_ENDPOINTS`
  401 never refreshes; concurrent 401s share one refresh. (Covered by `tests/unit/lib/axios.test.ts` — verify
  it still aligns after C2/C5.)
- **Don't** test TanStack internals, `sonner` rendering (query-client toast wiring is unit-tested once in
  `tests/unit/lib/query-client.test.ts`), or thin wrappers over built-ins.
- **Don't** re-test `apiPath`/`withParams` per service — one unit test (`tests/unit/lib/api-path.test.ts`) suffices.

---

## 2. Domain Mapping (Service · Hook · MSW handler per domain)

**Conventions for every table:** *Input* = request Command / Query / path Params (all Zod-typed in the contract);
*Returns* = the **unwrapped** DTO a service resolves to; *Hook* = TanStack wrapper. Query hooks return
`{data,isLoading,isError,error,refetch}`; mutation hooks return `{mutate,mutateAsync,isPending,isError,error}` and
`invalidateQueries` on success. All ids are **UUID strings**. Each service file replaces the like-named Sub-01
stub (or is **new** where noted).

### 2.1 Identity — auth session (`services/auth.service.ts` ✅ exists) + admin (`services/identity.service.ts` NEW)

Routes: `IDENTITY_ROUTES` · schemas: `identity.{command,dtos,query,enums}.ts`.

**Auth session (Tier 2 — service exists; rebuild only its tests):**

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `LOGIN` | POST | `LoginCommand` | `LoginResultDto` (+ `setLoginSession`) | `login()` ✅ | `useLogin` → invalidate `qk.auth.session()` |
| `REFRESH` | POST | `RefreshCommand` | `RefreshResultDto` | re-export `refreshTokens` from axios ✅ | *(no hook — interceptor owns it)* |
| `LOGOUT` | POST | `RefreshCommand` (from store) | `void` (204) | `logout()` ✅ | `useLogout` → `queryClient.clear()` |
| `ME_PERMISSIONS` | GET | — | `string[]` (page keys) | `getMyPermissions()` **NEW** | `usePermissions` → `qk.auth.permissions()` |
| *(session)* | — | JWT decode (no endpoint) | `Session \| null` | `tokenStore.getSession()` ✅ | `useSession` → `qk.auth.session()` |

> **No `/auth/me`.** Session is derived from the access-token JWT; `useSession` bootstraps via `refreshTokens()`
> on cold start. `ME_PERMISSIONS` is the *only* real "me" endpoint and returns effective page keys (STAFF scope).

**Identity admin — users/roles/pages/technicians (Tier 4 — NEW service, no stub today):**

| Route | M | Input | Returns | Service fn | Hook / invalidations |
|---|---|---|---|---|---|
| `USERS` | GET | `UserListQuery` | `PaginatedResult<UserDto>` | `listUsers(q)` | `useUsers(q)` → `qk.identity.users.list(q)` |
| `USERS` | POST | `CreateUserCommand` | `UserDto` | `createUser(cmd)` | `useCreateUser` → inval `qk.identity.users.all()` |
| `USER_BY_ID` | GET | `{id}` | `UserDto` | `getUser(id)` | `useUser(id)` → `qk.identity.users.detail(id)` |
| `USER_BY_ID` | PATCH | `{id}`,`UpdateUserCommand` | `UserDto` | `updateUser(id,cmd)` | `useUpdateUser` → inval users.all + detail(id) |
| `ROLES` | GET | — | `RoleDto[]` | `listRoles()` | `useRoles` → `qk.identity.roles.all()` |
| `ROLES` | POST | `CreateRoleCommand` | `RoleDto` | `createRole(cmd)` | `useCreateRole` → inval roles.all |
| `ROLE_BY_ID` | PATCH | `{id}`,`UpdateRoleCommand` | `RoleDto` | `updateRole(id,cmd)` | `useUpdateRole` → inval roles.all |
| `ROLE_PAGES` | PUT | `{id}`,`SetRolePagesCommand` | `RoleDto` | `setRolePages(id,cmd)` | `useSetRolePages` → inval roles.all |
| `PAGES` | GET | `PagesQuery` | `PageDto[]` | `listPages(q)` | `usePages(q)` → `qk.identity.pages(q)` |
| `TECHNICIANS` | GET | — | `TechnicianDto[]` | `listTechnicians()` | `useTechnicians` → `qk.identity.technicians.all()` |
| `TECHNICIANS` | POST | `CreateTechnicianCommand` | `TechnicianDto` | `createTechnician(cmd)` | `useCreateTechnician` → inval technicians.all |
| `TECHNICIAN_BY_ID` | PATCH | `{id}`,`UpdateTechnicianCommand` | `TechnicianDto` | `updateTechnician(id,cmd)` | `useUpdateTechnician` → inval technicians.all |

**MSW:** `identity.handlers.ts` — 200 for each; explicit `AUTH_INVALID_CREDENTIALS`(401) on login, `VALIDATION_ERROR`(400)
on create (STAFF w/o roleIds; ADMIN w/ roleIds — the two `.refine()`s), `RESOURCE_NOT_FOUND`(404) on `USER_BY_ID`,
`RESOURCE_CONFLICT`(409) on duplicate username. **Edge cases:** `email`/`lastLoginAt`/`profile.phone`/`jobTitle`
optional; `roles[]` may be empty for ADMIN; `effectivePages` empty array vs missing.

### 2.2 Catalog (`services/catalog.service.ts` — replace stub)

Routes: `CATALOG_ROUTES` · schemas: `catalog.{command,dtos,query,enums}.ts`. **Biggest domain.** Split the file
into `catalog.service.ts` (public+admin products) and optionally `taxonomy` helpers, or keep one file with clear
sections. Confirmed pagination: `PRODUCTS`/`STAFF_PRODUCTS`/`ADMIN_PRODUCTS` = `PaginatedResult<…>`; taxonomy lists = arrays.

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `PRODUCTS` | GET | `ProductListQuery` | `PaginatedResult<ProductWithPricingDto>` | `listProducts(q)` | `useProducts(q)` → `qk.catalog.products.list(q)` |
| `PRODUCT_DETAIL` | GET | `{id}` | `ProductDetailDto` | `getProduct(id)` | `useProduct(id)` → `qk.catalog.products.detail(id)` |
| `STAFF_PRODUCTS` | GET | `ProductListQuery` | `PaginatedResult<StaffProductDto>` | `listStaffProducts(q)` | `useStaffProducts(q)` |
| `ADMIN_PRODUCTS` | GET | `ProductListQuery` | `PaginatedResult<AdminProductDto>` | `listAdminProducts(q)` | `useAdminProducts(q)` → `qk.catalog.adminProducts.list(q)` |
| `ADMIN_PRODUCTS` | POST | `CreateProductCommand` **+ files** | `AdminProductDto` | `createProduct(cmd,files)` (**FormData**) | `useCreateProduct` → inval adminProducts.all + products.list |
| `ADMIN_PRODUCT_BY_ID` | GET | `{id}` | `AdminProductDto` | `getAdminProduct(id)` | `useAdminProduct(id)` → adminProducts.detail(id) |
| `ADMIN_PRODUCT_BY_ID` | PATCH | `{id}`,`UpdateProductCommand` | `AdminProductDto` | `updateProduct(id,cmd)` | `useUpdateProduct` → inval detail+list |
| `PRICING` | PATCH | `{id}`,`UpdatePricingCommand` | `AdminProductDto` | `updatePricing(id,cmd)` | `useUpdatePricing` → inval detail+list |
| `IMAGES` | POST | `{id}`,`AddProductImagesCommand` **+ files** | `AdminProductDto` | `addImages(id,cmd,files)` (**FormData**) | `useAddImages` → inval detail |
| `IMAGES` | PATCH | `{id}`,`UpdateProductImagesCommand` | `AdminProductDto` | `updateImages(id,cmd)` | `useUpdateImages` → inval detail |
| `PRODUCT_STATS` | GET | — | `ProductStatsDto` | `productStats()` | `useProductStats` → `qk.catalog.productStats()` |
| `BRANDS`/`ADMIN_BRANDS` | GET | — | `BrandDto[]` | `listBrands(admin?)` | `useBrands` → `qk.catalog.brands(admin)` |
| `ADMIN_BRANDS` | POST | `CreateBrandCommand` | `BrandDto` | `createBrand(cmd)` | `useCreateBrand` → inval brands |
| `ADMIN_BRAND_BY_ID` | PATCH | `{id}`,`UpdateBrandCommand` | `BrandDto` | `updateBrand(id,cmd)` | `useUpdateBrand` → inval brands |
| `FAMILIES`/`ADMIN_FAMILIES` | GET | `FamiliesQuery` | `FamilyDto[]` | `listFamilies(q,admin?)` | `useFamilies(q)` → `qk.catalog.families(q)` |
| `ADMIN_FAMILIES` | POST | `CreateFamilyCommand` | `FamilyDto` | `createFamily(cmd)` | `useCreateFamily` → inval families |
| `ADMIN_FAMILY_BY_ID` | PATCH | `{id}`,`UpdateFamilyCommand` | `FamilyDto` | `updateFamily(id,cmd)` | `useUpdateFamily` → inval families |
| `MODELS`/`ADMIN_MODELS` | GET | `ModelsQuery` | `DeviceModelDto[]` | `listModels(q,admin?)` | `useModels(q)` → `qk.catalog.models(q)` |
| `ADMIN_MODELS` | POST | `CreateModelCommand` | `DeviceModelDto` | `createModel(cmd)` | `useCreateModel` → inval models |
| `ADMIN_MODEL_BY_ID` | PATCH | `{id}`,`UpdateModelCommand` | `DeviceModelDto` | `updateModel(id,cmd)` | `useUpdateModel` → inval models |
| `MODEL_FAMILIES` | PUT | `{id}`,`SetModelFamiliesCommand` | `DeviceModelDto` | `setModelFamilies(id,cmd)` | `useSetModelFamilies` → inval models |
| `CATEGORIES` | GET | — | `ClientCategoryDto[]` | `listCategories()` | `useCategories` → `qk.catalog.categories()` |
| `CATEGORIES_CUD` | POST | `CreateClientCategoryCommand` | `ClientCategoryDto` | `createCategory(cmd)` | `useCreateCategory` → inval categories |
| `CATEGORY_BY_ID` | PATCH | `{id}`,`UpdateClientCategoryCommand` | `ClientCategoryDto` | `updateCategory(id,cmd)` | `useUpdateCategory` → inval categories |

**Edge cases (SDET):** `ProductWithPricingDto.priceHidden`/`inStock`/`inCart` booleans + optional `currentPrice`/
`guestPrice` (guest vs. logged-in price matrix); `FamilyDto.productCount` present **only** when `withCount=true`;
`AdminProductDto` exposes cost/quantities (guest DTO must not); `ProductSort` enum has exactly 4 values; the
create command's 5 `.refine()` XORs (family/brand id-vs-newName, model exclusivity, `initialUnitCost`⇔qty>0,
`PRICING_REQUIRES_STOCK`) → assert `VALIDATION_ERROR` fixtures for each. **Cross-invalidation:** admin product
create/update/pricing must also invalidate **inventory** stock and public `products.list`.

### 2.3 Clients + POS clients (`services/clients.service.ts` — replace stub; POS section NEW)

Routes: `CLIENT_ROUTES` + `POS_CLIENT_ROUTES` · schemas: `clients.{command,dtos,query,enums}.ts`.

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `VALIDATE_PHONE` | POST | `ValidatePhoneCommand` | `ValidatePhoneResultDto` | `validatePhone(cmd)` | `useValidatePhone` (mutation) |
| `REGISTER` | POST | `RegisterClientCommand` | `ClientMeDto` *(confirm)* | `register(cmd)` | `useRegister` |
| `ME` | GET | — | `ClientMeDto` | `getMe()` | `useMyAccount` → `qk.clients.me()` |
| `ME` | PATCH | `UpdateMeCommand` (`.strict()`) | `ClientMeDto` | `updateMe(cmd)` | `useUpdateMe` → inval me() |
| `ME_PASSWORD` | PATCH | `ChangeMyPasswordCommand` | `void` | `changeMyPassword(cmd)` | `useChangeMyPassword` |
| `CART` | GET | — | `CartItemDto[]` | `getCart()` | `useCart` → `qk.clients.cart()` |
| `CART` | POST | `AddCartItemCommand` | `CartItemDto[]` *(confirm)* | `addToCart(cmd)` | `useAddToCart` → inval cart() |
| `CART_ITEM` | DELETE | `{productId}` | `void`/`CartItemDto[]` | `removeFromCart(productId)` | `useRemoveFromCart` → inval cart() |
| `ADMIN_LIST` | GET | `AdminClientListQuery` | `PaginatedResult<AdminClientDto>` | `listAdminClients(q)` | `useAdminClients(q)` → `qk.clients.admin.list(q)` |
| `ADMIN_STATS` | GET | — | `ClientStatsDto` | `adminClientStats()` | `useAdminClientStats` → admin.stats() |
| `ADMIN_DETAIL` | GET | `{id}` | `AdminClientDto` | `getAdminClient(id)` | `useAdminClient(id)` → admin.detail(id) |
| `APPROVE` | POST | `{id}`,`ApproveClientCommand` | `AdminClientDto` *(confirm)* | `approveClient(id,cmd)` | `useApproveClient` → inval admin.list+stats+detail |
| `REJECT` | POST | `{id}`,`RejectClientCommand` | `AdminClientDto` *(confirm)* | `rejectClient(id,cmd)` | `useRejectClient` → inval admin.list+stats |
| `RESET_PASSWORD` | POST | `{id}`,`ResetClientPasswordCommand` | `void` | `resetClientPassword(id,cmd)` | `useResetClientPassword` |
| `ADMIN_UPDATE` | PATCH | `{id}`,`AdminUpdateClientCommand` | `AdminClientDto` | `updateAdminClient(id,cmd)` | `useUpdateAdminClient` → inval admin.detail+list |
| POS `SEARCH` | GET | `PosClientSearchQuery` (`{q}`) | `PosClientDto[]` | `searchPosClients(q)` | `usePosClientSearch(q)` (debounced) |
| POS `QUICK_CREATE` | POST | `CreatePosClientCommand` | `PosClientDto` | `quickCreatePosClient(cmd)` | `useQuickCreatePosClient` → inval pos.list |
| POS `ADMIN` | GET | `PosClientListQuery` | `PaginatedResult<PosClientDto>` | `listPosClients(q)` | `usePosClients(q)` → `qk.posClients.list(q)` |
| POS `ADMIN` | POST | `CreatePosClientCommand` | `PosClientDto` | `createPosClient(cmd)` | `useCreatePosClient` → inval pos.list |
| POS `ADMIN_BY_ID` | GET | `{id}` | `PosClientDto` | `getPosClient(id)` | `usePosClient(id)` |
| POS `ADMIN_BY_ID` | PATCH | `{id}`,`UpdatePosClientCommand` | `PosClientDto` | `updatePosClient(id,cmd)` | `useUpdatePosClient` → inval pos.list+detail |

**Edge cases:** `UpdateMeCommand` is `.strict()` — a `phone` key must produce `VALIDATION_ERROR`(400), not be
silently dropped (assert it). `ME PATCH phone → 400` is a named contract test scenario. `ClientStatus`
(PENDING/APPROVED/REJECTED) drives `approve`/`reject` state; `PhoneAvailability` (available/registered/pending)
is lowercase and distinct from `ClientStatus`. `CartItemDto.product` nests the full `ProductWithPricingDto`.
Approve/reject **cross-invalidate** `qk.clients.admin.stats()`. *(Confirm the exact bodies of REGISTER/APPROVE/
REJECT/cart-mutations against `Apps/api/src/modules/clients/*.controller.ts` — several are `*(confirm)*` above.)*

### 2.4 Inventory (`services/inventory.service.ts` — NEW)

Routes: `INVENTORY_ROUTES` · schemas: `inventory.{command,dtos,query,enums}.ts`.

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `STOCK` | GET | `StockQuery` | `StockRowDto[]` **or `Blob`** if `export=csv` | `getStock(q)` / `exportStockCsv(q)` | `useStock(q)` → `qk.inventory.stock(q)` |
| `MOVEMENTS` | GET | `MovementsQuery` | `PaginatedResult<MovementDto>` | `listMovements(q)` | `useMovements(q)` → `qk.inventory.movements.list(q)` |
| `RESERVATIONS` | GET | `ReservationsQuery` | `PaginatedResult<ReservationDto>` | `listReservations(q)` | `useReservations(q)` |
| `ADJUSTMENTS` | POST | `CreateAdjustmentCommand` | `AdjustmentResultDto` | `createAdjustment(cmd)` | `useCreateAdjustment` → inval stock+movements **+ catalog admin products** |

**Edge cases:** `getStock` is **dual-return** (array vs. CSV `Blob`) — split into two service fns or branch on
`export`; the CSV path uses `responseType:'blob'` and no envelope. `MovementDto` has many `.optional()` numeric
fields (`unitCost`/`profit`/`costOfGoods`/`remainingQuantity`) — fixtures must cover both present & absent.
`referenceType` is an open string. Adjustments **cross-invalidate** catalog (quantities/averageCost change).

### 2.5 Platform — wilayas / delivery fees / settings (`services/platform.service.ts` — NEW; absorbs `checkout-delivery` + `admin-settings` stubs)

Routes: `PLATFORM_ROUTES` · schemas: `platform.{command,dtos,query,enums}.ts`.

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `WILAYAS` | GET | — | `WilayaDto[]` | `listWilayas()` | `useWilayas` → `qk.platform.wilayas()` (long `staleTime`) |
| `FEE` | GET | `FeeQuery` (`{wilayaId,communeId?}`) | `FeeDto` | `getFee(q)` | `useDeliveryFee(q)` → `qk.platform.fee(q)` |
| `ADMIN_FEES` | GET | — | `AdminFeesDto` | `getAdminFees()` | `useAdminFees` → `qk.platform.adminFees()` |
| `ADMIN_FEES` | PUT | `UpsertFeesCommand` | `AdminFeesDto` *(confirm)* | `upsertFees(cmd)` | `useUpsertFees` → inval adminFees |
| `FEES_IMPORT` | POST | Excel file (**FormData**) | import summary *(confirm shape)* | `importFees(file)` | `useImportFees` → inval adminFees |
| `FEES_EXPORT` | GET | `FeesExportQuery` (excel/csv/json) | `Blob` | `exportFees(q)` | *(imperative; no query hook needed)* |
| `SETTINGS` | GET | — | `SettingsDto` | `getSettings()` | `useSettings` → `qk.platform.settings()` |
| `SETTINGS` | PATCH | `UpdateSettingsCommand` | `SettingsDto` | `updateSettings(cmd)` | `useUpdateSettings` → inval settings (+ public) |
| `SETTINGS_PUBLIC` | GET | — | `PublicSettingsDto` | `getPublicSettings()` | `usePublicSettings` → `qk.platform.publicSettings()` |

**Edge cases:** `FeeDto.source` (`FeeSource`) tells whether the fee came from an override or the default — assert
both. `SettingsDto.invoicing.prefixes`/`nextSequences` are `Record<DocType,…>` — fixtures must key by every
`DocType`. `WilayaDto.communes[]` nested. `FEES_IMPORT`/`FEES_EXPORT` are file endpoints (multipart in / blob out).
`WILAYAS`/`FEE`/`SETTINGS_PUBLIC` are anonymous → add to `PUBLIC_PATH_PREFIXES` (§1.1).

### 2.6 Orders (`services/orders.service.ts` — replace stub)

Routes: `ORDER_ROUTES` · schemas: `orders.{command,dtos,query,enums}.ts`. `STAFF_*`/`ADMIN_*` are the same
operation dual-mounted — one service fn per pair, parameterized by scope (or two thin fns).

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `PLACE` | POST | `PlaceOrderCommand` | `OrderDto` | `placeOrder(cmd)` | `usePlaceOrder` → inval orders.mine |
| `MY_LIST` | GET | `MyOrdersQuery` | `OrderDto[]` | `getMyOrders(q)` | `useMyOrders(q)` → `qk.orders.mine(q)` |
| `MY_CANCEL` | POST | `{id}` | `OrderDto` *(confirm)* | `cancelMyOrder(id)` | `useCancelMyOrder` → inval mine |
| `STAFF_LIST`/`ADMIN_LIST` | GET | `BackofficeOrdersQuery` | `PaginatedResult<OrderDto>` | `listOrders(scope,q)` | `useAdminOrders(q)` → `qk.orders.admin.list(q)` |
| `STAFF_CONFIRM`/`ADMIN_CONFIRM` | POST | `{id}`,`ConfirmOrderCommand` | `OrderDto` | `confirmOrder(scope,id,cmd)` | `useConfirmOrder` → inval list+detail **+ inventory** |
| `STAFF_STATUS`/`ADMIN_STATUS` | PATCH | `{id}`,`UpdateOrderStatusCommand` | `OrderDto` | `updateOrderStatus(scope,id,cmd)` | `useUpdateOrderStatus` → inval list+detail |
| `CANCEL` | POST | `{id}`,`UpdateOrderStatusCommand`? *(confirm body)* | `OrderDto` | `cancelOrder(id,cmd)` | `useCancelOrder` → inval list |
| `RETURN` | POST | `{id}`,`ReturnOrderCommand` | `OrderDto` | `returnOrder(id,cmd)` | `useReturnOrder` → inval list **+ inventory + billing** |
| `STAFF_STATS`/`ADMIN_STATS` | GET | — | `OrderStatsDto` | `orderStats(scope)` | `useOrderStats` → `qk.orders.stats(scope)` |

**Edge cases:** `PlaceOrderCommand` `.refine()` — `delivery` required unless `PICKUP`, forbidden when `PICKUP` →
two `VALIDATION_ERROR` fixtures. `OrderDto.wilaya`/`commune`/`address`/`deliveryCompany`/`trackingNumber` optional
(PICKUP has none). `costOfGoods`/`profit` admin-only (`.optional()`). `deliveryCompany` is a **free-text string**,
not an entity (confirms C4's delivery-companies deletion). `OrderStatus` 7-state machine; `canBeCancelled` boolean
gates the cancel action. Confirm/return **cross-invalidate** inventory (stock) and billing (invoice may be issued).

### 2.7 Purchasing (`services/purchasing.service.ts` — NEW; absorbs `admin-suppliers` + `supplier-information` stubs)

Routes: `PURCHASING_ROUTES` · schemas: `purchasing.{command,dtos,query,enums}.ts`.

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `SUPPLIERS` | GET | `SupplierListQuery` | `PaginatedResult<SupplierDto>` | `listSuppliers(q)` | `useSuppliers(q)` → `qk.purchasing.suppliers.list(q)` |
| `SUPPLIERS` | POST | `CreateSupplierCommand` | `SupplierDto` | `createSupplier(cmd)` | `useCreateSupplier` → inval suppliers.all |
| `SUPPLIER_BY_ID` | PATCH | `{id}`,`UpdateSupplierCommand` | `SupplierDto` | `updateSupplier(id,cmd)` | `useUpdateSupplier` → inval list+detail |
| `SUPPLIER_DETAIL` | GET | `{id}` | `SupplierDetailDto` | `getSupplierDetail(id)` | `useSupplierDetail(id)` → detail(id) |
| `SUPPLIER_STATS` | GET | — | `SupplierStatsDto` | `supplierStats()` | `useSupplierStats` → suppliers.stats() |
| `INVOICES` | GET | `SupplierInvoiceListQuery` | `PaginatedResult<SupplierInvoiceDto>` | `listSupplierInvoices(q)` | `useSupplierInvoices(q)` → invoices.list(q) |
| `INVOICES` | POST | `CreateSupplierInvoiceCommand` | `SupplierInvoiceDto` | `createSupplierInvoice(cmd)` | `useCreateSupplierInvoice` → inval invoices+supplier detail |
| `INVOICE_BY_ID` | GET | `{id}` | `SupplierInvoiceDto` | `getSupplierInvoice(id)` | `useSupplierInvoice(id)` |
| `INVOICE_BY_ID` | PATCH | `{id}`,`UpdateSupplierInvoiceCommand` | `SupplierInvoiceDto` | `updateSupplierInvoice(id,cmd)` | `useUpdateSupplierInvoice` → inval detail (DRAFT only) |
| `CONFIRM` | POST | `{id}` | `ConfirmResultDto` | `confirmSupplierInvoice(id)` | `useConfirmSupplierInvoice` → inval invoices+supplier+**catalog/inventory** |
| `CANCEL` | POST | `{id}`,`CancelSupplierInvoiceCommand` | `SupplierInvoiceDto` *(confirm)* | `cancelSupplierInvoice(id,cmd)` | `useCancelSupplierInvoice` → inval invoices+supplier |
| `PAYMENTS` | GET | `SupplierPaymentListQuery` | `PaginatedResult<SupplierPaymentDto>` | `listSupplierPayments(q)` | `useSupplierPayments(q)` |
| `PAYMENTS` | POST | `CreateSupplierPaymentCommand` | `SupplierPaymentDto` | `createSupplierPayment(cmd)` | `useCreateSupplierPayment` → inval payments+supplier(credit) |

**Edge cases:** `CreateSupplierInvoiceCommand` `.refine()` — `amountOnly` **XOR** `lines` → both-absent and
both-present are 400. `SupplierInvoiceStatus` DRAFT→CONFIRMED→CANCELLED; PATCH after confirm → 409. `ConfirmResultDto`
returns `repriceCandidates[]` (drives a reprice prompt). Line `projectedNewAverageCost` present **only** on DRAFT.
Confirm **cross-invalidates** inventory + catalog admin (averageCost/reprice); payment invalidates supplier credit.

### 2.8 Statistics (`services/statistics.service.ts` — NEW; absorbs `dashboard` + `admin-statistics` stubs)

Routes: `STATS_ROUTES` · schemas: `statistics.{dtos,query,enums}.ts` (no command file — all reads).

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `ADMIN_DASHBOARD` | GET | — | `AdminDashboardDto` | `getAdminDashboard()` | `useAdminDashboard` → `qk.stats.adminDashboard()` |
| `STAFF_DASHBOARD` | GET | — | `StaffDashboardDto` | `getStaffDashboard()` | `useStaffDashboard` → `qk.stats.staffDashboard()` |
| `OVERVIEW` | GET | — | `OverviewDto` | `getOverview()` | `useOverview` → `qk.stats.overview()` |
| `FILTERED` | GET | `FilteredQuery` | `FilteredDto` | `getFiltered(q)` | `useFiltered(q)` → `qk.stats.filtered(q)` |
| `CHARTS` | GET | `{chart:ChartType}`,`ChartsQuery` | `ReportDto` *(confirm)* | `getChart(chart,q)` | `useChart(chart,q)` → `qk.stats.chart(chart,q)` |
| `TOP_PRODUCTS` | GET | `TopProductsQuery` | (top-products list) *(confirm DTO)* | `getTopProducts(q)` | `useTopProducts(q)` |
| `REPORT` | GET | `{type:ReportType}`,`ReportQuery` | `ReportDto` **or `Blob`** if `format=csv` | `getReport(type,q)` / `exportReportCsv` | `useReport(type,q)` → `qk.stats.report(type,q)` |

**Edge cases:** `AdminDashboardDto`/`StaffDashboardDto` are the **most-inferred DTOs** in the contract (author's
own flag) — validate fixtures carefully; arrays (`pendingOrders`/`recentClients`/`lowStock`/`draftSalesByStaff`)
may be empty. `repairsByStatus` is `Record<string,number>`. `REPORT` is dual-return (JSON `ReportDto` vs CSV `Blob`).
`ReportType` (9), `ChartType` (4), `ReportFormat` (2) enums. Dashboards are read-only (no invalidation authored;
they get swept by `qk.stats.all()` when upstream mutations fire — see §3 cross-invalidation note).

### 2.9 Observability (`services/observability.service.ts` — NEW; absorbs `admin-logs` stub)

Routes: `OBS_ROUTES` · schemas: `observability.{command,dtos,query,enums}.ts`.

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `CLIENT_BEACON` | POST | `ClientActivityCommand` | `void` (202, null-envelope) | `sendClientActivity(cmd)` | `useSendClientActivity` (fire-and-forget mutation) |
| `STAFF_SEARCH_BEACON` | POST | `StaffSearchCommand` | `void` (202) | `sendStaffSearch(cmd)` | `useSendStaffSearch` |
| `CLIENT_ACTIVITY` | GET | `{id}`,`ClientActivityQuery` | `ClientActivityDto[]` | `getClientActivity(id,q)` | `useClientActivity(id,q)` |
| `STAFF_SEARCHES` | GET | `StaffSearchesQuery` | `StaffSearchDto[]` *(confirm paginated?)* | `listStaffSearches(q)` | `useStaffSearches(q)` |
| `LOGS` | GET | `LogsQuery` | `PaginatedResult<AuditLogDto>` | `listLogs(q)` | `useLogs(q)` → `qk.observability.logs.list(q)` |
| `LOG_STATS` | GET | — | `LogStatsDto` | `logStats()` | `useLogStats` → `qk.observability.logStats()` |

**Edge cases:** `ClientActivityCommand` `.refine()` — `durationSeconds` invalid for `SEARCH` → 400. Beacons return
**202 + `{success:true,data:null}`** (not 204) — handler uses `ok(null, 202)`, service returns void. `AuditLogDto.user`
optional (system actions). Beacons are fire-and-forget → `meta:{silentErrorToast:true}` so a failed beacon never
toasts.

### 2.10 Sales / POS (`services/sales.service.ts` — NEW · Tier 5, no MVP UI)

Routes: `SALE_ROUTES` · schemas: `sales.{command,dtos,query,enums}.ts`. `STAFF_*`/`ADMIN_*` dual-mounted pairs.

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `CREATE_DRAFT` | POST | `SaleDraftCommand` | `SaleDto` | `createDraft(cmd)` | `useCreateDraft` → inval sales.list |
| `UPDATE_DRAFT` | PATCH | `{id}`,`UpdateSaleDraftCommand` | `SaleDto` | `updateDraft(id,cmd)` | `useUpdateDraft` → inval sale detail |
| `CONFIRM` | POST | `{id}`,`ConfirmSaleCommand` | `ReceiptDto` | `confirmSale(id,cmd)` | `useConfirmSale` → inval sales+**inventory+billing+clients(credit)** |
| `STAFF_LIST`/`ADMIN_LIST` | GET | `SaleListQuery` | `PaginatedResult<SaleDto>` | `listSales(scope,q)` | `useSales(scope,q)` → `qk.sales.list(scope,q)` |
| `STAFF_DETAIL`/`ADMIN_DETAIL` | GET | `{reference}` | `SaleDto` | `getSale(scope,ref)` | `useSale(scope,ref)` → detail(ref) |
| `RETURN` | POST | `CreateReturnCommand` | `SaleDto` *(confirm)* | `createReturn(cmd)` | `useCreateReturn` → inval sales+inventory+billing |

**Edge cases:** detail is keyed by **`reference` (string)**, not id. `SaleDraftCommand.lines.min(1)`. Admin-only
`totalCost`/`totalProfit`/line `costOfGoods`/`profit` `.optional()` (staff mapper strips). `ReturnType` REFUND/EXCHANGE.
`SaleStatus` 5-state. Confirm returns a **`ReceiptDto`** (different shape from `SaleDto`).

### 2.11 Repairs (`services/repairs.service.ts` — NEW · Tier 5, no MVP UI)

Routes: `REPAIR_ROUTES` · schemas: `repairs.{command,dtos,query,enums}.ts`. Dual-mounted pairs; parts nested under a repair.

| Route | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `STAFF_LIST`/`ADMIN_LIST` | GET | `RepairListQuery` | `RepairDto[]` *(no page/limit → array)* | `listRepairs(scope,q)` | `useRepairs(scope,q)` → `qk.repairs.list(scope,q)` |
| `STAFF_CREATE`/`ADMIN_CREATE` | POST | `CreateRepairCommand` | `RepairDto` | `createRepair(scope,cmd)` | `useCreateRepair` → inval repairs.list |
| `STAFF_UPDATE`/`ADMIN_UPDATE` | PATCH | `{id}`,`UpdateRepairCommand` | `RepairDto` | `updateRepair(scope,id,cmd)` | `useUpdateRepair` → inval detail+list |
| `STAFF_PARTS`/`ADMIN_PARTS` | POST | `{id}`,`AddRepairPartCommand` | `RepairDto` | `addRepairPart(scope,id,cmd)` | `useAddRepairPart` → inval detail **+ inventory** |
| `STAFF_PART_BY_ID`/`ADMIN_PART_BY_ID` | DELETE | `{id,partId}` | `RepairDto`/`void` *(confirm)* | `removeRepairPart(scope,id,partId)` | `useRemoveRepairPart` → inval detail |
| `STAFF_STATUS`/`ADMIN_STATUS` | PATCH | `{id}`,`RepairStatusCommand` | `RepairDto` | `updateRepairStatus(scope,id,cmd)` | `useUpdateRepairStatus` → inval detail+list |

**Edge cases:** `RepairListQuery` has **no pagination** → bare array. `CreateRepairCommand.reportedIssues.min(1)`
(`ReportedIssue` enum, 9 values incl. `OTHER`+`reportedIssueOther`). `RepairStatus` 5-state; status change carries
`consumedPartReturns[]` (restock). Admin-only cost fields `.optional()`. Adding a part **cross-invalidates** inventory.

### 2.12 Billing (`services/billing.service.ts` — NEW · Tier 5, no MVP UI)

Routes: `BILLING_ROUTES` · schemas: `billing.{command,dtos,query,enums}.ts`. `MY_*`/`STAFF_*`/`ADMIN_*` are the same
read scoped three ways; each `*_BY_NUMBER` keyed by **`number` (string)**; each `*_PDF` is a blob.

| Route(s) | M | Input | Returns | Service fn | Hook / keys |
|---|---|---|---|---|---|
| `MY_INVOICES` | GET | — | `InvoiceDto[]` *(confirm)* | `getMyInvoices()` | `useMyInvoices` → `qk.billing.mine()` |
| `STAFF_INVOICES`/`ADMIN_INVOICES` | GET | `InvoiceListQuery` | `PaginatedResult<InvoiceDto>` | `listInvoices(scope,q)` | `useInvoices(scope,q)` → list(scope,q) |
| `MY_INVOICE_BY_NUMBER` / `STAFF_INVOICE_BY_NUMBER` / `ADMIN_INVOICE_BY_NUMBER` | GET | `{number}` | `InvoiceDto` | `getInvoice(scope,number)` | `useInvoice(scope,number)` → detail |
| `MY_INVOICE_PDF` / `STAFF_INVOICE_PDF` / `ADMIN_INVOICE_PDF` | GET | `{number}` | `Blob` | `getInvoicePdf(scope,number)` | *(imperative download)* |
| `CANCEL` | POST | `{number}`,`CancelInvoiceCommand` | `InvoiceDto` *(confirm)* | `cancelInvoice(number,cmd)` | `useCancelInvoice` → inval invoices |
| `STAFF_CLIENT_PAYMENTS`/`ADMIN_CLIENT_PAYMENTS` | POST | `CreateClientPaymentCommand` | `ClientPaymentDto` | `createClientPayment(scope,cmd)` | `useCreateClientPayment` → inval payments+**clients(credit)** |
| `CLIENT_PAYMENTS_LIST` | GET | `ClientPaymentListQuery` | `PaginatedResult<ClientPaymentDto>` | `listClientPayments(q)` | `useClientPayments(q)` → payments.list(q) |

**Edge cases:** `InvoiceStatus` 4-state; `InvoiceSource` SALE/ORDER only (never REPAIR). Admin-only `totalCost`/
`totalProfit`/line `costSnapshot`/`profit`/`currentAverageCost` `.optional()` (client mapper strips + 404s on
foreign invoice). `ADMIN_CLIENT_PAYMENTS` and `CLIENT_PAYMENTS_LIST` share `/admin/client-payments` (POST vs GET) —
two service fns, one URL. PDFs are blobs. Client payment **cross-invalidates** client/pos-client credit.

---

## 3. Query Key Registry (central `lib/query-keys.ts` — full target)

Extends the existing `qk`, **retyping all ids to `string`** and adding one family per domain. Every family exposes
`all()` (bare prefix) so a mutation can prefix-invalidate a whole domain. List keys embed the *filter object* so
distinct filters cache separately. **Shape (not literal code):**

```
qk = {
  auth:        { all, session, permissions }
  identity:    { all, users:{all,list(q),detail(id)}, roles:{all}, pages(q), technicians:{all} }
  catalog:     { all, products:{all,list(q),detail(id)}, staffProducts:{list(q)},
                 adminProducts:{all,list(q),detail(id)}, productStats,
                 brands(admin?), families(q), models(q), categories }
  clients:     { all, me, cart, admin:{all,list(q),stats,detail(id)} }
  posClients:  { all, list(q), search(q), detail(id) }
  inventory:   { all, stock(q), movements:{list(q)}, reservations:{list(q)} }
  platform:    { all, wilayas, fee(q), adminFees, settings, publicSettings }
  orders:      { all, mine(q), admin:{list(q),detail(id)}, stats(scope) }
  purchasing:  { all, suppliers:{all,list(q),detail(id),stats},
                 invoices:{all,list(q),detail(id)}, payments:{list(q)} }
  sales:       { all, list(scope,q), detail(scope,ref) }
  repairs:     { all, list(scope,q), detail(scope,id) }
  billing:     { all, mine, list(scope,q), detail(scope,number), payments:{list(q)} }
  stats:       { all, adminDashboard, staffDashboard, overview, filtered(q), chart(c,q), report(t,q) }
  observability:{ all, logs:{list(q)}, logStats, clientActivity(id,q), staffSearches(q) }
}
```

**Cross-domain invalidation matrix** (mutations that must sweep *other* domains — the money/stock ripple):

| Mutation | Also invalidate |
|---|---|
| catalog create/update/pricing/adjustment | `qk.inventory.all()`, `qk.catalog.products.all()` (public) |
| inventory `createAdjustment` | `qk.catalog.adminProducts.all()`, `qk.stats.all()` |
| order confirm/return, sale confirm/return | `qk.inventory.all()`, `qk.billing.all()`, `qk.clients.all()`+`qk.posClients.all()` (credit), `qk.stats.all()` |
| supplier invoice confirm | `qk.inventory.all()`, `qk.catalog.adminProducts.all()`, `qk.purchasing.suppliers.all()` |
| supplier/client payment | `qk.purchasing.suppliers.all()` / `qk.clients.all()`+`qk.posClients.all()` |
| repair add-part / status(complete→sale) | `qk.inventory.all()`, `qk.billing.all()` |

> Dashboards/stats are read-only; they refresh by being swept via `qk.stats.all()` from the mutations above rather
> than authoring per-hook invalidation on them.

---

## 4. Testing & Edge-Case Strategy

### 4.1 Fixtures (`tests/fixtures/data/<domain>.mock.ts`) — envelope-shaped, schema-validated

- Every fixture is built by **`XResponseSchema.parse({...})`** using the contract's exported schema (e.g.
  `ProductWithPricingResponseSchema`, `AdminClientResponseSchema`) — parse-on-construct guarantees a fixture can
  never drift from the DTO. (Schemas *are* exported: each module `index.ts` re-exports its `*.dtos.ts`.)
- **There is no envelope schema** — wrap with the harness `ok(fixture)` / `ok(fixture, 202)` / `noContent()`.
- **Paginated fixtures:** wrap items with the contract `paginated(ItemSchema).parse({ items:[...], meta:{page,limit,total,totalPages} })`
  then `ok(...)` — mirrors the real `PaginatedResult<T>`.
- Provide **both** a populated and an **empty** variant for every list (empty array vs. absent field is a real bug
  surface — e.g. `effectivePages: []`, `communes: []`, `lines: []`).

### 4.2 MSW handlers (`tests/fixtures/msw/<domain>.handlers.ts`) — same builder as services

- Build URLs with `apiUrl(ROUTE_CONST)` (+ manual `:param` substitution, since routes are literal paths — C3),
  the **same** `apiPath` services use, so handler and service URLs can never diverge.
- Each domain exports: a happy-path `<domain>Handlers` array (always registered via `server.ts`) **and** a
  `<domain>ErrorHandlers` map of named 4xx/5xx overrides applied per-test with `server.use(...)`.
- Register the domain's handler array in `server.ts` (documented extension point).
- **Every route gets a 200 (or 201/202/204) handler + at least one explicit error** matching the contract's own
  failure modes (the `.refine()` → `VALIDATION_ERROR` 400; missing resource → `RESOURCE_NOT_FOUND` 404; state
  guard → `RESOURCE_CONFLICT` 409; auth → 401/403; server → 500).

### 4.3 Integration tests (`tests/integration/`) — MSW-backed, no mocks

- **Services (`integration/services/<domain>.service.test.ts`):** assert (a) envelope **unwrap** returns the inner
  DTO not the envelope, (b) DTO field mapping, (c) **throws** on 4xx/5xx (`rejects.toMatchObject({response:{status}})`),
  (d) paginated shape `{items,meta}`, (e) file endpoints return a `Blob`, (f) `.strict()`/`.refine()` 400s propagate.
- **Hooks (`integration/hooks/<domain>.test.tsx`):** `renderHook(useX, { wrapper: createQueryWrapper() })`; assert
  state transitions (`isLoading→isSuccess`/`isError`), and for mutations that **`invalidateQueries` fires a refetch**
  (the auth test's `meCalls` pattern → adapt to `qk.<domain>.list` refetch counting). Do **not** assert TanStack internals.

### 4.4 Envelope-shaped mock discipline & what-NOT-to-test

- **Never** hand-write a bare-JSON mock — always go through `ok()`/`fail()` so `{success,data}` is enforced (a raw
  `{...dto}` mock passes the test while the live app throws on `.data.data`).
- **Don't** test: `sonner` output (once in `query-client.test.ts`), the axios header attachment as a goal, `apiPath`
  per-service, or any `src/**` production path that has no test-only branch. Unit tests (`tests/unit/`) mock the
  **hook** (`vi.mock('@/hooks/useX')`) to drive component states — no MSW there.
- **i18n in tests:** mock the **hook** (`useTranslation → { t: k => k }`), assert on keys, never translated strings.

### 4.5 High-value SDET edge cases (consolidated)

- **Empty vs. null vs. absent:** every `.optional()` DTO field (cost/profit gated to admin; `wilaya`/`commune` on
  PICKUP; `productCount` only with `withCount`) → fixtures for present *and* absent.
- **Token expires mid-request:** the cold-start + single-flight refresh path (already covered for auth) is the
  template — any authenticated service inherits it; add one representative test per non-auth domain that a 401 with
  a valid refresh token silently retries (relies on the shared interceptor, not per-service code).
- **Dual-return endpoints:** `STOCK`, `REPORT`, `*_PDF`, `FEES_EXPORT` — test both the JSON/array branch and the
  `Blob` branch.
- **`.refine()`/`.strict()` validators:** one 400 test each for product-create XORs, supplier-invoice `amountOnly`
  XOR `lines`, order `delivery`⇔`PICKUP`, `UpdateMeCommand` extra-key rejection, activity `SEARCH`+duration.
- **String-keyed detail routes:** sales/billing use `reference`/`number` (string) not UUID id — key & fixture accordingly.
- **202 null-envelope beacons** and **204 no-body logout/deletes** — assert the service returns `void` without
  touching `.data.data`.

---

## 5. Readiness Checklist

**Core / infrastructure**
- [x] One Axios instance, `baseURL=VITE_API_URL`, Bearer + single-flight refresh, 401 loop-prevention — **exists** (audit only; add `PUBLIC_PATH_PREFIXES`).
- [x] `apiPath`/`withParams` builder shared by services **and** MSW — **exists**.
- [x] Query Client global error mapping (cache-level, background-refetch-only, `meta.silentErrorToast`, 401 silent) — **exists**.
- [ ] `qk` retyped to UUID strings **and** extended to all 13 domains + cross-invalidation matrix (§3).
- [ ] MSW harness: reuse `ok/fail/noContent/apiUrl/server/createQueryWrapper/setup`; **rebuild stale auth fixtures/tests** (C5).

**Per contract route (completeness)**
- [ ] Every route in §2's tables → a **Service function** returning the **unwrapped** DTO (or `void`/`Blob`).
- [ ] Every Service function → a **Hook** (query or mutation) with the correct `qk` key.
- [ ] Every mutation hook → the correct `invalidateQueries` set, **including cross-domain** sweeps (§3).
- [ ] Every route → an **MSW 200/2xx handler + ≥1 explicit 4xx/5xx** using the shared builder.
- [ ] Every DTO used in a fixture → **`XResponseSchema.parse(...)`** validated; lists via `paginated(...).parse(...)`.

**Discipline**
- [ ] Services **throw** (never `{error:true}`); unwrap `.data.data`; envelope exceptions (204/202-null/Blob) handled.
- [ ] Query hooks expose `{data,isLoading,isError,error,refetch}`; mutations `{mutate,mutateAsync,isPending,isError,error}` — no `refetch` on mutations.
- [ ] No `useEffect` fetching; no manual cache mutation; no test files in `/src`.
- [ ] All types from `@dragon-telecom/contract`; `src/types` holds only view models (e.g. `session.ts`); a *missing* DTO is a Stage-01 contract gap, not a local patch.
- [ ] `tsc --noEmit` clean; `vitest run` green (200 **and** 4xx/5xx); console silent.

**Test boundaries set** — don't test TanStack internals, `sonner` rendering, header-attachment-as-goal, or thin
built-in wrappers; do test interceptor reactions, envelope unwrap, throwing, and hook state transitions.

---

## 6. Open items to confirm during execution (flagged, not blocking)

1. **Exact response bodies** of a handful of mutations not pinned by a `*Dto` in the contract read side — marked
   `*(confirm)*` in §2 (client REGISTER/APPROVE/REJECT/cart writes; order MY_CANCEL/CANCEL bodies; platform
   `UpsertFees`/`FEES_IMPORT` result; billing MY_INVOICES array-vs-paginated; sales/repairs delete returns;
   statistics CHARTS/TOP_PRODUCTS DTOs). Resolve by reading the matching `Apps/api/src/modules/<m>/*.controller.ts`
   at sprint time (the interfaces there are authoritative — as used in §0.2).
2. **204 vs 202-null vs enveloped-DTO** for each DELETE/cancel — confirm per endpoint against the controller
   (`sendSuccess(res, null, 202)` for beacons is confirmed; deletes vary).
3. **`lovable-tagger` / legacy `use-toast` / `cmdk` / `react-day-picker`** unapproved-lib decision was left open at
   Sub-01 close — not a data-layer concern, but note it's unresolved (per `stage-03-sprint4-complete`).
4. **`test:int` DB** — these are MSW integration tests (no DB); the real Postgres test DB note is backend-only and
   does not apply here.

---

### Appendix — contract → service file map (Sub-01 stub → Sub-02 target)

| Contract module | Route consts | Sub-01 stub file(s) | Sub-02 service file |
|---|---|---|---|
| identity (auth) | `IDENTITY_ROUTES` (auth subset) | `auth.service.ts` ✅ real | keep `auth.service.ts` |
| identity (admin) | `IDENTITY_ROUTES` (users/roles/pages/techs) | — (none) | **new** `identity.service.ts` |
| catalog | `CATALOG_ROUTES` | `catalog.service.ts` (stub) | replace `catalog.service.ts` |
| clients + pos | `CLIENT_ROUTES`,`POS_CLIENT_ROUTES` | `clients.service.ts` (stub) | replace `clients.service.ts` (+ pos section) |
| inventory | `INVENTORY_ROUTES` | — | **new** `inventory.service.ts` |
| platform | `PLATFORM_ROUTES` | `admin-settings.service.ts`,`checkout-delivery.service.ts` | **new** `platform.service.ts` (absorbs both) |
| orders | `ORDER_ROUTES` | `orders.service.ts` (stub) | replace `orders.service.ts` |
| purchasing | `PURCHASING_ROUTES` | `admin-suppliers.service.ts`,`supplier-information.service.ts` | **new** `purchasing.service.ts` (absorbs both) |
| sales | `SALE_ROUTES` | — | **new** `sales.service.ts` |
| repairs | `REPAIR_ROUTES` | — | **new** `repairs.service.ts` |
| billing | `BILLING_ROUTES` | — | **new** `billing.service.ts` |
| statistics | `STATS_ROUTES` | `dashboard.service.ts`,`admin-statistics.service.ts` | **new** `statistics.service.ts` (absorbs both) |
| observability | `OBS_ROUTES` | `admin-logs.service.ts` | **new** `observability.service.ts` (absorbs it) |

> The dozens of Sub-01 `hooks/use-*.ts` (numeric-id view models) are rewritten to consume the new services and
> contract DTOs as their consuming pages are wired — hook rewrite tracks the service rewrite, page wiring is Sub-03.
