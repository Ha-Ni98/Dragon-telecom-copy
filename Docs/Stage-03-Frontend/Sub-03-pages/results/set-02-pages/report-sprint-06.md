# Sprint 6 Report — Wiring: staff & admin cluster (Assembly & Wiring)

**Set:** set-02-pages · **Status:** ✅ Done · **Branch:** `pages-set-02`

---

## Summary

Wired all three remaining pages onto real hooks. STF-01 and STF-03 are net-new wiring against Sprint 4's
primitives; ADM-01 closes the transitional bridge Sprint 3 deliberately left open — `AdminDashboard.tsx`
now gets its data from `useAdminDashboard()` instead of rendering every widget with no data. This is the
last wiring sprint: all 7 pages in the set are now fully assembled. `tsc --noEmit` clean, `vitest run`
353/353 (no regressions), 0 lint errors after `--fix`.

## Files changed

**Rewritten (Sprint 2 placeholder → real page)**
- `pages/staff/dashboard/StaffDashboard.tsx` — `useStaffDashboard()` + `usePermissions()`, 4 widgets,
  silent-hide on error.
- `pages/staff/products/StaffProducts.tsx` — `useStaffProducts()` + cascading taxonomy + debounced search
  + `useSendStaffSearch()` beacon, URL-as-state (mirrors Catalog's `Products.tsx` pattern exactly).
- `pages/admin/dashboard/AdminDashboard.tsx` — full rewire onto `useAdminDashboard()`, one query
  decomposed into 8 sections (the original 4 + the 4 new work-queue/repairs/draft-sales widgets); the
  full-page `isLoading`/`error` gate is gone entirely.

**Deleted (orphaned, grep-verified)**
- `hooks/use-dashboard-data.ts` (explicitly named in the task).

## Design notes

- **STF-01's pending-orders gate keeps both conditions, even though one is likely always redundant.**
  `StaffDashboardDto.myPendingOrdersCount` is already server-gated on `STAFF_ORDERS`
  (`statistics.dtos.ts`) — a widget checking only `count !== undefined` would already be correct in
  practice. The page *also* checks `usePermissions()` for `STAFF_ORDERS` directly, per the task's literal
  "gate on `STAFF_ORDERS` **and** presence of `myPendingOrdersCount`" wording — defense-in-depth against
  the two data sources (dashboard cache vs. permissions cache) ever momentarily disagreeing, e.g. right
  after a permission is revoked but the dashboard query hasn't refetched yet.
- **ADM-01's new widgets pass `refetch` directly as `onRetry`**, not a wrapped handler — `useAdminDashboard()`'s
  `refetch` already matches the `() => void`-ish shape every widget's `onRetry` prop expects (TanStack's
  `refetch` returns a promise, but none of the retry chips await it, so this is a direct pass-through, not
  a new function).
- **The work-queue row `<Link>`s (`/admin/orders`, `/admin/clients`) were already built in Sprint 4** — this
  sprint only had to supply real `orders`/`clients` data; no interaction logic changed.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` (both configs, `npm run check`) | ✅ clean |
| `vitest run` (`npm run test`) | ✅ 353/353 passed, 44/44 files, no regressions |
| `eslint` (3 touched files, `--fix` applied) | ✅ 0 errors/warnings after fix; 6 pre-fix errors were `prettier/prettier` line-wrapping, 1 was a now-genuinely-unused `eslint-disable-next-line react-hooks/exhaustive-deps` comment (this effect's deps array didn't actually need suppressing here — `--fix` removed it) |
| `useEffect` count | ✅ `StaffProducts.tsx`: 3 (2 URL-sync, 1 beacon — same class as Catalog); `StaffDashboard.tsx`/`AdminDashboard.tsx`: 0 |
| Layout never blanks | ✅ `AdminDashboard.tsx` has no top-level `if (isLoading)`/`if (error)` return at all anymore — every section owns its own state |
| STF-01 silent-hide | ✅ all 4 widgets wrapped in `{!isError && ...}`, no visible error UI |
| Orphaned-file retirement | ✅ `use-dashboard-data.ts` grep-verified (2 remaining hits were comments, not imports) before deletion |

## What's now fully wired vs. still flagged

All 7 pages in this set consume real data end-to-end. Two small, previously-flagged cleanup items remain
untouched (deliberately, both already documented as out-of-scope for this set):
- `orders.service.ts`'s orphaned `getMyOrders`/`cancelOrder` numeric stubs (Sprint 5).
- `dashboard.service.ts` + its now-fully-orphaned chain (`use-dashboard-stats.ts`, `use-recent-orders.ts`,
  `use-recent-clients.ts`, `use-low-stock-products.ts`, all flagged in Sprint 3, plus `use-dashboard-data.ts`
  from this sprint) — five files sharing one service, all dead, worth one consolidated cleanup pass.

## Next

Sprint 7 — Polish: responsive passes (mobile-first public pages, desktop-first `StaffLayout`/
`AdminLayout`), targeted `useMemo`/`useCallback` review, beacon-timing verification, and a full i18n
sweep across all seven pages.
