# Stage 03 · Sub-03 · Set-03 — Page Assembly Sprints

Inside-out, layer-first across the whole back-office set: **Foundation → Primitives & States →
Assembly & Wiring → Polish → Tests**. **No code in this doc — planning only.** Companion to
[`plan.md`](./plan.md); gap IDs (A1–A4, B1) refer to that plan's Section 0.

## Strategy

The set is six clusters — five staff/admin **twins** (POS, orders, sales, invoices, repairs) built as
**one `scope`-driven tree each** plus the **products** admin trio (list/add/info). We build all shared
foundations first, then primitives, then wire cluster-by-cluster, then polish, then test — so wiring
(Sprint 5+) never precedes primitives (Sprints 3–4). Admin Orders/Products pages are **hook-swaps** off
the Sub-01 stubs, not rebuilds.

### Resolve-first prerequisites (folded into Sprint 2, per the user's decisions)
- **A1** — add `categoryPrices` to `AdminProductResponseSchema` **and** the backend that fills it
  (`Apps/api` catalog mapper + service), mirroring `toStaffProductDto`.
- **A2 / A3** — extend `BackofficeOrdersQuery` (`from`/`to`) and `SaleListQuery` (`from`/`to`,
  `sellerId`, `posClientId`) in the contract; backend query handlers accept them.
- **A4** — **no new endpoints.** ADM-04 Movements = `useMovements({ productId })` (inventory);
  Supply history = existing purchasing supplier-product data scoped to the product; Sales history =
  inventory movement OUT rows (cost + profit + source doc). Wire to what exists.
- **B1** — add `useRepair(scope, id)` hook + `repairs.service.getRepair` (endpoint param already exists).

### Global validation gates (apply to **every** sprint below)
Each sprint's **Validation** block repeats these; only sprint-specific extras are re-listed inline:
- [ ] No inline strings — **all** JSX text via `useTranslation` (`t('…')`); `ar` left `""`.
- [ ] No `useEffect` for fetching (Component→Hook→Service only).
- [ ] `tsc --noEmit` clean in **every** touched package (`contract`, `api`, `web`).
- [ ] Layout survives `isError: true` / 404 (local fallback inside content area, global shell intact).
- [ ] `vitest run` green with mocked hooks (once tests exist for the surface).
- [ ] No test files under `/src`.
- [ ] Committed on green (`git add .` → `set-03: sprint N — <topic>`).

---

### Sprint 1: Schemas & i18n (Foundation) — Status: ✅ Done

**Goals**
- Every RHF form in the set has a co-located Zod schema (contract-imported where a Command exists).
- All translation keys for the set exist (`en`/`fr` real, `ar` `""`).

**Tasks**
- [x] Co-locate form schemas re-using contract commands — no re-declaration: POS `SaleDraftCommand` / `ConfirmSaleCommand` / `CreatePosClientCommand`; orders `ConfirmOrderCommand` / `UpdateOrderStatusCommand` / `ReturnOrderCommand` (+ local cancel `{reason?}`); sales `CreateReturnCommand`; invoices `CreateClientPaymentCommand` / `CreateSupplierPaymentCommand`; repairs `CreateRepairCommand` / `AddRepairPartCommand` / `RepairStatusCommand`; products `CreateProductCommand` / `UpdatePricingCommand`. Only page-local UI refinements (e.g. barcode-focus state) get `[name].schema.ts`. (#schema)
- [x] Add translation keys to `config/translations.json` for all 13 pages under `staff.*` / `admin.*` scopes — tables, tabs, dialogs, stat cards, error/empty/loading, form labels + server-error messages (`INSUFFICIENT_STOCK`, `CREDIT_REQUIRES_CLIENT`, `PRICING_REQUIRES_STOCK`). Reuse existing keys where present. (#i18n)

**Validation**
- [x] Global gates. Extra: schemas `infer` types identical to their contract Command (no drift); every new key has non-empty `en`+`fr`, `ar: ""`.

**Risks**
- Duplicating a contract Command as a local schema (must import, not re-declare). Key collisions with set-01/02.

**Report:** [report-sprint-01.md](./report-sprint-01.md)

---

### Sprint 2: Routes, guards, lazy + Engine prerequisites (Foundation) — Status: ✅ Done

**Goals**
- All 13 routes registered, `React.lazy` + `Suspense`, correct layout + `RoleGuard`.
- Contract/backend/hook gaps (A1–A4, B1) resolved so wiring sprints have real, typed hooks.

**Tasks**
- [x] Register routes with `React.lazy()` + `<Suspense fallback={<PageLoader/>}>`: `/staff/pos` `/admin/pos`, `/staff/orders` `/admin/orders`, `/staff/sales` `/admin/sales`, `/staff/invoices` `/admin/invoices`, `/staff/repairs` `/admin/repairs`, `/admin/products` `/admin/products/add` `/admin/products/:id`. Staff→`StaffLayout`, admin→`AdminLayout`. (#routing)
- [x] Wrap staff routes in `RoleGuard(STAFF_POS|STAFF_ORDERS|STAFF_SALES|STAFF_INVOICES|STAFF_REPAIRS)`; admin routes unrestricted within `AdminLayout`. Admin twin routes mount the staff page tree with `scope="admin"`. (#routing)
- [x] **A1 (contract):** add `categoryPrices` to `AdminProductResponseSchema` (shape = `StaffProductResponseSchema`). (#contract)
- [x] **A1 (backend `Apps/api`):** `catalog.mapper.ts` `toAdminProductDto` gains a `categoryPrices` param (mirror `toStaffProductDto:101`); `catalog.service` `getAdminProduct`/`listAdminProducts` load category prices and pass them; keep `AdminProductResponseSchema.parse`. Update/verify catalog integration tests. (#backend)
- [x] **A2/A3 (contract + backend):** extend `BackofficeOrdersQuerySchema` (`from`/`to`) and `SaleListQuerySchema` (`from`/`to`, `sellerId`, `posClientId`); orders/sales query handlers in `Apps/api` accept + filter on them. (#contract #backend)
- [x] **B1 (hook + service):** add `repairsService.getRepair(scope, id)` and `useRepair(scope, id)` → `['repairs', scope, id]`. (#wiring)
- [x] **A4 (wiring decision, no new endpoints):** confirm ADM-04 tab hooks — Movements `useMovements({ productId })`; Supply history via existing purchasing supplier-product read scoped to the product; Sales history via inventory OUT movements (cost/profit/source). Add thin `useProductSupplyHistory(id)` / `useProductSalesHistory(id)` wrappers over those existing services if a dedicated key helps. (#wiring)

**Validation**
- [x] Global gates. Extra: guards deny the wrong role; admin twin route renders with `scope="admin"`; `Apps/api` unit+integration suites green after A1–A3; `AdminProductResponseSchema.parse` accepts the enriched DTO.

**Risks**
- Backend A1/A3 touch live services — run the api suite. Query-param additions must stay optional (back-compat).

**Report:** [report-sprint-02.md](./report-sprint-02.md)

---

### Sprint 3: Shared / DTO-typed primitives (Primitives & States) — Status: ✅ Done

**Goals**
- "Dumb", contract-DTO-typed presentational components shared across clusters, no hooks inside.

**Tasks**
- [x] Reuse-first audit: `DataTable`, `PageHeader`, `StatCard`, `StatCardSkeleton`, `TableSkeleton`, `StatusBadge`, `MoneyStatusCard`, `SimplePagination`, `EmptyState`, `NotFoundState`, `CancelOrderDialog`, `autocomplete-input`, `image-management`, `drag-drop-area` already exist — use directly. (#ui)
- [x] Build genuinely shared new primitives: `CreditMovementPreview` (prev → new credit, used by POS payment + all payment dialogs), `ResolvedVsChargedPrice` cell (POS ticket + sale detail + order dialogs), `AgeFlag` badge (orders >24h / repair card age). Props are DTO-typed, no data fetching. (#ui)

**Validation**
- [x] Global gates. Extra: primitives take contract DTOs as props (no local view-models); render pure from props (Storybook-free visual check via unit render — backed by 7 new tests in `tests/unit/components/shared/`).

**Risks**
- Over-abstracting — only promote to shared what ≥2 clusters use; otherwise keep page-local (Sprint 4).

**Report:** [report-sprint-03.md](./report-sprint-03.md)

---

### Sprint 4: Page-local primitives, Skeletons & local fallbacks (Primitives & States) — Status: ✅ Done

**Goals**
- Every page's page-local dumb components exist with matching `Skeleton` + local error/empty fallbacks — still unwired.

**Tasks**
- [x] POS: `PosProductSearch`, `FamilyQuickPickGrid`, `PosTicket`, `PosClientAttachZone`, `PosPaymentPanel`, `MyDraftsDrawer`, `PosReceiptView`, `QuickAddPosClientDialog` + their skeletons. (#ui)
- [x] Orders: `OrderStatsRow`, `OrderStatusTabs`, `OrdersTable`, `OrderShowDialog`, `OrderConfirmDialog`, `OrderStatusDialog`, admin `ReturnOrderDialog` **and a new `AdminCancelOrderDialog`** (the existing shared `CancelOrderDialog` turned out to be the client-facing plain-confirm dialog, not reusable — see report). (#ui)
- [x] Sales: `SalesFilters`, `SalesTable`, `SaleDetailDrawer`, admin `ReturnDialog`. (#ui)
- [x] Invoices: `InvoicesTable`, `InvoiceSnapshotView`, `RecordPaymentDialog`, admin `IncomingInvoicesTable`, `PaymentsLedger`, `SupplierPaymentDialog`. (#ui)
- [x] Repairs: `RepairBoard` (+ lanes, native HTML5 drag-and-drop), `IntakeDialog`, `RepairTicketDetail` (parts editor), **and a new `RepairStatusDialog`** (needed as a home for the Sprint 1 `repair-status.schema.ts`). (#ui)
- [x] Products: audited `admin-products-table.tsx`/`admin-products-stats-cards.tsx`/`AdminProductInformation.tsx` — all three already have `Skeleton`+`EmptyState`/`NotFoundState` coverage from Sub-01; no Sprint 4 changes needed (see report). (#ui)
- [x] Each loading region gets a shape-matched Shadcn `Skeleton`; each fetchable region a local `NotFoundState`/`EmptyState`. (#ui)

**Validation**
- [x] Global gates. Extra: no hook imports in these files yet (grep-verified); skeletons match final content shape (no layout shift on state swap).

**Risks**
- Skeleton/real shape mismatch causing layout jump; `DataTable` renders desktop+mobile simultaneously in jsdom (known from set-02 — plan `getAllByText` for later tests).

**Report:** [report-sprint-04.md](./report-sprint-04.md)

---

### Sprint 5: Wiring — Products trio (Assembly & Wiring) — Status: ✅ Done

**Goals**
- ADM-02/03/04 fully wired onto real catalog hooks; Sub-01 stub imports deleted.

**Tasks**
- [x] ADM-02: `useAdminCatalogProducts`, `useProductStats`, `useUpdateProduct` (optimistic publish/enable toggles + rollback), taxonomy filter hooks; row Edit → `<Link>` to `/admin/products/:id`. Remove `use-admin-products` imports. (#wiring)
- [x] ADM-03: `useCatalogFamilies/Brands/Models(brandId)`, `useCatalogClientCategories`, inline-create `useCreateCatalogFamily/Brand/Model`, submit `useCreateProduct` (multipart); refines from `CreateProductCommand`; SKU/barcode uniqueness → field errors; success → navigate to new product. **`use-product-name-generation` deleted, not wired** — a fake stub simulating a network call for plain string concatenation; inlined the real logic instead. (#wiring #forms)
- [x] ADM-04: `useAdminCatalogProduct(id)`, edit-mode `useUpdateProduct` (details) + `useUpdatePricing` (pricing, reads new `categoryPrices` from A1), images `useAddProductImages`/`useUpdateProductImages`; tabs → `useMovements({productId})` + supply/sales-history wrappers (A4). Remove `use-admin-product-information`/`use-product-pricing` stub imports. **New contract fix found mid-sprint:** `AdminProductDto` also had no `images` field (only the public DTO did) — fixed the same way as A1 (see report). (#wiring)

**Validation**
- [x] Global gates. Extra: no `use-admin-*` stub imports remain in products pages (grep-verified); pricing card renders category prices (proves A1 end-to-end); toggles roll back on error (local-state rollback, not cache surgery).

**Risks**
- Stub→real DTO id switch (numeric→uuid) rippling through props; multipart submit wiring.

**Report:** [report-sprint-05.md](./report-sprint-05.md)

---

### Sprint 6: Wiring — Orders, Sales, Invoices twins (Assembly & Wiring) — Status: ⬜ Pending

**Goals**
- The three table-centric twins wired `scope`-driven; admin-only affordances gated.

**Tasks**
- [ ] Orders: `useOrdersList(scope, q)`, `useOrderStats(scope)`, `useConfirmOrder`, `useUpdateOrderStatus`; admin-gate `useAdminCancelOrder` + `useReturnOrder`. Default PENDING tab, search + date range (A2), age flag. Rewire `AdminOrders.tsx` off `use-admin-orders`. (#wiring #forms)
- [ ] Sales: `useSales(scope, q)`, `useSale(scope, ref)`; admin-gate `useCreateReturn` + profit/seller cols + footer totals + `ReturnDialog`; DRAFT row → `<Link>` to POS. Seller/date/client filters via A3. (#wiring #forms)
- [ ] Invoices: staff `useMyInvoices`/`useMyInvoice`/`useMyInvoicePdf`; admin tabs `useInvoices('admin',q)`/`useInvoice`/`useInvoicePdf`/`useCancelInvoice`, Incoming `usePurchasingInvoices`, ledgers `useClientPayments`+`usePurchasingPayments`; payment mutations `useCreateClientPayment`/`useCreatePurchasingPayment` with `CreditMovementPreview`. Lazy-per-tab queries. (#wiring #forms)

**Validation**
- [ ] Global gates. Extra: admin-only actions absent for `scope="staff"`; correct invalidation keys fire (`['orders']`+stats+dashboard; `['sales','admin']`+inventory+pos-clients; invoice/pos-client/supplier keys); staff invoice/sales lists scoped to self.

**Risks**
- Twin gating leaks (a staff mount showing return/cancel); wrong invalidation keys leaving stale tables.

---

### Sprint 7: Wiring — POS & Repairs (Assembly & Wiring) — Status: ⬜ Pending

**Goals**
- The two interaction-heavy twins wired; keyboard, drafts, board drag, parts editor working.

**Tasks**
- [ ] POS: `useStaffProducts`(admin:`useAdminCatalogProducts`), `usePosClientSearch`, `useQuickCreatePosClient`, drafts `useSales(scope,{status:'DRAFT'})`, `useCreateDraft`/`useUpdateDraft` (PATCH-on-change), `useConfirmSale`. Client attach re-resolves line prices (delta visible); per-line override edits `unitPrice`; underpayment/no-client → `CREDIT_REQUIRES_CLIENT`; shortfall → `INSUFFICIENT_STOCK` on the line; receipt view + print. Admin drawer groups drafts by staff. (#wiring #forms)
- [ ] Repairs: `useRepairs(scope,q)`, `useRepair(scope,id)` (B1), `useTechnicians`, `useCreateRepair`/`useUpdateRepair`/`useAddRepairPart`/`useRemoveRepairPart`/`useUpdateRepairStatus`. Board drag = status transition (snap-back + toast on server reject); intake prints claim slip; parts editor reserves + live availability; PICKED_UP → cash payment dialog; staff mapping omits profit/cost. Rewire `useRepair` detail into `RepairTicketDetail`. (#wiring #forms)

**Validation**
- [ ] Global gates. Extra: F2/F4/Enter handlers fire (no `useEffect` fetch); confirm idempotent/double-click safe; rejected drag snaps back; PROCESSING refine requires technician, PICKED_UP requires `paidAmount`.

**Risks**
- Incremental draft PATCH races; drag optimistic state vs server validation; keyboard focus stealing.

---

### Sprint 8: Polish (Polish) — Status: ⬜ Pending

**Goals**
- Desktop-first responsive, targeted memoization, beacons, and an i18n sweep.

**Tasks**
- [ ] Desktop-first layouts; horizontal table scroll on narrow admin viewports; POS two-pane collapses gracefully. (#polish)
- [ ] `useMemo` only where the plan calls for it: POS ticket totals, admin sales footer totals, per-lane repair grouping, `DataTable` column defs; `useCallback` on row/action handlers passed to `DataTable`. (#polish)
- [ ] Fire the staff-search beacon on product/order searches (reuse existing beacon util). (#polish)
- [ ] i18n sweep: grep for stray literals across all set-03 files; confirm every string routes through `useTranslation`. (#i18n)

**Validation**
- [ ] Global gates. Extra: **explicit `useTranslation` audit** — zero inline JSX strings in any set-03 file; no unnecessary memoization added beyond the listed hot spots.

**Risks**
- Premature memoization hurting clarity; missed literals in success-path branches (known set-02 gap).

---

### Sprint 9: Unit tests (Tests) — Status: ⬜ Pending

**Goals**
- `/tests/unit/pages/**` covering state reactions + form validation for all 13 pages, `vi.mock()` on hooks.

**Tasks**
- [ ] Per page: mock the feature hook(s) + `useTranslation` (`t: k=>k`); assert loading `Skeleton`, `isError`→local fallback (layout intact), empty state, and success render. Use `getAllByText` for `DataTable`'s dual desktop+mobile jsdom render. (#testing)
- [ ] Forms (`userEvent`, not `fireEvent`): POS quick-add + confirm errors; product-add refines (qty0 locks pricing, qty>0 requires unit cost, SKU/barcode uniqueness); order confirm/status refines; sales/order return qty bounds; repair intake "other"→free-text + PROCESSING/PICKED_UP refines; payment amount>0 + credit preview. (#testing)
- [ ] Twin gating tests: admin-only actions present for `scope="admin"`, absent for `scope="staff"` (orders cancel/return, sales profit/return, POS grouped drafts, repairs profit/cost). (#testing)
- [ ] Scope-confinement: linked destinations asserted as `<Link>` only, not rendered. (#testing)

**Validation**
- [ ] Global gates. Extra: `vitest run` green across the new specs; no MSW in unit tests; no test files in `/src`; each page has ≥ loading/error/success + one form/interaction assertion.

**Risks**
- Asserting translated strings instead of keys; over-mocking hiding real wiring defects.

---

## Sequencing notes & dependencies
- **Sprint 2 is the critical path:** A1 (contract+backend), A2/A3 (contract+backend), B1 hook, A4 wiring decision must land before Sprints 5–7 — otherwise wiring types don't exist.
- **Products (5) before back-office (6–7)** — highest reuse of existing shells, validates the stub→real swap and the A1 category-price path end-to-end first.
- **POS/Repairs last (7)** — most net-new UI + interaction surface.
- Wiring sprints never precede primitives (3–4). Tests (9) after Polish (8) so specs assert the final DOM.
- Commit on green each sprint: `set-03: sprint N — <topic>`.
