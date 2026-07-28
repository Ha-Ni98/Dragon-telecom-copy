# Report — Set 10 (Orders: backend semantics)

Executed against `Docs/Stage-04-Fixes/plans/plan-S10-orders-backend-semantics.md`, all 18 actions,
2026-07-27. Both validation gates green (tsc + lint, contract/api/web). No test file was edited or
read. No test suite was run. Implements **D2** (stock/profit at COMPLETED only), **D3** (invoice
at COMPLETED), **D4** (`CANCELLED_BY_CLIENT`), **D5/D6** (ledger rows) and **D11** (delivery price
at PACKAGED).

---

## Owner decisions this session (recap)

| # | Question | Answer |
|---|---|---|
| R1 | Admin `COMPLETED → RETURNED` alongside the new machine? | **Yes, both** — kept as a separate document action from `IN_DELIVERY → RETURNED`'s pure release. |
| R2 | Guest/never-approved-client payment at COMPLETED? | **Require paid = total**, `CREDIT_REQUIRES_CLIENT` otherwise. |
| R3 | Separate confirm endpoint vs. folded into `PATCH /status`? | **Folded in** — `POST .../confirm` and `ConfirmOrderCommand` are gone. |
| R4 | Where does the client-cancel widening (D4) land? | **Here** — `cancelMyOrder` now allows any non-terminal status. |

---

## What changed

### Contract (Actions 1–4)

- New `Apps/contract/src/modules/orders/orders.constants.ts`: `ORDER_STATUS_TRANSITIONS` (per-type
  map), `ORDER_TERMINAL_STATUSES`, `ORDER_PRICE_EDIT_STATUS`, and the helper functions
  `orderTransitionsFrom`, `isOrderTransitionAllowed`, `isOrderStatusTerminal`,
  `orderTransitionRequiresPayment`, `orderTransitionAllowsPriceEdit`. Exported from the module's
  `index.ts`.
- `orders.command.ts`: `ConfirmOrderSchema`/`ConfirmOrderCommand` **deleted**.
  `UpdateOrderStatusSchema` gains `lines?: {orderLineId, unitPrice?, serialNumbers?}[]` and
  `paidAmount?`.
- `orders.routes.ts`: `STAFF_CONFIRM`/`ADMIN_CONFIRM` **deleted**.
- `orders.events.ts`: `order.confirmed` slimmed to `{orderId, clientId?, posClientId?,
  confirmedByStaffId}` — no more `snapshotLines`/`totals` (nothing accrues at confirmation any
  more). `order.cancelled` gains `byClient?: boolean`.

### Backend — orders module (Actions 5–8)

- `orders.interface.ts`: `confirmOrder` removed from `IOrdersService`; new `IBillingIssuePort`
  (mirrors sales' own, narrowed to `issueInvoiceInTx`/`captureClientPaymentInTx`).
  `IOrderCreditPort`'s comment updated — orders now apply a real `creditDelta` at COMPLETED.
- `orders.routes.ts` / `orders.controller.ts`: `billingService` wired in as the service's 7th
  constructor argument; both CONFIRM routes and the controller method deleted.
- `orders.service.ts` — the core rewrite:
  - `STATUS_SEQUENCE` deleted; `updateStatus` is now the single driver, gated by
    `isOrderTransitionAllowed(type, from, cmd.status)`. A `CANCELLED` target delegates to
    `cancelOrder` (admin-only, `ForbiddenError` otherwise); a `RETURNED` target (only reachable
    from `IN_DELIVERY`) delegates to a new private `releaseOrderToReturned` (pure release, no
    refund — nothing was ever consumed or invoiced); `COMPLETED` delegates to a new private
    `completeOrder`; every other target (`CONFIRMED`/`PACKAGED`/`IN_DELIVERY`) is a plain forward
    write with no stock or money movement.
  - `completeOrder` (private) — the money moment: resolves `posClientId` (and, when absent but a
    registered `clientId` exists, the client's own name/address for the invoice — see Findings);
    enforces the `CREDIT_REQUIRES_CLIENT` guard via a non-writing `simulateLinePrices` pre-check;
    inside one transaction — applies the D11 price edit when the type allows it here (pickup),
    releases+consumes every line (FIFO, `ORDER_OUT`), charges the document (`applyDocumentCharge`
    with a real `creditDelta`), issues the invoice (`issueInvoiceInTx`), captures the payment
    (`captureClientPaymentInTx`) when a client paid something, and writes the order row last.
    Emits `invoice.issued`, `order.statusChanged`, and `payment.clientRecorded` when a payment was
    captured.
  - `applyLinePrices` (private) — writes a command's per-line `unitPrice`/`serialNumbers`
    overrides, recomputes/writes the order's `subtotal`/`totalAmount`, returns a plain-number view
    of every line (`resolvedPrice` is never rewritten — BL#1/D11).
  - `cancelOrder` — guard is now `isOrderStatusTerminal`; release is unconditional across every
    non-terminal status (D2: nothing is consumed before `COMPLETED` any more, so there is no
    "already consumed at confirm" case left to exclude).
  - `cancelMyOrder` (D4/R4) — guard widened to `isOrderStatusTerminal`; writes
    `CANCELLED_BY_CLIENT`; emits `order.cancelled` with `byClient: true` plus `order.statusChanged`.
  - `returnOrder` (D6/D7) — now mirrors sales' `createReturn`: resolves the order's invoice and
    `posClientId`, caps the cash refund at `existing.paidAmount` (R3 of S5), captures a
    negative-amount `ClientPayment` when cash is refundable, and applies
    `{totalSoldDelta: -refundAmount, creditDelta: -cashRefunded + (fullyReturned ?
    -orderCreditDelta : 0)}` — a partial return leaves credit untouched, a full return reverses
    the order's own credit delta.
- `orders.mapper.ts`: `canBeCancelled` now reads `!isOrderStatusTerminal(order.status)` instead of
  `status === PENDING` (see Findings — this also fixes a latent admin-UI gate mismatch).

### Backend — billing (Action 9)

- `billing.listener.ts` **deleted**; `billing.routes.ts` no longer constructs one.
- `billing.service.ts`: `issueFromOrder` and the now-orphaned private `issueInvoice` **deleted**,
  along with the `isKnownRequestError` helper and the `logger`/`OrdersEvents`/`InvoiceIssueInput`/
  contract-`InvoiceSource` imports that became unused as a result.
- `billing.interface.ts`: `issueFromOrder` removed from `IBillingService`. `InvoiceIssueRequest`
  widened — see Findings, this is the one piece of scope beyond the plan's literal text.
- `Apps/api/src/modules/index.ts`: the two stale comments naming `BillingListener`/pre-S10 order
  event wiring rewritten to match current reality.

### Backend — statistics & observability (Action 10 + Action 9.5)

- `ORDER_RECOGNIZED_STATUSES` narrowed from `['CONFIRMED','PACKAGED','IN_DELIVERY','COMPLETED']`
  to `['COMPLETED']` (D2 — recognising a pre-completion order would report revenue against zero
  cost, since `totalCost`/`totalProfit` are only stamped at `COMPLETED` now).
- All four sites that paired that constant with `confirmedAt` (the revenue/profit aggregate, the
  recognized-order counter, and both chart builders) now filter/select on `deliveredAt` instead.
- `observability.listener.ts`: `order.confirmed`'s narration no longer reads `p.totals.totalAmount`
  (slimmed payload) — description is now the fixed string `'Confirmed'`. `order.cancelled`'s
  description now distinguishes `'Cancelled by client'` from `'Cancelled'` via the new `byClient`
  flag.

### Frontend (Actions 11–17)

- `orders.service.ts`: `confirmOrder()` deleted.
- `useOrdersDirectory.ts`: `useConfirmOrder()` deleted; `useUpdateOrderStatus`'s `onSuccess` now
  calls the shared `invalidateOrderSideEffects` (a completion can move stock/invoice/credit, not
  just the order row).
- **Deleted**: `OrderConfirmDialog.tsx`, `confirm-order.schema.ts`.
- `order-status.schema.ts` rebuilt against the new `UpdateOrderStatusCommand`: `lines[]` and
  `paidAmount` added, both via `z.coerce.number()` (the `NaN`-on-empty-input trap,
  `report-S03.md`), plus a `refine` requiring `paidAmount` when the target is `COMPLETED`. Its
  `z.coerce` input type forced the same 3-generic `useForm<Input, unknown, Output>` fix S9's
  `return-order.schema.ts` needed — `OrderStatusInput` (`z.input<...>`) exported alongside
  `OrderStatusFormValues`.
- `OrderStatusDialog.tsx` rewritten: the status dropdown's options now come from
  `orderTransitionsFrom(order.orderType, order.status)` (no more hardcoded
  `ADVANCEABLE_STATUSES`); a "no further action" message renders when that list is empty; a
  per-line price section renders when `orderTransitionAllowsPriceEdit` is true for the watched
  target; a payment amount input renders when `orderTransitionRequiresPayment` is true.
- `StaffOrders.tsx`: `confirmOrder`/`useConfirmOrder`/`handleConfirmSubmit`/`stockError` state and
  the `<OrderConfirmDialog>` element all removed. `OrderShowDialog`'s `onConfirm` prop is gone —
  every action routes through `onUpdateStatus`. `<OrderStatusDialog>` now carries
  `key={statusOrder?.id ?? "none"}` (the same remount-per-order fix the other dialogs already had).
  `handleStatusSubmit`'s `onError` surfaces `CREDIT_REQUIRES_CLIENT` and `INSUFFICIENT_STOCK` as
  toasts.
- `OrderShowDialog.tsx`: `onConfirm` prop and the `showConfirm` branch removed;
  `showUpdateStatus` is now `orderTransitionsFrom(...).length > 0` (so it also covers the
  `PENDING → CONFIRMED` move that used to be the separate confirm button).
- `translations.json`: 8 new keys added under `staff.orders.statusDialog.*`
  (`priceSectionTitle`, `unitPriceLabel`, `unitPriceInvalid`, `paidAmountLabel`,
  `paidAmountInvalid`, `paidAmountRequired`, `creditRequiresClient`, `noTransitions`). The
  `staff.orders.confirmDialog.*` keys stay in the file even though their dialog is deleted, per
  this codebase's no-key-removal convention.

### Documentation (Action 18)

`Docs/Stage-00-Conception/database-description.md` §8's lifecycle paragraph rewritten to describe
the per-type machine, the `COMPLETED` money moment, the guest-must-pay-in-full rule, and the two
distinct cancel/return paths.

---

## Findings during execution

**A real gap the plan's F9 didn't fully resolve: invoice display name for a registered-but-never-approved client.** `Order.clientId` can be set (any authenticated client can place an order) while `Client.posClientId` stays null until an admin approves them — a real, pre-existing, reachable state. The pre-S10 `billing.issueFromOrder` handled this by falling back to the registered `Client`'s own `firstName`/`lastName` when `posClientId` was absent. `IBillingIssuePort.issueInvoiceInTx`'s existing contract (`InvoiceIssueRequest = Omit<InvoiceIssueInput, 'number' | 'clientNameSnapshot' | 'clientAddressSnapshot'>`) gave callers no way to supply that name — billing always resolved it from `posClientId` alone, defaulting to `"Walk-in Customer"` otherwise. Silently accepting that would have been a genuine display regression for every such order. Fixed by widening `InvoiceIssueRequest` to accept an **optional** `clientNameSnapshot`/`clientAddressSnapshot` override (billing's `issueInvoiceInTx` uses it when supplied, otherwise falls back to its existing `posClientId` resolution exactly as before — sales' calls are unaffected, since it never supplies these fields). This is the one piece of this session's work that goes beyond the plan's literal action list; both `billing.interface.ts` and `billing.service.ts` were updated, and `orders.service.ts`'s `completeOrder` now resolves and passes the override when applicable.

**A latent admin-UI bug fixed as a side effect of D4/R4.** Before this set, `OrdersMapper`'s
`canBeCancelled` was `status === PENDING` only — but the admin `cancelOrder` guard already allowed
cancelling from `CONFIRMED`/`PACKAGED`/`IN_DELIVERY` too. Since `OrderShowDialog`'s admin "Cancel"
button gates on `order.canBeCancelled`, that button was invisible for exactly the non-`PENDING`
orders an admin could actually cancel via the API. Widening `canBeCancelled` to
`!isOrderStatusTerminal(...)` (required by D4/R4 for the *client* rule) happens to make it correct
for the admin rule too, since both are now "any non-terminal status." Not a regression introduced
here — a pre-existing mismatch this set's own change incidentally closes.

**Three unrelated files carry stale historical comments naming the deleted `OrderConfirmDialog.tsx`** (`StaffSales.tsx`, `StaffInvoices.tsx`, `StaffRepairs.tsx` — each cites "the same render bug as OrderConfirmDialog" as precedent for their own `key={...}` remount fix). Left untouched: these files are outside this set's scope, and the comment still correctly names the *kind* of bug even though the file it cites no longer exists.

No other deviations from the plan were required.

---

## Sweep results — all clean

```
1. grep -rn "confirmOrder\|ConfirmOrderCommand\|ConfirmOrderSchema\|STAFF_CONFIRM\|ADMIN_CONFIRM" Apps/api/src Apps/contract/src Apps/web/src
   → Every hit is either a comment or the unrelated storefront "product.confirmOrder" translation
     key (ProductOrderModal's submit button label — not the backend endpoint). ✓

2. grep -rn "issueFromOrder\|BillingListener" Apps/api/src
   → Both hits are comments (billing.interface.ts's historical note, modules/index.ts's — now
     accurate — wiring comment). ✓

3. grep -rn "STATUS_SEQUENCE" Apps/api/src
   → Only repairs.service.ts's own (unrelated, different state machine). Orders' STATUS_SEQUENCE
     is gone. ✓

4. find Apps/api/src/modules -name "*.listener.ts" | xargs grep -nE "credit|totalPaid|totalSold|paidAmount|quantityOn|quantityRes"
   → Every hit is a comment or observability's narration-string builder (reads event payload
     fields to build an AuditLog description — never writes Supplier/PosClient/Invoice/Product).
     No listener writes a money or stock cache — the invariant report-credit-serialization.md
     established still holds. ✓

5. grep -rn "ORDER_RECOGNIZED_STATUSES\|confirmedAt" Apps/api/src/modules/statistics
   → ORDER_RECOGNIZED_STATUSES = ['COMPLETED']; every query pairs it with deliveredAt; the sole
     remaining confirmedAt hit is the explanatory comment. ✓
```

---

## Validation gate — all green

```
Apps/contract: npx tsc --noEmit ✓ (0 errors)          npm run lint ✓ (0 problems)

Apps/api:      npx prisma validate ✓ ("the schema at prisma/schema.prisma is valid") — unchanged
               schema this set (S9 already migrated OrderLine/CANCELLED_BY_CLIENT).
               npx tsc --noEmit — src/** is 0 errors (grep-filtered for lines starting with
               `src/`); every remaining error is under `test/`, itemized below.
               npm run lint ✓ — 6 pre-existing errors (prisma/seed.ts ×3,
               validate-request.middleware.ts ×3), identical to the S1/S4/S5/S9 baseline, both
               files untouched this session.

Apps/web:      npx tsc --noEmit ✓ (0 errors)
               npm run lint — every file this set touched is clean; a handful of new
               prettier-only findings picked up on first pass in the largest new JSX
               (OrderStatusDialog.tsx, OrderShowDialog.tsx, order-status.schema.ts) were fixed
               with a scoped `eslint --fix`, re-verified with `tsc` afterward. The codebase's
               documented ~3900-error pre-existing prettier baseline (set-04 plan/report-S03.md)
               is untouched.
```

**Stale tests (not edited, not run).** `npx tsc --noEmit` against the full `test/**` tree surfaces
errors in the same files S9's report already itemized (`orders.mapper.spec.ts`,
`orders.service.spec.ts`, plus the S1/S5-inherited staleness in `sales.*`, `billing.*`,
`clients.service.spec.ts`, `purchasing.mapper.spec.ts`, catalog/inventory/observability specs, the
integration specs, and the four `test/data/*.factory.ts` files) — with this set's own layer added
on top:

| File | New S10-caused errors |
|---|---|
| `test/contract/routes.conformance.spec.ts` | `ORDER_ROUTES.STAFF_CONFIRM`/`ADMIN_CONFIRM` no longer exist |
| `test/unit/modules/billing/billing.listener.spec.ts` | imports the now-deleted `src/modules/billing/billing.listener` module |
| `test/unit/modules/billing/billing.service.spec.ts` | `issueFromOrder` no longer exists on `BillingService` |
| `test/unit/modules/orders/orders.listener.spec.ts` | constructs a mock satisfying `IOrderCreditPort` with `applyOrderSold` (already stale from S5); orders' service constructor now takes 7 arguments, not 6 |
| `test/unit/modules/orders/orders.service.spec.ts` | `confirmOrder` no longer exists on `OrdersService`; constructor now takes 7 arguments |

**Behaviorally stale, not just uncompilable** — worth flagging per the plan's instruction: any test
asserting that an order's stock/cost/profit/invoice is produced at `CONFIRMED` rather than
`COMPLETED`, or that `order.confirmed`'s payload carries `snapshotLines`/`totals`, now asserts the
*opposite* of this set's intended behavior. `orders.service.spec.ts` and `orders.mapper.spec.ts`
are the most likely candidates — not individually inspected line-by-line beyond the compiler's own
error list above, per the no-test-edit rule.

---

## Manual verification checklist

No automated test runs. Take a POS-linked client and note its figures before each scenario:

```sql
SELECT name, credit, "totalPaid", "totalSold" FROM "PosClient" WHERE id = '…';
```

**A pickup order, end to end**
1. As a signed-in client, order a product for pickup from `/products/:id`.
2. `/admin/inventory` → the product's **reserved** count rose; **on-hand is unchanged**.
3. `/admin/orders` → open the order → "Update status". The dropdown offers **only** Confirmed and
   Cancel order. Move it to Confirmed.
4. `SELECT status, "totalCost", "totalProfit" FROM "Order" WHERE reference='…';` → CONFIRMED,
   **both null**. `/admin/invoices` → **no invoice exists yet** (D3). Reserved still held, on-hand
   still unchanged (D2).
5. Move it to Packaged. Still nothing accrues.
6. Move it to Completed. The dialog now shows a **line price** input per product and an **amount
   paid** input defaulted to the order total. Change the price, pay the full amount, submit.
7. Reserved fell to its starting value, **on-hand fell** by the ordered quantity.
   `SELECT status, "deliveredAt", "totalCost", "totalProfit", "totalAmount" FROM "Order" …` →
   COMPLETED, all set, `totalAmount` reflecting the edited price.
8. `/admin/invoices` → outgoing → one new ORDER invoice, one line per product, status **PAID**.
9. `SELECT reference, "invoiceId", amount FROM "ClientPayment" ORDER BY "paidAt" DESC LIMIT 1;` →
   one row, amount = what you paid, **`invoiceId` not null**.
10. The client's `totalSold` rose by the order total, `totalPaid` by the amount paid, `credit` by
    the difference (0 when paid in full).

**A delivery order, priced at packaging (D11)**
11. Place a home-delivery order as a client. Confirm it.
12. Move it to **Packaged** — the dialog offers the **line price** inputs here (not at completion).
    Set a different price and submit. The order's total updates; nothing else moves.
13. `/products/:id` in the storefront still shows the **placement/catalog** price, unchanged; the
    client's `/orders` page shows the order's **current** price.
14. Move it to In delivery — delivery company and tracking number are required.
15. Move it to Completed — this dialog asks for the **amount paid** but **not** for prices. Pay
    part of the total. Invoice reads PARTIALLY_PAID, `credit` rose by the unpaid remainder,
    `totalPaid` by what you paid.

**Partial payment on a guest order is refused (R2)**
16. Place a guest delivery order (signed out). Drive it to In delivery, then Completed with an
    amount **below** the total → the dialog shows *"A guest order must be paid in full"* and nothing
    changes. Pay the full total → it completes, an invoice is issued to "Walk-in Customer" with the
    full paid amount, and **no `ClientPayment` row is created**.

**A registered-but-never-approved client's order shows their real name (finding above)**
16b. Register a new client, do not approve them as a POS client, and have them place + complete a
    pickup order paid in full. The resulting invoice shows their **real name**, not "Walk-in
    Customer".

**Cancellation releases, never consumes**
17. Place an order, confirm it, then cancel it from `/admin/orders`. Reserved falls, **on-hand never
    moved**, no invoice, no ledger row, no credit movement.
18. Place another, confirm it, then cancel it **as the client** from `/orders`. Its status reads
    **"Cancelled by client"** and the reservation is released. Try again on a completed order — the
    cancel button is absent.
19. `/admin/logs` → the two cancellations narrate differently ("Cancelled" vs "Cancelled by client").

**Return from delivery vs return from completed**
20. Drive a delivery order to In delivery, then choose **Returned**. Reserved is released, on-hand
    unchanged, **no refund and no credit movement** — nothing had been consumed or invoiced.
21. Take a second delivery order all the way to Completed (paid in full), then use the admin
    **Issue return** action with restock on and the full amount. On-hand rises back; `totalSold`
    falls by the refund; a **negative** `ClientPayment` row exists; the invoice falls back from
    PAID; `credit` returns to where it started.
22. Repeat on an order completed with a **partial** payment, returning everything: `totalPaid` falls
    only by the cash actually taken (never below its starting value) and `credit` returns to
    baseline.
23. `SELECT SUM(amount) FROM "ClientPayment" WHERE "posClientId" = '…';` equals that client's
    `totalPaid` exactly — D5/D6's core invariant, checked once at the very end.

**Statistics recognise completion only (D2)**
24. `/admin/statistics` — a CONFIRMED order contributes **nothing** to revenue or profit; the same
    order after completion contributes its full total and its real profit, dated to the day it
    completed.

**Nothing else moved**
25. `/admin/pos` — a POS sale still confirms, prints and creates its ledger row exactly as before.
26. `/admin/invoices` → record a payment against an ORDER invoice → the order's paid amount updates
    (the mirroring listener, F3).

---

The owner reviews and approves before S11 begins.
