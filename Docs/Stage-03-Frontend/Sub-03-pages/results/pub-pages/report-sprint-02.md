# Sprint 2 Report — Routing, Guards, Lazy & Engine-gap prep (Foundation)

**Set:** pub-pages · **Status:** ✅ Done · **Branch:** `pages-set-01`

---

## Summary

Rewired the route table to match the PUB-* requirements: product detail now routes by `id` (never by
name), a new `/staff` landing exists and resolves to a staff member's first permitted page, `/my-account`
is CLIENT-scoped, and the login/register guards route all three user types correctly. Added the
`Idempotency-Key` header to `placeOrder` and discovered — genuinely, via reading `Apps/api` — that the
backend doesn't support it yet. Decided (did not implement) the related-products hydration approach.
Zero new lint-error classes, `tsc --noEmit` clean, 299/299 tests green.

## Files changed

**New**
- `src/lib/staff-pages.ts` — `STAFF_PAGE_ORDER` (canonical `PageKey` order), `STAFF_PAGE_ROUTES` (empty map, populated as staff pages ship), `firstPermittedStaffRoute(permissions)`.
- `src/pages/StaffLanding.tsx` — thin `/staff` landing: `usePermissions()` → `<Navigate>` to the first permitted+shipped page, or a local empty state.

**Modified**
- `src/App.tsx` — `/products/:productName` → `/products/:id`; `/my-account` split into its own `RoleGuard allow={[CLIENT]}` block (was sharing `ProtectedRoute` with `/orders`); `/staff` added inside the existing ADMIN+STAFF `AdminLayout` block; `StaffLanding` lazy import.
- `src/components/layout/ProtectedRoute.tsx` — `ProtectedRoute`'s `/login` redirect now carries `state={{ from: location.pathname }}`; `PublicOnlyRoute` now branches ADMIN→`/admin`, STAFF→`/staff`, CLIENT-on-`/register`→`/my-account`, CLIENT-elsewhere→`from ?? '/'`.
- `src/components/layout/RoleGuard.tsx` — its `/login` redirect also now carries `state={{ from: location.pathname }}` (needed for the new CLIENT-only `/my-account` guard's back-target).
- `src/services/orders.service.ts` — `placeOrder` sends `Idempotency-Key: crypto.randomUUID()`; header documented as currently inert server-side (see Discovery below).
- `src/hooks/use-product-details.ts` — adapted from name-based (`getProductByName`) to id-based (`getProductById`) lookup; still a stub (always resolves `null`).
- `src/services/catalog.service.ts` — `getProductById(_id: number)` → `getProductById(_id: string)` (uuid-based now; the stub arg was already unused).
- `src/lib/query-keys.ts` — `qkLegacy.catalogProductByName` → `qkLegacy.catalogProductById`.
- `src/pages/ProductDetails.tsx` — reads `id` from `useParams` instead of `productName`; dropped the `kebabCaseToProductName` reconstruction; `ProductErrorBoundary`'s `resetKeys` keyed on `id`.
- `src/components/shared/ProductCard.tsx` — `handleViewDetails` now navigates to `/products/${product.idProduct}` instead of a `productNameToKebabCase` slug.

**Deleted**
- `src/lib/utils/product-utils.ts` — every export (`productNameToKebabCase`, `kebabCaseToProductName`, `generateProductUrl`, `parseProductUrl`, SEO-meta generators, etc.) had zero or one consumer; both real consumers were fixed in this sprint, leaving the entire file dead. Verified via a full grep sweep of all 13 exports before deleting (documented in the investigation, not just asserted).

## Routing design notes

- **`/staff` placement:** nested inside the *existing* `RoleGuard allow={[ADMIN, STAFF]}` → `AdminLayout` block, as a sibling of `/admin`, `/admin/clients`, etc. — reuses the guard and chrome the back-office already shares between ADMIN and STAFF, rather than standing up a parallel guard/layout pair.
- **`STAFF_PAGE_ROUTES` is intentionally empty.** No staff destination pages exist yet in this codebase (scope confinement — a later page set). `firstPermittedStaffRoute` only returns a route if the key is *both* permitted *and* present in the map, so `StaffLanding` correctly falls back to its empty state today rather than navigating to a route that would 404. As destination pages land, they register themselves in the map and `StaffLanding` starts resolving them automatically — no further change needed here.
- **`PublicOnlyRoute` now encodes two distinct specs in one guard.** PUB-06 (login) wants an authenticated client sent to `location.state.from ?? '/'`; PUB-07 (register) wants an authenticated client sent to `/my-account`. Since both pages share this one guard component, the branch checks `location.pathname === "/register"` rather than duplicating the guard. This is a `useLocation()`-based decision inside an already-declarative guard, not new imperative navigation — consistent with the existing pattern (`RoleGuard` already reads `useLocation`-adjacent signals for its own state-passing).
- **Back-target propagation:** both `ProtectedRoute` and `RoleGuard` now pass `state={{ from: location.pathname }}` on their `/login` redirect, so a client who hits `/my-account` (or `/orders`) while signed out lands back where they started after logging in.

## Corrections to this sprint's own task list

Same transparency pattern as Sprint 1 — the sprints.md task list I wrote in the planning phase had three
items that, on closer execution-time inspection, were mis-scoped. Corrected rather than forced:

1. **`use-product-details.ts` adapted, not deleted.** Its downstream consumers inside `ProductDetails.tsx` (`ProductPricingSection`, `ProductImageGallery`, `ProductOrderModal`) are still Sub-01-draft-typed until Sprint 3's retype. Fully deleting the hook now would require either (a) writing a throwaway interim rendering path in `ProductDetails.tsx` that gets discarded again in Sprint 5, or (b) jumping Sprint 3/5's work forward into a routing sprint. Adapting the existing stub hook in place — same shape, now keyed by `id` instead of `name` — satisfies D1's actual concern (no more name-based lookup) with zero throwaway code.
2. **`use-product-order.ts` retirement deferred to Sprint 5.** On inspection it has nothing to do with by-name routing — it's the stub order-creation mutation. Its real replacement (`usePlaceOrder`) is explicitly Sprint 5/6's wiring work; grouping it into a routing sprint was a planning-time bundling mistake on my part, corrected here.
3. **D7 descoped to decision-only.** The task literally said "implement a bounded (≈4) per-id `useCatalogProduct` fan-out" — that's UI rendering work (a new `RelatedProductsStrip`), which the sprint plan's own ordering principle ("primitives before wiring") puts in Sprint 4 (skeleton) → Sprint 5 (real wiring), not Sprint 2 (Foundation). The decision itself was already recorded in `plan.md` D7; Sprint 2 doesn't add code for it.

## Discovery: D6's idempotency key is a full-stack gap, not frontend-only

`plan.md`'s D6 framed this as "add a header, frontend service change, flag as a Sub-02 follow-up." Reading
`Apps/api/src/modules/orders/orders.routes.ts` and `orders.controller.ts` (the `PLACE` handler) confirms
there is **no idempotency-key middleware or header validation anywhere in the backend** — a broader grep
across the whole `Apps/api` tree for "idempotenc" only turns up unrelated comments in other modules about
event-level (not HTTP-level) idempotency.

Given the user's ruling that `Apps/api` is source of truth alongside the contract and requirements, this
is worth being explicit about: **sending the header today is a harmless no-op**, not a real duplicate-
submission guard, until a backend sprint adds matching middleware. I proceeded with sending it anyway
(matches `plan.md`'s original intent, is forward-compatible, and costs nothing) rather than pausing to
ask, since no user-facing behavior or risk is at stake either way — but the code comment and this report
make the gap's true shape explicit rather than implying it's "just a header" that fully closes the loop.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` (both configs) | ✅ clean |
| `vitest run` | ✅ 299/299 passed, 35/35 files, no regressions (including the pre-existing `ProtectedRoute.test.tsx`, whose ADMIN/CLIENT assertions still hold under the refined guard) |
| `eslint` — new files (`staff-pages.ts`, `StaffLanding.tsx`) | ✅ 0 errors |
| `eslint` — modified files, before/after diff | 7 of 9 files: 0 new errors. `App.tsx`: +1 (my `/staff` route object literal flagged identically to its 4 pre-existing sibling lines — same established, uncorrected style). `ProductCard.tsx`: +1 (a blank-line-placement shift from removing the now-dead import — cosmetic, not a new error class). Full per-file before/after counts captured via `git stash` comparison, not estimated. |
| Dangling references to the deleted `product-utils.ts` | ✅ none (full grep sweep) |
| Layout/Suspense/ErrorBoundary preserved | ✅ `/staff` wired identically to every other `AdminLayout` child route; `AuthRestoring`/`SessionResolving` pre-mount states untouched |

## Next

Sprint 3 — Shared DTO-typed primitives: retype `ProductCard`/`ProductGrid`/`ProductFilters`/
`ProductPricingSection`/`ProductImageGallery`/`ProductOrderModal`/`MoneyStatusCard`/
`RegistrationConfirmationDialog`/`DeliveryForm` from Sub-01 draft view-models onto the contract DTOs —
the prerequisite Sprints 5–6 (wiring) both depend on.
