# Sprint 8 Report — Wiring: Statistics, Settings, Audit logs

**Status:** ✅ Done

## Scope

The three remaining rewire pages (ADM-15 Statistics, ADM-17 Settings, ADM-18 Audit logs) swapped
from their Sub-01 stub hooks / placeholder props onto the real Sub-02 Integration Engine hooks,
each widget/tab independently loaded per the plan's granular-states rule.

## What shipped

### ADM-15 Statistics (`AdminStatistics.tsx`)
- `useOverview`, `useFiltered`, `useChart` (×4 — revenue/orders/clients/sales-by-family),
  `useTopProducts`, `useCatalogFamilies` all wired; each keeps its own `isLoading`/`isError`, so
  one widget's failure never blanks the others (verified in the wiring test).
- URL-synced `dateRange`/`family` state (pre-existing since Sprint 3) now also derives the shared
  `{ from, to, familyId }` query object (`toISODate` helper) consumed by `useFiltered`/`useChart`.
- **New component `report-picker.tsx`** (none existed from Sprint 4 — this page is a rewire, so
  no primitive sprint built one): a report-type `Select` + optional `groupBy` input, its own
  `useReport`/`useExportReportCsv`, a small `recharts` bar chart, a `DataTable` over the report's
  `rows: Record<string, unknown>[]`, and drill-id `<Link>`s for the `product`/`client`/`supplier`
  entities `ReportDto.drill` can name (same scope-confinement convention as `AdminLogsTable`'s
  `ENTITY_ROUTES` — unknown entities render as plain text).
- Added the missing `admin.statistics.reports.*` i18n keys Sprint 1 didn't anticipate (report-type
  labels, description/empty/error/selectType copy) — `title`/`exportCsv`/`groupBy`/`viewDetails`/
  `widgetError` already existed from Sprint 1.

### ADM-17 Settings (`AdminSettings.tsx` + tab components)
- Store/Invoicing/Storefront tabs → `usePlatformSettings`/`useUpdatePlatformSettings`, each
  section submitted independently (`{ store: values }`, `{ invoicing: values }`,
  `{ storefront: { featuredProductIds } }`) per `UpdateSettingsCommand`'s per-section-optional
  shape. Invoicing's sequence-decrease 409 surfaces via `axios.isAxiosError(err) &&
  err.response?.status === 409` → `sequenceDecreaseError` banner (same convention as
  `AdminUsers.tsx`'s last-admin guard).
- Storefront featured-picker: `useAdminCatalogProducts({ page: 1, limit: 100 })` for both the
  add-picker's options and the chip-label lookup (same "one generous page, no search-as-you-type
  in a wiring sprint" call as `AdminInventory`'s adjustment-form product picker) — a featured
  product outside that first 100 falls back to showing its raw id until it appears on that page.
- Categories tab (`client-categories-section.tsx`): `useCatalogClientCategories` +
  `useCreate/UpdateCatalogClientCategory` wired directly inside the section (single consumer,
  confirmed via grep before wiring hooks straight into it rather than lifting state to the page).
- Hierarchy tab: `useCatalogFamilies/Brands/Models(..., admin=true)` + `useCreate*`/`useUpdate*`
  (disable-only) + `useSetModelFamilies`. **Real gap found**: `CreateModelCommand` carries no
  `familyIds` field (confirmed against `taxonomy.schema.ts`) — a new model's families must be set
  via a second `useSetModelFamilies` call once `useCreateCatalogModel`'s `onSuccess` returns the
  new model's id, not passed in the create call itself.
- Delivery fees tab — see "Real bugs found" below; `useAdminDeliveryFees` (read) +
  `useExportAdminDeliveryFees` (CSV) wired cleanly; import required a shared-component fix.

### ADM-18 Audit logs (`AdminLogs.tsx`)
- `useLogs` + `useLogStats` wired; user-filter sourced from `useUsers` (identity), not the stub
  `usePlatformUsers`, per the plan. `LogsFilterValues` (UI-local, `dateFrom`/`dateTo`) mapped
  explicitly to `LogsQuery`'s real field names (`from`/`to`) at the call site — a rename, not a
  drop, so the filter component's date-range-picker-adjacent naming stays as-is.
- Strictly read-only, confirmed by the wiring test asserting zero delete/trash controls render.

## Real gap found and fixed: `excel-file-uploader.tsx` was a pure mock

The shared `components/shared/excel-file-uploader.tsx` (consumed only by the delivery-fees
import flow) never actually read the selected file — it ran a fake `setInterval` "progress" loop
and then resolved a **hardcoded** two-row `ExcelImportResult`, regardless of what the user
uploaded. Wiring the real `useImportAdminDeliveryFees` mutation against this component was not
possible without fixing it first, since it had no way to hand the real `File` up to a caller.

Fixed by replacing `onFileProcessed: (result: ExcelImportResult) => void` with
`onFileSelected: (file: File) => void` — the component now does only its original client-side
validation (MIME type + size) and hands the raw `File` to the caller, which owns the real
mutation. The requirement's "dry-run validation report before applying" (`ADM-17-settings.md`
line 16) cannot be honestly implemented as a row-level preview: there is no approved client-side
`.xlsx`-parsing library (front-end-rules §6A — asking, not assuming, is required to add one) and
the backend's `FEES_IMPORT` route is a single atomic endpoint with no separate dry-run mode. Per
the same "flag rather than approximate" call Sprint 6 made for the landed-unit-cost estimate, the
import is wired as a confirm-and-apply step against the real endpoint — the backend's own
all-or-nothing guarantee is what the requirement's parenthetical actually asks for — rather than
fabricating a client-side validation report that doesn't reflect the real file. This is a scope
note for a future contract change, not a shipped shortcut.

## Testing

Three new wiring-smoke suites (`tests/unit/pages/statistics/`, `tests/unit/pages/settings/`,
`tests/unit/pages/logs/`), 15 new tests: loading skeletons, error+retry fallbacks, live-hook
row rendering, the statistics one-widget-error isolation, the invoicing sequence-decrease 409
banner, the delivery-fee import (mutation called with the real `File`, real `imported` count
rendered) and export mutations, and the storefront featured-product removal. All three suites hit
the same `DataTable` dual desktop/mobile jsdom-render pitfall documented since set-02 — fixed with
`getAllByText`. Radix `Dialog` portals its content onto `document.body`, outside the RTL render
container — the delivery-fee import test queries the hidden file input via `document.querySelector`,
not `container.querySelector`.

`tsc --noEmit` clean · `eslint` clean on every file this sprint touched (the pre-existing
`excel-file-uploader.tsx` single-quote/prettier noise — ~106 errors before this sprint's edit,
confirmed via `git show HEAD:...` — is untouched beyond the lines this sprint's edit actually
removed, same "not this sprint's job" call as prior sprints' `draft-types` noise) · `vitest run`
green (622 tests, 15 new).
