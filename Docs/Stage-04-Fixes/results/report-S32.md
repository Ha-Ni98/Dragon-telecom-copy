# Report — Set 32 (POS & sales: payment validation, search and returns)

Executed against `Docs/Stage-04-Fixes/plans/plan-S32-pos-sales-payment-validation-and-returns.md`,
all actions, 2026-10-12. Built on top of the uncommitted S30 + S31 working tree; nothing of theirs
was reverted.

**Gates:** contract, api and web all pass `tsc --noEmit` with zero errors outside test files.
Lint is clean on every touched file; api lint shows only its 7 pre-existing errors. No test file
was read for editing, edited or run. **No schema change, no migration.**

---

## Decisions

### Owner decisions (taken while planning)

| # | Question | Answer |
|---|---|---|
| Q1 | Which figure reduces revenue for a returned **sale** line? | **The line price** (`unitPrice × returned qty`), the same amount `totalSold` falls by. Order returns keep S24 (refund). |
| Q2 | Which timestamp does the sales date filter / Today use? | **`soldAt`**, Africa/Algiers days, `to` inclusive. Date-filtered lists hide drafts. |

### Plan decisions (applied as written)

| # | Decision |
|---|---|
| P1 | Money equality is compared in cents, on both sides. |
| P2 | Whole-sale return is its own endpoint `POST …/returns/whole-sale`. It splits one refund by line value and delegates to `createReturn`. |
| P3 | Split rule: `floor` for every line except the last, which takes the remainder. When the total value is 0, everything goes to the last line. |
| P4 | Inside a return, the document charge runs before the negative ledger row (mirrors `confirm`). The refund row's `newCredit` is therefore the final balance. |
| P5 | Sale-refund rows carry `invoiceId` only, with no `reversalOfId`. |
| P6 | New `SaleDto.posClientCredit` (detail read only) holds the client's **current** credit, used for the return dialogs' preview. |
| P7 | Product search and Today are shown to staff too. The date inputs stay admin-only. |
| P8 | `SaleDto.refundedAmount` is kept and is informational only (no cap). |
| P9 | The POS "Change due" row is removed. |

---

## Findings

- **F1 — the confirm-time `ClientPayment` row was already correct.** No code changed. One row,
  `amount = paidAmount`, linked to the invoice issued in the same transaction. Its
  `previousCredit` is the balance after this sale's charge, and its `newCredit` is the
  post-payment balance. `totalPaid` moves only through `applyLedgerPayment` on the locked row. No
  row is written when 0 is paid.
- **F2 — the sales list's `to` date excluded its own day**, and the filter used `createdAt`.
  This is fixed for the sales list (Algiers bounds on `soldAt`, exclusive next-day upper bound).
  **The same `lte: new Date(query.to)` pattern remains** in `listReturns`, billing, purchasing,
  orders and repairs list queries. Out of scope; **S33 must use the new `storeDayRangeUtc`
  helper for every day it reads.**
- **F3 — staff could list other sellers' sales.** `listSales` spread the staff scoping
  `{ staffId }` first, and `?sellerId=` then overwrote it. Fixed by spreading the scoping last.
  This was confirmed by reading the code; it was **not reproduced in a browser** (no browser
  automation here). To check it before or after the fix by hand, call
  `GET /api/staff/sales?sellerId=<another staff id>` as a staff user. It now returns only the
  caller's own sales.
- **F4 — known display edge.** A sale refund row is linked to the sale's invoice. If the cash
  refunded exceeds what was paid **against that invoice** (e.g. the client settled the sale
  later through an on-account payment), `Invoice.paidAmount` goes negative and the status falls
  to ISSUED. The client's `totalPaid` and `credit` stay correct. Not fixed.

---

## What changed

### Contract (`Apps/contract`)
- **New `src/common/store-time.ts`** (exported from `src/index.ts`): `STORE_TIME_ZONE`,
  `storeLocalDate()`, `storeDayStartUtc()`, `storeDayRangeUtc(from?, to?)`. Pure `Intl`.
  Sanity-checked: `storeDayRangeUtc('2026-10-11','2026-10-11')` →
  `{ gte: 2026-10-10T23:00Z, lt: 2026-10-11T23:00Z }`, and 23:30Z on 10 Oct is local
  2026-10-11.
- **New `sales/sales.constants.ts`**: `SALE_ERROR` (`CREDIT_REQUIRES_CLIENT` with its historic
  value, `WALK_IN_OVERPAYMENT`, `WALK_IN_REFUND_MISMATCH`, `WHOLE_RETURN_LINES_MISMATCH`,
  `NOTHING_TO_RETURN`).
- `sales.command.ts`: S32 comment on `CreateReturnSchema`; new
  `ReturnWholeSaleSchema`/`ReturnWholeSaleCommand`.
- `sales.query.ts`: `product` filter; the comment documents the Algiers/`soldAt` semantics of
  `from`/`to`.
- `sales.routes.ts`: `ADMIN_RETURN_WHOLE_SALE`, `STAFF_RETURN_WHOLE_SALE`.
- `sales.dtos.ts`: `posClientCredit`; `refundedAmount` comment no longer mentions a cap.
- `sales.events.ts`: `creditEffect` now documented as `Σ(refund − linePrice)`.

### API (`Apps/api`)
- `sales.interface.ts`: `ISalesService.returnWholeSale`.
- `sales.mapper.ts`: `SaleRow.posClient` includes `credit`; `toSaleDto` emits `posClientCredit`.
- `sales.service.ts`:
  - `SALE_INCLUDE` selects `posClient.credit`.
  - **confirm:** walk-in exactness in cents. Under-payment → `CREDIT_REQUIRES_CLIENT` (unchanged
    sentinel), over-payment → `SALE_WALK_IN_OVERPAYMENT`. The rest of `confirm` is untouched
    (F1).
  - **getSale:** passes `posClientCredit`.
  - **createReturn:** bounds now come from a new shared `returnedQuantities()` helper. The
    walk-in per-line exactness check is added. The cash cap (`refundedSoFar`/`cashRefundable`/
    `cashRefunded`) and the D7 full/partial credit branch are **removed**. For a client:
    `applyDocumentCharge(−goodsValue, −goodsValue)`, then one negative ledger row of
    `−refundAmount` when refund > 0, and `creditEffect = refund − goodsValue`. The restock loop
    and status update are byte-for-byte unchanged.
  - **New `returnWholeSale`:** remaining lines, set-equality check on `lines`, cents-based floor
    split, delegates to `createReturn`.
  - **listSales:** `soldAt: storeDayRangeUtc(from, to)`, the `product` filter
    (`lines.some` barcode prefix OR every token in `productNameSnapshot`), and `extraWhere`
    spread **last** (F3).
  - New private helpers `productLineWhere`, `cents`; stale comments updated
    (`listReturns`, `cashRefundedSoFar`, the `createReturn` header).
- `sales.controller.ts`: `returnWholeSale` handler (200, same as `createReturn`).
- `sales.routes.ts`: the two whole-sale routes (`adminOnly` / `staffSalesOrAdmin`).
- `statistics.service.ts` `returnAdjustments`: a **sale** return's revenue is now
  `round2(unitPrice × qty)`. The order branch is untouched. The header comment is rewritten.

### Web (`Apps/web`)
- **New** `types/settlement.types.ts` (`SETTLEMENT_CHECK`), `lib/settlement.ts`
  (`sameMoney`, `checkSettlement`), `components/shared/CreditChangeConfirmDialog.tsx`.
- `PosPaymentPanel.tsx`: `paidAmount: number | null`, empty input, `step="0.01"`. The change-due
  row is gone. **The unused `total` prop was removed too** (it only fed change-due). This is a
  small deviation from the plan, which did not mention it, but lint would otherwise flag it.
- `StaffPos.tsx`: `paidAmount` starts `null`. The auto-track effect and `paidAmountTouched` are
  deleted. `handleConfirm` validates through `checkSettlement` and opens the credit dialog for
  a client; `submitConfirm` runs the sale. Server sentinels are compared via `SALE_ERROR`
  (`WALK_IN_OVERPAYMENT` gets its own message).
- `services/sales.service.ts` + `hooks/useSales.ts`: `returnWholeSale` /
  `useReturnWholeSale` (same six invalidations as `useCreateReturn`).
- `SalesFilters.tsx`: product search input and a **Today's sales** toggle, in both scopes.
- `StaffSales.tsx`: debounced `product`; `from`/`to` no longer scope-gated; Today toggle via
  `storeLocalDate()`; whole-sale dialog + mutation wiring.
- `SaleDetailDrawer.tsx`: **Return whole sale** button.
- `create-return.schema.ts`: 3-generic input/output schema, refund optional → required via
  refine + transform, walk-in exactness.
- `ReturnDialog.tsx`: the refund starts empty (`setValueAs`) with a sold-price hint. The
  summary is now goods value / refund entered / client credit preview, and the old cash-cap
  rows are gone. A client difference is confirmed through `CreditChangeConfirmDialog`. Array
  errors read both `.message` and `.root?.message`.
- **New** `return-whole-sale.schema.ts`, `ReturnWholeSaleDialog.tsx`.
- `lib/query-client.ts`: four new `SALE_ERROR` sentinel translations.
- `config/translations.json`: **20 keys added** (en/fr, `ar: ""`), exactly the plan's table.
  **5 deleted** after grep confirmed no reference: `admin.sales.returnDialog.summaryCashRefundable`,
  `summaryCashCapped`, `creditEffectPartial`, `creditEffectFull`, `staff.pos.payment.changeDue`.
  The file round-tripped byte-identically before editing.

### Docs
- `Module-Contracts/sales.md`: whole-sale route, `SaleListQuery`, `ReturnWholeSaleCommand`, the
  confirm walk-in rule, the S32 return arithmetic.
- `Pages-Requirements/ADM-10-sales.md`, `STF-02-pos.md`: the new UI rules.

---

## Validation gate

```
contract  npx tsc --noEmit          → clean
          npm run lint              → clean
api       npx tsc --noEmit          → src clean; test files 198 errors / 29 files (identical to S31 baseline)
          npm run lint              → 7 errors, all pre-existing (seed.ts ×3, validate-request ×3,
                                       orders.service ORDER_PRICE_EDIT_STATUS) — none in touched files
web       npx tsc --noEmit          → clean
          npx eslint --fix <15 touched files> → prettier reflowed ReturnWholeSaleDialog.tsx only
          npx eslint <same files>   → clean
          npx tsc -p tsconfig.test.json → 52 errors; none references a symbol S32 changed (all are
                                       older drift: SaleOrigin, SALE_ROUTES.RETURN, useCreateReturn's
                                       S18 signature, listSales' scope arg, onRecordPayment, …)
```

**Expected behavioural staleness (not compile errors; not fixed, not run):**
- api `sales.service.spec.ts` / `sales.integration.spec.ts`: assertions on the D7 return
  arithmetic and the cash cap; a walk-in overpayment that used to succeed.
- api statistics specs that assert sale-return revenue = refund.
- web `pos.test.tsx` and `PosPaymentPanel` tests: paid is no longer pre-filled and there is no
  change-due row. `ReturnDialog` tests: refund not pre-filled, summary rows changed.

**Grep sweeps:**
1. `"CREDIT_REQUIRES_CLIENT"` in `Apps/web/src` → one hit, `StaffOrders.tsx:138` (orders,
   explicitly out of scope). The POS no longer uses the literal.
2. `cashRefundable|cashRefunded|refundedSoFar` → only `orders.service.ts` (out of scope) and the
   intentionally kept `cashRefundedSoFar` helper (P8).
3. `paidAmountTouched|changeDue` in web → none.
4. `createdAt: {` in `sales.service.ts` → none.
5. Added lines in `sales.service.ts` matching `totalPaid|tx.posClient|tx.clientPayment` → comments
   only. Money moves solely through `applyDocumentCharge` / `captureClientPaymentInTx`.

---

## §6 — Manual verification checklist (browser)

Signed in as **admin** unless stated. Keep these open in separate tabs: `/admin/pos`,
`/admin/sales`, `/admin/pos-clients` (POS client **C**'s detail drawer), `/admin/invoices` →
**Payments**, `/admin/inventory` → **Movements**, `/admin/statistics`.

**Setup.** Pick product **P1** (sold at 1 000 DZD, ≥ 5 in stock) and **P2** (500 DZD, ≥ 5 in
stock). Write down C's **credit**, **total paid** and **total sold**, and P1/P2 on-hand. After every
step below, re-read C's three figures. Each step states the expected change.

### A. POS — walk-in
1. Add P1 + P2 (total 1 500). The **Paid amount** field is **empty**, and there is no "Change due"
   line.
2. Press **Confirm** with the field empty → blocked: "Enter the amount the customer paid".
3. Type 1 400 → Confirm → blocked: "Without a client, the amount paid must equal the total
   (1 500 DZD)". Type 1 600 → same message.
4. Type 1 500 → Confirm → receipt. **Payments ledger: no new row.** Movements: one SALE OUT row
   for P1 and one for P2, each with a cost.

### B. POS — attached client C
5. Ticket P1 (1 000), attach C, paid 1 000 → confirms **without** a dialog. C: credit unchanged,
   total paid +1 000, total sold +1 000. Payments ledger: **one** row of +1 000 with the sale's
   invoice number, previous credit = (old credit + 1 000), new credit = old credit.
6. Ticket P1, C attached, paid 600 → a **confirmation dialog** shows Total 1 000, Paid 600, credit
   old → old + 400. **Cancel** → nothing happens: the ticket is still there and no sale exists.
   Confirm again → **Confirm** → sale done. C: credit +400, total paid +600, total sold +1 000.
   Ledger row: +600, previous = old + 1 000, new = old + 400. In `/admin/sales` the sale's drawer
   shows credit old → old + 400.
7. Ticket P1, C attached, paid 1 300 → dialog shows old → old − 300 → confirm. C: credit −300,
   total paid +1 300, total sold +1 000.
8. Ticket P1, C attached, paid 0 → dialog old → old + 1 000 → confirm. **No ledger row.** Total
   paid unchanged, total sold +1 000.
9. Ledger invariant: `SELECT SUM(amount) FROM "ClientPayment" WHERE "posClientId" = '<C id>';`
   equals C's total paid exactly.

### C. Sales page — search and Today
10. `/admin/sales` → type part of P2's name → only sales containing P2 are listed, each **once**,
    including the multi-line sale from step 4. Clear, then type the first digits of P1's barcode →
    sales containing P1.
11. Click **Today's sales** → the button is highlighted, both date inputs show today's date, and
    only sales **confirmed** today appear (no drafts). Click it again → filter cleared.
12. Set the date range to today → today's sales appear. Before S32, a `to` of today hid today's
    sales.
13. As a **staff** user, `/staff/sales`: product search and **Today's sales** are there. The date
    inputs, seller and client filters are not. Only your own sales are listed.

### D. Returns — single lines
14. Walk-in sale from step 4 → drawer → **Issue return** → tick P2 → the refund field is **empty**
    and a hint shows "Sold price: 500 DZD". Submit empty → "Enter the refund amount". Type 400 →
    "must equal the sold price". Type 500, restock **on** → done. Movements: one RETURN IN row for
    P2 at the **same unit cost** as P2's SALE OUT row in step 4. **Payments ledger: no row.**
15. Sale from step 5 (C paid in full) → return P1, refund 1 000 → **no dialog**. C: credit
    **unchanged**, total paid −1 000, total sold −1 000. Ledger: one row −1 000 on that sale's
    invoice, previous credit = old − 1 000, new credit = old. That invoice's status drops from PAID.
16. Sale from step 8 (C paid 0) → return P1, refund **0** → dialog: due 1 000, entered 0, credit
    old → old − 1 000 → confirm. C: credit −1 000 (debt erased), total paid unchanged, total sold
    −1 000. **No ledger row** (refund is 0).
17. Sale from step 7 (C paid 1 300) → return P1, refund 0, restock **off** → dialog old → old −
    1 000 → confirm. C: credit −1 000 (the store now owes it), total paid unchanged, total sold
    −1 000. Movements: **no** row for this return.

### E. Returns — whole sale
18. Confirm a new sale to C: 2 × P1 + 1 × P2 (total 2 500), paid 2 500. Issue a normal return of
    1 × P1, refund 1 000.
19. Same sale → **Return whole sale** → the dialog lists **1 × P1** (remaining) and **1 × P2**,
    each with a restock switch. The value is 1 500, and the refund field is empty. Turn P2's
    restock off, refund 1 500 → no dialog → done. The sale shows **Returned**. The Returns tab row
    has quantity 2 and refund 1 500. Its detail shows P1 1 000 / P2 500. Movements: RETURN IN for
    P1 only. C: credit unchanged, total paid −1 500, total sold −1 500.
20. Repeat 18–19 with refund **1 200** → dialog old → old − 300 → confirm. The detail splits it
    800 / 400.
21. A walk-in multi-line sale → **Return whole sale** with a wrong refund → blocked. The exact
    total → done.

### F. Statistics and invariants
22. `/admin/statistics` for today: the revenue removed by step 16's return is **1 000**, not 0
    (Q1). Compare revenue before and after step 16.
23. Re-run step 9's SQL: `totalPaid` still equals Σ ledger rows.
24. `SELECT "totalSold" FROM "PosClient" WHERE id = '<C id>'`. It equals the starting value
    + Σ of C's sale totals in this session − Σ returned line prices in this session.

### G. Regression
25. A repair pickup and an order completion still post their ledger rows as before. A
    `/admin/orders` return still behaves as in S24.
26. The POS drafts drawer, resuming a draft (paid starts empty), the F4 → Enter shortcut and
    receipt printing still work.

---

The owner reviews and approves this report before S33 begins.
