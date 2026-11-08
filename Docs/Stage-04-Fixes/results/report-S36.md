# Report S36 — Client purchase history: the "Products bought" tab

Plan: `Docs/Stage-04-Fixes/plans/plan-S36-client-purchase-history.md`.
Status: **executed, gates green, awaiting owner review.** This closes sets S34–S36. Nothing is
committed. There is no schema change and no migration. No test file was read for editing, edited
or run. I never opened the web UI (no browser here).

---

## 1. Decisions

### Owner decisions (taken while planning, applied as written)

| # | Question | Answer |
|---|---|---|
| Q1 | Staff drawer: whole history or own sales only? | **The whole history:** every seller, plus the client's orders. No margins appear anyway. |
| Q2 | What does "amount refunded" show? | **Cash refunded** (Σ `ReturnLine.refundAmount`). A return credited to the client's account reads "1 returned, 0 refunded". |
| Q3 | Should a product's total use the stored `lineTotal` or apportion a sale-level discount? | **The stored `lineTotal`**, never recomputed. A note under the table says so. |

### Where the tab landed

- **Admin, web client page** (`/admin/clients/:id`): a sixth tab, **Products bought**, keyed by the
  web Client id.
- **Admin and staff, POS-client detail drawer** (`/admin/pos-clients`, `/staff/pos-clients`): a
  fourth tab, keyed by the PosClient id. The drawer is widened to `sm:max-w-2xl`.

Staff have no client information page; this drawer is their equivalent. The client's own account
page is untouched.

### Plan decisions P1–P10 were applied as written

- **P1:** two endpoints per identity, aggregate and documents, so six routes.
- **P2:** one SQL core fed by `{ posClientId | null, clientId | null }`.
- **P3:** `GROUP BY` over a `UNION ALL`, with returns pre-aggregated per line, paginated in SQL.
- **P4:** most recently bought first, under the current product name.
- **P5:** pages of 10, max 100.
- **P6:** documents newest first. A return links to its source sale or order.
- **P7:** the wider drawer.
- **P8:** one shared component and hook pair, keyed by a web-only owner type.
- **P9:** no invalidation is wired.
- **P10:** no index.

### Small deviations and additions

- **The owner type declares its scope inline** (`"staff" | "admin"`) instead of importing
  `PosClientsScope` from the clients service. The service imports the owner type, so the plan's
  version would have made a type-import cycle. The plan allowed this.
- **Document rows are keyed by page and position,** not `documentId`. A sale holding the same
  product on two lines yields two rows with one `documentId`. The plan missed this.
- **The documents dialog repeats the table's note** in its description, so the "0 refunded"
  explanation is visible where the return rows are.

### What counts as "bought"

- **Sales:** COMPLETED, PARTIALLY_RETURNED or RETURNED. Drafts and cancelled sales are out.
- **Orders:** COMPLETED or RETURNED **with `deliveredAt` set**. `deliveredAt` is stamped only at
  completion, so an order returned straight from IN_DELIVERY never counts.
- **Repair parts are never read.**
- **Returns** appear separately, never netted.
- **Amounts** are the stored line figures. The statuses come from the Prisma enum constants, not
  string literals.

---

## 2. Findings

- **F1 — no page could open one sale or one order from a link.** S36 adds `lib/deep-links.ts`:
  - `/{scope}/sales?sale=REF` opens that sale's detail drawer. Closing the drawer drops the
    parameter, so a refresh doesn't reopen it.
  - `/{scope}/orders?search=REF` opens the orders list on **All**, searched to that reference.

  This works in both scopes, because the admin pages render the staff pages. No new endpoint was
  needed.
- **F2 — a sale-level discount is not apportioned** (Q3). On a discounted sale the tab's amounts
  exceed the sale total by the discount. The note says so.
- **F3 — staff without the orders page are bounced by the page guard** when they follow an order
  link. Expected.
- **F4 — following an order link writes one staff-search log row,** because the orders page audits
  every search. Accepted.
- **F5 — pre-existing, not fixed:** `services/clients.service.ts` lines 86–88 carry a 3-line
  prettier indentation error that is already in `HEAD`. It's outside S36's code, so I left it alone
  (see §4).

---

## 3. What changed

### Contract (`Apps/contract/src/modules/clients`)
- `clients.enums.ts`: new `PurchaseDocumentKind` (`SALE`, `ORDER`, `RETURN`).
- `clients.routes.ts`:
  - `CLIENT_ROUTES.ADMIN_PURCHASED_PRODUCTS` and `ADMIN_PURCHASED_PRODUCT_DOCUMENTS`;
  - `POS_CLIENT_ROUTES.ADMIN_PURCHASED_PRODUCTS`, `ADMIN_PURCHASED_PRODUCT_DOCUMENTS`,
    `STAFF_PURCHASED_PRODUCTS` and `STAFF_PURCHASED_PRODUCT_DOCUMENTS`.
- `clients.query.ts`: `PurchasedProductsQuerySchema` (page, limit ≤ 100, default 10) and
  `PurchasedProductParamsSchema` (`id`, `productId`).
- `clients.dtos.ts`: `PurchasedProductResponseSchema` and `PurchasedProductDocumentResponseSchema`.
  Neither has a cost or profit field.

### API (`Apps/api/src/modules/clients`)
- `clients.service.ts`:
  - typed status constants `PURCHASE_SALE_STATUSES` / `PURCHASE_ORDER_STATUSES`;
  - two identity resolvers (404 for a missing client or POS client; a missing other side just
    omits its branch);
  - four public methods;
  - two private SQL cores (`purchasedProductsPage`, `purchasedProductDocumentsPage`). Branches are
    built with `Prisma.sql` and every column is aliased in every branch. Counts and pages run in
    one `Promise.all`. No line is loaded into memory.
- `clients.mapper.ts`: `toPurchasedProductDto` and `toPurchasedProductDocumentDto`, using the
  existing `toMoney` helper.
- `clients.interface.ts`, `clients.controller.ts`: the four methods and four thin handlers.
- `clients.routes.ts`: six routes, documents routes first:
  - admin web-client and admin POS-client routes are `adminOnly`;
  - staff POS-client routes use `staffPosClientsOrAdmin`.

### Web (`Apps/web/src`)
- New `types/purchase-history.types.ts`: `PurchaseHistoryOwner`.
- `services/clients.service.ts`: `listPurchasedProducts` and `listPurchasedProductDocuments`, with
  the route chosen by the owner.
- `lib/query-keys.ts`: `qk.purchaseHistory.{all, products, documents}`, each key including the
  owner.
- New `hooks/usePurchaseHistory.ts`: `usePurchasedProducts` and `usePurchasedProductDocuments`.
- New `lib/deep-links.ts`: the two link builders and their parameter constants.
- `pages/staff/sales/StaffSales.tsx`: `?sale=` seeds the open drawer, and closing it drops the
  parameter.
- `pages/staff/orders/StaffOrders.tsx`: `?search=` seeds the search box and opens on **All**.
- New `pages/admin/clients/components/client-purchased-products-tab.tsx`: the table, empty and
  error states, note, pager and row → dialog.
- New `pages/admin/clients/components/purchased-product-documents-dialog.tsx`: the paginated
  documents. Each type is labelled, references are links, and return rows show "From SAL-…" with a
  red amount.
- `pages/admin/clients/AdminClientDetail.tsx`: the sixth tab.
- `pages/admin/pos-clients/components/pos-client-detail-drawer.tsx`: a required `scope` prop, the
  wider drawer and the fourth tab.
- `pages/staff/pos-clients/StaffPosClients.tsx`: passes `scope` to the drawer.
- `config/translations.json`: 23 keys added (en/fr, `ar: ""`), after a byte-safe round-trip check
  (115 added lines, nothing else touched).

### Docs (`Docs/Stage-00-Conception`)
- `Module-Contracts/clients.md`: the route rows, and Business Logic item 6 (the purchase-history
  rules).
- `Pages-Requirements/ADM-12b-client-detail.md` and `ADM-11-pos-clients.md`: the tab, the dialog,
  the links and the data dependencies.

---

## 4. Validation gate

| Check | Result | Baseline |
|---|---|---|
| contract `tsc --noEmit` + lint | clean | clean |
| api `tsc --noEmit`, `src/` | **0 errors** | 0 |
| api `tsc --noEmit`, whole project | 198 errors in 29 files | 198 / 29 (unchanged) |
| api lint | 7 errors, all pre-existing (`seed.ts` ×3, `validate-request.middleware.ts` ×3, `orders.service.ts` unused import ×1) | 7 |
| web `tsc --noEmit` | clean | clean |
| web `tsc -p tsconfig.test.json` | **53 errors** | 52 (+1, expected; see below) |
| eslint on the 12 touched/created web files | 3 errors, all pre-existing in `clients.service.ts` lines 86–88 (F5); 0 in S36 code | n/a |

**Expected test drift (not edited):** `tests/unit/pages/pos-clients/pos-clients-primitives.test.tsx`
line 29 renders `PosClientDetailDrawer` without the new required `scope` prop (TS2741). The plan
anticipated this. No other test file's error count changed.

Grep sweeps:
- No `'COMPLETED'`, `'RETURNED'` or `'PARTIALLY_RETURNED'` literal in the clients module.
- No `costOfGoods`, `profit` or `totalCost` in the S36 code (the only hit is the comment stating
  there is none).
- No `RepairPart` in the S36 block.
- No hand-built sales or orders links in pages.

---

## 5. Evidence from the running code (dev DB, read-only; throwaway script, deleted)

**Service run over all 3 dev POS clients, using a page size of 2 to exercise pagination
(0 failures):**
- every page continues the previous one with no overlap, and `total` equals the rows across pages;
- for **every** product, `quantityBought` and `totalAmount` equal Σ of its SALE/ORDER document rows,
  and `quantityReturned` and `amountRefunded` equal Σ of its RETURN rows. Every return row carries
  its source document;
- POS-2026-0002 (linked web account) returns **byte-identical** rows through the web-client route
  and the POS-client route;
- a missing POS-client id gives `NotFoundError` (404).

The figures:

| Client | Product: bought / total / returned / refunded |
|---|---|
| POS-2026-0001 (no web account) | Motherboard Iphone 13 pro 2/40 000/0/0 · Accessory Samsung Buds 1/12 000/0/0 · Battery Iphone 15 Pro 1/14 500/0/0 · Charger Connector Lg V10 **2/3 600/2/3 600** · Charger Connector Redmi note 10 2/3 000/0/0 · Display Iphone 14 pro max 1/20 000/0/0 |
| POS-2026-0002 (linked web account) | Motherboard Iphone 13 pro 1/20 000/0/0 · Battery Samsung S24 ultra 1/8 000/0/0 · Motherboard Samsung note 10 plus 1/15 000/0/0 |
| POS-2026-0003 (no web account) | Battery Samsung S24 ultra **1/8 500/1/0** (credited return) · Display Redmi K20 **2/21 000/1/10 500** · Display Lg V20 1/18 000/1/18 000 · Motherboard Iphone 13 pro 1/20 000/0/0 |

**HTTP, through the real router:**
- staff on the staff route: 200;
- staff on the admin route: 403;
- admin on the staff route: 200;
- anonymous: 401;
- a malformed `productId`: 400;
- `limit=500`: 400;
- no response mentions cost or profit.

**Not verified:**
- The web UI and the two deep links (no browser here).
- **The orders branch on real data:** the dev DB has no completed order. The query shape ran during
  planning, and the code path ran here with no rows.
- **A web client with no POS identity:** the dev DB has none.
- Web unit tests (not run, per the rules).

Checklist steps 10–11 cover the cases the dev data can't.

---

## 6. Verification checklist (browser)

The dev data already holds useful cases (§5). Signed in as **admin**:

### A. POS-client drawer (admin)
1. Open `/admin/pos-clients` and click **POS-2026-0003**. The drawer is wider and has a fourth tab,
   **Products bought**. Open it. The rows read, newest purchase first:
   - Battery Samsung S24 ultra: **1 bought, 8 500, 1 returned, 0 refunded**;
   - Display Redmi K20: **2, 21 000, 1, 10 500**;
   - Display Lg V20: **1, 18 000, 1, 18 000**;
   - Motherboard Iphone 13 pro: **1, 20 000, 0, 0**.

   The note under the table explains the "0 refunded" row.
2. **Cross-check against the documents.** Click **Display Redmi K20**. The dialog lists its sale
   line(s) with date, reference, quantity, unit price and line total, plus a **Return** row with
   its own reference, "From SAL-…" and 10 500. The line totals add up to 21 000, and the return
   amounts add up to 10 500.
3. Click the sale reference. You land on `/admin/sales` with **that sale's drawer open**. Its line
   for the product shows the same unit price and quantity. Its returns (the sales page's
   **Returns** tab) show the same refund. Close the drawer: the URL loses `?sale=`, and refreshing
   doesn't reopen it.
4. Back on the client, open **Battery Samsung S24 ultra**. The Return row shows **0**. In the sale's
   detail, the return's refund is 0, and the client's **Credit history** shows the credited amount
   instead (S32). Returned 1, refunded 0, never "0 bought".
5. **POS-2026-0001** (a walk-in with no web account) works: Charger Connector Lg V10 reads
   **2 bought, 3 600, 2 returned, 3 600 refunded**. It never reads "0".
6. **Total cross-check:** for one client, add up the **Total amount** column across all pages. Open
   the drawer's **Sales** tab and add up those sales' totals. The two sums are equal when none of
   the client's sales had a sale-level discount. Otherwise the tab's sum is higher by exactly the
   sum of those discounts (Q3, F2).
7. **Repricing:** in `/admin/products`, change the price of a product this client bought, then
   reopen the tab. Its amounts and unit prices are unchanged. Restore the price.
8. Make a **draft** sale (don't confirm) for the client with a new product. It does **not** appear.
   Confirm it: it appears at the top. Repair parts used on the client's repairs never appear.

### B. Admin client page (web identity)
9. Open `/admin/clients`, then the client linked to **POS-2026-0002**. The new **Products bought**
   tab shows the same three products as that POS client's drawer, with the same figures, because
   both resolve the same two identities.
10. If you complete an **online order** for this web client, its products appear here and in the
    POS-client drawer. The drill shows an **Order** row whose link opens `/admin/orders` on **All**,
    searched to that reference. An order still `IN_DELIVERY`, or one returned before completion,
    never appears.
11. Open a web client who was **never approved** (no POS client). The tab shows the empty state,
    with no error.

### C. Staff
12. Sign in as a staff user holding **POS clients**. Open `/staff/pos-clients` → **POS-2026-0003**
    → **Products bought**. The figures are the same as admin's, from every seller (Q1). The tab has
    no cost or profit column, and neither does the dialog. In the Network tab, the
    `purchased-products` response has no cost or profit field.
13. Click a sale reference sold by **another** staff member. `/staff/sales` opens the drawer with
    the existing "not allowed" message. Your own sales open normally.
14. A staff user **without** the orders page who clicks an order link is sent away by the page
    guard (F3).
