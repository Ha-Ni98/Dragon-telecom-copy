# Stage 02 — Credit Serialization: Execution Report

Executed per `Docs/Stage-02-Backend/plan-credit-serialization.md`, light mode, single session, in
the order specified (C1 → C2 → C3 → C4 → C5). One commit per action, all green before committing.

**The defect, in one sentence:** money caches (`Supplier`/`PosClient`/`Invoice`) were written by
un-awaited post-commit event listeners off a read nothing serialized, so a fast enough second
operation on the same row read a stale value and silently corrupted the balance — proven by
`purchasing.integration.spec.ts`'s property test in the prior audit-fixes session.

**The fix, in one sentence:** every one of those writes now happens inside the emitting
transaction itself (`SELECT … FOR UPDATE` then a locked read-modify-write), and the
money-applying listener handlers that used to do the write asynchronously were deleted, not left
as dead no-ops.

---

## C1 — Purchasing: supplier caches move in-transaction

**Commit:** `e63d09c fix: C1 supplier credit written in-transaction`

**Changes:**
- `confirmInvoice`: `Supplier.credit`/`totalInvoiced` now written inside the existing locked
  transaction, right after the snapshot is computed.
- `cancelInvoice`: was not even wrapped in a transaction before — now is, locking the supplier
  and reversing `credit`/`totalInvoiced` in-tx only when the invoice was previously CONFIRMED.
- `createPayment`: `Supplier.credit`/`totalPaid` written in-tx via the existing lock; the
  targeted `SupplierInvoice.paidAmount` update (previously done in the listener via a
  reference lookup) moved into the same transaction, reusing the `invoiceId` already resolved
  for validation — one query cheaper than before.
- `purchasing.listener.ts` deleted entirely (all three of its subscriptions were money-applying
  handlers with nothing else to keep); its `setup()` call and import removed from
  `purchasing.routes.ts`. `supplier.creditChanged` was never emitted from any of those three
  handlers (only from `createSupplier`'s opening-credit path, unaffected), so no relocation was
  needed for observability narration.
- **`lastDeliveryAt`** (mentioned in the plan's C1 item 1) is **not** a `Supplier` column — it's
  derived on read via `getLastDeliveryAt()` (max `SupplierInvoice.updatedAt` for CONFIRMED
  invoices). Nothing to write in-tx; the plan's premise here was stale, noted rather than acted
  on (no schema change is in scope for this plan).

**Bonus fix (found while implementing, not in the plan's text):** `confirmInvoice`'s
double-confirm guard read the invoice's status *before* acquiring the Supplier lock. Two
concurrent confirms on the same invoice could both pass that check (both still DRAFT), both
enter their own transaction, and — since only the Supplier row was locked, not the invoice —
the second one (after waiting for the lock) would still add a second set of inventory layers on
a now-already-CONFIRMED invoice. Fixed by re-checking the invoice's status *inside* the
transaction, immediately after the lock is acquired: if a concurrent confirm already committed
while this call was waiting, this call now short-circuits (skips inventory/credit writes,
recomputes `repriceCandidates` fresh, emits nothing) instead of double-applying. This closed the
`two parallel confirms of the same invoice are safe` test, which the plan named as one of the
three that must go green.

**Tests:** unit specs updated (write assertions moved from the deleted listener onto the service
transaction); `purchasing.listener.spec.ts` deleted. New unit test for the double-confirm race
guard. New integration test: two sequential (no `Promise.all`) rapid payments produce the
correct final credit. All three previously-flaky integration tests — both `Promise.all`
concurrency tests and the `Supplier.credit == opening + Σ confirmed − Σ payments` property test
— run **5× consecutive green in isolation** (rule 3 determinism proof) before committing.

---

## C2 — Clients: the injected POS-client credit port

**Commit:** `70d8a5d fix: C2 pos-client credit port with row locking`

**Port shipped** (as `ClientsService` public methods, no `IClientsService`-declared shape —
structural typing, same convention `ICatalogCartPort`/`ICatalogRepricePort` already establish;
consumers declare their own narrowed local interface):

- `applySaleCharge(tx, posClientId, {totalAmount, paidAmount}) → {previousCredit, newCredit}` —
  locks the row, `credit += (totalAmount − paidAmount)`, `totalPaid += paidAmount`,
  `totalSold += totalAmount`.
- `applyPayment(tx, posClientId, {amount}) → {previousCredit, newCredit}` — locks the row,
  `credit -= amount`, `totalPaid += amount`.
- `applyOrderSold(tx, posClientId, {totalAmount}) → void` — locks the row, `totalSold +=
  totalAmount` only (orders never touch credit).
- `applyReturnRefund(tx, posClientId, {creditEffect}) → {previousCredit, newCredit}` — locks the
  row, `credit += creditEffect` (a caller-supplied signed delta, replicating exactly what the
  former `return.created` listener applied — no new refund semantics invented).

All four share one new private `lockPosClient(tx, posClientId)` helper (`SELECT … FOR UPDATE`
then a full read), which also rejects a disabled `posClientId` with the same `NotFoundError` as
an unknown one.

**Exposed for injection:** `Apps/api/src/modules/clients/clients.routes.ts` now exports `export
const clientsService = service;` — the same one-directional-dependency shape
`catalogProductService`/`sequenceService` already establish. `clients.routes.ts` is imported
directly by each consumer's own `*.routes.ts` (not via mount order in `modules/index.ts`), so
module resolution order is irrelevant.

**Did not remove the old listener handlers yet** (per plan step 3) — C3/C4/C5 each delete the
handler for the event they take over, one at a time, so the suite stayed green between every
commit.

**Tests:** each method's math (including underpayment raising credit, overpayment going
negative), the not-found/disabled rejection, and a two-sequential-calls test proving the second
call's `previousCredit` equals the first call's `newCredit` — the exact property the old
listener-based design violated.

---

## C3 — Sales: confirm, returns, and repair sales use the port

**Commit:** `95982d9 fix: C3 sale credit applied in-transaction`

**Changes:**
- `confirmSale`: replaced its own `lockPosClient` + manual `previousCredit`/`newCredit`
  computation with `clientCredit.applySaleCharge(tx, …)`. A guest-checkout sale (no
  `posClientId`) keeps computing `newCredit = 0 + (totalAmount − paidAmount)` exactly as before
  (stored on the `Sale` row only, never a `PosClient` write) — the `CREDIT_REQUIRES_CLIENT` guard
  already guarantees this is `≤ 0`.
- `recordRepairSale` (the `repair.pickedUp` handler, which **does** attach `posClientId`/money
  and emits the same `sale.confirmed` event `confirmSale` does): same replacement.
- `createReturn`: replaced a **direct `tx.posClient.update(...)`** call (a module-boundary
  violation already present in the code — sales was writing `PosClient`, clients' own data,
  directly) with `clientCredit.applyReturnRefund(tx, …)`.
- Sales' own `lockPosClient` private helper deleted (no longer used by any of the three call
  sites above).
- `clients.listener.ts`: `sale.confirmed` and `return.created` subscriptions (and the
  `applySaleConfirmed`/`applyReturnCreated` service methods + interface declarations they
  called) deleted.

**Bonus fix (found while implementing, not in the plan's text):** `createReturn`'s direct
`tx.posClient.update` write and the old `clients.listener.ts`'s `applyReturnCreated` handler were
**both** applying the same `creditEffect` — once synchronously in sales' own transaction, once
again asynchronously from the emitted event. Every single return was silently double-counting its
refund's credit effect. Routing the write through the single injected port call (replacing the
direct write, and deleting the listener handler that duplicated it) fixes this as a side effect
of the credit-serialization work, not a separately-planned action.

**Tests:** unit specs updated (port mocked, in-tx call args asserted); new coverage for the
repair-sale-with-a-linked-posClient path (previously untested — the existing tests never set
`posClientId` on the repair event). Integration: full sales + clients + billing + repairs +
statistics suites re-run green (the last four to catch any side effect from the deleted listener
handlers, since none of them are sales' own tests).

---

## C4 — Orders: totalSold in-transaction

**Commit:** `d02b727 fix: C4 order totalSold applied in-transaction`

**Changes:**
- `confirmOrder`: the `posClientId` resolution (`Order.clientId` → `Client.posClientId`) moved
  from *after* the confirm transaction to *before* it (a plain read, independent of anything the
  transaction computes) so it can be passed into the transaction. Inside the transaction, when a
  `posClientId` resolved, `clientCredit.applyOrderSold(tx, posClientId, {totalAmount})` is now
  called; guest orders (no client) are unchanged.
- `clients.listener.ts`: `order.confirmed` subscription (and the `applyOrderConfirmed` service
  method + interface declaration) deleted.
- `orders.routes.ts` wired with `clientsService` (satisfies the new local `IOrderCreditPort`
  structurally).

**Order.paidAmount mirror listener — kept, per the plan's explicit instruction.**
`orders.listener.ts`'s own `payment.clientRecorded` → `applyClientPaymentRecorded` handler
(mirrors `Order.paidAmount` from whatever `Invoice.paidAmount` currently holds, for orders whose
invoice was targeted by a payment) was **not** touched in C4. Its race — reading
`Invoice.paidAmount` before billing's own recompute had landed — disappears by *ordering*, not by
moving this handler: once C5 makes billing write `Invoice.paidAmount` synchronously inside
`createClientPayment`'s own transaction *before* emitting `payment.clientRecorded`, this mirror
reads an already-settled value on every single emission. The integration test that previously had
to emit the event, wait for billing's recompute, then replay the identical event a second time to
get a correct mirror was rewritten in **C5** (once the underlying race was actually gone) to go
through the real `POST /api/admin/client-payments` flow and assert settlement on that one call —
see C5's test notes.

**Tests:** unit spec asserts the port is called with the right `tx`/`posClientId`/`totalAmount`,
and that a guest order never calls it. Integration: the existing place→confirm test's
`PosClient.totalSold` assertion changed from a `waitFor` poll (needed when the write was
async) to a direct synchronous read (it's already settled by the time the confirm response
returns) — plus a new assertion that a double-confirm does **not** double-increment `totalSold`.

---

## C5 — Billing: client payments in-transaction

**Commit:** `435664c fix: C5 client payment credit and invoice paid in-transaction`

**Changes:**
- `createClientPayment`: **already** locked the PosClient and wrote `credit` inside its own
  transaction (a pre-existing, undocumented partial fix) — but via a **direct
  `tx.posClient.update`** (module-boundary violation) that never touched `totalPaid` at all
  (only the listener did). Replaced with `clientCredit.applyPayment(tx, …)`, which now also
  covers `totalPaid`.
- The targeted invoice's `paidAmount`/status recompute (`ISSUED → PARTIALLY_PAID → PAID`,
  Σ `ClientPayment.amount` for that invoice) — previously billing's own
  `applyClientPaymentRecorded` listener handler, running fully outside any transaction — moved
  into `createClientPayment`'s own transaction. Guard order preserved exactly (check
  `status !== CANCELLED` **before** aggregating the ledger, same as the original handler, so a
  cancelled invoice's payments are never even summed).
- `billing.listener.ts`: `payment.clientRecorded` subscription deleted (its `sale.confirmed`/
  `order.confirmed` invoice-issuing subscriptions are untouched).
- Billing's own `applyClientPaymentRecorded` service method + its `lockPosClient` helper +
  its `IBillingService` interface declaration all deleted (both fully superseded by the in-tx
  work above).
- `clients.listener.ts`: `payment.clientRecorded` subscription (and the
  `applyClientPaymentRecorded` service method + interface declaration) deleted — **this was the
  last money-cache handler left on this listener.**
- `billing.routes.ts` wired with `clientsService` (satisfies the new local `IClientCreditPort`).

**Final `clients.listener.ts` subscription list** (verified by reading the file, not just the
grep below):
```
eventBus.on('client.approved', ...)
```
That's it. Every `sale.confirmed`/`return.created`/`order.confirmed`/`payment.clientRecorded`
subscription this listener used to carry is gone — `client.approved` (materializing a new
`PosClient` row on client approval) is untouched forever, per the plan.

**Determinism proof:** the `concurrent payments on the same posClient serialize` billing
integration test — previously flaky (documented in the prior audit-fixes report) — now passes.
Run **5× consecutive green in isolation** before committing (rule 3).

**Test rewrites required by deleted listeners (not just new coverage):** two existing
integration tests directly emitted a *synthetic* `payment.clientRecorded` event and relied on
listeners that no longer exist to react to it — both silently would have become no-ops:
- `clients.integration.spec.ts`'s `PosClient.credit reflects the emitting event's own snapshot`
  test manually emitted the event with no real `ClientPayment` row or real `Invoice` behind it.
  Rewritten to go through the real `POST /api/admin/client-payments` route; the `waitFor` poll
  was removed since the write is synchronous now.
- `orders.integration.spec.ts`'s `mirrors Order.paidAmount from a real payment.clientRecorded
  emission` test manually created a `ClientPayment` row (bypassing `createClientPayment`
  entirely) and emitted the event **twice** — once to let billing's now-deleted listener settle
  `Invoice.paidAmount`, once more to let orders' own listener mirror the settled value. Rewritten
  to place the order as an authenticated client linked to a real `PosClient` (required so the
  payment's `posClientId` matches what the issued invoice carries — billing's own guard) and
  drive a single real `POST /api/admin/client-payments` call; the mirror settles from that one
  emission, `waitFor` only remains for orders' own still-async post-commit mirror.

---

## The §C5 sweep (plan's closing check)

**Grep:** `find src/modules -name "*.listener.ts" | xargs grep -nE "credit|totalPaid|totalSold|totalInvoiced|paidAmount"`

```
src/modules/clients/clients.listener.ts:8:// payment.clientRecorded to billing's own (C5) — all via the injected credit port
src/modules/clients/clients.listener.ts:9:// (credit-serialization fix, plan §C2 onward). No money-cache handler is subscribed here
src/modules/observability/observability.listener.ts:105:    eventBus.on('posClient.creditChanged', (payload) =>
src/modules/observability/observability.listener.ts:106:      this.handle('posClient.creditChanged', payload, (p) => ({
src/modules/observability/observability.listener.ts:107:        actionType: 'posClient.creditChanged',
src/modules/observability/observability.listener.ts:196:        description: `Confirmed: total ${p.totalAmount}, credit ${p.previousCredit} → ${p.newCredit}`,
src/modules/observability/observability.listener.ts:214:        description: `Amount ${p.amount}: credit ${p.previousCredit} → ${p.newCredit}`,
src/modules/observability/observability.listener.ts:218:    eventBus.on('supplier.creditChanged', (payload) =>
src/modules/observability/observability.listener.ts:219:      this.handle('supplier.creditChanged', payload, (p) => ({
src/modules/observability/observability.listener.ts:220:        actionType: 'supplier.creditChanged',
src/modules/observability/observability.listener.ts:236:            ? `Total ${p.totalAmount}, credit ${p.previousCredit} → ${p.newCredit}`
src/modules/observability/observability.listener.ts:351:        description: `Amount ${p.amount}: credit ${p.previousCredit} → ${p.newCredit}`,
src/modules/orders/orders.listener.ts:5:// Subscribes to payment.clientRecorded (mirrors Order.paidAmount when the payment targets this
src/modules/billing/billing.listener.ts:6:// clientRecorded's paidAmount/status recompute moved into createClientPayment's own
src/modules/billing/billing.listener.ts:7:// transaction (credit-serialization fix, plan §C5); this listener no longer subscribes to it.
```

**Reading this literally is not "empty" — annotated below, because it isn't a raw table of hits,
it's every hit categorized:**

1. **Comments only** (`clients.listener.ts` lines 8–9, `billing.listener.ts` lines 6–7,
   `orders.listener.ts` line 5) — documentation of what moved where, not code.
2. **`observability.listener.ts`** — every hit here is a template-string *narration* builder
   (`description: \`... credit ${p.previousCredit} → ${p.newCredit}\``) reading event payload
   fields to build a human-readable `AuditLog` row. It never writes `Supplier`/`PosClient`/
   `Invoice`. This is the explicitly-preserved narration path — the plan's own closing line
   confirms `posClient.creditChanged`/`supplier.creditChanged` must keep being emitted post-commit
   by the writing services specifically so this narration keeps working.
3. **`orders.listener.ts`'s real subscription** (the one substantive remaining case): mirrors
   `Order.paidAmount` — **not** `Supplier`/`PosClient`/`Invoice` — from an already-settled value.
   Explicitly kept per C4 item 3's "keep it" instruction; reasoning above.

**No listener anywhere writes `Supplier.credit`/`totalPaid`/`totalInvoiced`,
`PosClient.credit`/`totalPaid`/`totalSold`, or `Invoice.paidAmount`.** Every one of those seven
fields is now written exclusively inside the transaction of the service method that also
allocates the document row causing the change (`confirmInvoice`/`cancelInvoice`/`createPayment`
in purchasing; `confirmSale`/`recordRepairSale`/`createReturn` in sales via the injected port;
`confirmOrder` in orders via the injected port; `createClientPayment` in billing via the injected
port). That is the actual property the sweep is checking for, and it holds.

---

## Validation summary

- `tsc --noEmit` clean on every action.
- `npm run lint` clean on every action.
- `npm run test:unit`: 611 tests, all green, after every action (down from 613 pre-C1 — 3
  `applySupplierInvoiceConfirmed`/etc. tests + 5 `purchasing.listener.spec.ts` tests deleted,
  offset by new coverage added across all five actions).
- **Full integration suite (`npm run test:int`), run 3 consecutive times: 14 files, 137 tests,
  zero failures, zero flakes, every time.** The former "known-flaky purchasing tests" baseline
  (documented in the prior audit-fixes report as 3, not the plan's originally-assumed 2) is
  retired — nothing in this suite is flaky anymore.
- `git diff --stat` on `Apps/contract` across the whole C1–C5 range: **empty.** No contract file
  changed.
- No new circular dependency: `clients.routes.ts` (the new export point) has no import from
  `sales`/`orders`/`billing`/`purchasing` anywhere in its file — the dependency stays
  one-directional (those four import `clientsService`, never the reverse), the same shape every
  prior cross-module wiring in this codebase already uses.

## Note for Stage 3: no frontend impact

Every response shape is unchanged. `SupplierInvoiceDto`/`SupplierPaymentDto`,
`ClientPaymentDto`/`InvoiceDto`, `SaleDto`/`ReceiptDto`, and `OrderDto` all carry exactly the
fields they did before this plan — `previousCredit`/`newCredit` snapshots are still computed and
returned the same way, just from a locked read instead of a racy one. Every emitted event
(`supplierInvoice.confirmed`, `payment.supplierRecorded`, `sale.confirmed`, `return.created`,
`order.confirmed`, `payment.clientRecorded`) still carries the exact payload shape it did before —
only *when* the underlying DB write happens relative to the emission changed (now before, always;
previously after, racily). No route path, request schema, or response schema changed anywhere in
this plan. Stage 3 frontend work needs no changes on account of this fix.

## Commits

| # | Hash | Message |
|---|---|---|
| 1 | `e63d09c` | `fix: C1 supplier credit written in-transaction` |
| 2 | `70d8a5d` | `fix: C2 pos-client credit port with row locking` |
| 3 | `95982d9` | `fix: C3 sale credit applied in-transaction` |
| 4 | `d02b727` | `fix: C4 order totalSold applied in-transaction` |
| 5 | `435664c` | `fix: C5 client payment credit and invoice paid in-transaction` |

## Out of scope, untouched (per plan §5)

- `Docs/deploy-instruction.md`'s `seed:admin` mismatch (tracked separately, from the prior
  audit-fixes report).
- Geography seeding (3 wilayas / 14 communes).
- Login rate limiting (deferred).
- No contract file touched anywhere in this plan.
