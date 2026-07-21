# Stage 03 · Sub-03 · Set-04 — Page Assembly Sprints

Inside-out build of the remaining admin pages (ADM-06/07/08/11/12/12b/15/16/17/18/19).
Layer order per the phase file: **Foundation → Primitives & States → Assembly & Wiring →
Polish → Tests.** Wiring (Sprint 5+) never precedes primitives (Sprints 3–4). **No code in this
document.**

## Strategy

- **One backend + contract change only (A2).** It is the *first* task of Sprint 1 so the frontend
  never blocks: add `newThisMonth` to `ClientStatsResponseSchema`, rebuild the contract, extend the
  admin-client stats service + its unit test. A1 and A3 need no backend work (plan §0).
- **Five pages are rewires, five are new.** Rewires (suppliers, clients, statistics, settings,
  logs) keep their existing shells; Sprints 3–4 retype their props from `draft-types` view-models
  to contract DTOs, and the wiring sprints swap the hook imports. The new pages (inventory,
  supplier-invoices, pos-clients, client-detail, users, staff-searches) are built shell-first in
  the primitive sprints, wired in the assembly sprints.
- **Stub teardown is deferred to Polish (Sprint 9)** behind a grep gate, so no page loses its data
  source mid-flight (a rewired page must be green on the real hook before its stub is deleted).
- **Standing validation every sprint:** no inline strings (all text via `useTranslation`), no
  `useEffect` fetching, `tsc --noEmit` clean, layout survives `isError`, `vitest run` green, no
  tests in `/src`, commit on green.

---

### Sprint 1: Schemas, i18n & the A2 contract/API change (Foundation) — Status: ✅ Done

**Goals**
- Every form's Zod wrapper exists and type-checks against `@dragon-telecom/contract`.
- All `admin.*` translation keys for the ten pages present (`en`/`fr` real, `ar` `""`).
- A2 landed end-to-end (contract field + stats service) so ADM-12's 4th card can wire later.

**Tasks**
- [x] **(#backend/contract, A2)** Add `newThisMonth: z.number().int().min(0)` to `ClientStatsResponseSchema` (`Apps/contract/src/modules/clients/clients.dtos.ts`); rebuild `@dragon-telecom/contract`. In `Apps/api` admin-client stats handler, compute `newThisMonth = count(clients WHERE createdAt >= startOfMonth(now))`; update its service unit test + a fixture. No route/verb change.
- [x] **(#schema)** Co-locate command-wrapping schemas (wrap contract commands; only UI-local refines): `adjustment.schema.ts` (IN-delta `unitCost` required), `supplier-invoice.schema.ts` (amountOnly XOR lines + per-line positive qty/cost), `pos-client.schema.ts`, `approve-client.schema.ts` (username server-error target), `reset-client-password.schema.ts` (min-length + confirm match), `user.schema.ts` (type/roleIds refine — roleIds iff STAFF), `role.schema.ts` (+ `SetRolePagesCommand`), settings per-tab schemas (`store`, `invoicing`, `client-category`, taxonomy commands, `UpsertFeesCommand`), supplier create/update wrappers.
- [x] **(#i18n)** Add keys to `src/config/translations.json` for all ten pages under `admin.inventory.*`, `admin.suppliers.*`, `admin.supplierInvoices.*`, `admin.posClients.*`, `admin.clients.*`, `admin.statistics.*`, `admin.users.*`, `admin.settings.*`, `admin.logs.*`, `admin.staffSearches.*`; reuse existing `common.*` keys. `ar` = `""`.
- [x] **(#testing)** Contract schema `.parse()` round-trip tests for each new wrapper live in `/tests`; A2 stats service test green.

**Validation** — standard checklist. Additionally: contract builds; `newThisMonth` visible in the rebuilt package types; no inline strings introduced.

**Risks** — schema drift if a wrapper re-declares a contract shape instead of wrapping it; A2 stats query using local time vs UTC month boundary (match the backend's existing date convention).

---

### Sprint 2: Routes, guards & lazy registration (Foundation) — Status: ✅ Done

**Goals**
- Seven new routes mounted under `AdminLayout`, code-split; existing five untouched but confirmed.
- No new hooks needed — this sprint proves that (mapping check), adds none.

**Tasks**
- [x] **(#wiring)** In `App.tsx`, add `React.lazy()` + `withSuspense()` routes: `/admin/inventory`, `/admin/supplier-invoices`, `/admin/supplier-invoices/:id`, `/admin/pos-clients`, `/admin/clients/:id`, `/admin/users`, `/admin/activity/staff-searches`. Keep the single `RoleGuard allow={[ADMIN, STAFF]}` shell + page-registry gating (plan §Access); attach `RouteErrorBoundary` to each.
- [x] **(#wiring)** Add nav entries (where the admin sidebar/registry lists pages) for the seven new routes; verify staff-registry keys exist so "admin only" holds.
- [x] **(#wiring)** Hook-inventory check: confirm each page's `use[Name]` exists (`useInventory`, `usePurchasing*`, `usePosClients`, `useSales`, `useBilling`, `useClientDirectory`, `useObservability`, `useIdentity`, `useStatistics`, `usePlatform`, `useCatalogTaxonomy`, `useClientCategories`, `useCatalogProducts`). Record the confirmation; add **no** new hook.
- [x] **(#testing)** Smoke render each new route with mocked hooks returning `isLoading` → shows a skeleton within `AdminLayout`, no crash.

**Validation** — standard checklist. Additionally: navigating to each new route renders the shell + a skeleton (not a blank/error); `tsc` clean.

**Risks** — route-order/`:id` collisions (`/admin/clients/:id` vs `/admin/clients`; `/admin/supplier-invoices/:id` vs `/new` preselect param — use a query param, not a `new` segment, to avoid a route clash).

---

### Sprint 3: Shared & DTO-typed primitives; rewire-shell retyping (Primitives & States) — Status: ✅ Done

**Goals**
- Reused shared composites confirmed sufficient; the five rewire shells' props retyped to contract DTOs (still on stub data, compiling).

**Tasks**
- [x] **(#ui)** Confirm/extend shared primitives (no new lib): `DataTable`, `StatCard`, `StatCardSkeleton`, `TableSkeleton`, `MoneyStatusCard`, `StatusBadge`, `SimplePagination`, `EmptyState`, `NotFoundState`, `AgeFlag`, `CreditMovementPreview`, `ResolvedVsChargedPrice`, `autocomplete-input`, `admin-search-input`, `excel-file-uploader`, `image-management`, `drag-drop-area`.
- [x] **(#ui)** Retype the rewire shells' component props from `draft-types` view-models to the contract DTOs (`SupplierDto`/`SupplierDetailDto`, `AdminClientDto`/`ClientStatsDto`, statistics DTOs, `SettingsDto`/taxonomy DTOs, `AuditLogDto`/`LogStatsDto`) — **presentational only**, hooks swapped in the wiring sprints. Keep them compiling against mock props.
- [x] **(#testing)** Component-level render tests for any newly retyped shared primitive that changed shape.

**Validation** — standard checklist. Additionally: retyped shells compile with contract-DTO props; no `draft-types` import newly added.

**Risks** — a DTO field the old view-model exposed differently (numeric id → uuid string; `credit` number vs formatted string) surfaces here — fix at the presentational layer, not by casting.

---

### Sprint 4: Page-local primitives, Skeletons & local fallbacks (Primitives & States) — Status: ✅ Done

**Goals**
- Every new page's dumb components, tab scaffolds, skeletons, and local error/empty fallbacks exist (no data yet).

**Tasks**
- [x] **(#ui)** Inventory: `stock-levels-table`, `movement-ledger-table`, `reservations-table`, `adjustment-form` + `adjustment-line-editor`, `inventory-filters`, per-tab skeletons.
- [x] **(#ui)** Supplier invoices: `supplier-invoices-table`, `invoice-header-form`, `amount-only-switch`, `invoice-line-editor`, `inline-create-product-dialog`, `confirm-bar`, `reprice-prompt`, `record-payment-dialog`.
- [x] **(#ui)** POS clients: `pos-clients-table`, `add`/`edit-pos-client-dialog`, `pos-client-detail-drawer` (Sales/Payments/Credit tabs scaffold).
- [x] **(#ui)** Client detail: `client-detail-header`, tab set (Overview/Orders/Invoices/Payments/Browsing), `approval-dialog`, `reset-password-dialog`, `browsing-activity-table`.
- [x] **(#ui)** Users: `users-table`, `user-dialog` (type switch + live effective-page list), `roles-table`, `role-dialog` (grouped permission matrix). Staff-searches: `staff-search-filters` + table. Settings new tab forms (`store`, `invoicing`, `categories-table`, `hierarchy-panel`, `storefront` featured-only w/ deferral note).
- [x] **(#ui)** For every page/tab: a shape-matched Shadcn `Skeleton` (reuse `TableSkeleton`/`StatCardSkeleton`) and a local `<NotFoundState />`/`<EmptyState />` **inside** the content area.
- [x] **(#testing)** Render each primitive in isolation with static props; assert skeleton and empty states render.

**Validation** — standard checklist. Additionally: every page renders skeleton + empty + error **without** the shell/tab bar/filter bar disappearing.

**Risks** — `DataTable` renders desktop + mobile simultaneously in jsdom (use `getAllByText` in tests — set-02 note); tab scaffolds must not fetch on mount (lazy `enabled`).

**Outcome** — see `report-sprint-04.md`. All page-local primitives built across ten pages; `AdminSettings.tsx` now renders all six tabs (Categories/Delivery/Store/Invoicing/Hierarchy/Storefront) on placeholder state. `product-hierarchy-section.tsx` rebuilt as `hierarchy-panel.tsx` (Sprint 3 deferral). One Sprint-2 route-smoke expectation (`/admin/clients/:id` titleKey) was stale against the real Sprint-4 body and corrected to assert the actual NotFoundState copy. `tsc`/`eslint`/`vitest run` all green (552 tests); ~10.2k pre-existing `draft-types` lint noise confirmed untouched.

---

### Sprint 5: Wiring — Inventory, POS clients, Staff searches (Assembly & Wiring) — Status: ⬜ Pending

**Goals**
- Three read-heavy pages live on real hooks with granular states + their forms.

**Tasks**
- [ ] **(#wiring)** Inventory: `useStock`/`useMovements`/`useReservations` + filters; `useCreateAdjustment` (RHF, invalidates the three inventory keys + `qk.catalog.adminProducts`); `useExportStockCsv`; reference cells as `<Link>`.
- [ ] **(#wiring)** POS clients: `usePosClientsList` + `useCreatePosClient`/`useUpdatePosClient`; detail drawer tabs via `useSales('admin',{posClientId})` + `useClientPayments({posClientId},{enabled})`; **credit-history tab = `useMemo` merge** of those rows on `previous→new` credit + date. Drawer headline from the clicked row (no re-fetch).
- [ ] **(#wiring)** Staff searches: `useStaffSearches` + filters; product link `<Link>` → ADM-04 movements tab.
- [ ] **(#testing)** Wiring smoke: mocked hooks drive success/loading/error for each; adjustment form posts.

**Validation** — standard checklist (success/loading/error via `vi.mock`).

**Risks** — credit-merge ordering when a sale and payment share a timestamp (define a stable tiebreak); reservation `age` derivation reads server time, not client clock.

---

### Sprint 6: Wiring — Suppliers (rewire) & Supplier invoices (new) (Assembly & Wiring) — Status: ⬜ Pending

**Goals**
- Purchasing cluster fully on `usePurchasing*`; the DRAFT→confirm→reprice flow works.

**Tasks**
- [ ] **(#wiring)** Suppliers list: swap to `usePurchasingSuppliers` + `usePurchasingSupplierStats`; detail: `usePurchasingSupplierDetail` (invoices/payments/productHistory); `useCreate/UpdatePurchasingSupplier` (incl. `initialCredit`, disable). "Add invoice" → `<Link>` to the editor with `?supplierId=`.
- [ ] **(#wiring)** Supplier invoices list: `usePurchasingInvoices` + filters. Editor: `usePurchasingInvoiceDetail`, `useCreate/UpdatePurchasingInvoice`, `useConfirmPurchasingInvoice` (invalidates purchasing + inventory + admin products), `useCancelPurchasingInvoice`; `useCreatePurchasingPayment` w/ `CreditMovementPreview`; inline create-product `useCreateProduct`; reprice `useUpdatePricing` per product.
- [ ] **(#wiring)** Wire the amountOnly-XOR-lines form, live footer math (landed unit cost / projected new avg cost), 409-after-confirm inline surface.
- [ ] **(#testing)** Mocked-hook wiring smoke for both pages incl. confirm→reprice reveal.

**Validation** — standard checklist.

**Risks** — `/admin/supplier-invoices/:id` vs `?supplierId=new` route clash (Sprint 2 decision); confirm mutation invalidation set must exactly match the plan to avoid stale inventory.

---

### Sprint 7: Wiring — Web clients (rewire), Client detail (new), Users & roles (new) (Assembly & Wiring) — Status: ⬜ Pending

**Goals**
- Client directory + detail + identity management live on real hooks; A2 card wired.

**Tasks**
- [ ] **(#wiring)** Clients list: swap to `useClientDirectory` + `useClientDirectoryStats` (wire the **`newThisMonth`** card from A2); `useApproveClient`/`useRejectClient`/`useUpdateClientDirectoryEntry` (invalidate `['clients','admin']`, `['pos-clients']`, dashboard/stats). `approval-dialog` mandatory category + username server-error placement; no create button.
- [ ] **(#wiring)** Client detail: `useClientDirectoryEntry`; `useResetClientPassword` (no invalidation, warning banner); browsing tabs via `useClientActivity(id, query)` lazy per tab; browsing rows `<Link>` to product.
- [ ] **(#wiring)** Users & roles: `useUsers`/`useRoles`/`usePages({scope:'staff'})`; `useCreate/UpdateUser`, `useCreate/UpdateRole`, `useSetRolePages`. Type switch enforces the roleIds refine; effective-page list = `useMemo(selectedRoles × pages)`; last-admin guard → inline banner; system roles read-only.
- [ ] **(#testing)** Mocked-hook wiring smoke; type-switch + effective-list behavior; approval flow.

**Validation** — standard checklist.

**Risks** — effective-page derivation depending on `RoleDto.pages` shape (verify it carries page ids); approve atomicity is server-side — the row-flip is optimistic only via invalidation, not manual cache edits.

---

### Sprint 8: Wiring — Statistics, Settings, Audit logs (all rewire) (Assembly & Wiring) — Status: ⬜ Pending

**Goals**
- The three remaining rewire pages live on real hooks with per-widget/per-tab states.

**Tasks**
- [ ] **(#wiring)** Statistics: swap to `useOverview`/`useFiltered`/`useChart`/`useTopProducts`/`useReport` + `useExportReportCsv`; URL-synced `dateRange`/`familyId` via `useSearchParams`; per-widget independent states; report-picker (chart + `DataTable` + CSV); drill ids as `<Link>`.
- [ ] **(#wiring)** Settings: `usePlatformSettings`/`useUpdatePlatformSettings` (Store/Invoicing/Storefront featured-only); `useAdminDeliveryFees`/`useUpsert/Import/ExportAdminDeliveryFees` (import dry-run report, invalidates `['wilayas']`); categories via `useCatalogClientCategories` + create/update; hierarchy via `useCatalogTaxonomy` (families/brands/models, `useSetModelFamilies`, disable-only). Drop the stub "accounts" section (ADM-16 owns users) — flag to owner.
- [ ] **(#wiring)** Audit logs: swap to `useLogs` + `useLogStats`; user-filter source = `useUsers` (identity), not the stub `usePlatformUsers`; entity links; no mutation UI.
- [ ] **(#testing)** Mocked-hook wiring smoke; statistics one-widget-error isolation; settings sequence-decrease 409; delivery-fee dry-run.

**Validation** — standard checklist. Additionally: a single statistics widget error leaves siblings rendered.

**Risks** — statistics widgets sharing a cache key would couple their loading — keep per-widget keys; delivery-fee import must be all-or-nothing (dry-run before apply).

---

### Sprint 9: Polish & stub teardown (Polish) — Status: ⬜ Pending

**Goals**
- Responsive/desktop-first pass; `useMemo`/`useCallback` where the plan calls for it; **grep-gated deletion of orphaned Sub-01 stubs**.

**Tasks**
- [ ] **(#ui)** Desktop-first responsive classes; horizontal table scroll acceptable; tab bars/filters usable on narrow viewports.
- [ ] **(#ui)** Apply `useMemo` (DataTable column defs, ADM-08 footer math, credit-history merge, effective-page list) and `useCallback` (row-action handlers) — only where named.
- [ ] **(#cleanup)** Deletion audit (plan §Deletion Audit) **behind `grep -rl <symbol> src/` = 0**: delete stub hooks (`use-admin-suppliers`, `use-supplier-information`, `use-supplier-information-page-state`, `use-admin-clients`, `use-admin-clients-stats`, `use-admin-clients-search`, `use-modify-client`, `use-admin-logs`, `use-admin-settings`, `use-admin-statistics`); gate `use-recent-clients`/`use-recent-orders` (dashboard). Delete stub services (`admin-suppliers`, `supplier-information`, `admin-logs`, `admin-settings`, `admin-statistics` — **keep `statistics.service.ts`**); prune stub-only methods from mixed `clients.service.ts`/`catalog.service.ts`. Remove owned `draft-types` files (`admin-suppliers`, `supplier`, `admin-settings`, `admin-statistics`, `logs`, admin-client portions of `client.types`) + their `index.ts` re-exports; gate the rest. Drop the stub Settings "accounts" section.
- [ ] **(#testing)** Full `tsc --noEmit` + `vitest run` after each deletion batch (green gate).

**Validation** — standard checklist. Additionally: zero `draft-types`/`admin-*.service` importers remain among this set's pages; lint + `tsc` green after teardown.

**Risks** — deleting a stub still imported by an out-of-set page → the grep gate is mandatory before each removal; mixed-service pruning accidentally removing a real method.

---

### Sprint 10: Unit tests (Tests) — Status: ⬜ Pending

**Goals**
- `/tests/unit/pages/<page>/*.spec.tsx` for all ten pages: state reactions + form Zod errors, hooks mocked.

**Tasks**
- [ ] **(#testing)** Per plan §6 each page: mock the feature hook(s), mock `useTranslation` (`t: k => k`), reuse fixtures in `/tests/fixtures/data/`. Cover: inventory (low-row highlight, type chips, adjustment IN-delta unitCost Zod, per-tab states); suppliers (stat row, disable, 404 detail); supplier-invoices (amountOnly XOR, footer recompute, confirm→reprice, inline create, payment preview); pos-clients (drawer credit-merge from mocked sales+payments, add-dialog required-name); clients (approval queue, mandatory category, username server error) + client-detail (tabs, 404, reset-password confirm-mismatch, browsing links); statistics (per-widget states, one-widget-error isolation, report CSV, URL sync); users (type switch, effective list, system-role lock, STAFF-roleIds Zod, last-admin banner); settings (tab forms, sequence-decrease 409, fee dry-run, model families multi-select); logs (filters, entity link, no mutation UI); staff-searches (filters, product link).
- [ ] **(#testing)** Confirm no test file lives under `/src`.

**Validation** — standard checklist. Additionally: `vitest run` green for all ten page suites; interactions use `userEvent` (not `fireEvent`); no `as any` on real assertions.

**Risks** — asserting translated copy instead of keys (mock returns the key); `DataTable`'s dual desktop/mobile render → use `getAllByText`.

---

## Sequencing notes & dependencies

- **A2 (Sprint 1) gates the ADM-12 `newThisMonth` card (Sprint 7)** — land the contract+API change first so the frontend wires against a real field, never a placeholder.
- **Primitives (3–4) before any wiring (5–8)** — the phase-file hard rule.
- **Rewire pages must be green on the real hook before Sprint 9 deletes their stub** — teardown is last, grep-gated, batched with a `tsc`+`vitest` gate.
- **Route decisions from Sprint 2** (query-param preselect, `:id` ordering) are prerequisites for Sprints 6–7.
- A1 and A3 carry **no backend work**; A1's drawer is fully covered by Sprint 5's existing-hook composition.
