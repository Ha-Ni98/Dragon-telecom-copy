# Sprint 9 Report — Polish & stub teardown

**Status:** ✅ Done

## Scope

Responsive/desktop-first pass, the named `useMemo`/`useCallback` optimizations, and the
grep-gated deletion of orphaned Sub-01 stub code (plan §Deletion Audit).

## Optimization pass

Most of the plan's named `useMemo`/`useCallback` targets were already applied in earlier wiring
sprints (Sprint 5's inventory adjustment form, Sprint 5's POS-client credit-history merge,
Sprint 7's users effective-page-list derivation, and every `DataTable` column-def array except
two). This sprint's actual diff:

- **`AdminSupplierInvoiceEditor.tsx`** — `footerSubtotal` (the plan's named "ADM-08 footer math")
  was a plain `.reduce()` recomputed on every render, not memoized. Wrapped in `useMemo` keyed on
  `watchedLines`.
- **`client-categories-section.tsx`** — its `columns` array (and the `openEditDialog`/
  `handleDisable` row-action handlers the columns' cells close over) were plain, unmemoized —
  wrapped `columns` in `useMemo` and both handlers in `useCallback`.
- **`delivery-fees-section.tsx`** — same `columns`-array gap (read-only table, no row actions to
  wrap).
- **`AdminUsers.tsx`** — `openUserDialog`/`openRoleDialog` (passed as the `onEdit` row-action prop
  into `UsersTable`/`RolesTable`) were plain functions — wrapped in `useCallback`.

No other gaps found. Responsive/desktop-first classes were already consistent across every
set-04 page from the sprints that built them (`grid-cols-1 md:grid-cols-N`, `hidden sm:inline` tab
labels, `flex-wrap` filter bars, `DataTable`'s own desktop-table/mobile-card dual render) — no
changes were needed here.

## Deletion audit — three plan-premise corrections found

The grep gate (`grep -rl <symbol> src/` = 0 before every removal) caught three places where the
plan's Deletion Audit text didn't match the code as it stands today:

1. **`use-recent-clients.ts`/`use-recent-orders.ts`** — the plan flagged these as "gate: confirm
   the dashboard was already swapped before deleting." It was: `recent-orders-section.tsx`/
   `recent-clients-section.tsx` have taken `AdminDashboardDto` as a prop since set-02 Sprint 3 and
   no longer call these hooks. Deleted rather than left gated.

2. **`admin-statistics.types.ts` and `supplier.types.ts`** — both named for full deletion in the
   plan, but each has one real remaining consumer the plan didn't account for:
   - `lib/date-utils.ts`'s `generateDateRangeData`/`DateRange` — actively used by the now-wired
     `AdminStatistics.tsx` (Sprint 8) for its date-range filter state. Deleting the type file
     would have broken the very page this set just wired.
   - `admin-product-information.types.ts` (imports `Supplier` from it) → the real
     `AdminProductInformation.tsx` products-page detail view (out-of-set, still active).
   Both gated (left in place) instead of deleted.

3. **`use-admin-settings.ts`/`admin-settings.service.ts`/`admin-settings.types.ts`** — the plan
   implied these stay gated (consumed by `product-hierarchy-section.tsx`, an out-of-set Products
   page component). Tracing that component's own importers turned up zero — `ProductHierarchySection`
   is itself dead code, forgotten since the Products page was migrated onto real hooks
   (`useCatalogFamilies`/`useCatalogBrands`/`useCatalogModels` etc.) in an earlier stage. Its only
   consumer, `model-dialog.tsx` (+ `model-dialog.schema.ts`), was equally dead. Deleted all three
   Settings-domain files plus this three-file dead chain together — which in turn let
   `logs.types.ts` (previously kept alive only by `admin-settings.types.ts`'s import of
   `PlatformUser`) be deleted in full too.

`catalog.service.ts`'s entire Sub-01 stub block — `getBrands`/`getBrandById`/`getFamilies`/
`getFamilyById`/`getModels`/`getModelById`/`getRelatedProducts`/`searchProducts` plus the 17
`getAdminProduct*`/`updateAdminProduct*`/`deleteAdminProduct*` admin-catalog stub methods — was
confirmed fully dead the same way (the products page was already fully wired to
`useCatalogProducts.ts`/`useCatalogTaxonomy.ts`; the file's own header comment claiming
`use-brands.ts`/`use-models.ts` still consumed `getBrands`/`getFamilies`/`getModels` was stale —
neither hook file exists). Pruned per the plan's explicit "admin-product stub methods" instruction,
replacing the ~230-line Sub-01 block with a two-line header note.

## What was deleted

**Hooks (12):** `use-admin-suppliers.ts`, `use-supplier-information.ts`,
`use-supplier-information-page-state.ts`, `use-admin-clients.ts`, `use-admin-clients-stats.ts`,
`use-admin-clients-search.ts`, `use-modify-client.ts`, `use-admin-logs.ts`,
`use-admin-statistics.ts`, `use-admin-settings.ts`, `use-recent-clients.ts`, `use-recent-orders.ts`.

**Services (5):** `admin-suppliers.service.ts`, `supplier-information.service.ts`,
`admin-logs.service.ts`, `admin-statistics.service.ts`, `admin-settings.service.ts` (kept the real
`statistics.service.ts`).

**Draft-types (3 whole files):** `admin-suppliers.types.ts`, `admin-settings.types.ts`,
`logs.types.ts`. **Pruned (partial):** `client.types.ts` (kept only `ClientCategory` and the
harmless `ClientStatusCode` re-export; removed `Client`/`AdminClientWithDetails`/
`AdminClientsStats`/`ClientModificationData`/`PaginationInfo`/`AdminClientsFilters`/
`AdminClientsPaginatedResponse`/`RegistrationFormData`, all orphaned once the clients stub hooks
were gone). Updated `index.ts`'s barrel re-exports to match. **Gated (kept, not touched):**
`admin-statistics.types.ts`, `supplier.types.ts`, and everything else the plan's original "gate
the rest" list named.

**Mixed services pruned:** `clients.service.ts` (removed `getAdminClients`/`getAdminClientById`/
`modifyAdminClient`/`deleteAdminClient`/`searchAdminClients`/`getAdminClientsStats` + their now-dead
type imports; kept every real Directory/PosClient/cart/auth method). `catalog.service.ts` (removed
the full Sub-01 stub block described above; kept every real Sub-02 method).

**Components (5):** `admin-accounts-section.tsx`, `admin-account-dialog.tsx`,
`admin-account-dialog.schema.ts` (Settings "accounts" tab, superseded by ADM-16), plus the
dead-code chain `product-hierarchy-section.tsx`, `model-dialog.tsx`, `model-dialog.schema.ts`
(discovered while gating #3 above).

**Left untouched (flagged, not this sprint's job):** `pages/admin/suppliers/components/
supplier-modify-dialog.tsx` (+ its schema) — confirmed zero consumers via the same grep discipline,
but it didn't block any explicitly-named deletion target, so removing it would have exceeded this
sprint's grep-gate scope. Flagged for a future pass.

## Validation

`tsc --noEmit` run after every deletion batch (hooks → services → draft-types/index.ts/component
files → mixed-service pruning) — clean throughout, catching exactly the barrel re-export breaks
and one incidental find: `dashboard.types.ts` (a gated, out-of-set file) had a fully unused
`import { Client, OrderWithDetails } from "./index"` — neither name was referenced anywhere in the
file. Removed the dead import line (zero behavior change, no risk to the gated file's real
exports). `vitest run` green after every batch (622 tests, unchanged — this sprint touched no
page's observable behavior, only dead-code removal and non-behavioral memoization). `eslint` clean
on every file this sprint touched; repo-wide lint problem count dropped from ~4780 to ~3983 as a
side effect of deleting the stub files that carried most of the pre-existing prettier noise.
