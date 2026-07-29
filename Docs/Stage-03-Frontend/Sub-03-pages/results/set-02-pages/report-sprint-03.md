# Sprint 3 Report — Shared DTO-typed primitives (Primitives & States)

**Set:** set-02-pages · **Status:** ✅ Done · **Branch:** `pages-set-02`

---

## Summary

Retyped `OrderCard` and `CancelOrderDialog` to the real `OrderDto` (both were far more draft-typed than
the plan's field list implied — `OrderCard` owned its own stub-hook mutation call directly, a rules §2
violation for a shared component), widened `ProductOrderModal`'s prop per D8, and retyped the full
AdminDashboard widget stack — 4 "section" wrappers *and* the 4 inner table/card components they wrap,
since the wrappers turned out to own their own independent stub hooks rather than being presentational
as the plan assumed. `tsc --noEmit` clean, `vitest run` 353/353 (no regressions), 0 lint errors after
`--fix` (net **-210** pre-existing prettier errors across the touched files — most were full rewrites in
the project's double-quote style).

## Files changed

**Retyped (OrderCard / CancelOrderDialog / ProductOrderModal)**
- `src/components/shared/OrderCard.tsx` — full rewrite. `OrderDto` (uuid `id`, single product —
  `productName`×`quantity`, not an `orderLines[]` array), all 7 `OrderStatus` values, no longer imports
  `useOrders()` — takes `onCancel`/`isCancelling` props instead (see Architecture note).
- `src/components/shared/CancelOrderDialog.tsx` — full rewrite. `OrderDto`, single-product summary (the
  old "up to 3 items, +N more" preview has nothing left to preview), stays a plain confirm (Sprint 1).
- `src/components/shared/ProductOrderModal.tsx` — D8: `product: ProductDetailDto` →
  `product: ProductWithPricingDto`.

**Retyped (AdminDashboard widget stack — 8 files)**
- `dashboard-stats-section.tsx`, `recent-orders-section.tsx`, `recent-clients-section.tsx`,
  `low-stock-alert-section.tsx` — stopped owning their own stub hook; now pure prop-forwarders to their
  inner component (see Architecture note).
- `dashboard-stats-cards.tsx`, `recent-orders-table.tsx`, `recent-clients-table.tsx`,
  `low-stock-alert.tsx` — retyped to `AdminDashboardDto`'s sub-shapes; `recent-orders-table.tsx`/
  `recent-clients-table.tsx` lost columns the real DTO doesn't carry (see DTO-shape note).
- `src/pages/admin/dashboard/AdminDashboard.tsx` — minimal touch, not a full rewire (see Bridge note).

**Modified (unblocking a now-incompatible consumer)**
- `src/components/sections/orders/orders-list-section.tsx` — added a local `LegacyOrderCard` (see Fork
  note); no longer imports the now-retyped `OrderCard`.

**Modified (i18n)**
- `src/config/translations.json` — +3 keys (`admin.dashboard.lowStock.criticalCount`/`lowCount`/
  `showingCount`) for 4 reachable hardcoded English strings found while retyping `low-stock-alert.tsx`.

## Architecture note: `OrderCard` was not presentational — now it is

`OrderCard.tsx` imported `useOrders()` (the stub hook) directly and called `cancelOrder(order.idOrder)`
from inside its own click handler — a shared `components/shared/` component reaching into a specific
data hook, bypassing the Component→Hook→Service separation the rules establish for *pages*. The retyped
version takes `onCancel?: () => void` and `isCancelling?: boolean` as props instead, matching the
established precedent `ProductOrderModal` already set in Sub-03 Sprint 3 of set-01 (`onSubmit`/
`isSubmitting` props, not an owned `usePlaceOrder()` call). `OrderCard` still owns its own **UI-only**
state (`isExpanded`, `isCancelDialogOpen`) — that's presentational state, not a data hook, same
distinction `ProductOrderModal`'s own `useForm()` draws.

The 4 AdminDashboard "section" components had the identical problem at a different layer: each called
its *own* stub hook (`useDashboardStats`, `useRecentOrders`, `useRecentClients`, `useLowStockProducts`)
independently, which is exactly the "N independent per-widget fetches" plan.md D10 says Sprint 6 must
eliminate in favor of one aggregate query. Sprint 3's task list said "retype... **keep** them
presentational" — they weren't, so this retype also converts them: each section now takes its data slice
+ `isLoading`/`isError` as props and is a thin forwarder to its inner table/card component. Doing this
now (rather than deferring the architecture change to Sprint 6 on top of a same-shaped retype) avoids
double work.

## DTO-shape note: two AdminDashboard tables lost columns the contract just doesn't carry

`AdminDashboardDto['recentOrders']`/`['recentClients']` (`DashboardOrderSummarySchema`/
`DashboardClientSummarySchema`) are the two DTOs flagged in the contract itself as "the most heavily-
inferred... revisit once the backend stage's actual dashboard queries are implemented." They're much
thinner than the draft view-models they replace:

| Table | Draft columns | Real DTO columns |
|---|---|---|
| Recent Orders | code, items, client, type, total, date, status | **reference, total, date** |
| Recent Clients | name, phone, wilaya, commune, status | **name, joined-date** |

No client name/type/status on an order summary; no phone/location/status on a client summary. Rather than
inventing data the DTO doesn't provide, both tables were simplified to exactly what's there, and the
now-unused status/type badge-color helper functions were dropped with the columns they served. Also
fixed while touching these: `dashboard-stats-cards.tsx`'s `formatCurrency` hardcoded
`Intl.NumberFormat("en-US", {currency:"USD"})` — a pre-existing bug (this app is DZD-only everywhere
else) — replaced with the shared `formatDZD`.

## Fork note: `orders-list-section.tsx` gets a local, throwaway card

The retyped `OrderCard`/`CancelOrderDialog` speak `OrderDto` (uuid, single-product); the stub
`orders-list-section.tsx` (still driven by `use-orders.ts`, `OrderWithDetails`, numeric `idOrder`,
`orderLines[]`) has structurally incompatible data with nothing to bridge — a numeric id can't become a
real uuid, and there's no multi-line array on the real type to render. Per the sprint's own risk note
("bridge or flag") and set-01's established precedent for the identical situation (Sprint 3 there:
"`MyAccount.tsx`/`Register.tsx` bridge via inline field-mapping adapters at the call site"), this got a
small **local** `LegacyOrderCard` function (defined inside `orders-list-section.tsx` itself, not a new
shared file) that renders the old `OrderWithDetails` shape directly — compact, no expand/detail, no
confirm dialog (the stub's own cancel flow already just fired-and-toasted with no confirmation step).
`orders-list-section.tsx` now also pulls `cancelOrder` from `useOrders()` itself (previously `OrderCard`
made that call on its behalf) and passes it down as `onCancel`. This whole file — and this bridge — is
retired outright in Sprint 5 when `Orders.tsx` drops `OrdersListSection` for the real `useMyOrders`/
`useCancelMyOrder` wiring.

## Bridge note: `AdminDashboard.tsx` was *not* rewired onto real data this sprint

Converting the 4 sections to presentational meant `AdminDashboard.tsx` (which previously rendered each
`<XSection />` with **zero props**, relying on each one's own internal fetch) now needed *something* to
pass down, or every widget would show its own "couldn't load" fallback permanently. The honest options
were: (a) build a field-mapping adapter from the page's existing `useDashboardData()` stub result
(`DashboardData`, numeric ids, pre-formatted display-string dates) into the new `AdminDashboardDto` sub-
shapes, or (b) don't fake it. Option (a) doesn't actually work cleanly — a numeric `idOrder` isn't a uuid
and an already-formatted date string (e.g. "Jan 15, 2026") fed into `formatDateTime()` (which expects a
raw ISO string) would silently produce wrong or "Invalid Date" output. Rather than ship a lossy adapter
that *looks* wired but quietly shows wrong dates, `AdminDashboard.tsx` got a **minimal, honest** touch:
`isLoading`/`isError` (both accurate — they reflect the same query's real state) are passed to each
section; the data props are left `undefined`, so each section's own "no data yet" fallback renders
instead of a crash. This is the same class of transitional gap set-01 accepted with "empty DTO-typed
placeholder arrays" for `Products.tsx`'s filters in its own Sprint 3 — flagged in a code comment as
Sprint 6's job (the sprint plan.md already assigns `useAdminDashboard()` wiring to), not silently left
unexplained.

**Newly orphaned as a result:** `use-dashboard-stats.ts`, `use-recent-orders.ts`, `use-recent-clients.ts`,
`use-low-stock-products.ts` (each now has zero real consumers — grep-verified). Not deleted this sprint,
per the "flag, don't delete outright" convention; `AdminDashboard.tsx`'s own `useDashboardData()` stays
in place (still gates the page's full-page loading/error state) until Sprint 6.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` (both configs, `npm run check`) | ✅ clean |
| `vitest run` (`npm run test`) | ✅ 353/353 passed, 44/44 files, no regressions |
| No residual `draft-types` imports | ✅ grep-confirmed across all 11 retyped files |
| `eslint` before/after (13 touched files, `--fix` applied) | ✅ 0 errors after fix; net **-210** errors vs. baseline (OrderCard 62→16, CancelOrderDialog 22→0, recent-orders-table 61→2, recent-clients-table 51→2, low-stock-alert 27→2, AdminDashboard 24→22, the rest flat-or-improved) — 100% `prettier/prettier` rule-class, no real issues at any point |
| Inline strings | ✅ none introduced; 4 reachable hardcoded English strings in `low-stock-alert.tsx` fixed (3 new i18n keys) |
| `useTranslation` / no new TanStack hooks | ✅ all 12 retyped components are presentational; sections take data as props |

## Next

Sprint 4 — Page-local primitives, Skeletons & local fallbacks: build the real shape-matched skeleton/
empty/error primitives for all 7 pages (replacing the Sprint 2 placeholder shells for the 5 new pages),
ahead of Sprint 5/6 wiring.
