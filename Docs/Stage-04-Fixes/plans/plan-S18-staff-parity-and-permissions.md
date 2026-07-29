# Plan — Set 18: Staff parity & permissions *(last set)*

Source: `Docs/Stage-04-Fixes/app-issues-01.md` §S18.
Branch: `stage-04-fix`. Validation: `tsc --noEmit` + lint only (**D12** — no test file is read,
edited or run; act as if `Apps/api/test/**` and `Apps/web/tests/**` do not exist).

---

## 0. Preconditions

**Every set S1–S17 must have landed and been owner-approved.** S18 is the last set and consumes
all of them. The specific dependencies this plan reads from:

| Set | What S18 consumes |
|---|---|
| S6 | POS is a single shared tree — `report-S06.md` §251: "there is no separate admin POS tree for S18 to reconcile". |
| S7 | Supplier-invoice list columns — no staff twin exists (see §1.3). |
| S8 | `StaffInvoices.tsx` is the shared page; the filter bar landed in both scopes at once. |
| S11 | `OrdersTable` gained `scope`-gated user/category/action columns, explicitly deferring staff parity here. |
| S12 | `StaffSales.tsx` gained a `scope === "admin"`-gated Sales/Returns tab bar, explicitly deferring staff parity here. |
| S13 | Repairs Technicians tab is admin-only; `plan-S13` §447: "S18 aligns staff guards". |
| S17 | `/admin/users` and `/admin/settings` are admin-only surfaces with nothing to mirror (`plan-S17` §5). |

---

## 1. Findings — read before planning any action

Everything below was verified by reading the code, not inferred.

### 1.1 Five of the seven staff pages are literally the same component tree as their admin twin

`AdminPos.tsx`, `AdminOrders.tsx`, `AdminSales.tsx`, `AdminInvoices.tsx` and `AdminRepairs.tsx` are
each a **one-line wrapper** rendering the staff page with `scope="admin"`. Consequence: **every
admin-page change from S6/S8/S11/S12/S13 already exists on the staff page** unless it sits behind
a `scope === "admin"` gate. The parity work is therefore *not* "port admin changes to staff" — it
is "decide which existing `scope` gates open up, and fix the calls that 403".

The complete inventory of `scope === "admin"` gates in the shared tree (grep
`pages/staff -e 'scope === "admin"'`) is the checklist; §3 says what happens to each.

`StaffProducts.tsx` is a genuine separate page, but it is a deliberately read-only lookup (STF-03
§D2: "no image/cost/margin/actions"), and S3's backend widening of `search` to name-or-barcode
landed in the **shared** `staffAdminWhere`, so `/staff/products` already searches by barcode. No
S3 parity work.

### 1.2 Four endpoints a staff page calls today return 403 — confirmed by tracing hook → service → route

| # | Staff surface | Call | Route + guard today | Result |
|---|---|---|---|---|
| **P1** | `/staff/invoices`, Outgoing tab (the page's default tab) | `useMyInvoices` → `getMyInvoices` | `BILLING_ROUTES.MY_INVOICES` = `/clients/me/invoices`, `clientOnly` | **Every** staff user 403s on the main tab. `useMyInvoices(outgoingQuery)` is also called with **no `enabled` gate**, so an *admin* on `/admin/invoices` fires it too and 403s in the background. |
| **P2** | `/staff/repairs`, `IntakeDialog` technician assignment | `useTechnicians()` | `IDENTITY_ROUTES.TECHNICIANS` = `/admin/technicians`, `adminOnly` | Staff holding only `STAFF_REPAIRS` 403s. This is the "technician list" 403 named in the brief. |
| **P3** | `/staff/repairs` spare-part picker **and** `/staff/pos` product search | `useStaffProducts()` | `CATALOG_ROUTES.STAFF_PRODUCTS`, `pages: [STAFF_PRODUCTS]` (AND) | Staff holding repairs-but-not-products, or POS-but-not-products, 403s on the product lookup their page cannot work without. |
| **P4** | `/staff/repairs`, `IntakeDialog` brand/model **create-if-absent** (added by S13) | `useCreateCatalogBrand` / `useCreateCatalogModel` | `CATALOG_ROUTES.ADMIN_BRANDS` / `ADMIN_MODELS` POST, `adminOnly` | Staff can pick an existing brand/model (those GETs are public) but 403s the moment they create one. |

Two more found in the same sweep, both real:

| # | Surface | Cause |
|---|---|---|
| **P5** | An **ADMIN** opening `/staff` | `STATS_ROUTES.STAFF_DASHBOARD` is `requireAuth({ types: [UserType.STAFF] })` — admin is *excluded*. `StaffSidebar.tsx`'s own comment says admins browse `/staff/*` (their `effectivePages()` returns every PageKey), so this is a live contradiction. |
| **P6** | `pages: []` is AND-only | `requireAuth`'s `pages` option requires **every** listed key. `clients.routes.ts` already needed OR semantics once and hand-rolled an inline `posSearchPagesGuard` for it, with a comment predicting the redesign. P3 and the new POS-clients page both need OR. |

### 1.3 Surfaces with **no** staff twin — and none is created by this set

`/admin/inventory`, `/admin/supplier-invoices` (+ editor), `/admin/suppliers`, `/admin/clients`
(+ detail), `/admin/statistics`, `/admin/logs`, `/admin/staff-searches`, `/admin/users`,
`/admin/settings`, `/admin/products/add`, `/admin/products/:id`. Their backends are `adminOnly`
and there is no `PageKey` for any of them. **Do not create one.** The owner's decision on the
inventory page (§2, D-4) is explicit.

### 1.4 `PageKey.STAFF_POS_CLIENTS` already exists everywhere except the route

It is in the contract enum, in `prisma/pages.registry.ts` (seeded), in `STAFF_NAV_LINKS`
(`config/nav-links.ts`, with the `staff.nav.posClients` label already translated), and in
`STAFF_PAGE_ORDER`. It is missing only from `STAFF_PAGE_ROUTES` and from `App.tsx`, so the sidebar
currently renders it as the greyed "not shipped yet" span. **No new PageKey, no seed change, no
migration** is needed to ship the page.

---

## 2. Owner decisions (settled — plan to them, do not re-open)

| # | Decision |
|---|---|
| **D-1** | **Orders:** a staff user holding the orders page may do everything an admin can on an order — advance its status, **cancel** it, and **return** it. The user and client-category columns and the action column are shown for staff too. |
| **D-2** | **Sales:** staff holding the sales page gets the **Returns tab and the issue-return action**. Profit, seller and footer-total remain admin-only (they are margin data, gated for the same reason `SaleDetailDrawer` gates `line.profit`). |
| **D-3** | **Repairs:** staff holding the repairs page **sees** the Technicians tab (list + per-technician stats) but **cannot add a technician** — the Add button is admin-only. |
| **D-4** | **Inventory:** no staff inventory page, now or in this set. Stock levels, the movement ledger, reservations and adjustments stay admin-only. |
| **D-5** | **POS clients:** the new `/staff/pos-clients` page is **full parity** with `/admin/pos-clients`, including the detail drawer's Sales, Payments and Credit-history tabs. |
| **D-6** | **All four 403s (P1–P4) are fixed in this set**, via an `anyPages` (OR) option on `requireAuth` plus staff route twins. |

**One reading to confirm before executing D-3:** the owner wrote "can see the repairs but can not
add a new one" in answer to a question about the *Technicians tab*, so it is read as "sees
technicians, cannot add a technician". Staff creating **repair tickets** stays untouched —
`REPAIR_ROUTES.STAFF_CREATE` has been open to `STAFF_REPAIRS` holders since set-03 and the whole
staff intake flow depends on it. If the owner meant staff may not create repair tickets, that is a
one-line change in `StaffRepairs.tsx` (hide the intake button) plus a guard flip; ask before
assuming.

---

## 3. Parity matrix — every `scope === "admin"` gate in the shared tree

Grep `pages/staff` for `scope === "admin"` and resolve each hit against this table. **Nothing not
listed here changes.**

| File | Gate | Verdict |
|---|---|---|
| `orders/components/OrdersTable.tsx` (user + category columns, actions column, skeleton width) | admin-only | **Opens to staff** (D-1) — remove the gate |
| `orders/StaffOrders.tsx` (`onAction`, `onCancel`, `onReturn`, cancel/return dialogs) | admin-only | **Opens to staff** (D-1) |
| `orders/components/OrderShowDialog.tsx` (`showCancel`, `showReturn`) | admin-only | **Opens to staff** (D-1) |
| `orders/StaffOrders.tsx` line ~102 (`useAdminCatalogProduct` live availability) | admin-only | **Stays admin-only** — `CATALOG_ROUTES.ADMIN_PRODUCT_BY_ID` is `adminOnly` and there is no staff by-id product route. Keep the documented gap. |
| `sales/StaffSales.tsx` (`canReturn`, `useReturns` ×2, tab bar, `ReturnDialog`/`ReturnDetailDialog`) | admin-only | **Opens to staff** (D-2) |
| `sales/components/SaleDetailDrawer.tsx` line ~119 (`onIssueReturn`) | admin-only | **Opens to staff** (D-2) |
| `sales/components/SaleDetailDrawer.tsx` lines ~65, ~93, ~112 (`line.profit`, credit before/after, invoice number) | admin-only | **Stays admin-only** (D-2 — margin data) |
| `sales/components/SalesTable.tsx` (seller column, footer total, skeleton width) | admin-only | **Stays admin-only** (D-2) |
| `sales/components/SalesFilters.tsx` line ~70 (seller / POS-client filters) | admin-only | **Stays admin-only** — they resolve through `useUsers`, an `adminOnly` endpoint |
| `sales/StaffSales.tsx` lines ~51-76 (`useUsers`, `usePosClientSearch`, from/to) | admin-only | **Stays admin-only** (same reason) |
| `repairs/StaffRepairs.tsx` line ~241 (Technicians tab bar) | admin-only | **Opens to staff** (D-3) |
| `repairs/components/RepairTicketDetail.tsx` line ~145 (`part.profit`) | admin-only | **Stays admin-only** (margin data) |
| `invoices/StaffInvoices.tsx` incoming/payments tabs, cancel button, supplier payment dialog, `showSource` | admin-only | **Stays admin-only** — supplier invoices and invoice cancellation are admin surfaces (§1.3) |
| `invoices/components/InvoiceSnapshotView.tsx` (`line.profit`, admin block) | admin-only | **Stays admin-only** |
| `pos/StaffPos.tsx` (`groupByStaff`, drafts title) | admin-only | **Stays as-is** — correct by design (staff sees own drafts) |
| every `scope === "admin" ? t("admin.…") : t("staff.…")` page title | — | untouched |

**Translation-key rule for this set:** a label whose wording is identical in both scopes keeps its
existing key even if that key is `admin.`-prefixed (the programme already carries the mirror image
— `staff.orders.table.user` is rendered only for admin today). Only add a `staff.*` twin key where
the copy genuinely differs. This keeps key churn near zero.

---

## 4. Action list — execute in this order

### Phase A — the auth primitive

#### Action 1 — `Apps/api/src/common/middlewares/auth.middleware.ts`

Add an OR counterpart to `pages` (P6). Keep `pages` exactly as it is.

```ts
type RequireAuthOptions = {
  types?: UserType[];
  checkDB?: boolean;
  optional?: boolean;
  // `pages`: STAFF must hold every listed page in their enabled roles' union (AND, DB-checked,
  // mirrors identity's effectivePages); ADMIN always bypasses.
  pages?: PageKey[];
  // `anyPages` (S18): STAFF must hold at least ONE of the listed pages (OR); ADMIN always
  // bypasses. Several endpoints back more than one staff page — the product lookup serves the
  // products, POS and repairs pages; the client-payment list serves invoices and POS clients.
  // Both options may be combined; each is evaluated independently.
  anyPages?: PageKey[];
};
```

Inside the handler, keep the existing `pages` block, then add — reusing the **same** effective-key
set so a route using both options runs one query, not two. Refactor the existing block minimally:

```ts
      const needsPageCheck =
        payload.type !== UserType.ADMIN &&
        ((options.pages?.length ?? 0) > 0 || (options.anyPages?.length ?? 0) > 0);

      if (needsPageCheck) {
        const userRoles = await prisma.userRole.findMany({
          where: { userId: payload.sub },
          include: { role: { include: { rolePages: { include: { page: true } } } } },
        });
        const effectiveKeys = new Set<string>();
        for (const userRole of userRoles) {
          if (!userRole.role.isEnabled) continue;
          for (const rolePage of userRole.role.rolePages) effectiveKeys.add(rolePage.page.key);
        }

        const missing = (options.pages ?? []).filter((page) => !effectiveKeys.has(page));
        if (missing.length > 0) {
          throw new ForbiddenError('Insufficient permissions', { missingPages: missing });
        }

        const anyPages = options.anyPages ?? [];
        if (anyPages.length > 0 && !anyPages.some((page) => effectiveKeys.has(page))) {
          throw new ForbiddenError('Insufficient permissions', { missingPages: anyPages });
        }
      }
```

The `ForbiddenError` detail shape is unchanged (`{ missingPages }`), so nothing downstream needs
to change.

#### Action 2 — `Apps/api/src/modules/clients/clients.routes.ts`

Delete the hand-rolled `posSearchPagesGuard` (and, if they become unused, the now-dead
`Request`/`Response`/`NextFunction`/`ForbiddenError`/`identityService` imports — check each with
grep before removing). Replace both `posSearchGuard, posSearchPagesGuard` usages on
`POS_CLIENT_ROUTES.SEARCH` with one guard:

```ts
// S18 — was a hand-rolled inline OR guard (requireAuth's `pages` is AND-only); folded into the
// new `anyPages` option, which expresses the spec's "STAFF_POS or STAFF_POS_CLIENTS" directly.
const staffPosOrPosClientsOrAdmin = requireAuth({
  types: [UserType.STAFF, UserType.ADMIN],
  anyPages: [PageKey.STAFF_POS, PageKey.STAFF_POS_CLIENTS],
  checkDB: true,
});
```

Also update the `staffPosClientsOrAdmin` comment above it — the sentence "no OR guard needed" now
reads oddly next to an OR guard; say instead that this one is a single-page AND check while the
search route needs the OR.

Behavioral equivalence to state in the report: the old guard also ran `checkDB: true`; the new one
keeps it.

### Phase B — contract route constants

All in `Apps/contract/src/modules/*/…routes.ts`. Every new path follows the module's existing
`STAFF_x` / `ADMIN_x` literal-pair convention.

#### Action 3 — `identity/identity.routes.ts`

```ts
  // S18 — the staff repairs page assigns a technician at intake, so it needs the list; the
  // create/update endpoints stay admin-only (D-3).
  STAFF_TECHNICIANS: '/staff/technicians',
```

#### Action 4 — `catalog/catalog.routes.ts`

```ts
  // S18 — repairs intake creates a brand/model when absent (S13). The read routes (BRANDS,
  // MODELS) are already public; only creation needed a staff-reachable path.
  STAFF_BRANDS: '/staff/brands',
  STAFF_MODELS: '/staff/models',
```

#### Action 5 — `orders/orders.routes.ts`

Rename and extend (D-1):

```ts
  ADMIN_CANCEL: '/admin/orders/:id/cancel',   // was CANCEL
  ADMIN_RETURN: '/admin/orders/:id/return',   // was RETURN
  STAFF_CANCEL: '/staff/orders/:id/cancel',
  STAFF_RETURN: '/staff/orders/:id/return',
```

`MY_CANCEL: '/orders/:id/cancel'` (client-facing) is a different path — leave it alone. Fix the
two `ORDER_ROUTES.CANCEL` / `.RETURN` references in `Apps/api/src/modules/orders/orders.routes.ts`
and the two in `Apps/web/src/services/orders.service.ts` (Actions 12 and 16).

#### Action 6 — `sales/sales.routes.ts`

Rename and extend (D-2), keeping the module's existing "same path, two constants, distinguished by
verb" convention and its comment:

```ts
  ADMIN_RETURN: '/admin/returns',          // was RETURN        (POST)
  ADMIN_RETURNS_LIST: '/admin/returns',    // was RETURNS_LIST  (GET)
  STAFF_RETURN: '/staff/returns',          // POST
  STAFF_RETURNS_LIST: '/staff/returns',    // GET
```

#### Action 7 — `billing/billing.routes.ts`

```ts
  ADMIN_CLIENT_PAYMENTS_LIST: '/admin/client-payments',   // was CLIENT_PAYMENTS_LIST (GET)
  // S18 — same path as STAFF_CLIENT_PAYMENTS, distinguished by verb (GET vs POST), same
  // convention as SALE_ROUTES.DELETE_DRAFT/UPDATE_DRAFT. Backs the staff POS-clients drawer's
  // Payments tab (D-5).
  STAFF_CLIENT_PAYMENTS_LIST: '/staff/client-payments',   // GET
```

#### Action 8 — `clients/clients.routes.ts` (`POS_CLIENT_ROUTES`)

```ts
  // S18 — the staff POS-clients page (D-5). Creation reuses QUICK_CREATE: it already validates
  // the full `CreatePosClientSchema` and its service method is literally `createPosClientRow`,
  // the same one the admin POST calls — so no third create path is needed.
  STAFF_LIST: '/staff/pos-clients',        // GET  (SEARCH is '/staff/pos-clients/search')
  STAFF_BY_ID: '/staff/pos-clients/:id',   // PATCH
```

#### Action 9 — `repairs/repairs.routes.ts`

```ts
  // S18 — staff Technicians tab (D-3). Mounted outside '/staff/repairs/…' for the same reason
  // ADMIN_TECHNICIAN_STATS is: it must not be swallowed by STAFF_BY_ID's uuid-validated ':id'.
  STAFF_TECHNICIAN_STATS: '/staff/repair-technicians',
```

### Phase C — backend route wiring

#### Action 10 — `Apps/api/src/modules/catalog/catalog.routes.ts`

1. Widen the existing `staffProductsOrAdmin` (P3):

```ts
// S18 — the staff product lookup backs three staff pages: the products page itself, the POS
// product search, and the repairs spare-part picker. AND-semantics on STAFF_PRODUCTS 403'd a
// POS-only or repairs-only staff on a call their page cannot work without.
const staffProductLookupOrAdmin = requireAuth({
  types: [UserType.STAFF, UserType.ADMIN],
  anyPages: [PageKey.STAFF_PRODUCTS, PageKey.STAFF_POS, PageKey.STAFF_REPAIRS],
  checkDB: true,
});
```
   Rename the constant at its declaration (~line 80) and at its single use on
   `CATALOG_ROUTES.STAFF_PRODUCTS` (~line 111). Preserve whatever `checkDB` the original had.

2. Add a repairs-intake guard and mount the two new creation routes **next to** their admin
   equivalents, reusing the same controller handlers and body schemas (P4):

```ts
const staffRepairsOrAdmin = requireAuth({
  types: [UserType.STAFF, UserType.ADMIN],
  anyPages: [PageKey.STAFF_REPAIRS],
  checkDB: true,
});

router.post(CATALOG_ROUTES.STAFF_BRANDS, staffRepairsOrAdmin, validateRequest({ body: CreateBrandSchema }), controller.createBrand);
router.post(CATALOG_ROUTES.STAFF_MODELS, staffRepairsOrAdmin, validateRequest({ body: CreateModelSchema }), controller.createModel);
```
   (Copy the exact schema names from the adjacent admin `router.post` calls — do not guess them.)
   Import `PageKey` if it is not already imported in this file.

#### Action 11 — `Apps/api/src/modules/identity/identity.routes.ts`

Mount the staff technician **list** only (P2, D-3):

```ts
// S18 — the staff repairs intake assigns a technician, so STAFF_REPAIRS holders may read the
// list. Creating/updating a technician stays adminOnly (D-3).
const staffRepairsOrAdmin = requireAuth({
  types: [UserType.STAFF, UserType.ADMIN],
  anyPages: [PageKey.STAFF_REPAIRS],
  checkDB: true,
});
router.get(IDENTITY_ROUTES.STAFF_TECHNICIANS, staffRepairsOrAdmin, controller.listTechnicians);
```
Leave `IDENTITY_ROUTES.TECHNICIANS` (GET/POST/PATCH) `adminOnly`, unchanged. Import `PageKey` and
`UserType` if not already imported.

#### Action 12 — `Apps/api/src/modules/orders/orders.routes.ts`

Rename the two admin mounts to `ORDER_ROUTES.ADMIN_CANCEL` / `ADMIN_RETURN`, then mount the staff
pair with the module's existing `staffOrdersOrAdmin` guard (D-1), reusing the same controller
handlers and body schemas as the admin pair:

```ts
router.post(ORDER_ROUTES.STAFF_CANCEL, staffOrdersOrAdmin, validateRequest({ params: OrderIdParamsSchema, body: CancelOrderSchema }), controller.cancelOrder);
router.post(ORDER_ROUTES.STAFF_RETURN, staffOrdersOrAdmin, validateRequest({ params: OrderIdParamsSchema, body: ReturnOrderSchema }), controller.returnOrder);
```
(Body schema names verified against the two admin lines being renamed: `CancelOrderSchema` and
`ReturnOrderSchema` — note the API schema is *not* called `AdminCancelOrderSchema`, even though
the web-side type alias is `AdminCancelOrderCommand`.) No service
change: cancel and return are identical operations regardless of who performs them, and the
actor is already taken from `req.user`.

#### Action 13 — `Apps/api/src/modules/sales/sales.routes.ts`

1. Rename `SALE_ROUTES.RETURN` / `RETURNS_LIST` usages to `ADMIN_RETURN` / `ADMIN_RETURNS_LIST`.
2. Mount the staff pair with `staffSalesOrAdmin` (D-2), same handlers/schemas:

```ts
router.get(SALE_ROUTES.STAFF_RETURNS_LIST, staffSalesOrAdmin, validateRequest({ query: ReturnListQuerySchema }), controller.listReturns);
router.post(SALE_ROUTES.STAFF_RETURN, staffSalesOrAdmin, validateRequest({ body: CreateReturnSchema }), controller.createReturn);
```
3. Widen the **staff sales list** guard so the POS-clients drawer can read a client's sales (D-5):

```ts
// S18 — also backs the POS-clients detail drawer's Sales tab, whose page key is
// STAFF_POS_CLIENTS, not STAFF_SALES.
const staffSalesListOrAdmin = requireAuth({
  types: [UserType.STAFF, UserType.ADMIN],
  anyPages: [PageKey.STAFF_SALES, PageKey.STAFF_POS_CLIENTS],
  checkDB: true,
});
```
   Use it on `SALE_ROUTES.STAFF_LIST` **only**. `staffSalesOrAdmin` stays as-is for the returns
   routes. `SALE_ROUTES.STAFF_DETAIL` is already the looser `staffOrAdmin` — leave it.

#### Action 14 — `Apps/api/src/modules/billing/billing.routes.ts`

Rename the `CLIENT_PAYMENTS_LIST` mount to `ADMIN_CLIENT_PAYMENTS_LIST`, then add the staff GET
(D-5), same handler and query schema:

```ts
// S18 — backs the POS-clients drawer's Payments tab; STAFF_INVOICES is included so the staff
// invoices page can use the same route if it ever surfaces payments.
const staffPaymentsReadOrAdmin = requireAuth({
  types: [UserType.STAFF, UserType.ADMIN],
  anyPages: [PageKey.STAFF_INVOICES, PageKey.STAFF_POS_CLIENTS],
  checkDB: true,
});
router.get(BILLING_ROUTES.STAFF_CLIENT_PAYMENTS_LIST, staffPaymentsReadOrAdmin, validateRequest({ query: ClientPaymentListQuerySchema }), controller.listClientPayments);
```
**Express ordering:** `/staff/client-payments` already exists as a `POST`; a `GET` on the same
path is a distinct route entry, so order does not matter here — but register the GET adjacent to
the POST for readability.

#### Action 15 — `Apps/api/src/modules/clients/clients.routes.ts` and `repairs/repairs.routes.ts`

1. `clients.routes.ts` — mount the two POS-client staff routes with the existing
   `staffPosClientsOrAdmin` guard, reusing the admin handlers and schemas:

```ts
router.get(POS_CLIENT_ROUTES.STAFF_LIST, staffPosClientsOrAdmin, validateRequest({ query: PosClientListQuerySchema }), controller.listPosClients);
router.patch(POS_CLIENT_ROUTES.STAFF_BY_ID, staffPosClientsOrAdmin, validateRequest({ params: PosClientIdParamsSchema, body: UpdatePosClientSchema }), controller.updatePosClient);
```
   **Register both after the existing `POS_CLIENT_ROUTES.SEARCH` line**, so `/staff/pos-clients/search`
   is matched before `/staff/pos-clients/:id`. (Today only PATCH uses `:id` and SEARCH is a GET, so
   they cannot actually collide — but keep the order anyway, since a future GET-by-id would.)
   Copy the exact params-schema name from the admin PATCH line being mirrored.

2. `repairs.routes.ts` — mount the staff technician-stats route with the module's existing
   `staffRepairsOrAdmin` (D-3):

```ts
router.get(REPAIR_ROUTES.STAFF_TECHNICIAN_STATS, staffRepairsOrAdmin, controller.listTechnicianStats);
```

3. `Apps/api/src/modules/statistics/statistics.routes.ts` — fix P5:

```ts
// S18/P5 — ADMIN was excluded from the staff dashboard, so an admin browsing /staff (which the
// staff sidebar explicitly supports — effectivePages() returns every PageKey for ADMIN) got a
// 403 on the page's only query. `staffOnly` had no other consumer; delete it if so.
const staffDashboardViewer = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], checkDB: true });
router.get(STATS_ROUTES.STAFF_DASHBOARD, staffDashboardViewer, controller.getStaffDashboard);
```
   Before deleting `staffOnly`, grep this file for other uses. **Verified while planning:**
   `statistics.service.ts#getStaffDashboard(staffId)` filters `mySalesToday`/`myDrafts` by
   `staffId` and computes `pendingOrders`/`lowStock` globally — it does **not** throw for a
   non-STAFF viewer. An admin therefore sees zeroed "my" figures plus the real global ones, which
   is correct for a page they are only browsing. No service change; say this in the report.

### Phase D — web services & hooks (scope parameters)

#### Action 16 — `Apps/web/src/services/orders.service.ts`

```ts
export async function cancelBackofficeOrder(
  scope: OrderScope,
  id: string,
  command: AdminCancelOrderCommand,
): Promise<OrderDto> {
  const route = scope === "admin" ? ORDER_ROUTES.ADMIN_CANCEL : ORDER_ROUTES.STAFF_CANCEL;
  …
}

export async function returnOrder(
  scope: OrderScope,
  id: string,
  command: ReturnOrderCommand,
): Promise<OrderDto> {
  const route = scope === "admin" ? ORDER_ROUTES.ADMIN_RETURN : ORDER_ROUTES.STAFF_RETURN;
  …
}
```
`adminCancelOrder` is **renamed** (the old name would now lie). `AdminCancelOrderCommand` keeps its
name — the command shape is genuinely the same document, and renaming it would ripple into the
contract for no gain; note that in the report. The legacy stub `cancelOrder(_orderId: number)` at
the top of this file is untouched.

#### Action 17 — `Apps/web/src/hooks/useOrdersDirectory.ts`

Rename `useAdminCancelOrder` → `useCancelBackofficeOrder` and give both mutations a `scope` in
their variables object; keep every existing `invalidateQueries` fan-out exactly as it is:

```ts
export function useCancelBackofficeOrder() {
  …
    mutationFn: ({ scope, id, command }: { scope: OrderScope; id: string; command: AdminCancelOrderCommand }) =>
      ordersService.cancelBackofficeOrder(scope, id, command),
}
export function useReturnOrder() {
  …
    mutationFn: ({ scope, id, command }: { scope: OrderScope; id: string; command: ReturnOrderCommand }) =>
      ordersService.returnOrder(scope, id, command),
}
```
Call sites to update: `pages/staff/orders/StaffOrders.tsx` only (import list, the two
`const …Mutation = …()` lines, and the two `.mutate({ … })` calls, which must now pass `scope`).

#### Action 18 — `Apps/web/src/services/sales.service.ts` + `hooks/useSales.ts`

```ts
export async function createReturn(scope: SalesScope, command: CreateReturnCommand): Promise<SaleDto> {
  const route = scope === "admin" ? SALE_ROUTES.ADMIN_RETURN : SALE_ROUTES.STAFF_RETURN;
  …
}
export async function listReturns(scope: SalesScope, query: ReturnListQuery): Promise<PaginatedResult<ReturnDto>> {
  const route = scope === "admin" ? SALE_ROUTES.ADMIN_RETURNS_LIST : SALE_ROUTES.STAFF_RETURNS_LIST;
  …
}
```
Hooks:
```ts
export function useReturns(scope: SalesScope, query: ReturnListQuery, options?: { enabled?: boolean }) {
  return useQuery({ queryKey: qk.sales.returns(scope, query), … });
}
export function useCreateReturn() {  // variables gain `scope`
  mutationFn: ({ scope, command }: { scope: SalesScope; command: CreateReturnCommand }) => …
}
```
**Query key:** `qk.sales.returns` gains a `scope` member —
`returns: (scope: string, query?: unknown) => ["sales", "returns", scope, query] as const`
(`lib/query-keys.ts` ~line 141). This is the same collision fix already applied to
`qk.orders.list` and `qk.sales.list`: without it, the staff and admin variants of the same filter
object share one cache entry. It stays nested under `["sales", …]`, so `useCreateReturn`'s existing
`qk.sales.all()` invalidation still reaches it — update that key's comment accordingly.

#### Action 19 — `Apps/web/src/services/billing.service.ts` + `hooks/useBilling.ts`

```ts
export async function listClientPayments(
  scope: BillingScope,
  query: ClientPaymentListQuery,
): Promise<PaginatedResult<ClientPaymentDto>> {
  const route =
    scope === "admin"
      ? BILLING_ROUTES.ADMIN_CLIENT_PAYMENTS_LIST
      : BILLING_ROUTES.STAFF_CLIENT_PAYMENTS_LIST;
  …
}
```
Delete the now-false comment "Admin-only (no STAFF list route exists for payments…)" above it and
replace it with the S18 reason. Hook: `useClientPayments(scope, query, options?)`, key
`qk.billing.payments.list(scope, query)` — add the `scope` member to that key for the same
collision reason as Action 18. Call sites: `StaffInvoices.tsx` (passes `scope`) and the POS-clients
page (Action 22).

#### Action 20 — `Apps/web/src/services/clients.service.ts` + `hooks/usePosClients.ts`

```ts
export async function listPosClients(scope: PosClientsScope, query: PosClientListQuery) {
  const route = scope === "admin" ? POS_CLIENT_ROUTES.ADMIN : POS_CLIENT_ROUTES.STAFF_LIST;
  …
}
export async function createPosClient(scope: PosClientsScope, command: CreatePosClientCommand) {
  // staff creates through QUICK_CREATE — same schema, same service method (createPosClientRow)
  const route = scope === "admin" ? POS_CLIENT_ROUTES.ADMIN : POS_CLIENT_ROUTES.QUICK_CREATE;
  …
}
export async function updatePosClient(scope: PosClientsScope, id: string, command: UpdatePosClientCommand) {
  const route = scope === "admin" ? POS_CLIENT_ROUTES.ADMIN_BY_ID : POS_CLIENT_ROUTES.STAFF_BY_ID;
  …
}
```
Declare `export type PosClientsScope = "staff" | "admin";` in this service (mirroring
`SalesScope`/`BillingScope`). `quickCreatePosClient` stays as its own function — POS's quick-add
uses it directly and must not change. Hooks `usePosClientsList` / `useCreatePosClient` /
`useUpdatePosClient` take `scope`; `qk.posClients.list` gains a `scope` member.

#### Action 21 — `Apps/web/src/services/identity.service.ts`, `repairs.service.ts`, `catalog.service.ts` + their hooks

| Function | Change |
|---|---|
| `identity.service.listTechnicians()` | `listTechnicians(admin = true)` → `admin ? IDENTITY_ROUTES.TECHNICIANS : IDENTITY_ROUTES.STAFF_TECHNICIANS`; hook `useTechnicians(admin = true)`; key `qk.identity.technicians.all()` gains the flag (mirror `qk.catalog.brands.list(admin)`). |
| `repairs.service.listTechnicianStats()` | `listTechnicianStats(scope: RepairsScope)`; hook `useTechnicianRepairStats(scope)`; key `qk.repairs.technicianStats(scope)` — and delete that key's comment "admin-only; no scope member (there is no staff route)", which this action makes false. |
| `catalog.service.createBrand` / `createModel` | add a trailing `admin = true` parameter selecting `ADMIN_BRANDS`/`STAFF_BRANDS` and `ADMIN_MODELS`/`STAFF_MODELS`; hooks `useCreateCatalogBrand(admin = true)` / `useCreateCatalogModel(admin = true)`. Defaulting to `true` keeps every existing admin caller (`AdminSettings`, `AdminProductsAdd`, `quick-add-product-dialog`) unchanged. |
| `useStaffProducts` | **no change** — the fix is the backend guard (Action 10). |

### Phase E — the staff POS-clients page (D-5)

#### Action 22 — turn `AdminPosClients` into a scoped twin

1. **Move** `Apps/web/src/pages/admin/pos-clients/AdminPosClients.tsx` to
   `Apps/web/src/pages/staff/pos-clients/StaffPosClients.tsx`, renaming the default export to
   `StaffPosClients` and adding the twin's standard prop:

```tsx
interface Props {
  scope?: "staff" | "admin";
}
export default function StaffPosClients({ scope = "staff" }: Props) {
```
   Leave `pages/admin/pos-clients/components/**` exactly where it is and import from there — the
   shared tree already cross-imports admin components (`StaffSales.tsx` imports `ReturnsTable`,
   `ReturnDialog` and `ReturnDetailDialog` from `pages/admin/sales/components/`).

2. Replace the file with a one-line wrapper at the old path:

```tsx
import StaffPosClients from "@/pages/staff/pos-clients/StaffPosClients";

// S18 — same table/dialogs/drawer tree as the staff page, admin-scoped (adds the linked-account
// link). Mirrors AdminPos/AdminOrders/AdminSales/AdminInvoices/AdminRepairs.
export default function AdminPosClients() {
  return <StaffPosClients scope="admin" />;
}
```

3. Inside the moved page, thread `scope` through every call touched in Phase D:
   `usePosClientsList(scope, clientsQuery)`, `useCreatePosClient()` /`useUpdatePosClient()`
   mutations now carrying `scope` in their variables, `useSales(scope, detailQuery, …)`,
   `useClientPayments(scope, detailQuery, …)`.
   The page header becomes
   `title={scope === "admin" ? t("admin.posClients.title") : t("staff.posClients.title")}` and
   likewise for the subtitle — the two other twins do exactly this.

4. `pages/admin/pos-clients/components/pos-clients-table.tsx` gains `scope?: "staff" | "admin"`
   and renders the linked-account `<Link to={/admin/clients/:id}>` (~line 78) **only when
   `scope === "admin"`** — there is no staff clients page, so for staff the link would 404 into a
   RoleGuard bounce. Show nothing in that cell for staff.

#### Action 23 — route, guard and sidebar

1. `Apps/web/src/lib/staff-pages.ts` — add the missing entry (§1.4):

```ts
  [PageKey.STAFF_POS_CLIENTS]: "/staff/pos-clients",
```
   and update the file's comment, which says entries are added "as each destination page lands in
   a later page set" — this is that set for POS clients.

2. `Apps/web/src/App.tsx` — add the lazy import and the guarded route, in `PageKey` order (between
   the POS and Products blocks):

```tsx
const StaffPosClients = lazy(() => import("@/pages/staff/pos-clients/StaffPosClients"));
…
          {
            element: <PageGuard requires={PageKey.STAFF_POS_CLIENTS} />,
            children: [
              {
                path: "/staff/pos-clients",
                element: withSuspense(StaffPosClients),
                errorElement: <RouteErrorBoundary />,
              },
            ],
          },
```
   No change to `AdminPosClients`'s existing `/admin/pos-clients` route.

3. Nothing to do in `config/nav-links.ts` (the entry exists) or `prisma/pages.registry.ts` (the
   page is seeded). The greyed "not shipped yet" span in `StaffSidebarNav` turns into a real link
   automatically once `STAFF_PAGE_ROUTES` has the entry.

### Phase F — opening the parity gates

#### Action 24 — orders (D-1)

- `pages/staff/orders/components/OrdersTable.tsx`: delete the `if (scope === "admin")` around the
  user + category columns and the one around the actions column (keep `&& onAction` — the prop
  still decides whether the column exists). Skeleton width becomes a constant `12`. `scope` may
  become unused here; if so remove the prop **and** its pass-down in `StaffOrders.tsx`, and check
  no other consumer passes it.
- `pages/staff/orders/components/OrderShowDialog.tsx`: `showCancel` /`showReturn` drop the
  `scope === "admin" &&` term, keeping the `order.canBeCancelled` / `status === COMPLETED` and
  `!!onCancel` / `!!onReturn` conditions. If `scope` becomes unused, remove it the same way.
- `pages/staff/orders/StaffOrders.tsx`: `onAction={handleRowAction}` unconditionally; `onCancel` /
  `onReturn` lose their `scope === "admin" &&` guards; the `{scope === "admin" && (…)}` wrapper
  around `AdminCancelOrderDialog` + `ReturnOrderDialog` is removed; both mutations now pass
  `scope` (Action 17). The `useAdminCatalogProduct` line at ~102 **keeps** its admin gate (§3).
- Update every comment that says these affordances are admin-only — at minimum the S11 comments in
  `OrdersTable.tsx` (~line 320 of the plan text, the `scope`/`onAction` prop doc) and the header
  comments of `cancel-order-dialog.tsx` and `return-order-dialog.tsx`, which both open with
  "Admin-only".

#### Action 25 — sales (D-2)

- `pages/staff/sales/StaffSales.tsx`: `canReturn` drops `scope === "admin" &&`; both `useReturns`
  calls take `scope` and lose their admin `enabled` term (the per-sale one keeps
  `enabled: canReturn && !!selectedSale`, the list one becomes unconditional); the tab bar is
  rendered for both scopes (delete the `scope === "admin" ? <Tabs…> : salesSection` branch and
  always render the `Tabs`); the `{scope === "admin" && (<ReturnDialog…><ReturnDetailDialog…>)}`
  wrapper is removed; `returnMutation.mutate` passes `scope`.
- `pages/staff/sales/components/SaleDetailDrawer.tsx` line ~119: `onIssueReturn && …` without the
  scope term. **Leave lines ~65, ~93 and ~112 gated.**
- The seller/POS-client filters, the seller column and the footer total stay admin-only — do not
  touch `SalesFilters.tsx` or `SalesTable.tsx`.
- Update the comments that assert admin-only returns: `StaffSales.tsx` ~line 133 ("the Returns tab,
  admin-only (returns are an admin-only route)") and `qk.sales.returns`'s comment.

#### Action 26 — repairs (D-3)

- `pages/staff/repairs/StaffRepairs.tsx`: render the `Tabs` (Board / Technicians) for **both**
  scopes — delete the `scope === "admin" ? <Tabs…> : board` branch — and pass
  `<TechniciansTab scope={scope} />`. Rewrite the S13/R1 comment above the return, which currently
  explains why the tab is admin-only.
- `pages/admin/repairs/components/TechniciansTab.tsx`: add `scope?: "staff" | "admin"` (default
  `"admin"` so the file reads correctly on its own), pass it to
  `useTechnicianRepairStats(scope)`, and render the **Add technician** button, its dialog and the
  `useCreateTechnician` wiring only when `scope === "admin"`. Update the "S13/R1 — admin-only"
  header comment.
- `pages/staff/repairs/StaffRepairs.tsx` `useTechnicians()` → `useTechnicians(scope === "admin")`
  so a staff caller uses the new staff route (Action 21).
- `pages/staff/repairs/components/IntakeDialog.tsx`: add `scope?: "staff" | "admin"` (passed down
  from `StaffRepairs`) and forward it to `useCreateCatalogBrand(scope === "admin")` /
  `useCreateCatalogModel(scope === "admin")` (Action 21, P4).
- The Technicians **tab label** keys (`admin.repairs.tabs.board` / `.technicians`) are reused
  unchanged per §3's key rule.

#### Action 27 — invoices (P1) — the highest-value single fix

`pages/staff/invoices/StaffInvoices.tsx`:

```tsx
  // S18/P1 — the staff outgoing tab used to call useMyInvoices (`/clients/me/invoices`,
  // clientOnly), so every staff user 403'd on this page's default tab and every admin fired a
  // client-only request in the background. Both scopes now use the scoped billing route.
  const outgoing = useInvoices(scope, outgoingQuery, { enabled: activeTab === "outgoing" });
```
- Delete the `useMyInvoices` / `adminInvoices` pair and the `scope === "admin" ? … : …` selector.
- The detail query becomes one call: `useInvoice(scope, selectedNumber ?? "")`; delete
  `myInvoiceDetail` and the `selectedInvoice` selector.
- The PDF download becomes one branch: `adminPdfMutation.mutate({ scope, number: selectedNumber }, …)`;
  delete `myPdfMutation` and the if/else.
- Remove the now-unused `useMyInvoices` / `useMyInvoice` / `useMyInvoicePdf` imports **from this
  file only** — the three hooks stay in `hooks/useBilling.ts`; the client-facing `/invoices` page
  (`pages/my-invoices/`) is their real consumer. Verify with
  `grep -rn "useMyInvoice" Apps/web/src`.
- `useClientPayments` gains its `scope` argument (Action 19); its `enabled: scope === "admin" && …`
  stays — the payments tab remains admin-only (§3).
- Everything else on this page (incoming tab, cancel, supplier payment dialog, `showSource`) keeps
  its admin gate.

### Phase G — translations

#### Action 28 — `Apps/web/src/config/translations.json`

Only two new keys are needed (§3's key rule keeps the rest at zero):

| Key | en | fr |
|---|---|---|
| `staff.posClients.title` | POS clients | Clients point de vente |
| `staff.posClients.description` | Manage walk-in clients created at the point of sale | Gérez les clients de passage créés au point de vente |

`ar` is `""` per convention. Insert next to the existing `staff.*` page-title block.
**Reused unchanged:** `staff.nav.posClients`, every `admin.posClients.*` key, every
`admin.orders.table.*`, `admin.sales.tabs.*` and `admin.repairs.tabs.*` key.

Before finishing, run the standing check: every `t("…")` literal added or touched in this set must
exist in `translations.json`.

---

## 5. Ripple summary

| Layer | Files |
|---|---|
| prisma | **none** — no migration, no new `PageKey`, no seed change (§1.4) |
| contract routes | `identity`, `catalog`, `orders`, `sales`, `billing`, `clients`, `repairs` `.routes.ts` (7 files, constants only) |
| api middleware | `common/middlewares/auth.middleware.ts` (`anyPages`) |
| api routes | `catalog`, `identity`, `orders`, `sales`, `billing`, `clients`, `repairs`, `statistics` `.routes.ts` (8 files) |
| api services | **none** — every new route reuses an existing controller handler and service method |
| web services | `orders`, `sales`, `billing`, `clients`, `identity`, `repairs`, `catalog` `.service.ts` |
| query keys | `qk.sales.returns`, `qk.billing.payments.list`, `qk.posClients.list`, `qk.repairs.technicianStats`, `qk.identity.technicians.all` each gain a scope/admin member |
| hooks | `useOrdersDirectory`, `useSales`, `useBilling`, `usePosClients`, `useIdentity`, `useRepairs`, `useCatalogTaxonomy` |
| pages | `StaffOrders` + `OrdersTable` + `OrderShowDialog`; `StaffSales` + `SaleDetailDrawer`; `StaffRepairs` + `TechniciansTab` + `IntakeDialog`; `StaffInvoices`; new `StaffPosClients` (moved) + `AdminPosClients` (wrapper) + `pos-clients-table`; `App.tsx`; `lib/staff-pages.ts` |

**No money or stock arithmetic changes in this set.** Cancel, return and payment capture keep the
exact same service methods and transactions they had — S18 only widens *who may call them* and
*which URL they are called at*. Hard rule 6 is untouched.

---

## 6. Manual verification checklist (browser)

Prepare **five** staff users, each with exactly one role granting exactly one page — POS, POS
clients, orders, sales, repairs — plus one admin. Keep the browser devtools **Network tab open**
throughout: several checks below are "no request 403s", which the UI alone will not show.

**A. The four 403s**

1. Sign in as the **repairs-only** staff user → `/staff/repairs`. The board loads. Open the intake
   dialog: the **technician dropdown is populated** (was 403). Network shows
   `GET /api/staff/technicians` → 200, and **no** call to `/api/admin/technicians`.
2. In the same dialog, type a brand name that does not exist and use create-if-absent → the brand
   is created (`POST /api/staff/brands` → 201). Repeat for a model.
3. Open a repair ticket → the spare-part picker returns products (`GET /api/staff/products` →
   200), even though this user does **not** hold the products page.
4. Sign in as the **POS-only** staff user → `/staff/pos`: the product search returns results, same
   endpoint, still 200.
5. Sign in as any staff user holding **invoices** → `/staff/invoices` opens on the Outgoing tab and
   **lists invoices** (was an empty 403 tab). Network shows `GET /api/staff/invoices` → 200 and
   **no** call to `/clients/me/invoices`. Click a row → the snapshot opens; Download PDF works.
6. As **admin** → `/admin/invoices`: Outgoing still lists; confirm the Network tab shows **no**
   `/clients/me/invoices` request at all (the background 403 is gone).
7. As **admin** → `/staff` (the staff dashboard): it loads with no 403 (P5). As a staff user,
   `/staff` still loads exactly as before.

**B. Orders parity (D-1)**

8. As the **orders-only** staff user → `/staff/orders`: the table now shows the **user** and
   **client category** columns and an **actions** column.
9. The action menu on a given row offers only the transitions legal for that order's type and
   state (pickup vs delivery), identical to `/admin/orders`.
10. Advance a pickup order `PACKAGED → COMPLETED` → the price/payment prompt appears and the
    transition succeeds.
11. Cancel a `CONFIRMED` order from the action menu → the reason dialog opens, the cancel succeeds
    (`POST /api/staff/orders/:id/cancel` → 200) and the reservation is released.
12. Return a `COMPLETED` order → the return dialog opens and succeeds
    (`POST /api/staff/orders/:id/return` → 200).
13. Row click still opens the show dialog; the tabs, search and date filters are unchanged.
14. As **admin** → `/admin/orders`: everything above still works, hitting the `/api/admin/…` paths.

**C. Sales parity (D-2)**

15. As the **sales-only** staff user → `/staff/sales`: a **Sales / Returns** tab bar is present.
16. Returns tab lists returns (`GET /api/staff/returns` → 200); clicking a row opens the returned
    products with their returned prices.
17. Sales tab → open a `COMPLETED` sale → **Issue return** is offered; issue a partial return →
    it succeeds (`POST /api/staff/returns` → 201) and the sale becomes `PARTIALLY_RETURNED`.
18. In that same drawer, **profit is not shown**, no before/after credit block and no seller
    column in the table — those stay admin-only.
19. As **admin** → `/admin/sales`: profit, seller column and footer total are still there, and the
    Returns tab still works on the `/api/admin/…` paths.

**D. Repairs parity (D-3)**

20. As the **repairs-only** staff user → `/staff/repairs`: a **Board / Technicians** tab bar is
    present. The Technicians tab lists technicians with their per-status counts and revenue
    (`GET /api/staff/repair-technicians` → 200).
21. That tab shows **no "Add technician" button** for staff.
22. As **admin** → `/admin/repairs` → Technicians: the Add button **is** there and still works.
23. On a repair ticket as staff, per-part **profit is still hidden**.

**E. POS clients (D-5)**

24. As the **POS-clients-only** staff user: the sidebar entry "POS Clients" is now a **real link**
    (previously greyed out) → `/staff/pos-clients` opens.
25. The table lists POS clients (`GET /api/staff/pos-clients` → 200) and paginates.
26. Add a client with a category → created (`POST /api/staff/pos-clients` → 201) and it appears in
    the list. Edit it → saved (`PATCH /api/staff/pos-clients/:id` → 200).
27. The category field is a **dropdown showing the name** after selection, with no create-new row
    (S6/RC-1 behavior, inherited).
28. Click a row → the drawer opens with the **Sales**, **Payments** and **Credit history** tabs
    populated (`GET /api/staff/sales…` and `GET /api/staff/client-payments…` both 200).
29. For a POS client linked to a user account, the **arrow to `/admin/clients/:id` is absent** in
    staff scope, and still present in admin scope.
30. A staff user **without** the POS-clients page sees the sidebar entry hidden entirely, and
    typing `/staff/pos-clients` bounces them back to `/staff`.

**F. No regressions where nothing should have changed**

31. `/staff/pos`: drafts, client attach, quick-add-client, confirm and the receipt all behave as
    they did after S6.
32. `/staff/products` and `/admin/products`: search by name and by barcode both still work.
33. `/admin/inventory`, `/admin/supplier-invoices`, `/admin/suppliers`, `/admin/clients`,
    `/admin/statistics`, `/admin/users`, `/admin/settings` all load for admin and are **not**
    reachable by any staff user (no sidebar entry, direct URL bounces).
34. Sign out from `/staff` and from `/admin` still redirects to login immediately (S2).
35. Navigating between staff pages lands at the **top** of the page (S2 scroll restoration).
36. A bad URL under `/staff/...` still renders the shell-less 404 (S2).

---

## 7. Report requirements (`Docs/Stage-04-Fixes/results/report-S18.md`)

Beyond the standard "what changed / validation gate / checklist", this report must state:

1. **The full staff-page → endpoint map** the audit produced: for each of the seven staff pages,
   every route it calls and the guard now protecting that route. This is the artifact §S18 asks
   for ("map every staff page to the endpoints it calls and align the guards") and the programme's
   permanent record of the permission model.
2. Confirmation that an ADMIN on `/staff` sees zeroed "my sales / my drafts" figures alongside
   real global pending-orders and low-stock figures (Action 15.3) — the one place where opening a
   guard produces odd-looking data rather than none.
3. Any `scope` prop that became unused during Phase F and was therefore removed, so a later reader
   does not go looking for it.
4. That no test file was read, edited or run, and that no money/stock code path changed.
