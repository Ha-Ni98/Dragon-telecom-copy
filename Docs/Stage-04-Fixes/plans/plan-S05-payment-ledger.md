# Plan S5 — Payment Ledger as the Source of Truth

*Backend only. No contract schema change, no Prisma schema change, no migration, no frontend file.
Implements **D5**, **D6**, **D7**.*

This set reworks money arithmetic on paths that were **deliberately serialized** by the
credit-serialization fix (`Docs/Stage-02-Backend/results/report-credit-serialization.md`). Every
rule that report established still holds: every cache write happens **inside the owning
transaction, on a locked row, never from an event listener**. This plan does not relax that — it
splits one locked write into two locked writes in the same transaction.

---

## 0. Before you start

### 0.1 Sets that must land first

**S1** only, and it is executed and reported (`results/report-S01.md`). What S5 inherits from it:

- `Sale.origin` and the `SaleOrigin` enum are **gone**; `sales.listener.ts` was **deleted**;
  `recordRepairSale` was **deleted**. Every `sale.confirmed` emission is a POS sale by
  construction — do not write code that re-checks an origin.
- `InvoiceSource.REPAIR` exists and `Repair.invoiceId` replaced `Repair.saleId`, but **a repair
  pickup currently does nothing at all** (S1's recorded regression, closed by S13). There is
  therefore no repair money path for S5 to rewire — see Action 10.

S2/S3/S4 are frontend sets and are irrelevant here. **S5 blocks S6, S10, S12 and S13.**

### 0.2 Owner decisions taken this session — settled, do not re-open

Four questions were asked and answered before this plan was written. The brief's own wording is
internally inconsistent on **R1**; the owner's answer governs.

| # | Question | Owner's answer |
|---|---|---|
| **R1** | The brief says the sale side applies `credit += (total − paid)` **and** the payment side applies `credit −= amount`. Composed that is `total − 2×paid`, not today's `total − paid`. Which split? | **The sale charges the full total.** `credit += total` on the document side, `credit −= amount` on the ledger side. Composed = `credit += (total − paid)` — bit-for-bit today's result. `applyLedgerPayment` stays one uniform method for POS, later payments, orders and repairs. |
| **R2** | A POS sale's invoice is issued today by a **post-commit listener** on `sale.confirmed`, outside the confirm transaction — so a payment row created in that transaction has no invoice to link to. Move issuance in? | **Yes — move it into the confirm transaction** via an injected billing port (the `IInventoryService` precedent). Billing's `sale.confirmed` subscription is deleted; `order.confirmed` stays until S10. This is the same shape S10 and S13 need, so it is built once, here. |
| **R3** | D7 says a partial return lowers `totalPaid` by the refund — but on a credit sale (paid = 0) nothing was ever paid, so that invents cash and drives `totalPaid` negative. | **Cap the cash refund at what was actually paid** on that sale, minus cash already refunded for it. The remainder reduces `totalSold` and, on a full return, is covered by the credit reversal. `totalPaid` can never go negative from a return. |
| **R4** | The brief says order completion and repair pickup "follow the same shape", but S10 hasn't moved order money to `COMPLETED` and a repair pickup is inert since S1. | **Ship the primitives now; the callers land in S10/S13.** S5 rewires only what exists today: **POS sale confirm** and **returns**. Orders keep confirm-time behavior; repair pickup stays inert. Nothing gets written twice. |

### 0.3 Findings from reading the code — read before acting

**F1 — the current port, verbatim** (`Apps/api/src/modules/clients/clients.service.ts:421–475`).
Four methods, all locking via one private `lockPosClient` (`SELECT … FOR UPDATE`, line 484):

| Method | Writes today |
|---|---|
| `applySaleCharge(tx, id, {totalAmount, paidAmount})` | `credit = prev + (total − paid)`, `totalPaid += paid`, `totalSold += total` |
| `applyPayment(tx, id, {amount})` | `credit = prev − amount`, `totalPaid += amount` |
| `applyOrderSold(tx, id, {totalAmount})` | `totalSold += total` only |
| `applyReturnRefund(tx, id, {creditEffect})` | `credit = prev + creditEffect` only |

`applySaleCharge` is the combined call R1 splits. `applyReturnRefund` is what D7 replaces.

**F2 — the four call sites** (there are exactly four; verified by grep):
`sales.service.ts:122` (`applySaleCharge`), `sales.service.ts:300` (`applyReturnRefund`),
`billing.service.ts:146` (`applyPayment`), `orders.service.ts:256` (`applyOrderSold`).

**F3 — the port is declared three times, narrowed per consumer.** There is no shared interface —
each consumer declares its own local `IClientCreditPort` and `ClientsService` satisfies it
structurally (the documented `ICatalogCartPort` convention). All three must be updated in step:
- `sales.interface.ts:46–57` — declares `applySaleCharge` + `applyReturnRefund`
- `billing.interface.ts:65–71` — declares `applyPayment`
- `orders.interface.ts:49` — declares `applyOrderSold`

**F4 — invoice issuance is post-commit and re-reads the sale.** `billing.listener.ts:14`
subscribes `sale.confirmed` → `issueFromSale` (`billing.service.ts:226`), which re-reads the sale
with its lines and calls the private `issueInvoice` (line 320) — which opens **its own second
transaction**, allocates the `INVOICE` sequence number, creates the row, and emits
`invoice.issued` afterwards. It swallows `P2002` on `@@unique(sourceType, sourceId)` as a
replay no-op. When this moves in-transaction (R2), **do not carry the P2002 swallow into the sale
path**: `confirm()` is already guarded by `status === DRAFT`, so a duplicate issuance there is a
real bug, not a replay — let it throw and roll the sale back.

**F5 — `createClientPayment` already does exactly what the new shared primitive must do**
(`billing.service.ts:126–198`): resolve the invoice, open a transaction, `applyPayment`, allocate
the `CLIENT_PAYMENT` sequence, create the `ClientPayment` row, then recompute the invoice's
`paidAmount`/`status` from `Σ ClientPayment.amount` (skipping a `CANCELLED` invoice), then emit
`payment.clientRecorded` post-commit. Action 2 **extracts this body** into an in-transaction
method the sale path can also call — it is not new logic, it is the same logic made reusable.

**F6 — the "fully returned" test already exists.** `sales.service.ts:286`:
```ts
const allFullyReturned = sale.lines.every((line) => (cumulativeReturned.get(line.id) ?? 0) >= line.quantity);
```
It already drives the `RETURNED` vs `PARTIALLY_RETURNED` status write. D7's full-return credit
reversal must reuse **this same boolean** — do not compute a second, subtly different one. It
fires exactly once per sale: a sale already in `RETURNED` is rejected by the guard at line 215.

**F7 — the `payment.clientRecorded` consumers are both safe under a new emitter.**
- `orders.listener.ts:12` → `orders.service.ts:424` mirrors `Order.paidAmount`, but returns early
  unless the invoice's `sourceType === ORDER` (line 431). A POS-sale payment emission is a
  **no-op** there. Verified, not assumed.
- `observability.listener.ts:346` narrates it into an `AuditLog` row. A POS sale will now produce
  a payment narration in addition to its sale narration — intended, and the reason sales must
  still emit the event post-commit (Action 6f).

**F8 — no import cycle is created by sales → billing.** `billing.routes.ts` imports only
`platform` and `clients`; nothing in billing imports sales (its coupling to sales is via the event
bus, which is not an import). `billing.routes.ts` must export its service singleton the same way
`clients.routes.ts` already exports `clientsService`.

**F9 — `PosClient.totalPaid` has exactly two readers**, both mappers that surface it to the client
UI: `clients.mapper.ts:73` (`AdminClientDto`) and `clients.mapper.ts:113` (`PosClientDto`).
Nothing computes anything from it. `statistics.service.ts:40` aggregates `PosClient.credit` only.
So this set's redefinition of *how* `totalPaid` is written cannot silently drift a report.

**F10 — `SalesMapper.toReceiptDto`'s `totalPaid` is not this field.** `sales.mapper.ts:97` maps
`totalPaid: sale.paidAmount` — the sale document's own paid figure, unrelated to
`PosClient.totalPaid`. Do not touch it.

### 0.4 Standing rules for this set

- **Every cache write stays inside the caller's transaction, on a row locked by
  `lockPosClient`.** No new listener may write `credit`, `totalPaid`, `totalSold` or
  `Invoice.paidAmount`. Re-read `report-credit-serialization.md` §C5's closing sweep if tempted.
- **Locking the same `PosClient` row twice in one transaction is safe and expected**
  (`SELECT … FOR UPDATE` is re-entrant within a transaction). The sale path deliberately locks it
  once per primitive call — do not "optimise" the two calls into one.
- **Sequence allocation order inside a single transaction must be `SALE → INVOICE →
  CLIENT_PAYMENT`**, always. `SequenceService.nextNumber` locks a counter row per `DocType`; a
  consistent global order across modules is what keeps two concurrent transactions from
  deadlocking on each other's counters.
- **No test file may be edited and no test suite may be run.** Validation is `tsc --noEmit` and
  lint on `Apps/contract` and `Apps/api`.
- **Read the comment above every line you change.** Several comments in these files narrate the
  credit-serialization design explicitly and become wrong here — each is named in its action.
- No user-facing text is added by this set, so **no translation key is involved**.

### 0.5 The arithmetic proof (required by the brief)

The brief demands: *"The composed result must equal the previous single-call arithmetic; state
that reasoning in the plan."* Here it is, per field, for a POS sale of total **T** paid **P** by a
client whose credit is **C₀**.

| Field | Today (one `applySaleCharge` call) | After S5 (`applyDocumentCharge` then `applyLedgerPayment`) | Equal? |
|---|---|---|---|
| `credit` | `C₀ + (T − P)` | `C₀ + T` then `− P` → `C₀ + T − P` | **yes** |
| `totalSold` | `+= T` | `+= T` (document side), ledger side never touches it | **yes** |
| `totalPaid` | `+= P` (document side) | document side no longer writes it; ledger side `+= P` | **yes**, and now D5-compliant |
| `Sale.previousCredit` | `C₀` | `C₀` (the document call's `previousCredit`) | **yes** |
| `Sale.newCredit` | `C₀ + T − P` | the ledger call's `newCredit`, or the document call's when no payment was captured | **yes** |

What genuinely changes, by design:

1. A `ClientPayment` row now exists for every POS sale that took money from a known client — that
   is D5's whole point, and it is what makes `totalPaid = Σ ledger.amount` true by construction.
2. `ClientPayment.previousCredit/newCredit` for that row records `C₀ + T → C₀ + T − P` (the
   balance the payment was applied against, which already includes this sale). This is the
   intended reading under R1.
3. `Invoice.paidAmount` for a known client is now written by the ledger recompute rather than
   stamped at issuance. Same final number; single writer.

**Walk-in (no `posClientId`) is the explicit exception** (D5): no `PosClient` row exists, so no
ledger row is possible. The invoice carries `paidAmount = cmd.paidAmount` directly and the sale's
own `paidAmount` is the record. Both branches are spelled out in Action 6.

---

## 1. Actions

Execute in order. 1–5 build the primitives and wiring; 6–8 are the two behavioral rewrites; 9–12
are handoffs, sweeps and the gate.

---

### Action 1 — Clients: split the credit port into two orthogonal primitives

**File:** `Apps/api/src/modules/clients/clients.service.ts` (the block at lines 409–475)

**1a. Replace `applySaleCharge` with `applyDocumentCharge`.** Delete `applySaleCharge` entirely.

```ts
  // A document (sale, and from S10/S13 an order or repair) charging the account. The full
  // document total goes onto `credit`; any money taken at the same moment is a *separate*
  // ledger call (applyLedgerPayment) in the same transaction — D5/R1. Composed, the two calls
  // reproduce the old single applySaleCharge arithmetic exactly (see plan S5 §0.5).
  // `totalSoldDelta` and `creditDelta` are caller-signed so returns can pass negatives.
  // This method never touches totalPaid — the ledger owns that field, and only the ledger.
  async applyDocumentCharge(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { totalSoldDelta: number; creditDelta: number },
  ): Promise<{ previousCredit: number; newCredit: number }> {
    const locked = await this.lockPosClient(tx, posClientId);
    const previousCredit = locked.credit.toNumber();
    const newCredit = previousCredit + payload.creditDelta;
    await tx.posClient.update({
      where: { id: posClientId },
      data: { credit: newCredit, totalSold: { increment: payload.totalSoldDelta } },
    });
    return { previousCredit, newCredit };
  }
```

**1b. Rename `applyPayment` → `applyLedgerPayment`** and widen its contract to signed amounts. The
body is unchanged apart from the name; only the comment grows:

```ts
  // The ledger primitive — the ONLY writer of PosClient.totalPaid anywhere in the codebase (D5).
  // Always paired with exactly one ClientPayment row created in the same transaction, of the same
  // amount, so `totalPaid = Σ ClientPayment.amount` holds by construction.
  // `amount` is signed: a positive amount is money received (credit down, totalPaid up); a
  // NEGATIVE amount is a refund (credit up, totalPaid down) and is how D6's negative-amount
  // refund rows are applied. Overpayment is permitted — a negative newCredit means the store owes
  // the client, mirroring purchasing's own overpayment-allowed convention.
  async applyLedgerPayment(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { amount: number },
  ): Promise<{ previousCredit: number; newCredit: number }> {
```

**1c. Delete `applyReturnRefund` entirely.** Returns now compose `applyLedgerPayment` +
`applyDocumentCharge` (Action 8); a bespoke refund method would be a third way to write `credit`.

**1d. Delete `applyOrderSold`.** It is `applyDocumentCharge({ totalSoldDelta: total, creditDelta:
0 })` exactly — same two fields, same lock, identical arithmetic. Orders' call site is migrated in
Action 5c. **This is a mechanical substitution with zero behavioral change**; S10 still owns
moving order money from confirm to `COMPLETED`.

**1e.** Rewrite the block comment at lines 409–419. It currently says the numbers "replicate
exactly what the former post-commit listener handlers computed (do not diverge the math when those
handlers are deleted in C3–C5)". That framing is now one generation stale. Replace with: the port
is two orthogonal primitives — `applyDocumentCharge` (credit + totalSold) and `applyLedgerPayment`
(credit + totalPaid) — that compose to the pre-S5 arithmetic, cite plan S5 §0.5, and keep the
existing "every method locks the row for the duration of the CALLER's transaction" sentence
verbatim.

`lockPosClient` (line 484) is **unchanged**.

---

### Action 2 — Billing: extract the two in-transaction primitives

**File:** `Apps/api/src/modules/billing/billing.service.ts`

**2a. New public method `issueInvoiceInTx`.** It does what the private `issueInvoice` (line 320)
does, minus the transaction and minus the event — the caller owns both:

```ts
  // In-transaction invoice issuance (S5/R2) — the caller's own transaction issues the invoice, so
  // a ClientPayment row created in that same transaction can carry a real invoiceId. Returns the
  // ids the caller needs to emit `invoice.issued` AFTER its transaction commits; this method must
  // never emit (a listener reacting to an event whose transaction has not committed would read
  // rows that do not exist yet).
  // No P2002 swallow here, unlike the post-commit issueInvoice path: every caller of this method
  // is guarded against double-issuance by its own document status check, so a unique-violation on
  // @@unique(sourceType, sourceId) is a genuine bug and must roll the caller's transaction back.
  async issueInvoiceInTx(
    tx: Prisma.TransactionClient,
    input: InvoiceIssueRequest,
  ): Promise<{ invoiceId: string; number: string }> {
    const snapshot = input.posClientId != null ? await this.resolvePosClientSnapshot(input.posClientId) : {};
    const number = await this.sequence.nextNumber(tx, DocType.INVOICE);
    const invoice = await tx.invoice.create({
      data: BillingMapper.toInvoicePersistence({
        ...input,
        number,
        clientNameSnapshot: snapshot.name ?? 'Walk-in Customer',
        ...(snapshot.address != null ? { clientAddressSnapshot: snapshot.address } : {}),
      }),
    });
    return { invoiceId: invoice.id, number };
  }
```

`InvoiceIssueRequest` is a **new backend-side type** exported from `billing.interface.ts`
(Action 3a) — `Omit<InvoiceIssueInput, 'number' | 'clientNameSnapshot' | 'clientAddressSnapshot'>`,
i.e. the caller supplies the domain facts and billing owns the client-name snapshot. Check
`billing.mapper.ts`'s `InvoiceIssueInput` for the exact field list before writing this; do not
retype it by hand.

`resolvePosClientSnapshot` already exists in this service (used by `issueFromSale`/`issueFromOrder`)
— reuse it, do not duplicate.

**2b. New public method `captureClientPaymentInTx`.** Move the body of `createClientPayment`'s
transaction (lines 141–186) into it, unchanged in substance:

```ts
  // The single ledger-capture primitive (D5/D6) — creates one ClientPayment row, applies it to the
  // PosClient's totalPaid/credit through the injected clients port, and recomputes the targeted
  // invoice's paidAmount/status from the ledger. Callers: this module's own createClientPayment
  // (the admin/staff endpoint), sales' confirm and createReturn (S5), orders' completion (S10) and
  // repairs' pickup (S13).
  // `invoiceId` is optional on purpose: money can be captured before an invoice exists — a repair
  // collects payments across several steps while its invoice only appears at PICKED_UP (D5) — and
  // such rows are "on account" (ClientPayment.invoiceId null), still counted in totalPaid.
  // `amount` is signed; a negative amount is a refund row (D6).
  // Returns everything the caller needs to emit `payment.clientRecorded` after IT commits.
  async captureClientPaymentInTx(
    tx: Prisma.TransactionClient,
    input: { posClientId: string; invoiceId?: string; amount: number; paidAt?: Date; staffId: string },
  ): Promise<{ paymentId: string; reference: string; previousCredit: number; newCredit: number }> {
```

Body, in order — this is the existing code, re-homed:
1. `const { previousCredit, newCredit } = await this.clientCredit.applyLedgerPayment(tx, input.posClientId, { amount: input.amount });`
2. `const reference = await this.sequence.nextNumber(tx, DocType.CLIENT_PAYMENT);`
3. `tx.clientPayment.create({ data: { reference, posClientId, ...(invoiceId != null ? { invoiceId } : {}), amount, previousCredit, newCredit, ...(paidAt != null ? { paidAt } : {}), staffId } })`
4. The invoice recompute, **guard order preserved exactly** (status-check *before* aggregating, so
   a `CANCELLED` invoice's ledger is never even summed): read `totalAmount`/`status`; if not
   `CANCELLED`, aggregate `Σ ClientPayment.amount` for that `invoiceId`, then write `paidAmount`
   plus the status ladder `paidAmount <= 0 ? ISSUED : paidAmount >= totalAmount ? PAID :
   PARTIALLY_PAID`.
5. Return `{ paymentId, reference, previousCredit, newCredit }`.

**Note for the executor:** step 4's ladder now also runs for refund rows, so a fully-refunded
invoice correctly walks `PAID → PARTIALLY_PAID → ISSUED` as its ledger sum falls. That is the
intended D6 consequence of "totalPaid = Σ amount" — no extra branch is needed.

**2c. Rewrite `createClientPayment` as a thin wrapper** over 2b. It keeps: the `invoiceNumber` →
`invoiceId` resolution and both `BadRequestError`s (lines 127–136), its own `$transaction`, the
post-commit `payment.clientRecorded` emission, and the `BillingMapper.toClientPaymentDto` return.
Everything between becomes one `captureClientPaymentInTx` call. It must re-read the created row
with `PAYMENT_INCLUDE` for the DTO (the primitive returns ids, not the included row) — do that
inside the same transaction, after the capture call.

**2d.** `issueFromSale` (line 226) is **deleted** — Action 7 removes its only caller.
`issueFromOrder` (line 262) and the private `issueInvoice` (line 320) **stay**: orders still issue
post-commit until S10.

---

### Action 3 — Billing: interface and composition-root export

**File:** `Apps/api/src/modules/billing/billing.interface.ts`

**3a.** Export the new request type used by `issueInvoiceInTx` (single-side backend type, so it
belongs here, not in the contract):

```ts
// The caller-supplied half of an invoice issuance — billing itself owns the client-name/address
// snapshot, so those fields are deliberately absent. Backend-internal (never crosses the wire).
export type InvoiceIssueRequest = Omit<InvoiceIssueInput, 'number' | 'clientNameSnapshot' | 'clientAddressSnapshot'>;
```
Import `InvoiceIssueInput` from `./billing.mapper`.

**3b.** In `IBillingService`: **remove** `issueFromSale`; **add** `issueInvoiceInTx` and
`captureClientPaymentInTx` with the signatures from Action 2. Update the section comment at
line 44 — "invoked only by this module's own listener (post-commit), never by HTTP routes" is now
true of `issueFromOrder` alone; the two new methods are invoked by **sibling modules inside their
own transactions**.

**3c.** In this file's local `IClientCreditPort` (line 65): rename `applyPayment` →
`applyLedgerPayment`.

**File:** `Apps/api/src/modules/billing/billing.routes.ts`

**3d.** Export the singleton for sales to inject, mirroring `clients.routes.ts`'s precedent
exactly:

```ts
// Exported singleton for downstream in-transaction consumers (sales' confirm/createReturn, S5;
// orders' completion, S10; repairs' pickup, S13) — they call issueInvoiceInTx /
// captureClientPaymentInTx inside their own transaction. One-directional: billing imports
// platform and clients, never sales/orders/repairs, so no cycle is possible.
export const billingService = service;
```

---

### Action 4 — Sales: declare the ports it now needs

**File:** `Apps/api/src/modules/sales/sales.interface.ts`

**4a.** Replace the two methods on the local `IClientCreditPort` (lines 46–57) with the two new
primitives:

```ts
export interface IClientCreditPort {
  applyDocumentCharge(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { totalSoldDelta: number; creditDelta: number },
  ): Promise<{ previousCredit: number; newCredit: number }>;
  applyLedgerPayment(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { amount: number },
  ): Promise<{ previousCredit: number; newCredit: number }>;
}
```

**4b.** Add a new local port for billing, with the same narrowing convention and comment style as
`ICatalogPosPricingPort` above it:

```ts
// Injected port (dependency inversion, S5/R2) — real implementation is billing's own
// composition-root singleton (`billingService`, exported from billing.routes.ts), assembled
// directly in sales.routes.ts. Invoice and ClientPayment belong to the billing module; sales must
// create them only through this port, always inside its own transaction (`tx`), never by writing
// tx.invoice/tx.clientPayment directly and never via a post-commit listener.
export interface IBillingIssuePort {
  issueInvoiceInTx(
    tx: Prisma.TransactionClient,
    input: InvoiceIssueRequest,
  ): Promise<{ invoiceId: string; number: string }>;
  captureClientPaymentInTx(
    tx: Prisma.TransactionClient,
    input: { posClientId: string; invoiceId?: string; amount: number; staffId: string },
  ): Promise<{ paymentId: string; reference: string; previousCredit: number; newCredit: number }>;
}
```
Import `InvoiceIssueRequest` from `../billing/billing.interface`.

---

### Action 5 — Wire the new dependencies

**5a. `Apps/api/src/modules/sales/sales.routes.ts`** — import `billingService` from
`../billing/billing.routes` and pass it as a sixth constructor argument to `new SalesService(...)`
(line 33). Extend the import-block comment (lines 17–22) to name billing as a one-directional
dependency satisfying `IBillingIssuePort` structurally.

**5b. `Apps/api/src/modules/sales/sales.service.ts`** — add `private billing: IBillingIssuePort`
as the sixth constructor parameter (after `clientCredit`), and add `IBillingIssuePort` to the
type-only import from `./sales.interface`.

**5c. Orders — the mechanical `applyOrderSold` migration (Action 1d).** Two edits, **arithmetic
unchanged**:
- `Apps/api/src/modules/orders/orders.interface.ts:49` — replace the `applyOrderSold` declaration
  with `applyDocumentCharge` (same signature as Action 4a).
- `Apps/api/src/modules/orders/orders.service.ts:256` — replace
  `applyOrderSold(tx, posClientId, { totalAmount: existing.totalAmount.toNumber() })` with
  `applyDocumentCharge(tx, posClientId, { totalSoldDelta: existing.totalAmount.toNumber(), creditDelta: 0 })`.
  Keep the surrounding comment's meaning ("orders never touch credit") and add: *"`creditDelta: 0`
  is that rule made explicit — S10 moves this call from confirm to COMPLETED and gives it a real
  credit delta."*

---

### Action 6 — Sale confirm: the new transaction body

**File:** `Apps/api/src/modules/sales/sales.service.ts`, method `confirm` (lines 79–190)

Everything **before** the transaction (lines 80–114: the DRAFT guard, the subtotal/total
computation, the `CREDIT_REQUIRES_CLIENT` gate, the POS price resolution) is **unchanged**. So is
the FIFO consumption loop. What changes is the order and content of the writes inside the
transaction, plus what is emitted afterwards.

Declare alongside the existing `let` block (lines 108–114): `let invoiceNumber = ''`,
`let capturedPayment: { paymentId: string; previousCredit: number; newCredit: number } | undefined`.

**The transaction body, in this exact order:**

**6a — charge the document.** Replace the `applySaleCharge` call (lines 119–131):

```ts
      if (existing.posClientId != null) {
        // The full sale total goes onto the account here; the money taken is applied separately
        // by the ledger call in 6e — D5/R1, composed to the pre-S5 arithmetic (plan S5 §0.5).
        ({ previousCredit, newCredit } = await this.clientCredit.applyDocumentCharge(tx, existing.posClientId, {
          totalSoldDelta: totalAmount,
          creditDelta: totalAmount,
        }));
      } else {
        // Walk-in: no PosClient row exists, so no credit and no ledger row are possible (D5). The
        // CREDIT_REQUIRES_CLIENT guard above already forces paidAmount >= totalAmount here, so the
        // receipt's own previousCredit/newCredit stay 0 → 0; the Sale row's paidAmount is the only
        // record that money changed hands.
        newCredit = previousCredit + (totalAmount - cmd.paidAmount);
      }
```

**6b — the FIFO loop.** Unchanged (lines 133–149).

**6c — allocate the sale reference.** Unchanged (`this.sequence.nextNumber(tx, DocType.SALE)`).
It must stay **before** the invoice call to preserve the `SALE → INVOICE → CLIENT_PAYMENT`
allocation order (§0.4).

**6d — issue the invoice in-transaction.** New. Build the `InvoiceIssueRequest` from data already
in memory — do **not** re-read the sale:

```ts
      const { invoiceId, number } = await this.billing.issueInvoiceInTx(tx, {
        ...(existing.posClientId != null ? { posClientId: existing.posClientId } : {}),
        sourceType: InvoiceSource.SALE,
        sourceId: existing.id,
        totalAmount,
        // A known client's invoice is paid through the ledger (6e), which recomputes this field
        // from Σ ClientPayment.amount; issuing at 0 keeps the ledger the single writer. A walk-in
        // has no ledger, so its invoice carries the captured amount directly (D5).
        paidAmount: existing.posClientId != null ? 0 : cmd.paidAmount,
        previousCredit,
        newCredit: previousCredit + (totalAmount - cmd.paidAmount),
        totalCost,
        totalProfit,
        staffId: actingStaffId,
        lines: existing.lines.map((line) => ({ /* same mapping issueFromSale used — label,
          quantity, unitPrice, costSnapshot, profit, lineTotal, serialNumbers? */ })),
      });
      invoiceNumber = number;
```
Copy the `lines` mapping verbatim from the deleted `issueFromSale` (`billing.service.ts:243–251`),
but read `costOfGoods`/`profit` from the values the FIFO loop just computed per line rather than
from the stale `existing.lines` snapshot — the loop already writes them to `tx.saleLine`; keep a
local `Map<lineId, {costOfGoods, profit}>` as you go and read it here.

**6e — capture the payment.** New:

```ts
      if (existing.posClientId != null && cmd.paidAmount > 0) {
        const captured = await this.billing.captureClientPaymentInTx(tx, {
          posClientId: existing.posClientId,
          invoiceId,
          amount: cmd.paidAmount,
          staffId: actingStaffId,
        });
        capturedPayment = captured;
        newCredit = captured.newCredit; // the post-payment balance is the receipt's newCredit
      }
```
`previousCredit` keeps the value 6a returned (the balance before the whole sale) — that is what
the receipt means by "previous credit".

**6f — write the sale row.** Unchanged fields, but it must now run **last** (it currently runs at
line 153) so `newCredit` reflects the captured payment.

**After the transaction:**

**6g.** `this.inventory.flushEvents(capturedTx!)` — unchanged, stays first.

**6h.** Emit `invoice.issued` — this used to be emitted by billing's `issueInvoice`; sales now
owns the emission because sales owns the transaction:
```ts
    eventBus.emit('invoice.issued', { invoiceNumber, sourceType: InvoiceSource.SALE, sourceReference: reference });
```

**6i.** Emit `sale.confirmed` — payload **unchanged** (billing no longer listens; observability
still does).

**6j.** Emit `payment.clientRecorded` when a payment was captured, so the ledger's audit narration
is identical whichever path created the row:
```ts
    if (capturedPayment != null && existing.posClientId != null) {
      eventBus.emit('payment.clientRecorded', {
        paymentId: capturedPayment.paymentId,
        posClientId: existing.posClientId,
        invoiceNumber,
        amount: cmd.paidAmount,
        previousCredit: capturedPayment.previousCredit,
        newCredit: capturedPayment.newCredit,
      });
    }
```
(F7 confirms orders' mirror no-ops on a SALE-sourced invoice and observability narrates it.)

**6k.** Update the method's own doc comment (lines 77–78) and the in-body comment at lines 120–121
("no post-commit listener applies it") — still true of credit, and now also true of the invoice and
the payment row. State that the sale, its invoice and its payment row are one atomic unit.

---

### Action 7 — Billing listener: stop issuing on `sale.confirmed`

**File:** `Apps/api/src/modules/billing/billing.listener.ts`

Delete the `sale.confirmed` subscription (line 14). Keep `order.confirmed` (line 15) exactly as
is. Rewrite the header comment (lines 5–7): this listener now issues invoices for **orders only**;
sale invoices are issued inside sales' own confirm transaction (S5/R2), and S10 will move the
order path the same way — at which point this listener has nothing left to subscribe to and should
be deleted outright, exactly as `sales.listener.ts` was in S1.

---

### Action 8 — Returns: D6 and D7 semantics

**File:** `Apps/api/src/modules/sales/sales.service.ts`, method `createReturn` (lines 212–316)

Everything before the transaction (the eligibility guard, the per-line over-return validation, the
`refundAmount` sum) is **unchanged**, as are the `Return` row creation, the restock loop, the
cumulative-returned computation and the sale status write.

**8a.** Before the transaction, resolve the sale's invoice and how much cash is still refundable
(R3). This is a plain read, independent of anything the transaction computes:

```ts
    // R3 — the cash a return can give back is capped by what was actually collected on this sale,
    // minus cash already refunded for it. The ledger is the source of truth for both: the sale's
    // own payment row(s) and any earlier refund rows all hang off this sale's invoice.
    // Without the cap, refunding a sale taken on credit would invent cash that never moved and
    // drive PosClient.totalPaid negative.
    const invoice = await this.prisma.invoice.findUnique({
      where: { sourceType_sourceId: { sourceType: PrismaInvoiceSource.SALE, sourceId: sale.id } },
      select: { id: true },
    });
    const refundedSoFar = invoice
      ? Math.abs(
          (
            await this.prisma.clientPayment.aggregate({
              where: { invoiceId: invoice.id, amount: { lt: 0 } },
              _sum: { amount: true },
            })
          )._sum.amount?.toNumber() ?? 0,
        )
      : 0;
    const cashRefundable = Math.max(0, sale.paidAmount.toNumber() - refundedSoFar);
    const cashRefunded = Math.min(refundAmount, cashRefundable);
```
Verify the exact compound-unique argument name for `@@unique([sourceType, sourceId])` in the
generated client before writing it (`sourceType_sourceId` is the Prisma default).

**8b.** Replace the whole `if (sale.posClientId != null)` block (lines 293–301) with the composed
form. Keep it in the same position — after the sale status write, still inside the transaction:

```ts
      if (sale.posClientId != null) {
        // D6 — the refund is a NEGATIVE-amount ClientPayment row, so totalPaid stays Σ ledger by
        // construction. It also recomputes the invoice's paidAmount/status downward.
        // Skipped entirely when no cash is refundable (a sale taken wholly on credit): there is no
        // payment to reverse, and a zero-amount ledger row would be noise.
        if (cashRefunded > 0 && invoice != null) {
          const captured = await this.billing.captureClientPaymentInTx(tx, {
            posClientId: sale.posClientId,
            invoiceId: invoice.id,
            amount: -cashRefunded,
            staffId,
          });
          refundPayment = captured;
        }

        // D7 — totalSold always falls by the refunded goods. Credit is deliberately left where it
        // was on a PARTIAL return, so the -cashRefunded term below exactly cancels the credit rise
        // the negative ledger row above just applied. A FULL return additionally reverses this
        // sale's own credit delta (newCredit - previousCredit == totalAmount - paidAmount).
        const saleCreditDelta = (sale.newCredit?.toNumber() ?? 0) - (sale.previousCredit?.toNumber() ?? 0);
        creditEffect = -cashRefunded + (allFullyReturned ? -saleCreditDelta : 0);
        await this.clientCredit.applyDocumentCharge(tx, sale.posClientId, {
          totalSoldDelta: -refundAmount,
          creditDelta: creditEffect,
        });
      }
```
`allFullyReturned` is the existing local from line 286 (**F6** — reuse it, do not recompute).
Declare `let refundPayment: { paymentId: string; previousCredit: number; newCredit: number } | undefined`
beside the existing `let creditEffect = 0`.

**8c.** The `return.created` emission (lines 306–312) keeps its shape, but `creditEffect` now
carries the **net** credit delta (0 on a partial return, `−(total − paid)` on a full one) instead
of the old `−refundAmount`. Update the comment above `let creditEffect` (lines 242–245), which
still describes the old "refund reduces what the client owes" semantics — that is precisely what
D7 changed.

**8d.** Emit `payment.clientRecorded` after the transaction when `refundPayment` was created, same
shape as Action 6j (with the negative `amount`), so a refund narrates into the audit log exactly
like any other ledger row.

**8e. Worked examples — put these in the report, and verify each in the browser (checklist §4).**

| Case | Sale | Return | `totalSold` | `totalPaid` | `credit` |
|---|---|---|---|---|---|
| Partial, fully-paid sale | T=1000, P=1000 | R=400 | −400 | −400 | **0** (ledger +400, offset −400) |
| Full, part-paid sale | T=1000, P=300 | R=1000 | −1000 | −300 (capped) | −300 −700 = **−1000** → balance 0 |
| Partial, credit sale | T=1000, P=0 | R=400 | −400 | **0** (nothing to refund) | **0** — the client still owes the full 1000 |
| Full, credit sale | T=1000, P=0 | R=1000 | −1000 | 0 | **−1000** → owes nothing |

**Row 3 is a genuine consequence of D7 as written** ("a partial return lowers `totalSold` and
`totalPaid` only, leaving credit untouched"): a client who returns half of an unpaid sale still
owes the whole amount until the return is complete. D7 is settled, so this plan implements it —
but **call it out in the report** so the owner sees it deliberately rather than discovering it.

---

### Action 9 — Orders and repairs: explicitly out of scope (R4)

**No file changes beyond Action 5c's mechanical rename.** Record in the report:

- **Orders** still charge `totalSold` at *confirm* and still get their invoice from billing's
  post-commit listener. **S10** moves both to `COMPLETED`, converts the `applyDocumentCharge` call
  to carry a real `creditDelta`, captures the completion payment through
  `captureClientPaymentInTx`, and switches issuance to `issueInvoiceInTx`. Every primitive S10
  needs exists after this set.
- **Repairs** remain inert at `PICKED_UP` (S1's recorded regression). **S13** wires pickup to
  `issueInvoiceInTx` (source `REPAIR`) + `captureClientPaymentInTx`, and uses the
  **`invoiceId`-less** capture for payments taken at earlier steps — the "on account" case D5
  names, already supported by Action 2b's optional `invoiceId`.

---

### Action 10 — Contract: verify no change is needed

This set is expected to touch **zero contract files** — the same property the credit-serialization
work held (`report-credit-serialization.md`: *"git diff --stat on Apps/contract: empty"*). Confirm
each of these rather than assuming:

1. `CreateClientPaymentSchema.amount` is `z.number().positive()` — **keep it positive**. The admin
   endpoint must not be able to post a refund; refund rows are created only by `createReturn`
   through the internal primitive.
2. `ClientPaymentResponseSchema.amount` is a plain `z.number()` — negative refund rows already
   serialize. No change.
3. `BillingEvents['payment.clientRecorded']` already carries everything Actions 6j/8d emit. No
   change.
4. `SalesEvents['return.created'].creditEffect` stays `number | undefined`; only its **meaning**
   changed, so update the comment at `sales.events.ts:3–4` (which describes it as the old signed
   refund delta) to say it is the net credit delta after D7 — comment only, no type change.

If any of 1–3 turns out to need a real edit, **stop and report it** rather than widening the
contract silently.

---

### Action 11 — Sweep

Run and report each:

```
# 1. No listener writes a money cache — the credit-serialization invariant.
find Apps/api/src/modules -name "*.listener.ts" | xargs grep -nE "credit|totalPaid|totalSold|totalInvoiced|paidAmount"
#    Expect: comments + observability narration only, exactly as report-credit-serialization.md §C5
#    documents. orders.listener.ts's Order.paidAmount mirror is the one substantive hit and stays.

# 2. The deleted port methods have no callers left.
grep -rn "applySaleCharge\|applyReturnRefund\|applyOrderSold\|applyPayment(" Apps/api/src
#    Expect: zero hits (applyLedgerPayment is the only payment method now).

# 3. Nothing outside billing writes billing's tables.
grep -rn "tx.invoice.create\|tx.clientPayment.create" Apps/api/src
#    Expect: billing.service.ts only.

# 4. PosClient.totalPaid has exactly one writer.
grep -rn "totalPaid" Apps/api/src/modules/clients/clients.service.ts
#    Expect: applyLedgerPayment's update, and nothing else.

# 5. issueFromSale is gone.
grep -rn "issueFromSale" Apps/api/src
#    Expect: zero hits.
```

---

### Action 12 — Stale tests and the validation gate

**12a. Do not edit or run any test.** List every file that references a symbol this set renamed or
deleted, with what is stale in each. Start from:
```
grep -rln "applySaleCharge\|applyReturnRefund\|applyOrderSold\|applyPayment\|issueFromSale" Apps/api/test
```
Expect hits in at least `test/unit/modules/clients/`, `test/unit/modules/sales/`,
`test/unit/modules/billing/`, `test/unit/modules/orders/`, plus the sales/billing/orders/clients
integration specs (which assert on `PosClient.totalPaid` timing and on invoice issuance happening
after the confirm response). Name them individually in the report — several will be **behaviorally**
stale rather than merely uncompilable (a test asserting that no `ClientPayment` row exists after a
POS sale is now asserting the opposite of the intended behavior).

**12b. Validation gate:**
```
Apps/contract: npx tsc --noEmit   &&  npm run lint      # expect no diff at all in this package
Apps/api:      npx prisma validate                      # unchanged schema, sanity only
               npx tsc --noEmit                          # src/** must be clean; test/** errors are
                                                         # the pre-existing S1 fallout + 12a's list
               npm run lint                              # 6 pre-existing errors (seed.ts ×3,
                                                         # validate-request.middleware.ts ×3)
```
Filter api `tsc` output to error headers outside `test/` to judge `src/` cleanliness — the same
technique S4's report used.

**12c.** Write `Docs/Stage-04-Fixes/results/report-S05.md`: what changed per module, the §0.5
arithmetic table restated as *implemented*, Action 8e's four worked examples, the sweep output,
the stale-test list, the gate, and the checklist below.

---

## 2. Ripple summary

| Layer | File | Change |
|---|---|---|
| prisma | — | **none**. No column, no enum, no migration. |
| contract | — | **none** (two comment-only edits, Action 10.4) |
| clients | `clients.service.ts` | port split: `applyDocumentCharge` + `applyLedgerPayment`; `applySaleCharge`/`applyReturnRefund`/`applyOrderSold` deleted |
| billing | `billing.service.ts` | `issueInvoiceInTx` + `captureClientPaymentInTx` extracted; `createClientPayment` thinned; `issueFromSale` deleted |
| billing | `billing.interface.ts`, `billing.routes.ts` | `InvoiceIssueRequest`; interface updates; `billingService` export |
| billing | `billing.listener.ts` | `sale.confirmed` subscription deleted |
| sales | `sales.interface.ts`, `sales.routes.ts` | new `IBillingIssuePort`; port rename; DI |
| sales | `sales.service.ts` | `confirm` rewritten (Action 6); `createReturn` rewritten (Action 8) |
| orders | `orders.interface.ts`, `orders.service.ts` | mechanical `applyOrderSold` → `applyDocumentCharge` (identical arithmetic) |
| frontend | — | **none**. Every response shape is unchanged. |

---

## 3. Handoffs to record in the report

1. **S6** — the POS receipt's "previous and new credit" now come from a two-step credit movement;
   `Sale.previousCredit`/`newCredit` still bracket the whole sale, so the UI needs no new field.
2. **S10** — every primitive for order completion exists; `applyDocumentCharge`'s `creditDelta: 0`
   at order confirm is the one line to change when the money moves to `COMPLETED`.
3. **S12** — a return now produces a `ClientPayment` row (negative) whenever cash came back; the
   Returns tab can show refunds straight from the ledger.
4. **S13** — `captureClientPaymentInTx` accepts a null `invoiceId` precisely for repair payments
   taken before pickup.
5. **S14** — `PosClient.credit` is unchanged for sales but now **falls on a full return**, and
   `totalSold` falls on every return. Statistics aggregates `PosClient.credit` (`statistics.service.ts:40`)
   and must be re-checked against this.
6. **Billing's listener will be empty after S10** — delete the file then, as S1 did with
   `sales.listener.ts`.

---

## 4. Manual verification checklist

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

**Returns — the four cases from Action 8e**
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
