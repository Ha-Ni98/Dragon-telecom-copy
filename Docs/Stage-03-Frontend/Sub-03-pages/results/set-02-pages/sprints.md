# Sub-03 · Page Assembly Sprint Plan — Set 02 (Commerce tail + Staff/Admin dashboards)

> **Input plan:** `./plan.md` (PUB-04 Cart, PUB-05 Order-Confirmation, PUB-09 My-Orders, PUB-10
> My-Invoices, STF-01 Staff-Dashboard, STF-03 Staff-Products, ADM-01 Admin-Dashboard).
> **Nature:** planning only — **no code yet**. All sprints below are ⬜ Pending.
> **Source of truth:** `Apps/contract`, `Apps/api`, and the requirement docs. `Apps/web` is MVP+template
> scaffolding; where it conflicts with the requirements, the requirement wins.

## Strategy — inside-out, layer-first across the whole set

The phase file mandates **Foundation → Primitives & States → Assembly & Wiring → Polish → Tests**, and
"wiring never precedes primitives." Because this is a **7-page set** that is half rewire / half net-new
with shared prerequisites (the missing client-invoice hooks, a brand-new `StaffLayout`, routing/guards,
DTO retype of shared components), each layer is built **globally** and, where large, split into lettered
sprints. Global order is preserved: **all Foundation lands before any Primitives; all Primitives before
any Wiring.**

| # | Sprint | Layer |
|---|---|---|
| 1 | Schemas & i18n | Foundation |
| 2 | Routing, Guards, StaffLayout, Lazy & Engine-gap prep | Foundation |
| 3 | Shared DTO-typed primitives (retype) | Primitives & States |
| 4 | Page-local primitives, Skeletons & local fallbacks | Primitives & States |
| 5 | Wiring — commerce cluster (Cart / Order-Confirmation / My-Orders / My-Invoices) | Assembly & Wiring |
| 6 | Wiring — staff & admin cluster (Staff-Dashboard / Staff-Products / Admin-Dashboard) | Assembly & Wiring |
| 7 | Polish — responsive, memo/callback, beacons, i18n sweep | Polish |
| 8 | Unit tests — pages, forms, guards | Tests |

### Conventions applied to **every** sprint (also re-asserted in each Validation block per the set-02 brief)
- **`useTranslation` only** — no inline JSX strings; every string is a `t('scope.feature.element')` key in
  `src/config/translations.json` with `{ en, fr, ar:"" }` (populate `en`/`fr`, leave `ar` empty).
- **No `useEffect` for fetching.** The only permitted non-fetch effect in this set is the STF-03
  **staff-search beacon** mutation and URL⇄state sync (not fetching).
- **`tsc --noEmit` clean** (both `tsconfig.json` and `tsconfig.test.json`) and **`vitest run` green** before
  every commit (existing suite stays green; new page specs are authored in Sprint 8).
- **No test files in `/src`** (tests live under `/tests`, test-rules §1). Test files are named
  **`*.test.tsx`** (Vitest `include = tests/**/*.test.{ts,tsx}` — `.spec.tsx` is never collected).
- **Component → Hook → Service** only; services already unwrap `ApiResponse<T>`.
- **Commit on green**, one commit per sprint: `fe: set-02 sprint N — <topic>` (repo style; `git add .`,
  no Co-Authored-By).

---

### Sprint 1: Schemas & i18n (Foundation) — Status: ✅ Done

**Goals**
- Confirm the set needs **no new Zod schema**, with the two reuse/deviation decisions documented.
- All translation keys for the seven pages exist (`en`/`fr` real copy, `ar:""`).

**Tasks**
- [x] Verify/keep `src/pages/product-detail/order.schema.ts` — **PUB-04 reuses it unchanged** (the shared
      PUB-03 order form); no new cart schema. (#foundation)
- [x] **Deviation (record):** PUB-09's "cancel dialog with optional reason textarea" is dropped — the client
      `ORDER_ROUTES.MY_CANCEL` accepts **no body** (`cancelMyOrder(id)` sends none; the contract's
      `reason?` belongs to the ADMIN cancel command only). `CancelOrderDialog` stays a plain confirm
      (`onConfirm: () => void`); no cancel schema. Contract wins (source-of-truth). (#foundation)
- [x] Note (no file): PUB-09 status filter and STF-03 filters validate parsed URL params against the
      contract `MyOrdersQuery` / `ProductListQuery` **before the query fires** — no new schema. (#foundation)
- [x] Add translation key namespaces (`en`/`fr` real, `ar:""`): `cart.*` (list/empty/priceOnRequest/
      remove/order), `orderConfirmation.*` (success/reference/line/fee/total/mode/pending message/CTAs),
      `orders.*` (extend: status labels ×7, filter chips, count chips, cancel, detail fields, tracking,
      timeline, invoice link), `invoices.*` (table headers/source labels/view/pdf/empty/notFound),
      `staff.dashboard.*` (salesToday/revenue/drafts/pendingOrders/lowStock), `staff.products.*`
      (filters/columns/copyBarcode/empty), `admin.dashboard.*` (extend: pendingOrders/pendingRegistrations/
      repairsByStatus/draftSalesByStaff/retry). Reuse `common.*`, `product.*`, `admin.nav.*`. (#i18n)
- [x] Add `staff.nav.*` keys for the new StaffSidebar entries (dashboard, products) — consumed in Sprint 2.
      (#i18n)

**Validation**
- [x] **`useTranslation`:** every new label/message is a key in `translations.json` (`{en,fr,ar:""}`); no
      inline strings introduced.
- [x] No new Zod schema added (reuse-only, verified); any parsed-URL guard uses the contract query schema.
- [x] **`tsc --noEmit` clean** (both configs) — `npm run check`, zero errors.
- [x] `vitest run` green (existing suite unaffected) — 44 files, 356/356 tests.

**Risks**
- The dropped cancel "reason" is a requirement deviation — ensure dialog copy doesn't promise a reason
  field. Carry into Sprint 5.

**Report:** `report-sprint-01.md`.

---

### Sprint 2: Routing, Guards, StaffLayout, Lazy & Engine-gap prep (Foundation) — Status: ✅ Done

**Goals**
- The route table matches the requirements (client-scoped `/cart` `/orders` `/invoices`; public
  `/order-confirmation`; `/staff` = dashboard and `/staff/products` under a new `StaffLayout`).
- The one engine gap (client-invoice hooks) is closed; PUB-03's success target is corrected.

**Tasks**
- [x] **D3 (engine gap):** add `useMyInvoice(number)` + `useMyInvoicePdf()` to `useBilling.ts` (wrap the
      existing `billingService.getMyInvoice`/`getMyInvoicePdf`); add a `qk.billing.mineDetail(number)` key
      to `lib/query-keys.ts`. (#wiring)
- [x] **D4:** build `StaffLayout` (`components/layout/StaffLayout.tsx`) mirroring `AdminLayout`
      (header + sidebar + `<main><Outlet/>`); `StaffHeader`; `StaffSidebarNav` rendering a new
      `STAFF_NAV_LINKS` filtered by `usePermissions()` (each entry tagged with its `PageKey`). (#routing)
- [x] **D4/D11:** add `STAFF_NAV_LINKS` to `config/nav-links.ts` (dashboard → `/staff`, products →
      `/staff/products` shipped; POS/orders/sales/invoices/repairs entries planned but route-less —
      scope-confined `<Link>`s only); populate `STAFF_PAGE_ROUTES` in `lib/staff-pages.ts` with the shipped
      entries. (#routing)
- [x] **D1:** in `App.tsx`, **replace the `/staff` element (`StaffLanding`) with `StaffDashboard`**; add
      `/staff/products` (`StaffProducts`); nest both under a `StaffLayout` route element guarded
      `RoleGuard allow={[STAFF, ADMIN]}`, with `/staff/products` additionally gated on
      `PageKey.STAFF_PRODUCTS`. Retire `StaffLanding` + `firstPermittedStaffRoute()` once unreferenced.
      (#routing)
- [x] **D12:** add `/cart` and `/invoices` under the existing `RoleGuard allow={[CLIENT]}` block; **move
      `/orders`** out of the any-authenticated `ProtectedRoute` into that CLIENT block; add
      `/order-confirmation` (public, **no** role guard — state-guarded in Sprint 5). (#routing)
- [x] Add `React.lazy()` + `<Suspense fallback={<PageLoader/>}>` entries for the 5 new page components
      (Cart, OrderConfirmation, MyInvoices, StaffDashboard, StaffProducts) — **thin placeholder shells**
      (render a skeleton) so routing/`tsc` stay green until Sprints 5–6 flesh them out. (#routing)
- [x] **D9:** correct PUB-03's order-success navigation in `ProductDetails.tsx` from `navigate("/orders")`
      to `navigate("/order-confirmation", { state: { order } })`. (#wiring)

**Validation**
- [x] **`useTranslation`:** all new StaffLayout/sidebar copy via `staff.nav.*` (+ reused `admin.shell.*`/
      `common.actions.*` for shell chrome — see report); no inline strings.
- [x] **`tsc --noEmit` clean** after route/guard/layout changes + the 2 new hooks.
- [x] Guards preserve pre-mount `AuthRestoring` (no `/login` flash); `/orders` now rejects staff/admin;
      `/staff` `/staff/products` reject clients; `/cart` `/invoices` reject non-clients.
- [x] Layout survives `isError` on any lazy route (`RouteErrorBoundary` unchanged).
- [x] `vitest run` green — `redirect.test.tsx`'s dead `StaffLanding` describe block removed (component
      retired); its still-valid `PublicOnlyRoute` describe block kept as-is. 353/353 (356 − 3 removed).

**Risks**
- Moving `/orders` to CLIENT-only may break set-01 guard tests — fix in the same sprint (or note the
  assertion change for Sprint 8). *(No break — `ProtectedRoute.test.tsx` tests the component directly,
  not via App.tsx's route tree; only `redirect.test.tsx`'s StaffLanding-specific block needed removal.)*
- Placeholder page shells must render a skeleton only — never wired to a stub hook — until Sprints 5–6.
  *(Confirmed — all 5 are pure Skeleton markup, zero hooks, zero text.)*

**Report:** `report-sprint-02.md`.

---

### Sprint 3: Shared DTO-typed primitives (Primitives & States) — Status: ✅ Done

**Goals**
- The shared components consumed by this set speak **contract DTOs (uuid ids)** — the prerequisite for all
  wiring (plan D8 + the OrderCard/AdminDashboard retypes).

**Tasks**
- [x] `OrderCard` (shared) → retype to `OrderDto` (`id` uuid, `reference`, `status`, `orderType`,
      `productName`, `quantity`, `resolvedPrice`/`unitPrice`, `subtotal`, `deliveryFee`, `totalAmount`,
      `paidAmount`, `wilaya`/`commune`, `deliveryCompany`/`trackingNumber`, `placedAt`, `canBeCancelled`,
      `ageHours`). Drop the numeric-id `OrderWithDetails` draft fields. (#ui)
- [x] `CancelOrderDialog` (shared) → keep as a plain confirm (open state + `onConfirm`, no reason field per
      Sprint 1); retype any order prop to `OrderDto`. (#ui)
- [x] **D8:** widen `ProductOrderModal`'s `product` prop `ProductDetailDto` → `ProductWithPricingDto` (all
      fields it reads are on the base); verify PUB-03's existing `ProductDetailDto` call site still compiles
      (assignable — no change there). (#ui)
- [x] Retype the 4 reused AdminDashboard section components (`dashboard-stats-section`,
      `recent-orders-section`, `recent-clients-section`, `low-stock-alert-section`) from draft view-models
      → `AdminDashboardDto` sub-shapes (`stats`, `recentOrders`, `recentClients`, `lowStockProducts`). Keep
      them presentational. (#ui)

**Validation**
- [x] **`tsc --noEmit` clean**; no residual `draft-types` imports in the retyped components (grep-verified).
- [x] **`useTranslation`:** components stay presentational (no new TanStack hooks); all text via `t(...)`.
- [x] `vitest run` green — 353/353, no regressions.

**Risks**
- `OrderCard`/`CancelOrderDialog` are still consumed by the out-of-set stub `orders-list-section.tsx`
  (numeric ids, `use-orders.ts`) — bridge or flag; don't silently break it (retired in Sprint 5).
  *(Forked: `orders-list-section.tsx` got its own local `LegacyOrderCard`, since `OrderCard` no longer
  speaks its shape — see report.)*

**Report:** `report-sprint-03.md`.

---

### Sprint 4: Page-local primitives, Skeletons & local fallbacks (Primitives & States) — Status: ✅ Done

**Goals**
- Every page's loading/error/empty **shape-matched** primitives exist as dumb, layout-preserving
  components — before any hook is wired. Dashboard widgets are built to accept `isLoading`/`isError`/`data`
  props so the single-query decomposition (plan D10) drops in cleanly in Sprint 6.

**Tasks**
- [x] **PUB-04 Cart:** `CartItemRow` (image, name, live price, availability chip, remove-heart, Order
      button; **"Price on request" + disabled-Order** variant) + a `CartItemRow` skeleton list; `EmptyState`
      usage. (#ui)
- [x] **PUB-05 Order-Confirmation:** `OrderConfirmation` body (success icon, reference, product line, fee,
      total, mode, pending message) — props-driven from an `OrderDto`; the `<Navigate to="/">` direct-nav
      guard scaffold. (#ui)
- [x] **PUB-09 My-Orders:** status filter chips + summary count chips (+ skeleton); `OrderCard` skeleton
      cards; per-filter `EmptyState`; expandable detail layout (mode, wilaya/commune, tracking, timeline,
      invoice-link placeholder). (#ui)
- [x] **PUB-10 My-Invoices:** `MyInvoices` `DataTable` column defs + `TableSkeleton`; `InvoiceView`
      read-only body (header snapshot + `lines[]` table + PDF button) with its own skeleton + local 404
      `NotFoundState`. (#ui)
- [x] **STF-01 Staff-Dashboard:** widget shells + skeletons — `MySalesTodayCard` (2 `StatCard`s),
      `MyDraftsList`, `PendingOrdersWidget`, `LowStockList`; per-widget `StatCardSkeleton`/list skeleton;
      silent-hide-on-error branch scaffold. (#ui)
- [x] **STF-03 Staff-Products:** `StaffProductFilters` bar (search + family/brand/model selects) +
      `DataTable` column defs (**no image column**, data-driven category-price columns from
      `categoryPrices[]`); `TableSkeleton`; `EmptyState` + clear-filters. (#ui)
- [x] **ADM-01 Admin-Dashboard:** new widget shells + skeletons — `PendingOrdersWidget`,
      `PendingRegistrationsWidget`, `RepairsByStatusWidget`, `DraftSalesByStaffWidget`; a per-section
      **retry-chip** fallback primitive. (#ui)

**Validation**
- [x] Each skeleton matches the real content's shape (no CLS on resolve).
- [x] **`tsc --noEmit` clean**; **`useTranslation`:** all copy via `t(...)`.
- [x] All primitives are dumb (props only, no hooks); layout preserved in every error/empty branch.
- [x] `vitest run` green — 353/353, no regressions.

**Risks**
- Skeleton dimensions drifting from the DTO-driven layout cause CLS — size to real content.
  *(Sized against the real DTO fields throughout — see report.)*
- Build dashboard widgets to take `isLoading`/`isError`/`data` props (one shared query in Sprint 6, not N).
  *(All 4 new ADM-01 widgets + all 3 STF-01 widgets take exactly that shape.)*

**Report:** `report-sprint-04.md`.

---

### Sprint 5: Wiring — commerce cluster (Assembly & Wiring) — Status: ✅ Done

**Goals**
- PUB-04, PUB-05, PUB-09, PUB-10 consume the real hooks with granular states; cart order flow, cancel, and
  invoice PDF work end-to-end.

**Tasks**
- [x] **PUB-04 Cart:** wire `useClientCart()` (skeleton / empty / error-retry), `useRemoveFromCart()`
      (heart), and the shared `ProductOrderModal` driven by the selected `item.product` + parent-owned
      `useWilayas()` / `usePlatformDeliveryFee()` / `usePlaceOrder()`; submit →
      `navigate("/order-confirmation", { state: { order } })`; `priceHidden` disables Order. (#wiring)
- [x] **PUB-05 Order-Confirmation:** read `useLocation().state.order`; render the OrderConfirmation body;
      `<Navigate to="/" replace />` when state is absent; client-only My-Orders link via `useSession()`.
      (#wiring)
- [x] **PUB-09 My-Orders:** rewire `pages/Orders.tsx` onto `useMyOrders({ status })` (list, URL `?status=`)
      + `useMyOrders({})` (unfiltered → `useMemo` status counts) + `useCancelMyOrder()`; delete the stub
      `OrdersListSection` + numeric handlers; cancel gated on `order.canBeCancelled`; retire
      `use-orders.ts` / `orders-list-section.tsx` once orphaned (grep-verify). (#wiring)
- [x] **PUB-10 My-Invoices:** wire `useMyInvoices({ page })` (`DataTable` + `SimplePagination`, URL
      `?page=`), `useMyInvoice(number)` (row → `InvoiceView`, 404 local), `useMyInvoicePdf()`
      (Blob → object-URL download). (#wiring)

**Validation**
- [x] No `useEffect` fetching in any of the 4 pages (grep-confirmed zero `useEffect` at all — URL-sync
      here is synchronous during render, no debounce needed unlike Catalog's free-text search).
- [x] **`tsc --noEmit` clean**; all states local — no full-page blank, no global redirect on a content
      error (PUB-05's `<Navigate to="/">` is the spec-required **state** guard, not a content-error
      redirect).
- [x] **`useTranslation`:** all copy via `t(...)`.
- [x] `vitest run` green — 353/353, no regressions.

**Risks**
- PUB-09 counts: the unfiltered `useMyOrders({})` and filtered `useMyOrders({status})` must use **distinct
  query keys** so the chips reflect all statuses, not the filtered subset (`qk.orders.mine({})` ≠
  `qk.orders.mine({status})`). *(Confirmed — two independent hook calls, TanStack's own key-based caching
  keeps them separate.)*
- Blob PDF: `responseType:'blob'` bypasses the envelope — don't try to unwrap `{success,data}` on download.
  *(`InvoiceDetail.tsx` passes the mutation's Blob result straight to `downloadBlob`, no unwrap.)*

**Report:** `report-sprint-05.md`.

---

### Sprint 6: Wiring — staff & admin cluster (Assembly & Wiring) — Status: ⬜ Pending

**Goals**
- STF-01, STF-03, ADM-01 consume the real hooks with **per-widget states off a single aggregate endpoint**
  (plan D10).

**Tasks**
- [ ] **STF-01 Staff-Dashboard:** wire `useStaffDashboard()` + `usePermissions()`; render each widget's own
      skeleton off the one query; gate the pending-orders widget on `STAFF_ORDERS` **and** presence of
      `myPendingOrdersCount`; drafts link into POS (`STAFF_POS`, future route — `<Link>` only); **silent-hide
      widgets on error** (layout + sidebar persist). (#wiring)
- [ ] **STF-03 Staff-Products:** wire `useStaffProducts(query)` (URL-as-state via
      `ProductListQuerySchema.safeParse`), cascade `useCatalogFamilies` / `useCatalogBrands` /
      `useCatalogModels({ brandId })` (**brand change resets `modelId`**), 300 ms debounced search
      (`useDebouncedValue`), `useSendStaffSearch()` beacon on each **executed** search (fire-and-forget,
      `meta.silentErrorToast`, no invalidation); row copies barcode / `<Link>`s to POS. (#wiring)
- [ ] **ADM-01 Admin-Dashboard:** rewire `AdminDashboard.tsx` off the stub `useDashboardData` onto
      `useAdminDashboard()`; **replace the full-page `if (isLoading) return`** with per-section skeletons;
      add the 4 new widgets; **per-section retry chips** on error; row actions navigate to `/admin/orders`,
      `/admin/clients`, `/admin/products` (existing pages); retire `use-dashboard-data.ts` once orphaned.
      (#wiring)

**Validation**
- [ ] No `useEffect` fetching; the STF-03 search beacon is the only non-fetch effect (a mutation).
- [ ] **`tsc --noEmit` clean**; dashboards never blank the layout (per-section skeleton/retry); STF-01
      silent-hides on error.
- [ ] **`useTranslation`:** all copy via `t(...)` (incl. status labels + `%` change).
- [ ] `vitest run` green.

**Risks**
- "Widgets load independently" is **one** query (plan D10) — decompose the single result; do not fan out
  into N queries.
- STF-03 beacon must fire only on an executed/debounced search (not per keystroke) and never toast on
  failure.

---

### Sprint 7: Polish — responsive, memo/callback, beacons, i18n sweep (Polish) — Status: ⬜ Pending

**Goals**
- Mobile-first public (PUB-04/05/09/10) + desktop-first staff/admin (STF/ADM) responsiveness; targeted
  memoization per the plan; a clean i18n / no-inline pass.

**Tasks**
- [ ] Responsive: cart rows stack on mobile; my-orders cards + filter chips wrap; invoices table
      horizontal-scroll on mobile; staff/admin dashboards grid-collapse; `StaffLayout` sidebar →
      drawer/sheet on mobile (desktop-first, best-effort). (#ui)
- [ ] `useMemo` **only where the plan calls for it:** PUB-09 parsed status filter + derived status counts;
      STF-03 parsed filter object + derived model options; ADM-01 `repairsByStatus` record → ordered rows.
      `useCallback` for child-passed handlers. (#ui)
- [ ] STF-03 beacon timing (debounced, fire on executed search); confirm `meta.silentErrorToast` suppresses
      failure toasts on both beacons. (#ui)
- [ ] i18n sweep across all seven pages — no inline strings, keys resolve EN/FR, `ar:""` uniform. (#i18n)

**Validation**
- [ ] **`tsc --noEmit` clean**; no over-memoization (clarity over premature optimization, rules §5).
- [ ] **`useTranslation`:** i18n sweep confirms every string is a key; no inline strings remain.
- [ ] `PublicLayout` / `StaffLayout` / `AdminLayout` intact across loading/error on every page.
- [ ] `vitest run` green.

**Risks**
- Admin/staff are desktop-first; mobile is best-effort (horizontal table scroll OK) — don't over-invest in
  STF-03/ADM-01 mobile.

---

### Sprint 8: Unit tests — pages, forms, guards (Tests) — Status: ⬜ Pending

**Goals**
- `/tests/unit/pages/**` covers each page's reaction to `isLoading`/`isError`/`isSuccess`/empty, with
  **hooks mocked** (no MSW) and `useTranslation` mocked.

**Tasks**
- [ ] `pages/cart/cart.test.tsx` — mock `useClientCart`/`useRemoveFromCart`/`usePlaceOrder`/`useWilayas`/
      `usePlatformDeliveryFee`: skeleton / empty / error; priced row opens the modal; `priceHidden` row
      **disables Order**; remove calls the hook with `productId`; submit → `/order-confirmation` (assert via
      a `LocationProbe`, not a mocked `useNavigate`). (#testing)
- [ ] `pages/order-confirmation/order-confirmation.test.tsx` — render with/without `state.order` (a
      `OrderResponseSchema.parse(...)` fixture): fields render; client-only link present only for a CLIENT
      session; **no-state → redirect to `/`** (LocationProbe). (#testing)
- [ ] `pages/my-orders/my-orders.test.tsx` — mock `useMyOrders`/`useCancelMyOrder` + real `useSearchParams`:
      skeleton cards; filter → `?status=`; **counts from the unfiltered mock**; Cancel shown only when
      `canBeCancelled`; confirm calls `useCancelMyOrder(id)`; per-filter empty. (#testing)
- [ ] `pages/my-invoices/my-invoices.test.tsx` — mock `useMyInvoices`/`useMyInvoice`/`useMyInvoicePdf`:
      `TableSkeleton`; rows (number/date/source/total/paid/status); empty; row → `InvoiceView` from
      `lines[]`; foreign number → local 404; PDF button calls the hook. (#testing)
- [ ] `pages/staff-dashboard/staff-dashboard.test.tsx` — mock `useStaffDashboard`/`usePermissions`:
      per-section skeletons (no full-page blank); widgets render; **pending-orders widget hidden without
      `STAFF_ORDERS`**, shown with it; error → widgets hidden, layout intact. (#testing)
- [ ] `pages/staff-products/staff-products.test.tsx` — mock `useStaffProducts` + taxonomy +
      `useSendStaffSearch` + real `useSearchParams`: `TableSkeleton`; columns incl. one per `categoryPrices`
      entry and **no image cell**; filter → URL; **brand change clears `modelId`**; executed search fires
      the beacon with `{ query }`; empty + reset. (#testing)
- [ ] `pages/admin-dashboard/admin-dashboard.test.tsx` — mock `useAdminDashboard`: per-section skeletons (no
      full-page blank); all widgets + `%` change; error → **per-section retry chips** (layout intact);
      pending-order row → `/admin/orders` (LocationProbe). (#testing)

**Validation**
- [ ] `vitest run` green (new specs added); assertions on DOM/behavior (roles/labels/text/`href`/`data-*`),
      not internal state.
- [ ] **`useTranslation` mocked** (`t: (k) => k`); no real translated strings asserted; **no tests in
      `/src`**; files named `*.test.tsx`.
- [ ] **`tsc --noEmit` clean**; typed fixtures from `/tests/fixtures/data` (envelope-validated via
      `Schema.parse`); no `as any` (use the codebase's `as never` mock-return precedent).

**Risks**
- New fixtures (`OrderDto`, `CartItemDto`, `InvoiceDto`, `StaffDashboardDto`, `AdminDashboardDto`,
  `StaffProductDto`) must be `ResponseSchema.parse(...)` so DTO drift fails the fixture, not a silent green.
- Navigation assertions use a `LocationProbe` on the target route (set-01 precedent), not a mocked
  `useNavigate`.

---

## Sequencing notes & dependencies
- **Hard order:** Sprint 2 (client-invoice hooks + `StaffLayout` + routes/guards) gates Sprints 5–6;
  Sprint 3 (retype `OrderCard`/`ProductOrderModal`/admin sections) gates Sprints 5–6 — components must
  speak DTOs first; Sprint 4 (primitives/skeletons) gates Sprints 5–6 — **wiring never precedes
  primitives**.
- **Regression safety:** Sprints 2–7 keep the existing suite green (update the moved-`/orders` guard
  assertions when touched); the comprehensive page/form/guard specs are authored in Sprint 8 (the phase
  file's dedicated Tests layer).
- **Out of scope (scope confinement):** the staff POS/orders/sales/invoices/repairs destination pages
  behind the sidebar, and the ADM-04/09/12 confirm/approval dialogs — this set plans only the
  `<Link>`/navigation to them.
- **Resolved deviations carried forward (not contract changes):** STF-03's image column (dropped, no
  `StaffProductDto` image field) and STF-01's `STAFF_DASHBOARD` gate (dropped, role-gate instead) were
  ruled by the user; the client `MY_CANCEL` "reason" is dropped (route takes no body). Each is a
  requirement-side concession, not a local patch.
