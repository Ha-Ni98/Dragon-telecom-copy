# Plan S35 — Cash register: profit, standalone payments & the staff dashboard

Execution plan for **set 35** of `Docs/Stage-04-Fixes/sets-34-36.md`.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

- **S33** (committed) built the Caisse. It lives in the statistics module and has these parts:
  - `getCashRegister`, which runs 9 aggregates;
  - `getCashRegisterDocuments`, which serves the drill-through lists;
  - one private where-builder per figure;
  - the web page `pages/admin/cash-register/`.

  S35 extends all of it. Read `Docs/Stage-04-Fixes/results/report-S33.md` first.
- **S34** is executed but **not committed**. Do not reset or revert its files. S35 touches two of
  them:
  - `billing.service.ts` (S34 changed `listClientPayments`/`listInvoicesFor`; S35 changes
    `captureClientPaymentInTx`/`createClientPayment`);
  - `translations.json` (only **add** keys).

  Nothing in S35 depends on S34's behaviour.
- S36 is independent of S35.

### 0.2 Owner decisions taken while planning (settled, do not re-open)

| # | Question | Answer |
|---|---|---|
| Q1 | A payment recorded **later** against an existing invoice (Record payment from the invoices page) updates only `Invoice.paidAmount`, never `Sale.paidAmount`/`Order.paidAmount`. The Caisse sections read the document's own paid figure, so that cash appeared in **no** section. How should the Payments line work? | **Count every Record payment in the Payments line, linked to an invoice or not.** A new boolean `ClientPayment.standalone` is set only by the Record-payment path. There is no backfill: invoice-linked Record payments taken before S35 stay uncounted. Unlinked ones taken before S35 are still caught (§0.4). |
| Q2 | The brief's profit and cash formulas list sales and repairs only, but the page also shows completed orders and order-return refunds. Should orders count? | **Include orders.** Net profit adds order profit and subtracts order-return reversals. Net cash adds "paid on completed orders". |
| Q3 | How much profit does a **repair return** reverse? | **Use the same rule as sale returns:** the repair's total minus the cost of the parts put back on the shelf. A non-restocked part stays a loss. |
| Q4 | What does the staff dashboard get? | **Today's whole-store figures only.** No profit, no date picker and no drill-through lists. |

### 0.3 Two rules to state in the code and the report, so nobody "corrects" them later

1. **Supplier payments are not an expense and never reduce net profit.** Buying stock is a
   balance-sheet movement. Its cost reaches profit later, as FIFO cost of goods, when the item is
   sold. Subtracting supplier payments would make a big delivery day read as a large loss.
   Supplier payments appear **only** in the cash movement.
2. **The staff cash register reports the whole store, not the staff member's own documents.** The
   Caisse describes one physical drawer, so a per-seller version would match nothing. This is a
   **deliberate exception** to the rule that staff see only their own documents. Every profit
   figure is **stripped in the mapper** by a separate staff schema that has no `profit` key at
   all, never hidden in a component.

### 0.4 Which query owns which money row (every row counted exactly once)

The Caisse sections read **document** figures, not ledger rows. Ownership therefore follows from
which document figure a ledger row is already part of:

| Money row | Written by | Counted in (Caisse figure → source) |
|---|---|---|
| `ClientPayment` at sale confirm (`invoiceId` = sale invoice) | `sales.service confirm` | **Sales → paid** via `Sale.paidAmount`. Walk-in cash has no row but is in `Sale.paidAmount` too. |
| `ClientPayment` at order completion (`invoiceId` = order invoice) | `orders.service` COMPLETED | **Orders → paid on completed** via `Order.paidAmount` |
| `ClientPayment` with `repairId` set (deposits, pickup capture, reversals) | `repairs.service` | **Repairs → paid** (gross, `paidAmount + refundedAmount`) and **Repairs → refunded** (`refundedAmount`) |
| Negative `ClientPayment` of a sale/order return (`invoiceId` set) | `sales.createReturn` / `orders.returnOrder` | **Returns → total refunded** via `Return.refundAmount` |
| `ClientPayment` from **Record payment** (`standalone = true`, any `invoiceId`) **and** pre-S35 rows with `invoiceId = null`, `repairId = null`, `amount > 0` | `billing.createClientPayment` | **Payments → client (+)** (new) |
| `SupplierPayment` with `supplierInvoiceId` set | `purchasing.createPayment` | **Suppliers → paid on invoices** (**narrowed** from "all supplier payments") |
| `SupplierPayment` with `supplierInvoiceId = null` | `purchasing.createPayment` | **Payments → supplier (−)** (new) |

Why the pre-S35 branch is safe:
- I checked every caller of `captureClientPaymentInTx` (`sales` ×2, `orders` ×2, `repairs` ×3,
  `billing` ×1). The only path that writes a row with `invoiceId = null` **and** `repairId = null`
  is `billing.createClientPayment` (Record payment).
- `amount > 0` additionally excludes any legacy refund row written without an invoice.

Measured on the dev DB: 2 such client rows and 0 unlinked supplier rows.

**Today's Suppliers "total paid" counts every supplier payment** (S33/Q1,
`cashSupplierPaymentsWhere` = `{ paidAt: range }`). Keeping it alongside the new Payments line
would double-count, so S35 **narrows it to invoice-linked payments** (Action 3.3).

### 0.5 The figures after S35

All figures cover one Africa/Algiers day, `range = storeDayRangeUtc(date, date)`, each anchored on
the timestamp S33 established.

**Profit (admin only)**

| Figure | Source |
|---|---|
| Sales profit | Σ `Sale.totalProfit` over `cashSalesWhere` (`soldAt`; COMPLETED, PARTIALLY_RETURNED, RETURNED) |
| Repair profit | Σ `Repair.totalProfit` over `cashRepairsPickedUpWhere` (`pickedUpAt`; PICKED_UP, RETURNED) |
| Order profit | Σ `Order.totalProfit` over `cashOrdersCompletedWhere` (`deliveredAt`; COMPLETED, RETURNED). Already fee-free (S24). |
| Sale-return reversal | Σ over return lines of **sale** returns with `Return.returnedAt ∈ range`: `unitPrice × qty − (restock ? costOfGoods × qty / lineQty : 0)` |
| Order-return reversal | Σ over return lines of **order** returns with `returnedAt ∈ range`: `refundAmount − (restock ? costOfGoods × qty / lineQty : 0)` |
| Repair-return reversal | Σ over repairs `status = RETURNED, returnedAt ∈ range`: `totalAmount − Σ costOfGoods of parts with restockedOnReturn = true` (Q3) |
| Net profit | sales + repairs + orders − (sale + order + repair reversals) |

Why this is not double-counted:
- `Sale.totalProfit`, `Repair.totalProfit` and `Order.totalProfit` are written once, at
  confirm/pickup/completion, and **no return modifies them**. Checked: `createReturn`,
  `returnOrder`, `returnRepair` ("left as the pickup snapshot").
- So a document's profit stays on its own day, and its reversal lands on the return day.
- A document returned the same day nets to zero; a later return never rewrites an earlier day.
  This is the same reasoning as S33/P3.

The two return formulas are the statistics module's own (`returnAdjustments`, S24/S32-Q1). I
validated the sale-return SQL in Action 3.2 against that JS formula on the dev DB: 20 100 = 20 100.

**Deliberate difference from the Statistics page:**
- Statistics restates a return into the **parent document's** period and drops a returned repair
  entirely (S30/Q2).
- The Caisse is a day ledger. A return is dated on the day it happened, and a repair return
  reverses "total − restocked cost".
- Over a day where documents and their returns don't cross days, both pages agree. Otherwise they
  can differ on purpose. Write this in the report and in the code comment.

**Standalone payments (new section, both scopes)**

| Figure | Source |
|---|---|
| Client payments (+) | `ClientPayment` with `paidAt ∈ range` and (`standalone = true` **or** (`invoiceId = null`, `repairId = null`, `amount > 0`)) → `_count`, `_sum.amount` |
| Supplier payments (−) | `SupplierPayment` with `paidAt ∈ range`, `supplierInvoiceId = null` → `_count`, `_sum.amount` |

**Suppliers section (changed)**

| Figure | Source |
|---|---|
| Paid on supplier invoices | `SupplierPayment` with `paidAt ∈ range`, `supplierInvoiceId ≠ null` (**narrowed**) |
| New supplier credit | **Meaning unchanged:** total invoiced − **all** supplier payments of the day (invoice-linked + standalone). It is the day's movement of the supplier balance, which on-account payments also reduce. |

**Net cash movement (new card, both scopes), computed on the server**

```
+ paid on the day's sales                 sales.totalPaid
+ paid on the day's repair pickups        repairs.paidAmount (gross, S33/P3)
+ paid on completed orders                orders.completedPaid        (Q2)
+ standalone client payments              payments.clientTotal
− refunds paid out                        returns.totalRefunded + repairs.refundedAmount
− supplier payments                       suppliers.paidOnInvoices + payments.supplierTotal
= net cash movement for the day
```

### 0.6 Findings (record them in the report)

- **F1 — later invoice-linked client payments were invisible on the Caisse** (§0.2 Q1). This is
  fixed going forward by `ClientPayment.standalone`. Rows recorded before S35 are not re-marked
  (no backfill).
- **F2 — repair deposits don't fit a day ledger (not fixed).** S33 anchors repairs on
  `pickedUpAt`, so a deposit appears on the pickup day (S33-F3). For a repair **cancelled before
  pickup**, the deposit never appears on any day, while its refund appears on the cancel day. Net
  cash therefore under-reports by that deposit across the period. A correct fix would date repair
  cash on the ledger's `paidAt`, but walk-in repairs have no ledger rows (S30/P7) and so no
  timestamp. That needs a schema decision. Candidate for a later set.
- **F3 — the staff dashboard's "my sales today" used the server's local midnight.**
  `getStaffDashboard` used `new Date().setHours(0,0,0,0)`, which is UTC on the Fly machine, so
  between 00:00 and 01:00 Algiers it reported the wrong day. It would sit next to the new
  Algiers-day cash register on the same page, so it is fixed in Action 3.6. The figure's status
  filter (COMPLETED only) is left as it is.
- **F4 — an order return's `refundAmount` is the refund the operator typed** (S33/Q4 caveat). It
  now also feeds net cash and the order-return profit reversal. The owner accepted this caveat in
  S33.
- **F5 — client-payment and supplier-payment hooks didn't refresh statistics** (S33-F4, partly).
  `useCreateClientPayment` and `useCreatePurchasingPayment` now feed Caisse lines, so they gain a
  `qk.stats.all()` invalidation (Action 4.4).

### 0.7 Decisions this plan takes on its own (list them in the report)

| # | Decision | Why |
|---|---|---|
| P1 | New column **`ClientPayment.standalone Boolean @default(false)`**, set to `true` only by `BillingService.createClientPayment`. | This is Q1. A boolean named after what it means ("taken outside any document"), not after the screen it came from. `DEFAULT false` is the column definition, not a data backfill. |
| P2 | Supplier section fields are **renamed** `paymentCount` → `invoicePaymentCount` and `totalPaid` → `paidOnInvoices`. | Their meaning narrows. Renaming makes every consumer recompile against the new meaning instead of silently showing a smaller number under the old name. No test references them (checked). |
| P3 | **One aggregation core, two mappers.** `getCashRegister` (admin) and the new `getStaffCashRegister` both call a private `computeCashRegister(date)`. The staff mapper parses with `StaffCashRegisterResponseSchema = CashRegisterResponseSchema.omit({ profit: true })`. | This is the brief's "differs only in its mapper and its guard". The staff type has no `profit` key at all, so a component can't render what isn't there. |
| P4 | The staff endpoint is **`GET /staff/cash-register`** with no query string: always today, guarded like the staff dashboard (`staffDashboardViewer`: STAFF or ADMIN). | This is Q4. No date parameter means no browsing of past days. |
| P5 | The profit reversals of sale and order returns use **one raw SQL `SUM` each** (`$queryRaw` tagged template). | Prisma's `aggregate` can't multiply two columns. Loading the day's return lines into JS would be an unbounded read (1 GB machine rule). The SQL was validated read-only against the dev DB. |
| P6 | Drill rows gain an optional **`profit`**, set for SALES, REPAIRS_PICKED_UP and ORDERS_COMPLETED. It is shown as a column in those lists. | The documents endpoint is admin-only (and staff get no drill, Q4), so this leaks nothing. It lets the owner check each profit figure against its documents. The order screens show no profit anywhere today. |
| P7 | Two new drill targets: `PAYMENTS_CLIENT` and `PAYMENTS_SUPPLIER`. `SUPPLIER_PAYMENTS` now lists invoice-linked payments only. | Same rule as S33: a drill list always uses its figure's own where-builder. |
| P8 | Net cash and net profit are **computed on the server** and returned in the DTO. | No business arithmetic in components. |
| P9 | The figure-building code moves out of `AdminCashRegister.tsx` into a shared `CashRegisterSections` component. Without `onDrill`, it renders the same cards as non-clickable. | The admin page and the staff widget show identical sections. The staff dashboard already reuses an admin component (`LowStockAlert`), so that's the precedent. |
| P10 | Profit cards are **not** clickable. Their documents are the existing Sales, Repairs and Orders drill lists, which now carry the profit column. | Avoids three more drill targets that would list the same documents. |
| P11 | **No index** on `ClientPayment.paidAt`. | Same reasoning as S33/P6. |

---

## §1 — Database (`Apps/api/prisma`)

### Action 1.1 — `schema.prisma`, `model ClientPayment`

Add this after `reversalOfId`/`reversalOf`/`reversals`, before the `@@index` lines:

```prisma
  standalone   Boolean @default(false) // S35 — taken through Record payment (billing createClientPayment), outside any sale/order/repair/return transaction; the Caisse's Payments line. False for every row written before S35 (no backfill).
```

### Action 1.2 — Migration `prisma/migrations/20261107120000_s35_client_payment_standalone/migration.sql`

`prisma migrate dev` refuses this non-interactive shell (the S30/S33 precedent). From `Apps/api`,
with `.env` exported (`set -a; . ./.env; set +a`):

```bash
mkdir -p prisma/migrations/20261107120000_s35_client_payment_standalone
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/20261107120000_s35_client_payment_standalone/migration.sql
```

**Read the SQL before applying it.** It must contain exactly one statement:
`ALTER TABLE "ClientPayment" ADD COLUMN "standalone" BOOLEAN NOT NULL DEFAULT false;`.
There must be no `UPDATE` and nothing else. If anything else appears, the dev DB has drifted: stop
and report. Then run `npx prisma migrate deploy` and `npx prisma generate`. The test DB is not
migrated (S30/S33 precedent).

---

## §2 — Contract (`Apps/contract/src/modules/statistics`)

### Action 2.1 — `statistics.enums.ts`

Add these two members to `CashRegisterDrill`:

```ts
  // S35 — the standalone Payments line: client payments taken through Record payment (any
  // invoice link) and supplier payments made on account (no supplier invoice).
  PAYMENTS_CLIENT = 'PAYMENTS_CLIENT',
  PAYMENTS_SUPPLIER = 'PAYMENTS_SUPPLIER',
```

Update the comment on `SUPPLIER_PAYMENTS`, or add one:
`// S35 — invoice-linked supplier payments only (standalone ones are PAYMENTS_SUPPLIER).`

### Action 2.2 — `statistics.dtos.ts`

1. In `CashRegisterResponseSchema`:
   - **`suppliers`:** rename `paymentCount` → `invoicePaymentCount` and `totalPaid` →
     `paidOnInvoices`. Keep `invoiceCount`, `totalInvoiced` and `newCredit`.
   - Add **`payments`**:
     `z.object({ clientCount: z.number().int(), clientTotal: z.number(), supplierCount: z.number().int(), supplierTotal: z.number() })`.
   - Add **`cashMovement`**:
     `z.object({ salesPaid: z.number(), repairsPaid: z.number(), ordersPaid: z.number(), clientPayments: z.number(), refunds: z.number(), supplierPayments: z.number(), net: z.number() })`.
   - Add **`profit`**:
     `z.object({ sales: z.number(), repairs: z.number(), orders: z.number(), saleReturnsReversed: z.number(), orderReturnsReversed: z.number(), repairReturnsReversed: z.number(), returnsReversed: z.number(), net: z.number() })`.
     `returnsReversed` is the sum of the three reversals, computed on the server so the page does
     no arithmetic.
2. Rewrite the schema's header comment so it covers the S35 additions. Keep S33's sentences and
   append:

   ```ts
// S35 — `payments`: money moved without a document (Record payment rows, on-account supplier
// payments); `suppliers.paidOnInvoices` is invoice-linked payments only, so no row is counted
// twice, while `suppliers.newCredit` stays invoiced − ALL supplier payments. `cashMovement.net`
// is the day's real cash movement. `profit` (ADMIN ONLY — absent from StaffCashRegisterDto):
// stored profit of the day's sales/repair pickups/completed orders minus the profit reversed by
// the day's returns. Supplier payments are NOT an expense and never reduce profit: purchased
// stock reaches profit as FIFO cost of goods when sold.
   ```

3. After `CashRegisterDto`, add:

   ```ts
// S35 — the staff dashboard's cash register: whole-store figures for today (a deliberate
// exception to staff seeing only their own documents — it reports one physical drawer), with
// every profit figure removed at the schema level (the mapper parses with this).
export const StaffCashRegisterResponseSchema = CashRegisterResponseSchema.omit({ profit: true });
export type StaffCashRegisterDto = z.infer<typeof StaffCashRegisterResponseSchema>;
   ```

4. In `CashRegisterDocumentResponseSchema`, add `profit: z.number().optional()`. Extend its
   comment: `` `profit` (S35) is set for SALES, REPAIRS_PICKED_UP and ORDERS_COMPLETED — the
   documents endpoint is admin-only. ``

### Action 2.3 — `statistics.routes.ts`

Add this after `CASH_REGISTER_DOCUMENTS`:

```ts
  // S35 — the staff dashboard's cash register: today only, whole store, no profit.
  STAFF_CASH_REGISTER: '/staff/cash-register',
```

Make sure `index.ts` still re-exports all files (it does). Run `npx tsc --noEmit && npm run lint`
in `Apps/contract`.

---

## §3 — API (`Apps/api/src/modules`)

### Action 3.1 — `billing/billing.service.ts` and `billing/billing.interface.ts`: mark Record payments

1. `captureClientPaymentInTx` input type (`billing.service.ts` ≈ line 137): add `standalone?: boolean`.
   In the `tx.clientPayment.create` data, add `...(input.standalone ? { standalone: true } : {})`.
   Append this sentence to the method's header comment:
   `S35 — \`standalone\` is set only by createClientPayment (Record payment): money taken outside any document, which the Caisse counts on its Payments line.`
2. `createClientPayment` (≈ line 209): pass `standalone: true` in the `captureClientPaymentInTx`
   call.
3. `billing.interface.ts` (≈ line 64): add `standalone?: boolean` to the declared input of
   `captureClientPaymentInTx`.
4. Leave the copies of this port declared in `sales.interface.ts`, `orders.interface.ts` and
   `repairs.interface.ts` alone. Those modules never pass the field, and the wider billing
   signature still satisfies them structurally.

### Action 3.2 — `statistics/statistics.service.ts`: split the core and add the new figures

1. **Split.** Rename the body of `getCashRegister` into
   `private async computeCashRegister(date: string): Promise<CashRegisterDto>`. It returns the
   **unparsed** full object. Then:

   ```ts
  async getCashRegister(query: CashRegisterQuery): Promise<CashRegisterDto> {
    return StatisticsMapper.toCashRegisterDto(await this.computeCashRegister(query.date ?? storeLocalDate()));
  }

  // S35 — the staff dashboard's cash register: the SAME aggregation, today only, whole store
  // (a deliberate exception to staff seeing only their own documents — one physical drawer).
  // Profit is stripped by the staff mapper, not by any component.
  async getStaffCashRegister(): Promise<StaffCashRegisterDto> {
    return StatisticsMapper.toStaffCashRegisterDto(await this.computeCashRegister(storeLocalDate()));
  }
   ```

   `computeCashRegister` keeps the single `const range = storeDayRangeUtc(date, date);` line. Add
   `const dayStart = range.gte!; const dayEnd = range.lt!; // storeDayRangeUtc(date, date) always sets both`
   for the raw queries.

2. **Extend the `Promise.all`.** Keep all 9 existing entries. Change three of them and add six
   new ones:
   - the sales aggregate gains `totalProfit: true` in `_sum`;
   - the picked-up repairs aggregate gains `totalProfit: true` in `_sum`;
   - the completed orders aggregate gains `totalProfit: true` in `_sum`;
   - the supplier payments aggregate keeps its call, but its builder is narrowed (Action 3.3);
   - **new** `this.prisma.clientPayment.aggregate({ where: this.cashStandaloneClientPaymentsWhere(range), _count: { _all: true }, _sum: { amount: true } })`;
   - **new** `this.prisma.supplierPayment.aggregate({ where: this.cashStandaloneSupplierPaymentsWhere(range), _count: { _all: true }, _sum: { amount: true } })`;
   - **new**, the sale-return reversal (raw SQL, validated on the dev DB):
     ```ts
      // S35 — the profit a day's SALE returns reverse (statistics' returnAdjustments formula, S32/Q1):
      // line price of the returned units minus their FIFO cost when they went back on the shelf.
      this.prisma.$queryRaw<{ reversed: number }[]>`
        SELECT COALESCE(SUM(
          sl."unitPrice" * rl."quantity"
          - CASE WHEN rl."restock" AND sl."quantity" > 0 THEN sl."costOfGoods" * rl."quantity" / sl."quantity" ELSE 0 END
        ), 0)::float8 AS "reversed"
        FROM "ReturnLine" rl
        JOIN "Return" r ON r."id" = rl."returnId"
        JOIN "SaleLine" sl ON sl."id" = rl."saleLineId"
        WHERE r."returnedAt" >= ${dayStart} AND r."returnedAt" < ${dayEnd}`,
     ```
   - **new**, the order-return reversal (the S24 rule: revenue falls by the refund):
     ```ts
      this.prisma.$queryRaw<{ reversed: number }[]>`
        SELECT COALESCE(SUM(
          rl."refundAmount"
          - CASE WHEN rl."restock" AND ol."quantity" > 0 THEN COALESCE(ol."costOfGoods", 0) * rl."quantity" / ol."quantity" ELSE 0 END
        ), 0)::float8 AS "reversed"
        FROM "ReturnLine" rl
        JOIN "Return" r ON r."id" = rl."returnId"
        JOIN "OrderLine" ol ON ol."id" = rl."orderLineId"
        WHERE r."returnedAt" >= ${dayStart} AND r."returnedAt" < ${dayEnd}`,
     ```
   - **new** `this.prisma.repair.aggregate({ where: this.cashRepairReturnsWhere(range), _sum: { totalAmount: true } })`;
   - **new** `this.prisma.repairPart.aggregate({ where: { restockedOnReturn: true, repair: this.cashRepairReturnsWhere(range) }, _sum: { costOfGoods: true } })`.

   Destructure the new results with clear names, for example `standaloneClient`,
   `standaloneSupplier`, `[saleReversal]`, `[orderReversal]`, `repairReturns` and
   `repairReturnedRestockCost`.

3. **Compute** these, rounding every money value with `round2`:

   ```ts
    const saleReturnsReversed = saleReversal?.reversed ?? 0;
    const orderReturnsReversed = orderReversal?.reversed ?? 0;
    // Q3 (S35) — like a sale return: the repair's total minus the cost of the parts put back on the
    // shelf; a non-restocked part stays a loss. (Statistics instead drops a returned repair whole,
    // S30/Q2 — the Caisse is a day ledger and dates the reversal on returnedAt.)
    const repairReturnsReversed =
      (repairReturns._sum.totalAmount?.toNumber() ?? 0) - (repairReturnedRestockCost._sum.costOfGoods?.toNumber() ?? 0);
    const salesProfit = sales._sum.totalProfit?.toNumber() ?? 0;
    const repairProfit = repairs._sum.totalProfit?.toNumber() ?? 0;
    const orderProfit = completed._sum.totalProfit?.toNumber() ?? 0;
    const clientStandalone = standaloneClient._sum.amount?.toNumber() ?? 0;
    const supplierStandalone = standaloneSupplier._sum.amount?.toNumber() ?? 0;
    const refunds = (returns._sum.refundAmount?.toNumber() ?? 0) + (repairRefunds._sum.refundedAmount?.toNumber() ?? 0);
   ```

   Then build the result:
   - `suppliers.invoicePaymentCount` / `suppliers.paidOnInvoices`: the narrowed payments aggregate.
   - `suppliers.newCredit = round2(totalInvoiced − suppliersPaidOnInvoices − supplierStandalone)`.
     Its meaning is unchanged: invoiced − all supplier payments of the day.
   - `payments`: `{ clientCount, clientTotal, supplierCount, supplierTotal }`.
   - `cashMovement`:
     ```ts
      // S35 — the day's real cash movement. Every payment row is counted once (plan S35 §0.4):
      // document-time rows inside their document's paid figure, Record-payment rows on the
      // Payments line, invoice-linked supplier payments in Suppliers, on-account ones in Payments.
      cashMovement: {
        salesPaid, repairsPaid: repairsGrossPaid, ordersPaid, clientPayments: clientStandalone,
        refunds, supplierPayments: suppliersPaidOnInvoices + supplierStandalone,
        net: salesPaid + repairsGrossPaid + ordersPaid + clientStandalone − refunds − (suppliersPaidOnInvoices + supplierStandalone),
      }
     ```
     Every value is wrapped in `round2`. `ordersPaid` is the completed orders' `_sum.paidAmount`,
     already read for `orders.completedPaid`. Compute it once and reuse it.
   - `profit`:
     ```ts
      // S35 — ADMIN ONLY (stripped by toStaffCashRegisterDto). Supplier payments are NOT an expense
      // and never appear here: purchased stock reaches profit as FIFO cost of goods when sold.
      // Each document's stored profit stays on its own day (no return ever modifies it); the
      // reversal lands on the return's day, so a later return never rewrites an earlier day.
      profit: { sales, repairs, orders, saleReturnsReversed, orderReturnsReversed, repairReturnsReversed,
                returnsReversed: saleReturnsReversed + orderReturnsReversed + repairReturnsReversed,
                net: sales + repairs + orders − returnsReversed }
     ```
4. Update the comment above `getCashRegister` (currently "Nine SQL aggregates …") to say:
   `S35 — computeCashRegister: fifteen queries in one Promise.all — the S33 nine, two standalone-payment aggregates, two raw SUMs for return profit reversals, two repair-return aggregates. No document row is loaded.`

### Action 3.3 — `statistics/statistics.service.ts`: where-builders

1. **Narrow** `cashSupplierPaymentsWhere` to
   `return { paidAt: range, supplierInvoiceId: { not: null } };`. Replace its comment with:
   `// S35 — invoice-linked supplier payments only (was every payment, S33/Q1). On-account ones (no invoice) are cashStandaloneSupplierPaymentsWhere, so the two never double-count.`
2. Add these three builders in the same block:

   ```ts
  // S35 — the Payments line, client side: every Record-payment row (standalone, whatever invoice
  // it settles — a later payment on an invoice moves Invoice.paidAmount only, so no document
  // section can see it), plus pre-S35 on-account rows (no invoice, no repair, positive — only
  // Record payment ever wrote those; the flag did not exist yet).
  private cashStandaloneClientPaymentsWhere(range: StoreDayRange): Prisma.ClientPaymentWhereInput {
    return {
      paidAt: range,
      OR: [{ standalone: true }, { invoiceId: null, repairId: null, amount: { gt: 0 } }],
    };
  }

  // S35 — the Payments line, supplier side: payments made on account (no supplier invoice).
  private cashStandaloneSupplierPaymentsWhere(range: StoreDayRange): Prisma.SupplierPaymentWhereInput {
    return { paidAt: range, supplierInvoiceId: null };
  }

  // S35 — repairs returned that day (their profit reversal; Q3).
  private cashRepairReturnsWhere(range: StoreDayRange): Prisma.RepairWhereInput {
    return { status: 'RETURNED', returnedAt: range };
  }
   ```

### Action 3.4 — `statistics/statistics.service.ts`: drill-through

In `getCashRegisterDocuments`:

1. **SALES:** add `totalProfit: true` to the `select`, and `profit: row.totalProfit.toNumber()` to
   each item.
2. **REPAIRS_PICKED_UP:** add `totalProfit: true`. Add
   `...(row.totalProfit != null ? { profit: row.totalProfit.toNumber() } : {})`. The column is
   nullable, but it is always set at pickup.
3. **ORDERS_\*:** add `totalProfit: true` to the shared `select`. Add `profit` only when
   `withPaid` is true (ORDERS_COMPLETED), with the same null guard.
4. **SUPPLIER_PAYMENTS:** unchanged code. It now lists invoice-linked payments through the
   narrowed builder.
5. **New case `PAYMENTS_CLIENT`**, using `cashStandaloneClientPaymentsWhere(range)`:
   - `count`, then `findMany` with `orderBy: { paidAt: 'asc' }`.
   - `select: { id, reference, paidAt, amount, posClient: { select: { name: true } }, invoice: { select: { number: true } } }`.
   - Map each row to `{ id, reference, at: paidAt, partyName: posClient.name, amount, ...(invoice ? { sourceReference: invoice.number } : {}) }`.
6. **New case `PAYMENTS_SUPPLIER`**, using `cashStandaloneSupplierPaymentsWhere(range)`:
   - Same shape as SUPPLIER_PAYMENTS, without `sourceReference`.
   - `select: { id, reference, paidAt, amount, supplier: { select: { name: true } } }`.

The `switch` stays exhaustive over `CashRegisterDrill`, and `tsc` will flag a missing case.

### Action 3.5 — `statistics/statistics.mapper.ts`, `statistics.interface.ts`, `statistics.controller.ts`, `statistics.routes.ts`

1. **Mapper.** Add this after `toCashRegisterDto`:

   ```ts
  // S35 — the staff dashboard's cash register. Margins are removed HERE (the codebase rule): the
  // object is rebuilt without `profit` and parsed with a schema that has no `profit` key.
  static toStaffCashRegisterDto(input: CashRegisterDto): StaffCashRegisterDto {
    const { date, sales, returns, repairs, orders, suppliers, payments, cashMovement } = input;
    return StaffCashRegisterResponseSchema.parse({ date, sales, returns, repairs, orders, suppliers, payments, cashMovement });
  }
   ```

   Import `StaffCashRegisterResponseSchema` and `StaffCashRegisterDto`.
2. **Interface.** Add `getStaffCashRegister(): Promise<StaffCashRegisterDto>;` next to
   `getCashRegister`.
3. **Controller.** Add a `getStaffCashRegister` handler in the same shape as `getStaffDashboard`
   (no query, `sendSuccess(res, await this.service.getStaffCashRegister(), 200)`).
4. **Routes.** Add
   `router.get(STATS_ROUTES.STAFF_CASH_REGISTER, staffDashboardViewer, controller.getStaffCashRegister);`
   right after the `STAFF_DASHBOARD` route. Append this sentence to the `staffDashboardViewer`
   comment:
   `S35 — also guards the staff cash register (whole-store figures for today, profit stripped in the mapper; one physical drawer, so per-seller scoping would match nothing).`

### Action 3.6 — `statistics/statistics.service.ts`: Algiers day in `getStaffDashboard` (F3)

Replace these lines:

```ts
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
```

with:

```ts
    // S35/F3 — the store's day (Africa/Algiers), not the server's local midnight (UTC on Fly);
    // the cash register shown beside this figure uses the same bounds.
    const today = storeLocalDate();
    const todayRange = storeDayRangeUtc(today, today);
```

Then change the sales-today filter to `soldAt: todayRange`. Keep `status: 'COMPLETED'` and keep
`now` for the draft ages.

Run `npx prisma validate && npx tsc --noEmit && npm run lint` in `Apps/api`.

---

## §4 — Web (`Apps/web/src`)

### Action 4.1 — `services/statistics.service.ts`

Add this next to `getCashRegister`:

```ts
// S35 — the staff dashboard's cash register (today, whole store, no profit).
export async function getStaffCashRegister(): Promise<StaffCashRegisterDto> {
  const res = await api.get<ApiResponse<StaffCashRegisterDto>>(apiPath(STATS_ROUTES.STAFF_CASH_REGISTER));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
```

### Action 4.2 — `lib/query-keys.ts`

Inside `stats`, add this after `cashRegisterDocuments`:
`staffCashRegister: () => ["stats", "staff-cash-register"] as const,`. It is nested under
`stats`, so every `qk.stats.all()` invalidation also refreshes it.

### Action 4.3 — `hooks/useStatistics.ts`

Add this:

```ts
// S35 — the staff dashboard's cash register; staleTime 0 like the admin Caisse (S33/F4).
export function useStaffCashRegister() {
  return useQuery({
    queryKey: qk.stats.staffCashRegister(),
    queryFn: statisticsService.getStaffCashRegister,
    staleTime: 0,
  });
}
```

### Action 4.4 — refresh statistics after payments (F5)

- `hooks/useBilling.ts` `useCreateClientPayment`: add
  `queryClient.invalidateQueries({ queryKey: qk.stats.all() });` with the comment
  `// S35 — Record payments feed the Caisse's Payments line.`
- In the purchasing hooks file that defines `useCreatePurchasingPayment`
  (`grep -rn "export function useCreatePurchasingPayment" Apps/web/src/hooks`), add the same
  invalidation with the comment
  `// S35 — supplier payments feed the Caisse (Suppliers / Payments lines).`

### Action 4.5 — `types/cash-register.types.ts`

- Add `profit: boolean` to `CashRegisterDrillColumns`.
- Add `detail?: string` to `CashRegisterFigure`, with the doc comment
  `/** S35 — already-formatted sub-line under the value (e.g. a breakdown); replaces the drill hint. */`.
- Add this interface:
  ```ts
// S35 — one line of the net cash movement card.
export interface CashMovementLine {
  labelKey: string;
  amount: number;
  /** The total line (bold, separated). */
  isTotal?: boolean;
}
  ```

### Action 4.6 — `pages/admin/cash-register/components/cash-register-section.tsx`

- Make `onDrill` **optional**. A figure is clickable only when it has a `drill` **and** `onDrill`
  is provided. Otherwise it renders as a plain card, and the drill hint `trend` text is omitted
  too.
- When `figure.detail` is set, pass it as the `StatCard`'s `trend` (same `text-xs
  text-muted-foreground` span) in place of the drill hint.
- Update the header comment:
  `S35 — without onDrill (the staff dashboard) every figure is a plain card.`

### Action 4.7 — new `pages/admin/cash-register/components/cash-movement-card.tsx`

This is a presentational `Card` with these parts:
- the title `t("admin.cashRegister.cash.title")`;
- a list of `CashMovementLine` rows, with the label on the left and `formatDZD(amount, language)`
  on the right;
- the total row `font-semibold` with a top border.

Props: `{ cash: StaffCashRegisterDto["cashMovement"] }`. Build the lines inside it, in this order:

| labelKey | amount |
|---|---|
| `admin.cashRegister.cash.salesPaid` | `salesPaid` |
| `admin.cashRegister.cash.repairsPaid` | `repairsPaid` |
| `admin.cashRegister.cash.ordersPaid` | `ordersPaid` |
| `admin.cashRegister.cash.clientPayments` | `clientPayments` |
| `admin.cashRegister.cash.refunds` | `refunds` |
| `admin.cashRegister.cash.supplierPayments` | `supplierPayments` |
| `admin.cashRegister.cash.net` (`isTotal`) | `net` |

The labels carry their own `+`/`−`/`=` signs. Amounts are shown unsigned except `net`, which may
be negative. The component does no arithmetic.

### Action 4.8 — new `pages/admin/cash-register/components/cash-register-sections.tsx`

1. Export `CashRegisterSections({ data, onDrill }: { data: StaffCashRegisterDto; onDrill?: (drill: CashRegisterDrill, titleKey: string) => void })`.
   The admin `CashRegisterDto` is assignable to it, because it is a superset.
2. **Move** the whole `sections` array construction out of `AdminCashRegister.tsx` into this
   component, unchanged except for the following:
   - **Suppliers:** the third figure becomes
     `{ labelKey: "admin.cashRegister.suppliers.paidOnInvoices", value: money(data.suppliers.paidOnInvoices), drill: CashRegisterDrill.SUPPLIER_PAYMENTS }`.
     Keep the `newCredit` figure and update its comment:
     `// Invoiced − ALL supplier payments of the day (invoice-linked here + on-account in Payments). May be negative.`
   - **New Payments section** after Suppliers: `titleKey: "admin.cashRegister.payments.title"`,
     icon `<Banknote className="h-5 w-5" />` (lucide). Its figures:
     - `{ labelKey: "admin.cashRegister.payments.client", value: t("admin.cashRegister.amountWithCount", { amount: money(data.payments.clientTotal), count: data.payments.clientCount }), drill: CashRegisterDrill.PAYMENTS_CLIENT }`
     - `{ labelKey: "admin.cashRegister.payments.supplier", value: t("admin.cashRegister.amountWithCount", { amount: money(data.payments.supplierTotal), count: data.payments.supplierCount }), drill: CashRegisterDrill.PAYMENTS_SUPPLIER }`
3. Render every section with `<CashRegisterSection … onDrill={onDrill} />`. Then render
   `<CashMovementCard cash={data.cashMovement} />` last.
4. Header comment:
   `S35 — the Caisse's sections + net cash movement, shared by ADM-20 (clickable, with drill) and the staff dashboard (plain cards). Profit is not here: it exists only on the admin DTO and is rendered by AdminCashRegister alone.`

### Action 4.9 — `pages/admin/cash-register/AdminCashRegister.tsx`

1. Delete the inline `sections` construction and the `CashRegisterSection` import. Render
   `<CashRegisterSections data={data} onDrill={openDrill} />` when `data` is set.
2. After it, render the admin-only **Profit** section with `CashRegisterSection`. Pass
   `titleKey="admin.cashRegister.profit.title"`, icon `<TrendingUp className="h-5 w-5" />`, **no
   `onDrill`** (P10), and these figures:

   | labelKey | value |
   |---|---|
   | `admin.cashRegister.profit.sales` | `money(data.profit.sales)` |
   | `admin.cashRegister.profit.repairs` | `money(data.profit.repairs)` |
   | `admin.cashRegister.profit.orders` | `money(data.profit.orders)` |
   | `admin.cashRegister.profit.returnsReversed` | `money(data.profit.returnsReversed)` |
   | `admin.cashRegister.profit.net` | `money(data.profit.net)` |

   The `returnsReversed` figure carries `detail:`
   `t("admin.cashRegister.profit.returnsBreakdown", { sales: money(data.profit.saleReturnsReversed), orders: money(data.profit.orderReturnsReversed), repairs: money(data.profit.repairReturnsReversed) })`.
   It is rendered under the value (Action 4.6).
3. Under the Profit section, add `<p className="text-xs text-muted-foreground">{t("admin.cashRegister.profit.note")}</p>`.
   This is the supplier-payments-are-not-an-expense note.
4. Update the page's header comment by appending:
   `S35 — adds the standalone Payments section, the net cash movement card (shared with the staff dashboard via CashRegisterSections) and the admin-only Profit section.`
5. The skeleton count of 8 can stay.

### Action 4.10 — `pages/admin/cash-register/components/cash-register-drill-dialog.tsx`

1. `DRILL_COLUMNS`:
   - add `profit: false` to every existing entry, except `profit: true` for `SALES`,
     `REPAIRS_PICKED_UP` and `ORDERS_COMPLETED`;
   - add `[CashRegisterDrill.PAYMENTS_CLIENT]: { paid: false, sourceReference: true, profit: false }`;
   - add `[CashRegisterDrill.PAYMENTS_SUPPLIER]: { paid: false, sourceReference: false, profit: false }`.
2. Add an optional column after `paid`: header `t("admin.cashRegister.drill.profit")`, cell
   `row.original.profit != null ? formatDZD(row.original.profit, language) : "—"`, included only
   when `show.profit` is true. Follow how the `paid` column is added conditionally.

### Action 4.11 — new `pages/staff/dashboard/components/StaffCashRegisterWidget.tsx`

1. It uses `useStaffCashRegister()`.
2. **Silent-hide on error**, following the STF-01 convention in `StaffDashboard.tsx`: return
   `null` when `isError`.
3. While loading, show a grid of 4 `StatCardSkeleton`.
4. Layout:
   - a heading row: `h2` `t("staff.dashboard.cashRegister.title")`, plus a small `outline`
     Refresh `Button` (`RefreshCw` icon, `t("common.actions.refresh")`, `onClick={() => refetch()}`,
     `disabled={isFetching}`);
   - under the heading, `t("staff.dashboard.cashRegister.note")` in `text-sm text-muted-foreground`;
   - then `<CashRegisterSections data={data} />` with **no `onDrill`** (Q4: no drill lists).
5. Header comment:
   `S35 — the whole-store cash register for today on the staff dashboard. Deliberate exception to staff seeing only their own documents (it reports one physical drawer). The DTO carries no profit at all — stripped in the API mapper (StaffCashRegisterDto).`

### Action 4.12 — `pages/staff/dashboard/StaffDashboard.tsx`

- Render `<StaffCashRegisterWidget />` right after `MySalesTodayCard`. It has its own query and is
  not gated by `isError` of the dashboard query.
- Add one line to the header comment:
  `S35 — plus the whole-store cash register for today (its own query, silent-hide on error).`

### Action 4.13 — `config/translations.json`

Insert next to the siblings, `ar: ""`, and do the byte-safe round-trip check first (the S33/S34
precedent):

| Key | en | fr |
|---|---|---|
| `admin.cashRegister.amountWithCount` | {amount} · {count} | {amount} · {count} |
| `admin.cashRegister.suppliers.paidOnInvoices` | Paid on supplier invoices | Payé sur factures fournisseurs |
| `admin.cashRegister.payments.title` | Payments without a document | Paiements hors documents |
| `admin.cashRegister.payments.client` | Client payments received (+) | Paiements clients reçus (+) |
| `admin.cashRegister.payments.supplier` | Supplier payments on account (−) | Paiements fournisseurs sans facture (−) |
| `admin.cashRegister.cash.title` | Net cash movement | Mouvement de caisse net |
| `admin.cashRegister.cash.salesPaid` | + Paid on the day's sales | + Payé sur les ventes du jour |
| `admin.cashRegister.cash.repairsPaid` | + Paid on the day's repair pickups | + Payé sur les réparations récupérées |
| `admin.cashRegister.cash.ordersPaid` | + Paid on completed orders | + Payé sur les commandes terminées |
| `admin.cashRegister.cash.clientPayments` | + Client payments without a document | + Paiements clients hors documents |
| `admin.cashRegister.cash.refunds` | − Refunds paid out | − Remboursements versés |
| `admin.cashRegister.cash.supplierPayments` | − Supplier payments | − Paiements fournisseurs |
| `admin.cashRegister.cash.net` | = Net cash movement for the day | = Mouvement de caisse net du jour |
| `admin.cashRegister.profit.title` | Profit | Bénéfice |
| `admin.cashRegister.profit.sales` | Sales profit | Bénéfice des ventes |
| `admin.cashRegister.profit.repairs` | Repair profit | Bénéfice des réparations |
| `admin.cashRegister.profit.orders` | Order profit | Bénéfice des commandes |
| `admin.cashRegister.profit.returnsReversed` | Reversed by returns | Annulé par les retours |
| `admin.cashRegister.profit.returnsBreakdown` | Sales {sales} · Orders {orders} · Repairs {repairs} | Ventes {sales} · Commandes {orders} · Réparations {repairs} |
| `admin.cashRegister.profit.net` | Net profit | Bénéfice net |
| `admin.cashRegister.profit.note` | Supplier payments are not an expense: purchased stock reaches profit as cost of goods when it is sold. | Les paiements fournisseurs ne sont pas une charge : le stock acheté entre dans le bénéfice comme coût des marchandises lorsqu'il est vendu. |
| `admin.cashRegister.drill.profit` | Profit | Bénéfice |
| `staff.dashboard.cashRegister.title` | Cash register — today | Caisse — aujourd'hui |
| `staff.dashboard.cashRegister.note` | Whole-store figures for today (Algiers time), to check the drawer. | Chiffres de tout le magasin pour aujourd'hui (heure d'Alger), pour contrôler la caisse. |

`admin.cashRegister.suppliers.totalPaid` becomes unused. Leave it in place and list it in the
report.

---

## §5 — Conception docs (`Docs/Stage-00-Conception`)

1. `database-description.md`, the **ClientPayment** paragraph: append
   `· \`standalone\` (S35 — taken through Record payment, outside any document; the Caisse's Payments line).`
2. `Module-Contracts/statistics.md`:
   - add a route row
     `| \`STATS_ROUTES.STAFF_CASH_REGISTER\` | GET \`/api/staff/cash-register\` | staff/admin | S35 — today's whole-store cash register, profit stripped in the mapper |`;
   - append to Business Logic item 6 a summary of §0.4 and §0.5: which query owns which payment
     row, the Payments line, the narrowed supplier "paid", net cash, the profit formulas and the
     supplier-payments-not-an-expense rule.
3. `Pages-Requirements/ADM-20-cash-register.md`:
   - **UI:** add the Payments section, the Net cash movement card and the Profit section (admin
     only, not clickable);
   - **Data dependencies:** add the new drill targets;
   - **UI:** note the profit column in the Sales, Repairs and Completed-orders drill lists.
4. `Pages-Requirements/STF-01-dashboard.md`:
   - **UI:** add "Cash register — today (whole store; no profit; no drill)";
   - **Data dependencies:** add
     `useStaffCashRegister()` → `['stats','staff-cash-register']` → GET /api/staff/cash-register (silent-hide on error).

---

## §6 — Validation gate

No test file may be read for editing, edited or run. From the repo root:

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd ../api      && npx prisma validate && npx tsc --noEmit && npm run lint
cd ../web      && npx tsc --noEmit && npx eslint <every file this set touched or created>
```

**Baselines** (S34): api `src` 0 errors, whole project 198 errors in 29 files; api lint 7
pre-existing errors; web `tsc -p tsconfig.test.json` 52 errors. No test references the Caisse DTO
(checked), so no drift is expected. Report any.

**Grep sweeps:**
- `grep -n "profit" <the toStaffCashRegisterDto body>` → none. The staff mapper never mentions
  profit.
- `grep -rn "data.profit\|\.profit\." Apps/web/src/pages/staff` → none.
- `grep -n "paymentCount\|suppliers.totalPaid" Apps/web/src Apps/api/src -r` → none.
- `grep -n "standalone" Apps/api/src -r` → billing (signature + `createClientPayment`'s `true`)
  and the statistics builder only.
- `git diff --stat -- Apps/api/prisma/migrations` → exactly one new `migration.sql` with one
  `ADD COLUMN`.

**Read-only smoke run (recommended, the S33/S34 precedent):** write a throwaway
`Apps/api/src/__probe.ts` that calls `computeCashRegister` through the public methods for two dev
days. Check:
- every drill list's `amount` sum and row count equals its figure;
- `PAYMENTS_CLIENT` + `SUPPLIER_PAYMENTS` + `PAYMENTS_SUPPLIER` partition the day's payment rows
  (supplier: linked + standalone = all supplier payments by `paidAt`);
- `cashMovement.net` equals its parts;
- `getStaffCashRegister()`'s JSON has no `profit` key.

Delete the probe afterwards. Run `set -a; . ./.env; set +a` first, and don't override
`LOG_LEVEL`.

---

## §7 — Manual verification checklist (browser)

Signed in as **admin**, with these tabs open: `/admin/cash-register`, `/admin/sales`,
`/admin/repairs`, `/admin/orders`, `/admin/invoices` → **Payments**, `/admin/pos-clients`, and a
supplier's page. Note today's Caisse figures first. After each action, press **Refresh** on the
Caisse.

### A. Standalone payments and the supplier split
1. On `/admin/pos-clients`, record an **on-account** payment of 1 000 for a client.
   - Caisse → **Payments without a document → Client payments received** rises by 1 000 and
     its count by 1.
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
4. **Cross-check against the ledger.** On `/admin/invoices` → **Payments**, filter
   from = to = today.
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
   equals **Sales profit**. Open one of those sales in `/admin/sales`: the per-line profits in
   its detail drawer add up to the same row's profit.
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

---

## §8 — Execution protocol

Execute this set, then write `Docs/Stage-04-Fixes/results/report-S35.md`. The report covers:
- what changed, file by file;
- the verbatim migration SQL;
- Q1–Q4, P1–P11 and F1–F5;
- the gate outputs against the baselines;
- the smoke-run figures.

It ends with the §7 verification checklist. **Stop there.** The owner reviews and approves before
S36 begins. Do not commit unless asked.
