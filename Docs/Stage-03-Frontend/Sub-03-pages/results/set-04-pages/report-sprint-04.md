# Set-04 — Sprint 4 Report: Page-Local Primitives (All Ten Pages)

Status: ✅ Done

## Inventory (ADM-09)

Built `inventory-filters.tsx` (search + warehouse/status selects), `stock-levels-table.tsx`,
`movement-ledger-table.tsx`, `reservations-table.tsx`, and the adjustment flow
(`adjustment-form.tsx` + `adjustment-line-editor.tsx`, RHF + Zod against the Sprint 1
`inventoryAdjustmentSchema`). All four tables are dumb components taking DTO-typed rows and a
`isLoading` flag; `AdminInventory.tsx` wires them onto local `useState` placeholders (Sprint 6
wires the real `useInventory*` hooks).

## Supplier invoices (ADM-08)

`supplier-invoices-table.tsx` (list), and the full editor cluster: `invoice-header-form.tsx`,
`invoice-line-editor.tsx`, `inline-create-product-dialog.tsx` (+ its own
`inline-create-product.schema.ts` — no Sprint 1 precedent existed for inline product creation
from an invoice line, filled here), `amount-only-switch.tsx`, `reprice-prompt.tsx`, and
`confirm-bar.tsx`. `AdminSupplierInvoiceEditor.tsx` keeps the Sprint 3 route-sentinel
(`id === "new"`) pattern so the title always renders regardless of fetch state.

## POS clients (ADM-13)

`pos-clients-table.tsx`, `add-pos-client-dialog.tsx`, `edit-pos-client-dialog.tsx`, and
`pos-client-detail-drawer.tsx` (the gap-A1-resolved detail surface — a drawer, not a route, since
the contract has no dedicated pos-client detail endpoint per the Sub-03 set-04 plan).

## Client detail (ADM-12b)

`client-detail-header.tsx`, `browsing-activity-table.tsx`, `approval-dialog.tsx` (wraps the
separate `ApproveClientCommand`/`RejectClientCommand` flow flagged in Sprint 3, not the modify
dialog), and `reset-password-dialog.tsx`. `AdminClientDetail.tsx` has no data source yet (Sprint 7
wires `useClientDirectoryEntry`), so — matching the Sprint 3 `AdminSupplierInformation.tsx`
precedent — it renders `NotFoundState` on its placeholder `undefined` client rather than a bare
title. This changed the page's actual rendered output from Sprint 2's placeholder assumption; see
"Route-smoke correction" below.

## Users, roles & staff-searches (ADM-16, ADM-19)

`users-table.tsx`, `user-dialog.tsx` (create/edit, RHF + Zod), `roles-table.tsx`,
`role-dialog.tsx`, and the staff-searches list components (filters + results table). All dumb,
placeholder-wired; Sprint 8 wires `useUsers`/`useRoles`/`useStaffSearches`.

## Settings — four new tabs (ADM-17)

- `store-settings-form.tsx` — simple RHF form (name/address/phone) against Sprint 1's
  `storeSettingsSchema`.
- `invoicing-settings-form.tsx` — one row per `DocType` for prefix/next-sequence, plus a
  dismissible sequence-decrease error banner. `Object.fromEntries(Object.values(DocType).map(...))`
  infers as a generic string-keyed object, not `Record<DocType, ...>`; needed an explicit
  `as Record<DocType, string>`/`as Record<DocType, number>` cast on the two default-value maps to
  satisfy the exhaustive-record Zod-inferred type (same "z.record keyed by an enum is exhaustive
  in Zod 4" fact as Sprint 3, now hitting `Object.fromEntries` inference too).
- `hierarchy-panel.tsx` — the genuine **rebuild** flagged in Sprint 3 (replacing
  `product-hierarchy-section.tsx`, which modeled one family+brand per model with hard delete —
  structurally incompatible with the real disable-only taxonomy DTOs and
  `SetModelFamiliesCommand`'s families-multi-select). Three-column Families/Brands/Models panel
  with inline create + disable buttons per column, a loading skeleton, and no delete affordance.
- `storefront-settings.tsx` — featured-products picker (`AutocompleteInput` to add, removable
  `Badge` chips) plus a deferral note for delivery-companies (gap A3 — storefront
  delivery-companies has no contract backing yet, flagged not fabricated).

`AdminSettings.tsx` now renders all six tabs (Categories/Delivery/Store/Invoicing/Hierarchy/
Storefront) on placeholder state; `TabsList` grid widened to `lg:grid-cols-7`/`lg:grid-cols-6`.
Four new i18n keys added (`admin.settings.tabs.store/invoicing/hierarchy/storefront`) — all other
keys consumed by the four new components already existed from Sprint 1.

## Route-smoke correction (not a regression)

`admin-set-04-routes.smoke.test.tsx`'s `/admin/clients/:id` case asserted the Sprint-2 placeholder
title (`admin.clients.detail.title`), but the real Sprint 4 body — per the established "detail page
with no data source yet renders `NotFoundState`" convention — always shows the not-found copy
instead. Concluded the test's expectation was stale against intended behavior (matching the
already-committed, unquestioned `AdminSupplierInformation.tsx` precedent), not a bug in the page,
and re-anchored the assertion to `admin.clients.detail.notFound` with an inline comment explaining
why. All 7 route-smoke cases pass after the fix.

## Validation

- `tsc --noEmit` (both `tsconfig.json` and `tsconfig.test.json`) — clean.
- `eslint` — clean on all new/changed files; full-repo `eslint .` shows ~4795 problems, all
  grep-confirmed confined to the pre-existing `src/types/draft-types/*` noise pile (untouched by
  this sprint).
- `vitest run` — **84 files / 552 tests**, all green (28 new: 7 settings-primitives + others across
  inventory/supplier-invoices/pos-clients/client-detail/users). The same pre-existing, unrelated
  `vaul`/jsdom pointer-up flake in `staff-sales/sales.test.tsx` is still present, still not
  introduced by this work (isolated and confirmed all 7 of that file's own tests still pass).

## Carried into later sprints

- Sprint 6 wires `useInventory*` into inventory; Sprint 7 wires `useClientDirectoryEntry` into
  client detail (will replace the current `NotFoundState`-on-placeholder body with real data) and
  the approval-dialog's commands.
- Sprint 8 wires `usePlatformSettings`/`useUpdatePlatformSettings` into all four new Settings tabs,
  `useUsers`/`useRoles` into users/roles, and `useStaffSearches` into staff-searches.
- Sprint 9's Deletion Audit gains `product-hierarchy-section.tsx` (superseded by
  `hierarchy-panel.tsx`, grep-verify zero remaining importers before deleting).
