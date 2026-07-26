# Set-04 — Sprint 5 Report: Wiring — Inventory, POS Clients, Staff Searches

Status: ✅ Done

## Inventory (ADM-06)

`AdminInventory.tsx` now reads live data on all four tabs: `useStock(lowStockOnly)` (Stock),
`useMovements(query)` (Movement ledger, paginated + type/date filters, `SimplePagination` wired),
`useReservations(query)` (Reservations, paginated), and `useCreateAdjustment()` (Adjustments,
success toast carries the returned `AdjustmentResultDto.reference`). `useExportStockCsv()` streams
the CSV via the existing `downloadBlob` util (`lib/utils.ts`).

The Adjustments tab's product picker and its `systemQuantityByProductId` map both come from
`useAdminCatalogProducts({ page: 1, limit: 100 })` rather than a second `useStock()` call —
`AdminProductDto` already carries `quantityOnHand`, so this is one fewer query and the same
"current on-hand" figure the Stock tab itself renders. Known limitation (documented, not fixed):
the picker is capped at the first 100 admin products (no server-side search wired to the
autocomplete yet) — acceptable for this sprint's scope, flagged for a follow-up if the catalog
grows past that.

All three list-shaped tabs got `isError`/`onRetry` props added to their table components
(`stock-levels-table.tsx`, `movement-ledger-table.tsx`, `reservations-table.tsx`) — Sprint 4 only
built the `isLoading`/empty branches, since there was no real query to fail yet.

## POS clients (ADM-11)

`AdminPosClients.tsx` wires `usePosClientsList`, `useCreatePosClient`, `useUpdatePosClient`, and
`useCatalogClientCategories` (for the category autocomplete in both dialogs). The detail drawer
gets its Sales/Payments data from `useSales('admin', { posClientId, page: 1, limit: 50 }, { enabled })`
and `useClientPayments(sameQuery, { enabled })`, gated on `!!detailClient`.

**Architecture correction against the plan:** the plan described the sales/payments tabs as "each
mount their query lazily on activation" (per-tab). In practice both are fetched together as soon as
a row is clicked, because the Credit-history tab is a `useMemo` merge of both row sets — gating
either one behind its own sub-tab would leave Credit history empty until the admin had visited both
other tabs first. `pos-client-detail-drawer.tsx`'s header comment and `plan.md` §Page 4 are both
updated to reflect this.

**`useSales` gained an `options?.enabled` param** (`useSales.ts`) — it previously had no way to
stay dormant, unlike `useClientPayments`/`useInvoices`/`useStaffProducts` which already support
this. Extended following the existing precedent (`enabled: undefined` preserves every existing
caller's always-on behavior; `StaffPos.tsx`'s ticket search is unaffected).

**Real bug found and fixed (pre-existing, from Sprint 4):** both `add-pos-client-dialog.tsx` and
`edit-pos-client-dialog.tsx` wrapped the `categoryId` field in a bare `<FormItem>`/`<FormLabel>` +
`<Controller>` instead of `<FormField>` — `FormLabel`/`FormDescription` call `useFormField()`,
which throws outside a `<FormField>` context. Sprint 4's tests never opened either dialog (only
`isLoading`/empty-state renders were checked), so this never surfaced until Sprint 5 actually
exercised the create/edit flow. Fixed by moving the field into a proper `<FormField>` render prop
in both files (removed the now-unused `Controller` import from each).

Added a small `onEdit` action (a `Pencil` icon button, `stopPropagation`'d against the row's own
view-click) to `pos-clients-table.tsx`, mirroring the `AdminSuppliersTable`'s existing
`onEdit(id)` convention — Sprint 4's scaffold had `editingClient` state with no UI path to ever set
it. `onRecordPayment` stays unwired: the plan's "ADM-15" cross-reference has no payment-recording
page in this set (scope confinement, same rule the reservations holder-chip badge already follows).

## Staff searches (ADM-19)

`AdminStaffSearches.tsx` wires `useStaffSearches({ userId, q, from, to })` (mapping the filter
component's `query` field to the contract's `q`) and `useUsers({ page: 1, limit: 100 })` for the
user filter dropdown. `StaffSearchesQuery` carries no `page`/`limit` (confirmed in
`observability.query.ts` — unpaginated by design, unlike `LogsQuery` in the same file), so there is
no `SimplePagination` on this page, matching the plan.

## Tests

Three new wiring-smoke files (`inventory-wiring.test.tsx`, `pos-clients-wiring.test.tsx`,
`staff-searches-wiring.test.tsx`), 15 tests total, following the established
`vi.mock()`-the-hook / `renderWithRoutes` pattern from `admin-products/products-list.test.tsx`.
Coverage: loading skeleton, error-retry (asserting `refetch` is called), live-data rendering per
tab/table, the adjustment form's successful low-risk submit path (a decrease needs no `unitCost`),
the POS-client create-dialog submit, the credit-history merge's newest-first ordering (asserted via
`compareDocumentPosition`, not a class selector — Radix `Sheet` portals outside the RTL render
container, and `DataTable`'s own mobile-card labels share the same `text-xs`/`text-muted-foreground`
classes elsewhere on the page), and the new edit-dialog row action.

**Pre-existing smoke test needed a fix, not from a regression but from this sprint doing its job:**
`admin-set-04-routes.smoke.test.tsx` (Sprint 2) rendered these routes with no `QueryClientProvider`,
which worked while all ten pages were placeholder-only. Now that three of the seven routes it
covers call real TanStack Query hooks, it needs a bare `QueryClient` (no MSW — the point of this
test is shell/layout survival, not data correctness); added with `retry: false` to keep it fast.

## Validation

- `tsc --noEmit` (both `tsconfig.json` and `tsconfig.test.json`) — clean.
- `eslint --fix` on all changed/new files — clean (prettier-only findings, auto-fixed).
- `vitest run` — **87 files / 567 tests**, all green (15 new). The same pre-existing, unrelated
  `vaul`/jsdom pointer-up flake in `staff-sales/sales.test.tsx` noted in report-sprint-04.md is
  still present and still isolated to that file — confirmed not introduced by this work.
- No inline strings introduced; one i18n key updated (`admin.inventory.adjustment.success` gained
  a `{reference}` interpolation placeholder, en/fr) — no new keys needed, Sprint 1 had already
  pre-seeded page-level `*.error` keys for all three pages.
- No `useEffect` fetching; every hook call is unconditional at the top of its page (Rules of
  Hooks) with `enabled`/query-key changes driving refetches, not effects.

## Carried into later sprints

- Sprint 6 wires suppliers + supplier invoices onto `usePurchasing*` — watch for the same
  `Controller`-without-`FormField` bug class in any AutocompleteInput-backed field in those forms
  before assuming Sprint 4's scaffolds are test-proven.
- Sprint 9's polish pass should reconsider the Adjustments-tab product picker's 100-item cap if a
  debounced server-side search becomes worth the added complexity.
