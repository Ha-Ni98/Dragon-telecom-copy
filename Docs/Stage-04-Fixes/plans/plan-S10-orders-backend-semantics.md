# Plan S10 — Orders: backend semantics

*The highest-risk set in the programme: it moves an order's stock consumption, its invoice, its
credit and its payment from **confirmation** to **completion**, and replaces the forward-only
status ladder with a per-type machine whose constants live in the contract.*

Implements **D2** (stock and profit at `COMPLETED` only), **D3** (invoice at `COMPLETED`),
**D4** (`CANCELLED_BY_CLIENT`), **D5**/**D6** (ledger rows) and **D11** (delivery price at
`PACKAGED`).

---

## 0. Before you start

### 0.1 Sets that must land first

- **S5** — executed (`results/report-S05.md`). It built every primitive this set consumes:
  `billingService.issueInvoiceInTx(tx, request)`, `billingService.captureClientPaymentInTx(tx,
  input)`, and the split credit port `applyDocumentCharge` / `applyLedgerPayment`. Its own handoff
  §3.2 names this set: *"the one line to change is orders.service.ts's applyDocumentCharge call —
  give it a real creditDelta and move it (plus a captureClientPaymentInTx call and a switch to
  issueInvoiceInTx) from confirmOrder to the COMPLETED transition."*
- **S9** — the `OrderLine` table, the `lines[]` DTO/command, `Order.totalCost`/`totalProfit`, and
  the `CANCELLED_BY_CLIENT` enum value. **S10 assumes all of it is in place.**

**S10 blocks S11 and S16.**

### 0.2 Owner decisions taken this session — settled, do not re-open

| # | Question | Owner's answer |
|---|---|---|
| **R1** | Does admin `COMPLETED → RETURNED` survive alongside the machine's `IN_DELIVERY → RETURNED`? | **Yes, both.** `IN_DELIVERY → RETURNED` releases the reservation and refunds nothing (nothing was consumed, nothing was invoiced). Admin `COMPLETED → RETURNED` stays a separate document action: FIFO restock + a negative-amount `ClientPayment` refund row + the credit/`totalSold` reversal, mirroring sales' `createReturn`. |
| **R2** | Completing an order with no known client and `paid < total`? | **Reject** with `BadRequestError('CREDIT_REQUIRES_CLIENT')`, exactly as POS does. No `PosClient` means nowhere to record the debt. |
| **R3** | `POST /confirm` vs `PATCH /status`? | **Fold into `PATCH /status`.** `ORDER_ROUTES.STAFF_CONFIRM`/`ADMIN_CONFIRM`, `ConfirmOrderSchema`/`ConfirmOrderCommand` and `IOrdersService.confirmOrder` are **deleted**. `UpdateOrderStatusSchema` grows the per-line price and the payment amount. |
| **R4** | Client-cancel widening? | **Here.** `cancelMyOrder` writes `CANCELLED_BY_CLIENT` and is legal from every non-terminal status **except `COMPLETED`**. S15 wires only the storefront UI and the new stat. |

### 0.3 Findings from reading the code — read before acting

**F1 — the two credit calls compose to today's arithmetic** (S5 §R1, proven in `report-S05.md`).
For an order of total `T` paid `P` on a client with credit `C₀`:
`applyDocumentCharge({ totalSoldDelta: T, creditDelta: T })` → `C₀ + T`, then
`captureClientPaymentInTx({ amount: P })` → `applyLedgerPayment` → `− P`. Net `C₀ + T − P`, with
`totalSold += T` written **only** by the document call and `totalPaid += P` written **only** by the
ledger call (D5's single-writer rule). Use this pair verbatim; do not invent a combined call.

**F2 — `captureClientPaymentInTx` already recomputes the invoice.** It sums
`Σ ClientPayment.amount` for the target invoice and writes `Invoice.paidAmount` + status
(`ISSUED | PARTIALLY_PAID | PAID`), skipping a `CANCELLED` invoice. Therefore the order's invoice
must be issued with **`paidAmount: 0`** when a client is known (the ledger sets the real figure) and
with the captured amount directly for a walk-in — the same split `sales.service.ts:191–200` uses.

**F3 — `orders.listener.ts` mirrors `Order.paidAmount`** from `payment.clientRecorded` whenever the
payment's invoice has `sourceType === ORDER`. That listener now fires **during** completion (the
service emits the event post-commit) and writes the same value the completion transaction already
wrote — a harmless idempotent mirror. **Keep it**: it is still the only path that reflects a
*later* payment recorded against an order invoice from `/admin/invoices`.

**F4 — `billing.listener.ts` has exactly one subscription left**, `order.confirmed → issueFromOrder`.
Once issuance moves in-transaction, that file has nothing to subscribe to. `report-S05.md` §3.6
records the intent: **delete it outright**, as `sales.listener.ts` was deleted in S1.

**F5 — `issueInvoice` (private, `billing.service.ts:360`) has one caller**, `issueFromOrder`.
Deleting `issueFromOrder` orphans it. It is also the site that emits `invoice.issued`; after this
set **orders emits that event itself**, exactly as sales does since S5.

**F6 — `observability.listener.ts:252` reads `p.totals.totalAmount` from `order.confirmed`.**
Slimming that payload breaks it. It also already narrates `order.statusChanged` (`Status X → Y`),
which after this set covers every transition including completion — so no new event type is needed.

**F7 — `STATUS_SEQUENCE` (orders.service.ts:42) is the whole current machine.** Forward-only over a
single global ladder, with `CANCELLED`/`RETURNED` unreachable through it. It is deleted; the
contract's per-type map replaces it.

**F8 — statistics recognises orders from `CONFIRMED` onward, keyed on `confirmedAt`**
(`ORDER_RECOGNIZED_STATUSES`, lines 24/320/332/376/396). After this set a `CONFIRMED` order has
**no cost and no profit** — leaving that constant alone would report revenue with zero cost and
inflate profit. The minimum correction lands here (Action 10); S14 audits the rest.

**F9 — `Order.clientId` is the registered `Client`; the money lives on `PosClient`.**
`confirmOrder` already resolves it: `client.findUnique({ where: { id: clientId }, select: {
posClientId: true } })`. A guest order (`clientId == null`) and a registered client who was never
approved (`posClientId == null`) are both "no known client" for money purposes.

### 0.4 Standing rules for this set

- **Every money and stock write happens inside the completion transaction, on locked rows, through
  the injected ports.** No listener writes `credit`, `totalPaid`, `totalSold`, `paidAmount`,
  `quantityOnHand` or `quantityReserved`. Re-read `Docs/Stage-02-Backend/results/report-credit-serialization.md`
  before deviating.
- **Sequence allocation order inside the completion transaction: `INVOICE → CLIENT_PAYMENT`** (the
  order's own `ORDER` reference was allocated at placement).
- **`inventory.flushEvents(capturedTx)` must be called immediately after every `$transaction` that
  touched inventory**, and only after it resolves.
- Do not read, edit or run anything under `test/`.

---

## 1. Contract (`Apps/contract`)

### Action 1 — new file `Apps/contract/src/modules/orders/orders.constants.ts`

The per-type status machine. S11's action column and the backend guard read the **same** constants —
this is the "no magic strings" rule applied to a state machine.

```ts
import { OrderStatus, OrderType } from './orders.enums';

// D2/D4/D11 — the per-type forward machine (S10). Shared by the backend guard
// (orders.service.ts's updateStatus) and the admin action column (S11), so a legal move is
// defined exactly once.
//
// A target of CANCELLED is listed here because it is offered from the same action menu, but it is
// ADMIN-ONLY and routed to the cancel path, not the forward path. CANCELLED_BY_CLIENT is absent
// on purpose: it is reachable only through the client's own MY_CANCEL endpoint.
const DELIVERY_TRANSITIONS: Readonly<Partial<Record<OrderStatus, readonly OrderStatus[]>>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKAGED, OrderStatus.CANCELLED],
  [OrderStatus.PACKAGED]: [OrderStatus.IN_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.IN_DELIVERY]: [OrderStatus.COMPLETED, OrderStatus.RETURNED],
};

const PICKUP_TRANSITIONS: Readonly<Partial<Record<OrderStatus, readonly OrderStatus[]>>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKAGED, OrderStatus.CANCELLED],
  [OrderStatus.PACKAGED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
};

export const ORDER_STATUS_TRANSITIONS: Readonly<
  Record<OrderType, Readonly<Partial<Record<OrderStatus, readonly OrderStatus[]>>>>
> = {
  [OrderType.PICKUP]: PICKUP_TRANSITIONS,
  [OrderType.DELIVERY_HOME]: DELIVERY_TRANSITIONS,
  [OrderType.DELIVERY_OFFICE]: DELIVERY_TRANSITIONS,
};

// Nothing leaves these. COMPLETED is terminal *for the machine*: the only way out is the admin
// RETURN document action (R1), which is not a machine transition.
export const ORDER_TERMINAL_STATUSES: readonly OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.CANCELLED_BY_CLIENT,
  OrderStatus.RETURNED,
];

// D11 — the status at which staff may still set each line's charged price. Pickup orders are
// priced at the moment they complete; delivery orders at packaging, before they leave the store.
export const ORDER_PRICE_EDIT_STATUS: Readonly<Record<OrderType, OrderStatus>> = {
  [OrderType.PICKUP]: OrderStatus.COMPLETED,
  [OrderType.DELIVERY_HOME]: OrderStatus.PACKAGED,
  [OrderType.DELIVERY_OFFICE]: OrderStatus.PACKAGED,
};

export function orderTransitionsFrom(type: OrderType, from: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[type][from] ?? [];
}

export function isOrderTransitionAllowed(type: OrderType, from: OrderStatus, to: OrderStatus): boolean {
  return orderTransitionsFrom(type, from).includes(to);
}

export function isOrderStatusTerminal(status: OrderStatus): boolean {
  return ORDER_TERMINAL_STATUSES.includes(status);
}

// The money moment (D2/D3/D5): payment is captured, the invoice is issued and cost/profit are
// recognised only here, for every order type.
export function orderTransitionRequiresPayment(to: OrderStatus): boolean {
  return to === OrderStatus.COMPLETED;
}

export function orderTransitionAllowsPriceEdit(type: OrderType, to: OrderStatus): boolean {
  return ORDER_PRICE_EDIT_STATUS[type] === to;
}
```

Export it from `Apps/contract/src/modules/orders/index.ts` (add
`export * from './orders.constants';` after `./orders.enums`).

### Action 2 — `Apps/contract/src/modules/orders/orders.command.ts`

**Delete** `ConfirmOrderSchema` and `ConfirmOrderCommand` (R3).

**Rewrite** `UpdateOrderStatusSchema` — it is now the single command for every forward transition:

```ts
// The single forward-transition command (S10/R3 — the separate confirm endpoint is gone).
// `lines` carries the per-line price edit legal at ORDER_PRICE_EDIT_STATUS (D11) and the serial
// numbers previously collected at confirmation; `paidAmount` is the payment captured at
// COMPLETED (D5 — it becomes a ClientPayment row when the client is known).
// deliveryCompany/trackingNumber stay required for IN_DELIVERY, enforced server-side.
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(OrderStatus),
  deliveryCompany: z.string().optional(),
  trackingNumber: z.string().optional(),
  reason: z.string().optional(),
  lines: z
    .array(
      z.object({
        orderLineId: z.uuid(),
        unitPrice: z.number().min(0).optional(),
        serialNumbers: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  paidAmount: z.number().min(0).optional(),
});
export type UpdateOrderStatusCommand = z.infer<typeof UpdateOrderStatusSchema>;
```

### Action 3 — `Apps/contract/src/modules/orders/orders.routes.ts`

Delete `STAFF_CONFIRM` and `ADMIN_CONFIRM`. Update the file's header comment.

### Action 4 — `Apps/contract/src/modules/orders/orders.events.ts`

`'order.confirmed'` is now emitted only for `PENDING → CONFIRMED`, where no money and no stock
move. Slim it to what remains true (F6 — observability's narration is rewritten in Action 9):

```ts
  // PENDING → CONFIRMED only. Nothing accrues at confirmation any more (D2): no consumption, no
  // invoice, no credit. Completion is narrated through order.statusChanged, and its money through
  // invoice.issued / payment.clientRecorded, exactly like a POS sale since S5.
  'order.confirmed': { orderId: string; clientId?: string; posClientId?: string; confirmedByStaffId: string };
```

Add a `cancelledByClient` flag to `'order.cancelled'` so observability can distinguish the two
(D4): `'order.cancelled': { orderId: string; reason?: string; byClient?: boolean };`

---

## 2. Backend — orders module

### Action 5 — `Apps/api/src/modules/orders/orders.interface.ts`

1. Delete the `ConfirmOrderCommand` import and the `confirmOrder` method from `IOrdersService`.
2. `IOrderCreditPort`'s comment currently ends *"Orders never touch credit today … S10 moves this
   call from confirm to COMPLETED and gives it a real credit delta."* — rewrite it: orders now apply
   `creditDelta: totalAmount` at `COMPLETED`, with the captured payment applied separately through
   billing's `captureClientPaymentInTx` (D5's split, S5 §R1).
3. Add the new injected port orders needs (mirror `sales.interface.ts`'s `IBillingIssuePort`
   verbatim, including its `InvoiceIssueRequest` import from `../billing/billing.interface`):

```ts
// Injected port (dependency inversion, S5's primitives) — real implementation is billing's own
// composition-root singleton (`billingService`, exported from billing.routes.ts), assembled
// directly in orders.routes.ts. An order's invoice and its captured payment are created INSIDE
// the completion transaction (D3/D5), never by a post-commit listener — the same shape sales'
// confirm has used since S5.
export interface IBillingIssuePort {
  issueInvoiceInTx(tx: Prisma.TransactionClient, input: InvoiceIssueRequest): Promise<{ invoiceId: string; number: string }>;
  captureClientPaymentInTx(
    tx: Prisma.TransactionClient,
    input: { posClientId: string; invoiceId?: string; amount: number; paidAt?: Date; staffId: string },
  ): Promise<{ paymentId: string; reference: string; previousCredit: number; newCredit: number }>;
}
```

### Action 6 — `Apps/api/src/modules/orders/orders.routes.ts`

1. Import `billingService` from `../billing/billing.routes` and pass it as the **seventh**
   constructor argument to `OrdersService`. Extend the import-block comment: billing joins
   platform/inventory/catalog/clients as a one-directional sibling dependency (billing imports only
   platform and clients — no cycle, same reasoning `sales.routes.ts` records).
2. Delete both CONFIRM route registrations and the `ConfirmOrderSchema` import.

### Action 7 — `Apps/api/src/modules/orders/orders.controller.ts`

Delete `confirmOrder` and its `ConfirmOrderCommand` import.

### Action 8 — `Apps/api/src/modules/orders/orders.service.ts` — the core

Constructor gains `private billing: IBillingIssuePort` (seventh parameter, after `clientCredit`).
Delete `STATUS_SEQUENCE` (F7) and the whole `confirmOrder` method.

#### 8a — `placeOrder`: unchanged

Reservation at placement is already D2-correct. Do not touch it.

#### 8b — `updateStatus` becomes the machine driver

```
async updateStatus(id, cmd, actor): Promise<OrderDto>
```

1. Load the order with `ORDER_INCLUDE`; 404 if absent.
2. `const from = existing.status as OrderStatus; const type = existing.orderType as OrderType;`
   If `!isOrderTransitionAllowed(type, from, cmd.status)` →
   `BadRequestError('Illegal order status transition')`. This single guard replaces the old
   forward-only index comparison and makes every terminal status unreachable by construction.
3. **`cmd.status === OrderStatus.CANCELLED`** → admin only
   (`actor.type !== UserType.ADMIN` → `ForbiddenError()`); delegate to
   `this.cancelOrder(id, { ...(cmd.reason != null ? { reason: cmd.reason } : {}) }, actor)` and
   return its result. (The dedicated `POST /admin/orders/:id/cancel` route stays; this just makes
   the same action reachable from the action column.)
4. **`cmd.status === OrderStatus.RETURNED`** (only reachable from `IN_DELIVERY` per the map) →
   a *pre-consumption* return: open a transaction, `release` every line, set
   `status: RETURNED`, `cancelledAt: new Date()`; `flushEvents`; emit `order.statusChanged` and
   `order.returned` with `refundAmount: 0`. **No FIFO restock, no refund, no credit** — nothing was
   consumed or invoiced (D2). Comment this explicitly so it is never confused with Action 8e's
   admin return.
5. **`cmd.status === OrderStatus.IN_DELIVERY`** → keep today's guard: `deliveryCompany` and
   `trackingNumber` both required, else `BadRequestError`.
6. **Price edit.** If `orderTransitionAllowsPriceEdit(type, cmd.status)` and `cmd.lines` is present,
   apply it (see 8c) inside the same transaction as the status write. If `cmd.lines` is present but
   the target is **not** the price-edit status → `BadRequestError('Line prices may only be set at
   <ORDER_PRICE_EDIT_STATUS[type]>')`. This is what makes D11 real: a delivery order's price is set
   at `PACKAGED`, a pickup order's at `COMPLETED`.
7. **`cmd.status === OrderStatus.COMPLETED`** → delegate to the private `completeOrder` (8d).
8. Otherwise (`CONFIRMED`, `PACKAGED`, `IN_DELIVERY`): one transaction — apply the price edit when
   present (8c), then `tx.order.update` with the status, `deliveryCompany`/`trackingNumber` when
   given, and `confirmedAt: new Date()` + `confirmedByStaffId: actor.staffId` when the target is
   `CONFIRMED`. After it: emit `order.statusChanged` always, plus `order.confirmed` (slim payload,
   Action 4) when the target was `CONFIRMED`. `deliveredAt` is written only by `completeOrder`.

#### 8c — the price edit, `applyLinePrices(tx, order, cmdLines)` (private)

For each entry: look the line up by `orderLineId` in a `Map` built from `order.lines`; unknown id →
`BadRequestError`. Write `unitPrice` when given (and recompute that line's `lineTotal =
unitPrice × quantity`) and `serialNumbers` when given (comma-joined, the `SaleLine` convention).
Then recompute and write on the order: `subtotal = Σ lineTotal`, `totalAmount = subtotal +
deliveryFee`. Return the recomputed `{ subtotal, totalAmount, lines }` so `completeOrder` can use
the fresh figures without re-reading.

`resolvedPrice` is **never** rewritten — it stays frozen at what the client saw at placement
(BL#1), which is exactly what the storefront-vs-order-page price distinction in D11 depends on.

#### 8d — `completeOrder(existing, cmd, actor)` (private) — the money moment

Order of operations inside **one** `this.prisma.$transaction`:

1. Apply the price edit (8c) when the type allows it at `COMPLETED` (pickup) and `cmd.lines` is
   present. Take `subtotal`/`totalAmount`/`lines` from its result, else from `existing`.
2. `const paidAmount = cmd.paidAmount ?? 0;`
3. **Guard (R2):** `if (posClientId == null && paidAmount !== totalAmount) throw new
   BadRequestError('CREDIT_REQUIRES_CLIENT');` — resolved **before** the transaction opens, from
   `Client.posClientId` (F9), exactly as `confirmOrder` does today.
4. **Stock (D2):** for each line — `release(tx, line.productId, line.quantity, ref)` then
   `consumeFifo(tx, line.productId, line.quantity, line.unitPrice × line.quantity,
   MovementType.ORDER_OUT, ref)` with `ref = { referenceType: 'ORDER', referenceId: existing.id,
   staffId }`. Write each line's `costOfGoods`/`profit` via `tx.orderLine.update`; accumulate
   `totalCost` / `totalProfit`. A FIFO shortfall throws `ConflictError` and rolls the whole thing
   back — the order stays where it was.
5. **Document charge (D5, F1):** when `posClientId != null` —
   `({ previousCredit, newCredit } = await this.clientCredit.applyDocumentCharge(tx, posClientId, {
   totalSoldDelta: totalAmount, creditDelta: totalAmount }))`. Walk-in: both stay 0 and
   `newCredit = 0` (the R2 guard already forced `paid === total`).
6. **Invoice (D3, F2):** `this.billing.issueInvoiceInTx(tx, { …posClientId, sourceType:
   InvoiceSource.ORDER, sourceId: existing.id, totalAmount, paidAmount: posClientId != null ? 0 :
   paidAmount, previousCredit, newCredit: previousCredit + (totalAmount − paidAmount), totalCost,
   totalProfit, staffId, lines: [...] })`, each invoice line built from the order line
   (`label: productNameSnapshot`, `quantity`, `unitPrice`, `costSnapshot`, `profit`, `lineTotal`,
   `serialNumbers?`).
7. **Payment (D5):** when `posClientId != null && paidAmount > 0` —
   `captureClientPaymentInTx(tx, { posClientId, invoiceId: issued.invoiceId, amount: paidAmount,
   staffId })`; set `newCredit = captured.newCredit`.
8. **Order row, written last:** `status: COMPLETED`, `deliveredAt: new Date()`, `paidAmount`,
   `subtotal`, `totalAmount`, `totalCost`, `totalProfit`.

After the transaction, in this order: `this.inventory.flushEvents(capturedTx!)`; emit
`invoice.issued` (`{ invoiceNumber, sourceType: InvoiceSource.ORDER, sourceReference:
existing.reference }`); emit `order.statusChanged` (`from → COMPLETED`); emit
`payment.clientRecorded` when a payment was captured (same payload shape sales uses). Return
`this.getOrderDto(id, { includeMargins: actor.type === UserType.ADMIN })`.

**The `staffId` for movements and for the invoice/payment** is `await this.movementStaffId(actor)` —
unchanged helper.

#### 8e — `cancelOrder` (admin) and `cancelMyOrder` (client)

`cancelOrder`: the guard becomes `if (isOrderStatusTerminal(existing.status as OrderStatus)) throw
new ConflictError(...)` — cancelling a `COMPLETED` order is still refused, and so are the three
terminal states. Inside the transaction, **always** release every line (no `status === PENDING`
condition): under D2 a non-terminal order's stock is *always* still reserved. Delete the long
comment claiming stock was already consumed at confirm — it is now false. Emit `order.cancelled`
with `byClient: false` omitted (the field is optional).

`cancelMyOrder` (R4): keep the ownership check; replace the `PENDING`-only guard with
`if (isOrderStatusTerminal(existing.status as OrderStatus)) throw new ConflictError('Order is not
cancellable')`. Release every line; write `status: CANCELLED_BY_CLIENT` (D4) and `cancelledAt`.
Emit `order.cancelled` with `byClient: true`, plus `order.statusChanged`.

#### 8f — `returnOrder` (admin, from `COMPLETED`) — R1, D6/D7

The guard stays `status !== COMPLETED → ConflictError`. What changes is the money, mirroring
`sales.service.ts`'s `createReturn` (read it before writing this):

Before the transaction:
- resolve the order's invoice: `invoice.findUnique({ where: { sourceType_sourceId: { sourceType:
  InvoiceSource.ORDER, sourceId: existing.id } }, select: { id: true, number: true } })`;
- resolve `posClientId` (F9);
- `cashRefundable = existing.paidAmount.toNumber()` (an order can be returned once — the status
  flips to `RETURNED` — so there is no "already refunded" term to subtract);
- `cashRefunded = Math.min(cmd.refundAmount, cashRefundable)` — R3 of S5's cap: a refund can never
  invent cash that was never collected.

Inside the transaction:
- when `cmd.restock`, per command line: `buildOriginalConsumptions(tx, existing.id,
  line.productId, cmdLine.quantity)` → `inventory.returnIn(...)` (unchanged mechanics from S9);
- `const allFullyReturned = existing.lines.every((line) => (returnedByLineId.get(line.id) ?? 0) >=
  line.quantity)` over the command's own lines;
- when `posClientId != null`:
  - if `cashRefunded > 0 && invoice != null` → `captureClientPaymentInTx(tx, { posClientId,
    invoiceId: invoice.id, amount: -cashRefunded, staffId })` (D6 — a negative-amount ledger row,
    which also walks the invoice's status back down);
  - `const orderCreditDelta = existing.totalAmount.toNumber() - existing.paidAmount.toNumber();`
    — the credit this order applied at completion (F1: `+T` then `−P`);
  - `const creditEffect = -cashRefunded + (allFullyReturned ? -orderCreditDelta : 0);`
  - `applyDocumentCharge(tx, posClientId, { totalSoldDelta: -cmd.refundAmount, creditDelta:
    creditEffect })`.
    Comment the two terms exactly as sales does: the `−cashRefunded` cancels the credit rise the
    negative ledger row just applied, so a **partial** return leaves credit untouched (D7); a
    **full** return additionally reverses this order's own credit delta.
- `tx.order.update({ status: RETURNED })`.

After: `flushEvents`; emit `payment.clientRecorded` when a refund row was created (amount
`-cashRefunded`); emit `order.returned` with `refundAmount: cmd.refundAmount`; emit
`order.statusChanged`.

#### 8g — `toOrderDto`'s `canBeCancelled`

`orders.mapper.ts` currently sets `canBeCancelled: order.status === OrderStatus.PENDING`. R4 widens
it: `canBeCancelled: !isOrderStatusTerminal(order.status as OrderStatus)`. Update the comment
(*"Client rule (spec BL#2): own + PENDING only"* → D4/R4: any non-terminal order, `COMPLETED`
included in the terminal set).

---

## 3. Backend — billing, statistics, observability

### Action 9 — delete billing's order listener (F4, F5)

1. **Delete** `Apps/api/src/modules/billing/billing.listener.ts` entirely.
2. `Apps/api/src/modules/billing/billing.routes.ts`: drop the `BillingListener` import and the
   `new BillingListener(service).setup();` line. Extend the `billingService` export comment: orders'
   completion is now one of its in-transaction consumers (alongside sales, and repairs in S13).
3. `Apps/api/src/modules/billing/billing.service.ts`: delete `issueFromOrder` **and** the private
   `issueInvoice` it was the sole caller of. Remove the now-unused imports (`OrdersEvents`,
   `logger` if nothing else uses it, `InvoiceIssueInput` if only those two referenced it — check
   before removing each).
4. `Apps/api/src/modules/billing/billing.interface.ts`: remove `issueFromOrder` from
   `IBillingService` and the `OrdersEvents` import. Update the comment above the injected-port
   block: it says *"issueFromOrder remains listener-invoked (post-commit) until S10 moves order
   issuance the same way sales' confirm now does"* — that has now happened; say instead that every
   issuance in the codebase is in-transaction and billing subscribes to nothing.
5. `Apps/api/src/modules/observability/observability.listener.ts`, `registerOrders`: the
   `order.confirmed` narration reads `p.totals.totalAmount`, which no longer exists (F6). Change its
   description to `'Confirmed'`. Change `order.cancelled`'s description to distinguish the two
   flavours: `` `${p.byClient ? 'Cancelled by client' : 'Cancelled'}${p.reason ? `: ${p.reason}` : ''}` ``.

### Action 10 — `Apps/api/src/modules/statistics/statistics.service.ts` (F8)

Minimal, money-correctness-only correction — S14 owns the full audit.

1. `ORDER_RECOGNIZED_STATUSES` (line 24) → `['COMPLETED'] as const`, with a comment: *"D2 — nothing
   accrues before completion. Cost and profit are stamped at COMPLETED (S10), so recognising a
   CONFIRMED order would report revenue against a zero cost."*
2. Every query that pairs that constant with `confirmedAt` (lines 320, 332, 376, 396) must key on
   **`deliveredAt`** instead — the timestamp completion writes. Four sites; also the two
   `order.confirmedAt!.toISOString()` reads in the chart builders (lines 387, 401) become
   `order.deliveredAt!`, and their `select` clauses change accordingly.
3. Leave `pendingOrders`/`recentOrders`/`myPendingOrdersCount` alone — they filter on `PENDING` and
   `placedAt`, both unaffected.

---

## 4. Frontend (`Apps/web`) — keep it working, leave the polish to S11

S11 owns the table columns, the stat cards and the per-row action column. S10 does the minimum that
keeps the app compiling **and** usable: one dialog, driven by the contract's transition map.

### Action 11 — services and hooks

`Apps/web/src/services/orders.service.ts`: delete `confirmOrder()` and its `ConfirmOrderCommand`
import.
`Apps/web/src/hooks/useOrdersDirectory.ts`: delete `useConfirmOrder()` and its
`ConfirmOrderCommand` import. `useUpdateOrderStatus`'s `onSuccess` currently invalidates only
`qk.orders.all()` — a completion now issues an invoice, moves stock and moves credit, so it must
call the shared `invalidateOrderSideEffects(queryClient)` instead (which sweeps `qk.orders`,
`qk.inventory`, `qk.billing`, `qk.clients`, `qk.posClients`, `qk.stats`). Update the comment above
that helper to say confirm/**status**/cancel/return.

### Action 12 — delete the confirm dialog

Delete `Apps/web/src/pages/staff/orders/components/OrderConfirmDialog.tsx` and
`Apps/web/src/pages/staff/orders/confirm-order.schema.ts`.

### Action 13 — `Apps/web/src/pages/staff/orders/order-status.schema.ts`

Rebuild against the new `UpdateOrderStatusCommand`:

```ts
export function orderStatusSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      status: z.enum(OrderStatus),
      deliveryCompany: z.string().optional(),
      trackingNumber: z.string().optional(),
      reason: z.string().optional(),
      lines: z
        .array(
          z.object({
            orderLineId: z.string().min(1),
            unitPrice: z.coerce.number().min(0, t("staff.orders.statusDialog.unitPriceInvalid")).optional(),
          }),
        )
        .optional(),
      paidAmount: z.coerce.number().min(0, t("staff.orders.statusDialog.paidAmountInvalid")).optional(),
    })
    .refine((d) => d.status !== OrderStatus.IN_DELIVERY || !!d.deliveryCompany, { … })
    .refine((d) => d.status !== OrderStatus.IN_DELIVERY || !!d.trackingNumber, { … })
    .refine((d) => d.status !== OrderStatus.COMPLETED || d.paidAmount !== undefined, {
      message: t("staff.orders.statusDialog.paidAmountRequired"),
      path: ["paidAmount"],
    });
}
```

Keep the two existing `IN_DELIVERY` refines and their existing message keys verbatim. Keep the
`AssertAssignable<OrderStatusFormValues extends UpdateOrderStatusCommand>` guard. Use
`z.coerce.number()` for both numeric fields — the `valueAsNumber → NaN` trap recorded in
`report-S03.md`.

### Action 14 — `Apps/web/src/pages/staff/orders/components/OrderStatusDialog.tsx`

1. Delete the local `ADVANCEABLE_STATUSES` constant. Build the options from the contract:
   `const targets = order ? orderTransitionsFrom(order.orderType, order.status) : []` — imported
   from `@dragon-telecom/contract`. Render `t(ORDER_STATUS_LABEL_KEY[s])` per target. When
   `targets.length === 0`, render `t("staff.orders.statusDialog.noTransitions")` and no submit
   button.
2. `defaultValues.status` becomes `targets[0]` (guard the null-order case as the component already
   does with `if (!order) return null`).
3. When `orderTransitionAllowsPriceEdit(order.orderType, watchedStatus)`: render one number input
   per `order.lines` entry under a `t("staff.orders.statusDialog.priceSectionTitle")` heading, each
   labelled with the line's `productName` + `t("staff.orders.statusDialog.unitPriceLabel")`,
   registered at `lines.${index}.unitPrice`, defaulted to that line's current `unitPrice`. Keep a
   hidden/`useForm`-seeded `lines.${index}.orderLineId`.
4. When `orderTransitionRequiresPayment(watchedStatus)`: render the `paidAmount` input labelled
   `t("staff.orders.statusDialog.paidAmountLabel")`, defaulted to the order's `totalAmount`.
5. Keep the `deliveryCompany`/`trackingNumber` block exactly as it is.
6. Rewrite the component's doc comment: it says *"forward-state transitions only (PENDING→…→
   COMPLETED)"* and that cancel is admin-only — now it renders whatever the contract's machine
   allows for this order's type, which **includes** `CANCELLED` (admin) and `RETURNED`.

### Action 15 — `Apps/web/src/pages/staff/orders/StaffOrders.tsx`

Delete the `confirmOrder` state, `useConfirmOrder`, `handleConfirmSubmit`, the `stockError` state
and the `<OrderConfirmDialog>` element with their imports. `OrderShowDialog`'s `onConfirm` prop
goes away; every action now routes to `setStatusOrder(showOrder)`. Add a `key={statusOrder?.id ??
"none"}` to `<OrderStatusDialog>` for the same reason the other dialogs have one (the
`useForm`-captures-defaults-once bug documented at line 232). `handleStatusSubmit`'s `onError`
should surface `apiErrorMessage(err) === "CREDIT_REQUIRES_CLIENT"` as
`toast.error(t("staff.orders.statusDialog.creditRequiresClient"))`, and `"INSUFFICIENT_STOCK"` as
`toast.error(t("staff.orders.confirmDialog.insufficientStock"))` (existing key, kept).

### Action 16 — `Apps/web/src/pages/staff/orders/components/OrderShowDialog.tsx`

Remove the `onConfirm` prop and the `showConfirm` branch. `showUpdateStatus` becomes
`!!onUpdateStatus && orderTransitionsFrom(order.orderType, order.status).length > 0`, so the
button appears for a `PENDING` order too (it is how an order is confirmed now). Update the comment
that says this dialog is where "Confirm/Update status/Cancel/Return get launched from".

### Action 17 — `Apps/web/src/config/translations.json`

Add:

```json
"staff.orders.statusDialog.priceSectionTitle": { "en": "Line prices", "fr": "Prix des lignes", "ar": "" },
"staff.orders.statusDialog.unitPriceLabel": { "en": "Charged price", "fr": "Prix facturé", "ar": "" },
"staff.orders.statusDialog.unitPriceInvalid": { "en": "Charged price must be zero or more", "fr": "Le prix facturé doit être égal ou supérieur à zéro", "ar": "" },
"staff.orders.statusDialog.paidAmountLabel": { "en": "Amount paid", "fr": "Montant payé", "ar": "" },
"staff.orders.statusDialog.paidAmountInvalid": { "en": "Amount paid must be zero or more", "fr": "Le montant payé doit être égal ou supérieur à zéro", "ar": "" },
"staff.orders.statusDialog.paidAmountRequired": { "en": "Enter the amount paid to complete this order", "fr": "Saisissez le montant payé pour terminer cette commande", "ar": "" },
"staff.orders.statusDialog.creditRequiresClient": { "en": "A guest order must be paid in full", "fr": "Une commande sans compte client doit être payée intégralement", "ar": "" },
"staff.orders.statusDialog.noTransitions": { "en": "No further action is available for this order", "fr": "Aucune action supplémentaire n'est disponible pour cette commande", "ar": "" }
```

The `staff.orders.confirmDialog.*` keys stay in the file even though their dialog is deleted — the
codebase's no-key-removal convention (recorded in `CancelOrderDialog.tsx`'s own comment).

---

## 5. Documentation

### Action 18 — `Docs/Stage-00-Conception/database-description.md`, §8 lifecycle paragraph

S9 rewrote the model half. Replace the lifecycle sentences (currently: *"Placement → PENDING_ORDER
reservation … Confirm (idempotent): release + consume (ORDER_OUT), profit stored, invoice issued …
RETURNED only from COMPLETED"*) with the new rules:

> Placement → one `PENDING_ORDER` reservation **per line**; the reservation is held through every
> intermediate state (D2). Pickup: `PENDING → CONFIRMED → PACKAGED → COMPLETED`; delivery:
> `PENDING → CONFIRMED → PACKAGED → IN_DELIVERY → COMPLETED`, with each line's charged price
> settable at `PACKAGED` for delivery and at `COMPLETED` for pickup (D11). **`COMPLETED` is the
> single moment** that releases the reservations, consumes the stock (`ORDER_OUT`, FIFO, per line),
> stamps `costOfGoods`/`profit`, issues the invoice (`sourceType ORDER`, no sale row) and captures
> the payment — which becomes a `ClientPayment` row when the client is known (D5), while the order
> applies `totalSold` and credit. A guest order must be paid in full. `CANCELLED` (admin, any
> non-terminal state), `CANCELLED_BY_CLIENT` (client, any state but `COMPLETED`) and `RETURNED`
> from `IN_DELIVERY` all simply release the reservations. Admin `RETURNED` from `COMPLETED` restocks
> at the consumed cost and refunds through a negative-amount ledger row.

---

## 6. Validation gate

```
Apps/contract:  npx tsc --noEmit      npm run lint
Apps/api:       npx prisma validate   npx tsc --noEmit   npm run lint
Apps/web:       npx tsc --noEmit      npm run lint
```

Same rules as S9: only `Apps/api/src/**` errors count; `Apps/api`'s lint baseline is 6 pre-existing
errors in two untouched files.

**Sweep** (paste into the report):

```bash
grep -rn "confirmOrder\|ConfirmOrderCommand\|ConfirmOrderSchema\|STAFF_CONFIRM\|ADMIN_CONFIRM" Apps/api/src Apps/contract/src Apps/web/src
grep -rn "issueFromOrder\|BillingListener" Apps/api/src
grep -rn "STATUS_SEQUENCE" Apps/api/src
find Apps/api/src/modules -name "*.listener.ts" | xargs grep -nE "credit|totalPaid|totalSold|paidAmount|quantityOn|quantityRes"
grep -rn "ORDER_RECOGNIZED_STATUSES\|confirmedAt" Apps/api/src/modules/statistics
```

The listener sweep must return only comments and observability's narration strings — **no listener
writes a money or stock cache** (the invariant `report-credit-serialization.md` established).

---

## 7. Manual verification checklist

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

## 8. Execution protocol

Start Set plan execution. After finishing, write `Docs/Stage-04-Fixes/results/report-S10.md`
describing what changed, ending with the verification checklist above. The owner reviews and
approves before S11 begins.
