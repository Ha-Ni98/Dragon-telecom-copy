# Plan — Set 24: statistics correctness (fix) + revenue-source filter

Executes the owner's decisions on `Docs/Stage-04-Fixes/results/findings-S24-statistics.md`,
plus one new feature requested with them.

**Prerequisite:** S23 has landed. No other set is required first.

---

## 0. Decisions in force

### Q1 — how returns net out *(owner delegated the call; decided here)*

**Read-time netting, driven by the refund actually given, netted against the original document's
own period.**

| Term | Rule |
|---|---|
| Revenue reduction | `ReturnLine.refundAmount` |
| Cost reduction | `line.costOfGoods × (returnedQty ÷ line.quantity)` — **only when `restock = true`** |
| Profit reduction | revenue reduction − cost reduction |
| Quantity reduction | `ReturnLine.quantity` — always |
| Period it lands in | the **parent document's** recognition date (`soldAt` / `deliveredAt`), not `returnedAt` |

Why this shape, against the owner's rule *"the return acts like the product was never bought when
the return payment equals the buying price"*:

- Refund = full line price **and** restocked → revenue −full, cost −full, profit −full, qty −full.
  The line's net contribution becomes exactly **0**. That is "never bought", literally.
- Refund < full price (restocking fee, partial refund) → the retained difference stays as revenue
  *and* as profit, which is what actually happened.
- **Not** restocked → the goods are gone, so the cost stays and profit falls by the whole refund.
  The store really did lose that money and that stock.

Netting against the *original* period (rather than booking a contra entry in the return's period)
is the direct reading of "as if never bought". **Consequence the owner should expect:** a return
retrospectively changes an already-reported past period. A report run last month and re-run today
can differ. This is intended, not a bug.

Read-time (no cached net columns) keeps the whole change inside the statistics module, adds no
money cache, and cannot drift out of sync — hard rule 6 stays untouched.

### Q1 blocker — order returns persist nothing today

`Return.saleId` is `NOT NULL` and there is no `orderId`; `orders.service.ts` › `returnOrder`
(line 648) reads `cmd.lines` but **writes no `Return` / `ReturnLine` rows at all**, and always
sets status `RETURNED` even for a partial return. So which order lines came back, and for how
much, is recorded nowhere — only a negative `ClientPayment` row exists, and even that is absent
for an order taken wholly on credit.

Netting orders is therefore **impossible without a schema change**. Rejected alternatives:
treating every `RETURNED` order as fully reversed reintroduces finding A1 (a partial return would
erase the kept goods); deriving the refund from the ledger gives no cost, no quantity, and nothing
at all for credit-only orders.

**Decision: extend `Return` / `ReturnLine` to cover orders (Phase 1).** The standing context
allows schema changes and migrations freely, and this makes orders and sales symmetric.

> **Owner opt-out:** if you would rather not touch the orders write path in this set, say so and
> Phase 1 is dropped — orders then fall back to "a `RETURNED` order contributes 0", which is
> correct only for full returns. Everything else in this plan is unaffected. **Phase 1 is
> recommended.**

### Q2 — the delivery fee is **not** revenue

Orders contribute **`Order.subtotal`**, never `totalAmount`.

Verified on live data — ORD-2026-0003: `totalAmount` 23 500.00, `deliveryFee` 500.00,
`subtotal` **23 000.00** = Σ line totals. The column is exactly the fee-free figure needed, so
this is a field swap, not a new computation.

**Verified: profit needs no change.** `Order.totalProfit` is already computed fee-free —
23 000 − 13 500 (`totalCost`) = **9 500** = the stored `totalProfit`. Had the fee been included it
would read 10 000. Only revenue reads change.

### Q3 — repair labour **is** revenue

Repairs contribute **`Repair.totalAmount`** (= `labourPrice` + `partsTotal`), which is what the
unfiltered path already does — no change there. Repair profit stays `Repair.totalProfit` (S13/R4:
labour is pure profit).

**One irreducible limitation:** labour belongs to no product and therefore to no family. When a
**family** filter is active, only `RepairPart` lines can be attributed, so labour is excluded from
that figure. This is unavoidable, not a defect — Action 4.6 surfaces it in the UI instead of
leaving it silent.

### New feature — revenue-source filter

A third control on the statistics page: **All / Products only / Repairs only**, where
*Products* = sales + orders and *Repairs* = repairs (parts + labour). Applies to the filtered
cards and all four charts. Specified in Actions 2.1, 3.8 and 4.6.

---

## 1. Scope

**Order:** Phase 1 → 2 → 3 → 4. Phase 3 depends on both 1 and 2; Phase 4 depends on 2.

| Phase | Files |
|---|---|
| **1 — schema + orders write side** | `Apps/api/prisma/schema.prisma`, one migration, `Apps/api/src/modules/orders/orders.service.ts` |
| **2 — contract** | `Apps/contract/src/modules/statistics/statistics.enums.ts`, `statistics.query.ts` |
| **3 — backend statistics** | `Apps/api/src/modules/statistics/statistics.service.ts` |
| **4 — frontend** | `AdminStatistics.tsx`, `admin-statistics-filters.tsx`, `report-picker.tsx`, `report-columns.ts`, `admin-statistics-overview-cards.tsx`, `translations.json` |

**Findings covered:** A1–A13 and Q1–Q3. **Q4–Q7 are out of scope** — Q4 (walk-in payments) needs
no change because no payments report exists and `reportAgeing` is already right; Q5/Q6/Q7 are
labelling and attribution questions the owner has not answered.

**Hard rules that bite here:** no magic strings (the new enum goes in the contract, Action 2.1);
every new user-facing string through `t()` with keys in `translations.json`; do not modify any
test file and do not run any suite; update stale comments in anything you touch.

---

# Phase 1 — persist order returns

## 1.1 — `Apps/api/prisma/schema.prisma`

Make `Return` / `ReturnLine` polymorphic over Sale **and** Order. Exactly one side is set on each
row.

```prisma
model Return {
  id           String     @id @default(uuid())
  reference    String     @unique
  saleId       String?    // exactly one of saleId / orderId is set
  orderId      String?
  type         ReturnType
  reason       String?
  refundAmount Decimal    @db.Decimal(12, 2)
  returnedAt   DateTime   @default(now())
  staffId      String

  sale  Sale?        @relation(fields: [saleId], references: [id])
  order Order?       @relation(fields: [orderId], references: [id])
  staff Staff        @relation(fields: [staffId], references: [id])
  lines ReturnLine[]
}

model ReturnLine {
  id           String  @id @default(uuid())
  returnId     String
  saleLineId   String? // exactly one of saleLineId / orderLineId is set
  orderLineId  String?
  quantity     Int
  restock      Boolean // true => RETURN_IN at consumed cost
  refundAmount Decimal @db.Decimal(12, 2)

  return    Return     @relation(fields: [returnId], references: [id])
  saleLine  SaleLine?  @relation(fields: [saleLineId], references: [id])
  orderLine OrderLine? @relation(fields: [orderLineId], references: [id])
}
```

Add the back-relations: `returns Return[]` on `Order`, `returnLines ReturnLine[]` on `OrderLine`.

**Migration:** `npx prisma migrate dev --name order_returns`. It drops two `NOT NULL`s and adds
two nullable columns plus their FKs — non-destructive. **No backfill**: existing `Return` rows keep
their `saleId` and are already correct (hard rule 7).

Do **not** add a `PARTIALLY_RETURNED` value to `OrderStatus`. An order takes at most one return
and the line rows now carry the detail; the status stays `RETURNED` and the netting in Phase 3
reads the rows, not the status.

## 1.2 — `orders.service.ts` › `returnOrder`

Inside the existing `this.prisma.$transaction` (opens line 685), **before** the
`tx.order.update({ ... status: RETURNED })` at line 725, write the return document — mirroring
`sales.service.ts` › `createReturn` (lines 420–441) exactly, including how it obtains its
reference from `this.sequence.nextNumber(tx, DocType.RETURN)`:

```ts
      // S24 — an order return is now a first-class document, exactly like a sale's. Statistics
      // nets returned lines out of revenue/profit/quantity at read time (owner rule Q1: a
      // full-price refund makes it as if the product was never bought), and that is impossible
      // without a per-line record — previously only the negative ClientPayment row survived, and
      // a credit-only order left no trace at all.
      const returnReference = await this.sequence.nextNumber(tx, DocType.RETURN);
      await tx.return.create({
        data: {
          reference: returnReference,
          orderId: existing.id,
          type: PrismaReturnType.REFUND,
          ...(cmd.reason != null ? { reason: cmd.reason } : {}),
          refundAmount: cmd.refundAmount,
          staffId,
          lines: {
            create: cmd.lines.map((cmdLine) => ({
              orderLineId: cmdLine.orderLineId,
              quantity: cmdLine.quantity,
              restock: cmd.restock,
              // Per-line share of the refund, proportional to what the line contributed. The
              // command carries one order-level refundAmount (unlike sales, which is per line).
              refundAmount:
                cmd.refundAmount *
                (lineById.get(cmdLine.orderLineId)!.unitPrice.toNumber() * cmdLine.quantity) /
                returnedGoodsValue,
            })),
          },
        },
      });
```

Compute `returnedGoodsValue` immediately **before** the transaction opens (it needs only
`lineById`, already built at line 655):

```ts
    // Denominator for splitting the order-level refund across returned lines. Guarded: a
    // zero-value return (every returned line priced at 0) would divide by zero.
    const returnedGoodsValue = cmd.lines.reduce(
      (sum, cmdLine) => sum + lineById.get(cmdLine.orderLineId)!.unitPrice.toNumber() * cmdLine.quantity,
      0,
    );
```

and in the `create` above use `returnedGoodsValue > 0 ? …proportional… : 0`.

`cmd.restock` is order-level (one boolean for the whole return), so every line stores the same
value — unlike sales, where `restock` is per line. That asymmetry is real and should be noted in
the comment.

Imports to add: `DocType` and `ReturnType as PrismaReturnType` if not already imported — check the
file's existing import block first; `sequence` is already a constructor dependency (used elsewhere
in this service).

---

# Phase 2 — contract

## 2.1 — `Apps/contract/src/modules/statistics/statistics.enums.ts`

Append (hard rule 1 — this value crosses front/back, so it lives here, not in either side's
`types` folder):

```ts
// S24 — the statistics page's revenue-source filter. PRODUCTS = sales + orders (goods sold);
// REPAIRS = repairs, whose revenue is parts + labour (Q3). Labour has no product and therefore
// no family, so a REPAIRS/ALL figure combined with a familyId filter necessarily drops it.
export enum RevenueSource {
  ALL = 'all',
  PRODUCTS = 'products',
  REPAIRS = 'repairs',
}
```

The module's `index.ts` re-exports with `export *` — no barrel edit needed (verify).

## 2.2 — `Apps/contract/src/modules/statistics/statistics.query.ts`

Import `RevenueSource` alongside the existing enum imports, and add the field to **both** query
schemas — optional, so every existing caller keeps working and the default stays "all":

```ts
export const FilteredQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  familyId: z.uuid().optional(),
  source: z.enum(RevenueSource).optional(),   // S24 — omitted means ALL
});

export const ChartsQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  familyId: z.uuid().optional(),
  source: z.enum(RevenueSource).optional(),   // S24 — omitted means ALL
});
```

**No other contract change.** `ReportQuerySchema`, `TopProductsQuerySchema` and every response
schema are untouched — `ReportResponseSchema.totals` already exists (A4 is purely a rendering
gap). No controller or route change either: `validateRequest` parses against these schemas and the
controller already forwards `req.validated.query` wholesale.

---

# Phase 3 — backend statistics

All actions in `Apps/api/src/modules/statistics/statistics.service.ts`.

## 3.1 — recognised-status constants *(A1)*

Replace the constant block at lines 22–30:

```ts
// D2 (S10) — cost and profit are stamped at COMPLETED only. RETURNED is included because S24
// nets returns out of the figures rather than dropping the document: an order flips straight to
// RETURNED whether the return was partial or full (orders.service.ts returnOrder), so excluding
// it would erase the goods the client kept.
const ORDER_RECOGNIZED_STATUSES = ['COMPLETED', 'RETURNED'] as const;

// S24 (A1) — a sale that has seen a return is still a recognised sale; the returned lines are
// subtracted by returnAdjustments() below. Previously only COMPLETED was listed, so a single
// returned item erased the entire sale from every figure in this file.
const SALE_RECOGNIZED_STATUSES = ['COMPLETED', 'PARTIALLY_RETURNED', 'RETURNED'] as const;

// D8/D9 (S13/S14 R1) — repairs recognise at PICKED_UP and produce no Sale row. Repairs have no
// return path at all (a repair is terminal at PICKED_UP), so nothing is ever netted out of them.
const REPAIR_RECOGNIZED_STATUS = 'PICKED_UP' as const;
```

Then replace **every** `status: 'COMPLETED'` on a `sale` / `saleLine` query with
`status: { in: [...SALE_RECOGNIZED_STATUSES] }` — lines 330, 362, 405, 474, 508, 570, 645, 704,
813. Leave `getStaffDashboard`'s draft/`COMPLETED` sale queries (lines 286, 292) **alone**:
"my sales today" is a till-count of what was rung up, not a revenue figure.

## 3.2 — the shared return-netting reader *(A1)*

Add beside `productLineTotals` (which it mirrors — the codebase's "write the union once" rule):

```ts
// S24 (A1) — every returned line, enriched with everything any consumer needs to subtract it
// from the right bucket. Owner rule Q1: revenue falls by the refund actually given; cost falls
// only if the goods came back (restock); profit is the difference; quantity always falls. The
// row is dated by the PARENT document's recognition date, not returnedAt — a return restates the
// period in which the sale happened ("as if never bought"), it is not a contra entry in the
// period the refund was issued.
type ReturnAdjustment = {
  productId: string;
  familyId: string;
  posClientId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  sellerStaffId: string | null; // sales only; orders have no owning seller (D-b)
  recognizedAt: Date;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
};

private async returnAdjustments(
  range: { from?: Date; to?: Date },
  familyId?: string,
  source: RevenueSource = RevenueSource.ALL,
): Promise<ReturnAdjustment[]> {
  if (source === RevenueSource.REPAIRS) return []; // repairs have no return path
  const filter = this.dateRangeFilter(range);

  const [saleReturnLines, orderReturnLines] = await Promise.all([
    this.prisma.returnLine.findMany({
      where: {
        saleLineId: { not: null },
        saleLine: {
          ...(familyId != null ? { product: { familyId } } : {}),
          sale: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, ...(filter ? { soldAt: filter } : {}) },
        },
      },
      select: {
        quantity: true, restock: true, refundAmount: true,
        saleLine: {
          select: {
            quantity: true, costOfGoods: true, productId: true,
            product: { select: { familyId: true } },
            sale: {
              select: {
                soldAt: true, staffId: true, posClientId: true,
                posClient: { select: { categoryId: true, category: { select: { name: true } } } },
              },
            },
          },
        },
      },
    }),
    this.prisma.returnLine.findMany({
      where: {
        orderLineId: { not: null },
        orderLine: {
          ...(familyId != null ? { product: { familyId } } : {}),
          order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) },
        },
      },
      select: {
        quantity: true, restock: true, refundAmount: true,
        orderLine: {
          select: {
            quantity: true, costOfGoods: true, productId: true,
            product: { select: { familyId: true } },
            order: {
              select: {
                deliveredAt: true,
                client: { select: { posClient: { select: { id: true, categoryId: true, category: { select: { name: true } } } } } },
              },
            },
          },
        },
      },
    }),
  ]);

  const rows: ReturnAdjustment[] = [];
  for (const rl of saleReturnLines) {
    const line = rl.saleLine!;
    const revenue = rl.refundAmount.toNumber();
    // Proportional share of the line's stored FIFO cost — reversed only when the goods actually
    // re-entered stock. Not restocked => the store lost them, so the cost stands.
    const cost = rl.restock && line.quantity > 0
      ? line.costOfGoods.toNumber() * (rl.quantity / line.quantity)
      : 0;
    rows.push({
      productId: line.productId,
      familyId: line.product.familyId,
      posClientId: line.sale.posClientId,
      categoryId: line.sale.posClient?.categoryId ?? null,
      categoryName: line.sale.posClient?.category?.name ?? null,
      sellerStaffId: line.sale.staffId,
      recognizedAt: line.sale.soldAt!,
      quantity: rl.quantity,
      revenue, cost, profit: revenue - cost,
    });
  }
  for (const rl of orderReturnLines) {
    const line = rl.orderLine!;
    const revenue = rl.refundAmount.toNumber();
    const cost = rl.restock && line.quantity > 0
      ? (line.costOfGoods?.toNumber() ?? 0) * (rl.quantity / line.quantity)
      : 0;
    const posClient = line.order.client?.posClient;
    rows.push({
      productId: line.productId,
      familyId: line.product.familyId,
      posClientId: posClient?.id ?? null,
      categoryId: posClient?.categoryId ?? null,
      categoryName: posClient?.category?.name ?? null,
      sellerStaffId: null,
      recognizedAt: line.order.deliveredAt!,
      quantity: rl.quantity,
      revenue, cost, profit: revenue - cost,
    });
  }
  return rows;
}
```

Import `RevenueSource` from `@dragon-telecom/contract` at the top of the file.

## 3.3 — `computeRevenueProfit` *(A1, Q2, Q3, source filter)*

Signature becomes
`(range, familyId?: string, source: RevenueSource = RevenueSource.ALL)`.

**Document path** (lines 359–384): run each aggregate only when the source allows it, and swap the
order figure to `subtotal`:

- sales aggregate: skip when `source === REPAIRS`; `_sum: { totalAmount: true, totalProfit: true }`
  unchanged.
- orders aggregate: skip when `source === REPAIRS`; **`_sum: { subtotal: true, totalProfit: true }`**
  — `subtotal` replaces `totalAmount` (Q2: the delivery fee is not revenue). `totalProfit` is
  already fee-free; do not adjust it.
- repairs aggregate: skip when `source === PRODUCTS`; unchanged (`totalAmount` = parts + labour).

**Family path** (lines 326–357): gate the same three queries on `source`; the line-level sums are
already fee-free and labour-free, so no field change.

**Both paths** then subtract:

```ts
  const adjustments = await this.returnAdjustments(range, familyId, source);
  const returnedRevenue = adjustments.reduce((sum, a) => sum + a.revenue, 0);
  const returnedProfit = adjustments.reduce((sum, a) => sum + a.profit, 0);
  return { revenue: revenue - returnedRevenue, profit: profit - returnedProfit };
```

Update the method's comment block (lines 316–324) — it currently states the figure is
`Σ COMPLETED Sale + Σ COMPLETED Order + Σ PICKED_UP Repair` with no mention of returns, of
`subtotal`, or of the source filter (hard rule 4).

## 3.4 — `countRecognizedOrders` *(A1, source filter)*

An order whose every line came back in full "never happened" and must not be counted; a partially
returned order is still a real order. Signature gains `source`; return `0` immediately when
`source === RevenueSource.REPAIRS`.

```ts
  const orders = await this.prisma.order.findMany({
    where: {
      status: { in: [...ORDER_RECOGNIZED_STATUSES] },
      deliveredAt: { gte: from, lt: toExclusive },          // see 3.5
      ...(familyId != null ? { lines: { some: { product: { familyId } } } } : {}),
    },
    select: { id: true, lines: { select: { id: true, quantity: true } } },
  });
  if (orders.length === 0) return 0;

  const lineIds = orders.flatMap((o) => o.lines.map((l) => l.id));
  const returned = await this.prisma.returnLine.groupBy({
    by: ['orderLineId'],
    where: { orderLineId: { in: lineIds } },
    _sum: { quantity: true },
  });
  const returnedByLineId = new Map(returned.map((r) => [r.orderLineId!, r._sum.quantity ?? 0]));

  // Counted unless every line was returned in full (owner rule Q1 — a fully returned order is
  // as if it never happened; a partial return leaves a real order).
  return orders.filter((o) => o.lines.some((l) => l.quantity - (returnedByLineId.get(l.id) ?? 0) > 0)).length;
```

## 3.5 — the date-range off-by-one *(A2)*

`dateRangeFilter` (line 433) must make `to` an **exclusive next-midnight** bound, mirroring
`inventory.service.ts` › `listMovements` (line 439), which is the existing correct pattern:

```ts
  // S24 (A2) — `to` arrives as a bare YYYY-MM-DD, which parses to midnight, so an inclusive
  // `lte` silently dropped the whole final day — and the UI's default range ends *today*, so
  // today's business never appeared in any figure. Same +1-day exclusive bound
  // inventory.service.ts#listMovements already uses.
  private dateRangeFilter(range: { from?: Date; to?: Date }): { gte?: Date; lt?: Date } | undefined {
    if (range.from == null && range.to == null) return undefined;
    return {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lt: new Date(range.to.getTime() + DAY_MS) } : {}),
    };
  }
```

Then fix the four **inline** `lte: to` sites that bypass this helper — `countRecognizedOrders`
(392), `chartDailyRevenue` (474, 480, 487, 508, 510, 514), `chartDailyOrderCounts` (540),
`chartSalesByFamily` (570, 574, 578). Introduce one `const toExclusive = new Date(to.getTime() + DAY_MS)`
per method and use `lt: toExclusive` throughout.

`getFiltered` (lines 74–78) needs no change beyond this — but note its previous-period window
(`prevTo = from`) now correctly abuts rather than overlapping, since the current window's lower
bound is `gte: from` and the previous window's upper bound becomes `lt: from`.

## 3.6 — remaining report fixes

**A3 — `reportStockMovements`** (line 890): add a direction filter so reservations can never
appear as stock movement.

```ts
    const groups = await this.prisma.stockMovement.groupBy({
      by: ['type'],
      // S24 (A3) — IN/OUT only. The three PENDING types are reservations: they move no layers and
      // must never be reported as stock in or out.
      where: { direction: { in: ['IN', 'OUT'] }, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
      _sum: { quantity: true },
      _count: { _all: true },
    });
```

**A5 — `reportRepairs`** (lines 916–951): the workload rows stay on `intakeAt`, but the money must
not. Delete `revenue`, `cost` and `profit` from the row objects entirely and rename the row's
`totalAmount` key to **`accruedAmount`**, so nothing on a row can be read as recognised revenue.
`totals.recognized*` (already on the correct `pickedUpAt` basis) becomes the report's single money
answer — and Action 4.2 makes totals visible for the first time. Update the comment at 911–915,
which describes the old two-view split. Add `accruedAmount` to `REPORT_COLUMN_KEY` (Action 4.3).

**A7 — `reportClientBrowsing`** (lines 1048–1050): gate the three "purchased" queries on the
recognised statuses. Keep the deliberate absence of a *date* filter and its comment (1030–1031).

```ts
      this.prisma.saleLine.findMany({
        where: { sale: { status: { in: [...SALE_RECOGNIZED_STATUSES] } } },
        select: { productId: true }, distinct: ['productId'],
      }),
      this.prisma.orderLine.findMany({
        where: { order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] } } },
        select: { productId: true }, distinct: ['productId'],
      }),
      this.prisma.repairPart.findMany({
        where: { repair: { status: REPAIR_RECOGNIZED_STATUS } },
        select: { productId: true }, distinct: ['productId'],
      }),
```

**A10 + Q2 — `reportSalesByCategory`** (lines 699–803): three corrections.

1. Orders: revenue must exclude the delivery fee — the loop is already line-level, so it is
   already correct. **Do not change it**; instead fix the *other* reports (below) to match.
2. Sales: replace the per-line `unitPrice × quantity` accumulation with the line's stored
   `lineTotal`, and subtract the sale's `discountAmount` once per document, so the row ties to
   `Sale.totalAmount`. Select `discountAmount` on the sale query.
3. Repairs: increment `existing.quantity` by `Σ repair.parts.quantity` (select `parts: { select: { quantity: true } }`)
   so the quantity column stops silently excluding repair parts.

Then subtract returns per category from `revenue`, `cost`, `profit` and `quantity` using
`returnAdjustments(range)` grouped by `categoryId`.

**A11 — `reportAgeing`**: no backend change. The snapshot semantics are correct; Action 4.5 stops
the UI implying otherwise.

**`reportSalesByProduct` / `getTopProducts` / `productLineTotals`** (lines 401–426): subtract
returns by `productId` — `quantity -= a.quantity`, `revenue -= a.revenue`. Drop any product whose
netted quantity and revenue both reach 0. `productLineTotals` gains the same
`(range, familyId?, source?)` signature so the source filter reaches top products too.

**`reportSalesByClient`** (lines 640–686): orders must contribute **`subtotal`**, not `totalAmount`
(Q2) — change the `select` and the accumulation at line 669. Then subtract returns grouped by
`posClientId` (skipping `null`, matching the report's existing walk-in exclusion).

**`reportSalesBySeller`** (lines 808–886): same `subtotal` swap for the orders branch (line 844),
then subtract returns grouped by `sellerStaffId`, with `null` folding into
`UNASSIGNED_SELLER_BUCKET`.

## 3.7 — charts *(A1, A2, A6, Q2, source filter)*

- **`chartDailyRevenue`**: gate each of the three queries on `source`; orders use **`subtotal`**
  (document path); subtract `returnAdjustments` bucketed by `recognizedAt`'s day. Apply 3.5's
  exclusive bound.
- **`chartDailyOrderCounts`**: return `[]` when `source === REPAIRS`; otherwise unchanged apart
  from 3.5.
- **`chartSalesByFamily`** *(A6)*: change the signature to `(from, to, familyId?, source?)` and
  **pass `query.familyId` from `getChart`** (line 110), filtering each of the three line queries on
  `product: { familyId }` when set. Gate on `source`. Subtract returns grouped by `familyId`.
  **Delete the incorrect claim** in the comment at lines 101–103 ("which is already what happens
  today") and state plainly that the chart now honours the filter, collapsing to a single bar.
- **`chartDailyNewClients`**: unchanged; it is family- and source-agnostic by nature. Its existing
  comment stays accurate — extend it to mention `source` as well.

## 3.8 — `getChart` and `getFiltered` plumbing *(source filter)*

`getFiltered` (line 73) passes `query.source` into both `computeRevenueProfit` calls and both
`countRecognizedOrders` calls — current **and** previous window, so the comparison stays
like-for-like. `getChart` (line 104) passes `query.source` into all four chart methods.

`getOverview` is **all-time and unfiltered by design** — it takes no query at all. Do not add
`source` to it. It still gains the A1 return-netting and the Q2 `subtotal` swap through
`computeRevenueProfit({})`.

---

# Phase 4 — frontend

## 4.1 — `admin-statistics-filters.tsx` — the new control *(feature)*

Add a third filter beside date range and family. Props gain
`selectedSource: RevenueSource` and `onSourceChange: (source: RevenueSource) => void`.

- Change the grid at line 192 from `md:grid-cols-2` to `md:grid-cols-3`.
- New block mirroring the family `Select` (lines 266–288): a `Select` over
  `Object.values(RevenueSource)`, labels via `t("admin.statistics.filters.source." + value)`, with
  the same "current selection" summary panel beneath it.
- `hasActiveFilters` (line 75) gains `|| selectedSource !== RevenueSource.ALL`.
- `handleClearFilters` (line 127) resets it to `RevenueSource.ALL`.
- The active-filter badge row (lines 296–305) gains a badge when it is not `ALL`.

## 4.2 — `report-picker.tsx` — render `totals` *(A4)*

Below the `DataTable` (after line 197), render `report.data.totals` as a summary strip — the
figures every report computes and none has ever displayed:

```tsx
{report.data && Object.keys(report.data.totals).length > 0 && (
  <div className="flex flex-wrap gap-4 border-t pt-4">
    {Object.entries(report.data.totals).map(([key, value]) => (
      <div key={key} className="text-sm">
        <span className="text-muted-foreground">{t(REPORT_COLUMN_KEY[key] ?? key)}: </span>
        <span className="font-medium">{formatReportValue(key, value, language)}</span>
      </div>
    ))}
  </div>
)}
```

## 4.3 — `report-picker.tsx` + `report-columns.ts` — money formatting *(A8)*

In `report-columns.ts` add, beside `REPORT_COLUMN_KEY`:

```ts
// S24 (A8) — report cells were rendered with a bare `toLocaleString()`: no currency, and no
// locale argument, so money followed the browser rather than the app language (the same defect
// S14/F5 fixed in the stat cards). These keys render through formatDZD; everything else stays an
// integer count.
export const REPORT_MONEY_KEYS = new Set([
  "revenue", "cost", "profit", "discount", "resolvedRevenue", "spend", "totalAmount",
  "accruedAmount", "clientOutstanding", "supplierOutstanding",
  "totalRevenue", "totalDiscount", "totalSpend",
  "recognizedRevenue", "recognizedCost", "recognizedProfit",
  "totalClientOutstanding", "totalSupplierOutstanding",
]);
```

Add the new column/total keys to `REPORT_COLUMN_KEY`: `accruedAmount`, `totalRevenue`,
`totalDiscount`, `totalSpend`, `recognizedRevenue`, `recognizedCost`, `recognizedProfit`,
`totalClientOutstanding`, `totalSupplierOutstanding`, `movementTypeCount`, `totalRepairs`,
`topSearchCount`, `zeroPurchaseProductCount`.

In `report-picker.tsx` replace `formatCellValue` with a key-aware
`formatReportValue(key, value, language)`: money keys → `formatDZD(value, language)`; other
numbers → `value.toLocaleString(language)`; `null`/`undefined` → `"—"`; otherwise `String(value)`.
Update both call sites (the table cell at line 84 and the mobile row at line 192) to pass the key.

## 4.4 — `report-picker.tsx` — column derivation *(A9)*

Replace `Object.keys(rows[0])` (line 72) with the **union of every row's keys**, preserving
first-seen order, so `client-browsing`'s two row shapes both render:

```tsx
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
```

## 4.5 — `report-picker.tsx` — ageing has no date range *(A11)*

When `type === ReportType.AGEING`, render a short note
(`t("admin.statistics.reports.ageingSnapshotNote")`) beneath the report select stating that ageing
is measured as of today and ignores the date range. No backend change — the snapshot semantics are
correct, only the silence was wrong.

## 4.6 — `AdminStatistics.tsx` *(feature, A12, and the labour caveat)*

- New URL-synced `selectedSource` state mirroring `selectedFamily` (lines 35–37, 61–71): read from
  `searchParams.get("source")`, defaulting to `RevenueSource.ALL`; written back by
  `updateURLParams` (omit the param when `ALL`); new `handleSourceChange`.
- `filterQuery` (line 39) gains
  `source: selectedSource !== RevenueSource.ALL ? selectedSource : undefined`. Both `useFiltered`
  and all four `useChart` calls already receive `filterQuery`, so they pick it up with no other
  change — and `qk.stats.filtered(query)` / `qk.stats.chart(chart, query)` hash the whole object,
  so **no `query-keys.ts` change is needed**.
- Pass `selectedSource` / `onSourceChange` into `AdminStatisticsFilters`.
- **A12** — `useTopProducts({})` (line 54) is all-time and cannot express the selected range
  (`TopProductsQuery.period` is a coarse `week|month|year` string and carries no `familyId`).
  Rather than widening the contract, give the widget an explicit
  `t("admin.statistics.topProducts.allTimeNote")` caption so it stops reading as filtered. **If the
  owner would rather it follow the filters, say so — that needs `TopProductsQuerySchema` extended
  with `from`/`to`/`familyId`/`source`, which is a contract change deliberately not taken here.**
- **Q3 caveat** — when `selectedFamily !== "all"`, render
  `t("admin.statistics.filters.familyExcludesLabourNote")` beneath the filter card: repair labour
  belongs to no family and is therefore excluded from family-filtered figures.

## 4.7 — `admin-statistics-overview-cards.tsx` *(A13)*

No code change beyond copy. Reword two existing translation values (Action 4.8) so they stop
saying "from all sales" for a figure that includes orders and repairs, and add an
`t("admin.statistics.overview.allTimeNote")` line in the card header noting the block is all-time
and unaffected by the filters below it.

## 4.8 — `Apps/web/src/config/translations.json`

New keys (all three locales — `en`, `fr`, and `ar` following the file's existing convention):

| Key | English |
|---|---|
| `admin.statistics.filters.source` | Revenue source |
| `admin.statistics.filters.selectSource` | Select a source |
| `admin.statistics.filters.source.all` | Products and repairs |
| `admin.statistics.filters.source.products` | Products only |
| `admin.statistics.filters.source.repairs` | Repairs only |
| `admin.statistics.filters.familyExcludesLabourNote` | Repair labour is not linked to a family and is excluded while a family filter is active. |
| `admin.statistics.reports.totals` | Totals |
| `admin.statistics.reports.ageingSnapshotNote` | Ageing is measured as of today and does not use the selected date range. |
| `admin.statistics.topProducts.allTimeNote` | All time — not affected by the filters above. |
| `admin.statistics.overview.allTimeNote` | All time — not affected by the filters below. |
| `admin.statistics.reports.columns.accruedAmount` | Accrued amount |
| `admin.statistics.reports.columns.totalRevenue` | Total revenue |
| `admin.statistics.reports.columns.totalDiscount` | Total discount |
| `admin.statistics.reports.columns.totalSpend` | Total spend |
| `admin.statistics.reports.columns.recognizedRevenue` | Recognised revenue |
| `admin.statistics.reports.columns.recognizedCost` | Recognised cost |
| `admin.statistics.reports.columns.recognizedProfit` | Recognised profit |
| `admin.statistics.reports.columns.totalClientOutstanding` | Total client outstanding |
| `admin.statistics.reports.columns.totalSupplierOutstanding` | Total supplier outstanding |
| `admin.statistics.reports.columns.movementTypeCount` | Movement types |
| `admin.statistics.reports.columns.totalRepairs` | Total repairs |
| `admin.statistics.reports.columns.topSearchCount` | Top searches |
| `admin.statistics.reports.columns.zeroPurchaseProductCount` | Viewed, never purchased |

Reworded existing values *(A13)*:

| Key | New English |
|---|---|
| `admin.statistics.overview.descriptions.totalRevenue` | All-time revenue from sales, orders and repairs |
| `admin.statistics.overview.descriptions.totalProfit` | All-time profit after costs, net of returns |

---

## 5. Validation gates

Compile and lint only — **no test file may be edited and no suite may be run** (hard rule 3).

1. `cd Apps/contract && npx tsc --noEmit` — must be clean.
2. `cd Apps/api && npx prisma generate` (required — Phase 1 changes the schema).
3. `cd Apps/api && npx tsc --noEmit` — `src/**` must be clean. Capture the full output and compare
   the `test/**` portion against the pre-change baseline via `git stash`; it must not grow.
   **Expect it to grow here**: Phase 1's `Return`/`ReturnLine` shape change will break test
   fixtures that construct those rows. Record every new line in the report as a known consequence;
   **do not edit the fixtures.**
4. `cd Apps/api && npm run lint` — must not add findings versus baseline.
5. `cd Apps/web && npx tsc --noEmit && npm run lint` — `tsc` must be clean; lint must not add
   findings versus its (large, pre-existing) baseline.
6. `grep -rn "'COMPLETED'" Apps/api/src/modules/statistics/statistics.service.ts` — every
   remaining hit must be a deliberate one (`getStaffDashboard`'s till count).

### Known-failing tests to report, not fix

S23 already left `inventory.service.spec.ts:308` failing. This set will add more: anything
asserting statistics revenue against `COMPLETED`-only sales, and any fixture building a `Return`
or `ReturnLine`. Enumerate them in the report under a "known-failing tests" heading with the
reason each one now fails.

---

## 6. Manual verification checklist

**Baseline first.** *Admin → Statistics* → record **Total Revenue** and **Total Profit**. On
current data they read **129 600.00** and **61 300.00**.

1. **A1 — returns net instead of erasing.** After the fix, Total Revenue reads **179 100.00** and
   Total Profit **82 200.00** — the two `PARTIALLY_RETURNED` sales are back in, each reduced by
   its returned line rather than removed. Cross-check one:
   `SAL-2026-0002` should contribute **23 000.00** (24 800 − 1 800) and **8 400.00** profit
   (9 200 − 800).
2. **A1 — a fresh return behaves.** Complete a POS sale of two different products. Note revenue.
   Return one line at full price **with restock**: revenue falls by exactly that line's total,
   profit by exactly that line's profit, and the other line still counts. Return it again
   **without restock** on another sale: revenue falls by the refund but profit falls by the *whole
   refund* (the cost stays — the goods did not come back).
3. **Q1 — order returns are now recorded.** Return part of a COMPLETED order. Check the rows exist:
   `SELECT r.reference, r."orderId", rl."orderLineId", rl.quantity, rl."refundAmount"
    FROM "Return" r JOIN "ReturnLine" rl ON rl."returnId" = r.id WHERE r."orderId" IS NOT NULL;`
   Then confirm the order's kept lines still contribute revenue.
4. **A2 — today counts.** Set the range to **This Month**, note revenue, ring up a sale **today**,
   refresh. The figure moves. (Before this fix it did not.)
5. **Q2 — the delivery fee is out.** ORD-2026-0003 has a 500.00 fee. *Reports → Sales by client*
   now shows **23 000.00** for that client's order, matching *Sales by category*. The two reports
   agree; before, they differed by exactly 500.00.
6. **Q3 — labour is in.** *Reports → Repairs* recognised revenue includes REP-2026-0001's
   2 500.00 labour (total 4 100.00, of which 1 600.00 is parts).
7. **New filter.** Set **Revenue source → Products only**: revenue drops by the repair total
   (13 100.00 on current data) and the orders count is unchanged. Set **Repairs only**: revenue
   shows only repairs and the orders chart is empty. Set **All**: back to the full figure. Reload
   the page — the selection survives in the URL.
8. **A3 — no reservations in stock movements.** *Reports → Stock movements* no longer lists
   `PENDING_ORDER`, `PENDING_REPAIR` or `PENDING_RELEASE`.
9. **A4 — totals appear.** Every report now shows a totals strip under the table. *Repairs* shows
   recognised revenue/cost/profit; its rows no longer carry a revenue column at all (A5).
10. **A6 — the family chart filters.** Pick a family: **Sales by family** now collapses to that
    family's bar, and the labour caveat note appears beneath the filters.
11. **A7 — cancelled documents are not "purchased".** *Reports → Client browsing*: a product that
    only ever appeared in a cancelled order is eligible for "viewed, never purchased" again.
12. **A8/A9 — presentation.** Money columns read `23 500,00 DA`, not `23,500`, and follow the
    language switch. *Client browsing* renders both row groups with their own columns.
13. **A11/A12/A13 — captions.** Ageing shows its snapshot note; top products shows "all time";
    the overview block shows "all time" and its description no longer says "from all sales".
14. **No regression elsewhere.** POS sale, order completion and repair pickup all still work; the
    admin and staff dashboards still load; stock valuation still reads the S23 figure.
