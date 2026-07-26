# Sub-03 · Page Assembly Plan — Set 02 (Commerce tail + Staff/Admin dashboards)

> **Scope:** PUB-04 Cart, PUB-05 Order Confirmation, PUB-09 My Orders, PUB-10 My Invoices,
> STF-01 Staff Dashboard, STF-03 Staff Products, ADM-01 Admin Dashboard.
> **Nature:** audit/plan only — **zero code**. This document maps each page's requirements onto the
> **real Sub-02 Integration Engine hooks** (contract-typed, `qk` query keys), lists Skeletons + local
> error fallbacks, forms/Zod schemas, and the unit-test strategy.

> **Source of truth (ruling, carried from set-01):** only `Apps/contract`, `Apps/api` (the backend), and
> the `Docs/Stage-00-Conception/Pages-Requirements/*.md` files are authoritative. `Apps/web` is a mix of
> MVP + template scaffolding and is **not** a source of truth — where existing web code (routes,
> view models, stub hooks) conflicts with the requirements/contract, **the requirement wins and the web
> code changes.**

> **Template note:** the phase file cites `Apps/web/src/pages/admin/delivery-companies/` as the worked
> example. **That directory no longer exists.** Use `Apps/web/src/pages/admin/clients/AdminClients.tsx`
> (real hooks, granular states, RHF+Zod dialogs, `vi.mock()` unit tests) as the live worked example, and
> the just-completed set-01 pages (`Products.tsx`, `ProductDetails.tsx`, `MyAccount.tsx`) as the closest
> precedents.

> **Two conflicts were raised and resolved by the user before writing (see §2 D1, D2):**
> 1. `/staff` resolves to the **StaffDashboard**, gated by **role only** (STAFF|ADMIN) — the requirement's
>    `RoleGuard(STAFF_DASHBOARD)` is undeliverable (no such `PageKey` in the contract) and is dropped;
>    set-01's `StaffLanding` redirect is retired.
> 2. STF-03 **drops the image column** — `StaffProductDto` carries no image field and no contract change
>    is being made for it.

> **Test-file naming (verified):** `vitest.config.ts` collects `tests/**/*.test.{ts,tsx}` only. The phase
> file says "`.spec.tsx`"; the codebase (and set-01) uses **`.test.tsx`** — follow the code. Rules win on
> HOW; noted.

---

## 0. Core theme of this set: **half rewire, half net-new**

Unlike set-01 (pure "rewire" — every page already existed as Sub-01 scaffolding), set-02 is a **mix**:

| Page | Existing scaffold? | Move |
|---|---|---|
| PUB-09 My Orders | **Yes** — `pages/Orders.tsx` (stub `OrdersListSection`, numeric `orderId`) | **Rewire** onto `useMyOrders`/`useCancelMyOrder` (OrderDto, uuid) + tighten guard to CLIENT |
| ADM-01 Admin Dashboard | **Yes** — `pages/admin/dashboard/AdminDashboard.tsx` (stub `useDashboardData`, full-page skeleton) | **Rewire** onto `useAdminDashboard` + decompose into per-widget states + add the 4 missing widgets |
| PUB-04 Cart | No | **Net-new** page (`/cart`), but **reuses** the shared `ProductOrderModal` + order form from PUB-03 |
| PUB-05 Order Confirmation | No | **Net-new** page (`/order-confirmation`), state-driven, no hooks |
| PUB-10 My Invoices | No | **Net-new** page (`/invoices`) — Tier-5 billing, first consumer of `useMyInvoices` |
| STF-01 Staff Dashboard | No | **Net-new** page (`/staff`) + **net-new `StaffLayout`** shell |
| STF-03 Staff Products | No | **Net-new** page (`/staff/products`) under `StaffLayout` |

The rewire moves are the same three mechanical steps as set-01 (swap stub hook → real camelCase hook; retype
draft view-models → contract DTOs; delete page-local `useEffect` fetch/derive). The net-new moves build the
page from the requirement against the real hook directly. **Do not delete stub hook/service files outright**
(memory `stage-03-sub-02-complete`) — flag orphaned stubs (`use-dashboard-data.ts`, `use-orders.ts`,
`orders-list-section.tsx`) for a later cleanup sprint once their last consumer is rewired.

---

## 1. Hook inventory (real Sub-02 hooks this set consumes)

| Requirement name (doc) | **Real hook** | File | Query key / mutation target |
|---|---|---|---|
| `useCart()` | `useClientCart()` | `useClientPortal.ts` | `qk.clients.cart()` → `GET /clients/me/cart` |
| `useRemoveFromCart()` | `useRemoveFromCart()` | `useClientPortal.ts` | `DELETE /clients/me/cart/:productId`, invalidates `qk.clients.cart()` (+ patches catalog `inCart`) |
| `usePlaceOrder()` | `usePlaceOrder()` | `useOrdersPortal.ts` | `POST /orders`, invalidates `qk.orders.all()` |
| (order-form deps, reused from PUB-03) | `useWilayas()`, `usePlatformDeliveryFee({wilayaId,communeId})` | `usePlatform.ts` | `qk.platform.wilayas()` (staleTime 30 min), `qk.platform.fee(query)` (`enabled: !!wilayaId`) |
| `useMyOrders(status,page)` | `useMyOrders(query)` — **`{ status? }` only, no page** | `useOrdersPortal.ts` | `qk.orders.mine(query)` → `GET /clients/me/orders` |
| `useCancelOrder()` | `useCancelMyOrder()` | `useOrdersPortal.ts` | `POST /orders/:id/cancel`, invalidates `qk.orders.all()` |
| `useMyInvoices(page)` | `useMyInvoices(query)` | `useBilling.ts` | `qk.billing.mine(query)` → `GET /clients/me/invoices` |
| `useMyInvoice(number)` | **MISSING — add `useMyInvoice(number)`** (service `getMyInvoice` exists) | `useBilling.ts` (new) | `qk.billing.mineDetail(number)` → `GET /clients/me/invoices/:number` |
| invoice PDF | **MISSING — add `useMyInvoicePdf()`** (service `getMyInvoicePdf` exists) | `useBilling.ts` (new) | `GET /clients/me/invoices/:number/pdf` (**Blob**) |
| `useStaffDashboard()` | `useStaffDashboard()` | `useStatistics.ts` | `qk.stats.staffDashboard()` → `GET /staff/dashboard` |
| `usePermissions()` (widget/sidebar gating) | `usePermissions()` | `usePermissions.ts` | `qk.auth.permissions()` → `GET /identity/me/permissions` |
| `useStaffProducts(filters)` | `useStaffProducts(query)` | `useCatalogProducts.ts` | `qk.catalog.staffProducts.list(query)` → `GET /staff/products` |
| staff-search beacon | `useSendStaffSearch()` | `useObservability.ts` | `POST /activity/staff-search` (fire-and-forget, `meta.silentErrorToast`) |
| cascade filters | `useCatalogFamilies()`, `useCatalogBrands()`, `useCatalogModels({brandId})` | `useCatalogTaxonomy.ts` | `qk.catalog.{families,brands,models}.list(...)` |
| `useAdminDashboard()` | `useAdminDashboard()` | `useStatistics.ts` | `qk.stats.adminDashboard()` → `GET /admin/dashboard` |
| session / role | `useSession()` / `useAuth()` | `useSession.ts` / `AuthProvider.tsx` | `qk.auth.session()` (JWT-derived) |

**Result: every data dependency maps to an existing hook except the two client-invoice hooks
(`useMyInvoice`, `useMyInvoicePdf`), whose services already exist — a small Sub-02 top-up, not new plumbing
(§4).** No page uses `useEffect` for fetching.

---

## 2. Deviations & gaps to resolve first

Ordered by impact. **[RESOLVED — user]** = decided in the pre-write Q&A; **[GAP]** = needs a small
engine/infra change before the page can wire; the rest are resolved toward the authoritative
requirements/contract/rules and merely noted.

- **D1 — `/staff` = StaffDashboard, role-gated. [RESOLVED — user].** STF-01's `RoleGuard(STAFF_DASHBOARD)`
  cannot be honored — the contract `PageKey` enum has **no `STAFF_DASHBOARD`** (only STAFF_POS,
  STAFF_POS_CLIENTS, STAFF_PRODUCTS, STAFF_ORDERS, STAFF_SALES, STAFF_INVOICES, STAFF_REPAIRS). Resolution:
  `/staff` becomes **StaffDashboard**, gated `RoleGuard allow={[STAFF, ADMIN]}` (role only). Set-01's
  `StaffLanding` (redirect to first-permitted page) + `firstPermittedStaffRoute()` are **retired** as the
  `/staff` element — the dashboard is the staff home (mirrors `/admin` = ADM-01). `lib/staff-pages.ts`
  becomes the sidebar/route source (§ D11) rather than a redirect table.

- **D2 — STF-03 drops the image column. [RESOLVED — user].** `StaffProductDto` carries no `images`/
  `imageUrl`. The table renders only DTO-backed columns (name, barcode, family/brand/model, availableQty,
  the 4 prices). No contract change; no placeholder column.

- **D3 — `useMyInvoice`/`useMyInvoicePdf` hooks are missing. [GAP].** `billing.service.ts` already has
  `getMyInvoice(number): Promise<InvoiceDto>` and `getMyInvoicePdf(number): Promise<Blob>` (client-scoped,
  no `scope` param — distinct from the staff/admin `useInvoice(scope, …)`, since `BillingScope = "staff" |
  "admin"` has **no client member**). `useBilling.ts` never wrapped them. Add two hooks + a
  `qk.billing.mineDetail(number)` key before PUB-10's detail view can wire. Small, well-scoped Sub-02 top-up.

- **D4 — `StaffLayout` does not exist. [GAP].** Only `AdminLayout`/`PublicLayout` exist. STF-01/STF-03 need
  a **staff shell** = `StaffLayout` (header + sidebar of *permitted* pages), built by mirroring
  `AdminLayout` (`AdminHeader` + `AdminSidebar` + `<main><Outlet/>`). Sidebar renders a **new
  `STAFF_NAV_LINKS`** (each entry tagged with its `PageKey`) filtered by `usePermissions()`. Desktop-first,
  no commerce UI (rules §6C). See §D11.

- **D5 — PUB-09 has no pagination.** The requirement's `useMyOrders(status, page)` /
  `['orders','me',status,page]` overreaches: the contract `MyOrdersQuery` is `{ status? }` **only**, and
  `listMyOrders` returns a plain `OrderDto[]` (not a `PaginatedResult`). The contract governs WHICH →
  status filter only, no page. Noted; the requirement's `page` is dropped.

- **D6 — PUB-09 status-count chips derive client-side.** There is **no client "my-order stats" endpoint**
  (`OrderStatsDto` is backoffice/admin-scoped). The summary chips (counts by status) are derived with
  `useMemo` from an **unfiltered** `useMyOrders({})` query; the **filtered** `useMyOrders({ status })`
  drives the card list and refetches on filter change (its query key changes). When status = "all" the two
  calls share the `{}` key and dedupe.

- **D7 — PUB-09 cancel gate = `OrderDto.canBeCancelled`.** The requirement says "Cancel on PENDING cards
  only"; the DTO exposes the server's own `canBeCancelled: boolean`. Use that (authoritative — it already
  encodes the PENDING rule + any reservation state) rather than re-deriving `status === PENDING`.

- **D8 — PUB-04 modal prop widened `ProductDetailDto` → `ProductWithPricingDto`.** `CartItemDto.product` is
  a `ProductWithPricingDto`, but `ProductOrderModal`'s `product` prop is typed `ProductDetailDto`. The modal
  reads only base fields (`id`, `name`, `currentPrice`, `guestPrice`) — never `relatedIds`. **Widen the prop
  to `ProductWithPricingDto`** (the looser type it truly needs); PUB-03 still passes a `ProductDetailDto`
  (assignable), so nothing breaks. Rejected alternative: a per-order-open `useCatalogProduct(id)` fetch
  (needless round-trip).

- **D9 — PUB-05 route is `/order-confirmation`, and PUB-03's success target must be corrected.** PUB-05 is
  `/order-confirmation` (state-driven). set-01 wired PUB-03's `ProductDetails.tsx` to `navigate("/orders")`
  on order success (a stopgap — PUB-05 didn't exist yet). Now that PUB-05 exists, **PUB-03 and PUB-04 both
  navigate `("/order-confirmation", { state: { order } })`** on success, passing the returned `OrderDto`.
  `/orders` is PUB-09 (My Orders), a different page. This corrects a set-01 loose end.

- **D10 — Dashboards are one aggregate endpoint, not per-widget fetches.** STF-01/ADM-01 both say "widgets
  load independently", but each is a **single** query (`GET /staff/dashboard`, `GET /admin/dashboard`)
  returning everything. Reconciliation (contract governs WHICH; rules govern layout preservation): one
  query, but render **each section's own skeleton shape** during `isLoading` and **never a full-page
  blank**. On error: ADM-01 shows a **retry chip per section** (all calling the same `refetch`); STF-01
  **silently hides** failed widgets (its requirement: "silent-hide on error"). This directly replaces
  AdminDashboard's current full-page `if (isLoading) return <skeleton>` anti-pattern.

- **D11 — Staff routing surface + `lib/staff-pages.ts` repurpose.** Add routes: `/staff` → StaffDashboard,
  `/staff/products` → StaffProducts (both inside `StaffLayout`, under `RoleGuard allow={[STAFF, ADMIN]}`;
  `/staff/products` additionally `RoleGuard`ed on `PageKey.STAFF_PRODUCTS`). Populate
  `STAFF_PAGE_ROUTES`/`STAFF_NAV_LINKS` with the shipped entries (STAFF_PRODUCTS → `/staff/products`; the
  dashboard link → `/staff`). Out-of-set staff pages (POS, orders, sales, invoices, repairs) remain
  route-less — their sidebar entries + dashboard links are **scope-confined `<Link>`s to future routes**
  only (planned, not built).

- **D12 — Client-scoped guards for /cart, /orders, /invoices.** PUB-04/09/10 are all "Clients only". `/cart`,
  `/invoices` are new → mount under the existing `RoleGuard allow={[CLIENT]}` block (the one set-01 added
  for `/my-account`). `/orders` currently sits under the **any-authenticated** `ProtectedRoute` — **move it**
  into the CLIENT-scoped block (staff/admin must not reach the client order surface).

- **D13 — PUB-04/PUB-05/STF-03 beacons & idempotency inherit PUB-03 precedents.** PUB-04's order reuses the
  same `usePlaceOrder` + `Idempotency-Key` header already added to `orders.service.ts::placeOrder` in
  set-01 (D6 there) — nothing new. STF-03's search beacon is the staff analogue of PUB-02's client beacon
  (fire-and-forget mutation, `meta.silentErrorToast`, no invalidation) — the intended pattern, not a
  fetching `useEffect`.

---

## PUB-04 — Cart / Favorites (`/cart`)  ← net-new, CLIENT-only (D12)

### 1. Hook & Data Mapping
- `useClientCart()` → `CartItemDto[]` (`qk.clients.cart()`; server **re-resolves prices each load**, so no
  client-side price math beyond display). Each item: `{ productId, addedAt, product: ProductWithPricingDto }`.
- `useRemoveFromCart()` → heart-off / remove; invalidates `qk.clients.cart()` (+ patches catalog `inCart`).
- **Order flow reuses PUB-03 wholesale:** `useWilayas()`, `usePlatformDeliveryFee({wilayaId,communeId})`,
  `usePlaceOrder()`, and the shared `ProductOrderModal` + `order.schema.ts`. The clicked row's
  `item.product` (a `ProductWithPricingDto`, D8) is handed to the modal as `product`.
- **Scope confinement:** the `EmptyState` links to `/products` (catalog) — `<Link>` only.

### 2. UI Components
- **Reuse:** `ProductOrderModal` (widen prop per D8), `EmptyState`, `ProductCard` **price/availability**
  primitives or a slim page-local row (see New), `Skeleton`, `NotFoundState`, `Button`.
- **New:** `src/pages/cart/components/` — `CartItemRow` (image, name, live resolved price,
  availability chip, remove-heart, per-row **Order** button) and the page shell `Cart.tsx`. One
  `ProductOrderModal` instance driven by the selected item + parent-owned `useWilayas`/`usePlatformDeliveryFee`.

### 3. Granular States
- `isLoading` → a **skeleton list** of `CartItemRow` shapes (image box + 2 text lines + button), inside
  `PublicLayout`.
- `isError` → local error card with **retry** (`refetch`) in the content area.
- **Empty** (`data.length === 0`) → `EmptyState` ("your favorites are empty") + catalog link.
- **Not priced for this viewer** (`product.priceHidden` / no resolved price) → row shows **"Price on
  request"** and the **Order button is disabled** (per requirement).

### 4. Forms & Mutations
- **Order form:** the shared `order.schema.ts` inside `ProductOrderModal` — no new schema. Submit →
  `usePlaceOrder().mutateAsync(command)` **with `Idempotency-Key`** → on success
  `navigate("/order-confirmation", { state: { order } })` (D9). 409 `INSUFFICIENT_STOCK` / 403
  `GUEST_PRICE_HIDDEN` handled by the modal exactly as PUB-03.
- **Remove mutation:** `useRemoveFromCart(productId)` on heart click (optimistic-free; invalidation
  refreshes the list).

### 5. Optimization
- `React.lazy(Cart)` route split. Modal mounted only when open. No memoization needed (server returns final
  resolved prices).

### 6. Unit-Test Strategy — `/tests/unit/pages/cart/cart.test.tsx`
- `vi.mock()` `useClientCart`, `useRemoveFromCart`, `usePlaceOrder`, `useWilayas`,
  `usePlatformDeliveryFee`; mock `useTranslation`. Assert: loading → skeleton list; error → local retry;
  empty → `EmptyState` + catalog link; a priced row enables **Order** and opens the modal; a `priceHidden`
  row shows "Price on request" with **Order disabled**; remove calls `useRemoveFromCart` with the
  `productId`; successful submit navigates to `/order-confirmation` with `state.order` (render a
  `LocationProbe` on that route — set-01 precedent — rather than mocking `useNavigate`).

### 7. Acceptance Criteria
Favorites list renders live server-resolved prices; remove deletes the favorite and the list refreshes;
per-row Order opens the shared PUB-03 modal and places a single-product order that routes to PUB-05;
unpriced rows disable Order; loading/empty/error are local; page is CLIENT-guarded.

---

## PUB-05 — Order Confirmation (`/order-confirmation`)  ← net-new, state-driven

### 1. Hook & Data Mapping
- **None.** Renders the `OrderDto` passed via `useLocation().state.order` (the `usePlaceOrder` result handed
  over by PUB-03/PUB-04, D9). No fetch, no query.

### 2. UI Components
- **Reuse:** `StatusBadge`/success iconography, `Button`, `Separator`, `PublicLayout`.
- **New:** `src/pages/order-confirmation/OrderConfirmation.tsx` — success icon, order **reference**, product
  line (`productName × quantity`), **fee** (`deliveryFee`), **total** (`totalAmount`), **mode**
  (`orderType`), and the pending-confirmation message ("the store will call the contact number").

### 3. Granular States
- No loading/error (nothing is fetched). **Direct-navigation guard:** if `location.state?.order` is absent,
  `<Navigate to="/" replace />` (requirement) — the only branch.

### 4. Forms & Mutations
- None. CTAs: **back to catalog** (`<Link to="/products">`); clients also get **My Orders**
  (`<Link to="/orders">`) — render the client link only when `useSession().type === CLIENT`.

### 5. Optimization
- `React.lazy` route split. Trivial otherwise.

### 6. Unit-Test Strategy — `/tests/unit/pages/order-confirmation/order-confirmation.test.tsx`
- Render inside a `MemoryRouter` with `initialEntries` carrying `state.order` (a schema-validated
  `OrderResponseSchema.parse(...)` fixture). Assert: reference/total/fee/mode all render; the client My-Orders
  link appears only for a CLIENT session mock; **navigating with no `state` redirects to `/`** (assert via a
  `LocationProbe` on `/`).

### 7. Acceptance Criteria
Renders the placed order's reference/line/fee/total/mode + pending message from router state; direct hits
without state redirect to `/`; clients see a My-Orders link, guests do not; no data fetch.

---

## PUB-09 — My Orders (`/orders`)  ← rewire, tighten to CLIENT (D12)

### 1. Hook & Data Mapping
- `useMyOrders({ status })` → `OrderDto[]` (`qk.orders.mine(query)`) — **the card list; refetches on filter**
  (D5, no page).
- `useMyOrders({})` → **unfiltered** list, memoized into status **counts** for the summary chips (D6).
- `useCancelMyOrder()` → `POST /orders/:id/cancel`, invalidates `qk.orders.all()`.

### 2. UI Components
- **Reuse:** `OrderCard` (shared — **retype to `OrderDto`**, uuid ids), `CancelOrderDialog` (shared),
  `StatusBadge`, `EmptyState`, `Skeleton`, filter chips/`Tabs`.
- **New:** none structurally — **rewire** `pages/Orders.tsx`: drop `OrdersListSection` (stub) and the
  numeric-`orderId` handlers; the status filter is **URL-bound** (`?status=`), parsed/validated against
  `OrderStatus` before the query fires. Expandable detail (mode, wilaya/commune, delivery company + tracking
  when `IN_DELIVERY`, status timeline, linked-invoice link) reads straight off `OrderDto`.

### 3. Granular States
- `isLoading` → **skeleton `OrderCard`s** (the requirement's "skeleton cards"); summary chips show small
  count skeletons.
- `isError` → local error + **retry** inside the list area (`PublicLayout` intact).
- **Empty per filter** → `EmptyState` scoped to the active filter ("no {status} orders").
- Linked-invoice link inside a card → `<Link to="/invoices">` (or `/invoices?number=` — scope-confined).

### 4. Forms & Mutations
- **Cancel dialog** (`CancelOrderDialog`) — **optional** reason textarea (no Zod gate needed; reason may be
  empty). Shown only when `order.canBeCancelled` (D7). Confirm → `useCancelMyOrder().mutateAsync(order.id)`
  → success toast + list invalidation (releases the reservation server-side).

### 5. Optimization
- `React.lazy(Orders)` route split. `useMemo` for (a) the parsed status filter (stable query key) and (b) the
  derived status counts from the unfiltered list.

### 6. Unit-Test Strategy — `/tests/unit/pages/my-orders/my-orders.test.tsx`
- `vi.mock()` `useMyOrders`, `useCancelMyOrder`; mock `useTranslation`; mock `react-router-dom`
  `useSearchParams`. Assert: loading → skeleton cards; changing the filter writes `?status=` and the list
  reflects the (mocked) filtered data; summary chips show per-status counts from the unfiltered mock; a
  `canBeCancelled` card shows **Cancel** (and a non-cancellable one does not); Cancel → dialog → confirm
  calls `useCancelMyOrder` with `order.id`; empty filter → scoped `EmptyState`.

### 7. Acceptance Criteria
Client's orders render as cards with expandable detail; status filter is URL-driven and refetches; count
chips are correct across all statuses; Cancel appears only on `canBeCancelled` orders and releases the
reservation; loading/empty/error local; page is CLIENT-guarded.

---

## PUB-10 — My Invoices (`/invoices`)  ← net-new, CLIENT-only (D12); depends on D3

### 1. Hook & Data Mapping
- `useMyInvoices({ page })` → `PaginatedResult<InvoiceDto>` (`qk.billing.mine(query)`) — the table.
- **`useMyInvoice(number)`** (NEW, D3) → `InvoiceDto` (`qk.billing.mineDetail(number)`; `enabled: !!number`)
  — the read-only invoice view. **404** on a foreign/unknown number → local not-found view.
- **`useMyInvoicePdf()`** (NEW, D3) → imperative mutation returning a **Blob** (`responseType: 'blob'`,
  bypasses the envelope — memory `stage-03-sub-02-complete`); triggers a browser download.

### 2. UI Components
- **Reuse:** `DataTable` (shared), `StatusBadge`, `SimplePagination`, `Dialog`/route view, `Skeleton`,
  `NotFoundState`, `Button`.
- **New:** `src/pages/my-invoices/components/` — `MyInvoices.tsx` (the `DataTable`: **number, date
  (`issuedAt`), source (`sourceType` = SALE|ORDER — repairs never appear, enum has no third member), total,
  paid, status badge**) and `InvoiceView` (read-only, rendered from `InvoiceDto.lines[]` snapshot +
  header snapshot fields; **PDF download button**). Row → opens `InvoiceView` (dialog or `/invoices/:number`).

### 3. Granular States
- List `isLoading` → **`TableSkeleton`** (shared); pagination hidden while loading.
- List `isError` → local error + retry.
- **Empty** → `EmptyState` ("no invoices yet").
- Detail `isLoading` → skeleton invoice body; detail **404** (foreign number) → local `NotFoundState`
  inside the view (never a global redirect).
- PDF: `useMyInvoicePdf().isPending` → button spinner; failure surfaces via the global mutation toast.

### 4. Forms & Mutations
- No RHF form. Mutation: `useMyInvoicePdf().mutate(number)` → `URL.createObjectURL(blob)` → anchor download
  (imperative, mirrors `useExportReportCsv`/`useInvoicePdf`).

### 5. Optimization
- `React.lazy` route split. Pagination is server-side via `InvoiceListQuery.page`; the URL owns `?page=`.

### 6. Unit-Test Strategy — `/tests/unit/pages/my-invoices/my-invoices.test.tsx`
- `vi.mock()` `useMyInvoices`, `useMyInvoice`, `useMyInvoicePdf`; mock `useTranslation`. Assert: loading →
  `TableSkeleton`; rows show number/date/source/total/paid/status; empty → `EmptyState`; row click opens the
  invoice view rendered from `lines[]`; a foreign number (mock `isError`/404) → local not-found; PDF button
  calls `useMyInvoicePdf` with the number.

### 7. Acceptance Criteria
Client invoices list in a `DataTable` (SALE/ORDER only); row opens a read-only snapshot view with a working
PDF download; foreign numbers 404 locally; loading/empty/error local; page is CLIENT-guarded. **Blocked on
D3** (add the two hooks first).

---

## STF-01 — Staff Dashboard (`/staff`)  ← net-new page + net-new `StaffLayout` (D1, D4, D10)

### 1. Hook & Data Mapping
- `useStaffDashboard()` → `StaffDashboardDto` (`qk.stats.staffDashboard()`): `mySalesToday`,
  `myRevenueToday`, `myDrafts[]` (`reference, clientName?, total, ageHours`), `myPendingOrdersCount?`
  (server-gated optional), `lowStock[]`.
- `usePermissions()` → effective `PageKey` set, for **widget gating** (D10): the pending-orders widget shows
  only when `STAFF_ORDERS` is granted **and** `myPendingOrdersCount` is present; drafts "finish in POS" links
  gate on `STAFF_POS`.
- **Scope confinement:** draft rows `<Link>` into POS (future `/staff/pos` route); pending-orders widget
  `<Link>` to `/staff/orders` (future). Planned links only, destinations out of set (D11).

### 2. UI Components
- **Reuse:** `StatCard` + `StatCardSkeleton` (shared), `DataTable`/list primitives, `Skeleton`, `Badge`.
- **New:**
  - `StaffLayout` + `StaffHeader` + `StaffSidebarNav` (`components/layout/`) — mirror `AdminLayout`; sidebar
    from `STAFF_NAV_LINKS` filtered by `usePermissions()` (D4/D11).
  - `src/pages/staff/dashboard/` — `StaffDashboard.tsx` + section components: `MySalesTodayCard`
    (count + revenue `StatCard`s), `MyDraftsList`, `PendingOrdersWidget`, `LowStockList`.

### 3. Granular States (D10 — one query, per-section shapes)
- `isLoading` → each section renders its **own** skeleton (2 `StatCardSkeleton`s, a drafts-list skeleton, a
  low-stock skeleton) inside `StaffLayout` — never a full-page blank.
- `isError` → **silently hide** the widgets (requirement: "silent-hide on error"); layout + sidebar persist.
- **Empty** per widget → localized ("no open drafts", "no low-stock alerts").
- Permission-absent widgets → simply not rendered (gated on the `PageKey` set), not shown empty.

### 4. Forms & Mutations
- None (read-only dashboard).

### 5. Optimization
- `React.lazy(StaffDashboard)` route split. No memoization needed. `StaffLayout` never remounts across
  `/staff/*` navigations (same as `AdminLayout`).

### 6. Unit-Test Strategy — `/tests/unit/pages/staff-dashboard/staff-dashboard.test.tsx`
- `vi.mock()` `useStaffDashboard`, `usePermissions`; mock `useTranslation`. Assert: loading → per-section
  skeletons (no full-page blank); success → sales/revenue cards + drafts rows + low-stock list; **pending
  orders widget hidden when `STAFF_ORDERS` absent** and shown when granted (+ count present); error → widgets
  hidden, layout intact; draft row link targets the POS route.

### 7. Acceptance Criteria
Staff see their sales-today/revenue/drafts/low-stock; the pending-orders widget honors `STAFF_ORDERS`;
widgets skeleton independently off one endpoint and silent-hide on failure; `/staff` is role-gated
(STAFF|ADMIN) inside `StaffLayout`; admins are sent to ADM-01 instead (login redirect, set-01 D4).

---

## STF-03 — Staff Products (`/staff/products`)  ← net-new, no image column (D2)

### 1. Hook & Data Mapping
- `useStaffProducts(query)` → `PaginatedResult<StaffProductDto>` (`qk.catalog.staffProducts.list(query)`).
  `query: ProductListQuery` parsed/validated from the URL (`?search&familyId&brandId&modelId&page`).
- Cascade filter sources: `useCatalogFamilies()`, `useCatalogBrands()`, `useCatalogModels({ brandId })`
  (models `enabled` only with a brand; brand change resets `modelId`).
- `useSendStaffSearch()` → **beacon on every executed search** (`{ query, matchedProductId? }`,
  fire-and-forget, `meta.silentErrorToast`, **no invalidation**) — the "looked it up, never rang it up"
  audit.
- **Scope confinement:** row click **copies the barcode** (`CopyButton`) / jumps to POS with the product
  (future `/staff/pos` route, gated on `STAFF_POS`) — `<Link>`/copy only.

### 2. UI Components
- **Reuse:** `DataTable`, `admin-search-input`/`autocomplete-input` (debounced), `Select` (ui),
  `SimplePagination`, `CopyButton`, `TableSkeleton`, `EmptyState`.
- **New:** `src/pages/staff/products/` — `StaffProducts.tsx` + a `StaffProductFilters` bar (search 300 ms +
  cascading family/brand/model). Columns: **name, barcode, family/brand/model, availableQuantity, the 4
  prices** (`defaultSalePrice` + one column **per `categoryPrices[]` entry**, data-driven — yields the 3
  client-category columns). **No image, no cost, no margin, no actions** (D2).

### 3. Granular States
- `isLoading` → `TableSkeleton`; filter selects show loading/disabled while their taxonomy loads.
- `isError` → local error + **retry**.
- **Empty** → `EmptyState` with a clear-filters reset.

### 4. Forms & Mutations
- No RHF form — the filter bar is URL-bound controls (`ProductListQuerySchema.safeParse` guards a
  hand-edited URL before the query fires). Beacon mutation on search submit.

### 5. Optimization
- `React.lazy(StaffProducts)`. Debounce search with `useDebouncedValue` (existing). `useMemo` for the parsed
  filter object and derived model options.

### 6. Unit-Test Strategy — `/tests/unit/pages/staff-products/staff-products.test.tsx`
- `vi.mock()` `useStaffProducts`, `useCatalogFamilies`, `useCatalogBrands`, `useCatalogModels`,
  `useSendStaffSearch`; mock `useTranslation` + `useSearchParams`. Assert: loading → `TableSkeleton`; rows
  show the DTO columns incl. one column per `categoryPrices` entry and **no image cell**; changing a filter
  writes the query params and **brand change clears `modelId`**; an executed search fires
  `useSendStaffSearch` with `{ query }`; empty → `EmptyState` + reset; row copy/`<Link>` targets are correct.

### 7. Acceptance Criteria
Read-only staff catalog with debounced URL-driven cascading filters; the 4 sale prices and available qty
render (no image/cost/margin/actions); every executed search fires the beacon (never toasts on failure); row
click copies barcode / links to POS; loading/empty/error local; `/staff/products` gated on `STAFF_PRODUCTS`.

---

## ADM-01 — Admin Dashboard (`/admin`)  ← rewire, decompose to per-widget (D10)

### 1. Hook & Data Mapping
- `useAdminDashboard()` → `AdminDashboardDto` (`qk.stats.adminDashboard()`): `stats` (totalClients,
  totalProducts, ordersThisWeek, revenueThisMonth + each `*ChangePct`), `pendingOrders[]`, `pendingClients[]`,
  `recentOrders[]`, `recentClients[]`, `lowStockProducts[]`, `repairsByStatus` (record), `draftSalesByStaff[]`.
- **Scope confinement — row actions navigate to existing admin pages** (D14): pending-order → `/admin/orders`
  (ADM-09 confirm lives there), pending-client → `/admin/clients` (ADM-12 approval), low-stock →
  `/admin/products` (ADM-04). `<Link>`/navigate only — those dialogs are the destination pages' concern.

### 2. UI Components
- **Reuse:** `StatCard` + `StatCardSkeleton` (the % change vs previous period is a `StatCard` prop),
  `DataTable`/list primitives, `StatusBadge`, `Skeleton`, `Alert`.
- **New / rewire:** rewire `pages/admin/dashboard/AdminDashboard.tsx` off `useDashboardData` (stub) +
  `@/types/draft-types/routes`. Existing section components `dashboard-stats-section`,
  `recent-orders-section`, `recent-clients-section`, `low-stock-alert-section` → **retype to
  `AdminDashboardDto`**. **Add four new sections** (`components/`): `PendingOrdersWidget` (5, actionable),
  `PendingRegistrationsWidget` (5, actionable), `RepairsByStatusWidget`, `DraftSalesByStaffWidget`.

### 3. Granular States (D10 — one query, per-section shapes)
- `isLoading` → per-section skeletons (a `StatCard` row skeleton + list skeletons) — **replace the current
  full-page `if (isLoading) return`**.
- `isError` → **a retry chip per section** (requirement: "a failed widget shows a retry chip without
  blanking the page"), each calling the same `refetch`; `AdminLayout` intact.
- **Empty** per widget → localized ("no pending orders", etc.).

### 4. Forms & Mutations
- None (the confirm/approval dialogs belong to ADM-09/ADM-12 on their own pages — scope confinement).

### 5. Optimization
- `React.lazy(AdminDashboard)` already in `App.tsx`. `useMemo` only if a widget derivation is non-trivial
  (e.g. `repairsByStatus` record → ordered rows); otherwise render directly.

### 6. Unit-Test Strategy — `/tests/unit/pages/admin-dashboard/admin-dashboard.test.tsx`
- `vi.mock()` `useAdminDashboard`; mock `useTranslation`. Assert: loading → per-section skeletons (no
  full-page blank); success → 4 stat cards with % change, the two work-queue widgets, recent orders (8) /
  clients (5) / low stock (5), repairs-by-status, draft-sales-by-staff; error → per-section retry chips
  (layout intact); a pending-order row navigates to `/admin/orders` (assert via `LocationProbe`).

### 7. Acceptance Criteria
Admin dashboard renders all widgets from a single endpoint with per-widget skeletons and per-widget retry
chips (never a full-page blank); stat cards show % change; the two work queues + recent/low-stock/repairs/
draft-sales widgets render; row actions navigate to the correct existing admin pages; `/admin` stays
ADMIN/STAFF-guarded (RoleGuard) with admins landing here (STAFF land on STF-01).

---

## 3. Cross-cutting requirements (apply to every page)

- **Layout preservation (rules §4):** loading → shape-matched `Skeleton`; error/404 → **local**
  `NotFoundState`/inline retry inside the content area. Never a full-screen spinner, never a global redirect
  on a content error. Dashboards: per-section skeletons off the single aggregate query (D10).
- **Component→Hook→Service (rules §2):** pages call hooks only; **no `useEffect` for fetching**. The only
  sanctioned non-fetch effects: the STF-03 search beacon (fire-and-forget mutation) and URL⇄state sync.
- **i18n (rules §6B):** **no inline strings** — every label/message is a `t('scope.feature.element')` key in
  `src/config/translations.json` (flat dot-map, `{ en, fr, ar:"" }`; populate en/fr, leave ar `""`). New key
  namespaces per page: `cart.*`, `orderConfirmation.*`, `orders.*` (extend), `invoices.*`, `staff.dashboard.*`,
  `staff.products.*`, `admin.dashboard.*` (extend). Reuse `common.*`.
- **Layouts (rules §6C):** PUB-04/05/09/10 → `PublicLayout` (mobile-first, commerce chrome). STF-01/STF-03 →
  new `StaffLayout`; ADM-01 → `AdminLayout` (desktop-first, no commerce UI). Never mix commerce chrome into
  staff/admin.
- **Envelope/DTO (rules §3, test-rules §3):** services already unwrap `ApiResponse<T>`; fixtures return the
  **`{ success, data }` envelope** and are `Schema.parse(...)`-validated from `@dragon-telecom/contract`
  (`OrderResponseSchema`, `CartItemResponseSchema`, `InvoiceResponseSchema`, `StaffDashboardResponseSchema`,
  `AdminDashboardResponseSchema`, `StaffProductResponseSchema`). **Blob** PDFs bypass the envelope.
- **Tests (test-rules §1):** all specs under `/tests/unit/pages/[page]/`, **named `*.test.tsx`** (Vitest
  include pattern — not `.spec.tsx`), **never in `/src`**. `vi.mock()` the **hook** (not the network); mock
  `useTranslation` (`() => ({ t: (k) => k })`); use `userEvent`; for navigation assertions render a
  `LocationProbe` on the target route (set-01 precedent) instead of mocking `useNavigate`.

---

## 4. Prerequisites / "resolve first" checklist

**Missing hooks (only two — services already exist):**
1. **D3** — add `useMyInvoice(number)` + `useMyInvoicePdf()` to `useBilling.ts` (wrap the existing
   `billingService.getMyInvoice`/`getMyInvoicePdf`) + a `qk.billing.mineDetail(number)` key in
   `lib/query-keys.ts`. **PUB-10's detail view is blocked on this.**

**Missing infra / routing:**
2. **D4/D11** — build `StaffLayout` + `StaffHeader` + `StaffSidebarNav` (mirror `AdminLayout`); add
   `STAFF_NAV_LINKS` (PageKey-tagged) to `config/nav-links.ts`; populate `STAFF_PAGE_ROUTES` in
   `lib/staff-pages.ts` (STAFF_PRODUCTS → `/staff/products`, dashboard → `/staff`).
3. **D1/D11** — in `App.tsx`: replace the `/staff` element (StaffLanding) with **StaffDashboard**; add
   `/staff/products` (StaffProducts), both under `StaffLayout` + `RoleGuard allow={[STAFF, ADMIN]}`
   (`/staff/products` also gated on `PageKey.STAFF_PRODUCTS`); retire `StaffLanding` +
   `firstPermittedStaffRoute()`.
4. **D12** — add `/cart` and `/invoices` under the CLIENT-scoped `RoleGuard allow={[CLIENT]}` block; **move
   `/orders`** from the any-authenticated `ProtectedRoute` into that block; add `/order-confirmation`
   (public, state-guarded).
5. **D9** — correct PUB-03's order-success navigation (`ProductDetails.tsx` line ~98) from
   `navigate("/orders")` to `navigate("/order-confirmation", { state: { order } })`; PUB-04 does the same.

**No missing contract DTOs.** Two requirement/contract conflicts were resolved by the user, not patched
locally: STF-01's `STAFF_DASHBOARD` gate is dropped (role-gate instead, D1) and STF-03's image column is
dropped (D2). Everything else is a page-level rewire/build against an existing hook.

---

## 5. Suggested sprint sequencing (layer-first, mirrors set-01)

1. **Schemas/i18n/prereqs:** add the two billing hooks + `mineDetail` key (D3); add all new `t(...)` key
   namespaces. No new Zod schema (PUB-04 reuses `order.schema.ts`; PUB-09 cancel reason is optional).
2. **Routing/guards/shell:** build `StaffLayout`/sidebar (D4); wire all routes + guards (D1, D9, D11, D12).
3. **Shared DTO retype:** `OrderCard`/`CancelOrderDialog` → `OrderDto`; widen `ProductOrderModal` prop (D8);
   retype the 4 reused AdminDashboard sections → `AdminDashboardDto`.
4. **Page primitives/skeletons:** `CartItemRow`, `InvoiceView`, staff/admin dashboard widget sections,
   `StaffProductFilters` + their skeletons.
5. **Wiring — commerce cluster:** PUB-04, PUB-05, PUB-09, PUB-10 onto real hooks.
6. **Wiring — staff/admin cluster:** STF-01, STF-03, ADM-01 (per-widget states, D10).
7. **Polish:** responsive passes, memoization, beacon timing, i18n sweep.
8. **Unit tests:** the seven `*.test.tsx` files above.
