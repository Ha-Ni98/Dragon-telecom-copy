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

### Sprint 6: Wiring — Orders, Sales, Invoices twins (Assembly & Wiring) — Status: ✅ Done

**Goals**
- The three table-centric twins wired `scope`-driven; admin-only affordances gated.

**Tasks**
- [x] Orders: `useOrdersList(scope, q)`, `useOrderStats(scope)`, `useConfirmOrder`, `useUpdateOrderStatus`; admin-gate `useAdminCancelOrder` + `useReturnOrder`. Default PENDING tab, search + date range (A2), age flag. Rewire `AdminOrders.tsx` off `use-admin-orders`. **`OrderShowDialog` gained an action footer** (Confirm/Update status/Cancel/Return) — Sprint 4 left it a pure read view with nowhere to launch mutations from, since `OrdersTable` has no action column; also fixed a real `qk.orders.*` cache-key bug (staff/admin shared one key, `.admin.list` label regardless of scope). (#wiring #forms)
- [x] Sales: `useSales(scope, q)`, `useSale(scope, ref)`; admin-gate `useCreateReturn` + profit/seller cols + footer totals + `ReturnDialog`; DRAFT row → resume-in-POS button inside the drawer. Seller/date/client filters via A3 — resolved from `SalesFilters`' free-text inputs to `sellerId`/`posClientId` only on an exact name match (no picker UI exists on that component), never a "first match" guess. (#wiring #forms)
- [x] Invoices: staff `useMyInvoices`/`useMyInvoice`/`useMyInvoicePdf`; admin tabs `useInvoices('admin',q)`/`useInvoice`/`useInvoicePdf`/`useCancelInvoice`, Incoming `usePurchasingInvoices`, ledgers `useClientPayments`+`usePurchasingPayments`; payment mutations `useCreateClientPayment`/`useCreatePurchasingPayment` with `CreditMovementPreview`. Lazy-per-tab queries (added `enabled` options to `useInvoices`/`useClientPayments`/`usePurchasingInvoices`/`usePurchasingPayments`). **Two Sprint-4 gaps filled:** `InvoiceSnapshotView` had no cancel/record-payment buttons; `IncomingInvoicesTable` had no `onRowClick` (needed as the only entry point for "record supplier payment"). Built a new `CancelInvoiceDialog`+schema — Sprint 4 built every other invoices dialog but missed this one. (#wiring #forms)

**Validation**
- [x] Global gates. Extra: admin-only actions absent for `scope="staff"` (return/cancel buttons gated on `scope==="admin"` inside `OrderShowDialog`/`SaleDetailDrawer`/`InvoiceSnapshotView`); invalidation keys match the plan's cross-domain matrix (already correct in the pre-existing Sub-02 hooks, verified not re-implemented); staff invoice/sales lists scoped to self via the STAFF_* routes. tsc/eslint clean across the package; full `vitest run` 54/54 files, 400/400 tests, no regressions.

**Risks**
- Twin gating leaks (a staff mount showing return/cancel) — mitigated by gating in the shared dumb components, not the page. Wrong invalidation keys leaving stale tables — the one real bug found (`qk.orders.*`) is fixed; documented in report-sprint-06.md.

**Report:** [report-sprint-06.md](./report-sprint-06.md)

---

### Sprint 7: Wiring — POS & Repairs (Assembly & Wiring) — Status: ✅ Done

**Goals**
- The two interaction-heavy twins wired; keyboard, drafts, board drag, parts editor working.

**Tasks**
- [x] POS: `useStaffProducts` for **both** scopes (not `useAdminCatalogProducts` for admin — `PosProductSearch` is hard-typed to `StaffProductDto[]`, which already has everything a ticket needs; using the admin DTO would need a second component variant), `usePosClientSearch`, `useQuickCreatePosClient`, drafts `useSales(scope,{status:'DRAFT'})`, `useCreateDraft`/`useUpdateDraft` (debounced PATCH-on-change, with a synchronous flush-then-confirm to close the race between an in-flight debounce and Confirm), `useConfirmSale`. Client attach re-resolves non-overridden line prices (delta visible); per-line override edits `unitPrice`; underpayment/no-client → `CREDIT_REQUIRES_CLIENT` on the attach zone; shortfall → `INSUFFICIENT_STOCK` on the payment panel; receipt view + print. Admin drawer groups drafts by staff. (#wiring #forms)
- [x] Repairs: `useRepairs(scope,q)`, `useRepair(scope,id)` (B1, gained a needed `enabled: !!id` gate), `useTechnicians`, `useCreateRepair`/`useUpdateRepair`/`useAddRepairPart`/`useRemoveRepairPart`/`useUpdateRepairStatus`. Board drag always fires the bare `{toStatus}` command and lets the server be the judge (snap-back + toast on reject) rather than pre-routing to a form — PROCESSING/PICKED_UP/post-completion-CANCELLED need extra fields a drag can't supply, so those three specifically always bounce on drag and must go through the ticket detail's "Update status" button instead (documented UX gap). Parts editor reserves via `useAddRepairPart`; staff mapping omits profit/cost (component-level gating, already built Sprint 4). Rewired `useRepair` detail into `RepairTicketDetail`. (#wiring #forms)
- [x] **Real bug found and fixed, affecting both this sprint and Sprint 6:** `INSUFFICIENT_STOCK`/`CREDIT_REQUIRES_CLIENT` travel as the backend error's **message**, not `error.code` (`Apps/api`'s `ConflictError`/`BadRequestError` take `(message, details?)`; `code` is always the generic `RESOURCE_CONFLICT`/`VALIDATION_ERROR`). Sprint 6's order-confirm field-error check was comparing against `error.code` and would never have matched in production. Added `apiErrorMessage()` to `lib/query-client.ts` and fixed both call sites.

**Validation**
- [x] Global gates. Extra: F2/F4 focus shortcuts and a focus-scoped Enter (only confirms when the paid-amount field itself has focus, so typing in product/client search doesn't trigger it) via `useKeyboardShortcuts`, no `useEffect` fetch (the one `useEffect` in POS is the debounced draft-PATCH side effect, not a query — same sanctioned pattern as `AdminProducts.tsx`'s debounced-search-to-URL sync); confirm flushes the live draft state synchronously before calling `useConfirmSale`, so a double-click or a pending debounce can't confirm stale data; drag rejection relies on the board never doing an optimistic move (cards only reflect query data, so a failed mutation is a no-op visually); PROCESSING refine requires technician, PICKED_UP requires `paidAmount` (both already enforced by Sprint 1's `repair-status.schema.ts`, exercised here for the first time against real mutations).

**Risks**
- Incremental draft PATCH races — mitigated by the flush-before-confirm. Drag vs server validation — resolved by never pre-guessing the server's answer. Keyboard focus stealing — Enter is scoped to the paid-amount field's own focus state, not global.

**Report:** [report-sprint-07.md](./report-sprint-07.md)

---

### Sprint 8: Polish (Polish) — Status: ✅ Done

**Goals**
- Desktop-first responsive, targeted memoization, beacons, and an i18n sweep.

**Tasks**
- [x] Desktop-first layouts; horizontal table scroll on narrow admin viewports; POS two-pane collapses gracefully. **Already satisfied, verified not re-built:** `DataTable` (shared) already wraps its desktop table in `overflow-x-auto` unconditionally, so every table in the set (Orders/Sales/Invoices/Incoming/Payments/Products) already scrolls horizontally on narrow admin viewports with zero changes needed; POS's `grid-cols-1 lg:grid-cols-[2fr_3fr]` already collapses to a single stacked column below `lg`, carried over unchanged from the Sprint-2 placeholder shell. (#polish)
- [x] `useMemo` only where the plan calls for it: POS ticket totals (already memoized Sprint 7), admin sales footer totals (`SalesTable.tsx` — was a plain per-render `.reduce()`, now memoized), per-lane repair grouping (`RepairBoard.tsx` — was re-filtering the full list once per lane per render, now grouped once via a `Map`), `DataTable` column defs (already memoized everywhere, verified via a grep for `ColumnDef` usage without `useMemo` — zero hits); `useCallback` on row/action handlers passed to `DataTable` (`StaffSales.tsx`/`StaffInvoices.tsx` row-click handlers were inline arrows, now stable references — `StaffOrders.tsx`/`AdminProducts.tsx` already had this from Sprints 5/6). (#polish)
- [x] Fired the staff-search beacon (`useSendStaffSearch`, same util `StaffProducts.tsx`/`AdminProducts.tsx` already use) on `StaffOrders.tsx`'s debounced order search and `StaffPos.tsx`'s debounced product search — both scopes, unscoped by role (mirrors `StaffProducts.tsx`'s own staff-scope precedent, not just the admin one). Sales/Invoices searches and the repairs parts-editor product picker were deliberately left unbeaconed — the task names "product/order searches" specifically, and extending audit-beacon coverage to every incidental picker wasn't scoped here (noted as a scope decision, not an oversight). (#polish)
- [x] i18n sweep: grep-scanned every `.tsx` file across all of set-03 (pages + components, all 6 clusters, ~60 files) for literal JSX text nodes, hardcoded `placeholder`/`aria-label`/`title` attributes — **zero stray literals found**, set-03 was already clean going into this sprint (each prior sprint's own per-file audit had already caught everything). (#i18n)

**Validation**
- [x] Global gates. Extra: **explicit `useTranslation` audit** — zero inline JSX strings anywhere in set-03 (confirmed via the sweep above); no unnecessary memoization added beyond the four listed hot spots (RepairBoard grouping, SalesTable footer total, plus the two useCallback row-handler fixes) — deliberately did not touch `RepairBoard`'s `onCardClick`/`onDropOnLane` (not passed to `DataTable`, out of this task's literal scope) to avoid the "premature memoization" risk the plan itself flagged.

**Risks**
- Premature memoization hurting clarity — avoided by scoping strictly to the plan's named hot spots. Missed literals in success-path branches (known set-02 gap) — the full-set grep sweep this sprint specifically targets that failure mode across every branch, not just the ones exercised by manual testing.

**Report:** [report-sprint-08.md](./report-sprint-08.md)

---

### Sprint 9: Unit tests (Tests) — Status: ✅ Done

**Goals**
- `/tests/unit/pages/**` covering state reactions + form validation for all 13 pages, `vi.mock()` on hooks.

**Tasks**
- [x] Per page: mock the feature hook(s) + `useTranslation` (`t: k=>k`); assert loading `Skeleton`, `isError`→local fallback (layout intact), empty state, and success render. Use `getAllByText` for `DataTable`'s dual desktop+mobile jsdom render. 8 spec files (one per physical page component — the 13 routes are 5 twins + 3 products pages), 51 new tests. (#testing)
- [x] Forms (`userEvent`, not `fireEvent` — **with one documented exception below**): POS quick-add + confirm errors; product-add refines (qty0 locks pricing, qty>0 requires unit cost); order confirm INSUFFICIENT_STOCK; sales/order return qty bounds; repair intake "other"→free-text + required-field errors; payment amount>0 + record-payment Zod error. (#testing)
- [x] Twin gating tests: admin-only actions present for `scope="admin"`, absent for `scope="staff"` (orders cancel/return, sales seller/footer-total, invoices cancel action, repairs part profit). (#testing)
- [x] Scope-confinement: ADM-02's Edit action asserted as a real `<Link href=".../:id">`, not a click handler. (#testing)
- [x] **Two real, pre-existing bugs found and fixed while writing these tests** (both affect real users, not just tests):
  1. **RHF `defaultValues`-frozen-at-first-render** — `OrderConfirmDialog`, admin `ReturnOrderDialog`, sales `ReturnDialog`, `SupplierPaymentDialog`, and `RepairStatusDialog` all derive `useForm`'s `defaultValues` from a nullable prop, but the component itself never actually unmounts (it just renders `null` via `if (!x) return null` while staying in the same tree position) — so every one of these dialogs had its form fields **permanently frozen blank** after the very first render, for the entire session, once wired to real nullable state instead of a fixture. Fixed by adding a `key={target?.id ?? "none"}` at each of the 5 call sites, forcing a fresh mount (and fresh `defaultValues`) per target.
  2. **`register(field, { valueAsNumber: true })` on optional numeric fields sends `NaN`, not `undefined`, when left blank** — `AdminProductsAdd.tsx`'s `initialUnitCost`/`guestPrice`/`defaultSalePrice`/`reorderThreshold` fields all hit this: a blank optional field failed Zod's base `z.number()` check with a generic "expected number, received NaN" message, and this appears to suppress the schema's other same-object refine messages (family/brand-required) instead of showing the intended translated error. Fixed with a shared `setValueAs` helper mapping `""` → `undefined` before the number coercion.

**Validation**
- [x] Global gates. `vitest run` — **62/62 files, 451/451 tests** (400 pre-existing + 51 new), no regressions. No MSW in these unit tests (hooks mocked directly, per test-rules §5). No test files in `/src`. Each page has ≥ loading/error/success + one form/interaction assertion — confirmed per file above.

**Risks**
- Asserting translated strings instead of keys — avoided throughout (every assertion targets the mocked-identity key, never real copy). Over-mocking hiding real wiring defects — the opposite happened: writing these tests against real component behavior (not just asserting mocks were called) is what surfaced both bugs above, plus several jsdom-specific gotchas documented in report-sprint-09.md (Radix `Switch`/`Checkbox` remounting rather than updating in place on a controlled-prop flip; a native HTML `max` attribute blocking `user-event`'s realistic submit-button click before a Zod refine ever runs, requiring `fireEvent.submit` for those two specific cases).

**Report:** [report-sprint-09.md](./report-sprint-09.md)

---

## Sequencing notes & dependencies
- **Sprint 2 is the critical path:** A1 (contract+backend), A2/A3 (contract+backend), B1 hook, A4 wiring decision must land before Sprints 5–7 — otherwise wiring types don't exist.
- **Products (5) before back-office (6–7)** — highest reuse of existing shells, validates the stub→real swap and the A1 category-price path end-to-end first.
- **POS/Repairs last (7)** — most net-new UI + interaction surface.
- Wiring sprints never precede primitives (3–4). Tests (9) after Polish (8) so specs assert the final DOM.
- Commit on green each sprint: `set-03: sprint N — <topic>`.
