# Sprint 1 Report — Core Pipeline

**Status:** ✅ Done · **Branch:** `stage-03-sub-02-integration` · **Scope:** `/src/lib`, `/src/hooks` (compat shim
only), `/tests` — no `/src/components` or `/src/pages` touched.

---

## What shipped

- **`src/lib/query-keys.ts`** — full retype + extension of the central `qk` registry to all 13 contract domains
  (`auth`, `identity`, `catalog`, `clients`, `posClients`, `inventory`, `platform`, `orders`, `purchasing`,
  `sales`, `repairs`, `billing`, `stats`, `observability`), matching plan §3 exactly. Every id is now `string`
  (UUID); every domain exposes `all()` for prefix-based invalidation sweeps.
- **`src/lib/axios.ts`** — `PUBLIC_PATH_PREFIXES` populated (catalog public products/brands/families/models,
  `WILAYAS`, `FEE`, `SETTINGS_PUBLIC`, `VALIDATE_PHONE`, `REGISTER`) so a 401 on an anonymous endpoint is treated
  as business logic, not an expired session.
- **`src/lib/api-path.ts`, `src/lib/query-client.ts`, `src/lib/token-store.ts`, `src/types/session.ts`** — audited,
  already correct against the real contract; no changes needed.
- **`tests/fixtures/data/auth.mock.ts` + `tests/fixtures/msw/auth.handlers.ts`** — rebuilt (moved up from Sprint 2;
  see "Scope adjustments" below) against `IDENTITY_ROUTES`, `LoginResultResponseSchema`, `RefreshResultResponseSchema`.
- **3 stale test files reconciled**: `tests/unit/lib/axios.test.ts`, `tests/unit/lib/realtime.test.ts`,
  `tests/unit/components/layout/ProtectedRoute.test.tsx` — all referenced nonexistent `AUTH_ROUTES`/`UserRole`/
  `AuthTokensDTO`; swapped to `IDENTITY_ROUTES`/`UserType`/`RefreshResultDto` and the real `Session` shape.
- **`qkLegacy` compatibility shim** (`src/lib/query-keys.ts`) — 10 clearly-labeled, temporary key-builders so 5
  pre-existing Sub-01 stub hooks keep compiling without being rewired ahead of their own domain sprint.

## Scope adjustments (both documented in `sprints.md`, not silently absorbed)

1. **`qkLegacy` shim** — not in the original sprint plan. The `qk` retype broke `use-products.ts`,
   `use-product-details.ts`, `use-admin-products.ts`, `use-admin-orders.ts`, `use-my-account.ts` (numeric-id /
   MVP-only key shapes with no contract equivalent: `adminList`, `myAccount`, `productByName`, `byStatus`,
   `search`). Rewriting those hook bodies now would be throwaway work — Sprints 3 (catalog), 4 (clients), 5
   (orders) replace them wholesale against real services/DTOs. `qkLegacy` isolates the debt with a header comment
   naming which sprint retires each entry; the real `qk` registry stays 100% contract-aligned.
2. **Auth fixtures/handlers rebuilt here, not Sprint 2** — `tests/fixtures/wrappers/setup.ts` (global Vitest
   setup) → `server.ts` → `auth.handlers.ts` → `auth.mock.ts` is a load-time import chain; the stale
   `AuthTokensResponseSchema.parse(undefined)` crashed **every** test file in the suite at collection, not just
   auth tests. This was core-pipeline infrastructure breakage, so it had to be fixed in Sprint 1. Kept minimal:
   only what the already-real `auth.service.ts` (`login`/`logout`/`refresh`) needs. `ME_PERMISSIONS` fixtures and
   the two integration test files (`auth.service.test.ts`, `auth.test.tsx` — still call the not-yet-existing
   `authService.me()`) remain Sprint 2, whose task list in `sprints.md` has been narrowed accordingly.

## Validation

```
npm run check   # tsc --noEmit && tsc --noEmit -p tsconfig.test.json
```
Clean on `/src` entirely. On `/tests`, clean **except** `tests/integration/services/auth.service.test.ts` and
`tests/integration/hooks/auth.test.tsx` (12 errors, all `Property 'me' does not exist` / stale `mock*` imports) —
both are explicitly Sprint 2's remaining job.

```
npx vitest run tests/unit/lib   # Sprint 1's own scope
```
**6 files, 46/46 tests passing.**

```
npx vitest run   # full suite, to confirm no cascading collection crash
```
**9 files / 60 tests passing**, 2 files / 12 tests failing — both failing files are the two Sprint-2-owned
integration test files (confirmed the failure list contains nothing outside those two files). Before this
sprint, **all 6 `tests/unit/lib/*` files failed at collection** (crash, not assertion failure) because of the
auth-mock load-time crash described above.

## Commit

`fe: integration sprint 1 — core pipeline` on `stage-03-sub-02-integration`.

## Handoff to Sprint 2

- `auth.mock.ts` / `auth.handlers.ts` already real — extend, don't rebuild.
- Remaining work: `getMyPermissions()` service fn, `usePermissions` hook, `ME_PERMISSIONS` fixture/handler, and
  rewriting the two integration test files to drop `authService.me()`/`qk.auth.me()` in favor of the real
  `useSession`/`qk.auth.session()` + new `usePermissions`/`qk.auth.permissions()`.
- `qkLegacy` entries `catalogProductsList`/`catalogFeaturedProducts`/`catalogProductByName`/
  `catalogAdminProducts*` are Sprint 3's to retire; `ordersAdminList`/`ordersAdminStats` are Sprint 5's;
  `clientsMyAccount` is Sprint 4's — each sprint should delete its entries from `qkLegacy` once its hooks are
  rewired against the real `qk` registry.
