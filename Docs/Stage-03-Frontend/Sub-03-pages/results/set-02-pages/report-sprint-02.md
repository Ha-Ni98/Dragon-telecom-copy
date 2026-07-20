# Sprint 2 Report — Routing, Guards, StaffLayout, Lazy & Engine-gap prep (Foundation)

**Set:** set-02-pages · **Status:** ✅ Done · **Branch:** `pages-set-02`

---

## Summary

Closed the one real engine gap (`useMyInvoice`/`useMyInvoicePdf`), built the third layout shell
(`StaffLayout`/`StaffHeader`/`StaffSidebar`) plus a new `PageGuard` primitive for per-`PageKey` route
gating, wired the full route table (5 new routes, 1 moved, 1 retired), and fixed PUB-03's stale
order-success navigation target. `tsc --noEmit` clean, `vitest run` 353/353 (356 − 3 tests removed with
the retired `StaffLanding` component), 0 new lint errors (1 pre-existing `App.tsx` prettier line crossed
its width threshold from the new routes — auto-fixed, no logic change).

## Files changed

**New**
- `src/components/layout/StaffSidebar.tsx` — `StaffSidebarNav` + `StaffSidebar`, mirrors `AdminSidebar.tsx`
  but **permission-filtered** (see Design notes).
- `src/components/layout/StaffHeader.tsx` — mirrors `AdminHeader.tsx` (logo → `/staff`, mobile sheet →
  `StaffSidebarNav`, reuses `admin.shell.*` copy — see Design notes).
- `src/components/layout/StaffLayout.tsx` — mirrors `AdminLayout.tsx`.
- `src/components/layout/PageGuard.tsx` — new primitive: gates a route subtree on a single `PageKey` (on
  top of the coarser `RoleGuard`), for `/staff/products`.
- `src/pages/cart/Cart.tsx`, `src/pages/order-confirmation/OrderConfirmation.tsx`,
  `src/pages/my-invoices/MyInvoices.tsx`, `src/pages/staff/dashboard/StaffDashboard.tsx`,
  `src/pages/staff/products/StaffProducts.tsx` — thin placeholder shells (pure `Skeleton` markup, zero
  hooks, zero text) so the route table + `tsc` are green ahead of Sprints 5–6.

**Modified**
- `src/hooks/useBilling.ts` — added `useMyInvoice(number)` and `useMyInvoicePdf()` (D3).
- `src/lib/query-keys.ts` — added `qk.billing.mineDetail(number)`.
- `src/lib/staff-pages.ts` — removed `firstPermittedStaffRoute()` (dead — nothing redirects through it
  anymore); `STAFF_PAGE_ROUTES` repurposed as the sidebar's shipped-route lookup, now seeded with
  `STAFF_PRODUCTS → "/staff/products"`.
- `src/config/nav-links.ts` — added `StaffNavLink` type + `STAFF_NAV_LINKS` (8 entries: 1 ungated
  dashboard + 7 `PageKey`-tagged).
- `src/App.tsx` — see Routing changes below.
- `src/pages/ProductDetails.tsx` — D9 fix (see below); dropped the now-unused `toast`/`sonner` import.
- `tests/unit/pages/login/redirect.test.tsx` — removed the dead `StaffLanding (PUB-06 D4)` describe block
  (3 tests, imported the now-deleted component); kept the `PublicOnlyRoute` describe block, which tests
  different behavior against a local stub route and was never affected.

**Deleted**
- `src/pages/StaffLanding.tsx` — grep-confirmed zero remaining consumers after the App.tsx/test changes
  below.

## Routing changes (`App.tsx`)

| Route | Before | After |
|---|---|---|
| `/order-confirmation` | didn't exist | **new**, public, under `PublicLayout` — no route guard (PUB-05: guests keep the reference too; state-guarded internally in Sprint 5) |
| `/orders` | any-authenticated (`ProtectedRoute`) | moved into the CLIENT-only `RoleGuard` block (D12 — staff/admin must not reach the client order surface) |
| `/cart`, `/invoices` | didn't exist | **new**, same CLIENT-only `RoleGuard` block as `/my-account`/`/orders` |
| `/staff` | `StaffLanding` (redirect to first permitted page) | **`StaffDashboard`** — a fixed page now, mirrors `/admin`; nested under the new `StaffLayout`, still `RoleGuard allow={[STAFF,ADMIN]}` |
| `/staff/products` | didn't exist | **new**, under `StaffLayout`, `RoleGuard allow={[STAFF,ADMIN]}` **+** `PageGuard requires={STAFF_PRODUCTS}` |

The any-authenticated `ProtectedRoute` block is now empty (its only route, `/orders`, moved out) and was
removed from the router entirely — `ProtectedRoute` the component stays (still directly unit-tested,
still legitimate reusable infra for a future any-authenticated-only page), just its import dropped from
`App.tsx` since nothing there uses it anymore.

## Design notes

- **`PageGuard` needs no ADMIN special-case.** Traced the backend
  (`Apps/api/src/modules/identity/identity.mapper.ts:99`: `if (type === PrismaUserType.ADMIN) return
  allPageKeys;`) — an ADMIN session's `/identity/me/permissions` response already contains **every**
  `PageKey`, so `permissions.includes(requires)` is `true` for admins automatically. `PageGuard` is a
  single unconditional check, not two branches.
- **`StaffSidebarNav` fails closed.** Unlike `AdminSidebarNav` (static, unconditional — admin bypasses
  the page-permission matrix by definition), the staff sidebar calls `usePermissions()` for real. A gated
  entry renders **nothing** while permissions are loading or on error, and only appears once confirmed
  permitted — never a flash of a link the next render might yank away. This is a deliberately minimal
  (no dedicated loading skeleton for the sidebar itself) but safe default; `AdminSidebar` has no analogous
  state at all since it needs no permission fetch. Flagged as a candidate for Sprint 7 polish if a nicer
  loading treatment is wanted.
- **Permitted-but-unshipped nav entries render disabled, not as dead links.** 6 of the 7 `PageKey`-tagged
  `STAFF_NAV_LINKS` entries (everything but Products) have no route yet in `STAFF_PAGE_ROUTES`. Rather than
  hide them (which would make the sidebar lie about what the viewer is actually permitted to do) or link
  them to a 404, they render as a muted, non-interactive `<span aria-disabled>` — visible, honest about
  being "not built yet," not clickable.
- **`StaffHeader` reuses `admin.shell.*` keys rather than duplicating a `staff.shell.*` namespace.** Content
  ("Open menu", "Sign out?", the confirm body) is genuinely shell-generic, not admin-specific — the "admin"
  prefix is a naming artifact of which shell got built first. Matches this codebase's established
  reuse-over-duplication precedent (e.g. `register.wilayaRequired` reused verbatim in the order form on an
  unrelated page). Documented here as a deliberate call, not an oversight.
- **Placeholder pages carry zero text on purpose.** Since Sprint 4 is explicitly the sprint that builds
  each page's real shape-matched skeleton, these 5 files are pure `<Skeleton>` blocks with no strings at
  all — trivially satisfies "no inline strings" rather than needing throwaway copy that Sprint 4 would
  immediately replace.

## D9 — PUB-03 order-success navigation fix

`ProductDetails.tsx`'s `handleOrderSubmit` used to `await placeOrderMutation.mutateAsync(command)` (discarding
the result), toast a generic success message, and `navigate("/orders")` — a set-01 stopgap written before
PUB-05 existed. Now it captures the returned `OrderDto` and navigates to
`navigate("/order-confirmation", { state: { order } })`. The `toast.success(t("product.orderSuccess"))` call
was **removed**, not just left in place: PUB-05 is itself the success feedback (a full dedicated "Order
placed!" page) — toasting immediately before navigating to a page whose entire purpose is announcing the
same success would be redundant, doubled-up messaging. This dropped the file's `sonner` import, which had no
other consumer in the file. Grep-confirmed no existing test asserted the old `/orders` target, so nothing
else needed updating this sprint — Sprint 8 adds the real assertion (`navigates to /order-confirmation with
state.order`).

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` (both configs, `npm run check`) | ✅ clean |
| `vitest run` (`npm run test`) | ✅ 353/353 passed, 44/44 files (356 − 3 removed `StaffLanding` tests, 0 regressions elsewhere) |
| `eslint` on all 16 new/touched files | ✅ 0 errors on 14; `App.tsx` had 7 pre-existing-style errors from lines whose length crossed prettier's wrap threshold (`--fix`-applied, reformatting only — diffed to confirm zero logic change); `ProductDetails.tsx` unchanged at 109 pre-existing errors (stashed/compared — my 2-line edit didn't add or remove any) |
| Inline strings | ✅ none introduced (5 placeholders are text-free; layout/sidebar/header reuse verified keys) |
| `useEffect` fetching | ✅ none introduced (grep-confirmed zero `useEffect` in any of the 9 new files) |
| Test files in `/src` | ✅ none added |
| Guards | ✅ `/orders` now CLIENT-only; `/staff`+`/staff/products` reject CLIENT; `/cart`+`/invoices` reject STAFF/ADMIN; `/staff/products` additionally rejects a STAFF session without `STAFF_PRODUCTS` |

## Next

Sprint 3 — Shared DTO-typed primitives: retype `OrderCard`/`CancelOrderDialog` to `OrderDto`, widen
`ProductOrderModal`'s `product` prop to `ProductWithPricingDto` (D8), and retype the 4 reused
`AdminDashboard` section components to `AdminDashboardDto`.
