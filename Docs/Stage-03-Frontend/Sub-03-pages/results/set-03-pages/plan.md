# Stage 03 · Sub-03 · Set-03 — Page Assembly Plan

Back-office cluster: **POS, Orders, Sales, Invoices, Repairs** (each a staff/admin twin) plus
the **Products** admin trio (list / add / information).

| # | Page | Route | Shell | Twin of |
|---|------|-------|-------|---------|
| 1 | STF-02 POS | `/staff/pos` | Staff | — |
| 1 | ADM-05 POS | `/admin/pos` | Admin | STF-02 (unscoped, all drafts) |
| 2 | STF-04 Orders | `/staff/orders` | Staff | — |
| 2 | ADM-09 Orders | `/admin/orders` | Admin | STF-04 + cancel/return |
| 3 | STF-05 Sales | `/staff/sales` | Staff | — |
| 3 | ADM-10 Sales & returns | `/admin/sales` | Admin | STF-05 + profit/seller + return |
| 4 | STF-06 Invoices | `/staff/invoices` | Staff | — |
| 4 | ADM-14 Invoices & payments | `/admin/invoices` | Admin | STF-06 + tabs/incoming/ledgers |
| 5 | STF-07 Repairs | `/staff/repairs` | Staff | — |
| 5 | ADM-13 Repairs | `/admin/repairs` | Admin | STF-07 + profit/cost |
| 6 | ADM-02 Products list | `/admin/products` | Admin | — |
| 6 | ADM-03 Add product | `/admin/products/add` | Admin | — |
| 6 | ADM-04 Product information | `/admin/products/:id` | Admin | — |

### The twin pattern (governs clusters 1–5)

Every staff/admin pair is **one component tree** driven by a `scope: 'staff' | 'admin'` prop (the
Integration-Engine hooks already accept exactly this discriminator). We do **not** fork components.

- **Staff route** mounts the tree with `scope="staff"`; the API self-scopes to the caller.
- **Admin route** mounts the same tree with `scope="admin"`; admin-only affordances (cancel/return,
  profit/cost columns, seller filter, cross-staff drafts) are gated behind a `scope === 'admin'` (or an
  `isAdmin` derived from `usePermissions`) flag — **not** a separate page.
- Page components live once under `src/pages/staff/<feature>/`; the admin route re-exports the same
  page with `scope="admin"` (mirrors the POS spec: "Admin reuses this exact page, unscoped").

### Current state to swap (not rebuild)

`AdminOrders.tsx`, `AdminProducts.tsx`, `AdminProductInformation.tsx`, `AdminProductsAdd.tsx` already
exist wired to **Sub-01 stub hooks** (`use-admin-orders`, `use-admin-products`,
`use-admin-product-information`, `use-product-pricing`, `use-product-images`, `use-product-suppliers` —
all numeric-id view-models). Set-03 **rewires** these onto the real contract-typed Integration-Engine
hooks below and deletes the stub imports; per the Sub-03 rule we swap hooks, not the UI shells. The POS,
Sales, Invoices and both Repairs pages, plus the Staff Orders page, are **new**.

---

## 0. Resolve-First — Missing Hooks & Contract DTOs

These block a faithful build and must be triaged **before** coding. None is a HOW-conflict; they are the
"missing hooks / DTOs" list the phase file requires.

### A. Contract gaps (Stage-01 upstream — never patch locally)

| # | Gap | Blocks | Recommendation |
|---|-----|--------|----------------|
| A1 | **`AdminProductDto` has no `categoryPrices`** — it exposes only `guestPrice` + `defaultSalePrice` (`catalog.dtos.ts:55-76`). `StaffProductDto` *does* carry `categoryPrices`. | ADM-04 pricing card must **read** the 3 category prices to render margins and prefill the pricing edit form. | Extend `AdminProductResponseSchema` with `categoryPrices` (same shape as `StaffProductResponseSchema`). |
| A2 | **`BackofficeOrdersQuery` has no date range** — only `status`, `search`, `page`, `limit` (`orders/orders.query.ts:9-15`). | STF-04 / ADM-09 spec "search + date range". | Add `from`/`to` (`z.iso.date().optional()`) — or drop the date-range control (flag either way). |
| A3 | **`SaleListQuery` is `status`-only** (`sales/sales.query.ts:4-11`). | ADM-10 filter bar wants **date range, seller, POS client**; footer totals for the filtered set. STF-05 (status only) is unaffected. | Add `from`/`to`, `sellerId`, `posClientId` to `SaleListQuerySchema`. Until then, ADM-10 seller/date/client filters cannot be server-driven. |
| A4 | **No per-product Supply-history or Sales-history endpoint/DTO** — catalog exposes none; inventory only offers generic `MovementsQuery`. | ADM-04 "Supply history" and "Sales history" tabs. | Add product-scoped supply-history + sales-history read endpoints & DTOs, **or** defer those two tabs from the ADM-04 build (recommend defer-with-placeholder if the contract change slips). |

### B. Missing Integration-Engine hooks (thin Sub-02 wrappers — endpoints already exist)

| # | Missing hook | Endpoint status | Needed by | Note |
|---|-------------|-----------------|-----------|------|
| B1 | **`useRepair(id)`** (single ticket) | Endpoint param `RepairIdParamsSchema` (`:id`) already defined; only the hook is absent (`useRepairs.ts` exports list + mutations, no detail read). | ADM-13 / STF-07 ticket-detail drawer (diagnosis, parts editor, timeline). | Add a `useRepair(scope, id)` query wrapping the existing GET. |
| B2 | **`useProductMovements(id)`** | **Already satisfiable** — `useMovements({ productId })` exists and `MovementsQuery.productId` is optional-uuid (`inventory.query.ts:13`). | ADM-04 Movements tab. | No new hook required; call `useMovements({ productId })`. Listed only to make the mapping explicit. |
| B3 | **`useProductSupplies(id)` / `useProductSales(id)`** | Blocked by **A4** (no endpoint). | ADM-04 Supply/Sales tabs. | Cannot wrap until A4 lands. |

### C. Naming reconciliation (requirement label → real hook — **no gap**, just aliasing)

The requirement docs use shorthand names; the real Integration-Engine hooks are scope-parameterised:

- `useOrders(filters)` → **`useOrdersList(scope, query)`**; `useOrderStats()` → **`useOrderStats(scope)`**.
- `useMyDrafts()` → **`useSales('staff', { status: 'DRAFT' })`**; admin drawer → `useSales('admin', { status: 'DRAFT' })`.
- `useMySales(filters)` → `useSales('staff', q)`; `useAdminSales(filters)` → `useSales('admin', q)`; `useSale(ref)` → `useSale(scope, ref)`.
- `useStaffInvoices` → `useMyInvoices`; `useAdminInvoices` → `useInvoices('admin', q)`; `useRecordClientPayment` → `useCreateClientPayment`.
- `useProductStats` → `useProductStats` (catalog); `useAdminProduct(id)` → `useAdminCatalogProduct(id)`; `useUpdateProduct`/`useUpdatePricing` (catalog); `useFamilies/useBrands/useModels/useClientCategories` → `useCatalogFamilies/useCatalogBrands/useCatalogModels/useCatalogClientCategories`.
- Admin cancel command is **`AdminCancelOrderCommand = { reason?: string }`**, a documented service-local view-command (`orders.service.ts:65`), not a contract DTO — this is the established precedent; keep it.

---

## Cross-cutting decisions (apply to every cluster)

- **Layouts:** staff routes → `StaffLayout`; admin routes → `AdminLayout`. Both already exist
  (`components/layout/`). No commerce UI on either. Desktop-first; horizontal table scroll acceptable.
- **Access:** wrap each route in `RoleGuard(<PAGE_KEY>)` (`STAFF_POS`, `STAFF_ORDERS`, `STAFF_SALES`,
  `STAFF_INVOICES`, `STAFF_REPAIRS`); admin variants are unrestricted within `AdminLayout`. POS grants
  `STAFF_PRODUCTS` implicitly (spec) — rely on the backend grant, no client-side special-casing.
- **Granular states (every hook):** `isLoading` → a shape-matched Shadcn `Skeleton` (reuse
  `TableSkeleton`, `StatCardSkeleton`); `isError`/404 → local `<NotFoundState />` / `<EmptyState />`
  **inside** the content area, never a full-page swap. Layout persists through all states.
- **Forms:** RHF + `zodResolver`, schema imported from `@app-template/contract` (never re-declared).
  Server field errors (`INSUFFICIENT_STOCK`, `CREDIT_REQUIRES_CLIENT`, `PRICING_REQUIRES_STOCK`,
  SKU/barcode uniqueness) map onto the named field/zone via `setError`.
- **i18n:** no inline strings; keys `<scope>.<feature>.<element>` in `translations.json` (`en`/`fr`
  real, `ar` `""`). Reuse existing keys where present.
- **Mutations invalidate** exactly the query keys named in each requirement; never hand-mutate cache.
- **Reuse first:** `DataTable`, `PageHeader`, `StatCard`, `StatusBadge`, `MoneyStatusCard`,
  `SimplePagination`, `EmptyState`, `NotFoundState`, `CancelOrderDialog`, `autocomplete-input`,
  `image-management`, `drag-drop-area` all already exist in `components/shared/`.
- **Optimization:** every route is `React.lazy()` + `<Suspense fallback={<PageLoader />}>`. `useMemo`
  only for the POS ticket totals and the DataTable column defs (hot re-render); `useCallback` on row
  action handlers passed to `DataTable`.
- **Tests:** `/tests/unit/pages/<page>/*.spec.tsx`, `vi.mock()` the feature hook, mock
  `useTranslation` (`t: k => k`), assert state reactions (skeleton, empty, error) + form Zod errors with
  `userEvent`. No MSW here. Never place tests in `/src`.

---

## Cluster 1 — POS (STF-02 `/staff/pos` = ADM-05 `/admin/pos`)

One two-pane component, `scope`-driven. Admin mount shows **everyone's** drafts grouped by staff.

### 1. Hook & Data Mapping
- `useStaffProducts(query)` *(admin: `useAdminCatalogProducts(query)`)* — left search + family quick-pick → `['staff','products',search]`.
- `usePosClientSearch(q)` → `['pos-clients','search',q]`; quick-add → `useQuickCreatePosClient()`.
- Drafts drawer: `useSales(scope, { status: 'DRAFT' })` → `['sales','me','DRAFT']` (staff) / `['sales','admin','DRAFT']` (admin, grouped by staff in the mapper).
- Mutations: `useCreateDraft()` / `useUpdateDraft()` (PATCH-on-change) / `useConfirmSale()` — confirm invalidates `['sales','me']`, `['staff','products']`, `['staff','dashboard']`.
- Taxonomy for quick-pick grid: `useCatalogFamilies()`.

### 2. UI Components
- **Shared:** `PageHeader`, `EmptyState`, `NotFoundState`, `autocomplete-input`, Shadcn `command`/`drawer`/`dialog`/`input`.
- **New** (`pages/staff/pos/components/`): `PosProductSearch` (F2 barcode focus), `FamilyQuickPickGrid`, `PosTicket` (line rows: name · qty stepper · resolved vs editable charged price · line total · serials · remove), `PosClientAttachZone`, `PosPaymentPanel` (F4: paid, change-due / new-credit preview), `MyDraftsDrawer`, `PosReceiptView` (total · prev credit · grand total · paid · new credit + print), `QuickAddClientDialog`.

### 3. Granular States
- Product search loading → inline list `Skeleton`; empty → `EmptyState`.
- Drafts drawer loading → row `Skeleton`; error → local retry chip; empty → "no drafts".
- Confirm in-flight → button `isPending` spinner; the ticket panel never unmounts.

### 4. Forms & Mutations
- **Draft:** `SaleDraftCommand` (`sales.command.ts`), built incrementally, PATCH via `useUpdateDraft`.
- **Quick-add client:** `CreatePosClientCommand` (`clients.command.ts`) dialog, RHF + zodResolver → `useQuickCreatePosClient`.
- **Confirm:** `ConfirmSaleCommand { paidAmount }` → `useConfirmSale`. Underpayment w/ no client → `CREDIT_REQUIRES_CLIENT` on the attach zone; stock shortfall → `INSUFFICIENT_STOCK` on the named line.
- Re-resolution: attaching a POS client re-resolves all lines to his category price (delta visible); detach reverts. Per-line override edits `unitPrice`, `resolvedPrice` stays shown.

### 5. Optimization
- `useMemo` ticket totals (qty × price, discount, grand total). `useCallback` scan/increment handlers. Barcode `F2` / payment `F4` / confirm `Enter` via a keydown handler (reuse `use-keyboard-navigation`).

### 6. Unit-Test Strategy
`pos.spec.tsx`: mock `useStaffProducts`/`useSales`/`usePosClientSearch`/`useConfirmSale`. Assert: scan adds/increments a line (qty capped at available); attach client re-resolves prices; confirm underpayment with no client surfaces `CREDIT_REQUIRES_CLIENT`; DRAFT save doesn't call confirm; receipt renders after success. `quick-add-client.spec.tsx`: Zod errors on empty name/phone.

### 7. Acceptance Criteria
Scan→ticket→attach client→override price→save draft→reopen→confirm→receipt+print all work with real hooks; admin mount shows all staff drafts grouped; layout survives every loading/error state; no inline strings.

---

## Cluster 2 — Orders (STF-04 `/staff/orders` / ADM-09 `/admin/orders`)

Shared tree; admin adds cancel + return. **Rewire** existing `AdminOrders.tsx` off `use-admin-orders`.

### 1. Hook & Data Mapping
- `useOrdersList(scope, BackofficeOrdersQuery)` → `['orders',filters]`; `useOrderStats(scope)` → `['orders','stats']`.
- Mutations (both): `useConfirmOrder()`, `useUpdateOrderStatus()`. **Admin-only:** `useAdminCancelOrder()`, `useReturnOrder()`. All invalidate `['orders']`, `['orders','stats']`, `['staff','dashboard']` (admin also `['inventory','*']`, `['invoices','admin']`, `['admin','dashboard']`).

### 2. UI Components
- **Shared:** `StatCard`, `DataTable`, `StatusBadge`, `PageHeader`, `CancelOrderDialog` (already in shared), `SimplePagination`.
- **New/rewire** (`pages/staff/orders/components/`): `OrderStatsRow` (pending/confirmed/in-delivery), `OrderStatusTabs` (default PENDING) + search + date range, `OrdersTable` (ref, client/contact name·phone·wilaya, product, qty, type, total, status, date, **age flag** pending>24h), `OrderShowDialog` (read-only line w/ frozen price + live availability re-check, contact, delivery, timeline), `OrderConfirmDialog`, `OrderStatusDialog`; **admin-only** `ReturnOrderDialog` (reuse existing `admin-order-*` where present).

### 3. Granular States
- Stats → `StatCardSkeleton`×3; table → `TableSkeleton`; empty tab → `EmptyState`; dialog fetch error → inline `NotFoundState`. Tabs/search/date bar always rendered.

### 4. Forms & Mutations
- **Confirm:** `ConfirmOrderCommand` (optional charged-price adjust + serials + paidAmount) → `useConfirmOrder`; 409 stock shortfall names the gap line.
- **Status:** `UpdateOrderStatusCommand` — `deliveryCompany`/`trackingNumber` required-by-refine for IN_DELIVERY; COMPLETED stamps `deliveredAt`.
- **Admin Return:** `ReturnOrderCommand` (qty ≤ ordered, restock toggle, refund amount, reason?). **Admin Cancel:** `AdminCancelOrderCommand { reason? }` via `useAdminCancelOrder`.
- Forward-state buttons (PENDING→…→COMPLETED) present for both; Cancel/Return **absent for staff**.

### 5. Optimization
- `React.lazy` route; `useMemo` column defs; `useCallback` row actions. Age-flag derived in the row mapper (no memo needed).

### 6. Unit-Test Strategy
`orders.spec.tsx`: mock `useOrdersList`/`useOrderStats`/mutations. Assert default PENDING tab, age flag on >24h pending, confirm surfaces `INSUFFICIENT_STOCK`, IN_DELIVERY refine requires delivery+tracking. `orders-admin.spec.tsx`: cancel/return dialogs render for `scope="admin"` and are **absent** for `scope="staff"`.

### 7. Acceptance Criteria
Staff can advance all forward states, cannot cancel/return; admin can; confirm is idempotent (double-click safe); date-range filter present **iff** A2 resolved (else omitted with a noted TODO).

---

## Cluster 3 — Sales (STF-05 `/staff/sales` / ADM-10 `/admin/sales`)

Shared table + detail drawer; admin adds seller/profit columns, footer totals, and returns.

### 1. Hook & Data Mapping
- `useSales(scope, SaleListQuery)` → `['sales','me',filters]` / `['sales','admin',filters]`; `useSale(scope, reference)` → `['sales',reference]` (403 view if not his — defense in depth).
- **Admin-only** mutation: `useCreateReturn()` → invalidates `['sales','admin']`, `['inventory','*']`, `['pos-clients']`.

### 2. UI Components
- **Shared:** `DataTable`, `StatusBadge`, `SimplePagination`, `drawer`.
- **New** (`pages/staff/sales/components/`): `SalesFilters` (status; **admin adds** date range, seller, POS client), `SalesTable` (ref, date, POS client/"Comptoir", total, paid, status; **admin adds** seller col + filtered-set footer totals), `SaleDetailDrawer` (lines resolved vs charged, serials, receipt figures, reprint; **admin adds** cost-of-goods + profit per line, credit snapshot prev→new, invoice link, **Issue return**), `ReturnDialog` (admin: per-line qty ≤ sold − returned, restock toggle, refund amount default=charged reducible, type refund/exchange, reason?).
- **Staff mapping omits** profit/cost + return action.

### 3. Granular States
- Table → `TableSkeleton`; empty → `EmptyState`; drawer fetch → inline `Skeleton`; 403 → localized "not yours" panel inside drawer.

### 4. Forms & Mutations
- `CreateReturnCommand` (`sales.command.ts`) via RHF + zodResolver; per-line bounds validated server-side too. DRAFT rows link into the POS to finish; reprint renders stored receipt (no form).

### 5. Optimization
- `React.lazy`; `useMemo` for the admin footer totals over the filtered set + column defs.

### 6. Unit-Test Strategy
`sales.spec.tsx`: mock `useSales`/`useSale`. Assert staff mapping has **no** profit/return; admin mapping shows profit + seller + footer totals + return button. `return-dialog.spec.tsx`: qty > sold−returned → Zod error; refund defaults to charged price.

### 7. Acceptance Criteria
Staff list scoped to own sales, no profit/return; admin sees seller + profit + totals + working return that flips status to (PARTIALLY_)RETURNED. Seller/date/client filters server-driven **iff** A3 resolved (else client-side over the current page, noted).

---

## Cluster 4 — Invoices (STF-06 `/staff/invoices` / ADM-14 `/admin/invoices`)

Staff = single "outgoing (mine)" table. Admin = three tabs (Outgoing / Incoming / Payments).

### 1. Hook & Data Mapping
- **Staff:** `useMyInvoices(InvoiceListQuery)` → `['invoices','staff',filters]`; `useMyInvoice(number)`; `useMyInvoicePdf()`.
- **Admin Outgoing:** `useInvoices('admin', q)` → `['invoices','admin',filters]`; `useInvoice('admin', number)`; `useInvoicePdf()`; `useCancelInvoice()`.
- **Admin Incoming:** `usePurchasingInvoices(SupplierInvoiceListQuery)` (read-only).
- **Payments ledgers:** `useClientPayments(q)` + `usePurchasingPayments(q)`.
- Mutations: `useCreateClientPayment()` (invalidates `['invoices','staff'|'admin']`, `['pos-clients']`); admin supplier payment `useCreatePurchasingPayment()` (invalidates `['suppliers']`); `useCancelInvoice()` (invalidates invoice keys).

### 2. UI Components
- **Shared:** `DataTable`, `StatusBadge`, `MoneyStatusCard`, `Tabs`, `SimplePagination`.
- **New** (`pages/staff/invoices/components/`): `InvoicesTable` (number, date, client, source, total, paid, status), `InvoiceSnapshotView` (snapshot lines + serials; **admin adds** cost+profit per line, prev/new credit, current avg cost joined per row) + PDF/print, `RecordPaymentDialog` (previews prev credit → new credit before submit, echoes after). **Admin-only:** `IncomingInvoicesTable` (supplier, date, total, paid, outstanding, due date, overdue flag), `PaymentsLedger` (client & supplier: reference, counterpart, invoice/"on account", amount, prev→new credit, date, staff), `SupplierPaymentDialog`.

### 3. Granular States
- Each tab independently: `TableSkeleton` / `EmptyState` / inline error. Snapshot fetch → `Skeleton`. Tabs bar always rendered.

### 4. Forms & Mutations
- `CreateClientPaymentCommand` (`billing.command.ts`): amount > 0, invoice preselected → `useCreateClientPayment`. Admin `CreateSupplierPaymentCommand` (`purchasing.command.ts`) → `useCreatePurchasingPayment`. Both RHF + zodResolver, preview credit movement.

### 5. Optimization
- `React.lazy`; admin tabs each `lazy`/gated so Incoming & Payments queries don't fire until their tab opens (matches "lazy per tab" intent).

### 6. Unit-Test Strategy
`invoices.spec.tsx`: staff table scoped to issued invoices; `record-payment-dialog.spec.tsx`: amount ≤ 0 → Zod error, prev→new credit preview updates on input. `invoices-admin.spec.tsx`: three tabs, cancel action present, incoming read-only (no actions).

### 7. Acceptance Criteria
Staff sees only invoices he issued + record-payment; admin gets Outgoing/Incoming/Payments with cancel, supplier payments, and credit-movement previews; PDF + print work; numbers never reused on cancel.

---

## Cluster 5 — Repairs (STF-07 `/staff/repairs` / ADM-13 `/admin/repairs`)

Shared kanban board + intake + ticket detail; admin mapping adds profit/cost; staff scoped to own tickets.

### 1. Hook & Data Mapping
- `useRepairs(scope, RepairListQuery)` → `['repairs',filters]` (status + technicianId filters).
- **`useRepair(scope, id)`** → ticket detail — **must be added (B1)**.
- `useTechnicians()` (from `useIdentity`) → `['technicians']`.
- Mutations: `useCreateRepair()`, `useUpdateRepair()` (diagnosis), `useAddRepairPart()`, `useRemoveRepairPart()`, `useUpdateRepairStatus()` — invalidate `['repairs']`, `['inventory','*']`; PICKED_UP also `['sales','admin']`.

### 2. UI Components
- **Shared:** `StatusBadge`, `dialog`, `command`/`autocomplete-input` (product picker), `EmptyState`, `NotFoundState`.
- **New** (`pages/staff/repairs/components/`): `RepairBoard` (kanban INTAKE→PROCESSING→COMPLETED→PICKED_UP + CANCELLED lane; cards: ref, customer, device, technician, age, unpaid badge; technician filter), `IntakeDialog` (name+phone or attach POS client prefill, brand+model selects w/ free-text fallback, IMEI?, reported-issues multi-select incl. "other"→free-text, technician; prints claim slip), `RepairTicketDetail` (device/customer, diagnosis editable in PROCESSING, **parts editor** product picker+qty+charged price+serials? live availability, labour price, totals, timeline; **admin adds** profit/cost), status-transition drag handler.

### 3. Granular States
- Board columns loading → card `Skeleton`s per lane; empty lane → placeholder; ticket detail fetch → `Skeleton`; rejected drag → snap-back + toast with server error.

### 4. Forms & Mutations
- `CreateRepairCommand`, `AddRepairPartCommand`, `RepairStatusCommand` (`repairs.command.ts`) — RHF + zodResolver. Refines: technician required for PROCESSING; `paidAmount` for PICKED_UP; `consumedPartReturns` for post-consumption CANCELLED. COMPLETED consumes parts (409 names the product); PICKED_UP opens cash payment dialog + records the repair sale.

### 5. Optimization
- `React.lazy`; drag state local; `useMemo` for per-lane grouping of the repairs list.

### 6. Unit-Test Strategy
`repairs.spec.tsx`: mock `useRepairs`/`useRepair`/`useTechnicians`/mutations. Assert lane grouping, technician filter, drag→status transition + snap-back on rejection, PROCESSING refine requires technician, PICKED_UP opens payment dialog. `intake-dialog.spec.tsx`: reported-issues "other" reveals free-text; Zod errors on missing name/phone. Assert **staff mapping omits profit/cost**.

### 7. Acceptance Criteria
Board drag transitions validated server-side; intake prints claim slip; parts editor reserves + checks availability live; staff scoped to own tickets w/o profit; admin sees profit/cost. Requires **B1 (`useRepair(id)`)** landed.

---

## Cluster 6 — Products (admin-only trio) — **rewire off Sub-01 stubs**

### 6a. ADM-02 Products list (`/admin/products`)

**1. Hooks:** `useAdminCatalogProducts(ProductListQuery)` → `['admin','products',filters]`; `useProductStats()` → `['admin','products','stats']`; `useUpdateProduct()` for publish/enable optimistic toggles (invalidates both keys). Cascading filter selects: `useCatalogFamilies()`, `useCatalogBrands()`, `useCatalogModels({...}, admin)`.
**2. UI:** *Shared* `PageHeader`+Add button, `StatCard`, `DataTable`, `StatusBadge`, `SimplePagination`. *Rewire* existing `admin-products-*` components off stub hooks. Table cols: image, product, barcode, taxonomy, on hand, reserved, **available**, avg cost, stock badge, published toggle, enabled toggle (all present on `AdminProductDto`).
**3. States:** `StatCardSkeleton`×4, `TableSkeleton`, `EmptyState`.
**4. Forms:** none — toggles are single-field PATCHes via `useUpdateProduct` (optimistic + rollback on error). Search fires the staff-search beacon (reuse existing beacon util).
**5. Optimization:** `React.lazy`; `useMemo` column defs; optimistic toggle handlers via `useCallback`.
**6. Tests:** `products-list.spec.tsx`: stats + table render; toggle calls `useUpdateProduct` and rolls back on error; row Edit navigates to `/admin/products/:id` (assert `<Link>` only — scope confinement).
**7. Done:** list filters/paginates on real hooks; toggles optimistic; no stock-entry UI.

### 6b. ADM-03 Add product (`/admin/products/add`)

**1. Hooks:** `useCatalogFamilies()`, `useCatalogBrands()`, `useCatalogModels({ brandId }, admin, { enabled: !!brandId })`, `useCatalogClientCategories()`; inline-create → `useCreateCatalogFamily/Brand/Model`; submit → `useCreateProduct()` (invalidates `['admin','products']` + stats).
**2. UI:** single column of cards — *New* `BasicInfoCard` (barcode + auto-generate, auto-name "family brand model" editable via `use-product-name-generation`, family/brand/model comboboxes w/ **inline create**, description), `InitialStockCard` (initialQuantity default 0; >0 reveals required `initialUnitCost` and unlocks Card 3), `PricingCard` (locked at qty 0 w/ note; guestPrice helper, defaultSalePrice*, 3 category prices each w/ live margin % vs entered cost, reorderThreshold), `ImagesCard` (reuse `image-management`/`drag-drop-area`, max 3, primary flag, reorder), `ConfirmationDialog` recap.
**3. States:** taxonomy selects → inline `Skeleton`; submit → `isPending` on confirm.
**4. Forms:** `CreateProductCommand` (`catalog.command.ts`) RHF + zodResolver — refines already in schema: `initialUnitCost` required iff qty>0; pricing forbidden iff qty=0 (mirrors `PRICING_REQUIRES_STOCK`). Multipart submit; SKU/barcode uniqueness → field errors; success → navigate to ADM-04 of new product.
**5. Optimization:** `React.lazy`; auto-name recompute stops after manual edit (local state flag, no memo).
**6. Tests:** `products-add.spec.tsx`: qty 0 keeps pricing locked; qty>0 requires unit cost (Zod); inline taxonomy create selects new entity; success navigates to new product. Margin % recomputes on price/cost change.
**7. Done:** full create flow on real hooks incl. inline taxonomy + images + confirmation; server refines surfaced on fields.

### 6c. ADM-04 Product information (`/admin/products/:id`)

**1. Hooks:** `useAdminCatalogProduct(id)` → `['admin','products',id]`; Movements tab → `useMovements({ productId: id })` (B2, exists); pricing edit → `useUpdatePricing()`; core edit → `useUpdateProduct()`; images → `useAddProductImages()`/`useUpdateProductImages()`. **Supply-history + Sales-history tabs blocked by A4/B3.**
**2. UI:** *Rewire* existing `product-*` components off stubs. Header (name+barcode, back, edit toggle); cards: details, images, pricing (guest+default+3 category prices, margin vs avg cost — **needs A1**), stock card (on hand, reserved, available, avg cost, stock value = onHand×avgCost derived, threshold); tabs Movements (IN=layer remaining; OUT=cost+profit; row→source doc), Supply history, Sales history (independent pagination).
**3. States:** product fetch → card `Skeleton`s + `NotFoundState` on 404; each tab table → own `TableSkeleton`, lazy per tab.
**4. Forms:** Details = subset of `CreateProductCommand` → `useUpdateProduct` (PATCH); Pricing = `UpdatePricingCommand` → `useUpdatePricing`; edit-mode section pattern (one header Edit/Save/Cancel; Save patches core + pricing separately; Cancel restores).
**5. Optimization:** `React.lazy`; tabs mount their query only when active (lazy).
**6. Tests:** `product-information.spec.tsx`: edit toggle turns cards to forms; Save calls the right mutation; Cancel restores; Movements tab renders from `useMovements`; 404 → `NotFoundState`. Guard the pricing-card assertions behind A1.
**7. Done:** view/edit core + pricing + images + Movements tab on real hooks. **Supply/Sales tabs render a "pending contract endpoint" placeholder until A4/B3 land** (or are built if the contract change ships first). Pricing card requires **A1**.

---

## Build order recommendation

1. **Land the resolve-first list** — A1 (admin category prices), B1 (`useRepair(id)`); triage A2/A3/A4 (add fields vs. defer controls).
2. **Products trio** (6a→6b→6c) — highest reuse of existing shells; unblocks the swap-off-stubs work.
3. **Orders** (rewire staff+admin) → **Sales** → **Invoices** → **Repairs** → **POS** (POS last: most net-new UI and keyboard/interaction surface).
4. Per page: wire hooks → granular states → forms → unit tests → acceptance check.

## Expected outputs recap
- This plan. **Resolve-first blockers:** contract A1–A4, hooks B1 (B2 already satisfiable, B3 blocked by A4).
- Everything else maps cleanly onto existing Integration-Engine hooks; admin Orders/Products pages are hook-swaps, not rebuilds.
