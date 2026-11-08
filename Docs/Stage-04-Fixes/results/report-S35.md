# Report S35 — Cash register: profit, standalone payments & the staff dashboard

Plan: `Docs/Stage-04-Fixes/plans/plan-S35-cash-register-profit-payments-staff.md`.
Status: **executed, gates green, awaiting owner review before S36.** Nothing is committed (S34 was
already committed as `9dd1f7e`). One schema-only migration was applied to the dev database. No test
file was read for editing, edited or run. I never opened the web UI (no browser here).

---

## 1. Decisions

### Owner decisions (taken while planning, applied as written)

| # | Question | Answer |
|---|---|---|
| Q1 | A payment recorded later against an existing invoice only updates `Invoice.paidAmount`, so the Caisse showed it nowhere. | **The Payments line counts every Record payment**, linked to an invoice or not, through a new `ClientPayment.standalone` flag set only by Record payment. No backfill. |
| Q2 | Do orders count in net profit and net cash? | **Yes.** |
| Q3 | How much profit does a repair return reverse? | **Repair total minus the cost of the parts put back on the shelf** (the sale-return rule). |
| Q4 | What does staff get? | **Today's whole-store figures only:** no profit, no date picker, no drill lists. |

### Plan decisions P1–P11 were applied as written

- **P1:** `ClientPayment.standalone Boolean @default(false)`, set only by `createClientPayment`.
- **P2:** the supplier fields were renamed to `invoicePaymentCount` and `paidOnInvoices`.
- **P3:** one aggregation core (`computeCashRegister`) with two mappers.
- **P4:** the staff route is `GET /staff/cash-register`, with no query string and always today.
- **P5:** the two return reversals are one raw SQL `SUM` each.
- **P6:** drill rows gained an optional `profit`.
- **P7:** two new drill targets, `PAYMENTS_CLIENT` and `PAYMENTS_SUPPLIER`.
- **P8:** net cash and net profit are computed on the server.
- **P9:** the sections code moved into a shared `CashRegisterSections` component.
- **P10:** profit cards are not clickable.
- **P11:** no index.

### Small deviations and choices inside the plan

- The plan left a choice between an extra DTO field and a sum in the component for "Reversed by
  returns". I added **`profit.returnsReversed`** to the DTO, so the page does no arithmetic.
- I added the `CashMovementLine` type to `types/cash-register.types.ts` as Action 4.5 specified. I
  first left it out and then added it.
- 24 translation keys were added (the plan's table). `admin.cashRegister.suppliers.totalPaid` is
  now unused and left in place.

### The two rules the code and docs now state (so nobody "corrects" them later)

1. **Supplier payments are not an expense and never reduce net profit.** Buying stock is a
   balance-sheet movement; its cost reaches profit as FIFO cost of goods when the item is sold.
   Supplier payments appear only in the cash movement.
2. **The staff cash register is whole-store, not the member's own documents.** It reports one
   physical drawer, so a per-seller version would match nothing. This is a deliberate exception to
   the staff-sees-own-documents rule. Profit is stripped **in the mapper**: the staff schema is
   `CashRegisterResponseSchema.omit({ profit: true })`, so the type has no profit key at all.

### Which query owns which money row (every row counted once)

| Money row | Counted in |
|---|---|
| Client payment at sale confirm | Sales → paid (`Sale.paidAmount`) |
| Client payment at order completion | Orders → paid on completed (`Order.paidAmount`) |
| Client payment with `repairId` (deposits, pickup capture, reversals) | Repairs → paid (gross) / refunded |
| Negative client payment of a sale/order return | Returns → total refunded (`Return.refundAmount`) |
| Record-payment row (`standalone = true`, any invoice link), plus pre-S35 rows with no invoice, no repair and a positive amount | **Payments → client (+)** (new) |
| Supplier payment with a supplier invoice | **Suppliers → paid on invoices** (narrowed from "all") |
| Supplier payment with no supplier invoice | **Payments → supplier (−)** (new) |

`suppliers.newCredit` keeps its meaning: invoiced minus **all** supplier payments of the day.

---

## 2. Findings

- **F1 — later invoice-linked client payments were invisible on the Caisse.** Fixed going forward by
  the `standalone` flag. Invoice-linked Record payments taken **before** S35 stay uncounted (no
  backfill). Unlinked ones taken before S35 are still caught by the fallback rule.
- **F2 — not fixed: a deposit on a repair cancelled before pickup never appears on any day.** Its
  refund appears on the cancel day, so net cash under-reports by that deposit. A correct fix would
  date repair cash on the ledger's `paidAt`, but walk-in repairs have no ledger rows (S30/P7), so
  that needs a schema decision. A deposit on an earlier day for a repair picked up today **is**
  counted today (S33-F3).
- **F3 — fixed: the staff dashboard's "my sales today" used the server's local midnight** (UTC on
  Fly), so between 00:00 and 01:00 Algiers it reported the wrong day. It now uses the same Algiers
  day bounds as the cash register next to it. Its COMPLETED-only filter is unchanged.
- **F4 — an order return's `refundAmount` is the operator-typed refund** (S33/Q4 caveat, accepted).
  It now also feeds net cash and the order-return profit reversal.
- **F5 — the client-payment and supplier-payment hooks now invalidate `qk.stats.all()`,** so the
  Caisse refreshes after a payment.
- **Deliberate difference from the Statistics page:** Statistics restates a return into the original
  document's period and drops a returned repair entirely (S30/Q2). The Caisse is a day ledger: a
  return is dated on the day it happened, and a repair return reverses "total minus restocked
  cost". Over a day where documents and their returns don't cross days, both agree. Otherwise they
  can differ on purpose.

---

## 3. What changed

### Database
- `prisma/schema.prisma`: `ClientPayment.standalone Boolean @default(false)`, commented.
- Migration `20261107120000_s35_client_payment_standalone` (verbatim below), generated with
  `prisma migrate diff`, applied with `migrate deploy`, client regenerated. The dev DB had no
  drift. The test DB was not migrated.

```sql
-- AlterTable
ALTER TABLE "ClientPayment" ADD COLUMN     "standalone" BOOLEAN NOT NULL DEFAULT false;
```

### Contract (`Apps/contract/src/modules/statistics`)
- `statistics.enums.ts`: `CashRegisterDrill` gained `PAYMENTS_CLIENT` and `PAYMENTS_SUPPLIER`.
  `SUPPLIER_PAYMENTS` is commented as invoice-linked only.
- `statistics.dtos.ts`:
  - `suppliers` fields renamed to `invoicePaymentCount` / `paidOnInvoices`;
  - new `payments`, `cashMovement` and `profit` objects;
  - new `StaffCashRegisterResponseSchema` (= the response schema with `profit` omitted) and
    `StaffCashRegisterDto`;
  - an optional `profit` on a drill row;
  - header comments updated.
- `statistics.routes.ts`: `STAFF_CASH_REGISTER: '/staff/cash-register'`.

### API
- `billing.service.ts` / `billing.interface.ts`: `captureClientPaymentInTx` accepts `standalone`.
  `createClientPayment` passes `true`. No other caller passes it.
- `statistics.service.ts`:
  - `getCashRegister` and the new `getStaffCashRegister` both call a private
    `computeCashRegister(date)`. It runs 15 queries in one `Promise.all`: the S33 nine, two
    standalone-payment aggregates, two raw return-reversal SUMs, and two repair-return aggregates.
    No document row is loaded.
  - New where-builders: `cashStandaloneClientPaymentsWhere`, `cashStandaloneSupplierPaymentsWhere`
    and `cashRepairReturnsWhere`. `cashSupplierPaymentsWhere` is narrowed to invoice-linked
    payments.
  - Drill: profit on SALES, REPAIRS_PICKED_UP and ORDERS_COMPLETED rows, plus two new cases for the
    Payments line.
  - `getStaffDashboard` uses the Algiers day (F3).
- `statistics.mapper.ts`: `toStaffCashRegisterDto` rebuilds the object without profit.
  `statistics.interface.ts`, `statistics.controller.ts` and `statistics.routes.ts` carry the new
  method and route, guarded by the existing `staffDashboardViewer` (STAFF or ADMIN).

### Web
- `services/statistics.service.ts`, `hooks/useStatistics.ts` and `lib/query-keys.ts`:
  `getStaffCashRegister`, `useStaffCashRegister` (`staleTime: 0`) and `qk.stats.staffCashRegister`,
  nested under `stats`.
- `hooks/useBilling.ts` and `hooks/usePurchasingPayments.ts`: invalidate `qk.stats.all()` (F5).
- `types/cash-register.types.ts`: `profit` on `CashRegisterDrillColumns`, `detail` on
  `CashRegisterFigure`, and `CashMovementLine`.
- `cash-register-section.tsx`: `onDrill` is optional. Without it every figure is a plain card.
  `figure.detail` replaces the drill hint.
- New `cash-movement-card.tsx`: the net cash card, with no arithmetic.
- New `cash-register-sections.tsx`: the six sections plus the net cash card, shared by the admin page
  (clickable) and the staff widget (plain).
- `AdminCashRegister.tsx`: renders the shared sections, then the admin-only Profit section (not
  clickable) and the supplier-payments-are-not-an-expense note.
- `cash-register-drill-dialog.tsx`: a profit column for the three list types, and entries for the
  two new drill targets.
- New `StaffCashRegisterWidget.tsx` (silent-hide on error, Refresh button, no drill), mounted in
  `StaffDashboard.tsx` right after "My sales today".
- `config/translations.json`: 24 keys added (en/fr, `ar: ""`), after a byte-safe round-trip check
  (120 added lines, nothing else touched).

### Docs (`Docs/Stage-00-Conception`)
- `database-description.md`: `ClientPayment.standalone`.
- `Module-Contracts/statistics.md`: the staff route, and the S35 rules in Business Logic item 6
  (payment-row ownership, net cash, profit formulas, the supplier-payments rule).
- `Pages-Requirements/ADM-20-cash-register.md` and `STF-01-dashboard.md`: the new UI and data
  dependencies.

---

## 4. Validation gate

| Check | Result | Baseline |
|---|---|---|
| contract `tsc --noEmit` + lint | clean | clean |
| api `prisma validate` | valid | valid |
| api `tsc --noEmit`, `src/` | **0 errors** | 0 |
| api `tsc --noEmit`, whole project | 198 errors in 29 files | 198 / 29 (unchanged) |
| api lint | 7 errors, all pre-existing (`seed.ts` ×3, `validate-request.middleware.ts` ×3, `orders.service.ts` unused import ×1) | 7 |
| web `tsc --noEmit` | clean | clean |
| web `tsc -p tsconfig.test.json` | 52 errors | 52 (unchanged) |
| eslint on the 13 touched/created web files | 0 errors, 0 warnings | n/a |

Grep sweeps:
- The staff mapper body never mentions profit.
- No `.profit` reference exists under `pages/staff/dashboard`.
- `paymentCount` and `suppliers.totalPaid` are gone from `api/src`, `contract/src` and the Caisse
  code. The remaining `totalPaid` hits are the supplier page's own key and the now-unused Caisse
  key.
- `standalone` appears only in billing (signature, plus `createClientPayment`'s `true`) and the
  statistics builder.
- Exactly one new migration, with one `ADD COLUMN`.

No test references the Caisse DTO, so no test drift is expected. I did not run any test.

## 5. Evidence from the running code (dev DB; throwaway scripts, deleted)

**Service smoke run over all 9 dev days that have data** (2026-07-29 … 2026-10-12), reading the
real service. For every day, all of these held (0 failing days):
- the Sales, Repairs picked up and Completed orders drill-list profit sums equal Sales profit,
  Repair profit and Order profit;
- the client payments drill equals Payments → client (sum and count);
- the supplier payments drill equals Payments → supplier;
- the invoice-linked supplier payments drill equals Paid on invoices;
- **invoice-linked + on-account supplier payments equals all supplier payments by `paidAt`**
  (sum and row count), so no supplier row is counted twice;
- the cash net equals its parts;
- net profit equals sales + repairs + orders − reversals;
- the three return reversals sum to `returnsReversed`.

Examples:
- 2026-07-29: sales profit 39 500, repair profit 7 800, order profit 9 500, reversed by returns
  800 → net profit 56 000. Cash: 87 100 + 13 100 + 23 500 + 0 − 3 600 − 37 800 = **82 300**.
- 2026-08-04: the two pre-S35 on-account client payments (6 000 total) are picked up by the
  fallback rule.
- 2026-10-12: a sale of profit 4 000 returned the same day nets to profit 0.

**HTTP and permission checks, through the real router:**
- `GET /staff/cash-register`: 200 for a staff user and for admin; the JSON has **no `profit` key**.
  `GET /admin/cash-register` (admin) has one. A staff user on `/admin/cash-register` gets 403, and
  the admin drill endpoint gives staff a 403. Anonymous gets 401.
- The staff payload equals the admin payload minus `profit`, byte for byte.

**Persistence of the new flag**, inside a transaction that was rolled back (0 flagged rows remain):
a Record-payment row linked to a real invoice saved `standalone = true`, and a document-time payment
saved `false`. The Caisse's Payments where-clause matched only the first.

**Not verified:**
- The web UI itself (no browser here).
- The real `POST /staff/client-payments` request end to end. The write path was exercised through
  the service in a rolled-back transaction, not over HTTP.
- Repair-return reversal and order-return reversal on real dev data: the dev DB has no
  return-after-pickup repair and no order return. The sale-return SQL matches the existing
  statistics formula (checked while planning, 20 100 = 20 100). The other two are covered by
  checklist steps 10–11.
- Web unit tests (not run, per the rules).

---

## 6. Verification checklist (browser)

Signed in as **admin**, with these tabs open: `/admin/cash-register`, `/admin/sales`,
`/admin/repairs`, `/admin/orders`, `/admin/invoices` → **Payments**, `/admin/pos-clients`, and a
supplier's page. Note today's Caisse figures first. After each action, press **Refresh** on the
Caisse.

### A. Standalone payments and the supplier split
1. On `/admin/pos-clients`, record an **on-account** payment of 1 000 for a client.
   - Caisse → **Payments without a document → Client payments received** rises by 1 000 and its
     count by 1.
   - **Net cash movement → + Client payments without a document** rises by 1 000, and so does
     **= Net cash movement**.
   - **Sales → Total paid** does **not** change.
2. On `/admin/invoices`, open a client's **existing sale invoice from an earlier day** and record
   500 against it.
   - The Payments line rises by 500. Before S35 this appeared nowhere.
   - Click the figure: the drill lists both payments. The 500 row shows the invoice number under
     **Source document**, the 1 000 row shows none.
   - **Sales → Total paid** (today's sales) is unchanged.
3. Record a **supplier payment linked to a supplier invoice** (300), then an **on-account supplier
   payment** with no invoice (200).
   - **Suppliers → Paid on supplier invoices** rises by 300 only.
   - **Payments → Supplier payments on account** rises by 200.
   - **New supplier credit** falls by 500 (both).
   - **− Supplier payments** in the cash card rises by 500.
   - The two drill lists show 300 and 200 respectively. Neither payment appears in both.
4. **Cross-check against the ledger.** On `/admin/invoices` → **Payments**, filter from = to =
   today.
   - The client rows you just made sum to 1 500.
   - The supplier rows (300 + 200, plus any earlier today) equal **Paid on supplier invoices +
     Supplier payments on account** exactly.

### B. Net cash movement adds up
5. With a POS client, make a new sale of total T, paid P. Make a walk-in sale paid W. Pick up a
   repair whose ticket shows paid R. Complete an order paid O. Then return one line of the first
   sale with refund F.
   - The cash card's lines rise by P + W, R, O, and F (refunds) respectively.
   - **= Net cash movement** equals the sum of the `+` lines minus the `−` lines. Check it by hand.
6. **Cross-check with the drawer:** add every cash amount you actually took in today and subtract
   what you paid out. The result equals **= Net cash movement**. Expected exceptions (F2):
   - a repair deposit taken today on a repair **not yet picked up** is not in it, because it lands
     on the pickup day;
   - a deposit taken on an **earlier** day for a repair picked up today **is** in it.

### C. Profit (admin)
7. Open the **Number of sales** drill. It now has a **Profit** column, and the sum of that column
   equals **Sales profit**. Open one of those sales in `/admin/sales`: the per-line profits in its
   detail drawer add up to the same row's profit.
8. Do the same with **Repairs picked up**: the Profit column sum equals **Repair profit**. For one
   repair, the ticket's total minus the sum of its part costs equals that row's profit, because
   labour is pure profit (R4).
9. **Completed orders** drill: the Profit column sum equals **Order profit**.
10. **Sale-return reversal, by hand:** for the return in step 5, take the line's unit price ×
    returned quantity. If **Restock** was ticked, subtract the line's cost (shown in the sale
    drawer) × returned qty / line qty. The result equals the **Sales** part of **Reversed by
    returns**.
11. **Repair return:** return a picked-up repair today and restock only one part. The **Repairs**
    part of **Reversed by returns** equals the repair's total minus that one part's cost. Net
    profit drops by exactly that amount.
12. **Net profit** = Sales profit + Repair profit + Order profit − Reversed by returns.
13. **Supplier payments don't touch profit:** record another supplier payment. Every Profit card is
    unchanged. Only the cash card's **− Supplier payments** and the supplier lines move.
14. **Day stability:** pick yesterday's date and note Sales profit. Return a line of one of
    yesterday's sales today. Yesterday's Sales profit is **unchanged**, and today's **Reversed by
    returns** shows the reversal.

### D. Staff dashboard
15. Sign in as a **staff** user and open `/staff`.
    - Under **Cash register — today** you see the same sections and **the same figures** as the
      admin Caisse for today: Sales, Returns, Repairs, Orders, Suppliers, Payments without a
      document, and Net cash movement. These are whole-store figures, including other sellers'
      sales.
    - There is **no Profit section**.
    - No figure is clickable.
    - There is no date picker.
16. In the browser devtools Network tab, open the `cash-register` response on `/staff`. The JSON
    has **no `profit` key** anywhere.
17. Make a sale as that staff user and press **Refresh** in the widget. The Sales figures and the
    cash card update. **My sales today** also counts it, with Algiers midnight as the day boundary
    (F3).
18. Sign in as **admin** and open `/staff`. The widget shows the same figures. The admin-only
    `/admin/cash-register` still shows Profit.
