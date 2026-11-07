# Report S34 — Sales filters & POS-client parity

Plan: `Docs/Stage-04-Fixes/plans/plan-S34-sales-filters-and-pos-client-parity.md`.
Status: **executed, gates green, awaiting owner review before S35.** Nothing is committed.
No schema change, no migration, no test file read for editing, edited or run.

---

## 1. Diagnosis (as found)

I traced every sales filter from the component through the query key, axios, the
`validateRequest` middleware and the service `where`. I then ran the real HTTP pipeline against
the dev database (14 sales). The back end applies every parameter correctly. Both real breaks
were in `StaffSales.tsx`, which turned typed text into an id before building the query.

| Filter | Verdict | Cause |
|---|---|---|
| Product search | Works | Free text, matched server-side. |
| Status | Works | Only defect: `RETURNED` and `PARTIALLY_RETURNED` both showed "Retournée". |
| Date range | Works | Only defect: the `to` box had no label. |
| **Seller** | **Broken** | Matched `User.username` exactly, but the table shows first + last name. When it did match it sent the **User id** where `Sale.staffId` is a **Staff id**, so the list emptied (13 → 0). |
| **POS client** | **Broken** | Matched only an **exact full name**, within the first 20 search hits. A partial name or phone resolved to nothing, so the query key never changed. |
| Client-name search | Absent | The box was an exact-name→id resolver, not a search. |

## 2. Audit of the other list pages

The exact-name→id defect exists **only** on the sales page. A different defect broke the date
filter on six endpoints: `lte: new Date(to)` stops at the **start** of the `to` day, so a
single-day filter (`from = to`) always returned nothing.

For the same days, the old logic and the new one gave:

| Endpoint (column) | Old logic | After this set |
|---|---|---|
| Orders (`placedAt`) | 0 | 3 |
| Repairs (`intakeAt`) | 0 | 1 |
| Invoices (`issuedAt`) | 0 | 1 |
| Client payments (`paidAt`) | 0 | 1 |
| Supplier payments (`paidAt`) | not measured | 1 |
| Sale returns (`returnedAt`) | not measured | 1 |
| Supplier invoices (`invoiceDate`, `@db.Date`) | already correct | untouched |

## 3. What changed

### Contract
- [sales.query.ts](Apps/contract/src/modules/sales/sales.query.ts): added `client` and `seller`
  free-text params; rewrote the stale header comment; noted the Algiers-day rule on the returns
  query.
- Comment-only date-semantics notes in `orders.query.ts`, `billing.query.ts` (two schemas),
  `purchasing.query.ts` (two schemas) and `repairs.query.ts`.

### API
- [sales.service.ts](Apps/api/src/modules/sales/sales.service.ts):
  - `listSales` applies `client` (name or phone, same match as the POS attach search) and
    `seller` (every word must match first name, last name or username).
  - Both are spread **before** `extraWhere`, so a staff caller's own-sales scoping stays last and
    is only ever narrowed.
  - `listReturns` now uses `storeDayRangeUtc`.
- Algiers-day bounds (`storeDayRangeUtc`) replace `lte: new Date(to)` in `orders.service.ts`
  (`placedAt`), `billing.service.ts` (`paidAt`, `issuedAt`), `purchasing.service.ts` (`paidAt`)
  and `repairs.service.ts` (`intakeAt`).
- `purchasing.service.ts` `listInvoices` is left on `invoiceDate`, with an explaining comment.
- [billing.routes.ts](Apps/api/src/modules/billing/billing.routes.ts): `staffPaymentsReadOrAdmin`
  became `staffClientPaymentsOrAdmin`, with `anyPages: [STAFF_INVOICES, STAFF_POS_CLIENTS]`. It
  now guards `POST /staff/client-payments` as well as the list. The three invoice routes keep
  `staffInvoicesOrAdmin`.

### Web
- New [sale-status-labels.ts](Apps/web/src/pages/staff/sales/sale-status-labels.ts): the one
  shared label map. `PARTIALLY_RETURNED` has its own key.
- [SalesTable.tsx](Apps/web/src/pages/staff/sales/components/SalesTable.tsx) and
  [SalesFilters.tsx](Apps/web/src/pages/staff/sales/components/SalesFilters.tsx): use the shared
  map. The filter bar gets a client search in both scopes, a seller box that stays admin-only,
  and labelled **From** and **To** date boxes.
- [StaffSales.tsx](Apps/web/src/pages/staff/sales/StaffSales.tsx): the name→id resolution and the
  `useUsers`/`usePosClientSearch` calls are gone. The query now sends `client`, and `seller`
  only for admin.
- [StaffPosClients.tsx](Apps/web/src/pages/staff/pos-clients/StaffPosClients.tsx):
  - A name/phone/code search sits in the page, not the table, so it keeps focus while the table
    reloads.
  - Record payment sends `scope` instead of the hard-coded `"admin"`.
  - The dialog stays open on a result view after success.
  - `closePaymentDialog` resets amount and result.
- [RecordPaymentDialog.tsx](Apps/web/src/pages/staff/invoices/components/RecordPaymentDialog.tsx):
  new optional `result` prop showing reference, amount and the server's previous → new credit.
  The invoices page and the client-directory page don't pass it and behave as before.
- [record-client-payment.schema.ts](Apps/web/src/pages/staff/invoices/record-client-payment.schema.ts):
  the empty-box message is now translated.
- `translations.json`: 7 keys added, 35 lines, nothing else touched:
  `staff.sales.status.partiallyReturned`, `admin.sales.filters.{clientSearch,from,to}`,
  `admin.posClients.searchPlaceholder`,
  `staff.invoices.recordPayment.{recordedTitle,reference}`.

## 4. Findings

- **F1 / F2:** the seller and POS-client filters were broken as described in §1.
- **F3:** status and date filters were verified working. Only the label and the unlabelled `to`
  box were fixed.
- **F4:** the date off-by-one on six list endpoints is fixed (§2). It carries over S32-F2.
- **F5:** the staff POS-clients page's Record-payment button always got a 403. It posted to the
  admin-only route, and the staff route also demanded `STAFF_INVOICES`. Both are fixed.
- **F6:** the typed payment amount survived a dismissed dialog and pre-filled the next client's.
  Fixed.
- **F7:** an emptied amount box showed Zod's English default message. It is now translated.
- **F8 (not fixed):** `validate-request.middleware.ts:37-39` computes normalised body/query/params
  and then parses the raw ones. It is also three of the 7 pre-existing lint errors. Enabling it
  would change parsing on every route, so I left it.
- **F9 (not fixed):** the invoices page's **Incoming** and **Payments** tabs fetch
  `page: 1, limit: 20` and render no pager. Rows past the 20th are unreachable.
- **F10 (not fixed):** the inventory movements filter includes the `to` day but uses UTC days,
  not Algiers days.

## 5. Decisions and deviations

- **P1–P7 from the plan were applied as written.**
- **P8 deviated slightly.** The plan said to export the label map from `SalesTable.tsx`. That
  triggers the `react-refresh/only-export-components` lint warning, as the plan's own precedent
  `InvoicesTable.tsx` does. I put the map in `sale-status-labels.ts` instead. Behaviour is
  identical, and lint now reports zero warnings on every touched file.
- I removed the unused `AdminClientDto` import from `StaffPosClients.tsx`. It was dead.
- `admin.sales.filters.posClient` and `admin.sales.filters.dateRange` are now unused translation
  keys. I left them in place.

## 6. Gates

| Check | Result | Baseline |
|---|---|---|
| contract `tsc --noEmit` + lint | clean | clean |
| api `tsc --noEmit`, `src/` | **0 errors** | 0 |
| api `tsc --noEmit`, whole project | 198 errors in 29 files | 198 / 29 (unchanged) |
| api lint | 7 errors, all pre-existing (`seed.ts` ×3, `validate-request.middleware.ts` ×3, `orders.service.ts` unused import ×1) | 7 |
| web `tsc --noEmit` | clean | clean |
| web `tsc -p tsconfig.test.json` | 52 errors | 52 (unchanged) |
| eslint on all touched web files | 0 errors, 0 warnings | n/a |

Grep sweeps:
- No `toLowerCase() ===` resolver left under `Apps/web/src/pages`.
- The only `lte: new Date(query.to)` left is the `invoiceDate` block, kept on purpose.
- `staffPaymentsReadOrAdmin` and `scope: "admin", command` are gone.

## 7. Evidence from the running API (dev DB, read-only except as noted)

I ran these through the real router, middleware and service with a minted admin token. The probe
file is deleted.

- **Client filter:** a 3-letter fragment gave 3, the full name gave 3 and `zzzz` gave 0. The DB
  count for the full name is 3.
- **Seller filter:** the displayed name ("Admin User"), a 3-letter fragment and the login
  username each gave 13. `zzzz` gave 0. The DB count of that seller's sales is 13. Before this
  set, typing the matching username returned 0.
- **Payment guard:** I created throwaway staff users and roles in the dev DB, probed, and deleted
  exactly those rows (0 leftovers). The POST used an invalid body so nothing was written. The
  guard gave:
  - `STAFF_POS_CLIENTS` only: passes (400 validation error).
  - `STAFF_INVOICES` only: passes.
  - `STAFF_SALES` only: 403.
- **Not verified:** the web UI itself (no browser here), the phone-search path (the dev POS
  client has no phone), and web unit tests (not run, per the rules).
- **Possible test drift:** `web/tests/unit/pages/staff-sales/sales.test.tsx` and
  `pos-clients/pos-clients-wiring.test.tsx` render these pages. They still compile (test tsc is
  unchanged at 52), and `sales.test.tsx` only mocks hooks `StaffSales` no longer calls. I did not
  run or edit them, so a runtime assertion on the old filter bar can't be ruled out.

---

## 8. Verification checklist (browser)

Before you start, make sure the dev data has at least: two sellers with sales; two POS clients
with completed sales (one with a phone number); one walk-in sale; one partially returned sale;
and documents on two different days. Note one day `D` that has a sale, an order, an invoice, a
client payment, a supplier payment and a repair intake.

### A. Admin sales (`/admin/sales`)
1. **Status:** pick **Brouillon**: only drafts. Pick **Terminée**: only completed. **Retournée**
   and **Partiellement retournée** are now two distinct items, each listing only its own status.
2. **Date range:** hover the two date boxes: they read **Du** and **Au**. Set Du = Au = `D`: that
   day's sales appear and nothing else. Clear both and press **Ventes du jour**: today's sales.
3. **Seller:** type the first letters of a name as shown in the Seller column (e.g. "Adm"). Only
   that seller's sales remain. The full displayed name ("Admin User") and the login username give
   the same result. `zzzz` gives an **empty** table, not the unfiltered list.
4. **Client:** type part of a POS client's name. Only that client's sales remain and walk-in
   ("Comptoir") rows disappear. A fragment of the client's phone gives the same result. `zzzz`
   gives an empty table.
5. **Combined:** client + **Terminée** + Du/Au gives the intersection. Changing any one filter
   resets the pager to page 1.
6. **Money cross-check:** with only the client filter set to one client, add up the **Total**
   column. Open that client on `/admin/pos-clients` → detail drawer → **Sales** tab. The same
   sales and totals appear. The sum is ≤ the client's **Total sold** column, and equal when the
   client has no completed online orders and no returns, because `totalSold` also counts orders
   and falls by returned line value.

### B. Staff sales (`/staff/sales`, staff user holding the sales page)
7. The **client search** is present. The seller box and the date boxes are not. A client name
   lists **only your own** sales to that client. A second seller who also sold to that client
   sees only theirs.

### C. Date filters on the other pages (day `D`)
8. `/admin/orders`: from = to = `D` lists `D`'s orders (it used to be empty).
9. `/admin/invoices`: **Outgoing** from = to = `D` lists `D`'s invoices. **Payments** from = to =
   `D` lists `D`'s client and supplier payments. **Incoming** is unchanged: from = to = a supplier
   invoice's date still lists it.
10. `/admin/repairs` board: from = to = `D` shows the repairs taken in on `D`.
11. **Money cross-check:** on **Payments** with from = to = `D`, add up the **supplier** payment
    amounts. Open `/admin/cash-register` for `D`: the Suppliers section's **total paid to
    suppliers** equals that sum (S33/Q1 counts SupplierPayment rows by `paidAt` on that day). If
    you can, record a payment just after local midnight: it must appear under `D` on both pages,
    not under the day before. Then open one listed **client** payment that carries an invoice
    number, and open that invoice on **Outgoing**. Its **Paid** amount equals the sum of every
    Payments-tab row with that invoice number (filter cleared), refund rows counted negative.

### D. POS clients search (`/admin/pos-clients` and `/staff/pos-clients`)
12. Type part of a client's **name**: the table narrows and the pager resets. A **phone** fragment
    and a **code** fragment narrow it too. The box keeps focus while the table reloads. Clearing
    it restores the full list.

### E. Record payment from the staff POS-clients page
Setup: in `/admin/users`, give a staff user a role with **`STAFF_POS_CLIENTS` but not
`STAFF_INVOICES`**, and sign in as them. Pick a client with credit **C** and total paid **P**.

13. Click the card icon on that client's row. **Previous credit = C**. Clear the amount and
    submit: a **translated** "Amount must be greater than zero". `0` gives the same message.
    Type `1500`: the preview reads **C → C − 1500**.
14. Submit. A success toast appears **and the dialog stays open**, titled **Payment recorded**,
    with a `PAY-…` reference, amount 1500 and **Previous credit C → New credit C − 1500**. No 403.
    Press **Close**.
15. Reopen the dialog for a **different** client: the amount box is **not** pre-filled with 1500.
16. The row shows credit **C − 1500** and total paid **P + 1500**. The detail drawer's
    **Payments** tab lists the new `PAY-…` row with the same previous/new credit, and **Credit
    history** shows the same movement.
17. **Ledger cross-check:** as admin, open `/admin/invoices` → **Payments**. The same `PAY-…`
    reference appears with amount 1500, **no invoice number** (on account) and the staff user's
    name. Its previous credit equals the credit you saw in step 13, and its new credit is
    previous − 1500.
18. **Regression:** as a staff user holding **`STAFF_INVOICES` only**, record a payment on an
    invoice with a POS client from `/staff/invoices`. It succeeds, and that dialog still **closes**
    on success.
19. As **admin** on `/admin/pos-clients`, repeat steps 13–16: identical behaviour.
