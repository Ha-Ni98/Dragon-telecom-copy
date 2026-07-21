# Stage 03 · Sub-03 · Set-04 — Page Assembly Plan

**The remaining admin back-office pages.** Everything left in the ADM range that is not a
staff/admin twin (set-03) or a public/storefront page (set-01/02): inventory, purchasing
(suppliers + supplier invoices), client management (POS clients, web clients + detail),
statistics, users & roles, settings, and the two audit surfaces.

The Integration Engine (Sub-02 services + hooks) already exists for **every** page below —
this set is pure assembly + a stub teardown. **No code here; plan only.**

| # | Page | Route | State | Backing hook file |
|---|------|-------|-------|-------------------|
| 1 | ADM-06 Inventory | `/admin/inventory` | **new** | `useInventory.ts` |
| 2 | ADM-07 Suppliers (list) | `/admin/suppliers` | **rewire** | `usePurchasingSuppliers.ts` |
| 2 | ADM-07 Supplier detail | `/admin/suppliers/:id` | **rewire** | `usePurchasingSuppliers.ts` (+`usePurchasingInvoices/Payments`) |
| 3 | ADM-08 Supplier invoices (list) | `/admin/supplier-invoices` | **new** | `usePurchasingInvoices.ts` |
| 3 | ADM-08 Supplier invoice editor | `/admin/supplier-invoices/:id` | **new** | `usePurchasingInvoices.ts` (+catalog create/pricing) |
| 4 | ADM-11 POS clients | `/admin/pos-clients` | **new** | `usePosClients.ts` |
| 5 | ADM-12 Web clients (list) | `/admin/clients` | **rewire** | `useClientDirectory.ts` |
| 5 | ADM-12b Client detail | `/admin/clients/:id` | **new** | `useClientDirectory.ts` + `useObservability.ts` |
| 6 | ADM-15 Reports & statistics | `/admin/statistics` | **rewire** | `useStatistics.ts` |
| 7 | ADM-16 Users & roles | `/admin/users` | **new** | `useIdentity.ts` |
| 8 | ADM-17 Settings | `/admin/settings` | **rewire** | `usePlatform.ts` + `useCatalogTaxonomy.ts` + `useClientCategories.ts` |
| 9 | ADM-18 Audit logs | `/admin/logs` | **rewire** | `useObservability.ts` |
| 10 | ADM-19 Staff search audit | `/admin/activity/staff-searches` | **new** | `useObservability.ts` |

### Current state to swap (not rebuild)

Five pages already exist wired to **Sub-01 stub hooks** (they import `@/types/draft-types/*`
and `admin-*.service.ts` — numeric-id view-models, not contract DTOs):
`AdminSuppliers.tsx` + `AdminSupplierInformation.tsx`, `AdminClients.tsx`,
`AdminStatistics.tsx` (+ its 4 chart components), `AdminSettings.tsx`, `AdminLogs.tsx`.

Per the Sub-03 rule we **swap the hooks, keep the UI shells**, then delete the orphaned stub
hooks/services/draft-types (§ Deletion Audit). Inventory, both supplier-invoice pages, POS
clients, the client-detail page, the users page, and the staff-search page are **brand new**.

---

## 0. Resolve-First — Contract gaps & missing hooks

Triage **before** coding. Contract gaps are Stage-01 upstream fixes — never patched locally
(front-end-rules §2). Unlike set-03, there are **no missing hooks**. After the deeper audit below,
**two of the three suspected gaps dissolve** (existing filtered lists already carry everything);
**only A2 needs a backend + contract change**, and it is tiny.

| # | Gap | Resolution | Backend/contract change |
|---|-----|-----------|-------------------------|
| A1 | ADM-11 **detail drawer** (sales history, payments ledger, credit history) — suspected to need a `getPosClient(id)` endpoint. | **RESOLVED — no new endpoint.** Both filtered lists already accept `posClientId` and expose credit snapshots: sales tab → `useSales('admin', { posClientId })` (`SaleListQuery.posClientId` + `SaleDto.previousCredit/newCredit`); payments tab → `useClientPayments({ posClientId })` (`ClientPaymentListQuery.posClientId` + `ClientPaymentDto.previousCredit/newCredit`). **Credit-history tab is derived client-side** (`useMemo`) by merging those two row sets on their `previous→new` credit + date — there is no credit-ledger table (credit is a running field with per-document snapshots, `schema.prisma:337/616-651`), so this *is* the credit history. Headline fields (code/name/credit/totalPaid/totalSold/category/linked-account) come from the `PosClientDto` **row the admin clicked** — pass it into the drawer, no re-fetch. The `clients.service.ts:222` "do not add getPosClient(id)" comment stays correct. | **None.** |
| A2 | ADM-12 StatCards want **total, active, pendingApprovals, newThisMonth**; `ClientStatsDto` = `{ totalClients, pending, approved, rejected }` (`clients.dtos.ts:78`). `total→totalClients`, `pendingApprovals→pending`, `active→approved` map cleanly; **`newThisMonth` has no field.** | **Add the field** (small, and cannot be derived from a paginated list). Copy relabels the 3rd card "active" → uses `approved`. | **Contract:** add `newThisMonth: z.number().int().min(0)` to `ClientStatsResponseSchema` (`clients/clients.dtos.ts`). **API:** in the admin-client stats handler (`clients.service.ts` `getAdminClientStats`), add `newThisMonth = count(clients WHERE createdAt >= startOfMonth(now))`. No route/verb change. |
| A3 | ADM-17 Storefront tab, **"delivery companies list"** — `SettingsDto.storefront` carries only `featuredProductIds` (`platform.dtos.ts:43`); delivery-companies were deliberately removed as a non-contract example earlier in Stage-03. | **Scope out.** Ship the **featured-products picker only** (fully backed by `featuredProductIds`). Delivery-companies deferred until it enters the contract; the tab shows a short "managed in a later release" note. | **None** (no contract surface added — matches the earlier removal decision). |

**Backend + contract work this set requires = exactly one change (A2).** Sequence it as the first
task of the ADM-12 sprint so the frontend never blocks: land `newThisMonth` in the contract, rebuild
`@dragon-telecom/contract`, extend the stats service + its unit test, then wire the StatCard.

Nothing else blocks. `SupplierDetailDto` already aggregates `{ invoices, payments, productHistory }`
(`purchasing.dtos.ts:89-104`); `OverviewDto` carries all five overview figures
(`statistics.dtos.ts:3-9`); the inline create-product + reprice flows for ADM-08 are served by
`useCreateProduct` / `useUpdatePricing` (`useCatalogProducts.ts`).

---

## Cross-cutting decisions (apply to every page)

- **Layout:** all ten pages → `AdminLayout` (no commerce UI). Desktop-first; horizontal table
  scroll acceptable on narrow viewports.
- **Access:** every route is `Access: Admin only`. Follow the **established set-02/03 precedent** —
  the `/admin/*` tree already sits under one `RoleGuard allow={[ADMIN, STAFF]}` in `App.tsx`, and
  "admin only" is enforced by the **staff page registry** (STAFF simply holds no role granting these
  pages, so they never appear in staff nav). We do **not** add per-route `[ADMIN]`-only guards
  here; that matches how the existing AdminClients/AdminStatistics/AdminSettings/AdminLogs routes
  already ship. *(Flag: if product wants a hard server-independent block, wrap the new routes in an
  `[ADMIN]`-only guard — one-line change, but out of scope unless requested.)*
- **Granular states (front-end-rules §4):** every `isLoading` → a shape-matched Shadcn `Skeleton`
  (reuse `TableSkeleton`, `StatCardSkeleton`); every `isError`/404 → a **local**
  `<NotFoundState />` / `<EmptyState />` **inside** the content area — the `AdminLayout` shell,
  tab bar, and filter bar always persist. No full-page spinner, no redirect to a global 404.
- **Forms:** RHF + `zodResolver`, schema **imported from `@dragon-telecom/contract`** (the
  `Create*/Update*Command` schemas) — never re-declared locally. Only genuinely UI-local refines
  (password-confirm match, amount-only XOR lines, counted-vs-system delta) live in a co-located
  `[name].schema.ts` that `.extend()`s or wraps the contract command. Server field errors
  (username-unique, sequence-decrease 409, confirm-after 409, last-admin guard, insufficient stock)
  land on the named field/zone via `setError` or a local banner.
- **i18n (front-end-rules §6B):** no inline strings; keys `admin.<feature>.<element>` in
  `src/config/translations.json` (`en`/`fr` real copy, `ar` `""`). Reuse existing `admin.*`,
  `common.*` keys; EN/FR toggle only.
- **Mutations invalidate exactly the query keys each requirement names** (via the shared `qk`
  factory in `src/lib/query-keys.ts`); never hand-mutate cache. TanStack v5 — global error toasts
  come from `query-client.ts`'s caches, not per-hook `onError`.
- **Reuse first (`components/shared/`):** `DataTable`, `PageHeader`, `StatCard`,
  `StatCardSkeleton`, `TableSkeleton`, `MoneyStatusCard`, `StatusBadge`, `SimplePagination`,
  `EmptyState`, `NotFoundState`, `AgeFlag`, `CreditMovementPreview`, `ResolvedVsChargedPrice`,
  `autocomplete-input`, `admin-search-input`, `excel-file-uploader`, `image-management`,
  `drag-drop-area`, `CopyButton` **all already exist** — build new only inside `src/pages/<page>/components/`.
- **Optimization (front-end-rules §5):** every route added to `App.tsx` as `React.lazy()` +
  `<Suspense fallback={<PageLoader />}>` (the existing `withSuspense()` helper). `useMemo` only for
  `DataTable` column defs and the ADM-08 live footer math (subtotal/shipping/landed/avg-cost —
  recomputes per keystroke); `useCallback` on row-action handlers passed into `DataTable`.
- **Tests (front-end-test-rules):** `/tests/unit/pages/<page>/*.spec.tsx`; `vi.mock()` the feature
  hook, mock `useTranslation` (`t: k => k`), assert state reactions (skeleton / empty / error) and
  form Zod errors via `userEvent`. **No MSW** in unit tests. Reuse the existing typed fixtures in
  `/tests/fixtures/data/` (`inventory.mock`, `purchasing.mock`, `clients.mock`, `identity.mock`,
  `observability.mock`, `platform.mock`, `statistics.mock`, `catalog.mock`) — never place tests in `/src`.

---

## Page 1 — ADM-06 Inventory (`/admin/inventory`, **new**)

Four-tab admin page: Stock levels · Movement ledger · Pending/reserved · Adjustments.

**1. Hook & Data Mapping** (`useInventory.ts`)
- `useStock(lowStockOnly?)` → `['inventory','stock',{lowStockOnly}]` — `StockRowDto[]`.
- `useExportStockCsv()` (mutation → `Blob`) — CSV export of the filtered stock table.
- `useMovements(query: MovementsQuery)` → `['inventory','movements','list',q]` — `PaginatedResult<MovementDto>`; filters product/type/date-range/staff.
- `useReservations(query: ReservationsQuery)` → `['inventory','reservations','list',q]` — `PaginatedResult<ReservationDto>`.
- `useCreateAdjustment()` → invalidates `stock` + `movements` + `reservations` + `qk.catalog.adminProducts` (the requirement's `['admin','products']`).

**2. UI Components** — *Shared:* `DataTable`×3, `PageHeader`, Shadcn `Tabs`, `StatusBadge` (IN/OUT/PENDING type chips), `AgeFlag` (reserved age), `EmptyState`. *New (`inventory/components/`):* `stock-levels-table`, `movement-ledger-table` (signed-qty, COGS+profit on OUT, clickable reference cell), `reservations-table` (holder chip → order/repair), `adjustment-form` + `adjustment-line-editor` (product picker via `autocomplete-input`, counted-vs-system live delta chip, IN-delta reveals `unitCost` + collapsible reprice sub-form), `inventory-filters`. Reference links are `<Link>` only (scope confinement — no destination pages built here).

**3. Granular States** — stock/ledger/reservations tabs each independent: `TableSkeleton` on load, `<EmptyState />` on empty, local `<NotFoundState retry>` on error. Tab bar + filters persist.

**4. Forms & Mutations** — `adjustment.schema.ts` wraps `CreateAdjustmentCommand` and adds the refine "`unitCost` required on every IN-delta line". Submit → `useCreateAdjustment`; success toast shows the returned `AdjustmentResultDto` ADJ reference; per-line server errors inline.

**5. Optimization** — `useMemo` on each table's column defs; the Adjustments tab is heavy → mount its subtree behind a `Tabs` lazy value (render on first activation), not a route split.

**6. Unit-Test Strategy** — `inventory/AdminInventory.spec.tsx`: mock `useInventory`; assert low-row highlight + low-only filter, movement type chips, reservation `AgeFlag`, skeleton/empty/error per tab. `adjustment-form.spec.tsx`: `userEvent` — IN-delta line without `unitCost` shows the Zod message; valid submit calls `mutate`.

**7. Acceptance** — all four tabs read live data with independent states; adjustment posts and invalidates the three inventory keys + admin products; CSV export streams the filtered stock set; every reference is a `<Link>`; zero inline strings.

---

## Page 2 — ADM-07 Suppliers (`/admin/suppliers` + `/:id`, **rewire**)

List + edit-mode detail. Swap `use-admin-suppliers` / `use-supplier-information` →
`usePurchasingSuppliers.ts`.

**1. Hooks** — List: `usePurchasingSuppliers(query: SupplierListQuery)` → `['purchasing','suppliers','list',q]` (`PaginatedResult<SupplierDto>`); `usePurchasingSupplierStats()` → `['purchasing','suppliers','stats']` (`SupplierStatsDto` = total/totalDue/totalPaid). Detail: `usePurchasingSupplierDetail(id)` → `['purchasing','suppliers','detail',id]` (`SupplierDetailDto` = `{ invoices, payments, productHistory }`). Mutations: `useCreatePurchasingSupplier` (incl. `initialCredit`), `useUpdatePurchasingSupplier` — invalidate `['purchasing','suppliers']` (+detail id).

**2. UI Components** — reuse the *existing shells* `AdminSuppliers.tsx` + `AdminSupplierInformation.tsx` and their `components/` (stat cards, table, add/modify dialogs, financial summary, invoices table, product-history table) — **rewire their hook imports and retype props from numeric-id view-models to the contract DTOs**. *Shared:* `StatCard`, `DataTable`, `MoneyStatusCard` (credit). "Add invoice" row action → `<Link>` to `/admin/supplier-invoices/new?supplierId=` (ADM-08 preselected). Financial card "record payment" → `<Link>`/dialog into the ADM-15 payment flow.

**3. Granular States** — `StatCardSkeleton` row, `TableSkeleton` list; detail: skeleton cards + `<NotFoundState />` when `usePurchasingSupplierDetail` 404s (bad `:id`).

**4. Forms & Mutations** — replace the stub schemas with wrappers over `CreateSupplierCommand` / `UpdateSupplierCommand`. Disable = `useUpdatePurchasingSupplier({ isEnabled:false })` (hides from pickers, history intact).

**5. Optimization** — column-def `useMemo`; detail page `React.lazy` route.

**6. Tests** — `suppliers/AdminSuppliers.spec.tsx` (mock hooks: stat row, search, disable action, skeleton/empty) + `AdminSupplierInformation.spec.tsx` (detail sections, 404 fallback) + `admin-supplier-add-dialog.spec.tsx` (Zod, `initialCredit`).

**7. Acceptance** — list + detail read contract DTOs (no `draft-types`); disable/edit/create invalidate correctly; "Add invoice" preselects the supplier in ADM-08; **all stub imports removed** (see Deletion Audit).

---

## Page 3 — ADM-08 Supplier invoices (`/admin/supplier-invoices` + `/:id`, **new**)

Goods-receipt list + DRAFT editor with confirm→reprice flow.

**1. Hooks** — List: `usePurchasingInvoices(query: SupplierInvoiceListQuery)` → `['purchasing'…invoices…]` (`PaginatedResult<SupplierInvoiceDto>`); filters supplier/status/date. Editor: `usePurchasingInvoiceDetail(id)`. Mutations: `useCreatePurchasingInvoice`, `useUpdatePurchasingInvoice` (DRAFT PATCH; 409 after confirm surfaced), `useConfirmPurchasingInvoice` (invalidates `['purchasing',*]`, `['inventory',*]`, `qk.catalog.adminProducts`), `useCancelPurchasingInvoice` (reason optional, reverses credit), `useCreatePurchasingPayment` (`usePurchasingPayments.ts`; previews previous→new credit via `CreditMovementPreview`). Inline create-product: `useCreateProduct`; reprice: `useUpdatePricing` (both `useCatalogProducts.ts`).

**2. UI Components** — *Shared:* `DataTable`, `StatusBadge` (DRAFT/CONFIRMED/CANCELLED), `autocomplete-input` (product combobox), `CreditMovementPreview`. *New (`supplier-invoices/components/`):* `supplier-invoices-table`, `invoice-header-form`, `amount-only-switch` (collapses line editor to one amount field), `invoice-line-editor` (qty/unit-cost/serials, live landed-unit-cost + projected-new-avg-cost footer), `inline-create-product-dialog`, `confirm-bar`, `reprice-prompt` (one collapsible price form per received product, per-product Apply/Skip + Skip-all), `record-payment-dialog`.

**3. Granular States** — `TableSkeleton` list; editor: skeleton header/lines, `<NotFoundState />` on bad `:id`; confirm/cancel/payment mutations use button-pending states + inline 409 banners.

**4. Forms & Mutations** — `supplier-invoice.schema.ts` wraps `CreateSupplierInvoiceCommand` with the **amountOnly XOR lines** refine + per-line positive qty/cost. Reprice forms submit `UpdatePricingCommand` per product. Payment: `CreateSupplierPaymentCommand`. Inline create: the catalog create command (minimal fields). 409 on post-confirm PATCH → inline "already confirmed" surface + cancel-shortcut.

**5. Optimization** — `useMemo` the live footer math (recomputes per keystroke over all lines); `React.lazy` both routes; reprice prompt renders only after a successful confirm.

**Sprint 6 scope note:** the footer implements subtotal + shipping + total, not a per-line landed-unit-cost/projected-new-average-cost estimate — the latter needs a weighted-average projection against each product's live `averageCost`/`quantityOnHand` (available via `useAdminCatalogProducts`, same data the Inventory adjustment form already reads), which is a real, non-trivial computation. Flagged for Sprint 9 polish rather than approximated. Similarly, cancel has no reason-collection dialog (`ConfirmBar.onCancel` posts an empty `{}` body — `reason` is optional) and no post-cancel "check ADM-06" banner — neither exists as a Sprint 4 primitive; the acceptance line below has been corrected to match.

**6. Tests** — `AdminSupplierInvoices.spec.tsx` (list filters, status chips, skeleton). `supplier-invoice-editor.spec.tsx`: amount-only ⇄ lines XOR error; landed/avg-cost footer recompute; confirm reveals reprice prompt; inline-create-product dialog opens. `record-payment-dialog.spec.tsx`: credit preview.

**7. Acceptance** — DRAFT saves freely; confirm sweeps inventory+suppliers+products and opens the reprice prompt; a missing catalog entry never blocks a line (inline create); cancel reverses credit (no reason dialog or post-cancel banner — see Sprint 6 scope note above); supplier preselect from ADM-07 works.

---

## Page 4 — ADM-11 POS clients (`/admin/pos-clients`, **new**)

The only manual client creation in the app.

**1. Hooks** — List (`usePosClients.ts`): `usePosClientsList(query: PosClientListQuery)` → `['pos-clients','list',q]` (`PaginatedResult<PosClientDto>`); `useCreatePosClient` / `useUpdatePosClient` → invalidate `['pos-clients']`. **Detail drawer (A1 resolved, no new endpoint):** `useSales('admin', { posClientId }, { enabled })` (`useSales.ts` — gained the `options?.enabled` param in Sprint 5, matching `useInvoices`/`useStaffProducts`) for the sales tab; `useClientPayments({ posClientId }, { enabled })` (`useBilling.ts`) for the payments tab. **Sprint 5 correction:** both gate on `!!detailClient` (fetch together once a row is clicked), not per-sub-tab — the Credit-history tab needs both row sets merged regardless of which sub-tab is open, so gating either query behind its own tab would leave Credit history incomplete on first view. Credit-history tab is **derived**, not fetched.

**2. UI Components** — *Shared:* `DataTable` (code, name, phone, category, `MoneyStatusCard`-style credit, totalPaid, totalSold, linked-account cell or "—", enabled), `CreditMovementPreview` (per-row previous→new in the credit tab). *New (`pos-clients/components/`):* `pos-clients-table`, `add-pos-client-dialog` (name*, phone?, category?, initialCredit?), `edit-pos-client-dialog`, `pos-client-detail-drawer` with three tabs — **Sales** (`useSales`), **Payments** (`useClientPayments`), **Credit history** (a `useMemo` merge of the sales + payments rows on `previousCredit`/`newCredit` + date, newest first). The drawer receives the clicked `PosClientDto` row for its headline (no re-fetch). Record-payment shortcut → ADM-15 dialog `<Link>`; category-change helper text ("re-resolves future prices only").

**3. Granular States** — `TableSkeleton` on the list; `<EmptyState />` no-clients; local error retry. Inside the drawer, each tab has its own `TableSkeleton`/`<EmptyState />`; the credit tab shows empty until at least one sale/payment exists.

**4. Forms & Mutations** — `pos-client.schema.ts` wraps `CreatePosClientCommand` / `UpdatePosClientCommand`.

**5. Optimization** — column-def `useMemo`; the credit-history merge is a `useMemo` over the two loaded row sets; `React.lazy` route; drawer tabs mount their query only when active (`enabled`).

**6. Tests** — `AdminPosClients.spec.tsx`: mock `usePosClients`; table renders credit/totalSold/linked-account "—", skeleton/empty. `pos-client-detail-drawer.spec.tsx`: mock `useSales` + `useClientPayments`; assert the credit-history tab renders the merged, date-sorted rows from mocked sales + payments. `add-pos-client-dialog.spec.tsx`: required-name Zod error, optional initialCredit accepted.

**7. Acceptance** — list reads `PosClientDto`; create/edit invalidate `['pos-clients']`; the detail drawer's three tabs work off existing hooks (sales/payments) + a client-side credit merge — **no new endpoint**; category helper text present.

---

## Page 5 — ADM-12 Web clients + ADM-12b Client detail (`/admin/clients`, `/admin/clients/:id`)

List = **rewire** (`AdminClients.tsx` off `use-admin-clients*`); detail = **new**.

**1. Hooks** — List (`useClientDirectory.ts`): `useClientDirectory(query: AdminClientListQuery)` → `['clients','admin','list',q]` (`PaginatedResult<AdminClientDto>`); `useClientDirectoryStats()` → `['clients','admin','stats']` (`ClientStatsDto` — see gap A2 re `newThisMonth`). Mutations: `useApproveClient`, `useRejectClient`, `useUpdateClientDirectoryEntry` → invalidate `['clients','admin']`, `['pos-clients']`, `qk.stats`/dashboard. Detail (ADM-12b): `useClientDirectoryEntry(id)` → `['clients','admin','detail',id]`; `useResetClientPassword` (no invalidation); browsing tabs → `useClientActivity(id, query: ClientActivityQuery)` (`useObservability.ts`) → `['observability','client-activity',id,q]`, lazy per tab.

**2. UI Components** — List: reuse `AdminClients.tsx` shell + `components/` (stats cards, filters, table, modify dialog) **retyped to `AdminClientDto`**; add an `approval-dialog` (registration recap · username+password · **mandatory category select** · Approve/Reject). *New (`clients/[id]/` or `clients/components/detail/`):* `client-detail-header`, tab set Overview/Orders/Invoices/Payments/**Browsing**, `reset-password-dialog`, `browsing-activity-table` (searches, time-per-product, sessions; rows `<Link>` to product). *Shared:* `StatCard`, `DataTable`, `StatusBadge`, `MoneyStatusCard`.

**3. Granular States** — `StatCardSkeleton` row, `TableSkeleton` list; detail: skeleton header + `<NotFoundState />` on bad `:id`; each browsing tab loads independently (`useClientActivity` lazy) with its own skeleton/empty.

**4. Forms & Mutations** — `approve-client.schema.ts` wraps `ApproveClientCommand` (username-unique server error → `setError` on the username field); `RejectClientCommand`; `reset-client-password.schema.ts` wraps `ResetClientPasswordCommand` with the min-length + confirm-match refine; edit = contact subset of `AdminUpdateClientCommand`. No create button (registration-only). Approve helper: "logs out everywhere" / reset warning banner.

**5. Optimization** — column-def `useMemo`; `React.lazy` both routes; browsing tabs mount their query only when the tab is active (`enabled`).

**6. Tests** — `AdminClients.spec.tsx` (stat row, pending-filter approval queue, approve action, no create button, skeleton). `approval-dialog.spec.tsx` (mandatory category Zod error, username server-error placement). `client-detail.spec.tsx` (tabs, 404 fallback, browsing rows link). `reset-password-dialog.spec.tsx` (confirm-mismatch Zod error, warning copy).

**7. Acceptance** — list reads `AdminClientDto`; approve atomically creates credentials + linked POS client (row flips APPROVED with username), invalidating the three keys; detail tabs lazy-load; reset-password confirms with the sessions-die warning; **stub imports removed**.

---

## Page 6 — ADM-15 Reports & statistics (`/admin/statistics`, **rewire**)

Swap `use-admin-statistics` (+ `admin-statistics.service`) → `useStatistics.ts`; keep the shell +
the 4 existing chart components (`revenue/orders-trend/clients/sales-by-family`), rewired to `useChart`.

**1. Hooks** (`useStatistics.ts`) — `useOverview()` → `['stats','overview']` (`OverviewDto`, all 5 cards backed); `useFiltered(query: FilteredQuery)` → `['stats','filtered',range,familyId]` (revenue/profit/orders + %change); `useChart(chart: ChartType, query: ChartsQuery)` per chart; `useTopProducts(query)`; `useReport(type: ReportType, query: ReportQuery)` → `['reports',type,range,groupBy]`; `useExportReportCsv()` (Blob, same endpoint `format=csv`). Each widget loads independently.

**2. UI Components** — reuse `AdminStatistics.tsx` + `components/` (overview-cards, filtered-cards, filters, charts/) **rewired**. *Shared:* `StatCard`, `DataTable`, `MoneyStatusCard`, `ResolvedVsChargedPrice` (by-client/by-category "real discount" report). Charts use `recharts` (already approved). *New:* `report-picker` (chart + `DataTable` + CSV per report type). URL-synced filters (`dateRange`, `familyId`) via `useSearchParams`. Every figure carries a drill id → `<Link>`.

**3. Granular States** — **per-widget** skeletons (overview cards, each chart, each report table) — one widget's error never blanks the others; local retry per widget; filter bar always persists.

**4. Forms & Mutations** — none (filter bar only; no Zod forms). CSV export is a mutation→Blob download.

**5. Optimization** — `useMemo` chart-data transforms + report column defs; `React.lazy` route; charts already code-split via the chart components.

**6. Tests** — `AdminStatistics.spec.tsx`: mock `useStatistics`; independent widget skeletons, %-change render, report-picker switches report + triggers CSV, URL filter sync. Assert one widget error leaves siblings rendered.

**7. Acceptance** — every card/chart/report reads live data with independent states; filters sync to URL and recompute comparisons; each report exports CSV; drill ids present; **stub removed**.

---

## Page 7 — ADM-16 Users & roles (`/admin/users`, **new**)

Two tabs: Users · Roles, over the **staff page registry**.

**1. Hooks** (`useIdentity.ts`) — `useUsers(query: UserListQuery)` → `['identity','users','list',q]` (`PaginatedResult<UserDto>`); `useRoles()` → `['identity','roles']` (`RoleDto[]`); `usePages({ scope:'staff' })` → `['identity','pages',q]` (`PageDto[]`, the permission matrix source). Mutations: `useCreateUser` / `useUpdateUser` (invalidate `['identity','users']`), `useCreateRole` / `useUpdateRole` / `useSetRolePages` (invalidate `['identity','roles']`).

**2. UI Components** — *Shared:* `DataTable`, `StatusBadge` (type badge admin|staff), `PageHeader`, Shadcn `Tabs`. *New (`users/components/`):* `users-table` (username, full name, job title, type badge, roles, enabled, last login; filters type/role/status), `user-dialog` (credentials, staff profile, isEnabled, **type switch** — Admin hides matrix "all pages", Staff shows role multi-select + **live effective page list** computed client-side from selected roleIds × `RoleDto.pages`), `roles-table`, `role-dialog` (page-permission matrix grouped by section, select-all per group; system roles read-only).

**3. Granular States** — `TableSkeleton` per tab; `<NotFoundState />` on error; last-admin-guard + roleIds-required errors surface as an **inline banner** in the dialog.

**4. Forms & Mutations** — `user.schema.ts` wraps `CreateUserCommand`/`UpdateUserCommand` with the **type/roleIds refine** (roleIds required iff `STAFF`) mirroring the server rule; `role.schema.ts` + `SetRolePagesCommand`. Permission changes need no session refresh (resolved per request server-side).

**5. Optimization** — `useMemo` the effective-page-list derivation (roles × pages) and column defs; `React.lazy` route.

**6. Tests** — `AdminUsers.spec.tsx`: mock `useIdentity`; type-switch shows/hides role section, effective-page list updates on role toggle, system-role rows read-only, skeleton. `user-dialog.spec.tsx`: STAFF-without-roleIds Zod error; last-admin server error banner.

**7. Acceptance** — users + roles CRUD wired; type switch enforces the roleIds refine client-side; effective page list renders live; matrix scoped to staff registry; system roles locked.

---

## Page 8 — ADM-17 Settings (`/admin/settings`, **rewire**)

Tabbed: Store · Invoicing · Categories · Hierarchy · Delivery fees · Storefront.

**1. Hooks** — Settings: `usePlatformSettings()` → `['platform','settings']` (`SettingsDto`), `useUpdatePlatformSettings` (`UpdateSettingsCommand`; covers Store, Invoicing, Storefront `featuredProductIds`). Delivery fees (`usePlatform.ts`): `useAdminDeliveryFees()` → `['delivery-fees','admin']`, `useUpsertAdminDeliveryFees` (`UpsertFeesCommand`), `useImportAdminDeliveryFees` (dry-run report), `useExportAdminDeliveryFees` (Blob) — invalidate own key + `['wilayas']` public cache. Categories: `useCatalogClientCategories` / `useCreateCatalogClientCategory` / `useUpdateCatalogClientCategory` (`useClientCategories.ts`). Hierarchy (`useCatalogTaxonomy.ts`): `useCatalogFamilies/Brands/Models(…, admin=true)` + `useCreate*/useUpdate*` + `useSetModelFamilies` (the many-to-many).

**2. UI Components** — reuse `AdminSettings.tsx` shell; **rewire** `admin-accounts-section`? *(note: admin-accounts is a Sub-01 stub concept — user management now lives in ADM-16; the Settings "accounts" section should be dropped, not rewired — see Deletion Audit)*. Keep/rewire `delivery-fees-section` (uses `excel-file-uploader` + import dry-run report). *New (`settings/components/`):* `store-settings-form`, `invoicing-settings-form` (per-DocType prefix + next-sequence, decrease→inline 409), `categories-table` (name-only + enable/disable, member/priced-product warning columns), `hierarchy-panel` (Families/Brands/Models sub-panels, inline create, **disable-only**, families multi-select on Model), `storefront-settings` (**featured-products picker only** — delivery-companies scoped out per gap A3). *Shared:* `DataTable`, `excel-file-uploader`, `image-management` (family icon / brand logo upload), Shadcn `Tabs`.

**3. Granular States** — per-tab skeletons; delivery-fee import shows a **dry-run validation report** before applying (all-or-nothing); local error per tab.

**4. Forms & Mutations** — per-tab RHF wrappers over `UpdateSettingsCommand`, `CreateClientCategoryCommand`, the taxonomy commands, `UpsertFeesCommand`. Sequence-decrease → inline 409 message. Disable-only everywhere (products keep references).

**5. Optimization** — `React.lazy` route; each tab's queries mount on activation; `useMemo` fee-table rows (wilaya × commune overrides).

**6. Tests** — `AdminSettings.spec.tsx` (tab switches, each form's key Zod error). `invoicing-settings.spec.tsx` (sequence-decrease 409 surface). `delivery-fees-section.spec.tsx` (import dry-run report renders before apply). `hierarchy-panel.spec.tsx` (model families multi-select, disable-only, inline create).

**7. Acceptance** — all six tabs read/write via `usePlatform`/taxonomy/category hooks; fee changes invalidate `['wilayas']`; import is dry-run/all-or-nothing; storefront ships featured-only with the delivery-companies scope note; **the stub `admin-settings` account section is removed** (ADM-16 owns users).

---

## Page 9 — ADM-18 Audit logs (`/admin/logs`, **rewire**)

Swap `use-admin-logs` (+ `admin-logs.service`) → `useObservability.ts`. Read-only, append-only.

**1. Hooks** — `useLogs(query: LogsQuery)` → `['observability','logs','list',q]` (`PaginatedResult<AuditLogDto>`); `useLogStats()` → `['observability','logs','stats']`? *(the requirement's `['logs','stats']`)* (`LogStatsDto` = total/today/week/month). User-select filter source: reuse `useUsers` (identity) rather than the stub `usePlatformUsers`.

**2. UI Components** — reuse `AdminLogs.tsx` shell + `components/` (stats cards, filters, table) **retyped to `AuditLogDto`**. *Shared:* `StatCard`, `DataTable` (20/page), `SimplePagination`, `admin-search-input`. Entity cell → `<Link>` where a route exists; **no mutation UI** (append-only). A `<Link>` to ADM-19 staff-searches.

**3. Granular States** — `StatCardSkeleton` row, `TableSkeleton` rows, `<EmptyState />`, retry.

**4. Forms & Mutations** — none.

**5. Optimization** — column-def `useMemo`; `React.lazy` route.

**6. Tests** — `AdminLogs.spec.tsx`: mock `useObservability`; stat row, filter bar refetch, entity-link presence, skeleton/empty. Assert no delete/purge controls exist.

**7. Acceptance** — logs + stats read `AuditLogDto`/`LogStatsDto`; filters refetch; entity links resolve where routed; strictly read-only; **stub removed**.

---

## Page 10 — ADM-19 Staff search audit (`/admin/activity/staff-searches`, **new**)

The inventory-count companion, linked from ADM-06 and ADM-18.

**1. Hooks** — `useStaffSearches(query: StaffSearchesQuery)` (`useObservability.ts`) → `['observability','staff-searches',q]` (`StaffSearchDto[]`). User filter → `useUsers` (identity).

**2. UI Components** — *Shared:* `PageHeader`, `DataTable` (date, user, query, matched product `<Link>` → ADM-04 movements tab), `admin-search-input`, `EmptyState`. *New:* `staff-search-filters` (user, date-range, query text).

**3. Granular States** — `TableSkeleton`, `<EmptyState />`, local retry.

**4. Forms & Mutations** — none.

**5. Optimization** — column-def `useMemo`; `React.lazy` route.

**6. Tests** — `AdminStaffSearches.spec.tsx`: mock `useObservability`; filter render, product-link presence, skeleton/empty.

**7. Acceptance** — reads `StaffSearchDto`; filters drive the query; product links reach the ADM-04 movements tab; reachable from ADM-06 + ADM-18.

---

## Deletion Audit — Sub-01 stub code this set orphans

Once each page above is rewired/built, the following stub artifacts become dead. **Delete only
behind a grep gate** — `grep -rl <symbol> src/` must return **zero** importers first, because a
few draft-types/services are shared with pages not in this set (products, dashboard, orders that
still carry a stray draft enum import per the audit).

**Stub hooks (delete outright — no non-stub consumer):**
- `hooks/use-admin-suppliers.ts`, `hooks/use-supplier-information.ts`, `hooks/use-supplier-information-page-state.ts` → ADM-07.
- `hooks/use-admin-clients.ts`, `hooks/use-admin-clients-stats.ts`, `hooks/use-admin-clients-search.ts`, `hooks/use-modify-client.ts` → ADM-12.
- `hooks/use-admin-logs.ts` → ADM-18.
- `hooks/use-admin-settings.ts` → ADM-17 (its `useClientCategories/useFamilies/useBrands/...` duplicate names are exactly why the real hooks are prefixed `useCatalog*`).
- `hooks/use-admin-statistics.ts` → ADM-15.
- `hooks/use-recent-clients.ts`, `hooks/use-recent-orders.ts` → **gate:** used by the dashboard (ADM-01, set-02) — confirm the dashboard was already swapped before deleting; otherwise leave.

**Stub services:** `services/admin-suppliers.service.ts`, `services/supplier-information.service.ts`, `services/admin-logs.service.ts`, `services/admin-settings.service.ts`, `services/admin-statistics.service.ts` → delete. **Do NOT delete `services/statistics.service.ts`** (that is the real one `useStatistics` consumes). `services/clients.service.ts` and `services/catalog.service.ts` are **mixed** — prune only the stub-era methods (`modifyAdminClient`, `AdminClientsPaginatedResponse`/`AdminClientWithDetails` helpers, admin-product stub methods) once their stub hooks are gone; keep the real Directory/PosClient/catalog methods.

**Draft types (`types/draft-types/`):** remove the files this set's pages own —
`admin-suppliers.types.ts`, `supplier.types.ts`, `admin-settings.types.ts`,
`admin-statistics.types.ts`, `logs.types.ts`, and the admin-client portions of `client.types.ts` —
plus their re-exports in `types/draft-types/index.ts`. **Gate the rest** (`admin-product-*`,
`dashboard`, `order`, `product`, `wilaya`, `routes.ts`, `enums.types.ts`): several are still
referenced by out-of-set or already-migrated pages — the full `draft-types` teardown is the
closing act of Sub-03, not this set. Each deletion PR must keep `npm run lint` / `tsc` green.

**Settings "accounts" section:** the stub `settings/components/admin-account-dialog.*` +
`admin-accounts-section.tsx` model user management inside Settings; ADM-16 now owns users/roles.
Drop these rather than rewire them (confirm with the requirement owner — flagged, not assumed).

---

## Expected Outputs recap

- **10 pages** wired to existing Integration-Engine hooks — **no new hooks required**.
- **Exactly one backend + contract change** (A2 — add `ClientStatsDto.newThisMonth` + its stats query). A1 resolves by composing existing `posClientId`-filtered lists (no endpoint); A3 scopes delivery-companies out. Land A2 as the first task of the ADM-12 sprint.
- **Stub teardown** of ~14 hooks + 5 services + ~6 draft-type files, grep-gated.
- Tests under `/tests/unit/pages/<page>/`, reusing existing typed fixtures; nothing in `/src`.
