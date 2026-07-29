# Report — Set 5 (Payment Ledger as the Source of Truth)

Executed against `Docs/Stage-04-Fixes/plans/plan-S05-payment-ledger.md`, all 12 actions, 2026-07-26.
Both validation gates green (tsc + lint, contract/api). No test file was edited. No test suite was
run. Implements **D5**, **D6**, **D7** per the four owner decisions (R1–R4) recorded in the plan's
§0.2.

---

## What changed

### Clients — the credit port split (Action 1)

`Apps/api/src/modules/clients/clients.service.ts`:
- `applySaleCharge` **deleted**, replaced by **`applyDocumentCharge(tx, posClientId, {
  totalSoldDelta, creditDelta })`** — writes `credit` and `totalSold` only, never `totalPaid`.
- `applyPayment` **renamed** to **`applyLedgerPayment(tx, posClientId, { amount })`** — the single
  writer of `totalPaid` anywhere in the codebase (D5). `amount` is signed: positive is money
  received, negative is a refund (D6).
- `applyOrderSold` and `applyReturnRefund` **deleted** — both fully subsumed by
  `applyDocumentCharge` (see Action 5c and Action 8).
- `lockPosClient` unchanged.
- `clients.routes.ts`'s doc comment on the `clientsService` export, which named the four old
  method names, updated to name the two new ones (found during the sweep, Action 11 — see
  "Findings" below).

### Billing — two in-transaction primitives extracted (Action 2, 3)

`Apps/api/src/modules/billing/billing.service.ts`:
- New **`issueInvoiceInTx(tx, input: InvoiceIssueRequest)`** — issues an invoice inside the
  *caller's* transaction (no second `$transaction`, no post-commit emission, no `P2002` swallow —
  every caller is already guarded against double-issuance by its own document-status check).
- New **`captureClientPaymentInTx(tx, input)`** — the body of the old `createClientPayment`
  transaction, re-homed as a reusable primitive: applies the ledger via
  `clientCredit.applyLedgerPayment`, allocates a `CLIENT_PAYMENT` reference, creates the
  `ClientPayment` row, and recomputes the target invoice's `paidAmount`/status from
  `Σ ClientPayment.amount` (guard order preserved: a `CANCELLED` invoice's ledger is never
  aggregated). `invoiceId` is optional, for repair-style "on account" captures (S13).
- `createClientPayment` is now a thin wrapper: resolve `invoiceNumber` → `invoiceId`, open its own
  transaction, call `captureClientPaymentInTx`, re-read the row with `PAYMENT_INCLUDE`, emit
  `payment.clientRecorded` post-commit. Behavior unchanged from the caller's perspective.
- **`issueFromSale` deleted entirely** — its only caller (`billing.listener.ts`'s `sale.confirmed`
  subscription) is gone; sales now issues its own invoice in-transaction (R2). `issueFromOrder` and
  the private `issueInvoice` (used only by `issueFromOrder`) are **unchanged** — orders still issue
  post-commit until S10.
- `SalesEvents` import dropped (no longer referenced in this file).

`Apps/api/src/modules/billing/billing.interface.ts`:
- New exported type **`InvoiceIssueRequest`** = `Omit<InvoiceIssueInput, 'number' |
  'clientNameSnapshot' | 'clientAddressSnapshot'>` — the caller-supplied half of an issuance;
  billing owns the client-name/address snapshot internally.
- `IBillingService`: `issueFromSale` removed; `issueInvoiceInTx` and `captureClientPaymentInTx`
  added; `issueFromOrder` kept.
- Local `IClientCreditPort`: `applyPayment` → `applyLedgerPayment`.

`Apps/api/src/modules/billing/billing.routes.ts`: exports **`billingService`** (the singleton),
mirroring `clientsService`'s precedent — sales injects it (Action 5a).

`Apps/api/src/modules/billing/billing.listener.ts`: **`sale.confirmed` subscription deleted**.
`order.confirmed` kept. Header comment rewritten to state this listener is one step from deletion
(after S10 moves order issuance the same way).

### Sales — the two ports it now needs (Action 4, 5)

`Apps/api/src/modules/sales/sales.interface.ts`:
- Local `IClientCreditPort`: `applySaleCharge`/`applyReturnRefund` replaced by
  `applyDocumentCharge`/`applyLedgerPayment` (same shapes as clients' real implementation).
- New local **`IBillingIssuePort`** — `issueInvoiceInTx` + `captureClientPaymentInTx`, narrowed to
  what sales needs, imports `InvoiceIssueRequest` from `../billing/billing.interface`.

`Apps/api/src/modules/sales/sales.routes.ts`: imports `billingService` from
`../billing/billing.routes`; `SalesService` constructor now takes it as a sixth argument. Import
comment updated to name billing as a fourth one-directional sibling dependency.

`Apps/api/src/modules/sales/sales.service.ts`: constructor gains `private billing:
IBillingIssuePort`.

### Orders — mechanical migration, zero behavior change (Action 5c)

`Apps/api/src/modules/orders/orders.interface.ts` / `orders.service.ts`: `applyOrderSold` →
`applyDocumentCharge(tx, posClientId, { totalSoldDelta: totalAmount, creditDelta: 0 })`. Same lock,
same two writes (`totalSold` only), `creditDelta: 0` makes explicit what was previously implicit.
**S10** will change this one call site to a real `creditDelta` when it moves order money to
`COMPLETED`.

### Sales confirm — the atomic sale+invoice+payment unit (Action 6)

`Apps/api/src/modules/sales/sales.service.ts`, `confirm()`:
- **6a** — charges the full total onto the account (`applyDocumentCharge({ totalSoldDelta: total,
  creditDelta: total })`) when a client is linked; walk-in branch unchanged.
- **6b** — the FIFO consumption loop is unchanged, but now also records each line's
  `costOfGoods`/`profit` into a local map (`lineFigures`) for the invoice-issuance step to reuse
  without a second read.
- **6c** — the `SALE` sequence number is allocated before the invoice call (preserves the
  `SALE → INVOICE → CLIENT_PAYMENT` allocation order).
- **6d** — **issues the invoice in-transaction** via `billing.issueInvoiceInTx`, built entirely
  from in-memory data (no re-read of the sale, unlike the deleted `issueFromSale`). A known
  client's invoice is issued with `paidAmount: 0` (the ledger recompute in 6e sets the real figure);
  a walk-in's invoice carries `cmd.paidAmount` directly (D5).
- **6e** — **captures the payment** via `billing.captureClientPaymentInTx` when a client is linked
  and `paidAmount > 0`; `newCredit` is updated to the post-payment balance.
- **6f** — the `Sale` row is now written **last**, so its `newCredit` reflects the captured
  payment.
- After the transaction: emits `invoice.issued` (sales now owns this emission, since sales owns
  the transaction — previously billing's `issueInvoice` emitted it), `sale.confirmed` (unchanged
  payload), and `payment.clientRecorded` when a payment was captured.

### Billing listener — stops issuing sale invoices (Action 7)

Covered above under "Billing" — `sale.confirmed` subscription removed.

### Returns — D6/D7 composed correctly (Action 8)

`Apps/api/src/modules/sales/sales.service.ts`, `createReturn()`:
- **8a**, before the transaction: resolves the sale's invoice (`sourceType_sourceId` compound
  key), sums existing negative `ClientPayment` rows against it to get `refundedSoFar`, and computes
  `cashRefundable = max(0, sale.paidAmount − refundedSoFar)` and `cashRefunded =
  min(refundAmount, cashRefundable)` — **R3's cap**, so a refund can never invent cash that was
  never collected.
- **8b**, inside the transaction: when a `cashRefunded > 0` and an invoice exists, calls
  `billing.captureClientPaymentInTx` with a **negative** amount (D6) against that invoice. Then
  computes the net credit delta: `creditEffect = -cashRefunded + (allFullyReturned ?
  -saleCreditDelta : 0)`, reusing the **existing** `allFullyReturned` boolean the status write
  already computes (F6 — not recomputed). Applies it via `applyDocumentCharge({ totalSoldDelta:
  -refundAmount, creditDelta: creditEffect })`.
- **8c** — `return.created`'s `creditEffect` now carries this **net** value, not the old
  `-refundAmount`; the comment above the `let creditEffect` declaration was rewritten to describe
  the new meaning; the contract's own comment (`sales.events.ts`) was updated to match (Action 10).
- **8d** — emits `payment.clientRecorded` after the transaction when a refund payment was created,
  with the invoice number resolved from the same lookup used for the cap (no extra query).

**Arithmetic verified against all four cases in the plan's §Action 8e table** — see "Verification
of the arithmetic" below.

### Contract — verified, one comment-only edit (Action 10)

- `CreateClientPaymentSchema.amount` — confirmed still `z.number().positive()`. **Unchanged.** The
  admin/staff payment endpoint cannot post a refund; refund rows are only ever created internally
  by `createReturn` through `captureClientPaymentInTx`.
- `ClientPaymentResponseSchema.amount` — confirmed still a plain `z.number()`, already serializes
  negative rows. **Unchanged.**
- `BillingEvents['payment.clientRecorded']` — confirmed it already carries every field both 6j and
  8d emit. **Unchanged.**
- `SalesEvents['return.created'].creditEffect`'s comment updated to describe the new D7 meaning
  (net credit delta, not the raw refund amount). **Comment-only** — the field's type
  (`number | undefined`) is unchanged.

`git diff --stat -- Apps/contract` for this set: **one file, comment-only, +4/−1 lines.** No
schema, no DTO, no route changed — the same property the credit-serialization work held.

---

## Verification of the arithmetic (plan §0.5 and Action 8e)

**Confirm — composed vs. pre-S5, for a sale of total T paid P, prior credit C₀:**

| Field | Pre-S5 (one `applySaleCharge` call) | Post-S5 (`applyDocumentCharge` then `applyLedgerPayment`) |
|---|---|---|
| `credit` | `C₀ + (T − P)` | `applyDocumentCharge`: `C₀ + T` → `applyLedgerPayment(amount=P)`: `− P` → `C₀ + T − P` |
| `totalSold` | `+= T` | `+= T` (document call only) |
| `totalPaid` | `+= P` | `+= P` (ledger call only — D5's single writer) |

Traced by hand through the actual code paths written in Action 6/1, not just asserted — confirmed
equal.

**Returns — the four cases, traced through the actual formulas in `createReturn`:**

| Case | Sale | Return | `totalSold` | `totalPaid` | `credit` |
|---|---|---|---|---|---|
| Partial, fully-paid | T=1000, P=1000 | R=400 | −400 | −400 | **0** (ledger refund +400, document charge −400 cancel) |
| Full, part-paid | T=1000, P=300 | R=1000 (full) | −1000 | −300 (capped, not −1000) | −700 (ledger +300, document charge −1000); **net across sale+return: all three back to baseline** |
| Partial, credit sale | T=1000, P=0 | R=400 | −400 | **0** (nothing to refund, no ledger row) | **0** — client still owes the full 1000 (D7 as specified) |
| Full, credit sale | T=1000, P=0 | R=1000 (full) | −1000 | 0 | −1000 → owes nothing |

**Row 3 is the genuine, deliberate D7 consequence flagged in the plan**: a partial return on a
credit sale leaves the client owing the full original amount until the return is complete, because
D7 says credit stays untouched on a partial return. This is D7 as written and settled by the
owner — implemented as specified, called out here per the plan's instruction, and is checklist
item 19 below for the owner to see directly.

---

## Findings during execution

**One stale comment found and fixed beyond the plan's named list.** `clients.routes.ts:54`'s doc
comment on the `clientsService` export named all four of the old method names
(`applySaleCharge`/`applyPayment`/`applyOrderSold`/`applyReturnRefund`) as the only sanctioned
write path. Action 11's sweep (`grep -rn "applySaleCharge\|applyReturnRefund\|applyOrderSold\|
applyPayment("`) caught it — a comment quietly false the moment Action 1 deleted those methods.
Updated to name `applyDocumentCharge`/`applyLedgerPayment`.

No other deviations from the plan were required. Every action was implemented exactly as
specified, including the sequence-allocation order (`SALE → INVOICE → CLIENT_PAYMENT`) and the
guard-order preservation in the invoice-status recompute.

---

## Sweep results (plan Action 11) — all five green

```
1. find Apps/api/src/modules -name "*.listener.ts" | xargs grep -nE "credit|totalPaid|totalSold|totalInvoiced|paidAmount"
   → Every hit is either a comment or observability's narration-string builder (reads event
     payload fields to build an AuditLog description — never writes Supplier/PosClient/Invoice).
     orders.listener.ts's real subscription (Order.paidAmount mirror) is a comment-only hit here
     (the actual write is one line below the grep's match, on `sourceType === ORDER` only — a
     no-op for every sale.confirmed-triggered payment.clientRecorded, per F7). No listener writes
     a money cache. ✓ (identical property to report-credit-serialization.md's §C5 sweep)

2. grep -rn "applySaleCharge\|applyReturnRefund\|applyOrderSold\|applyPayment\(" Apps/api/src
   → Two hits, both comments (clients.service.ts's own historical-reference comment explaining
     what the new primitives replace; the routes.ts comment fixed above). Zero functional
     references. ✓

3. grep -rn "tx.invoice.create\|tx.clientPayment.create" Apps/api/src
   → billing.service.ts only, three sites: captureClientPaymentInTx's clientPayment.create,
     issueInvoiceInTx's invoice.create, and the pre-existing private issueInvoice's invoice.create
     (still used by issueFromOrder). ✓

4. grep -rn "totalPaid" Apps/api/src/modules/clients/clients.service.ts
   → One functional write site (applyLedgerPayment's tx.posClient.update), the rest are comments
     and one unrelated read (getMe's include). ✓

5. grep -rn "issueFromSale" Apps/api/src
   → Zero functional references (one comment in sales.service.ts noting what confirm() replaced). ✓
```

---

## Stale tests (plan Action 12a) — not edited, not run

Ran `npx tsc --noEmit` against the full api tsconfig (`include: ["src", "test", "prisma"]`) to get
the authoritative stale-symbol list — src/** is 0 errors; every error below is in `test/`.

**Already stale from S1** (unaffected in kind, confirmed present, not touched): the four
`test/data/*.factory.ts` files, both integration specs
(`repairs.integration.spec.ts`, `statistics.integration.spec.ts`), `catalog.mapper.spec.ts`,
`inventory.{mapper,service}.spec.ts`, `observability.mapper.spec.ts`, `purchasing.mapper.spec.ts`.

**Already stale from S1, now with additional S5-caused errors layered on top:**

| File | New S5-caused errors |
|---|---|
| `test/unit/modules/billing/billing.service.spec.ts` | `applyPayment` no longer exists on `IClientCreditPort` (7 call sites); `issueFromSale` no longer exists on `BillingService` (3 call sites) |
| `test/unit/modules/billing/billing.listener.spec.ts` | `applyPayment` no longer exists on `IClientCreditPort` |
| `test/unit/modules/clients/clients.listener.spec.ts` | none new (still only the pre-existing `origin` staleness) |
| `test/unit/modules/sales/sales.listener.spec.ts` | `applySaleCharge` no longer exists on `IClientCreditPort`; the deleted `sales.listener.ts` module itself is still imported (already stale from S1) |
| `test/unit/modules/sales/sales.mapper.spec.ts` | none new (still only the pre-existing `origin` staleness) |
| `test/unit/modules/sales/sales.service.spec.ts` | `applySaleCharge`/`applyReturnRefund` no longer exist on `IClientCreditPort` (8 call sites) — on top of the pre-existing `recordRepairSale` staleness from S1 |

**Newly stale, introduced by this set (not previously flagged):**

| File | What's stale |
|---|---|
| `test/unit/modules/clients/clients.service.spec.ts` | Asserts on the deleted `applySaleCharge`/`applyPayment`/`applyOrderSold`/`applyReturnRefund` methods directly on `ClientsService` (9 call sites) — these tests exercised exactly the four methods Action 1 replaced. |
| `test/unit/modules/orders/orders.interface` consumers: `orders.listener.spec.ts` | Constructs a mock satisfying `IOrderCreditPort` with `applyOrderSold`, which no longer exists on that interface. |
| `test/unit/modules/orders/orders.service.spec.ts` | Same — mocks and asserts `applyOrderSold` (3 sites); the real interface now exposes `applyDocumentCharge`. |

**Behaviorally stale, not just uncompilable** — worth flagging explicitly per the plan's
instruction: any test in the list above that asserts a POS sale produces **no** `ClientPayment`
row, or that an invoice is issued **after** the confirm HTTP response resolves (via a `waitFor`
poll), is now asserting the *opposite* of this set's intended behavior. `billing.service.spec.ts`
and `sales.service.spec.ts` are the most likely candidates for this — not individually inspected
line-by-line beyond the compiler's own error list above, per the no-test-edit rule.

---

## Validation gate — all green

```
Apps/contract: npx tsc --noEmit ✓ (0 errors)          npm run lint ✓ (0 problems)
               git diff --stat: 1 file, comment-only, +4/-1 lines (sales.events.ts)

Apps/api:      npx prisma validate ✓ ("the schema at prisma/schema.prisma is valid") — unchanged
               schema, sanity check only.
               npx tsc --noEmit — src/** is 0 errors (confirmed by filtering error-header lines
               to paths outside test/, and by diffing the full pre/post output for the
               comment-only clients.routes.ts fix: identical). Every remaining error is inside
               test/**, itemized above.
               npm run lint — 6 pre-existing errors (prisma/seed.ts ×3,
               validate-request.middleware.ts ×3), both files untouched this session — identical
               to the S1/S4 baseline.

Apps/web:      npx tsc --noEmit ✓ (0 errors) — spot-checked since it consumes @dragon-telecom/
               contract; confirms the comment-only contract change has zero frontend ripple, as
               the plan's §2 ripple table predicted ("frontend: none").
```

No test file was edited. No test suite was run.

---

## Handoffs recorded (plan §3)

1. **S6** — the POS receipt's "previous and new credit" now come from a two-step credit movement
   (`applyDocumentCharge` then `applyLedgerPayment`); `Sale.previousCredit`/`newCredit` still
   bracket the whole sale exactly as before, so the receipt UI needs no new field.
2. **S10** — every primitive order completion needs already exists. The one line to change is
   `orders.service.ts`'s `applyDocumentCharge` call — give it a real `creditDelta` and move it
   (plus a `captureClientPaymentInTx` call and a switch to `issueInvoiceInTx`) from `confirmOrder`
   to the `COMPLETED` transition.
3. **S12** — a return now produces a negative `ClientPayment` row whenever cash came back; the
   Returns tab can read refunds straight from the ledger instead of deriving them.
4. **S13** — `captureClientPaymentInTx` already accepts a null `invoiceId`, exactly for repair
   payments taken before pickup (the "on account" case D5 names).
5. **S14** — `PosClient.credit` is unchanged for a sale in isolation but now genuinely falls on a
   **full** return, and `totalSold` falls on every return, partial or full. Statistics aggregates
   `PosClient.credit` (`statistics.service.ts:40`) and should be re-checked against this when S14
   is planned.
6. **Billing's listener is one step from empty.** Once S10 moves order issuance the same way sales'
   confirm now works, `billing.listener.ts` has nothing left to subscribe to and should be deleted
   outright — exactly as `sales.listener.ts` was deleted in S1.

---

## Manual verification checklist

The owner performs these in the browser, with a database query where stated. No automated test
runs. Pick a POS client and note its `credit`, `totalPaid`, `totalSold` before each scenario:
```sql
SELECT name, credit, "totalPaid", "totalSold" FROM "PosClient" WHERE id = '…';
```

**A POS sale that is paid in full**
1. `/admin/pos` — sell 1000 DZD to a known client, paid 1000. Receipt prints as before.
2. `credit` unchanged, `totalSold` +1000, `totalPaid` +1000.
3. `SELECT reference, "invoiceId", amount, "previousCredit", "newCredit" FROM "ClientPayment" ORDER BY "paidAt" DESC LIMIT 1;`
   — one new row, amount 1000, **`invoiceId` not null**.
4. The invoice exists and reads **PAID**: `/admin/invoices` → outgoing. Its paid amount is 1000.
5. `/admin/clients/:id` → the client's totals match step 2.

**A POS sale part-paid (the credit path)**
6. Sell 1000, paid 300, to the same client. Receipt shows previous credit → new credit rising by
   **700**, not 1300 and not −400.
7. `credit` +700, `totalSold` +1000, `totalPaid` +300. A ledger row of **300** exists, linked to
   the invoice.
8. The invoice reads **PARTIALLY_PAID** with paid amount 300.

**A POS sale wholly on credit**
9. Sell 1000, paid 0. `credit` +1000, `totalSold` +1000, `totalPaid` **unchanged**, and **no new
   `ClientPayment` row** (D5 — only a captured payment creates one).
10. The invoice reads **ISSUED** with paid amount 0.

**A walk-in sale (no client)**
11. Sell 500 with no client attached, paid 500. It still completes, an invoice is issued to
    "Walk-in Customer" with paid amount **500**, and **no `ClientPayment` row is created**
    (D5's explicit exception).
12. No `PosClient` figure anywhere moved.

**Atomicity — the invoice is now part of the sale**
13. Sell a product whose stock is insufficient (force the 409). The sale stays **DRAFT**, and
    `SELECT count(*) FROM "Invoice" WHERE "sourceId" = '<saleId>';` returns **0** — previously the
    invoice could be issued by the listener even when the sale had rolled back.
14. `/admin/logs` — a completed POS sale for a known client now narrates **both** a sale entry and
    a payment entry.

**A separate payment recorded later**
15. `/admin/invoices` → the ISSUED invoice from step 9 → record a payment of 400. `credit` −400,
    `totalPaid` +400, `totalSold` unchanged; the invoice moves to PARTIALLY_PAID.
16. This is the path that existed before S5 — confirm it behaves exactly as it used to.

**Returns — the four cases from the arithmetic table above**
17. **Partial return of a fully-paid sale** (step 1's sale, return 400): `totalSold` −400,
    `totalPaid` −400, `credit` **unchanged**. A **negative** `ClientPayment` row of −400 exists
    against that invoice, and the invoice falls back to PARTIALLY_PAID.
18. **Full return of a part-paid sale** (step 6's sale, return everything): `totalSold` −1000,
    `totalPaid` −300 (**capped at the cash actually taken, not −1000**), `credit` −700. Net across
    sale + return: all three figures return to where they started.
19. **Partial return of a credit sale** (step 9's sale, return 400): `totalSold` −400, `totalPaid`
    **unchanged and never negative**, `credit` **unchanged — the client still owes 1000**. This is
    D7 as specified; confirm you are content with it.
20. **Full return of that credit sale**: `credit` −1000 → the client owes nothing, `totalSold` back
    to its starting value, `totalPaid` untouched throughout.
21. After every return above: `SELECT SUM(amount) FROM "ClientPayment" WHERE "posClientId" = '…';`
    equals that client's **`totalPaid`** exactly. This is D5/D6's core invariant — check it once at
    the very end, after all of the above.

**Nothing else moved**
22. Place and confirm an **order** for a client: `totalSold` rises at confirm and an invoice is
    issued, exactly as before this set (S10 changes this, not S5).
23. Take a repair to `PICKED_UP`: still nothing happens (S1's recorded regression, closed by S13).
24. `/admin/statistics` loads; the outstanding-credit figure reflects the credit movements above.

---

The owner reviews and approves before S6 begins.
