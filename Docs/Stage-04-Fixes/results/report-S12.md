# Report — Set 12 (Sales & returns)

Executed against `Docs/Stage-04-Fixes/plans/plan-S12-sales-and-returns.md`, all 16 actions,
2026-07-27. All three validation gates green (tsc + lint, contract/api/web). No test file was
edited or read. No test suite was run. **No money or stock arithmetic was touched** — S5's
`createReturn` is unchanged, byte-for-byte, in its transaction body; this set only adds a read
path around it.

---

## Owner decisions this session (recap)

| # | Question | Answer |
|---|---|---|
| R1 | How is the returns list built? | **One paginated `GET /admin/returns`**, rows carry `lines[]` inline — no detail endpoint. |
| R2 | How far does the return dialog go? | **Bounds + refund summary** — corrected per-line max plus a read-only refund/cash/credit-effect panel. |

---

## What changed

### Contract (Actions 1–3)

- `sales.dtos.ts`: new `ReturnLineResponseSchema`/`ReturnLineDto` and
  `ReturnResponseSchema`/`ReturnDto` (product identity denormalised off the linked `SaleLine`,
  `totalQuantity` computed in the mapper). `SaleResponseSchema` gains an optional
  `refundedAmount` (cash actually refunded so far — detail read only, per the plan's F2 finding).
- `sales.query.ts`: new `ReturnListQuerySchema`/`ReturnListQuery` (`saleId`, `from`, `to`,
  pagination).
- `sales.routes.ts`: new `RETURNS_LIST` constant sharing the `RETURN` literal (`/admin/returns`),
  distinguished by verb — same convention as the existing `UPDATE_DRAFT`/`DELETE_DRAFT` pair.

### Backend — sales module (Actions 4–8)

- `sales.mapper.ts`: new `ReturnRow` type and `toReturnDto` (no margin gate — a return exposes
  refund amounts/quantities only, and the route is admin-only anyway). `toSaleDto`'s context
  widened with an optional `refundedAmount`, emitted right after `paidAmount`.
- `sales.service.ts`: new `RETURN_INCLUDE` constant; new `listReturns` (paginated,
  `saleId`/`from`/`to` filters — read-only, no transaction beyond the existing count+page idiom
  `listSales` already uses); `getSale` now resolves and passes `refundedAmount` via a new private
  `cashRefundedSoFar` helper. Per the plan's own fallback note (§2 Action 5, point 3), that helper
  was **not** extracted out of `createReturn` — it duplicates `createReturn`'s inline cap
  computation rather than replacing it, so `createReturn`'s transaction-adjacent money code is
  untouched. Documented in both places as "must never drift."
- `sales.interface.ts`: `ISalesService` gains `listReturns`.
- `sales.controller.ts`: new `listReturns` handler, same shape as `listAdminSales`.
- `sales.routes.ts`: `GET RETURNS_LIST` registered immediately before the existing
  `POST RETURN` on the shared literal, both `adminOnly`.

### Frontend — data layer (Actions 9–11)

- `services/sales.service.ts`: new `listReturns`.
- `lib/query-keys.ts`: new `qk.sales.returns(query)`, nested under `sales` so
  `useCreateReturn`'s existing `qk.sales.all()` invalidation reaches it for free — no change to
  that mutation's fan-out.
- `hooks/useSales.ts`: new `useReturns(query, options)`.

### Frontend — Returns tab (Actions 12–13)

- New `ReturnsTable.tsx` — reference, sale reference, date, client, user, quantity returned,
  total refunded, type. Reuses the existing `admin.sales.returnDialog.typeRefund`/`typeExchange`
  keys rather than declaring new ones.
- New `ReturnDetailDialog.tsx` — renders entirely from the row's own `item.lines` (no fetch): per
  line, product/quantity/sold-at price/refunded amount/restock marker, plus reason and total.

### Frontend — wiring (Actions 14–16)

- `SalesTable.tsx`: new `createdAt` column (required field, no `"—"` fallback needed unlike
  `soldAt`); skeleton column counts bumped by one.
- `StaffSales.tsx`: admin view now wraps the existing sales list and the new returns list in a
  **Sales / Returns** tab bar (`scope === "admin"` gate, staff sees the plain list unchanged).
  New returns-page state, `useReturns` query, and `ReturnDetailDialog` wiring. The dead
  `alreadyReturnedByLine` prop (F1) is now filled: a per-sale `useReturns({ saleId }, { enabled:
  canReturn && !!selectedSale })` query drives a `saleLineId -> already-returned qty` map, passed
  into `ReturnDialog`; its remount `key` now folds in the returns count so a second return on the
  same sale recomputes the bounds instead of reusing stale ones.
- `ReturnDialog.tsx`: lines whose bound is `0` (fully returned already) are filtered out of the
  rendered list, per the plan; a read-only refund-summary panel renders whenever at least one line
  is checked, showing the entered refund total, the actually-refundable cash
  (`sale.paidAmount − sale.refundedAmount`), a warning when the entered amount exceeds it, and
  whether the return is partial or full (D7 — computed against `alreadyReturnedByLine` plus the
  quantities being entered now, not just the current form state in isolation).

### Translations

23 new keys added (en/fr; `ar` left `""` per the file's existing convention):
`staff.sales.table.createdAt`, `admin.sales.tabs.sales`/`returns`, eight
`admin.sales.returnsTable.*` keys, ten `admin.sales.returnDetail.*` keys, and five
`admin.sales.returnDialog.summary*`/`creditEffect*` keys. `admin.sales.returnDialog.typeRefund`/
`typeExchange` and every other key the plan marked "reused" were confirmed present and not
re-added.

---

## Findings recorded during execution

No new findings beyond the plan's own F1–F6 — all held up as written:

- F1 (`alreadyReturnedByLine` was dead) — confirmed by reading `StaffSales.tsx` before this set;
  now wired end-to-end.
- F2 (the cash-refund cap is invisible / must not be derived from the returns list) — respected:
  `refundedAmount` comes from a ledger aggregate (`cashRefundedSoFar`), never from
  `Σ Return.refundAmount`.
- F6 (nothing in this set touches stock, credit, `totalPaid` or `totalSold`) — verified by the
  validation gate's first sweep below; the only new code in `sales.service.ts` is one read query
  and one aggregate helper.

---

## Validation gate

```
=== CONTRACT ===
npx tsc --noEmit   → clean
npm run lint       → clean

=== API (src only) ===
npx tsc --noEmit 2>&1 | grep -E "^src/"   → no output (clean)
npm run lint                              → 6 pre-existing errors (prisma/seed.ts ×3,
                                             validate-request.middleware.ts ×3) — unchanged baseline

=== WEB ===
npx tsc --noEmit                                    → clean (first pass)
npx eslint --fix <files this set touched>           → 3 files reformatted (prettier-only:
                                                        multi-line JSX/object formatting in
                                                        ReturnDialog.tsx, ReturnsTable.tsx,
                                                        ReturnDetailDialog.tsx)
npx eslint <same files> (re-run, no --fix)          → clean
npx tsc --noEmit (re-run after --fix)               → clean
```

No repo-wide `npm run lint` was run in `Apps/web` (the ~10.2k pre-existing prettier baseline is
untouched).

Sweeps:

```
git diff -- Apps/api/src/modules/sales/sales.service.ts | grep -nE "^\+.*(applyDocumentCharge|applyLedgerPayment|captureClientPaymentInTx|returnIn|consumeFifo|totalPaid|totalSold|credit)"
  → no output (no money/stock write added)

find Apps/api/src/modules -name "*.listener.ts" | xargs grep -nE "credit|totalPaid|totalSold|paidAmount|quantityOn|quantityRes"
  → matches only comments and narration-string builders (unchanged from S9/S10's own sweep)

grep -rn "'/admin/returns'" Apps/web/src Apps/api/src Apps/contract/src
  → matches only Apps/contract/src/modules/sales/sales.routes.ts (RETURN + RETURNS_LIST)
```

---

## Manual verification checklist

The owner runs these in the browser, signed in as **admin** unless stated.

**Setup**
1. `/admin/pos` — make two sales to the same POS client: **Sale A** paid in full, **Sale B** paid
   only partially (the rest on credit). Note the client's credit and total paid before you start.

**Sales table**
2. `/admin/sales` — the table now has both a **Date** (sold) and a **Created** column, and a draft
   row shows `—` for Date but a real timestamp for Created.

**Returns tab**
3. A **Sales / Returns** tab bar sits above the table. The Returns tab is empty at first.
4. Open Sale A → **Issue return** → return **one** of two units of one line, restock on, refund =
   one unit's price. Submit.
5. The Returns tab now lists one row: return reference, **Sale A's** reference, today's date, the
   client's name, your username, quantity `1`, the refunded total, and type *Refund*.
6. Click that row → a dialog lists the returned product with the price it was **sold** at and the
   amount **refunded**, the restock marker, and the total.
7. `/staff/sales` as a staff user: **no** tab bar, no Returns table — staff parity is S18.

**Per-line bounds (F1)**
8. Re-open Sale A → **Issue return**. The line you partly returned now caps at the **remaining**
   quantity, not the original. Try to type more → the form blocks it *before* submitting (no server
   error toast).
9. Return the remaining unit and every other line, so the sale is fully returned. Re-open the
   dialog → that sale's lines are gone / it offers nothing left to return, and the sale's status
   reads **Returned**.

**Refund summary (R2/F2)**
10. Open **Sale B** (partially paid) → **Issue return** → tick a line and enter a refund **larger**
    than what was actually paid on that sale. The summary shows *Refund entered* and a smaller
    *Cash refundable*, plus the warning that only the refundable part comes back in cash.
11. The same panel reads **"Partial return — the client's credit is unchanged."** Tick every line at
    full quantity → it flips to **"Full return — this sale's credit is reversed."**
12. Submit the partial return. `/admin/pos-clients` → the client's **credit is unchanged**, their
    **total sold** fell by the refund, and their **total paid** fell only by the cash that was
    actually available (never below where it started) — D7, unchanged from S5.
13. `/admin/invoices` → Sale B's invoice moved back from PAID/PARTIALLY_PAID, and the payments
    ledger shows a **negative-amount** row for the refund (D6).

**The ledger invariant still holds**
14. `SELECT SUM(amount) FROM "ClientPayment" WHERE "posClientId" = '…';` equals that client's
    `totalPaid` exactly.

**Nothing else moved**
15. `/admin/pos` still confirms a sale, prints its receipt and records its ledger row exactly as
    before.
16. The sales list's status filter, date range, seller and POS-client filters and pagination all
    behave as they did; the sale detail drawer still opens on row click with its cost/profit lines
    and credit snapshot.
17. `/admin/orders` — the S11 work is untouched: action column, stat badges, user/category columns
    all still render.

---

The owner reviews and approves before S13 begins.
