# Plan S32 — POS & sales: payment validation, search and returns

Execution plan for **set 32** of `Docs/Stage-04-Fixes/sets-30-33.md`.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

**S30 and S31 must be in the working tree.** Both are executed but not committed yet, so do not
reset, stash or revert any file they touched.

S32 does not depend on either. It touches no repairs or supplier-invoice file. The only shared
files are `Apps/web/src/config/translations.json` and `Apps/web/src/lib/query-client.ts`. In both
you **add** entries next to the S30/S31 ones and change nothing else.

S33 (Caisse) runs after this set and reuses two things S32 creates:
- the Africa/Algiers day helper (Action 1.1);
- the sale-return arithmetic (Action 2.4).

### 0.2 Owner decisions taken while planning (settled, do not re-open)

| # | Question | Answer |
|---|---|---|
| Q1 | Statistics reduces revenue for a returned sale line by `ReturnLine.refundAmount` (S24/Q1). Under S32 the refund is the cash handed back. It can be 0 when the return only cancels a debt. Which figure should reduce revenue? | **The line price** (`SaleLine.unitPrice × returned quantity`), the same amount `totalSold` falls by. Order returns keep their S24 behaviour. |
| Q2 | Which timestamp should the sales list's date filter and the new **Today's sales** button use? | **`soldAt`**, in Africa/Algiers calendar days, with an inclusive `to` date. Drafts have no `soldAt`, so a date filter hides them. The DRAFT status filter still lists them. |

### 0.3 What the set asks for, mapped onto the code as it is today

| Set requirement | Current state (verified) | Consequence for this plan |
|---|---|---|
| Paid amount starts empty | `StaffPos.tsx:119-163`: `paidAmount` state is a `number` (starts at 0). A `paidAmountTouched` flag and an effect copy `total` into it until the cashier types. The panel input (`PosPaymentPanel.tsx:56-62`) always shows a number. | `paidAmount` becomes `number \| null`, starting at `null`. The auto-track effect and `paidAmountTouched` are deleted. |
| Walk-in: paid must equal total exactly | Front end: no check. Back end (`sales.service.ts:136-138`) rejects only **under**payment (`CREDIT_REQUIRES_CLIENT`). A walk-in overpayment is accepted and stored as `Sale.paidAmount`/`Invoice.paidAmount` above the total. | Front-end check plus a new back-end guard `SALE_ERROR.WALK_IN_OVERPAYMENT`. The under-payment guard and its sentinel stay as they are. |
| Attached client: empty blocks; any difference opens a confirmation with previous/new credit | No confirmation exists. The panel only shows a live `CreditMovementPreview` (S6). | New shared `CreditChangeConfirmDialog`, used by the POS and both return dialogs. |
| Verify the `ClientPayment` row in the confirm transaction | Read in full (`sales.service.ts:161-264`, `billing.service.ts:134-185`, `clients.service.ts:468-503`). Verification below (F1). | **No code change.** |
| Search by sold product | `SaleListQuery` has no product filter. | New `product` query param. It matches any line by snapshot name or product-barcode prefix. |
| Today's sales, Africa/Algiers | **No timezone helper exists anywhere** (`grep Africa/Algiers` → none). The date filter uses `createdAt`, reads `from`/`to` as UTC midnight, and `lte: new Date(to)` **excludes the `to` day itself** (F2). Staff never send `from`/`to` (`StaffSales.tsx:83-84`). | New contract helper for store-local days. The filter moves to `soldAt` (Q2), with Algiers day bounds and an inclusive `to`. A **Today** toggle is added for both scopes. |
| Returns: refund starts empty, walk-in exact, client confirms | `ReturnDialog.tsx:91` pre-fills each checked line's refund with **one** unit's price, even when quantity > 1. There is no walk-in rule and no confirmation. | Field starts empty. Walk-in must equal `unitPrice × qty` (front and back). For a client, any difference opens the confirmation. |
| Return the whole sale, one refund field | Doesn't exist. | New endpoint, service method, dialog and drawer button (decision P2). |
| Cache arithmetic `credit += refund − linePrice`, `totalPaid −= refund` via a negative row, `totalSold −= linePrice` | **Different today** (S5 D7, `sales.service.ts:394-495`). (a) The cash refund is **capped** at `paid − already refunded`. (b) `totalSold` falls by the **refund**, not the line price. (c) A partial return leaves credit unchanged. Only a **full** return reverses the sale's own credit delta. | `createReturn`'s money block is rewritten to the set's formula. The cap and the D7 full/partial branch are removed. The set brief supersedes D7. |
| Restock behaviour unchanged | `createReturn:448-457` → `buildOriginalConsumptions` → `inventory.returnIn` at the consumed layer costs. Non-restocked lines are skipped. | **Untouched.** The whole-sale path reaches it through `createReturn`. |

### 0.4 Findings (record them in the report)

- **F1 — the confirm-time `ClientPayment` row is already correct. No change.** In `confirm` the
  document charge runs first (`applyDocumentCharge`, credit `c → c + total`, `totalSold += total`,
  `totalPaid` untouched). Then `captureClientPaymentInTx` writes exactly one row:
  `amount = paidAmount`, `invoiceId` = the invoice issued in the same transaction,
  `previousCredit = c + total`, `newCredit = c + total − paid`. Only that call moves `totalPaid`,
  through `applyLedgerPayment` on the row-locked `PosClient`. No row is written when
  `paidAmount = 0`. The row's `previousCredit` is the balance **after** this sale's charge,
  because the snapshot records the balance just before that payment. `Sale.previousCredit` keeps
  the balance before the sale. Both are correct, and the verification checklist reads both.
- **F2 — the sales list's `to` date excluded its own day.** `lte: new Date('2026-10-11')` means
  "up to 2026-10-11T00:00Z". Fixed for the sales list by Action 2.4 (Algiers bounds, exclusive
  next-day upper bound). The same pattern exists in `listReturns`, billing, purchasing, orders and
  repairs lists. **Not fixed here (out of scope).** Flag it for S33, which must use the new helper
  everywhere it reads a day.
- **F3 — staff could read other sellers' sales.** In `listSales` (`sales.service.ts:527-542`),
  `...opts.extraWhere` (staff scoping `{ staffId }`) is spread **first**. The
  `sellerId → staffId` line after it overwrites it. The staff route passes the validated query
  straight through, so `GET /api/staff/sales?sellerId=<other>` lists another seller's sales. The
  comment at line 538 claims this can't happen. Fixed by Action 2.4: the scoping spread moves
  last.
- **F4 — a return's refund can now take an invoice's `paidAmount` below zero.** The refund row
  is linked to the sale's invoice. Billing recomputes `Invoice.paidAmount = Σ ledger rows on that
  invoice` (`billing.service.ts:165-182`). If the cash refunded exceeds what was paid against that
  invoice (e.g. the client settled the sale later through an on-account payment), the sum goes
  negative and the status falls to `ISSUED`. This follows from the set's formula, and the
  client's `totalPaid`/`credit` stay right. It is not fixed here. List it in the report as a known
  display edge.

### 0.5 Decisions this plan takes on its own (list them in the report)

| # | Decision | Why |
|---|---|---|
| P1 | **Money equality is compared in cents** (`Math.round(x × 100)`) on both sides. | Floating-point totals such as 0.1 + 0.2 must not block an exact payment. |
| P2 | **Whole-sale return = new endpoint `POST …/returns/whole-sale`** (`ReturnWholeSaleCommand { saleId, type, reason?, refundAmount, lines: { saleLineId, restock }[] }`). The service splits the single refund across the remaining lines in proportion to line value and delegates to `createReturn`. | One code path for the money and stock arithmetic. The split runs on the server, not in a component. Per-line restock is kept, as the brief requires. |
| P3 | **Split rule:** every line except the last gets `floor(refundCents × lineValueCents / totalValueCents)`. The last line gets the remainder. If `totalValueCents = 0`, the whole refund goes on the last line. | `floor` can never push the last share negative. The shares always sum exactly to the refund. When the refund equals the value, each share equals its own line value, so the walk-in per-line exactness check still passes. |
| P4 | **Sale-return ordering inside the transaction:** the document charge (`−linePrice` on `credit` and `totalSold`) runs **before** the negative ledger row. This mirrors `confirm`. | The ledger row's `newCredit` is then the client's final balance, as on a sale's payment row. |
| P5 | **No `reversalOfId` on a sale-refund row.** It carries `invoiceId` only, as today. | A sale refund can exceed or differ from any one payment. `reversalOfId` (S30) means "reverses that specific payment", which is a repair-only concept. |
| P6 | **`SaleDto.posClientCredit`** (new, optional, detail read only) carries the client's **current** credit, so both return dialogs can show previous → new credit. | No by-id POS-client read exists that staff can call. The detail read already joins `posClient`. |
| P7 | **Today's sales and product search are shown to staff too.** The two date inputs stay admin-only. Staff results stay limited to the staff member's own sales (now enforced, F3). | The brief says "Sales page" without a scope. Neither control exposes anything new. |
| P8 | **`SaleDto.refundedAmount` stays** as an informational figure. Its "cap" wording is removed. | It is still a correct ledger sum. Removing it would add contract churn and stale tests for no gain. |
| P9 | **The POS "Change due" row is removed.** | A walk-in must now pay the exact total, and a client's overpayment goes to credit. Change due is always 0. |

---

## §1 — Contract (`Apps/contract`)

### Action 1.1 — New `src/common/store-time.ts`, export it from `src/index.ts`

```ts
// S32 — the store's business day. Every "today" and every date-range filter on a money document
// is an Africa/Algiers calendar day, never a UTC day: a sale at 00:30 local belongs to that local
// day. Shared by the API (query bounds) and the web (what "today" is). Pure Intl — no library.
export const STORE_TIME_ZONE = 'Africa/Algiers';

// Offset (ms) of the store zone from UTC at a given instant.
function storeOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// 'YYYY-MM-DD' of the store-local day containing `at` (default: now).
export function storeLocalDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

// The UTC instant at which store-local day `isoDate` ('YYYY-MM-DD') begins.
export function storeDayStartUtc(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utcMidnight = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return new Date(utcMidnight - storeOffsetMs(new Date(utcMidnight)));
}

// Half-open UTC bounds for an inclusive store-local day range — `to` includes its whole day.
// Use as a Prisma DateTime filter: `{ soldAt: storeDayRangeUtc(from, to) }`.
export function storeDayRangeUtc(from?: string, to?: string): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  if (from != null) range.gte = storeDayStartUtc(from);
  if (to != null) {
    const [y, m, d] = to.split('-').map(Number);
    const next = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10);
    range.lt = storeDayStartUtc(next);
  }
  return range;
}
```

Add `export * from './common/store-time';` after the `media` line in `src/index.ts`.
`noUncheckedIndexedAccess` is on, which is why the `?? fallback`s are there. Keep them.

Sanity check while executing (a throwaway `npx tsx -e`, not a test file):
`storeDayRangeUtc('2026-10-11','2026-10-11')` →
`{ gte: 2026-10-10T23:00:00.000Z, lt: 2026-10-11T23:00:00.000Z }`.

### Action 1.2 — New `src/modules/sales/sales.constants.ts`, exported from `src/modules/sales/index.ts`

```ts
// S32 — sales business-rule sentinels. They travel as the error *message*, not error.code (same
// convention as CATALOG_ERROR / REPAIR_ERROR — see web lib/query-client.ts). CREDIT_REQUIRES_CLIENT
// keeps its historic literal value: orders and repairs still throw the same string.
export const SALE_ERROR = {
  CREDIT_REQUIRES_CLIENT: 'CREDIT_REQUIRES_CLIENT',
  WALK_IN_OVERPAYMENT: 'SALE_WALK_IN_OVERPAYMENT',
  WALK_IN_REFUND_MISMATCH: 'SALE_WALK_IN_REFUND_MISMATCH',
  WHOLE_RETURN_LINES_MISMATCH: 'SALE_WHOLE_RETURN_LINES_MISMATCH',
  NOTHING_TO_RETURN: 'SALE_NOTHING_TO_RETURN',
} as const;
export type SaleErrorSentinel = (typeof SALE_ERROR)[keyof typeof SALE_ERROR];
```

Add `export * from './sales.constants';` to `src/modules/sales/index.ts`.

### Action 1.3 — `src/modules/sales/sales.command.ts`

1. `CreateReturnSchema`: no shape change. Add a comment above it:
   `// S32 — lines[].refundAmount is the cash handed back for that line (0 allowed). A walk-in sale
   // must refund exactly unitPrice × quantity per line (SALE_ERROR.WALK_IN_REFUND_MISMATCH).`
2. Below it, add:

```ts
// S32 (P2) — "return the whole sale": every line still returnable, at its full remaining
// quantity, with ONE refund figure. `lines` lists each such line exactly once with its own restock
// choice; the server splits refundAmount across them in proportion to line value and runs the
// ordinary return. Same walk-in exactness rule as CreateReturnSchema (on the total).
export const ReturnWholeSaleSchema = z.object({
  saleId: z.uuid(),
  type: z.enum(ReturnType),
  reason: z.string().optional(),
  refundAmount: z.number().min(0),
  lines: z.array(z.object({ saleLineId: z.uuid(), restock: z.boolean() })).min(1),
});
export type ReturnWholeSaleCommand = z.infer<typeof ReturnWholeSaleSchema>;
```

### Action 1.4 — `src/modules/sales/sales.query.ts`

1. In `SaleListQuerySchema` add, after `posClientId`:
   ```ts
   // S32 — "search by sold product": any line whose snapshot name contains every typed token, or
   // whose product's barcode starts with the text. Trimmed; blank is dropped by the caller.
   product: z.string().trim().min(1).max(100).optional(),
   ```
2. Replace the comment above the schema so it also says: `from`/`to` are **Africa/Algiers
   calendar days applied to `soldAt`**, `to` inclusive (S32/Q2). Drafts have no `soldAt`, so a
   date filter excludes them.

### Action 1.5 — `src/modules/sales/sales.routes.ts`

Add after `ADMIN_RETURNS_LIST` and after `STAFF_RETURNS_LIST` respectively:

```ts
  // S32 (P2) — return every remaining line of one sale with a single refund figure.
  ADMIN_RETURN_WHOLE_SALE: '/admin/returns/whole-sale',
```
```ts
  STAFF_RETURN_WHOLE_SALE: '/staff/returns/whole-sale',
```

### Action 1.6 — `src/modules/sales/sales.dtos.ts`

1. `refundedAmount` comment (lines 18-22): replace the cap wording with:
   `// S12 — cash refunded against this sale so far (Σ of the negative ClientPayment rows on its
   // invoice). Informational since S32: returns are no longer capped by it. Detail read only.`
2. Below `refundedAmount` add:
   ```ts
   // S32 (P6) — the attached POS client's CURRENT credit (not the sale's snapshot), so the return
   // dialogs can preview previous → new credit. Detail read only; absent for a walk-in sale.
   posClientCredit: z.number().optional(),
   ```

### Action 1.7 — `src/modules/sales/sales.events.ts`

Rewrite the `creditEffect` part of the header comment: since S32 `creditEffect` is
`Σ(refundAmount − linePrice)` over the returned lines, the net change applied to the client's
credit. It is negative when less cash came back than the goods were worth.
`refundAmount` is the cash handed back. No type change.

---

## §2 — Backend (`Apps/api`)

### Action 2.1 — `src/modules/sales/sales.interface.ts`

- Import `ReturnWholeSaleCommand`.
- `ISalesService` gains, after `createReturn`:
  ```ts
  // S32 (P2) — splits one refund across every remaining line and delegates to createReturn.
  returnWholeSale(cmd: ReturnWholeSaleCommand, staffId: string): Promise<SaleDto>;
  ```

### Action 2.2 — `src/modules/sales/sales.mapper.ts`

- `SaleRow.posClient` becomes `Pick<PosClient, 'name' | 'credit'> | null`.
- `toSaleDto`'s ctx gains `posClientCredit?: number`. Emit
  `...(ctx.posClientCredit != null ? { posClientCredit: ctx.posClientCredit } : {})` right after
  the `refundedAmount` spread.

### Action 2.3 — `src/modules/sales/sales.service.ts` — confirm (walk-in exactness)

1. `SALE_INCLUDE.posClient.select` becomes `{ name: true, categoryId: true, credit: true }`.
2. Import `SALE_ERROR` and `storeDayRangeUtc` from the contract.
3. Add a private static helper at the bottom of the class:
   `private static cents(amount: number): number { return Math.round(amount * 100); }` (P1).
4. Replace the guard at lines 136-138 with:
   ```ts
   // S32 — a walk-in sale has nowhere to post a credit or an overpayment, so the till must
   // balance exactly: under-payment keeps its historic sentinel, over-payment gets its own.
   if (existing.posClientId == null) {
     const paidCents = SalesService.cents(cmd.paidAmount);
     const totalCents = SalesService.cents(totalAmount);
     if (paidCents < totalCents) throw new BadRequestError(SALE_ERROR.CREDIT_REQUIRES_CLIENT);
     if (paidCents > totalCents) throw new BadRequestError(SALE_ERROR.WALK_IN_OVERPAYMENT);
   }
   ```
5. Update the comment in the walk-in `else` branch (lines 173-176): the guard now forces
   `paidAmount == totalAmount`, not `>=`. Update the comment at lines 130-132 that names
   `CREDIT_REQUIRES_CLIENT` to say "the walk-in exactness gate".
6. Nothing else in `confirm` changes (F1).

### Action 2.4 — `src/modules/sales/sales.service.ts` — list, detail, returns

**a) `listSales`** — replace the `where` object:
```ts
const where: Prisma.SaleWhereInput = {
  ...(query.status != null ? { status: query.status } : {}),
  // S32/Q2 — store-local (Africa/Algiers) days on soldAt, `to` inclusive. Drafts carry no soldAt
  // and therefore drop out of any date-filtered list.
  ...(query.from != null || query.to != null ? { soldAt: storeDayRangeUtc(query.from, query.to) } : {}),
  ...(query.sellerId != null ? { staffId: query.sellerId } : {}),
  ...(query.posClientId != null ? { posClientId: query.posClientId } : {}),
  ...(query.product != null ? { lines: { some: SalesService.productLineWhere(query.product) } } : {}),
  // S32/F3 — spread LAST so a staff caller's own-sales scoping can never be overridden by a
  // sellerId in the query string (it used to be spread first, and sellerId replaced it).
  ...opts.extraWhere,
};
```
Delete the stale `set-03 A3` comment's claim that "listMySales never forwards these". Keep its
first half, which explains what the filters are for.

Add the private static helper (mirrors catalog's token rule, `catalog.service.ts:1095-1133`, on
the line's **snapshot** name, which is the name the sale was rung up under):
```ts
// S32 — one sale line matches when its product's barcode starts with the text (btree-indexable,
// same choice as catalog's staff search) or its snapshot name contains every whitespace token.
private static productLineWhere(search: string): Prisma.SaleLineWhereInput {
  const tokens = search.trim().split(/\s+/).filter(Boolean);
  return {
    OR: [
      { product: { barcode: { startsWith: search.trim(), mode: 'insensitive' } } },
      { AND: tokens.map((token) => ({ productNameSnapshot: { contains: token, mode: 'insensitive' as const } })) },
    ],
  };
}
```
`lines: { some: … }` returns each sale **once**, even when several of its lines match.

**b) `getSale`** — pass the client's current credit:
```ts
return SalesMapper.toSaleDto(sale as SaleRow, {
  includeMargins: isAdmin,
  refundedAmount,
  ...(sale.posClient != null ? { posClientCredit: sale.posClient.credit.toNumber() } : {}),
});
```
Update the comment above `refundedAmount` (lines 314-317): it no longer feeds a cap (P8).

**c) Extract a private helper** used by both `createReturn` and `returnWholeSale`:
```ts
// Σ returned quantity per saleLineId across every earlier return of this sale.
private async returnedQuantities(saleId: string): Promise<Map<string, number>>
```
Its body is today's lines 370-381 (the `returnLine.findMany` + loop, including its S24 comment).
`createReturn` calls it in place of the inline code.

**d) `createReturn` — rewrite the money part.** Keep the existing guards, the bounds check, the
`Return`/`ReturnLine` create, the restock loop and the status update **unchanged**. Change:

1. In the per-line validation loop (lines 383-392), also compute
   `const lineValue = saleLine.unitPrice.toNumber() * line.quantity;` and accumulate
   `goodsValue += lineValue`. For a walk-in sale (`sale.posClientId == null`), throw
   `new BadRequestError(SALE_ERROR.WALK_IN_REFUND_MISMATCH)` when
   `SalesService.cents(line.refundAmount) !== SalesService.cents(lineValue)`.
   After the loop: `goodsValue = SalesService.cents(goodsValue) / 100;`.
2. Keep the invoice lookup (`select: { id: true, number: true }`). **Delete** `refundedSoFar`,
   `cashRefundable`, `cashRefunded` and the R3/8a comment block (lines 394-414).
3. Replace the `if (sale.posClientId != null) { … }` block (lines 470-495) with:
   ```ts
   if (sale.posClientId != null) {
     // S32 — per returned line: totalSold −= linePrice; credit += (refund − linePrice);
     // totalPaid −= refund. Applied here as the aggregate over the returned lines (the formula is
     // linear). Document charge first (P4), mirroring confirm: it reverses the goods' value on
     // credit and totalSold (never totalPaid). Then the cash handed back is a NEGATIVE ledger row,
     // which raises credit by the refund and lowers totalPaid by it. totalSold is computed
     // directly — never derived from credit + totalPaid (that identity breaks with initialCredit).
     await this.clientCredit.applyDocumentCharge(tx, sale.posClientId, {
       totalSoldDelta: -goodsValue,
       creditDelta: -goodsValue,
     });
     if (refundAmount > 0) {
       refundPayment = await this.billing.captureClientPaymentInTx(tx, {
         posClientId: sale.posClientId,
         ...(invoice != null ? { invoiceId: invoice.id } : {}),
         amount: -refundAmount,
         staffId,
       });
     }
     creditEffect = refundAmount - goodsValue;
   }
   ```
   A walk-in sale gets no ledger row and no credit change, as before. Its refund is recorded on
   `Return.refundAmount` only.
4. Post-commit `payment.clientRecorded`: `amount: -refundAmount` (was `-cashRefunded`).
5. Update the comments: the method header (lines 358-361) gains one line on the S32 arithmetic;
   the `creditEffect` declaration comment (lines 418-420) now reads "S32: Σ(refund − linePrice)".
   Delete every remaining mention of D7, "capped" or "partial return leaves credit unchanged" in
   this method.
6. `cashRefundedSoFar` (lines 572-587) stays. Change its comment: it no longer mirrors a cap, and
   it only feeds the informational `refundedAmount` (P8).

**e) New `returnWholeSale`**, placed directly after `createReturn`:
```ts
// S32 (P2/P3) — every line with a remaining returnable quantity, at that full quantity, with one
// refund figure split by line value (floor for all but the last, remainder on the last — shares
// always sum exactly and never go negative). All money/stock work is createReturn's.
async returnWholeSale(cmd: ReturnWholeSaleCommand, staffId: string): Promise<SaleDto> {
  const sale = await this.prisma.sale.findUnique({ where: { id: cmd.saleId }, include: SALE_INCLUDE });
  if (!sale) throw new NotFoundError('Sale');
  if (sale.status !== PrismaSaleStatus.COMPLETED && sale.status !== PrismaSaleStatus.PARTIALLY_RETURNED) {
    throw new ConflictError('Sale is not eligible for a return');
  }
  const returned = await this.returnedQuantities(sale.id);
  const open = sale.lines
    .map((line) => ({ line, remaining: line.quantity - (returned.get(line.id) ?? 0) }))
    .filter((entry) => entry.remaining > 0);
  if (open.length === 0) throw new ConflictError(SALE_ERROR.NOTHING_TO_RETURN);

  const restockById = new Map(cmd.lines.map((l) => [l.saleLineId, l.restock]));
  if (restockById.size !== cmd.lines.length || restockById.size !== open.length || open.some((e) => !restockById.has(e.line.id))) {
    throw new BadRequestError(SALE_ERROR.WHOLE_RETURN_LINES_MISMATCH);
  }

  const refundCents = SalesService.cents(cmd.refundAmount);
  const valueCents = open.map((e) => SalesService.cents(e.line.unitPrice.toNumber() * e.remaining));
  const totalValueCents = valueCents.reduce((s, v) => s + v, 0);
  let allocated = 0;
  const lines = open.map((entry, index) => {
    const isLast = index === open.length - 1;
    const share = isLast
      ? refundCents - allocated
      : totalValueCents === 0 ? 0 : Math.floor((refundCents * valueCents[index]!) / totalValueCents);
    allocated += share;
    return { saleLineId: entry.line.id, quantity: entry.remaining, restock: restockById.get(entry.line.id)!, refundAmount: share / 100 };
  });

  return this.createReturn(
    { saleId: sale.id, type: cmd.type, ...(cmd.reason != null ? { reason: cmd.reason } : {}), lines },
    staffId,
  );
}
```
The walk-in exactness check runs inside `createReturn` per line. P3 explains why an exact total
always passes. Import `ReturnWholeSaleCommand`.

### Action 2.5 — `src/modules/sales/sales.controller.ts`

Add `returnWholeSale`, same shape as `createReturn`'s handler: body cast to
`ReturnWholeSaleCommand`, `req.user!.staffId!`, `sendSuccess(res, result, 200)`. 200 matches
`createReturn`.

### Action 2.6 — `src/modules/sales/sales.routes.ts`

Import `ReturnWholeSaleSchema`. Register:
```ts
router.post(SALE_ROUTES.ADMIN_RETURN_WHOLE_SALE, adminOnly, validateRequest({ body: ReturnWholeSaleSchema }), controller.returnWholeSale);
```
next to the admin return route, and
```ts
router.post(SALE_ROUTES.STAFF_RETURN_WHOLE_SALE, staffSalesOrAdmin, validateRequest({ body: ReturnWholeSaleSchema }), controller.returnWholeSale);
```
next to the staff return route. The paths differ from `/…/returns`, so there is no conflict.

### Action 2.7 — `src/modules/statistics/statistics.service.ts` — `returnAdjustments` (Q1)

1. In the **sale** `returnLine.findMany` select, add `unitPrice: true` to `saleLine.select`.
2. In the `for (const rl of saleReturnLines)` loop replace
   `const revenue = rl.refundAmount.toNumber();` with
   ```ts
   // S32/Q1 — a sale return reverses the goods' sold value, whatever cash came back: the refund
   // vs. line-price difference went to the client's credit, which is a ledger matter, not revenue.
   const revenue = Math.round(line.unitPrice.toNumber() * rl.quantity * 100) / 100;
   ```
   You may drop `refundAmount: true` from that select. **Do not** touch the order loop. Order
   returns keep revenue = refund (S24).
3. Rewrite the method's header comment. "Owner rule Q1: revenue falls by the refund actually
   given" now applies to **order** returns only. Sale returns fall by line price (S32/Q1). Cost and
   profit rules are unchanged.

No other statistics code changes.

---

## §3 — Frontend (`Apps/web`)

### Action 3.1 — New `src/types/settlement.types.ts`

```ts
// S32 — outcome of checking an entered amount (POS paid amount, return refund) against what is
// due. Walk-ins must match exactly; an attached client may differ, after confirming the credit
// change.
export const SETTLEMENT_CHECK = {
  EMPTY: "empty",
  MATCH: "match",
  WALK_IN_MISMATCH: "walkInMismatch",
  NEEDS_CREDIT_CONFIRM: "needsCreditConfirm",
} as const;
export type SettlementCheck = (typeof SETTLEMENT_CHECK)[keyof typeof SETTLEMENT_CHECK];
```

### Action 3.2 — New `src/lib/settlement.ts`

```ts
import { SETTLEMENT_CHECK, type SettlementCheck } from "@/types/settlement.types";

// Cents comparison (S32/P1) — mirrors the API's own rule so a total like 0.1 + 0.2 still matches.
export const sameMoney = (a: number, b: number): boolean => Math.round(a * 100) === Math.round(b * 100);

export function checkSettlement(entered: number | null | undefined, due: number, hasClient: boolean): SettlementCheck {
  if (entered == null || Number.isNaN(entered)) return SETTLEMENT_CHECK.EMPTY;
  if (sameMoney(entered, due)) return SETTLEMENT_CHECK.MATCH;
  return hasClient ? SETTLEMENT_CHECK.NEEDS_CREDIT_CONFIRM : SETTLEMENT_CHECK.WALK_IN_MISMATCH;
}
```

### Action 3.3 — New `src/components/shared/CreditChangeConfirmDialog.tsx`

Presentational `AlertDialog` (`@/components/ui/alert-dialog`). Props:
```ts
interface CreditChangeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dueLabel: string;      // e.g. "Total" / "Sold price of returned items"
  dueAmount: number;
  enteredLabel: string;  // e.g. "Paid amount" / "Refund entered"
  enteredAmount: number;
  previousCredit: number;
  newCredit: number;
  onConfirm: () => void;
  isConfirming?: boolean;
}
```
Layout: title `common.creditConfirm.title`, description `common.creditConfirm.description`. Two
label/amount rows (`formatDZD`): due, then entered. Below them
`<CreditMovementPreview previousCredit newCredit />`. Footer: `AlertDialogCancel`
(`common.actions.cancel`) and `AlertDialogAction` (`common.creditConfirm.confirm`,
`disabled={isConfirming}`, `onClick={onConfirm}`). Add a short header comment: it is shared by the
POS confirm and both sale-return dialogs (S32), and the caller computes every figure.

### Action 3.4 — `src/pages/staff/pos/components/PosPaymentPanel.tsx`

- `paidAmount: number | null`; `onPaidAmountChange: (paidAmount: number | null) => void`.
- Input: `value={paidAmount ?? ""}`,
  `onChange={(e) => onPaidAmountChange(e.target.value === "" ? null : Number(e.target.value))}`.
  Add `step="0.01"`.
- Delete the `changeDue` computation and its row (P9).
- Update the props/header comments. The preview props are now passed only when a client is
  attached **and** an amount has been entered. The component's job is unchanged.

### Action 3.5 — `src/pages/staff/pos/StaffPos.tsx`

1. `const [paidAmount, setPaidAmount] = useState<number | null>(null);`. **Delete**
   `paidAmountTouched`, its comment and the auto-track `useEffect` (lines 120-122, 157-163).
   `resetTicketState` and `handleOpenDraft` call `setPaidAmount(null)` and lose
   `setPaidAmountTouched`.
2. New state: `const [creditConfirmOpen, setCreditConfirmOpen] = useState(false);`.
3. Split `handleConfirm`:
   - Rename today's body (from `const command = buildDraftCommand();` down) to
     `submitConfirm()`. It sends `{ paidAmount: paidAmount ?? 0 }`. Its `onSuccess` also calls
     `setCreditConfirmOpen(false)`. Its `onError` compares against
     `SALE_ERROR.CREDIT_REQUIRES_CLIENT` (import from the contract) instead of the literal. Add a
     `SALE_ERROR.WALK_IN_OVERPAYMENT` branch that sets the payment error to the
     `staff.pos.payment.walkInMustMatch` message. Either error also calls
     `setCreditConfirmOpen(false)`.
   - New `handleConfirm`:
     ```ts
     const handleConfirm = () => {
       if (lines.length === 0) return;
       setClientZoneError(undefined);
       setPaymentError(undefined);
       // S32 — paid starts empty; a walk-in must pay the exact total; an attached client may pay
       // any amount, but a difference is confirmed against the credit it will leave.
       switch (checkSettlement(paidAmount, total, !!attachedClient)) {
         case SETTLEMENT_CHECK.EMPTY:
           setPaymentError(t("staff.pos.payment.paidAmountRequired"));
           return;
         case SETTLEMENT_CHECK.WALK_IN_MISMATCH:
           setPaymentError(t("staff.pos.payment.walkInMustMatch", { total: formatDZD(total, language) }));
           return;
         case SETTLEMENT_CHECK.NEEDS_CREDIT_CONFIRM:
           setCreditConfirmOpen(true);
           return;
         case SETTLEMENT_CHECK.MATCH:
           submitConfirm();
       }
     };
     ```
   The F4/Enter shortcut keeps calling `handleConfirm`, so it goes through the same checks.
4. `<PosPaymentPanel>`: pass `previousCredit`/`newCredit` only when
   `attachedClient && paidAmount != null`, with
   `newCredit: attachedClient.credit + (total - paidAmount)`. Keep the S5/F4 sign comment.
5. Render once, after `<QuickAddPosClientDialog>`:
   ```tsx
   {attachedClient && paidAmount != null && (
     <CreditChangeConfirmDialog
       open={creditConfirmOpen}
       onOpenChange={setCreditConfirmOpen}
       dueLabel={t("staff.pos.payment.totalDue")}
       dueAmount={total}
       enteredLabel={t("staff.pos.payment.paidAmountLabel")}
       enteredAmount={paidAmount}
       previousCredit={attachedClient.credit}
       newCredit={attachedClient.credit + (total - paidAmount)}
       onConfirm={submitConfirm}
       isConfirming={confirmSale.isPending || isSyncing}
     />
   )}
   ```
6. Import `formatDZD` from `@/lib/utils`, `checkSettlement` from `@/lib/settlement`,
   `SETTLEMENT_CHECK` from `@/types/settlement.types`, and the dialog.

`confirm-sale.schema.ts` is not imported anywhere. Leave it alone.

### Action 3.6 — Data layer

- `src/services/sales.service.ts`: add `returnWholeSale(scope, command: ReturnWholeSaleCommand):
  Promise<SaleDto>`. Copy `createReturn`'s shape, picking `ADMIN_RETURN_WHOLE_SALE` or
  `STAFF_RETURN_WHOLE_SALE` by scope.
- `src/hooks/useSales.ts`: add `useReturnWholeSale()`. Copy `useCreateReturn` exactly: the same
  six invalidations (`qk.sales.all`, `qk.inventory.all`, `qk.billing.all`, `qk.clients.all`,
  `qk.posClients.all`, `qk.stats.all`).
- No new query key. `product`, `from` and `to` already sit inside the `query` object of
  `qk.sales.list(scope, query)`.

### Action 3.7 — `src/pages/staff/sales/components/SalesFilters.tsx`

New props: `productQuery: string`, `onProductQueryChange: (q: string) => void`,
`todayActive: boolean`, `onToggleToday: () => void`. Render them for **both** scopes, right after
the status `Select`:
- an `Input` (`w-56`), placeholder `admin.sales.filters.productSearch`;
- a `Button`, `variant={todayActive ? "default" : "outline"}`, `size="sm"`, label
  `admin.sales.filters.today`, with `aria-pressed={todayActive}`.

The two date inputs, seller and POS-client inputs stay inside the `scope === "admin"` block.
Update the `scope` prop's doc comment: product search and Today are not admin-only.

### Action 3.8 — `src/pages/staff/sales/StaffSales.tsx`

1. Product search: `const [productInput, setProductInput] = useState("");`,
   `const debouncedProduct = useDebouncedValue(productInput, 300);`. The query gains
   `product: debouncedProduct.trim() || undefined` (also add it to the `useMemo` deps).
2. `from`/`to` are no longer scope-gated: `from, to` go straight into the query (P7).
3. Today toggle:
   ```ts
   const today = storeLocalDate(); // contract helper — the Algiers day, not the browser's
   const todayActive = from === today && to === today;
   const handleToggleToday = () => {
     setFrom(todayActive ? undefined : today);
     setTo(todayActive ? undefined : today);
     setPage(1);
   };
   ```
   Pass `productQuery`, `onProductQueryChange` (also `setPage(1)`), `todayActive` and
   `onToggleToday` to `<SalesFilters>`.
4. Whole-sale return: `const [wholeReturnOpen, setWholeReturnOpen] = useState(false);`,
   `const wholeReturnMutation = useReturnWholeSale();`.
   `<SaleDetailDrawer onReturnWholeSale={canReturn ? () => setWholeReturnOpen(true) : undefined}>`.
   Render `<ReturnWholeSaleDialog>` beside `<ReturnDialog>`, with the same `key` expression, plus
   `open`, `onOpenChange`, `sale`, `alreadyReturnedByLine`,
   `onSubmit={(values) => wholeReturnMutation.mutate({ scope, command: values }, { onSuccess: () => setWholeReturnOpen(false) })}`
   and `isSubmitting`.
5. Update the header comment: product search and Today now apply in both scopes, and the date
   filter is on `soldAt` in Algiers days (S32).

### Action 3.9 — `src/pages/staff/sales/components/SaleDetailDrawer.tsx`

New optional prop `onReturnWholeSale?: () => void`. Render an outline `Button size="sm"`
(`admin.sales.detail.returnWholeSale`) right after the **Issue return** button, when the prop is
set.

### Action 3.10 — `src/pages/admin/sales/components/create-return.schema.ts`

Rewrite. Input and output shapes differ, so use the codebase's 3-generic precedent
(`register.schema.ts`: `z.input` / output types and `.transform`, **not** `z.preprocess`):

```ts
export function createReturnSchema(
  t: ReturnType<typeof useTranslation>["t"],
  lineBounds: Record<string, number>,
  linePrices: Record<string, number>, // saleLineId -> unitPrice charged
  hasClient: boolean,
) {
  return z
    .object({
      saleId: z.uuid(),
      type: z.enum(SaleReturnType),
      reason: z.string().optional(),
      lines: z
        .array(
          z.object({
            saleLineId: z.uuid(),
            quantity: z.number().int().min(1, t("admin.sales.returnDialog.quantityMin")),
            restock: z.boolean(),
            // S32 — starts empty; required (0 allowed). Optional on input only.
            refundAmount: z.number().min(0, t("admin.sales.returnDialog.refundAmountInvalid")).optional(),
          }),
        )
        .min(1, t("admin.sales.returnDialog.linesRequired")),
    })
    .superRefine((d, ctx) => {
      d.lines.forEach((line, index) => {
        const bound = lineBounds[line.saleLineId];
        if (bound !== undefined && line.quantity > bound) { /* existing quantityExceedsRemaining issue */ }
        if (line.refundAmount == null) {
          ctx.addIssue({ code: "custom", message: t("admin.sales.returnDialog.refundRequired"), path: ["lines", index, "refundAmount"] });
        } else if (!hasClient && !sameMoney(line.refundAmount, (linePrices[line.saleLineId] ?? 0) * line.quantity)) {
          ctx.addIssue({ code: "custom", message: t("admin.sales.returnDialog.walkInRefundMustMatch"), path: ["lines", index, "refundAmount"] });
        }
      });
    })
    .transform((d) => ({ ...d, lines: d.lines.map((l) => ({ ...l, refundAmount: l.refundAmount ?? 0 })) }));
}
export type CreateReturnFormInput = z.input<ReturnType<typeof createReturnSchema>>;
export type CreateReturnFormValues = z.output<ReturnType<typeof createReturnSchema>>;
```
Keep the `AssertAssignable` check against `CreateReturnCommand` on `CreateReturnFormValues`.
Update the header comment (S32: refund starts empty, walk-in exactness, client confirmation
happens in the dialog).

### Action 3.11 — `src/pages/admin/sales/components/ReturnDialog.tsx`

1. `useForm<CreateReturnFormInput, unknown, CreateReturnFormValues>` with
   `zodResolver(createReturnSchema(t, lineBounds, linePrices, hasClient))`. Build
   `linePrices` from `sale.lines` (`line.id → line.unitPrice`).
   `const hasClient = sale?.posClientId != null`.
2. `toggleLine` appends `{ saleLineId, quantity: 1, restock: true, refundAmount: undefined }`.
   It loses its `unitPrice` parameter.
3. Refund input: replace `valueAsNumber: true` with
   `setValueAs: (raw: string) => (raw === "" ? undefined : Number(raw))` (S3 NaN trap). Show
   `errors.lines?.[index]?.refundAmount?.message` under it. Below the input, show a muted hint
   `t("admin.sales.returnDialog.soldPriceHint", { amount: formatDZD(unitPrice × watched quantity, language) })`.
4. Summary panel (lines 210-234): **delete** the cash-refundable row, the capped warning and the
   full/partial credit-effect line, along with `cashRefundable` and `isFullReturn`. The panel now
   shows:
   - `summaryGoodsValue` = Σ `unitPrice × quantity` over the checked lines;
   - `summaryRefundTotal` = Σ entered refunds (blank counts as 0);
   - when `hasClient` and every checked refund is filled: a `CreditMovementPreview` with
     `previous = sale.posClientCredit ?? 0`, `new = previous + (refundTotal − goodsValue)`.
5. Submit flow:
   ```ts
   const [pending, setPending] = useState<CreateReturnFormValues | null>(null);
   const onValid = (values: CreateReturnFormValues) => {
     // S32 — walk-in exactness is already enforced by the schema; for a client, any line whose
     // refund differs from its sold price is confirmed against the resulting credit first.
     const differs = values.lines.some((l) => !sameMoney(l.refundAmount, (linePrices[l.saleLineId] ?? 0) * l.quantity));
     if (hasClient && differs) setPending(values);
     else onSubmit(values);
   };
   ```
   `<form onSubmit={handleSubmit(onValid)}>`. Render `<CreditChangeConfirmDialog
   open={pending != null} onOpenChange={(o) => !o && setPending(null)}`
   `dueLabel={t("admin.sales.returnDialog.summaryGoodsValue")}`, `dueAmount` = Σ line values of
   `pending`, `enteredLabel={t("admin.sales.returnDialog.summaryRefundTotal")}`, `enteredAmount`
   = Σ refunds of `pending`, `previousCredit = sale.posClientCredit ?? 0`,
   `newCredit = previous + (entered − due)`,
   `onConfirm={() => { if (pending) onSubmit(pending); setPending(null); }}`,
   `isConfirming={isSubmitting}` />.
6. Update the header comment ("Admin-only (ADM-10 §Forms)" is stale since S18. Describe the S32
   rules).

### Action 3.12 — New `src/pages/admin/sales/components/return-whole-sale.schema.ts`

```ts
// S32 (P2) — one refund figure for every remaining line. Same rules as create-return.schema:
// starts empty (0 allowed), a walk-in must refund exactly the remaining goods' value.
export function returnWholeSaleSchema(t, dueTotal: number, hasClient: boolean) {
  return z
    .object({
      saleId: z.uuid(),
      type: z.enum(SaleReturnType),
      reason: z.string().optional(),
      refundAmount: z.number().min(0, t("admin.sales.returnDialog.refundAmountInvalid")).optional(),
      lines: z.array(z.object({ saleLineId: z.uuid(), restock: z.boolean() })).min(1, t("admin.sales.returnDialog.linesRequired")),
    })
    .superRefine((d, ctx) => {
      if (d.refundAmount == null) ctx.addIssue({ code: "custom", message: t("admin.sales.returnDialog.refundRequired"), path: ["refundAmount"] });
      else if (!hasClient && !sameMoney(d.refundAmount, dueTotal)) ctx.addIssue({ code: "custom", message: t("admin.sales.returnDialog.walkInRefundMustMatch"), path: ["refundAmount"] });
    })
    .transform((d) => ({ ...d, refundAmount: d.refundAmount ?? 0 }));
}
```
Export `ReturnWholeSaleFormInput`/`ReturnWholeSaleFormValues` (`z.input`/`z.output`) and an
`AssertAssignable` check against `ReturnWholeSaleCommand`. Type `t` as in
`create-return.schema.ts`.

### Action 3.13 — New `src/pages/admin/sales/components/ReturnWholeSaleDialog.tsx`

Props: `open`, `onOpenChange`, `sale: SaleDto | null`,
`alreadyReturnedByLine?: Record<string, number>`,
`onSubmit: (values: ReturnWholeSaleFormValues) => void`, `isSubmitting?`.

- `openLines` = `sale.lines` with `remaining = quantity − alreadyReturned > 0`.
  `dueTotal = Σ unitPrice × remaining` (rounded to cents).
- `useForm<ReturnWholeSaleFormInput, unknown, ReturnWholeSaleFormValues>`. Default values:
  `{ saleId: sale.id, type: ReturnType.REFUND, refundAmount: undefined, lines: openLines.map((l) => ({ saleLineId: l.id, restock: true })) }`.
- Body, in a `max-h-64 overflow-y-auto` list: per open line, name, `remaining ×`, its value
  (`formatDZD`) and a restock `Switch` (`Controller` on `lines.${i}.restock`, label
  `admin.sales.returnDialog.restockLabel`). Then the single refund `Input`
  (`setValueAs` blank → `undefined`, label `admin.sales.returnDialog.refundAmountLabel`, error
  under it, hint `admin.sales.returnDialog.soldPriceHint` with `dueTotal`). Then the type
  `Select` and reason `Textarea`, copied from `ReturnDialog`. Then the summary: `summaryGoodsValue`
  = `dueTotal`, and the client preview as in Action 3.11 (4).
- Submit: same `pending`/`CreditChangeConfirmDialog` flow as Action 3.11 (5), with
  `due = dueTotal` and `entered = values.refundAmount`. It triggers when
  `hasClient && !sameMoney(values.refundAmount, dueTotal)`.
- Title `admin.sales.wholeReturnDialog.title`, description line
  `admin.sales.wholeReturnDialog.description`, submit button `admin.sales.wholeReturnDialog.submit`.
- `if (!sale || openLines.length === 0) return null;`

### Action 3.14 — `src/lib/query-client.ts`

Import `SALE_ERROR`. Add to `SENTINEL_TRANSLATION_KEYS`, after the S30 block, under a
`// S32 — sales sentinels` comment:
```ts
[SALE_ERROR.WALK_IN_OVERPAYMENT]: "common.errors.sentinel.saleWalkInOverpayment",
[SALE_ERROR.WALK_IN_REFUND_MISMATCH]: "common.errors.sentinel.saleWalkInRefundMismatch",
[SALE_ERROR.WHOLE_RETURN_LINES_MISMATCH]: "common.errors.sentinel.saleWholeReturnLinesMismatch",
[SALE_ERROR.NOTHING_TO_RETURN]: "common.errors.sentinel.saleNothingToReturn",
```
Do **not** map `CREDIT_REQUIRES_CLIENT`. Orders and repairs handle that string inline, and this
set leaves them alone.

### Action 3.15 — `src/config/translations.json`

The real file is `translations.json` (plural). Shape: `{ "en", "fr", "ar": "" }`. A load/modify/dump
with `json.dumps(indent=2, ensure_ascii=False) + "\n"` is byte-safe. Insert each new key next to
its siblings.

**Add:**

| Key | en | fr |
|---|---|---|
| `common.creditConfirm.title` | Confirm the credit change | Confirmer le changement de crédit |
| `common.creditConfirm.description` | The amount entered differs from the amount due. The client's credit will change as shown below. | Le montant saisi diffère du montant dû. Le crédit du client changera comme indiqué ci-dessous. |
| `common.creditConfirm.confirm` | Confirm | Confirmer |
| `staff.pos.payment.paidAmountRequired` | Enter the amount the customer paid | Saisissez le montant payé par le client |
| `staff.pos.payment.walkInMustMatch` | Without a client, the amount paid must equal the total ({total}) | Sans client, le montant payé doit être égal au total ({total}) |
| `staff.pos.payment.totalDue` | Total due | Total dû |
| `admin.sales.filters.productSearch` | Product name or barcode | Nom du produit ou code-barres |
| `admin.sales.filters.today` | Today's sales | Ventes du jour |
| `admin.sales.detail.returnWholeSale` | Return whole sale | Retourner toute la vente |
| `admin.sales.returnDialog.refundRequired` | Enter the refund amount (0 is allowed) | Saisissez le montant remboursé (0 est accepté) |
| `admin.sales.returnDialog.walkInRefundMustMatch` | Without a client, the refund must equal the sold price of the returned quantity | Sans client, le remboursement doit être égal au prix de vente de la quantité retournée |
| `admin.sales.returnDialog.soldPriceHint` | Sold price: {amount} | Prix de vente : {amount} |
| `admin.sales.returnDialog.summaryGoodsValue` | Sold price of returned items | Prix de vente des articles retournés |
| `admin.sales.wholeReturnDialog.title` | Return whole sale | Retourner toute la vente |
| `admin.sales.wholeReturnDialog.description` | Every item still on this sale is returned at once. | Tous les articles restants de cette vente sont retournés en une fois. |
| `admin.sales.wholeReturnDialog.submit` | Return whole sale | Retourner toute la vente |
| `common.errors.sentinel.saleWalkInOverpayment` | Without a client, the amount paid must equal the total | Sans client, le montant payé doit être égal au total |
| `common.errors.sentinel.saleWalkInRefundMismatch` | Without a client, the refund must equal the sold price | Sans client, le remboursement doit être égal au prix de vente |
| `common.errors.sentinel.saleWholeReturnLinesMismatch` | This sale changed since the dialog opened — reopen it and try again | Cette vente a changé depuis l'ouverture — rouvrez-la et réessayez |
| `common.errors.sentinel.saleNothingToReturn` | Nothing left to return on this sale | Plus rien à retourner sur cette vente |

**Reused (confirm they exist, do not re-add):** `common.actions.cancel`,
`staff.pos.payment.paidAmountLabel`, `admin.sales.returnDialog.summaryTitle`,
`summaryRefundTotal`, `refundAmountLabel`, `refundAmountInvalid`, `restockLabel`, `typeLabel`,
`typeRefund`, `typeExchange`, `reasonLabel`, `linesRequired`, `invoices.detail.previousCredit`,
`invoices.detail.newCredit`.

**Delete** each of these if, after the code changes, `grep -rn "<key>" Apps/web/src --include=*.ts --include=*.tsx`
finds no reference: `admin.sales.returnDialog.summaryCashRefundable`, `summaryCashCapped`,
`creditEffectPartial`, `creditEffectFull`, `staff.pos.payment.changeDue`.

---

## §4 — Stage-00 documentation

- `Docs/Stage-00-Conception/Module-Contracts/sales.md`:
  - line 46 (confirm): the walk-in rule becomes "paid must equal the total exactly: under → 400
    `CREDIT_REQUIRES_CLIENT`, over → 400 `SALE_WALK_IN_OVERPAYMENT`".
  - line 47 (returns): replace "Refund defaults to charged price, reducible" with the S32 rule:
    refund starts empty; walk-in refund = `unitPrice × qty` exactly; for a client, per returned
    line `totalSold −= linePrice`, `credit += refund − linePrice`, `totalPaid −= refund` through
    one negative `ClientPayment` row on the sale's invoice, in-transaction on the locked
    `PosClient`.
  - Add `ReturnWholeSaleCommand` beside `CreateReturnCommand` (line 35), and the two
    `…/returns/whole-sale` routes to the API table.
  - `SaleListQuery`: `product`, and `from`/`to` = Algiers days on `soldAt`.
- `Docs/Stage-00-Conception/Pages-Requirements/ADM-10-sales.md` line 9: refund starts empty,
  walk-in exact, client confirmation; add "Return whole sale" and the product search / Today
  filter to line 7.
- `Docs/Stage-00-Conception/Pages-Requirements/STF-02-pos.md` lines 8 and 16: paid amount starts
  empty, no change-due line, walk-in exact, client confirmation dialog.

No schema change, so `database-description.md` and `schema.prisma` are untouched. **No
migration.**

---

## §5 — Validation gate

No test file may be read, edited or run. From the repo root:

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd ../api      && npx tsc --noEmit && npm run lint
cd ../web      && npx tsc --noEmit && npx eslint <every file this set touched or created>
```

**Baselines** (from S31's report; compare and list differences per file):
- `Apps/api`: 198 test-file tsc errors across 29 files; 7 pre-existing lint errors in untouched
  files (`prisma/seed.ts`, `validate-request.middleware.ts`, `orders.service.ts`). `src/` must be
  clean.
- `Apps/web`: `src` tsc clean; lint of touched files clean (run `eslint --fix` for prettier only,
  then re-run without `--fix`).

**Expected new test staleness (report it, do not fix):**
- api: any mock typed as `ISalesService` (it gains `returnWholeSale`). Behavioural staleness in
  `sales.service.spec.ts` / `sales.integration.spec.ts` for the D7 return arithmetic and the
  cash cap. Statistics specs that assert sale-return revenue = refund.
- web: `PosPaymentPanel` tests (`paidAmount` nullable, change-due row gone), `pos.test.tsx`
  (paid no longer pre-filled), `ReturnDialog` tests (refund not pre-filled, summary rows changed).

**Grep sweeps (each must return what is stated):**
- `grep -rn '"CREDIT_REQUIRES_CLIENT"' Apps/web/src` → none (the POS uses `SALE_ERROR`).
- `grep -rn "cashRefundable\|cashRefunded\|refundedSoFar" Apps/api/src Apps/web/src` → none.
- `grep -rn "paidAmountTouched\|changeDue" Apps/web/src` → none.
- `grep -rn "createdAt: {" Apps/api/src/modules/sales/sales.service.ts` → none.
- `git diff -- Apps/api/src/modules/sales/sales.service.ts | grep -nE "^\+.*(totalPaid|tx\.posClient|tx\.clientPayment)"`
  → none. Money moves only through the two injected ports.

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

## §7 — Files touched

**Contract:** `src/common/store-time.ts` (new), `src/index.ts`,
`src/modules/sales/{sales.constants.ts (new), index.ts, sales.command.ts, sales.query.ts, sales.routes.ts, sales.dtos.ts, sales.events.ts}`.

**API:** `src/modules/sales/{sales.interface.ts, sales.mapper.ts, sales.service.ts, sales.controller.ts, sales.routes.ts}`,
`src/modules/statistics/statistics.service.ts`.

**Web:** `src/types/settlement.types.ts` (new), `src/lib/settlement.ts` (new),
`src/components/shared/CreditChangeConfirmDialog.tsx` (new),
`src/pages/staff/pos/{StaffPos.tsx, components/PosPaymentPanel.tsx}`,
`src/services/sales.service.ts`, `src/hooks/useSales.ts`,
`src/pages/staff/sales/{StaffSales.tsx, components/SalesFilters.tsx, components/SaleDetailDrawer.tsx}`,
`src/pages/admin/sales/components/{create-return.schema.ts, ReturnDialog.tsx, return-whole-sale.schema.ts (new), ReturnWholeSaleDialog.tsx (new)}`,
`src/lib/query-client.ts`, `src/config/translations.json`.

**Docs:** `Module-Contracts/sales.md`, `Pages-Requirements/ADM-10-sales.md`,
`Pages-Requirements/STF-02-pos.md`.

**Not touched:** orders and repairs (their `CREDIT_REQUIRES_CLIENT` literals and the order-return
arithmetic stay), billing, clients, inventory, Prisma schema.

---

## §8 — Execution protocol

Execute this set alone, in the action order above (contract → API → web → docs). When it is
finished, write `Docs/Stage-04-Fixes/results/report-S32.md` covering:

1. owner decisions Q1–Q2 and plan decisions P1–P9;
2. findings F1–F4, including whether F3 was reproducible before the fix;
3. every change, by file;
4. the gate results, with test staleness listed per file.

End the report with the §6 checklist verbatim. The owner reviews and approves the report before
S33 begins.
