# Plan S33 — Cash register (Caisse) page

Execution plan for **set 33** of `Docs/Stage-04-Fixes/sets-30-33.md`, the last set of the programme.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

**S30, S31 and S32 are committed** (`6e5d22f`, `a301c0c`, `7ac6ace`). S33 depends on:
- **S30:** `Repair.refundedAmount`, `Repair.cancelledAt`, `Repair.returnedAt`, and the rule that
  `Repair.paidAmount` is **net** of refunds. The `RETURNED` repair status.
- **S32:** `Apps/contract/src/common/store-time.ts` (`storeDayRangeUtc`, `storeLocalDate`,
  `STORE_TIME_ZONE`). The rule that a sale return's `Return.refundAmount` is the cash handed back.

### 0.2 Owner decisions taken while planning (settled, do not re-open)

| # | Question | Answer |
|---|---|---|
| Q1 | Suppliers: "total paid to suppliers"? | **Payments made that day:** Σ `SupplierPayment.amount` with `paidAt` in the day, whichever invoice they settle (or none). New supplier credit = Σ invoices confirmed that day − Σ payments that day. |
| Q2 | Suppliers: which date anchors an invoice? | **New `SupplierInvoice.confirmedAt` column**, set in `confirmInvoice`. No backfill: invoices confirmed before S33 never appear on any Caisse day. |
| Q3 | Orders: "confirmed and in-delivery orders of the day"? | **New `Order.inDeliveryAt` column**, set on the IN_DELIVERY transition. Two counts: confirmed that day (`confirmedAt`) and sent out that day (`inDeliveryAt`). No backfill. |
| Q4 | Returns section scope? | **Sale and order returns.** Dated on `returnedAt`. Caveat accepted: an order return's `refundAmount` is the refund the operator typed (S24), which can exceed the cash actually refunded. |

### 0.3 The day boundary — one rule for every section

- The page sends one `date` (`YYYY-MM-DD`). If absent, the server uses `storeLocalDate()`.
- The service computes **once**, at the top of each public method:
  `const range = storeDayRangeUtc(date, date);` → `{ gte: <local 00:00 as UTC>, lt: <next local 00:00 as UTC> }`.
  For Africa/Algiers (UTC+1, no DST) that is `[D−1 23:00Z, D 23:00Z)`. The helper uses `Intl`,
  not a hard-coded +1.
- Every section's `where` is built by **one private builder per figure** (Action 2.3). The
  summary aggregates and the drill-through list call the **same builder with the same `range`**.
  A drill list therefore always contains exactly the documents its headline figure counted.
- No section uses `createdAt`, `updatedAt`, `invoiceDate` or a UTC day.

### 0.4 What each figure reads (all stored values, all SQL aggregates)

| Section | Figure | Source (`where` builder → aggregate) |
|---|---|---|
| **Sales** | number of sales | `Sale` with `status ∈ {COMPLETED, PARTIALLY_RETURNED, RETURNED}`, `soldAt ∈ range` → `_count` |
| | total sold | same → `_sum.totalAmount` |
| | total paid | same → `_sum.paidAmount` |
| | total new credit | total sold − total paid (can be negative when clients overpaid) |
| **Returns** | number of returns | `Return` with `returnedAt ∈ range` (sale **and** order returns) → `_count` |
| | total refunded | same → `_sum.refundAmount` |
| **Repairs** | number of repairs | `Repair` with `status ∈ {PICKED_UP, RETURNED}`, `pickedUpAt ∈ range` → `_count` |
| | paid repair amount | same → `_sum.paidAmount + _sum.refundedAmount` (**gross** paid at pickup, see P3) |
| | unpaid repair amount | same → `_sum.totalAmount − (_sum.paidAmount + _sum.refundedAmount)` |
| | refunded repair amount | `Repair` with `refundedAmount > 0` and (`status = CANCELLED, cancelledAt ∈ range` **or** `status = RETURNED, returnedAt ∈ range`) → `_count`, `_sum.refundedAmount` (P4) |
| **Orders** | confirmed that day | `Order` with `confirmedAt ∈ range` → `_count` (any current status) |
| | sent out that day | `Order` with `inDeliveryAt ∈ range` → `_count` (any current status) |
| | completed that day | `Order` with `status ∈ {COMPLETED, RETURNED}`, `deliveredAt ∈ range` → `_count` |
| | total paid on completed orders | same → `_sum.paidAmount` |
| **Suppliers** | number of invoices | `SupplierInvoice` with `status = CONFIRMED`, `confirmedAt ∈ range` → `_count` |
| | total invoiced | same → `_sum.totalAmount` |
| | total paid to suppliers | `SupplierPayment` with `paidAt ∈ range` → `_count`, `_sum.amount` (Q1) |
| | total new supplier credit | total invoiced − total paid |

All 9 aggregate queries run in one `Promise.all`. No document row is loaded for the summary.

### 0.5 Findings (record them in the report)

- **F1 — no confirmation timestamp on supplier invoices.** `purchasing.service.ts`
  `getLastDeliveryAt`/`getProductHistory` treat `updatedAt` as "== its confirm timestamp;
  invoices are immutable after confirm". That is false: `createPayment` updates the invoice's
  `paidAmount`/`paidDate`, which bumps `updatedAt`. A supplier's "last delivery" moves every
  time an older invoice is paid. **Not fixed here.** The new `confirmedAt` makes a fix possible
  later, but switching those two readers now would blank them for every pre-S33 invoice (no
  backfill). Only correct their comments (Action 2.6).
- **F2 — client payments recorded outside a document don't appear.** The brief's Sales section
  reads sale documents only. A client settling an old balance through **Record payment** moves
  cash but is not a sale, repair or order. It appears in no section. This is a gap in the brief,
  not a bug. Flag it for the owner. A "Client payments received" figure would be one more
  aggregate on `ClientPayment` with `paidAt ∈ range, amount > 0, invoiceId → Invoice.sourceType`
  filters, and could be added later.
- **F3 — repair deposits land on the pickup day.** A repair's payments can be taken at intake.
  The brief anchors repairs on `pickedUpAt`, so a deposit taken on Monday for a Wednesday pickup
  appears in Wednesday's paid figure. This follows the brief. Note it in the report.
- **F4 — most write hooks don't refresh statistics.** Only sales, inventory and orders-directory
  hooks invalidate `qk.stats.all()`. Repairs, supplier payments and supplier invoices don't. The
  Caisse hooks use `staleTime: 0` (Action 3.4) so the page refetches whenever it is opened, plus a
  **Refresh** button. Other hooks are not touched.

### 0.6 Decisions this plan takes on its own (list them in the report)

| # | Decision | Why |
|---|---|---|
| P1 | **The Caisse lives in the statistics module.** Two new admin-only routes on `STATS_ROUTES`: the summary and a paginated drill-through list. | The brief says to follow the statistics module's query and card patterns. It is already Prisma-only and read-only. |
| P2 | **Drill-through is an in-page dialog**, not a jump to five existing list pages. One endpoint `GET /admin/cash-register/documents?date&drill&page&limit` returns a uniform paginated row shape for any of 9 drill targets. | The list pages filter on different timestamps (`createdAt`, `placedAt`, `invoiceDate`, `intakeAt`, UTC days). Re-wiring all of them would be a large change and would still risk off-by-a-day drift. Sharing the `where` builder guarantees the list equals the figure (§0.3). |
| P3 | **Repairs "paid" is gross:** `paidAmount + refundedAmount`. "Unpaid" is `totalAmount − gross paid`. | `paidAmount` is net of refunds (S30). With the net figure, a repair returned on a later day would retroactively shrink an earlier day's Caisse. Gross paid keeps each day stable, and the refund shows up on the day it was given. For a repair that was never refunded, gross = net. |
| P4 | **Repair refunds are dated on the refund itself:** `cancelledAt` for a cancelled repair, `returnedAt` for a returned one. They are read from `Repair.refundedAmount`, not from the ledger. | A cancelled repair never has a `pickedUpAt`. Reading the ledger would miss walk-in repairs, which have no ledger rows (S30 P7). `refundedAmount` covers both. |
| P5 | **A refund card appears only when that day has a refund** (`refundCount > 0`). | The brief: "refunded repair amount (where any)". |
| P6 | **No date-column indexes are added.** | The day filters hit small tables, and each runs once per page view. Revisit only if the Caisse gets slow. |
| P7 | **Drill rows have no status column and no onward link.** They show reference, local time, party, amount, and paid / source reference where relevant. | Mapping 4 status enums through their label keys for a supporting list adds a lot for little gain. The reference is enough to find the document on its own page. |
| P8 | **Drill page size 20, maximum 100.** Rows ordered by the anchoring timestamp, oldest first. | Bounded result set (1 GB machine rule). Chronological order reads like a till roll. |
| P9 | **The route is guarded twice:** the API route is `adminOnly`, and the web route sits inside a nested `RoleGuard allow={[ADMIN]}`. | The shared `/admin` route group admits STAFF too (`App.tsx:185`). Without the nested guard, a staff user typing the URL would see an empty page with 403 errors. |

---

## §1 — Database (`Apps/api/prisma`)

### Action 1.1 — `schema.prisma`

1. `model SupplierInvoice`, after `paidDate`:
   ```prisma
   confirmedAt       DateTime? // S33 — set by confirmInvoice; the Caisse anchors supplier invoices on it. Null for DRAFT and for invoices confirmed before S33 (no backfill).
   ```
2. `model Order`, after `confirmedAt`:
   ```prisma
   inDeliveryAt       DateTime? // S33 — set on the IN_DELIVERY transition (the Caisse's "sent out that day"). Null before S33 (no backfill).
   ```

### Action 1.2 — Migration `prisma/migrations/20261012120000_s33_cash_register_timestamps/migration.sql`

`prisma migrate dev` refuses this non-interactive shell (S30 precedent). From `Apps/api`, with the
`.env` variables exported:

```bash
mkdir -p prisma/migrations/20261012120000_s33_cash_register_timestamps
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/20261012120000_s33_cash_register_timestamps/migration.sql
```

**Read the SQL before applying it.** It must contain **exactly** two statements:
`ALTER TABLE "SupplierInvoice" ADD COLUMN "confirmedAt" TIMESTAMP(3);` and
`ALTER TABLE "Order" ADD COLUMN "inDeliveryAt" TIMESTAMP(3);`. It must have no `UPDATE`, no
`DELETE`, and nothing else. If anything else appears, the dev database has drifted: stop and
report it. Then run `npx prisma migrate deploy` and `npx prisma generate`. The test database is
not migrated (S30 precedent).

---

## §2 — Contract and API

### Action 2.1 — `Apps/contract/src/modules/statistics/`

**`statistics.enums.ts`** — add:
```ts
// S33 — the Caisse's drill-through targets: one per headline figure (§0.4 of plan S33).
export enum CashRegisterDrill {
  SALES = 'SALES',
  RETURNS = 'RETURNS',
  REPAIRS_PICKED_UP = 'REPAIRS_PICKED_UP',
  REPAIR_REFUNDS = 'REPAIR_REFUNDS',
  ORDERS_CONFIRMED = 'ORDERS_CONFIRMED',
  ORDERS_IN_DELIVERY = 'ORDERS_IN_DELIVERY',
  ORDERS_COMPLETED = 'ORDERS_COMPLETED',
  SUPPLIER_INVOICES = 'SUPPLIER_INVOICES',
  SUPPLIER_PAYMENTS = 'SUPPLIER_PAYMENTS',
}
```

**`statistics.query.ts`** — add:
```ts
// S33 — one store-local (Africa/Algiers) day; omitted means today. Every section reads the same
// storeDayRangeUtc(date, date) bounds.
export const CashRegisterQuerySchema = z.object({
  date: z.iso.date().optional(),
});
export type CashRegisterQuery = z.infer<typeof CashRegisterQuerySchema>;

export const CashRegisterDocumentsQuerySchema = z.object({
  date: z.iso.date().optional(),
  drill: z.enum(CashRegisterDrill),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CashRegisterDocumentsQuery = z.infer<typeof CashRegisterDocumentsQuerySchema>;
```
Import `CashRegisterDrill` from `./statistics.enums`.

**`statistics.dtos.ts`** — add:
```ts
// S33 — the Caisse. Every figure is a stored value summed in SQL over one Africa/Algiers day
// (plan S33 §0.4). `date` echoes the day actually used (today when the query omitted it).
export const CashRegisterResponseSchema = z.object({
  date: z.iso.date(),
  sales: z.object({ count: z.number().int(), totalSold: z.number(), totalPaid: z.number(), newCredit: z.number() }),
  returns: z.object({ count: z.number().int(), totalRefunded: z.number() }),
  repairs: z.object({
    count: z.number().int(),
    paidAmount: z.number(),
    unpaidAmount: z.number(),
    refundCount: z.number().int(),
    refundedAmount: z.number(),
  }),
  orders: z.object({
    confirmedCount: z.number().int(),
    inDeliveryCount: z.number().int(),
    completedCount: z.number().int(),
    completedPaid: z.number(),
  }),
  suppliers: z.object({
    invoiceCount: z.number().int(),
    totalInvoiced: z.number(),
    paymentCount: z.number().int(),
    totalPaid: z.number(),
    newCredit: z.number(),
  }),
});
export type CashRegisterDto = z.infer<typeof CashRegisterResponseSchema>;

// S33 — one row of a drill-through list, uniform across every CashRegisterDrill target.
// `at` is the anchoring timestamp; `paid` is set for SALES, REPAIRS_PICKED_UP (gross, P3) and
// ORDERS_COMPLETED; `sourceReference` is the sale/order of a return, or the invoice a supplier
// payment settles. `partyName` is absent for a walk-in sale.
export const CashRegisterDocumentResponseSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  at: z.iso.datetime(),
  partyName: z.string().optional(),
  amount: z.number(),
  paid: z.number().optional(),
  sourceReference: z.string().optional(),
});
export type CashRegisterDocumentDto = z.infer<typeof CashRegisterDocumentResponseSchema>;
```

**`statistics.routes.ts`** — add:
```ts
  // S33 — the Caisse (admin only): day summary + drill-through document list.
  CASH_REGISTER: '/admin/cash-register',
  CASH_REGISTER_DOCUMENTS: '/admin/cash-register/documents',
```

Confirm `index.ts` already re-exports all four files. Run `npx tsc --noEmit && npm run lint` in
`Apps/contract`.

### Action 2.2 — API: set the two new timestamps

1. **`src/modules/purchasing/purchasing.service.ts` `confirmInvoice`:** the in-tx
   `tx.supplierInvoice.update` data becomes
   `{ reference, status: PrismaSupplierInvoiceStatus.CONFIRMED, previousCredit, newCredit, confirmedAt: new Date() }`.
   Add a short comment above it: `// S33 — confirmedAt anchors the invoice in the Caisse.`
   The double-confirm early returns write nothing, so the first confirm's stamp stays.
2. **`src/modules/orders/orders.service.ts`**, in the forward-transition `tx.order.update`
   (the `CONFIRMED / PACKAGED / IN_DELIVERY` branch), add after the `confirmedAt` spread:
   ```ts
   // S33 — when the order left for delivery; the Caisse counts "sent out that day" on it.
   ...(cmd.status === OrderStatus.IN_DELIVERY ? { inDeliveryAt: new Date() } : {}),
   ```
   No other order path changes. In particular, IN_DELIVERY → RETURNED keeps its `inDeliveryAt`:
   the order did go out that day.

### Action 2.3 — API: `src/modules/statistics/statistics.service.ts`

1. Imports:
   - `import type { Prisma, PrismaClient } from '@prisma/client';`
   - from the contract: `CashRegisterDrill`, `paginated`, `storeDayRangeUtc`, `storeLocalDate`,
     `CashRegisterDocumentResponseSchema`, and the types `CashRegisterDto`, `CashRegisterQuery`,
     `CashRegisterDocumentDto`, `CashRegisterDocumentsQuery`, `PaginatedResult`.
2. Module constants, next to the existing recognised-status constants:
   ```ts
   // S33 — the Caisse's repair population: every repair picked up that day, including one
   // returned since (its refund is dated on returnedAt, its gross paid stays on the pickup day).
   const CASH_REGISTER_REPAIR_PICKED_STATUSES = ['PICKED_UP', 'RETURNED'] as const;
   ```
   The Caisse reuses `SALE_RECOGNIZED_STATUSES` and `ORDER_RECOGNIZED_STATUSES` unchanged.
3. Private `where` builders, one per figure, in a `// --- Cash register (S33) ---` block. Each
   takes `range: { gte?: Date; lt?: Date }`:
   ```ts
   private cashSalesWhere(range): Prisma.SaleWhereInput {
     return { status: { in: [...SALE_RECOGNIZED_STATUSES] }, soldAt: range };
   }
   private cashReturnsWhere(range): Prisma.ReturnWhereInput {
     return { returnedAt: range }; // Q4 — sale and order returns alike
   }
   private cashRepairsPickedUpWhere(range): Prisma.RepairWhereInput {
     return { status: { in: [...CASH_REGISTER_REPAIR_PICKED_STATUSES] }, pickedUpAt: range };
   }
   private cashRepairRefundsWhere(range): Prisma.RepairWhereInput {
     return {
       refundedAmount: { gt: 0 },
       OR: [
         { status: 'CANCELLED', cancelledAt: range },
         { status: 'RETURNED', returnedAt: range },
       ],
     };
   }
   private cashOrdersConfirmedWhere(range): Prisma.OrderWhereInput { return { confirmedAt: range }; }
   private cashOrdersInDeliveryWhere(range): Prisma.OrderWhereInput { return { inDeliveryAt: range }; }
   private cashOrdersCompletedWhere(range): Prisma.OrderWhereInput {
     return { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, deliveredAt: range };
   }
   private cashSupplierInvoicesWhere(range): Prisma.SupplierInvoiceWhereInput {
     return { status: 'CONFIRMED', confirmedAt: range };
   }
   private cashSupplierPaymentsWhere(range): Prisma.SupplierPaymentWhereInput { return { paidAt: range }; }
   ```
   Type the `range` parameter as `{ gte?: Date; lt?: Date }` (the return type of
   `storeDayRangeUtc`).
4. **`getCashRegister(query: CashRegisterQuery): Promise<CashRegisterDto>`:**
   ```ts
   // S33 — the Caisse. One Africa/Algiers day (§0.3): `range` is computed once and handed to
   // every builder, the same builders getCashRegisterDocuments uses, so a drill list always
   // equals its figure. Nine SQL aggregates, no document rows loaded.
   async getCashRegister(query: CashRegisterQuery): Promise<CashRegisterDto> {
     const date = query.date ?? storeLocalDate();
     const range = storeDayRangeUtc(date, date);
     const [sales, returns, repairs, repairRefunds, confirmed, inDelivery, completed, invoices, payments] = await Promise.all([
       this.prisma.sale.aggregate({ where: this.cashSalesWhere(range), _count: { _all: true }, _sum: { totalAmount: true, paidAmount: true } }),
       this.prisma.return.aggregate({ where: this.cashReturnsWhere(range), _count: { _all: true }, _sum: { refundAmount: true } }),
       this.prisma.repair.aggregate({ where: this.cashRepairsPickedUpWhere(range), _count: { _all: true }, _sum: { totalAmount: true, paidAmount: true, refundedAmount: true } }),
       this.prisma.repair.aggregate({ where: this.cashRepairRefundsWhere(range), _count: { _all: true }, _sum: { refundedAmount: true } }),
       this.prisma.order.count({ where: this.cashOrdersConfirmedWhere(range) }),
       this.prisma.order.count({ where: this.cashOrdersInDeliveryWhere(range) }),
       this.prisma.order.aggregate({ where: this.cashOrdersCompletedWhere(range), _count: { _all: true }, _sum: { paidAmount: true } }),
       this.prisma.supplierInvoice.aggregate({ where: this.cashSupplierInvoicesWhere(range), _count: { _all: true }, _sum: { totalAmount: true } }),
       this.prisma.supplierPayment.aggregate({ where: this.cashSupplierPaymentsWhere(range), _count: { _all: true }, _sum: { amount: true } }),
     ]);
     // …then hand plain numbers to StatisticsMapper.toCashRegisterDto (Action 2.4)
   }
   ```
   Convert every `_sum` with `?.toNumber() ?? 0`. Compute with a local
   `round2 = (n: number) => Math.round(n * 100) / 100` applied to every derived figure:
   - `sales.newCredit = totalSold − totalPaid`;
   - `repairs.paidAmount = paidSum + refundedSum` (P3);
   - `repairs.unpaidAmount = totalSum − (paidSum + refundedSum)`;
   - `suppliers.newCredit = totalInvoiced − totalPaid`.

5. **`getCashRegisterDocuments(query: CashRegisterDocumentsQuery): Promise<PaginatedResult<CashRegisterDocumentDto>>`:**
   compute `date`/`range` exactly as above, then `switch (query.drill)`. Each case runs a
   `this.prisma.$transaction([count, findMany])` (the `listSales` idiom) with the case's builder,
   `skip: (page − 1) × limit`, `take: limit` and `orderBy: { <anchor>: 'asc' }`. It selects only
   the fields below and maps each row to `CashRegisterDocumentDto`:

   | Drill | Model / anchor | Row mapping |
   |---|---|---|
   | SALES | `sale` / `soldAt` | `reference`, `at = soldAt`, `partyName = posClient?.name`, `amount = totalAmount`, `paid = paidAmount` |
   | RETURNS | `return` / `returnedAt` | `reference`, `at = returnedAt`, `partyName = sale?.posClient?.name ?? order?.contactName`, `amount = refundAmount`, `sourceReference = sale?.reference ?? order?.reference` |
   | REPAIRS_PICKED_UP | `repair` / `pickedUpAt` | `reference`, `at = pickedUpAt`, `partyName = customerName`, `amount = totalAmount`, `paid = paidAmount + refundedAmount` |
   | REPAIR_REFUNDS | `repair` / `reference: 'asc'` (two possible anchors, so order by reference) | `reference`, `at = cancelledAt ?? returnedAt`, `partyName = customerName`, `amount = refundedAmount` |
   | ORDERS_CONFIRMED | `order` / `confirmedAt` | `reference`, `at = confirmedAt`, `partyName = contactName`, `amount = totalAmount` |
   | ORDERS_IN_DELIVERY | `order` / `inDeliveryAt` | same as above with `at = inDeliveryAt` |
   | ORDERS_COMPLETED | `order` / `deliveredAt` | `reference`, `at = deliveredAt`, `partyName = contactName`, `amount = totalAmount`, `paid = paidAmount` |
   | SUPPLIER_INVOICES | `supplierInvoice` / `confirmedAt` | `reference`, `at = confirmedAt`, `partyName = supplier.name`, `amount = totalAmount` |
   | SUPPLIER_PAYMENTS | `supplierPayment` / `paidAt` | `reference`, `at = paidAt`, `partyName = supplier.name`, `amount`, `sourceReference = supplierInvoice?.reference` |

   Every anchor is non-null for rows the builder selects. Use `!` with a one-line comment
   ("the builder filters on it") where TypeScript needs it. Money goes through `.toNumber()`,
   dates through `.toISOString()`. Optional fields use conditional spreads
   (`exactOptionalPropertyTypes`). Return
   `paginated(CashRegisterDocumentResponseSchema).parse({ items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } })`,
   the same as `sales.service.ts listReturns`.

   REPAIR_REFUNDS orders by `reference` because its anchor is two columns (`cancelledAt` or
   `returnedAt`). Add a comment saying so. Never order or filter by `updatedAt` anywhere in the
   Caisse.

### Action 2.4 — `statistics.mapper.ts`

Add `static toCashRegisterDto(input: CashRegisterDto): CashRegisterDto { return CashRegisterResponseSchema.parse(input); }`,
the same shape as `toOverviewDto`. Import the schema and type.

### Action 2.5 — `statistics.interface.ts`, `statistics.controller.ts`, `statistics.routes.ts`

- Interface: `getCashRegister(query: CashRegisterQuery): Promise<CashRegisterDto>;` and
  `getCashRegisterDocuments(query: CashRegisterDocumentsQuery): Promise<PaginatedResult<CashRegisterDocumentDto>>;`,
  each with a one-line S33 comment.
- Controller: two handlers shaped like `getFiltered`
  (`req.validated.query as …`, `sendSuccess(res, …, 200)`).
- Routes, after `REPORT`. **Register `CASH_REGISTER_DOCUMENTS` before `CASH_REGISTER`.** The paths
  don't collide, but keep the more specific one first by habit:
  ```ts
  router.get(STATS_ROUTES.CASH_REGISTER_DOCUMENTS, adminOnly, validateRequest({ query: CashRegisterDocumentsQuerySchema }), controller.getCashRegisterDocuments);
  router.get(STATS_ROUTES.CASH_REGISTER, adminOnly, validateRequest({ query: CashRegisterQuerySchema }), controller.getCashRegister);
  ```

### Action 2.6 — Stale comments (F1)

In `purchasing.service.ts`, the comments above `getLastDeliveryAt` and in `getProductHistory`
claim `updatedAt == confirm timestamp; invoices are immutable after confirm`. Replace them with:
`// updatedAt approximates the confirm time but also moves when a payment updates paidAmount/
// paidDate (S33/F1). confirmedAt (S33) is exact, but is null for invoices confirmed before S33,
// so these readers keep updatedAt for now.` Do not change the code.

Run `npx tsc --noEmit` (src must be clean; test errors must stay at the S32 baseline of 198 in
29 files) and `npm run lint` (only the 7 pre-existing errors) in `Apps/api`.

---

## §3 — Web (`Apps/web`)

### Action 3.1 — `src/lib/utils.ts`

Add next to `formatDateTime`:
```ts
// S33 — a time of day in the store's own zone (Africa/Algiers), never the browser's — the Caisse
// lists documents of one store-local day.
export function formatStoreTime(iso: string, language: Language = "en"): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[language], {
    timeZone: STORE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
```
Import `STORE_TIME_ZONE` from `@dragon-telecom/contract`.

### Action 3.2 — `src/services/statistics.service.ts`

Add `getCashRegister(query: CashRegisterQuery): Promise<CashRegisterDto>` and
`getCashRegisterDocuments(query: CashRegisterDocumentsQuery): Promise<PaginatedResult<CashRegisterDocumentDto>>`.
Both follow the existing `getFiltered` shape: `api.get(apiPath(STATS_ROUTES.…), { params: query })`,
then the defensive `success` check.

### Action 3.3 — `src/lib/query-keys.ts`

Under `stats`, add:
```ts
    // S33 — the Caisse; nested under `stats` so every existing qk.stats.all() invalidation
    // (sales, orders, inventory) also refreshes it.
    cashRegister: (query?: unknown) => ["stats", "cash-register", query] as const,
    cashRegisterDocuments: (query?: unknown) => ["stats", "cash-register", "documents", query] as const,
```

### Action 3.4 — `src/hooks/useStatistics.ts`

```ts
// S33 — staleTime 0: repairs, supplier invoices and supplier payments don't invalidate
// qk.stats.all() (S33/F4), so the Caisse refetches every time it is opened.
export function useCashRegister(query: CashRegisterQuery) {
  return useQuery({ queryKey: qk.stats.cashRegister(query), queryFn: () => statisticsService.getCashRegister(query), staleTime: 0 });
}
export function useCashRegisterDocuments(query: CashRegisterDocumentsQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.stats.cashRegisterDocuments(query),
    queryFn: () => statisticsService.getCashRegisterDocuments(query),
    enabled: options?.enabled,
    staleTime: 0,
  });
}
```

### Action 3.5 — New `src/types/cash-register.types.ts`

```ts
import type { CashRegisterDrill } from "@dragon-telecom/contract";

// S33 — one clickable figure on the Caisse page.
export interface CashRegisterFigure {
  labelKey: string;
  value: string; // already formatted (money or count)
  drill?: CashRegisterDrill; // absent = not clickable
}

// S33 — which optional columns a drill list shows.
export interface CashRegisterDrillColumns {
  paid: boolean;
  sourceReference: boolean;
}
```

### Action 3.6 — New `src/pages/admin/cash-register/components/cash-register-section.tsx`

`CashRegisterSection({ titleKey, icon, figures, onDrill })` is presentational.
- A `Card` with `CardHeader` (icon + `t(titleKey)`) and `CardContent`.
- `CardContent` holds a `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4` of `StatCard`s,
  one per figure (`label = t(labelKey)`, `value`).
- A figure with `drill` is wrapped in
  `<button type="button" className="rounded-2xl text-left transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => onDrill(figure.drill!, figure.labelKey)} aria-label={t("admin.cashRegister.drill.open", { label: t(labelKey) })}>`.
  Its `StatCard` `trend` shows `t("admin.cashRegister.drill.hint")`, muted text-xs.
- A figure without `drill` is rendered plain.

### Action 3.7 — New `src/pages/admin/cash-register/components/cash-register-drill-dialog.tsx`

Props: `open`, `onOpenChange`, `date: string`, `drill: CashRegisterDrill | null`,
`titleKey: string | null`.
- It owns `page` state, reset to 1 whenever `drill` changes (`useEffect([drill])`).
- It calls `useCashRegisterDocuments({ date, drill: drill!, page, limit: 20 }, { enabled: open && drill != null })`.
  Calling the hook from this page-level component is fine: component → hook → service.
- Columns per drill, from a local `const DRILL_COLUMNS: Record<CashRegisterDrill, CashRegisterDrillColumns>`:
  `paid` is true for SALES, REPAIRS_PICKED_UP and ORDERS_COMPLETED; `sourceReference` is true
  for RETURNS and SUPPLIER_PAYMENTS.
- `DataTable` columns: reference; time (`formatStoreTime(at, language)`); party
  (`partyName ?? t("admin.cashRegister.drill.walkIn")`); amount (`formatDZD`); then
  paid / source reference when enabled. `renderMobileRow` puts the same fields on two lines.
  Use `TableSkeleton` while loading, and an `EmptyState` with `admin.cashRegister.drill.empty`
  when there are no items.
- `SimplePagination` below the table when `meta.totalPages > 1`.
- Header: `t(titleKey)` · the date. `DialogContent className="max-w-3xl"`, with a scrollable
  body (`max-h-[70vh] overflow-y-auto`).

### Action 3.8 — New `src/pages/admin/cash-register/AdminCashRegister.tsx`

- `const today = storeLocalDate();` `const [date, setDate] = useState(today);`
- `const { data, isLoading, isError, refetch, isFetching } = useCashRegister({ date });`
- Header row: `PageHeader` (`admin.cashRegister.pageTitle`), then on the right:
  - `<Input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t("admin.cashRegister.dateLabel")} className="w-40" />`;
  - a **Today** button (`admin.cashRegister.today`, `variant={date === today ? "default" : "outline"}`)
    that sets `date` to `today`;
  - a **Refresh** button (`common.actions.refresh`, which already exists), `disabled={isFetching}`,
    calling `refetch()`.
- Below the header, a muted line: `t("admin.cashRegister.boundaryNote")` (the Algiers-day rule
  in plain words).
- Loading: five `StatCardSkeleton` rows. Error: `EmptyState` with `common.errorLoadingData` and
  a retry button calling `refetch()`.
- Data: five `CashRegisterSection`s in brief order, icons from lucide:
  - **Sales** (`Receipt`): count (drill SALES), total sold, total paid, new credit.
  - **Returns** (`Undo2`): count (drill RETURNS), total refunded.
  - **Repairs** (`Wrench`): count (drill REPAIRS_PICKED_UP), paid, unpaid. When
    `refundCount > 0` (P5), also refunded amount (drill REPAIR_REFUNDS), with the label
    `admin.cashRegister.repairs.refunded` and the count in the formatted value:
    `"{amount} · {count}"` through `t("admin.cashRegister.repairs.refundedValue", { amount, count })`.
  - **Orders** (`ShoppingCart`): confirmed (drill ORDERS_CONFIRMED), sent out (drill
    ORDERS_IN_DELIVERY), completed (drill ORDERS_COMPLETED), paid on completed.
  - **Suppliers** (`Truck`): invoices (drill SUPPLIER_INVOICES), total invoiced, total paid
    (drill SUPPLIER_PAYMENTS, value shows the amount), new supplier credit.
  - Counts are plain numbers (`String(n)`); money uses `formatDZD(n, language)`. A negative new
    credit renders as is: the store owes.
- One `CashRegisterDrillDialog` driven by `const [drill, setDrill] = useState<{ drill: CashRegisterDrill; titleKey: string } | null>(null)`.
- Header comment: S33, admin only, one Algiers day, every figure a stored SQL sum, drill lists
  share the figure's filter. Reference plan S33 §0.3–§0.4.

### Action 3.9 — Routing and sidebar

- `src/App.tsx`: `const AdminCashRegister = lazy(() => import("@/pages/admin/cash-register/AdminCashRegister"));`.
  Inside the `AdminLayout` children, after the `/admin/sales` route, add (P9):
  ```tsx
  {
    // S33 (P9) — the Caisse is admin-only; the surrounding /admin group also admits STAFF.
    element: <RoleGuard allow={[UserType.ADMIN]} fallbackPath="/admin" />,
    children: [
      { path: "/admin/cash-register", element: withSuspense(AdminCashRegister), errorElement: <RouteErrorBoundary /> },
    ],
  },
  ```
  Confirm `UserType` is already imported in `App.tsx`. Line 128 uses it, so it is.
- `src/config/nav-links.ts`: import `Wallet` from lucide. Add
  `{ to: "/admin/cash-register", labelKey: "admin.nav.cashRegister", icon: Wallet },` right after
  the `/admin/sales` entry.

### Action 3.10 — `src/config/translations.json`

The real file is `translations.json`. Shape `{ en, fr, ar: "" }`, load/modify/dump byte-safe
(`json.dumps(indent=2, ensure_ascii=False) + "\n"`); check the round trip first. Insert next to
siblings.

| Key | en | fr |
|---|---|---|
| `admin.nav.cashRegister` | Cash register | Caisse |
| `admin.cashRegister.pageTitle` | Cash register | Caisse |
| `admin.cashRegister.dateLabel` | Day | Jour |
| `admin.cashRegister.today` | Today | Aujourd'hui |
| `admin.cashRegister.boundaryNote` | Days run from midnight to midnight, Algiers time. | Les journées vont de minuit à minuit, heure d'Alger. |
| `admin.cashRegister.sales.title` | Sales | Ventes |
| `admin.cashRegister.sales.count` | Number of sales | Nombre de ventes |
| `admin.cashRegister.sales.totalSold` | Total sold | Total vendu |
| `admin.cashRegister.sales.totalPaid` | Total paid | Total payé |
| `admin.cashRegister.sales.newCredit` | New client credit | Nouveau crédit client |
| `admin.cashRegister.returns.title` | Returns | Retours |
| `admin.cashRegister.returns.count` | Number of returns | Nombre de retours |
| `admin.cashRegister.returns.totalRefunded` | Total refunded | Total remboursé |
| `admin.cashRegister.repairs.title` | Repairs | Réparations |
| `admin.cashRegister.repairs.count` | Repairs picked up | Réparations récupérées |
| `admin.cashRegister.repairs.paid` | Paid | Payé |
| `admin.cashRegister.repairs.unpaid` | Unpaid | Impayé |
| `admin.cashRegister.repairs.refunded` | Refunded (cancelled / returned) | Remboursé (annulées / retournées) |
| `admin.cashRegister.repairs.refundedValue` | {amount} · {count} | {amount} · {count} |
| `admin.cashRegister.orders.title` | Orders | Commandes |
| `admin.cashRegister.orders.confirmed` | Confirmed | Confirmées |
| `admin.cashRegister.orders.inDelivery` | Sent out for delivery | Mises en livraison |
| `admin.cashRegister.orders.completed` | Completed | Terminées |
| `admin.cashRegister.orders.completedPaid` | Paid on completed orders | Payé sur commandes terminées |
| `admin.cashRegister.suppliers.title` | Suppliers | Fournisseurs |
| `admin.cashRegister.suppliers.invoiceCount` | Invoices confirmed | Factures confirmées |
| `admin.cashRegister.suppliers.totalInvoiced` | Total invoiced | Total facturé |
| `admin.cashRegister.suppliers.totalPaid` | Paid to suppliers | Payé aux fournisseurs |
| `admin.cashRegister.suppliers.newCredit` | New supplier credit | Nouveau crédit fournisseur |
| `admin.cashRegister.drill.hint` | Click to see the documents | Cliquez pour voir les documents |
| `admin.cashRegister.drill.open` | Show documents for {label} | Afficher les documents : {label} |
| `admin.cashRegister.drill.reference` | Reference | Référence |
| `admin.cashRegister.drill.time` | Time | Heure |
| `admin.cashRegister.drill.party` | Client / supplier | Client / fournisseur |
| `admin.cashRegister.drill.amount` | Amount | Montant |
| `admin.cashRegister.drill.paid` | Paid | Payé |
| `admin.cashRegister.drill.source` | Source document | Document d'origine |
| `admin.cashRegister.drill.walkIn` | Walk-in | Comptoir |
| `admin.cashRegister.drill.empty` | No documents on this day | Aucun document ce jour-là |

**Reuse, do not re-add:** `common.errorLoadingData`, `common.actions.refresh`.

---

## §4 — Stage-00 documentation

- `Docs/Stage-00-Conception/database-description.md`:
  - **SupplierInvoice** line: add `· confirmedAt?` (S33, set at confirm; anchors the Caisse).
  - **Order** timestamps line: add `· inDeliveryAt?` (S33, set at IN_DELIVERY).
- `Docs/Stage-00-Conception/Module-Contracts/statistics.md`:
  - Add the two `STATS_ROUTES.CASH_REGISTER*` rows to the API table.
  - Add a Business Logic item: "Caisse (S33): one Africa/Algiers day via `storeDayRangeUtc`;
    figures and anchors per plan S33 §0.4; drill lists reuse the figure's own filter."
- `Docs/Stage-00-Conception/Pages-Requirements/`: add a new `ADM-20-cash-register.md` (ADM-19 is
  the highest number in use today). It describes the five sections,
  the date picker, Today and Refresh, the drill dialog and admin-only access, in the same format
  as `ADM-10-sales.md`.

---

## §5 — Validation gate

No test file may be read, edited or run. From the repo root:

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd ../api      && npx prisma validate && npx tsc --noEmit && npm run lint
cd ../web      && npx tsc --noEmit && npx eslint <every file this set touched or created>
```

**Baselines** (from S32): api test tsc 198 errors in 29 files; api lint 7 pre-existing errors;
web test tsc (`-p tsconfig.test.json`) 52 errors, none S32-related. Report the per-file
differences.

**Grep sweeps:**
- `grep -n "createdAt\|updatedAt\|invoiceDate\|DAY_MS" <the S33 block of statistics.service.ts>`
  → none. Every Caisse filter uses `range`.
- `grep -rn "storeDayRangeUtc" Apps/api/src/modules/statistics` → only the two public Caisse
  methods (one call each).
- `grep -rn "'/admin/cash-register" Apps/web/src Apps/api/src` → none outside
  `nav-links.ts`/`App.tsx` (the API uses `STATS_ROUTES`).
- `git diff --stat -- Apps/api/prisma/migrations` → exactly one new `migration.sql` with two
  `ADD COLUMN` statements.

---

## §6 — Manual verification checklist (browser)

Signed in as **admin**. Keep these open in separate tabs: `/admin/cash-register`, `/admin/sales`,
`/admin/repairs`, `/admin/orders`, `/admin/supplier-invoices`, `/admin/invoices` → **Payments**,
and `/admin/inventory` → **Movements**. Before starting, note every figure the Caisse shows for
today. Each step below states the expected change after you press **Refresh**.

### A. Page and access
1. The sidebar has **Cash register** after Sales. It opens on **today**, with the boundary note
   under the title. The date picker won't go past today.
2. Sign in as a **staff** user and type `/admin/cash-register` → you are sent back to `/admin`,
   and the sidebar never offered it. Sign back in as admin.

### B. Sales and returns
3. POS: a walk-in sale of 1 500 paid 1 500, then a sale to client **C** of 1 000 paid 600. Caisse
   → Sales: count +2, total sold +2 500, total paid +2 100, new client credit +400.
4. Click **Number of sales** → the dialog lists both sales with today's local times. The
   walk-in's party reads **Walk-in**, and the paid column shows 1 500 and 600.
5. Return 1 line of the walk-in sale (refund 500, restock on). Caisse → Returns: count +1, total
   refunded +500. The drill row shows the sale's reference as source. **Sales figures don't
   change**: the return is its own section. Movements: one RETURN IN row at the sale's cost.
6. Return a completed **order** with refund 300. Returns: count +1, refunded +300. The drill row
   shows the order reference and the order's contact name.

### C. Repairs
7. Pick up a repair of total 2 000 that has 500 paid → Repairs: count +1, paid +500, unpaid
   +1 500. The drill row shows paid 500.
8. Return that same repair (S30, full refund) → Repairs: count, paid and unpaid **don't change**
   (P3), and a **Refunded** card appears: 500 · 1. Its drill row's time is the return time.
   Payments ledger: a negative row of −500 linked to the original payment (if C has an account).
9. Cancel an INTAKE repair that had a 200 deposit → Refunded becomes 700 · 2. Repair count does
   not change (it was never picked up).
10. A walk-in repair cancelled with a deposit → refunded rises by the deposit too. There is no
    ledger row (S30 P7), and the Caisse still counts it.

### D. Orders
11. Confirm a PENDING order → Orders: confirmed +1. Move another to IN_DELIVERY → sent out +1.
12. Complete an order of total 3 000 with 3 000 paid → completed +1, paid on completed +3 000.
    Its drill row shows paid 3 000.
13. An order completed **before** S33 and moved to IN_DELIVERY before S33 never appears under
    "sent out" on any day (no backfill). This is expected.

### E. Suppliers
14. Create and confirm a supplier invoice of 10 000 → Suppliers: invoices +1, total invoiced
    +10 000, new supplier credit +10 000.
15. Record a supplier payment of 4 000 today, on an **older** invoice → paid to suppliers +4 000,
    new supplier credit +10 000 − 4 000 = **+6 000** for the day. The payments drill shows the
    older invoice's reference as source.
16. Record a supplier payment with a **past** effective date → it appears on that past day's
    Caisse, not today's.
17. An invoice confirmed before S33 never appears on any day (no `confirmedAt`). Expected.
18. `SELECT reference, "confirmedAt" FROM "SupplierInvoice" ORDER BY "createdAt" DESC LIMIT 3;`
    → the invoice from step 14 has a timestamp; older ones are NULL.

### F. Day boundary
19. Pick **yesterday** → every section shows yesterday's activity only. Pick today again → back
    to the figures above.
20. Boundary SQL check (optional): for a sale near midnight,
    `SELECT reference, "soldAt", "soldAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Algiers' AS local FROM "Sale" ORDER BY "soldAt" DESC LIMIT 5;`
    The local date in that column is the day it appears on.
21. Every headline drill list has exactly as many rows (sum of pages) as its count, and its
    amounts add up to its figure.

### G. Regression
22. `/admin/statistics` and the admin dashboard still load with the same figures as before.
23. Supplier-invoice confirm, order status changes and repair actions behave as before. The only
    new effect is the two timestamps.

---

## §7 — Files touched

**Prisma:** `schema.prisma`, new migration `20261012120000_s33_cash_register_timestamps`.

**Contract:** `statistics/{statistics.enums.ts, statistics.query.ts, statistics.dtos.ts, statistics.routes.ts}`.

**API:** `statistics/{statistics.service.ts, statistics.mapper.ts, statistics.interface.ts, statistics.controller.ts, statistics.routes.ts}`,
`purchasing/purchasing.service.ts` (`confirmedAt` + comments), `orders/orders.service.ts`
(`inDeliveryAt`).

**Web:** `lib/utils.ts`, `services/statistics.service.ts`, `lib/query-keys.ts`,
`hooks/useStatistics.ts`, new `types/cash-register.types.ts`, new
`pages/admin/cash-register/{AdminCashRegister.tsx, components/cash-register-section.tsx, components/cash-register-drill-dialog.tsx}`,
`App.tsx`, `config/nav-links.ts`, `config/translations.json`.

**Docs:** `database-description.md`, `Module-Contracts/statistics.md`, new
`Pages-Requirements/ADM-20-cash-register.md`.

---

## §8 — Execution protocol

Execute this set alone, in action order (database → contract → API → web → docs). When it is
finished, write `Docs/Stage-04-Fixes/results/report-S33.md` covering:

1. owner decisions Q1–Q4 and plan decisions P1–P9;
2. findings F1–F4;
3. the migration SQL, verbatim;
4. every change, by file;
5. the gate results, with test staleness listed per file.

End the report with the §6 checklist verbatim. The owner reviews and approves the report. This
closes the S30–S33 programme.
