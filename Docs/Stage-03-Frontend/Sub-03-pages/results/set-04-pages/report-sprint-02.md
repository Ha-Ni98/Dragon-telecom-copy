# Set-04 — Sprint 2 Report: Routes, guards & lazy registration (Foundation)

Status: ✅ Done

## Routes

Seven `React.lazy()` + `withSuspense()` routes added to `App.tsx`, all under the existing single
`RoleGuard allow={[ADMIN, STAFF]}` → `AdminLayout` shell (no new guard layer — matches the
existing `AdminClients`/`AdminStatistics`/`AdminSettings`/`AdminLogs` precedent the plan calls
for), each with its own `RouteErrorBoundary`:

| Route | Page component |
|---|---|
| `/admin/inventory` | `pages/admin/inventory/AdminInventory.tsx` |
| `/admin/supplier-invoices` | `pages/admin/supplier-invoices/AdminSupplierInvoices.tsx` |
| `/admin/supplier-invoices/:id` | `pages/admin/supplier-invoices/AdminSupplierInvoiceEditor.tsx` |
| `/admin/pos-clients` | `pages/admin/pos-clients/AdminPosClients.tsx` |
| `/admin/clients/:id` | `pages/admin/clients/AdminClientDetail.tsx` |
| `/admin/users` | `pages/admin/users/AdminUsers.tsx` |
| `/admin/activity/staff-searches` | `pages/admin/staff-searches/AdminStaffSearches.tsx` |

`/admin/clients/:id` is declared directly after the existing static `/admin/clients` route (both
belt-and-suspenders readability and react-router v6's own static-before-dynamic ranking prevent a
collision). `/admin/supplier-invoices/:id` has **no separate `/new` route** — per the plan's own
flagged risk, the create flow is `id === "new"` as a **route-param sentinel** reached via
`/admin/supplier-invoices/new?supplierId=<id>` from ADM-07's future "Add invoice" link, not a
second route that could rank against `:id`.

**The seven page components are placeholders, not the final pages.** Each renders `PageHeader` +
a `TableSkeleton` and nothing else — the phase file's hard rule ("Wiring (Sprint 5+) never
precedes primitives (Sprints 3–4)") means they must not call any real hook yet, so this sprint
proves the route/guard/code-split wiring in isolation; Sprints 4/5–8 replace the body with the
real tab structure, forms, and hook calls. All existing five routes (`/admin/clients`,
`/admin/suppliers(+ :idSupplier)`, `/admin/statistics`, `/admin/logs`, `/admin/settings`) are
untouched — confirmed unchanged, only new entries added around them.

## Nav entries

Five new `ADMIN_NAV_LINKS` entries added to `config/nav-links.ts` (inventory, POS clients,
supplier invoices, users & roles, staff searches) — client detail isn't a nav item (reached by
clicking a client row, not top-level nav), matching the plan. New icons imported from
`lucide-react` (`Boxes`, `Contact`, `FileStack`, `ShieldCheck`, `Search`) — all verified to exist
in the installed package before use. Five matching `admin.nav.*` translation keys added.

**"Admin only" verification (no staff-registry change):** `lib/staff-pages.ts`'s `PageKey` enum
only enumerates `STAFF_*` keys (`STAFF_POS`, `STAFF_POS_CLIENTS`, `STAFF_PRODUCTS`,
`STAFF_ORDERS`, `STAFF_SALES`, `STAFF_INVOICES`, `STAFF_REPAIRS`) — confirmed by reading the enum
directly, not assumed. None of the seven new routes have or need a `PageKey`, so
`STAFF_PAGE_ROUTES`/`STAFF_NAV_LINKS` (the staff sidebar's only data source) are untouched and can
never surface these routes to a STAFF session; "admin only" holds exactly the same way it already
does for the five existing rewire pages (nav-visibility convention, not a route-level block — the
plan's own documented, deliberate scope).

## Hook-inventory check (no new hooks added)

Every `use[Name]` the ten pages will need was confirmed to exist by reading the hook file **and**
its exported function names (not just checking the filename):

| Hook file | Confirmed exports (subset used by this set) |
|---|---|
| `useInventory.ts` | `useStock`, `useExportStockCsv`, `useMovements`, `useReservations`, `useCreateAdjustment` |
| `usePurchasingSuppliers.ts` | `usePurchasingSuppliers`, `usePurchasingSupplierStats`, `usePurchasingSupplierDetail`, `useCreate/UpdatePurchasingSupplier` |
| `usePurchasingInvoices.ts` | `usePurchasingInvoices`, `usePurchasingInvoiceDetail`, `useCreate/UpdatePurchasingInvoice`, `useConfirmPurchasingInvoice`, `useCancelPurchasingInvoice` |
| `usePurchasingPayments.ts` | present (payments/`CreditMovementPreview` source for ADM-08) |
| `usePosClients.ts` | `usePosClientsList`, `useCreate/UpdatePosClient` (+ the pre-existing staff `usePosClientSearch`/`useQuickCreatePosClient`) |
| `useSales.ts`, `useBilling.ts` | present (ADM-11 drawer's sales/payments tabs) |
| `useClientDirectory.ts` | present (ADM-12/12b) |
| `useObservability.ts` | present (ADM-12b browsing, ADM-18, ADM-19) |
| `useIdentity.ts` | `useUsers`, `useRoles`, `usePages`, `useCreate/UpdateUser`, `useCreate/UpdateRole`, `useSetRolePages` |
| `useStatistics.ts`, `usePlatform.ts`, `useCatalogTaxonomy.ts`, `useClientCategories.ts`, `useCatalogProducts.ts` | present |

No new hook file added — the plan's "no missing hooks" audit for this set holds.

## Testing

`tests/unit/components/layout/admin-set-04-routes.smoke.test.tsx` (new, 7 parameterized cases) —
reconstructs the relevant `RoleGuard allow={[ADMIN, STAFF]}` → `AdminLayout` → lazy-page slice of
the route tree in a `MemoryRouter` (same "rebuild the relevant slice, not the real `router`
object" pattern already used by `tests/unit/pages/login/redirect.test.tsx`, since `App.tsx` does
not export its `router`), with `useSession`/`useAuth` mocked for an ADMIN session. For each of the
seven routes: navigates to it, awaits the lazy import resolving past its `Suspense` boundary, and
asserts both the page's own title text and `AdminSidebar`'s dashboard nav link are present —
proving the shell never unmounts and the page never blanks/crashes.

## Validation

- `tsc --noEmit` and `tsc --noEmit -p tsconfig.test.json` — both clean.
- `eslint` — clean on every changed/new file (one prettier-only fix needed, re-linted clean).
- `vitest run` — 76 files / 518 tests, all green (7 new from this sprint); the same pre-existing,
  unrelated `vaul`/jsdom flake in `staff-sales/sales.test.tsx` noted in Sprint 1 is still present
  and still not introduced by this work.
- Navigating to each new route renders the shell (`AdminSidebar`) + the placeholder's skeleton,
  never a blank page or error boundary — verified both by the smoke test and by the `tsc` guard on
  every new import.

## Carried into later sprints

- Sprint 3 retypes the five rewire shells' props; Sprint 4 builds the real page-local primitives
  that will replace each of this sprint's placeholder bodies (`PageHeader` + bare `TableSkeleton`).
- The `/admin/supplier-invoices/:id` `id === "new"` sentinel and `?supplierId=` preselect
  convention from this sprint must be honored by Sprint 6's editor wiring and ADM-07's future "Add
  invoice" link.
