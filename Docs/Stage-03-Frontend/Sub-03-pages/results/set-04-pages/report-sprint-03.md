# Set-04 — Sprint 3 Report: Shared & DTO-Typed Primitives; Rewire-Shell Retyping

Status: ✅ Done

## Shared primitives — confirmed sufficient (no new lib)

All 17 listed primitives already exist in `components/shared/` with the expected shape
(`DataTable`, `StatCard`, `StatCardSkeleton`, `TableSkeleton`, `MoneyStatusCard`, `StatusBadge`,
`SimplePagination`, `EmptyState`, `NotFoundState`, `AgeFlag`, `CreditMovementPreview`,
`ResolvedVsChargedPrice`, `autocomplete-input`, `admin-search-input`, `excel-file-uploader`,
`image-management`, `drag-drop-area`) — built across earlier sets (set-02/03). **Extended**
`StatusBadge.tsx` with two new enum-backed badges, following its own documented EXTENSION POINT
pattern: `SupplierInvoiceStatusBadge` (purchasing's DRAFT/CONFIRMED/CANCELLED, distinct from the
existing `InvoiceStatusBadge`) and `ClientStatusBadge` (clients.dtos.ts's PENDING/APPROVED/
REJECTED). New render tests added for both (`tests/unit/components/shared/StatusBadge.test.tsx`,
6 cases) — the only shared primitive that changed shape this sprint.

## Rewire-shell retyping — all five trees

Every rewire page's presentational components were retyped from `draft-types` numeric-id view-
models to the real contract DTOs. Each page's top-level orchestrator now sources its data from a
**local placeholder** (`undefined`/`[]` state, not the incompatible Sub-01 stub hooks) instead of
patching the stub's mismatched shape into DTO-typed props — end-user behavior is unchanged (the
stub always rendered empty data anyway; the app now just compiles against the types Sprint 6-8
will actually wire real data into). `tsc --noEmit` stayed clean after every file.

### Suppliers (ADM-07, list + detail)
- `SupplierStatsDto` = `{ totalSuppliers, totalCredit, totalInvoiced }` — **no `totalDue`/
  `totalPaid`** (the plan's own claim was stale against the real contract, verified directly).
  The 4-card layout drops to 3; the financial-summary "financial health" score/payment-ratio/
  credit-utilization bars had no backing fields either and were dropped, not fabricated.
- `SupplierDto`: `id` (uuid) replaces `idSupplier`; `name`/`contactName`/`phone`/`email`/
  `location`/`credit`/`totalPaid`/`totalInvoiced`/`invoiceCount`/`isEnabled` replace the old
  field names. Delete → disable (`isEnabled: false`); "Add invoice" is now a `<Link>` to
  `/admin/supplier-invoices/new?supplierId=` (ADM-08), not a dialog.
- **Deleted** (superseded, zero remaining importers verified): the inline `admin-supplier-
  invoice-dialog.tsx`+`.schema.ts` (replaced by the ADM-08 Link), the dead-import `admin-
  suppliers-page-header.tsx` (imported but never rendered), and two stub schema files replaced
  by Sprint 1's `supplier.schema.ts`/`supplier-details-section` inlining. Left untouched:
  `supplier-modify-dialog.tsx`(+schema) — actually a *products*-module component (product-
  supplier pricing), unrelated to ADM-07, already orphaned before this sprint.
- Detail page's edit-mode toggle moved from being lifted through the header into
  `SupplierDetailsSection` itself (self-contained), simplifying the header to breadcrumb +
  identity + refresh.

### Clients (ADM-12 list only — ADM-12b detail is Sprint 7's new build)
- `ClientStatsDto` (gap A2, Sprint 1) = `{ totalClients, pending, approved, rejected,
  newThisMonth }`. Cards: total/pending/**approved-relabeled-"active"**/newThisMonth, exactly
  per the plan's A2 resolution.
- `AdminClientDto`: `id` (uuid), `phone`/`email` (was `clientPhoneNumber`/`clientEmail`),
  `status: ClientStatus` rendered via the new `ClientStatusBadge`. **No `credit` field on
  `AdminClientDto`** (only `PosClientDto` carries a running credit balance) — the credit column
  is dropped, not fabricated.
- Filters retyped to the real `AdminClientListQuery.status` enum (PENDING/APPROVED/REJECTED),
  replacing the invented "active"/"disabled"/"refused" strings.
- The modify dialog was rebuilt around `AdminUpdateClientCommand` (`email`/`storeName`/
  `address`/`isEnabled` — "contact, isEnabled" per its own contract comment), **not** retyped
  in place — the old dialog conflated registration-approval fields (status/username/password/
  category) that now belong to the separate `ApproveClientCommand`/`RejectClientCommand` flow
  (Sprint 1's `approve-client.schema.ts`, wired in Sprint 7's dedicated approval-dialog). A new
  `admin-client-modify-dialog.schema.ts` wraps `AdminUpdateClientCommand` (no Sprint-1
  precedent existed for it — a genuine gap filled here, same "fill it, don't invent a workaround"
  precedent as prior stages).

### Statistics (ADM-15, shell + 4 charts + top-products)
- `OverviewDto`/`FilteredDto` map cleanly (minor rename: `stockValue` was `totalProductValue`,
  `*ChangePct` fields replace a nested `previousPeriodComparison` object).
- **All four charts share one real shape**, `ChartPoint[]` (`{ label, value }`, `useChart`'s
  only response type — no dedicated per-chart schema exists in the contract). This collapsed
  each chart component from ~300-400 lines of bespoke date-formatting/growth-stat logic down to
  a thin, near-identical recharts wrapper — and made the old config-driven `ChartWrapper` (which
  existed solely to fan one shared loading/error prop out across four *heterogeneous* chart
  shapes) pointless, since the shapes are now identical. Replaced with each chart independently
  taking its own `data`/`isLoading` pair, matching the plan's own "each widget loads
  independently" requirement for Sprint 8 ahead of time.
- `TopProductDto` (locally-declared in `statistics.service.ts` — no contract schema exists):
  `productId`/`quantitySold` replace `idProduct`/`totalSold`; there is **no `rank` field** —
  rank is the row's position in the already-sorted array, derived via `.map((_, i) => i + 1)`,
  not stored.

### Settings (ADM-17 — Categories + Delivery fees tabs only; Hierarchy/Store/Invoicing/Storefront correctly remain Sprint 4's job)
- **Scope correction discovered mid-sprint**: `product-hierarchy-section.tsx` (already wired
  into `AdminSettings.tsx`'s "hierarchy" tab) models one family+brand per model with hard
  delete — structurally incompatible with the real taxonomy DTOs' disable-only convention and
  `SetModelFamiliesCommand`'s **families multi-select** (a model can belong to several
  families). This isn't a retype, it's a rebuild — correctly Sprint 4's "hierarchy-panel" (new),
  not this sprint's. The "hierarchy" tab (and the already-flagged-for-deletion "accounts" tab —
  ADM-16 now owns users) are dropped from `AdminSettings.tsx`'s active tab list, not deleted
  outright (Sprint 9 grep-gates the actual file removal).
- `ClientCategoryDto` (`catalog.dtos.ts`): `id` (uuid), `isEnabled` (was a local
  `CategoryStatusCode` enum), `memberCount`/`pricedProductCount` (the plan's "member/priced-
  product warning columns" — the old view-model had neither). Delete → disable-only. The dialog
  now uses Sprint 1's `createClientCategorySchema`/`updateClientCategorySchema`
  (`settings/components/client-category.schema.ts`).
- `AdminFeesDto` (`platform.dtos.ts`) is a **nested** `wilayas[] -> communes[]` shape (one
  resolved fee per wilaya + only the communes with an explicit override) — flattened into flat
  table rows here (`communeName` absent = the wilaya-level default row), not the old flat
  `{wilaya, commune, deliveryHome, deliveryOffice}[]`.
- **Flagged, not solved**: the shared `excel-file-uploader.tsx` component still does client-side
  mock parsing against `ExcelImportResult` (`draft-types`) rather than the real dry-run-report
  flow the plan calls for (`useImportAdminDeliveryFees`). This is Sprint 8's wiring problem, not
  a Sprint 3 presentational one — `delivery-fees-section.tsx` keeps using the uploader's
  existing contract as-is (its one remaining `draft-types` import is pre-existing, not newly
  added).

### Logs (ADM-18)
- `AuditLogDto`: `id` (uuid), `user?.username` (the acting user is now **optional** — a system-
  initiated action has none), `actionType`/`description` (was `actionTypeLabel`/`actionDetails`,
  and `actionType` is a **free-form string**, not an enum — the old `ActionTypeCode` dropdown
  couldn't survive retyping and was replaced with a plain text filter). New `entityType`/
  `entityId` fields back the plan's "entity link where a route exists" (PRODUCT/SUPPLIER/CLIENT
  routes wired via a small lookup table; anything else renders as plain text).
- `LogStatsDto` = `{ total, today, week, month }` (renamed from `totalLogs`/`logsToday`/
  `logsThisWeek`/`logsThisMonth`) — existing `admin.logs.stats.*` translation keys reused via an
  explicit label map, since the field names no longer match the key segments 1:1.
- Filters' user-select source changes from the stub `usePlatformUsers` to a `users: UserDto[]`
  prop (identity's real shape) — Sprint 8 wires it from `useUsers`.

## A recurring compile pitfall (worth flagging forward)

Early attempts at page-level placeholders used literal `const data = undefined; const isLoading
= false;` guards (`if (isLoading) return …; if (!data) return …; … data.foo …`). TypeScript's
control-flow analysis proves such branches are always/never taken from the literal types and
narrows the **unreachable code after them to `never`**, breaking every property access. Fixed by
using `useState` for these placeholders instead of `const` — it's also more honest, since it's
what the real hook will look like once Sprint 6-8 replaces it. Every detail/edit page in this
sprint (`AdminSupplierInformation.tsx`, etc.) uses this pattern; worth remembering for Sprints
4-8's own placeholder code.

## Validation

- `tsc --noEmit` (both `tsconfig.json` and `tsconfig.test.json`) — clean throughout, re-verified
  after every tree.
- `eslint` — clean on all 36 changed/new files (several rounds of `--fix` for prettier-only
  formatting).
- `vitest run` — **77 files / 524 tests**, all green (6 new from `StatusBadge.test.tsx`); the
  same pre-existing, unrelated `vaul`/jsdom pointer-up flake noted in Sprints 1-2 is still
  present and still not introduced by this work.
- Zero newly-added `draft-types` imports across all retyped files (the one pre-existing
  `delivery-fees-section.tsx` → `ExcelImportResult` reference predates this sprint).
- 5 dead files deleted (superseded, grep-verified zero remaining importers first): suppliers'
  inline invoice dialog + schema, dead-import page header, and two stub schema files replaced by
  Sprint 1 wrappers.

## Carried into later sprints

- Sprint 4 must build the Hierarchy/Store/Invoicing/Storefront Settings tabs as genuinely **new**
  components (not retype `product-hierarchy-section.tsx` — see above).
- Sprint 6 wires `usePurchasingSuppliers`/`usePurchasingSupplierStats`/`usePurchasingSupplierDetail`
  into the now-DTO-typed suppliers shells; Sprint 7 wires `useClientDirectory`/
  `useClientDirectoryStats`/`useUpdateClientDirectoryEntry` plus the new approval-dialog; Sprint 8
  wires `useOverview`/`useFiltered`/`useChart`/`useTopProducts` (statistics), `usePlatformSettings`/
  `useCatalogClientCategories`/`useAdminDeliveryFees` (settings), and `useLogs`/`useLogStats`
  (logs, with `useUsers` for the filter).
- Sprint 8 should also resolve the `excel-file-uploader` dry-run-report gap flagged above.
- Sprint 9's Deletion Audit gains one more entry not in the original list: the stub `admin/
  clients/components/client-category-dialog.schema.ts` is now fully orphaned (grep-verified) —
  add it alongside the already-listed stub files.
