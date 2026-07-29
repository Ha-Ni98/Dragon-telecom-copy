# Report — Set 18: Staff parity & permissions *(last set)*

Executed against `Docs/Stage-04-Fixes/plans/plan-S18-staff-parity-and-permissions.md` on
`stage-04-fix`, 2026-07-28. This is the final set of the 18-set Stage-04 fix programme.

## Owner decisions carried into execution

- **D-1 (orders):** staff holding the orders page may cancel and return an order, same as admin.
- **D-2 (sales):** staff holding the sales page gets the Returns tab and issue-return; profit,
  seller column and footer total stay admin-only.
- **D-3 (repairs):** staff holding the repairs page sees the Technicians tab (stats) but cannot
  add a technician.
- **D-4 (inventory):** no staff inventory page — untouched, as decided.
- **D-5 (POS clients):** the new `/staff/pos-clients` page is full parity with
  `/admin/pos-clients`, including the detail drawer's Sales/Payments/Credit-history tabs.
- **D-6:** all four named 403s (P1–P4) fixed via a new `anyPages` (OR) option on `requireAuth`.

## What changed

### Phase A — the auth primitive
- **`Apps/api/src/common/middlewares/auth.middleware.ts`** — added `anyPages?: PageKey[]` to
  `RequireAuthOptions`: STAFF must hold at least one listed page (OR), evaluated alongside the
  existing `pages` (AND) option in one query.
- **`Apps/api/src/modules/clients/clients.routes.ts`** — deleted the hand-rolled inline
  `posSearchGuard`/`posSearchPagesGuard` pair (and its now-unused `Request`/`Response`/
  `NextFunction`/`ForbiddenError` imports); `POS_CLIENT_ROUTES.SEARCH` now uses one
  `staffPosOrPosClientsOrAdmin` guard built on `anyPages`.

### Phase B — contract route constants
Added to `Apps/contract/src/modules/{identity,catalog,orders,sales,billing,clients,repairs}/…routes.ts`:
`IDENTITY_ROUTES.STAFF_TECHNICIANS`; `CATALOG_ROUTES.STAFF_BRANDS`/`STAFF_MODELS`;
`ORDER_ROUTES.ADMIN_CANCEL`/`ADMIN_RETURN` (renamed from `CANCEL`/`RETURN`) +
`STAFF_CANCEL`/`STAFF_RETURN`; `SALE_ROUTES.ADMIN_RETURN`/`ADMIN_RETURNS_LIST` (renamed from
`RETURN`/`RETURNS_LIST`) + `STAFF_RETURN`/`STAFF_RETURNS_LIST`;
`BILLING_ROUTES.ADMIN_CLIENT_PAYMENTS_LIST` (renamed from `CLIENT_PAYMENTS_LIST`) +
`STAFF_CLIENT_PAYMENTS_LIST`; `POS_CLIENT_ROUTES.STAFF_LIST`/`STAFF_BY_ID`;
`REPAIR_ROUTES.STAFF_TECHNICIAN_STATS`.

### Phase C — backend route wiring
- **`catalog.routes.ts`** — `staffProductsOrAdmin` renamed to `staffProductLookupOrAdmin` with
  `anyPages: [STAFF_PRODUCTS, STAFF_POS, STAFF_REPAIRS]` (P3); new `staffRepairsOrAdmin` mounts
  `STAFF_BRANDS`/`STAFF_MODELS` POST (P4).
- **`identity.routes.ts`** — new `staffRepairsOrAdmin` mounts `GET STAFF_TECHNICIANS` (P2).
- **`orders.routes.ts`** — renamed the two admin mounts to `ADMIN_CANCEL`/`ADMIN_RETURN`; mounted
  `STAFF_CANCEL`/`STAFF_RETURN` on the existing `staffOrdersOrAdmin` guard, same handlers/schemas
  (D-1).
- **`sales.routes.ts`** — renamed `RETURN`/`RETURNS_LIST` usages; mounted
  `STAFF_RETURN`/`STAFF_RETURNS_LIST` on `staffSalesOrAdmin` (D-2); new `staffSalesListOrAdmin`
  (`anyPages: [STAFF_SALES, STAFF_POS_CLIENTS]`) on `STAFF_LIST` only, for the POS-clients
  drawer's Sales tab (D-5).
- **`billing.routes.ts`** — renamed `CLIENT_PAYMENTS_LIST`; new `staffPaymentsReadOrAdmin`
  (`anyPages: [STAFF_INVOICES, STAFF_POS_CLIENTS]`) mounts the staff GET (D-5).
- **`clients.routes.ts`** — mounted `POS_CLIENT_ROUTES.STAFF_LIST`/`STAFF_BY_ID` on the existing
  `staffPosClientsOrAdmin` (D-5).
- **`repairs.routes.ts`** — mounted `STAFF_TECHNICIAN_STATS` on the existing `staffRepairsOrAdmin`
  (D-3).
- **`statistics.routes.ts`** — **P5 fix**: `STAFF_DASHBOARD` was `types: [STAFF]`, excluding
  ADMIN even though `/staff` is explicitly reachable by admins (their `effectivePages()` returns
  every `PageKey`). Replaced `staffOnly` with `staffDashboardViewer` (`types: [STAFF, ADMIN]`).
- **Real bug found and fixed under P5, beyond the guard itself** — `statistics.service.ts
  #getStaffDashboard(staffId)` and its controller call site used `req.user!.staffId!` (a
  non-null assertion). `staffId` is genuinely absent from an ADMIN's JWT (only STAFF users get
  one — `identity.service.ts#login`), and Prisma's `where: { staffId, … }` treats
  `staffId: undefined` as **"field omitted," not "no match."** Opening the guard alone would have
  made an admin visiting `/staff` see **every** staff member's sales-today and drafts as their
  own, not zero. Fixed by widening `getStaffDashboard`'s signature to `string | undefined`
  (`statistics.interface.ts`, `.service.ts`, `.controller.ts`) and short-circuiting the two
  staffId-scoped queries to empty arrays when `staffId` is absent; `pendingOrders`/`lowStock`
  stay global as before. This was not anticipated by the plan and is called out per the
  "flag it back" instruction.

### Phase D — web services & hooks
Threaded `scope`/`admin` through: `orders.service.ts` (`adminCancelOrder` renamed to
`cancelBackofficeOrder`, both mutations take `scope`), `useOrdersDirectory.ts`
(`useAdminCancelOrder` → `useCancelBackofficeOrder`); `sales.service.ts`/`useSales.ts`
(`createReturn`/`listReturns` scoped, `useReturns`/`useCreateReturn` take `scope`);
`billing.service.ts`/`useBilling.ts` (`listClientPayments`/`useClientPayments` scoped);
`clients.service.ts`/`usePosClients.ts` (new `PosClientsScope`, `listPosClients`/`createPosClient`/
`updatePosClient` scoped — `createPosClient(scope)` routes through `QUICK_CREATE` for staff, the
same `createPosClientRow` service method admin's POST already calls); `identity.service.ts`
(`listTechnicians(admin = true)`); `repairs.service.ts` (`listTechnicianStats(scope)`);
`catalog.service.ts` (`createBrand`/`createModel(command, admin = true)`).

Query keys given a scope/admin member (staff/admin collision fix, same class already applied to
`qk.orders.list`/`qk.sales.list`): `qk.sales.returns`, `qk.billing.payments.list`,
`qk.posClients.list`, `qk.identity.technicians` (split into `.all()` prefix +
`.list(admin)`, mirroring the existing `qk.catalog.brands` shape), `qk.repairs.technicianStats`.

### Phase E — the staff POS-clients page (D-5)
- **Moved** `pages/admin/pos-clients/AdminPosClients.tsx` → new
  `pages/staff/pos-clients/StaffPosClients.tsx` (scope-driven twin, same shape as
  StaffOrders/StaffSales/StaffRepairs/StaffInvoices); `AdminPosClients.tsx` is now a one-line
  `<StaffPosClients scope="admin" />` wrapper. `pages/admin/pos-clients/components/**` stays in
  place and is cross-imported (same pattern `StaffSales.tsx` already uses for
  `pages/admin/sales/components/`).
- **`pos-clients-table.tsx`** gained `scope` — the linked-account arrow to `/admin/clients/:id`
  renders only in admin scope (no staff clients page exists to receive it).
- **`lib/staff-pages.ts`** — added `STAFF_POS_CLIENTS: "/staff/pos-clients"`; every `PageKey` now
  has a route.
- **`App.tsx`** — new lazy import + `<PageGuard requires={PageKey.STAFF_POS_CLIENTS}>` route.
  No migration and no new `PageKey` were needed — the key was already seeded
  (`prisma/pages.registry.ts`), in the nav links and in `STAFF_PAGE_ORDER`; only the route mapping
  was missing.

### Phase F — opening the parity gates
- **Orders (D-1)** — `OrdersTable.tsx`: removed the `scope === "admin"` gate around the
  user/category columns (now unconditional) and around the actions column (now gated on
  `onAction` alone); skeleton width is a flat `12`. `OrderShowDialog.tsx`: `showCancel`/
  `showReturn` dropped their `scope === "admin"` term. `StaffOrders.tsx`: `onAction`/`onCancel`/
  `onReturn` wired unconditionally; `AdminCancelOrderDialog`/`ReturnOrderDialog` render for both
  scopes; both mutations (`useCancelBackofficeOrder`, `useReturnOrder`) now pass `scope`. The
  `scope` prop was removed from `OrdersTable` and `OrderShowDialog` (no longer read anywhere) —
  checked their one other consumer, `AdminClientDetail.tsx`'s read-only embedded `OrdersTable`,
  which never passed `scope` or `onAction`; it now also shows the user/category columns
  unconditionally, same as the plan's literal instruction, with no action column since it still
  passes no `onAction`. The `liveAvailableQuantity` (admin-only product re-check) gate was left
  untouched — no staff by-id product route exists, a documented pre-existing gap.
- **Sales (D-2)** — `StaffSales.tsx`: `canReturn` dropped its scope term; both `useReturns` calls
  take `scope` (the per-sale one keeps `enabled: canReturn && !!selectedSale`, the list one lost
  its `enabled: scope === "admin"`); the Sales/Returns tab bar renders for both scopes;
  `ReturnDialog`/`ReturnDetailDialog` render for both scopes; `useCreateReturn` passes `scope`.
  `SaleDetailDrawer.tsx`: `onIssueReturn`'s gate dropped `scope === "admin" &&`. Profit, the
  before/after credit block, the invoice-number link, the seller column and the footer total were
  **not** touched — they stay admin-only (margin/PII-adjacent data).
- **Repairs (D-3)** — `StaffRepairs.tsx`: the Board/Technicians tab bar renders for both scopes;
  `<TechniciansTab scope={scope} />`; `useTechnicians(scope === "admin")` so staff hits the new
  staff technician-list route; `<IntakeDialog scope={scope} />`.
  `TechniciansTab.tsx`: gained `scope` (default `"admin"`), `useTechnicianRepairStats(scope)`, and
  the Add-technician button/dialog/`useCreateTechnician` wiring now render only for
  `scope === "admin"`; its create-success invalidation now hits both
  `qk.repairs.technicianStats("admin")` and `("staff")`.
  `IntakeDialog.tsx`: gained `scope`, forwarded to `useCreateCatalogBrand(scope === "admin")`/
  `useCreateCatalogModel(scope === "admin")` (P4).
- **Invoices (P1, the highest-value single fix)** — `StaffInvoices.tsx`: the outgoing tab's
  `useMyInvoices`/`useMyInvoice`/`useMyInvoicePdf` triple (client-only routes) was replaced with
  one `useInvoices(scope, …)` / `useInvoice(scope, …)` / `useInvoicePdf()` call each, `enabled` on
  the list narrowed to `activeTab === "outgoing"` only (dropping the old `scope === "admin"`
  term, since both scopes now use the same scoped call). The three `useMyInvoice*` hooks
  themselves were **not** touched or removed — `pages/my-invoices/{MyInvoices,InvoiceDetail}.tsx`
  (the client-facing `/invoices` page) remain their real consumers, confirmed by grep before and
  after.

### Phase G — translations
Two new keys: `staff.posClients.title`, `staff.posClients.description` (mirroring the existing
`admin.posClients.*` pair). Every other label reused an existing key per the plan's "identical
copy keeps its existing key" rule — zero other new keys were needed for this set.

## Deviations from the plan

None in scope or approach. One correction beyond what the plan specified: the P5 fix required a
service-layer change (staffId-optional guard) the plan did not anticipate, documented above under
Phase C — without it, opening the dashboard guard to admins would have introduced a real
cross-staff data-leak bug rather than the "zeroed figures" the plan assumed.

## Full staff-page → endpoint map

Every route each staff page calls, and the guard now protecting it. `(new)` marks a route or
guard widening added by this set.

**`/staff` (dashboard)**
- `GET /api/staff/dashboard` → `staffDashboardViewer` `{types: [STAFF, ADMIN]}` *(new — was
  STAFF-only, P5)*

**`/staff/pos`**
- `GET /api/staff/products` → `staffProductLookupOrAdmin` `{anyPages: [STAFF_PRODUCTS, STAFF_POS,
  STAFF_REPAIRS]}` *(widened, P3)*
- `GET /api/staff/pos-clients/search` → `staffPosOrPosClientsOrAdmin` `{anyPages: [STAFF_POS,
  STAFF_POS_CLIENTS]}` *(same OR semantics as before, now via `anyPages` instead of the inline
  guard)*
- `POST /api/staff/pos-clients` (quick create) → `staffPosClientsOrAdmin` `{pages:
  [STAFF_POS_CLIENTS]}` *(pre-existing, unchanged — noted, not in scope)*
- `POST/PATCH/DELETE /api/staff/sales(/:id)`, `POST /api/staff/sales/:id/confirm` →
  `staffPosOrAdmin` `{pages: [STAFF_POS]}` *(unchanged)*
- `GET /api/client-categories` → `staffOrAdmin` *(unchanged)*

**`/staff/pos-clients`** *(new page)*
- `GET/PATCH /api/staff/pos-clients(/:id)` → `staffPosClientsOrAdmin` `{pages:
  [STAFF_POS_CLIENTS]}` *(new routes)*
- `GET /api/staff/sales` (detail drawer's Sales tab) → `staffSalesListOrAdmin` `{anyPages:
  [STAFF_SALES, STAFF_POS_CLIENTS]}` *(new)*
- `GET /api/staff/client-payments` (Payments tab) → `staffPaymentsReadOrAdmin` `{anyPages:
  [STAFF_INVOICES, STAFF_POS_CLIENTS]}` *(new)*

**`/staff/products`**
- `GET /api/staff/products` → `staffProductLookupOrAdmin` *(widened, P3, shared with POS/repairs)*

**`/staff/orders`**
- `GET /api/staff/orders`, `GET /api/staff/orders/stats`, `PATCH /api/staff/orders/:id/status` →
  `staffOrdersOrAdmin` `{pages: [STAFF_ORDERS]}` *(unchanged)*
- `POST /api/staff/orders/:id/cancel`, `POST /api/staff/orders/:id/return` →
  `staffOrdersOrAdmin` *(new routes, D-1)*
- `GET /api/admin/products/:id` (live availability re-check) → `adminOnly` — **still admin-only**,
  fired only when `scope === "admin"` client-side; no staff by-id product route exists (documented
  pre-existing gap, unchanged by this set)

**`/staff/sales`**
- `GET /api/staff/sales` → `staffSalesListOrAdmin` *(widened for POS-clients drawer reuse)*
- `GET /api/staff/sales/:reference` → `staffOrAdmin` (no page restriction; owner-or-admin +
  margin gating live in the service) *(unchanged)*
- `GET /api/staff/returns`, `POST /api/staff/returns` → `staffSalesOrAdmin` `{pages:
  [STAFF_SALES]}` *(new routes, D-2)*
- `GET /api/admin/users` (seller filter), `GET /api/staff/pos-clients/search` (POS-client filter)
  → both fire **only when `scope === "admin"`** client-side (unchanged; the seller filter's
  backend route is `adminOnly` regardless)

**`/staff/invoices`**
- `GET /api/staff/invoices(/:number)(/pdf)`, `POST /api/staff/client-payments` →
  `staffInvoicesOrAdmin` `{pages: [STAFF_INVOICES]}` — **the outgoing tab now actually uses this**
  for both scopes (was `/clients/me/invoices`, `clientOnly`, for staff — P1)
- Incoming tab (`usePurchasingInvoices`), Payments tab (`usePurchasingPayments`,
  `useClientPayments`) → admin-only client-side gates, unchanged; their backend routes remain
  admin-only (supplier invoices have no staff surface, §1.3 of the plan)

**`/staff/repairs`**
- `GET/POST/PATCH /api/staff/repairs(/:id)`, parts, status, payments → `staffRepairsOrAdmin`
  `{pages: [STAFF_REPAIRS]}` *(unchanged)*
- `GET /api/staff/repair-technicians` (Technicians tab) → `staffRepairsOrAdmin` *(new, D-3)*
- `GET /api/staff/technicians` (intake assignment dropdown) → `staffRepairsOrAdmin` *(new, P2)*
- `GET /api/staff/products` (spare-part picker) → `staffProductLookupOrAdmin` *(widened, P3)*
- `POST /api/staff/brands`, `POST /api/staff/models` (create-if-absent) → `staffRepairsOrAdmin`
  *(new routes, P4)*
- Adding a technician (`POST /api/admin/technicians`) stays `adminOnly` and is simply not
  reachable from staff scope — `TechniciansTab` hides the button (D-3)

**Surfaces confirmed to have no staff route, and none created here:** `/admin/inventory`,
`/admin/supplier-invoices` (+ editor), `/admin/suppliers`, `/admin/clients` (+ detail),
`/admin/statistics`, `/admin/logs`, `/admin/staff-searches`, `/admin/users`, `/admin/settings`,
`/admin/products/add`, `/admin/products/:id`.

## Money/stock arithmetic

**Unchanged.** Every widened or new staff route reuses the exact same controller handler and
service method the admin route already called (cancel/return/payment-list/technician-create are
untouched); S18 only changed *who may call them* and *which URL they are called at*. The one
service-level change (Phase C's `getStaffDashboard` fix) touches read-only dashboard aggregation,
not a money or stock write path — hard rule 6 is untouched.

## Validation gate (D12 — no test file read, edited, or run)

| Package | `tsc --noEmit` | `lint` (touched files) |
|---|---|---|
| `Apps/contract` | clean | not applicable (no eslint config in this package) |
| `Apps/api` | `src/**` clean (verified: zero `error TS` lines outside `test/**`) | clean on every touched file |
| `Apps/web` | clean | clean on every touched file — one pre-existing prettier finding at `useCatalogTaxonomy.ts:90` (inside the untouched `useCatalogModels` signature, confirmed via diff) was left alone per the standing "pre-existing noise, not fixed" convention |

No test file was read, edited, or run.

## Manual verification checklist (browser)

Reproduced from the plan's §6. Prepare **five** staff users, each with exactly one role granting
exactly one page — POS, POS clients, orders, sales, repairs — plus one admin. Keep the browser
devtools Network tab open throughout: several checks are "no request 403s," which the UI alone
will not show.

**A. The four 403s**

1. Sign in as the **repairs-only** staff user → `/staff/repairs`. The board loads. Open the
   intake dialog: the **technician dropdown is populated**. Network shows
   `GET /api/staff/technicians` → 200, and **no** call to `/api/admin/technicians`.
2. In the same dialog, create a new brand and a new model via the autocomplete's create-if-absent
   → both succeed (`POST /api/staff/brands` / `/api/staff/models` → 201).
3. Open a repair ticket → the spare-part picker returns products
   (`GET /api/staff/products` → 200), even though this user does not hold the products page.
4. Sign in as the **POS-only** staff user → `/staff/pos`: the product search returns results on
   the same endpoint, still 200.
5. Sign in as any staff user holding **invoices** → `/staff/invoices` opens on the Outgoing tab
   and **lists invoices**. Network shows `GET /api/staff/invoices` → 200 and **no** call to
   `/clients/me/invoices`. Click a row → the snapshot opens; Download PDF works.
6. As **admin** → `/admin/invoices`: Outgoing still lists; confirm no `/clients/me/invoices`
   request fires in the background.
7. As **admin** → `/staff` (the staff dashboard): it loads with no 403. "My sales today" and "My
   drafts" show as empty/zero for the admin; pending-orders and low-stock figures are the real
   global ones. As a staff user, `/staff` still loads and shows their own real figures.

**B. Orders parity (D-1)**

8. As the **orders-only** staff user → `/staff/orders`: the table shows the **user** and
   **client category** columns and an **actions** column.
9. The action menu on a given row offers only the transitions legal for that order's type/state.
10. Advance a pickup order `PACKAGED → COMPLETED` → the price/payment prompt appears and succeeds.
11. Cancel a `CONFIRMED` order from the action menu → succeeds
    (`POST /api/staff/orders/:id/cancel` → 200) and the reservation is released.
12. Return a `COMPLETED` order → succeeds (`POST /api/staff/orders/:id/return` → 200).
13. Row click still opens the show dialog; tabs, search and date filters are unchanged.
14. As **admin** → `/admin/orders`: everything above still works on `/api/admin/…` paths.

**C. Sales parity (D-2)**

15. As the **sales-only** staff user → `/staff/sales`: a **Sales / Returns** tab bar is present.
16. Returns tab lists returns (`GET /api/staff/returns` → 200); clicking a row opens the returned
    products with their returned prices.
17. Sales tab → open a `COMPLETED` sale → **Issue return** is offered; issue a partial return →
    succeeds (`POST /api/staff/returns` → 201) and the sale becomes `PARTIALLY_RETURNED`.
18. In that same drawer, **profit is not shown**, no before/after credit block, no seller column.
19. As **admin** → `/admin/sales`: profit, seller column and footer total are still there, and the
    Returns tab still works on the `/api/admin/…` paths.

**D. Repairs parity (D-3)**

20. As the **repairs-only** staff user → `/staff/repairs`: a **Board / Technicians** tab bar is
    present. The Technicians tab lists technicians with per-status counts and revenue
    (`GET /api/staff/repair-technicians` → 200).
21. That tab shows **no "Add technician" button** for staff.
22. As **admin** → `/admin/repairs` → Technicians: the Add button **is** there and still works.
23. On a repair ticket as staff, per-part **profit is still hidden**.

**E. POS clients (D-5)**

24. As the **POS-clients-only** staff user: the sidebar entry "POS Clients" is now a **real link**
    → `/staff/pos-clients` opens.
25. The table lists POS clients (`GET /api/staff/pos-clients` → 200) and paginates.
26. Add a client with a category → created (`POST /api/staff/pos-clients` → 201). Edit it →
    saved (`PATCH /api/staff/pos-clients/:id` → 200).
27. The category field is a dropdown showing the **name** after selection, no create-new row.
28. Click a row → the drawer opens with **Sales**, **Payments** and **Credit history** all
    populated.
29. For a POS client linked to a user account, the arrow to `/admin/clients/:id` is **absent** in
    staff scope, and still present in admin scope.
30. A staff user without the POS-clients page sees the sidebar entry hidden entirely, and typing
    `/staff/pos-clients` bounces them back to `/staff`.

**F. No regressions where nothing should have changed**

31. `/staff/pos`: drafts, client attach, quick-add-client, confirm and the receipt all behave as
    before.
32. `/staff/products` and `/admin/products`: search by name and by barcode both still work.
33. `/admin/inventory`, `/admin/supplier-invoices`, `/admin/suppliers`, `/admin/clients`,
    `/admin/statistics`, `/admin/users`, `/admin/settings` all load for admin and are **not**
    reachable by any staff user.
34. Sign out from `/staff` and from `/admin` both still redirect to login immediately.
35. Navigating between staff pages lands at the top of the page.
36. A bad URL under `/staff/...` still renders the shell-less 404.

## Handoffs

This is the final set of the Stage-04 programme — no further sets depend on it. The staff-page →
endpoint map above is the permanent record of the permission model the plan asked for.
