# Report S30 — Repair lifecycle: reservations, cancellation, return & receipts

Executed from `Docs/Stage-04-Fixes/plans/plan-S30-repair-lifecycle.md` on 2026-10-11. Nothing
is committed; all changes are in the working tree on `main`.

**Gates:** contract, api and web all pass `tsc --noEmit`, with zero errors outside test files.
Lint is clean on every file S30 touched. No test file was read, edited or run. Full results are
in §5.

---

## 1. Deleting a part never left a reservation in the database

Before writing any code I checked the database and the code. Both were consistent:

- `removePart` already released the part's reservation inside the same transaction that deletes
  the part.
- In the dev database, every product's `quantityReserved` equals the net of its PENDING ledger
  rows. Every repair's net PENDING balance equals its current parts.
- Your own test on **REP-2026-0008** (2026-10-11, 14:13–14:26) shows a `PENDING_RELEASE −1` row
  for each of the two deletes, in the same second as the delete.
- The only reservation still open in the whole database is **ORD-2026-0001**, an order.

**What you saw came from the screens, and both causes are now fixed:**

- **F4 — product views kept old figures.** Adding, deleting or picking up a repair part never
  refreshed the product lists. The admin products list, the POS cards and the repair part search
  kept showing the old reserved and available quantities. All repair mutations now refresh the
  catalog too.
- **F5 — the ledger was hard to read.** It printed the raw word `PENDING_RELEASE`, with no
  translation and no legend. Filtering by "PENDING_REPAIR" showed the reservation without the row
  that released it. Every movement type now has a translated label, the type filter uses the same
  labels, and an ⓘ legend next to the filter explains each type. The ledger is append-only, so the
  reservation row is *meant* to stay; the release row beside it now reads "Reservation released".

**Two real gaps were closed while auditing:**

- **F6 — a race between tabs.** If one tab added a part while another tab picked up or cancelled
  the same repair, the new part's reservation was never released, on a repair that was now
  read-only. Every repair mutation now locks the repair row and re-reads it inside its own
  transaction. The same lock stops the labour-price edit and the add-part edit from overwriting
  each other's total.
- **F7 — a release could reduce someone else's reservation.** `inventory.release` capped the
  amount only by the product-wide reserved figure. It is now also capped by what that same
  repair or order still holds.

## 2. Decisions I took myself — object to any of these before S31

| # | Decision |
|---|---|
| P1 | A release is capped by what the same order or repair still holds (one extra sum query, run while the product is already locked). Every existing caller releases with the same reference it reserved with, so their behaviour is unchanged. |
| P2 | Every repair change locks the repair row (`SELECT … FOR UPDATE`) and makes its decisions from the locked copy, never from a copy read before the transaction. |
| P3 | Returning a repair has its own endpoint, `POST …/repairs/:id/return`, open to staff and admin. Sending `toStatus: RETURNED` to the status endpoint is rejected with a translated message. |
| P4 | Dragging a card onto the new **Returned** lane snaps back with the existing "That move isn't allowed" toast. Returns go through the ticket's **Return repair** button. |
| P5 | Restock rows (`REPAIR_RETURN`) are recorded against the repair (`referenceType: 'REPAIR'`), so the ledger shows `REP-…`. They avoid the RETURN reference wart. |
| P6 | At pickup, each part now records the stock movement that consumed it. A return restocks at that movement's cost. A part picked up **before** S30 is matched by product instead, and the return refuses to restock it (with a translated message) if the same product was fitted twice on that repair. |
| P7 | A walk-in repair has no client account, so it gets no ledger rows. On cancel or return only the repair's own Paid and Refunded figures move. A walk-in's cancelled invoice keeps the paid amount it was issued with. |
| P8 | New stored figures on `Repair`: `refundedAmount`, `cancelledAt` and `returnedAt`. They give the walk-in refund a record, and give S33 something to read. |

Your settled decisions Q1–Q4 are implemented as planned:
- **Q1:** each cancelled or returned payment gets its own negative row, linked to the original
  through `reversalOfId`, newest first.
- **Q2:** a returned repair leaves statistics entirely.
- **Q3:** the receipt never lists parts or labour at any stage.
- **Q4:** a return refunds everything, and the amount can't be edited.

## 3. What changed, by layer

### Database (`Apps/api/prisma`)
- **Migration `20261011150000_s30_repair_return`.** It is schema-only: three enum values
  (`MovementType.REPAIR_CANCELLED`, `MovementType.REPAIR_RETURN`, `RepairStatus.RETURNED`), new
  columns, one unique index, one index and two foreign keys. There is **no UPDATE, DELETE or
  backfill**.
- **How it was created:** `prisma migrate dev` refuses to run in this non-interactive shell. I
  generated the SQL with `prisma migrate diff` against the up-to-date dev database, checked it
  (above), applied it with `prisma migrate deploy`, and regenerated the client.
- **The test database (port 5544) was not migrated**, because no tests run in this programme.
- **New columns:**
  - `Repair.refundedAmount`, `Repair.cancelledAt`, `Repair.returnedAt`
  - `RepairPart.consumptionMovementId` (unique, links to `StockMovement`) and `RepairPart.restockedOnReturn`
  - `ClientPayment.reversalOfId` (links to another `ClientPayment`, indexed)

### Contract (`Apps/contract`)
- **Enums:** `MovementType` gains `REPAIR_RETURN` (placed after `RETURN_IN`) and
  `REPAIR_CANCELLED` (after `PENDING_RELEASE`). `RepairStatus` gains `RETURNED`.
- **`repairs.constants.ts`:**
  - New transition PICKED_UP → RETURNED.
  - Terminal statuses are now `[CANCELLED, RETURNED]`.
  - New `REPAIR_READ_ONLY_STATUSES` and `isRepairReadOnly()`. `isRepairStatusTerminal` is kept,
    with its new meaning.
  - New `REPAIR_ERROR` list of error messages. `READ_ONLY` keeps the exact
    `'REPAIR_READ_ONLY'` string the code already threw.
- **New command and routes:** `ReturnRepairSchema { restockPartIds; note? }`, plus
  `STAFF_RETURN` and `ADMIN_RETURN` routes.
- **`RepairDto`:**
  - gains `refundedAmount`, `cancelledAt?` and `returnedAt?`;
  - `payments[]` gains `reversesReference?`;
  - `parts[]` gains `restockedOnReturn?`.
- **Technician stats** gain `returnedCount`.
- **Events:** new `repair.returned` event.
- **`ClientPaymentDto`** gains `repairReference?` and `reversesReference?`.

### Backend (`Apps/api/src`)
- **Inventory (`inventory.service.ts`):**
  - `release(…, type = PENDING_RELEASE)` is capped by what the same repair or order holds (P1).
  - `returnIn(…, type = RETURN_IN)` accepts `REPAIR_RETURN`.
  - The comments listing which types change `avgPrice` and `avgStockPrice` now include the new
    types.
- **Billing:**
  - `captureClientPaymentInTx` accepts `reversalOfId`.
  - New `cancelInvoiceInTx`: changes the status only, does nothing if already cancelled, and
    sends no event.
  - Payment lists now include the repair and the reversed payment, so the payment DTO gains
    `repairReference` and `reversesReference`.
- **Repairs service (`repairs.service.ts`):**
  - New `lockRepair` helper, used by `updateRepair`, `addPart`, `removePart`, `changeStatus`,
    `pickUpRepair`, `cancelRepair`, `recordPayment` and `returnRepair`.
  - `pickUpRepair` reads all figures and parts from the locked row, and records
    `consumptionMovementId` on each part.
  - `cancelRepair` releases each part as a `REPAIR_CANCELLED` row and never touches on-hand
    stock. It reverses payments one by one, newest first, partly if the refund prompt was
    lowered. It sets `cancelledAt` and `refundedAmount`. It now also announces each reversal
    row (`payment.clientRecorded`); before S30 a cancellation announced none.
  - **New `returnRepair`**, in this order:
    1. Restock the parts switched on, at their consumed cost (`REPAIR_RETURN`). Mark every part
       restocked or not.
    2. Reverse every payment in full.
    3. Reverse the repair's charge on the client account.
    4. Cancel the invoice. This comes *after* the reversals, so the invoice's paid amount
       already reads 0 when it is cancelled.
    5. Set the repair to RETURNED, write its status history, and send the events.
  - New `reversePaymentsInTx` and `partConsumptions` helpers.
  - Technician stats now count `returnedCount`.
- **Repairs mapper, controller and routes:** carry the new fields, plus the new return handler
  and its two routes.
- **`observability.listener.ts`:** writes an audit-log entry for `repair.returned`.
- **`statistics.service.ts`:** comments only. Repairs are already counted only at PICKED_UP, so
  CANCELLED and RETURNED repairs drop out of every figure with no code change (Q2 confirmed by
  reading every repair query). The old comment "repairs have no return path" was false and has
  been replaced.

### Frontend (`Apps/web/src`)
- **Repair hooks:** adding or deleting a part and changing a status now refresh the catalog
  (F4). New `useReturnRepair` hook and `returnRepair` service call.
- **`query-client.ts`:** the six new repair error messages show as translated toasts.
- **Repair board and labels:** new **Returned** label and a sixth board lane. The grid now shows
  three columns, and six from the extra-wide breakpoint up. The status dialog never offers
  RETURNED.
- **New return dialog** (`RepairReturnDialog.tsx` + `return-repair.schema.ts`): one restock
  switch per part, on by default. The refund total is shown read-only, with a note for an
  account client or a walk-in. An optional reason field. Red confirm button.
- **Ticket drawer (`RepairTicketDetail.tsx`):**
  - Read-only is now decided by `isRepairReadOnly`.
  - A **Return repair** button on picked-up tickets.
  - A "Refunded" row when anything was refunded.
  - A "Restocked" / "Not restocked" badge on each part after a return.
  - "reverses PAY-…" on each reversal payment row.
- **Receipts (HTML and thermal):** no parts, labour or parts-total lines at any stage. While the
  total is 0, the Total, Amount due and stamp are left off; Paid still prints if anything was
  prepaid. A "Refunded" line prints when anything was refunded.
- **Movement ledger:**
  - New `movement-type-labels.ts` (label and legend line for each of the 13 types) and
    `movement-type-legend.tsx` (ⓘ popover in three groups).
  - The ledger table and type filter use the translated labels.
  - The filter's first option now reads "All types". It wrongly showed the common "Status"
    label before.
- **Payments:**
  - `PaymentsLedger` and `client-payments-table` show "Repair REP-…" when a payment has no
    invoice yet, and "Reverses PAY-…" under a reversal amount.
  - The `PaymentsLedger` mobile row now also shows the document.
- **Dashboard and Technicians tab:** a Returned count in the dashboard widget and a Returned
  column in the Technicians tab.
- **`translations.json`:** 58 keys added. The four now-unused repair-receipt keys (`parts`,
  `labour`, `partsTotal`, `serials`) were removed after a search confirmed nothing else uses
  them. The file is still valid JSON, and was rewritten through a load-and-save that leaves
  existing entries byte-for-byte unchanged.

### Docs (`Docs/Stage-00-Conception`)
- `database-description.md`, `schema.prisma` and `Module-Contracts/repairs.md` now include the
  S30 additions.
- **Already out of date before S30, not fixed (outside this set):**
  - Repair is still described with `saleId`, the repair-origin sale.
  - The repairs contract still describes S13's earlier `consumedPartReturns` and `paidAmount`
    command, and says parts are consumed at COMPLETED.
  - The Stage-00 schema copy has no `ClientPayment.repairId`.
  - S30 corrected only the sentences it would otherwise contradict. I added
    `ClientPayment.repairId` to `database-description.md` because the new `reversalOfId` sits
    next to it.

## 4. Gaps left open, which I found and did not fix

- **An admin can cancel a REPAIR invoice from the invoices page.** That only changes the invoice
  status: no payment is reversed, the client's balance doesn't move, and the repair stays
  PICKED_UP. This existed before S30. Returning the repair is the correct path.
- **A disabled client can't be refunded.** The client-account lock rejects disabled clients, so
  returning or cancelling (with a refund) a repair for a disabled POS client fails. Sales and
  order returns behave the same way today.
- **Some type labels still print in English codes.** The ledger's CSV/PDF export and the
  statistics stock-movement report still show raw type names. These are server-side and
  outside this set's scope.

## 5. Validation gate

| Gate | Result |
|---|---|
| `Apps/contract` `tsc --noEmit` | ✅ 0 errors |
| `Apps/contract` `npm run lint` | ✅ clean |
| `Apps/api` `tsc --noEmit` (`src/**`) | ✅ 0 errors |
| `Apps/api` `tsc` — test files | 198 errors in 29 files: **the same files and the same count per file** as an unchanged copy of the code compiled against the same regenerated Prisma client. S30 added no new compile errors in tests. |
| `Apps/api` `npm run lint` | 7 errors, all in files S30 did not touch (`prisma/seed.ts`, `common/middlewares/validate-request.middleware.ts`, `modules/orders/orders.service.ts`). They were there before S30. |
| `Apps/web` `tsc --noEmit` | ✅ 0 errors |
| `Apps/web` `tsc -p tsconfig.test.json` | Same per-file error counts as the unchanged code |
| `Apps/web` eslint on the 20 touched/new `.ts/.tsx` files | ✅ clean |
| `Apps/web` `npm run lint` (whole repo) | 3 192 problems, the formatting noise that was already there. The touched files contribute none. |
| Plan §7 search checks | ✅ no runtime use of `isRepairStatusTerminal` left; no literal `'REPAIR_READ_ONLY'`; the only `existing.*` money reads in repairs are the pre-transaction early checks, which are re-read from the locked row inside; no `PENDING_RELEASE` in repairs (cancel writes `REPAIR_CANCELLED`). |
| `translations.json` | ✅ valid JSON |

**Behaviour was not checked by running the app.** Per the programme rules, no test suite or
script exercised the new flows. The money and stock arithmetic was checked by tracing the code
against the plan's §6 worked examples. The checklist below is the real check.

---

## 6. Manual verification checklist (browser)

Open `/admin/inventory` (Stock, Movements, Reservations), `/admin/invoices` → Payments, the
POS-client detail drawer and `/admin/repairs` in separate tabs. Use one POS client whose credit
you note down first, and one product P whose on-hand, reserved and avg stock price you note down.

### A. Reservations and the display fix (F4/F5)
1. Open a repair in INTAKE and add P ×1. **Without reloading**, the admin products list and the
   repair's own part search show P's available quantity **down by 1**.
2. Delete the part. Without reloading, available goes **back up**.
3. Movements tab, filtered on P: `Repair reservation +1` then `Reservation released −1`, both
   referencing `REP-…`, in the same second as your clicks. The type column and the type filter
   show translated labels. The ⓘ legend opens and explains every type in three groups. The
   filter's first option reads "All types".
4. Reservations tab: no open row for that repair.
5. Add P ×1 again. In a second tab, open the same repair and move it to CANCELLED. Back in the
   first tab, try to add another part: you get the "repair is closed" toast, **not** a new
   reservation. Reservations tab: nothing open for that repair. (F6)

### B. Cancellation (from INTAKE, PROCESSING and COMPLETED)
6. New repair for the POS client. Add P ×1, record payments of 1 500 and then 500, set labour,
   and cancel with the refund lowered to 700.
7. Movements: one **`Repair cancelled −1`** row (PENDING). Stock tab: P's **on-hand is
   unchanged** and reserved is back to its starting value. **No IN row exists.**
8. Payments page: two new negative rows. −500 "Reverses PAY-(the 500)" and −200 "Reverses
   PAY-(the 1 500)". The invoice column reads "Repair REP-…". Credit snapshots chain: credit
   rises by 500, then by 200.
9. POS-client drawer: credit is 1 300 below where it was before the repair, and totalPaid is
   1 300 above. The ticket reads CANCELLED, Paid 1 300, Refunded 700, and is read-only.
10. Repeat with the default refund (= everything paid). Credit and totalPaid return to their
    pre-repair values.
11. Try to cancel a PICKED_UP repair: CANCELLED is not offered, and no Update-status button
    shows.
12. Statistics overview and repairs report for today: cancelled repairs add nothing to revenue,
    cost or profit. Technicians tab: they count under Cancelled only.

### C. Pickup (regression) and Return
13. New repair for the POS client. P ×1 at 3 000, labour 1 000, prepay 1 500, pick up paying
    1 000. Movements: `Reservation released −1`, then `Repair consumption −1` with its cost.
    Invoice FAC-… is PARTIALLY_PAID at 2 500.
14. The ticket shows a red **Return repair** button. Open it: one switch per part (on by
    default), refund 2 500 read-only, the account note. Switch the part **on** and confirm.
15. Movements: `Repair return +1` (IN), referencing `REP-…`, with **unit cost equal to the
    consumption row's cost** (not the current average). Stock: P on-hand +1, avg stock price
    recomputed. Avg price (supplier) unchanged.
16. Payments: −1 000 reversing the pickup payment and −1 500 reversing the prepayment, both
    showing FAC-… in the invoice column.
17. Invoices: FAC-… is **CANCELLED**, and its number is unchanged (no renumbering, no gap
    closed).
18. POS-client drawer: credit, totalPaid and totalSold are **exactly** the values you noted
    before step 13.
19. Ticket: RETURNED, read-only, the part badged "Restocked", Refunded 2 500, timeline shows
    Picked up → Returned with your reason. Board: card in the new **Returned** lane. Dashboard
    widget: Returned count.
20. Repeat steps 13–19 with the switch **off**: no `Repair return` row, P on-hand unchanged,
    badge "Not restocked", money rows identical.
21. Statistics for today: both returned repairs are absent from revenue, cost and profit.
    Technicians tab: counted under Returned, not in revenue.
22. Walk-in repair, picked up and fully paid, then returned. No ledger rows appear. Invoice
    CANCELLED. Ticket Paid 0, Refunded = total.
23. Drag any card onto the Returned lane: it snaps back with "That move isn't allowed".

### D. Receipts and tickets (Q3)
24. Fresh INTAKE ticket, nothing priced. Print the receipt (browser and thermal if available).
    **No Total, no Amount due, no stamp.** If a prepayment was recorded, only "Paid" shows.
25. Add a part and labour, then print: **no parts lines, no labour line, no parts total**. Total,
    Paid, Amount due and the stamp show the current figures.
26. Picked-up ticket: Total, Paid and the PAID stamp, with no breakdown. Cancelled or returned
    ticket: the "Refunded" line appears.
27. The client label (Print label) is unchanged.

### E. Regression sweep
28. Orders: confirm, cancel and complete an order. Reservations open and close as before, and
    Reservations shows no stray negative or open rows (P1 clamp).
29. POS sale and sales return: unchanged, `Sale/order return` label on RETURN_IN rows.
30. Ledger CSV/PDF export still works. Types there are raw enum names (server-side export, out of
    scope).

---
