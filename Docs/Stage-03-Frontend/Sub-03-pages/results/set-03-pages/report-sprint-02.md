# Set-03 — Sprint 2 Report: Routes, Guards, Lazy + Engine Prerequisites (Foundation)

Status: ✅ Done

## Routing

All 9 net-new routes registered in `App.tsx`, `React.lazy()` + `<Suspense fallback={<PageLoader/>}>`:

| Route | Layout | Guard |
|---|---|---|
| `/staff/pos` | StaffLayout | `PageGuard(STAFF_POS)` |
| `/staff/orders` | StaffLayout | `PageGuard(STAFF_ORDERS)` |
| `/staff/sales` | StaffLayout | `PageGuard(STAFF_SALES)` |
| `/staff/invoices` | StaffLayout | `PageGuard(STAFF_INVOICES)` |
| `/staff/repairs` | StaffLayout | `PageGuard(STAFF_REPAIRS)` |
| `/admin/pos` | AdminLayout | unrestricted (coarse `RoleGuard` only) |
| `/admin/sales` | AdminLayout | unrestricted |
| `/admin/invoices` | AdminLayout | unrestricted |
| `/admin/repairs` | AdminLayout | unrestricted |

`/admin/orders` and the products trio (`/admin/products`, `/add`, `/:id`) were **not touched** —
they already route to real (Sub-01-stub-wired) components; Sprints 5–6 rewire those pages'
internals onto the real hooks, not their routing.

**Twin pattern, implemented literally per the plan:** each new staff page (`StaffPos.tsx`,
`StaffOrders.tsx`, `StaffSales.tsx`, `StaffInvoices.tsx`, `StaffRepairs.tsx`) takes an optional
`scope: "staff" | "admin"` prop (default `"staff"`); each admin twin (`AdminPos.tsx`,
`AdminSales.tsx`, `AdminInvoices.tsx`, `AdminRepairs.tsx`) is a one-line wrapper mounting the same
component with `scope="admin"`. `StaffOrders.tsx` is new (no existing admin twin file — the
existing `AdminOrders.tsx` stays as-is until Sprint 6). All 9 are currently **placeholder shells**
— pure Shadcn `Skeleton` markup, zero hooks, zero text — following the exact precedent set-02's
Sprint 2 established, so routing/`tsc` stay green until Sprint 4 (primitives) and Sprints 5–7
(wiring) flesh them out.

**Nav wiring:** `STAFF_NAV_LINKS`/`STAFF_PAGE_ROUTES` already had entries prepared in set-02 for
all 5 pages — only `lib/staff-pages.ts`'s `STAFF_PAGE_ROUTES` needed the 5 new route strings.
`ADMIN_NAV_LINKS` got 4 new entries (pos/sales/invoices/repairs) + 4 new translation keys
(`admin.nav.pos/sales/invoices/repairs`) + 2 new icon imports (`CreditCard`, `FileSpreadsheet`).

## Resolve-first prerequisites

### A1 — `categoryPrices` on `AdminProductDto`
- **Contract:** `AdminProductResponseSchema` gained `categoryPrices: { categoryId, categoryName,
  price }[]`, identical shape to `StaffProductResponseSchema`'s.
- **Backend:** `CatalogMapper.toAdminProductDto` now takes a `categoryPrices` param (mirrors
  `toStaffProductDto`). Both call sites that build this DTO from scratch — `getAdminProduct` and
  `listAdminProducts` — now `include: { prices: { include: { category: true } } }` and map rows
  the same way `listStaffProducts` already did. Every mutation (`createProduct`, `updateProduct`,
  `updatePricing`, `addImages`, `updateImages`) funnels through `getAdminProduct` for its return
  value, so this one fix covers all of them.
- **Test fallout:** 5 existing `catalog.mapper.spec.ts` calls to `toAdminProductDto` needed a
  second arg; `catalog.service.spec.ts`'s shared `buildProductRow` fixture needed a `prices: []`
  default (3 tests were calling `getAdminProduct` under the hood via `createProduct`/
  `updatePricing`). Added one new mapper test asserting `categoryPrices` passes through
  unchanged. A shared **frontend** fixture (`tests/fixtures/data/catalog.mock.ts`'s
  `mockAdminProduct`) also needed `categoryPrices` — its absence failed **all 51** web test files
  at module-load time (zod `.parse()` throws), since it's imported broadly. Fixed.

### A2/A3 — date-range / seller / client filters
- **A2:** `BackofficeOrdersQuerySchema` gained `from`/`to` (`z.iso.date().optional()`).
  `orders.service.ts`'s `listBackoffice` now filters on `placedAt` — same `gte`/`lte` pattern
  already used by sales/billing/purchasing.
- **A3:** `SaleListQuerySchema` **already had** `from`/`to` (my Sprint 0 audit missed them — the
  grep pattern didn't match `z.iso.date()`). Only `sellerId`/`posClientId` were genuinely
  missing; added both. `sales.service.ts`'s `listSales` now filters `staffId`/`posClientId` —
  noted as admin-only in a comment, since `listMySales`'s `extraWhere.staffId` fixes the caller's
  own id and never forwards a `sellerId` query param, so there's no collision risk.
- No dedicated unit tests added for either — both host methods (`listBackoffice`, `listSales`)
  had **zero** prior unit coverage (only integration-level, which stayed green); adding two new
  optional fields to an already-untested method didn't seem to warrant opening new test-suite
  scope beyond this sprint's brief.

### B1 — single-repair read: bigger gap than planned
The plan's premise ("endpoint param already exists") was wrong — `RepairIdParamsSchema` is the
shared `:id` shape for UPDATE/PARTS/STATUS, not evidence of a GET-by-id route. **There was no
single-repair-read endpoint anywhere** (contract, backend, or frontend). Built the full stack:
- **Contract:** `REPAIR_ROUTES.STAFF_BY_ID`/`ADMIN_BY_ID` (same `:id` path as `*_UPDATE`, GET
  instead of PATCH).
- **Backend:** `IRepairsService.getRepair`, `RepairsService.getRepair` (existence check + the
  existing private `getRepairDto` helper, `includeMargins` gated on `actor.type === ADMIN` same
  as every other method here), `RepairsController.getRepair`, 2 new `router.get` registrations.
  **Access decision:** unrestricted by creator — the file's own header comment already
  establishes that "created-by-me" (§C-1) is a **list-only** convenience filter, not a per-ticket
  ACL (every mutation already ignores it), so the new read follows that precedent rather than
  inventing a stricter rule the rest of the module doesn't have.
- **New tests:** 3 cases in `repairs.service.spec.ts` (404, happy path + `findUnique` call shape,
  `includeMargins` true/false — the last needed `totalCost` non-null in the fixture, since the
  mapper omits it either way when null regardless of `includeMargins`).
- **Frontend:** `repairsService.getRepair(scope, id)`, `useRepair(scope, id)` hook →
  `qk.repairs.detail(scope, id)` (key already existed, prepared ahead of this sprint).

### A4 — supply/sales history: also bigger than planned
Movements-tab feasibility was confirmed as planned (`useMovements({ productId })` already
supports the filter). But **Supply history genuinely needed a new filter** — `SupplierInvoiceDto`
already carries everything the tab needs (`supplierName`, `invoiceDate`, and per-line `quantity`/
`unitCost`/`landedUnitCost` — confirmed `StockMovement.unitCost` comment: *"IN: the layer's
landed cost"*, so Movements' own unitCost is redundant with this, not a substitute for supplier
name), but `SupplierInvoiceListQuery` had no way to scope invoices to one product. Added
`productId` (optional) to the contract query; `purchasing.service.ts`'s `listInvoices` filters via
`lines: { some: { productId } }` — an existing relation, not a new document type, per the user's
framing ("supplier product... for a specific product").

Added two thin composition hooks in a new file, `hooks/useProductHistory.ts`:
- `useProductSupplyHistory(productId)` — wraps the purchasing-invoices service directly (not
  through `usePurchasingInvoices`, to get TanStack's `select` transform), flattens each matching
  invoice down to just its line for this product.
- `useProductSalesHistory(productId)` — wraps the movements service directly, `select`-filters to
  `direction === MovementDirection.OUT` (no server-side direction filter exists on
  `MovementsQuery`, client-side `select` is the correct place per TanStack's own guidance for
  post-fetch shaping).

**Residual gap flagged for Sprint 5/6 (not fixed here — scope discipline):** ADM-04's "Sales
history" column list wants "resolved vs charged" price per row; `MovementDto` only carries
`unitCost`/`costOfGoods`/`profit` for OUT rows, not the sale/order line's actual charged price.
Whoever builds that tab will need to either accept cost/profit as the only numeric columns, or
join each row's `referenceId` back to its sale/order for the resolved-vs-charged pair — a
per-row `useSale(reference)` fetch or a batched follow-up, a Sprint 5/6 judgment call.

## Validation

- `tsc --noEmit` clean across **all three packages** (contract, api, web) — checked repeatedly
  after each change, not just once at the end.
- `eslint` clean on every new/touched file in all three packages.
- **Contract:** `npm run validate` (tsc + madge circular-dep check + eslint + the `tsx --test`
  conformance suite) — all green, 4/4 tests, no circular imports introduced.
- **API:** full `test/unit` + `test/contract` — **615/615** passing (612 baseline + 3 new
  `getRepair` tests).
- **Web:** full `vitest run` — **393/393** passing (0 new tests this sprint — Sprint 2 is
  routing/prerequisites, not page logic; Sprint 9 covers these pages).
- Layout survives: every new route renders a `Skeleton`-only shell inside its real
  `StaffLayout`/`AdminLayout` — no crash, no inline strings (literally no text at all yet).
- No `useEffect` fetching anywhere (shells have no data dependency yet).

## Carried into later sprints

- Sprint 4 (primitives) replaces all 9 shells' `Skeleton` markup with the real dumb components.
- Sprint 5 is now unblocked for the pricing card: `AdminProductDto.categoryPrices` is real.
- Sprint 6 can filter Orders/Sales by date/seller/client for real; Sprint 7's repair ticket detail
  has a real `useRepair` to call.
- Sprint 5/6 must resolve the Sales-history resolved-vs-charged gap noted above.
