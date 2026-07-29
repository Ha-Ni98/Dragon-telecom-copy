# Stage 02 — Credit Serialization (single-session execution plan)

**Mode:** Light mode (workflow.md §8). Execute every action in this one session, in order.
**Authority:** This file states WHAT. `back-end-rules.md` / `module-implementation-rules.md` / `test-rules.md` govern HOW. No contract changes are expected anywhere in this plan — event payloads, DTOs, and routes are untouched. If an action appears to require a contract change, stop and ask.

## The defect being fixed (context for every action)

Money caches (`Supplier.credit`/`totalPaid`/`totalInvoiced`, `PosClient.credit`/`totalPaid`/`totalSold`, `Invoice.paidAmount`) are currently written by **un-awaited event listeners** after the emitting transaction commits. The emitting service computes a `previousCredit → newCredit` snapshot from a read that nothing serializes, and the listener later applies that **absolute** snapshot. A fast sequential second operation reads the counterpart row before the first listener's write lands, computes its own snapshot off the stale value, and last-write-wins corrupts the balance permanently. This was proven by `purchasing.integration.spec.ts`'s property test (report-audit-fixes.md, "Integration test count changed" section) and exists symmetrically in sales/clients, orders, and billing.

**The fix pattern (identical in every action):** the counterpart row is locked and written **inside the emitting transaction** — `SELECT … FOR UPDATE` via `tx.$queryRaw` on the counterpart row (the `SequenceService` precedent from platform sprint P3), compute previous/new from the locked read, write the new cache values with `tx.update`, commit atomically. Events are still emitted **post-commit with unchanged payloads** (they already carry `previousCredit`/`newCredit`) — audit narration and every non-money listener continue working untouched. The money-applying listener handlers are **deleted** (not left as dead no-ops); replay-safety for money is now by construction, since the write lives inside the already-idempotent document transaction.

**Module-boundary rule for cross-module writes:** purchasing writes `Supplier` (its own module's data) directly in-tx. `PosClient` belongs to the clients module — sales, orders, and billing must not write it directly; clients exposes an **injected credit port** (the "needs a return value inside the caller's transaction ⇒ injected service" convention, same footing as `IInventoryService`), wired in each consumer's `routes.ts` composition root.

## Global execution rules

1. Execute in order **C1 → C2 → C3 → C4 → C5** (C2's port is a dependency of C3–C5; C1 is independent). One commit per action, message exactly `fix: <id> <title>` as given in each header.
2. **Validation gate per action:** `tsc --noEmit` clean, `npm run lint` clean, `npm run test:unit` green, `npm run test:int` for the touched module(s) green. Never loosen a test to pass; tests change only where this plan changes the specified behavior.
3. **Determinism proof:** any previously-flaky test whose action claims to fix it must be run **5 consecutive times green in isolation** before that action's commit.
4. **After all actions:** run the **full** integration suite 3 consecutive times — the Definition of Done baseline is now **zero failures, zero flakes**. Then write `Docs/Stage-02-Backend/results/report-credit-serialization.md` (per action: what changed, decisions, validation incl. the 5×/3× runs) and commit it as `docs: credit-serialization report`.
5. Out of scope, do not touch: the `deploy-instruction.md`/`seed:admin` mismatch (tracked separately), geography seeding, rate limiting, any contract file.

---

## C1 — Purchasing: supplier caches move in-transaction · `fix: C1 supplier credit written in-transaction`

**Files:** `Apps/api/src/modules/purchasing/purchasing.service.ts`, `purchasing.listener.ts`, unit + integration specs.

1. **`confirmInvoice`:** inside the existing `$transaction`, lock the `Supplier` row (`FOR UPDATE`), compute `previousCredit`/`newCredit` from the locked read, and write `Supplier.credit`, `totalInvoiced += totalAmount`, and `lastDeliveryAt` in the same tx (alongside the header's credit snapshot it already stores). Emit `supplierInvoice.confirmed` post-commit, payload unchanged.
2. **`cancelInvoice`:** same pattern, reversing credit/`totalInvoiced` in-tx. Emit unchanged.
3. **`createSupplierPayment`:** same pattern — lock supplier, compute snapshot, write `credit −= amount`, `totalPaid += amount` in-tx; **also move the targeted `SupplierInvoice.paidAmount`/status update into this same transaction** (it is purchasing's own data; the listener currently doing it is part of the same race). Emit `payment.supplierRecorded` post-commit, payload unchanged.
4. **`purchasing.listener.ts`:** delete the three money-applying handlers (`applySupplierInvoiceConfirmed`, the cancelled reversal, `applyPaymentSupplierRecorded`'s supplier-cache and invoice-paid writes). If the listener file becomes empty, remove it and its subscription wiring; if `supplier.creditChanged` was emitted from a listener, emit it post-commit from the service instead (payload unchanged) so audit narration is preserved.
5. **Overpayment behavior unchanged:** negative credit remains allowed and flagged, now computed off the locked read.

**Tests:** update unit specs that asserted listener-applied writes (the write assertions move to the service tx). The three previously-failing integration tests — both `Promise.all` concurrency tests and the `credit == opening + Σ confirmed − Σ payments` property test — are now expected **deterministically green**: run each 5× in isolation (rule 3). Add one new integration case: two *sequential* rapid payments (no `Promise.all`) produce the correct final credit — the exact scenario the audit report diagnosed.

---

## C2 — Clients: the injected POS-client credit port · `fix: C2 pos-client credit port with row locking`

**Files:** `Apps/api/src/modules/clients/clients.interface.ts`, `clients.service.ts` (or a dedicated `clients.credit.ts` kept within the module's file budget per module-implementation-rules), `clients.routes.ts` (export the singleton), unit specs.

1. Declare and implement a tx-scoped credit service on the clients module, exposed for injection (consumers declare the port shape locally, provider satisfies structurally — the established `ICatalogCartPort` precedent):
   - `applySaleCharge(tx, posClientId, { totalAmount, paidAmount }) → { previousCredit, newCredit }` — lock row, `credit += (totalAmount − paidAmount)`, `totalPaid += paidAmount`, `totalSold += totalAmount`.
   - `applyPayment(tx, posClientId, { amount }) → { previousCredit, newCredit }` — lock row, `credit −= amount`, `totalPaid += amount`.
   - `applyOrderSold(tx, posClientId, { totalAmount }) → void` — lock row, `totalSold += totalAmount`.
   - `applyReturnRefund(tx, posClientId, payload) → { previousCredit, newCredit }` — replicate exactly the credit effect the current `return.created` clients-listener applies (read that handler first; do not invent new refund semantics).
2. Every method: `FOR UPDATE` lock via `tx.$queryRaw`, compute from the locked read, single `tx.update`. Reject unknown/disabled `posClientId` with the module's existing not-found error.
3. **Do not remove the clients listener handlers yet** — C3/C4/C5 each delete the handler for the event they take over, so the suite stays green between commits. The `client.approved` → PosClient-creation listener is untouched forever.

**Tests:** unit-spec each method's math (incl. underpayment raising credit, overpayment negative credit) and the not-found rejection. A two-sequential-calls test asserting the second call's `previousCredit` equals the first call's `newCredit` (the property the old design violated).

---

## C3 — Sales: confirm, returns, and repair sales use the port · `fix: C3 sale credit applied in-transaction`

**Files:** `Apps/api/src/modules/sales/sales.service.ts`, `sales.routes.ts` (inject the port), `Apps/api/src/modules/clients/clients.listener.ts`, unit + integration specs.

1. **`confirmSale`:** when `posClientId` is present, replace the current unserialized read-and-snapshot with `creditPort.applySaleCharge(tx, …)` inside the confirm transaction; store the returned `previousCredit`/`newCredit` on the sale exactly as today. Receipt figures, `CREDIT_REQUIRES_CLIENT` gating, and the `sale.confirmed` payload are unchanged.
2. **`recordRepairSale`** (the `repair.pickedUp` listener in sales): if it currently attaches a `posClientId` and money, route its cache effect through the port inside its own write transaction the same way; if it never touched POS-client money, state that finding in the report and change nothing.
3. **`createReturn`:** apply the refund's credit effect via `applyReturnRefund` inside the return transaction; `return.created` payload unchanged.
4. **`clients.listener.ts`:** delete the `sale.confirmed` and `return.created` money handlers.

**Tests:** update sales unit specs (port mocked; assert it's called in-tx with the right figures). Integration: two rapid **sequential** confirmed sales to the same POS client end with `credit`/`totalPaid`/`totalSold` exactly equal to the ledger recomputation — run 5×. Re-run the existing conformance check (cache = ledger) — it should now be deterministic rather than eventually-consistent.

---

## C4 — Orders: totalSold in-transaction · `fix: C4 order totalSold applied in-transaction`

**Files:** `Apps/api/src/modules/orders/orders.service.ts`, `orders.routes.ts`, `clients.listener.ts`, specs.

1. **`confirmOrder`:** when the order's client links to a POS client, call `applyOrderSold(tx, …)` inside the confirm transaction. Guest orders (no client) change nothing.
2. **`clients.listener.ts`:** delete the `order.confirmed` totalSold handler.
3. **`Order.paidAmount` mirror listener (orders' `payment.clientRecorded` handler): keep it.** After C5, billing writes `Invoice.paidAmount` inside the payment transaction *before* emitting, so this mirror now reads a settled value on every emission — the race the orders sprint-3 report documented disappears by ordering, not by moving this display-only mirror. Record this reasoning in the report; update the integration test that previously had to emit-twice-and-wait to assert settlement on a **single** emission.

**Tests:** confirm-path unit spec asserts the port call; integration place→confirm asserts `totalSold` incremented exactly once (idempotent double-confirm still increments once — assert it).

---

## C5 — Billing: client payments in-transaction · `fix: C5 client payment credit and invoice paid in-transaction`

**Files:** `Apps/api/src/modules/billing/billing.service.ts`, `billing.routes.ts`, `billing.listener.ts`, `clients.listener.ts`, specs.

1. **`createClientPayment`:** inside its transaction — `creditPort.applyPayment(tx, …)` for the POS-client caches (snapshot returned feeds the payment row and the response, unchanged shape), and when an invoice is targeted, update `Invoice.paidAmount`/status (`ISSUED → PARTIALLY_PAID → PAID`) **in the same transaction** (billing's own data). Emit `payment.clientRecorded` post-commit, payload unchanged.
2. **`billing.listener.ts`:** delete its own `payment.clientRecorded` invoice-recompute handler (the write moved in-tx). Its `sale.confirmed`/`order.confirmed` invoice-issuing handlers are untouched.
3. **`clients.listener.ts`:** delete the `payment.clientRecorded` money handler. After C3+C4+C5, verify what remains of this listener is exactly the `client.approved` PosClient-creation handler — grep the file and state the final subscription list in the report.
4. **Sweep (closes the plan):** `grep` the whole `src/modules` tree for any remaining listener that writes `credit`, `totalPaid`, `totalSold`, `totalInvoiced`, or `paidAmount` — the result must be empty; paste the grep into the report. Confirm `posClient.creditChanged`/`supplier.creditChanged` are still emitted post-commit by the writing services so observability's narration keeps working (its listener subscriptions are untouched).

**Tests:** billing unit specs updated (in-tx assertions replace listener assertions; replay of `payment.clientRecorded` must now change nothing anywhere — assert it). Integration: payment → invoice status flip and POS-client credit assert in one flow; two rapid sequential payments on the same client — correct final credit, run 5×.

---

## Definition of done

- 5 commits in order (`fix: C1 …` through `fix: C5 …`) plus `docs: credit-serialization report`.
- Full unit suite green. **Full integration suite green — 0 failures — run 3 consecutive times.** The former "known-flaky purchasing tests" baseline is retired; if any test still flakes, that is a blocking finding to investigate and report, not a baseline to document.
- No contract file changed (`git diff --stat` on `Apps/contract` is empty; state it in the report).
- The report includes: the C5 sweep grep output (empty), the final `clients.listener.ts` subscription list, the C2 port's method list as actually shipped, and a one-paragraph note for Stage 3 that receipt/payment response shapes are unchanged (no frontend impact).
