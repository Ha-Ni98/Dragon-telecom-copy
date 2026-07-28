# Plan S9 — Orders: schema, contract & order lines

*Model layer only. Prisma + migration + contract + mappers + the compile-level fallout across
backend and frontend. **Every behavioral change belongs to S10** — this set must leave the app
doing exactly what it does today, just over a `lines[]` array instead of folded columns.*

Implements **D1** (orders are multi-line) and the schema half of **D4** (`CANCELLED_BY_CLIENT`).

---

## 0. Before you start

### 0.1 Sets that must land first

**S5** is the only hard prerequisite already executed that matters here, and only indirectly:
`orders.service.ts` already calls `clientCredit.applyDocumentCharge(tx, posClientId, {
totalSoldDelta, creditDelta: 0 })` inside the confirm transaction. **Do not touch that call in this
set** — S10 moves it.

S1–S8 are all executed and reported. Nothing else blocks S9. **S9 blocks S10, S11 and S16.**

### 0.2 Owner decisions taken this session — settled, do not re-open

| # | Question | Owner's answer |
|---|---|---|
| **R1** | Does the admin "return a COMPLETED order" action survive S10's machine? | **Yes.** `IN_DELIVERY → RETURNED` (release only) and admin `COMPLETED → RETURNED` (FIFO restock + refund) coexist. So `ReturnOrderCommand` stays in the contract — S9 only makes it per-line. |
| **R2** | Guest order completing with `paid < total`? | **Rejected** (S10 enforces). No contract change in S9. |
| **R3** | `POST /confirm` vs `PATCH /status`? | **Folded into `PATCH /status` — but in S10.** S9 leaves `ConfirmOrderSchema` and both CONFIRM routes exactly where they are; it only generalises `confirmOrder()`'s body to loop over lines. |
| **R4** | Where does the client-cancel widening land? | **S10.** S9 adds the enum value and the label/filter entries only. |

### 0.3 Findings from reading the code — read these before acting

**F1 — the folded columns and their exact readers.** `Order.productId`, `productNameSnapshot`,
`quantity`, `resolvedPrice`, `unitPrice`, `serialNumbers`, `costOfGoods`, `profit`. Read at:
- `Apps/api/src/modules/orders/orders.mapper.ts` — `toOrderDto` (lines 57–71), `toPersistencePlace` (lines 117–125)
- `Apps/api/src/modules/orders/orders.service.ts` — `placeOrder` (78–123), `cancelMyOrder` (154), `confirmOrder` (226–306), `cancelOrder` (366), `returnOrder` (403), `buildOriginalConsumptions` (457)
- `Apps/api/src/modules/billing/billing.service.ts` — `issueFromOrder` (302–356) reads `order.costOfGoods/profit` and builds a **single** invoice line from `payload.snapshotLine`; `resolveCurrentAvgStockPrices` (527–539) reads `Order.productId` directly
- `Apps/api/src/modules/statistics/statistics.service.ts` — `computeRevenueProfit` (319–322) aggregates `_sum: { totalAmount, profit }`
- Frontend: see §3.

**F2 — `Order.costOfGoods`/`profit` become `totalCost`/`totalProfit`** (the brief's own naming for
the order-level totals). This is a **rename**, not a new column: `statistics.service.ts`'s
aggregate and `billing.service.ts`'s `issueFromOrder` both break on it. Both are listed as actions.

**F3 — stock movements are keyed by `referenceType: 'ORDER'` + `referenceId: order.id`**, never by
product-on-the-order. `inventory.service.ts`'s `resolveReferenceLabels` resolves `Order.reference`
from that id. **Nothing in inventory breaks** from this set — do not touch the inventory module.
`buildOriginalConsumptions` already takes `productId` as a parameter, so it works per line unchanged.

**F4 — `Product.orders Order[]`** (`schema.prisma:484`) is the back-relation of `Order.productId`.
It must become `orderLines OrderLine[]`. `Client.orders` (line 324), `Wilaya.orders` (250) and
`Commune.orders` (263) all hang off columns that **stay** on `Order` — leave them alone.

**F5 — the frontend's compile-time contract guard.** `order.schema.ts:59-63` asserts
`OrderFormValues extends PlaceOrderCommand`. Once `PlaceOrderCommand` carries `lines[]` that
assertion fails. **Do not restructure the form** (that would rewrite `ProductOrderModal`'s quantity
field and `Cart`'s single-item flow for no behavioral gain, and S15/S16 rework both anyway) —
replace the assertion with a typed mapper function, per Action 15.

**F6 — three exhaustive `Record<OrderStatus, …>` maps exist in `Apps/web`** and all three break the
moment the enum grows: `OrderCard.tsx`'s `STATUS_ICON`/`STATUS_COLOR`/`STATUS_LABEL_KEY` (42–70),
`order-status-labels.ts`'s `ORDER_STATUS_LABEL_KEY`, and `OrderStatusFilters.tsx`'s
`STATUS_LABEL_KEY` (typed `Record<OrderFilterValue, string>`, which includes every `OrderStatus`).

**F7 — `OrdersEvents['order.confirmed'].snapshotLine` has exactly one consumer that reads its
fields**: `billing.service.ts`'s `issueFromOrder`. `observability.listener.ts:254` reads only
`p.totals.totalAmount` and `p.orderId`. So widening `snapshotLine` → `snapshotLines[]` touches
those two files and nothing else.

**F8 — the migration may drop data freely** (standing context: the database is not in production).
Existing `Order` rows lose their product columns; no back-fill is required or wanted.

### 0.4 Standing rules for this set

- **No behavior changes.** Every guard, every status check, every credit call keeps its current
  semantics. If a rule reads oddly (e.g. `confirmOrder` consuming stock at confirm), that is
  deliberate — S10 fixes it, S9 does not.
- **A single-line order is the only shape the app produces today**, because `PlaceOrderCommand`'s
  UI callers each send one product. Multi-line ordering is S16. Your code must nonetheless be
  written for N lines throughout — no `lines[0]` shortcuts in the backend.
- **`Apps/web/src/config/translations.json` is a flat map** of `"a.b.c": {en, fr, ar}`. Add new
  keys with `en` and `fr` filled and `ar` as `""` — the established convention.
- Do not read, edit or run anything under `test/`.

---

## 1. Prisma schema & migration

### Action 1 — `Apps/api/prisma/schema.prisma`, `enum OrderStatus` (line 80)

Add `CANCELLED_BY_CLIENT` **between `CANCELLED` and `RETURNED`**:

```prisma
enum OrderStatus {
  PENDING
  CONFIRMED
  PACKAGED
  IN_DELIVERY
  COMPLETED
  CANCELLED
  CANCELLED_BY_CLIENT
  RETURNED
}
```

### Action 2 — `Apps/api/prisma/schema.prisma`, `model Order` (line 737)

**Remove** these columns: `productId`, `productNameSnapshot`, `quantity`, `resolvedPrice`,
`unitPrice`, `serialNumbers`. **Rename** `costOfGoods` → `totalCost` and `profit` → `totalProfit`
(both stay `Decimal? @db.Decimal(12, 2)`). **Remove** the `product Product @relation(...)` line.
**Add** the `lines OrderLine[]` back-relation. Everything else on the model is unchanged.

Resulting model (the comment on `totalCost`/`totalProfit` must say **"set at COMPLETED (FIFO, S10)"**,
not "at confirmation"):

```prisma
model Order {
  id                 String      @id @default(uuid())
  reference          String      @unique
  clientId           String? // null for guests — no auto client row
  status             OrderStatus @default(PENDING)
  orderType          OrderType
  contactName        String
  contactPhone       String
  wilayaId           String? // null when pickup
  communeId          String?
  address            String?
  deliveryCompany    String?
  trackingNumber     String?
  subtotal           Decimal     @db.Decimal(12, 2)
  deliveryFee        Decimal     @default(0) @db.Decimal(12, 2)
  totalAmount        Decimal     @db.Decimal(12, 2)
  paidAmount         Decimal     @default(0) @db.Decimal(12, 2)
  totalCost          Decimal?    @db.Decimal(12, 2) // set at COMPLETED (FIFO, S10)
  totalProfit        Decimal?    @db.Decimal(12, 2)
  placedAt           DateTime    @default(now())
  confirmedAt        DateTime?
  deliveredAt        DateTime? // at COMPLETED
  cancelledAt        DateTime?
  confirmedByStaffId String?
  cancellationReason String?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  client      Client?     @relation(fields: [clientId], references: [id])
  wilaya      Wilaya?     @relation(fields: [wilayaId], references: [id])
  commune     Commune?    @relation(fields: [communeId], references: [id])
  confirmedBy Staff?      @relation("OrderConfirmedBy", fields: [confirmedByStaffId], references: [id])
  lines       OrderLine[]

  @@index([status, placedAt])
  @@index([clientId])
}
```

### Action 3 — `Apps/api/prisma/schema.prisma`, new `model OrderLine`

Insert directly **after** `model Order`. Shape mirrors `SaleLine` (line 689) — same column names,
same decimal precision — except `costOfGoods`/`profit` are **nullable** here (unset until
completion; `SaleLine` defaults them to 0 because a sale is confirmed in one step).

```prisma
model OrderLine {
  id                  String   @id @default(uuid())
  orderId             String
  productId           String
  productNameSnapshot String
  quantity            Int
  resolvedPrice       Decimal  @db.Decimal(12, 2) // frozen at placement
  unitPrice           Decimal  @db.Decimal(12, 2) // staff may adjust (pickup: at COMPLETED; delivery: at PACKAGED — D11, S10)
  costOfGoods         Decimal? @db.Decimal(12, 2) // set at COMPLETED (FIFO, S10)
  profit              Decimal? @db.Decimal(12, 2)
  lineTotal           Decimal  @db.Decimal(12, 2)
  serialNumbers       String? // comma-joined, same convention as SaleLine

  order   Order   @relation(fields: [orderId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@index([orderId])
  @@index([productId])
}
```

### Action 4 — `Apps/api/prisma/schema.prisma`, `model Product` (line 484)

`orders Order[]` → `orderLines OrderLine[]`.

### Action 5 — the migration

```bash
cd Apps/api
npx prisma migrate dev --name stage04_s9_order_lines
```

Prisma warns that it is dropping columns which still contain data. **Accept** — F8. If the CLI
refuses to proceed non-interactively, run `npx prisma migrate reset --force` first (dev database,
seeds re-run) and then the command above. Finish with `npx prisma generate` if the migrate command
did not already regenerate the client.

Verify afterwards: `npx prisma validate` → "The schema at prisma/schema.prisma is valid."

---

## 2. Contract (`Apps/contract`)

### Action 6 — `Apps/contract/src/modules/orders/orders.enums.ts`

Add `CANCELLED_BY_CLIENT = 'CANCELLED_BY_CLIENT'` to `OrderStatus`, between `CANCELLED` and
`RETURNED`, with a one-line comment: *"D4 — client-initiated cancellation; terminal, releases the
reservation exactly like admin CANCELLED (S10)."*

### Action 7 — `Apps/contract/src/modules/orders/orders.dtos.ts`

Add `OrderLineResponseSchema` **above** `OrderResponseSchema`, and rewrite `OrderResponseSchema`'s
product block into `lines`.

```ts
// D1 — orders are multi-line. Mirrors SaleLineResponseSchema's shape (sales.dtos.ts): a snapshot
// of what was ordered, plus the two margin-gated FIFO figures which stay absent until the order
// completes (S10) and are stripped entirely for a non-admin viewer.
export const OrderLineResponseSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  productName: z.string(),
  quantity: z.number().int(),
  resolvedPrice: z.number(),
  unitPrice: z.number(),
  serialNumbers: z.array(z.string()).optional(),
  costOfGoods: z.number().optional(),
  profit: z.number().optional(),
  lineTotal: z.number(),
});
export type OrderLineDto = z.infer<typeof OrderLineResponseSchema>;
```

In `OrderResponseSchema`: **delete** `productId`, `productName`, `quantity`, `resolvedPrice`,
`unitPrice`, `serialNumbers`, `costOfGoods`, `profit`. **Add**, in their place:

```ts
  lines: z.array(OrderLineResponseSchema),
```

and after `paidAmount`:

```ts
  totalCost: z.number().optional(),   // margin-gated, set at COMPLETED (S10)
  totalProfit: z.number().optional(),
```

Update the schema's header comment: the sentence about `costOfGoods/profit` being mapping-gated now
applies to `totalCost/totalProfit` **and** to each line's own pair.

In `OrderStatsResponseSchema`, add `cancelledByClient: z.number().int().min(0)` after `cancelled`.

### Action 8 — `Apps/contract/src/modules/orders/orders.command.ts`

`PlaceOrderSchema`: replace the top-level `productId` + `quantity` with a `lines` array. Both
`.refine`s on `delivery` stay untouched.

```ts
    lines: z
      .array(
        z.object({
          productId: z.uuid(),
          quantity: z.number().int().min(1),
        }),
      )
      .min(1),
```

Update the schema's header comment to note that a single-product placement is simply a one-element
`lines` array (the cart's multi-line placement is S16).

`ReturnOrderSchema`: replace the flat `quantity` with per-line quantities (R1 — the admin
COMPLETED-return survives, but an order now has N lines to return).

```ts
// Admin return of a COMPLETED order (R1). One return per order — the order flips to RETURNED — so
// quantities are absolute, not cumulative across several return documents the way sales' are.
export const ReturnOrderSchema = z.object({
  lines: z
    .array(
      z.object({
        orderLineId: z.uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
  restock: z.boolean(),
  refundAmount: z.number().min(0),
});
```

`ConfirmOrderSchema` and `UpdateOrderStatusSchema` are **unchanged in this set** (R3 — S10 deletes
the first and extends the second).

### Action 9 — `Apps/contract/src/modules/orders/orders.events.ts`

`'order.confirmed'`: rename `snapshotLine` (object) to `snapshotLines` (array of the same object
shape). Nothing else changes. Update the file's header comment accordingly.

```ts
    snapshotLines: {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
```

---

## 3. Backend ripple (`Apps/api`)

### Action 10 — `Apps/api/src/modules/orders/orders.mapper.ts`

1. Import `OrderLine` from `@prisma/client` and `OrderLineDto` from the contract.
2. `OrderRow` gains `lines: OrderLine[]`.
3. `toOrderDto`: delete the six product fields and the two margin-gated order fields; build
   `lines` with a new private `toLineDto(line, ctx)` helper that applies the **same** margin gate
   per line (`ctx.includeMargins && line.costOfGoods != null`) and the same `parseSerials` on the
   line's own `serialNumbers`. Add order-level `totalCost`/`totalProfit` under the same gate.
   `canBeCancelled` stays `status === OrderStatus.PENDING` (S10 widens it).
4. `PlaceOrderContext`: replace `productName: string` + `resolvedPrice: number` with
   `lines: { productId: string; productName: string; resolvedPrice: number; quantity: number }[]`.
5. `toPersistencePlace`: compute `subtotal` as `Σ resolvedPrice × quantity` over `ctx.lines`, and
   emit a nested create:

```ts
      lines: {
        create: ctx.lines.map((line) => ({
          productId: line.productId,
          productNameSnapshot: line.productName,
          quantity: line.quantity,
          resolvedPrice: line.resolvedPrice,
          unitPrice: line.resolvedPrice, // frozen equal at placement (BL#1)
          lineTotal: line.resolvedPrice * line.quantity,
        })),
      },
```

   Its doc comment keeps the "resolvedPrice frozen equal to unitPrice at placement" statement but
   now says **per line**.
6. `toStatsDto`: add `cancelledByClient: counts[OrderStatus.CANCELLED_BY_CLIENT] ?? 0`.

### Action 11 — `Apps/api/src/modules/orders/orders.service.ts`

Purely mechanical. Every guard, status check and event stays.

1. `ORDER_INCLUDE` gains `lines: { orderBy: { id: 'asc' as const } }` — an explicit, stable order,
   so the DTO's `lines` never reshuffles between reads.
2. **`placeOrder`**: call `getCartProducts(cmd.lines.map((l) => l.productId), actor)` once; build a
   `Map<productId, ProductWithPricingDto>` from the result (the port does not guarantee input
   order). For **each** command line: missing product → `NotFoundError('Product')`; `priceHidden ||
   currentPrice == null` → `ForbiddenError('GUEST_PRICE_HIDDEN')`. Build the mapper's `ctx.lines`
   from that map. Inside the transaction, after `tx.order.create`, loop the command lines and call
   `this.inventory.reserve(tx, line.productId, line.quantity, { referenceType: 'ORDER', referenceId:
   order.id, staffId })` once per line. The existing comment about "stock conflict throws here"
   stays and now covers the loop.
3. **`cancelMyOrder`**: replace the single `release` with a loop over `existing.lines`.
4. **`confirmOrder`**: keep every guard and the idempotent early return. Replace the single
   release/consume pair with a loop over `existing.lines`:
   - `const unitPrice = existing.lines.length === 1 && cmd.unitPrice != null ? cmd.unitPrice : line.unitPrice.toNumber()`
     — a **transitional shim**, commented as such: *"S9 keeps `ConfirmOrderCommand.unitPrice`
     working for the single-line orders the UI produces today; S10 deletes this command entirely
     and moves price editing to the status machine."*
   - per line: `release` → `consumeFifo(..., unitPrice * line.quantity, MovementType.ORDER_OUT, ref)`;
     write the line's `unitPrice`, `lineTotal`, `costOfGoods`, `profit` via `tx.orderLine.update`;
     accumulate `totalCost` / `totalProfit`.
   - the `applyDocumentCharge({ totalSoldDelta: existing.totalAmount.toNumber(), creditDelta: 0 })`
     call is **unchanged** (S10 moves it).
   - `tx.order.update` writes `totalCost`/`totalProfit` instead of `costOfGoods`/`profit`; keep
     `status`, `confirmedAt`, `confirmedByStaffId`, `paidAmount` exactly as they are. The `unitPrice`
     write moves onto the lines.
   - the `order.confirmed` emit carries `snapshotLines: [...]` built from the same loop's data.
5. **`cancelOrder`**: loop the release over `existing.lines` (still only when `status === PENDING`
   — S10 changes that rule, not S9). Its long comment about "stock was already consumed at confirm"
   is still true today; leave it, S10 rewrites it.
6. **`returnOrder`**: `cmd.quantity` is gone. Build a `Map<orderLineId, OrderLine>` from
   `existing.lines`; reject an unknown `orderLineId` or a `quantity` above the line's own with
   `BadRequestError`. When `cmd.restock`, loop the command lines calling
   `buildOriginalConsumptions(tx, existing.id, line.productId, cmdLine.quantity)` then
   `inventory.returnIn(...)` — exactly the sales-module shape. Status write and the
   `order.returned` emit are unchanged.
7. `getStats` / `applyClientPaymentRecorded`: unchanged.

### Action 12 — `Apps/api/src/modules/orders/orders.interface.ts`

No signature changes. Update the `IOrderCreditPort` comment's closing sentence (it already names
S10) only if Action 11 made it inaccurate — it did not. **Add** one line to the file header of
`CancelOrderCommand`? No. This action is a read-and-verify pass: confirm no comment in this file
now describes a single-product order. The `ICatalogViewerPricingPort` comment says
`getCartProducts(productIds, viewer)` — already plural, still accurate.

### Action 13 — `Apps/api/src/modules/billing/billing.service.ts`

1. **`issueFromOrder`** (line 302): `order.costOfGoods` / `order.profit` → `order.totalCost` /
   `order.totalProfit` (F2), including the `logger.warn` message text. Build the invoice's `lines`
   from the **order's own rows**, not from the event payload — change the fetch to
   `findUniqueOrThrow({ where: { id: payload.orderId }, include: { lines: true } })`:

```ts
      lines: order.lines.map((line) => ({
        label: line.productNameSnapshot,
        quantity: line.quantity,
        unitPrice: line.unitPrice.toNumber(),
        costSnapshot: line.costOfGoods?.toNumber() ?? 0,
        profit: line.profit?.toNumber() ?? 0,
        lineTotal: line.lineTotal.toNumber(),
        ...(line.serialNumbers != null ? { serialNumbers: line.serialNumbers } : {}),
      })),
```

   `payload.snapshotLines` then serves only observability. The invoice's own `totalCost`/
   `totalProfit` still come from the order's totals. Update the method's doc comment, which
   currently claims the order's totals are the source of truth for a **single** invoice line — it
   is now the **per-line** FIFO figures.
2. **`resolveCurrentAvgStockPrices`** (line 497): the ORDER branch (527–539) assumes one line and a
   direct `Order.productId`. Replace it with the same best-effort correlation the SALE branch uses,
   over `OrderLine`:

```ts
    if (orderSourced.length > 0) {
      const orderLines = await this.prisma.orderLine.findMany({
        where: { orderId: { in: orderSourced.map((i) => i.sourceId) } },
      });
      const linesByOrderId = new Map<string, typeof orderLines>();
      for (const line of orderLines) {
        const list = linesByOrderId.get(line.orderId) ?? [];
        list.push(line);
        linesByOrderId.set(line.orderId, list);
      }

      for (const invoice of orderSourced) {
        const candidates = linesByOrderId.get(invoice.sourceId) ?? [];
        for (const invoiceLine of invoice.lines) {
          const match = candidates.find(
            (line) =>
              line.productNameSnapshot === invoiceLine.label &&
              line.quantity === invoiceLine.quantity &&
              line.unitPrice.toNumber() === invoiceLine.unitPrice.toNumber(),
          );
          if (match) productIdByInvoiceLineId.set(invoiceLine.id, match.productId);
        }
      }
    }
```

   Rewrite the method's doc comment: the sentence *"ORDER-origin invoices have no such ambiguity:
   `Order.productId` is a direct FK and every ORDER invoice has exactly one line"* is now **false**
   — say instead that ORDER invoices are correlated the same best-effort way as SALE ones, with the
   same documented limitation.

### Action 14 — `Apps/api/src/modules/statistics/statistics.service.ts`

One mechanical rename, line 321: `_sum: { totalAmount: true, profit: true }` →
`_sum: { totalAmount: true, totalProfit: true }`, and the reader below it
(`orderAgg._sum.profit?.toNumber()` → `orderAgg._sum.totalProfit?.toNumber()`).

**Do not touch `ORDER_RECOGNIZED_STATUSES` or the `confirmedAt` filters** — that is S10's Action 10.

---

## 4. Frontend ripple (`Apps/web`) — compile-level only

All of these keep today's rendering. The real multi-line UI (per-line product cells, action column,
new stat cards) is **S11**.

### Action 15 — `Apps/web/src/pages/product-detail/order.schema.ts`

Keep the form schema **exactly as it is** (F5). Replace the `AssertAssignable` guard block at the
bottom with a typed mapper — the return type is the compile-time guard now:

```ts
// D1 — PlaceOrderCommand carries a lines[] array; this form collects a single product, so the
// mapping is one line. The `: PlaceOrderCommand` return annotation is the compile-time guard the
// old `AssertAssignable` check used to provide: a renamed or removed contract field fails here.
// The cart's true multi-line placement is S16.
export function toPlaceOrderCommand(
  values: OrderFormValues,
  clientId: string | null,
): PlaceOrderCommand {
  return {
    clientId,
    lines: [{ productId: values.productId, quantity: values.quantity }],
    orderType: values.orderType,
    contact: values.contact,
    ...(values.delivery !== undefined ? { delivery: values.delivery } : {}),
  };
}
```

### Action 16 — `Apps/web/src/pages/ProductDetails.tsx` (line 93) and `Apps/web/src/pages/cart/Cart.tsx` (line 47)

Both build `const command: PlaceOrderCommand = { ...data, clientId }`. Replace with
`toPlaceOrderCommand(data, …)` (imported from `@/pages/product-detail/order.schema`), preserving
each caller's own `clientId` expression (`isClient ? (session?.clientId ?? null) : null` in
ProductDetails; `null` in Cart). Drop the now-unused `PlaceOrderCommand` type import from both.

### Action 17 — `Apps/web/src/pages/staff/orders/components/OrdersTable.tsx`

The `productName` and `quantity` columns lose their `accessorKey`. Replace both with `id`-based
columns keeping the **same headers** (`staff.orders.table.product`, `staff.orders.table.quantity`):

- product cell: `row.original.lines.map((l) => l.productName).join(", ")` — wrap in a
  `<span className="line-clamp-2">`.
- quantity cell: `row.original.lines.reduce((sum, l) => sum + l.quantity, 0)`.
- `renderMobileRow`'s `{order.productName}` → the same joined string.

No new translation keys.

### Action 18 — `Apps/web/src/pages/staff/orders/components/OrderShowDialog.tsx`

The single product block (lines 60–71) becomes a `map` over `order.lines`, each row rendering
`line.productName`, `{t("staff.orders.table.quantity")}: {line.quantity}` and
`<ResolvedVsChargedPrice resolvedPrice={line.resolvedPrice} unitPrice={line.unitPrice} />`. Give
each row `key={line.id}`. Keep the surrounding bordered-card styling per row. No new keys.

### Action 19 — `Apps/web/src/pages/staff/orders/StaffOrders.tsx` (line 105)

`showOrder?.productId ?? ""` → `showOrder?.lines[0]?.productId ?? ""`, with a comment noting the
live-availability re-check still covers only the first line and that S11 revisits it now that
orders are multi-line.

### Action 20 — `Apps/web/src/pages/staff/orders/components/OrderConfirmDialog.tsx` (line 48)

`defaultValues.unitPrice: order?.unitPrice` → `order?.lines[0]?.unitPrice`. Matches the backend
shim in Action 11.4. **S10 deletes this file** — this is a one-line keep-it-compiling change.

### Action 21 — `Apps/web/src/components/shared/OrderCard.tsx`

1. The stale header comment (lines 29–34) says *"OrderDto is single-product (productId/productName/
   quantity, no line array) and OrderStatus has 7 values"* — rewrite: OrderDto is multi-line (D1)
   and `OrderStatus` has **8** values (adds `CANCELLED_BY_CLIENT`).
2. Add `CANCELLED_BY_CLIENT` to all three `Record<OrderStatus, …>` maps (F6):
   `STATUS_ICON` → `<XCircle className="h-4 w-4" />`; `STATUS_COLOR` →
   `"bg-red-100 text-red-800 border-red-200"`; `STATUS_LABEL_KEY` → `"orders.cancelledByClient"`.
3. Line 135: `{order.productName} × {order.quantity}` →
   `{order.lines.map((l) => `${l.productName} × ${l.quantity}`).join(", ")}`.

### Action 22 — `Apps/web/src/pages/order-confirmation/components/OrderConfirmationBody.tsx` (line 45–49)

The product row becomes one row per line inside the same `<div>` block, each rendering
`{line.productName} × {line.quantity}`. The `t("orderConfirmation.product")` label stays on the
first row only. No new keys.

### Action 23 — `Apps/web/src/pages/staff/orders/order-status-labels.ts`

Add `[OrderStatus.CANCELLED_BY_CLIENT]: "orders.cancelledByClient"`.

### Action 24 — `Apps/web/src/pages/my-orders/components/OrderStatusFilters.tsx`

Add `[OrderStatus.CANCELLED_BY_CLIENT]: "orders.cancelledByClient"` to `STATUS_LABEL_KEY` and
`OrderStatus.CANCELLED_BY_CLIENT` to `FILTER_ORDER`, immediately after `OrderStatus.CANCELLED`.

### Action 25 — `Apps/web/src/pages/admin/orders/components/return-order.schema.ts`

Rebuild against the new `ReturnOrderCommand`. The factory currently takes `maxQuantity: number`;
it now takes the order's lines so each line gets its own bound:

```ts
export function returnOrderSchema(
  t: ReturnType<typeof useTranslation>["t"],
  lines: { id: string; quantity: number }[],
) {
  const maxById = new Map(lines.map((line) => [line.id, line.quantity]));
  return z.object({
    lines: z
      .array(
        z.object({
          orderLineId: z.string().min(1),
          quantity: z.coerce
            .number()
            .int()
            .min(1, t("admin.orders.returnDialog.quantityMin")),
        }),
      )
      .min(1)
      .superRefine((value, ctx) => {
        value.forEach((line, index) => {
          const max = maxById.get(line.orderLineId);
          if (max !== undefined && line.quantity > max) {
            ctx.addIssue({
              code: "custom",
              message: t("admin.orders.returnDialog.quantityExceedsOrdered"),
              path: [index, "quantity"],
            });
          }
        });
      }),
    restock: z.boolean(),
    refundAmount: z.number().min(0, t("admin.orders.returnDialog.refundAmountInvalid")),
  });
}
```

Keep whatever `restock`/`refundAmount`/`reason` fields the current file has, with their existing
message keys. Keep the file's `AssertAssignable` guard against `ReturnOrderCommand` if one exists.

**Note the `z.coerce.number()`**: `Docs/Stage-04-Fixes/results/report-S03.md` records that
`register(..., { valueAsNumber: true })` on an empty input yields `NaN` and that a
`z.preprocess`/`zodResolver` combination misbehaves — coerce is the pattern that set settled on.

### Action 26 — `Apps/web/src/pages/admin/orders/components/return-order-dialog.tsx`

Render one quantity input per `order.lines` entry instead of the single one:
`defaultValues.lines = order.lines.map((l) => ({ orderLineId: l.id, quantity: l.quantity }))`,
each row labelled with `line.productName` and the existing
`t("admin.orders.returnDialog.quantityLabel")`, `max={line.quantity}`. Field paths become
`lines.${index}.quantity`; the per-row error is `errors.lines?.[index]?.quantity?.message`. The
`returnOrderSchema(t, order?.lines ?? [])` call replaces `returnOrderSchema(t, order?.quantity ?? 1)`.
No new translation keys.

### Action 27 — `Apps/web/src/config/translations.json`

Add exactly one key:

```json
"orders.cancelledByClient": { "en": "Cancelled by client", "fr": "Annulée par le client", "ar": "" }
```

---

## 5. Documentation

### Action 28 — `Docs/Stage-00-Conception/database-description.md`, §8 "Online Orders"

The section opens *"**Order** — single product, so the line is **folded into the order row**"* —
now false. Rewrite the **model** half only (the lifecycle sentences are S10's Action 12):

- `Order` keeps `reference · clientId? · status · orderType · contactName · contactPhone ·
  wilayaId? · communeId? · address? · deliveryCompany? · trackingNumber? · subtotal · deliveryFee ·
  totalAmount · paidAmount · totalCost? · totalProfit? · placedAt · confirmedAt? · deliveredAt? ·
  cancelledAt? · confirmedByStaffId? · cancellationReason?`.
- New paragraph: **OrderLine** — `orderId FK · productId FK · productNameSnapshot · quantity ·
  resolvedPrice (frozen at placement) · unitPrice · costOfGoods? + profit? (set at COMPLETED, FIFO)
  · lineTotal · serialNumbers?`.
- `status` enum gains `CANCELLED_BY_CLIENT` (D4).

---

## 6. Validation gate

```
Apps/contract:  npx tsc --noEmit      npm run lint
Apps/api:       npx prisma validate   npx tsc --noEmit   npm run lint
Apps/web:       npx tsc --noEmit      npm run lint
```

`Apps/api`'s `tsc` includes `test/**`; **only `src/**` errors count**. Filter the output by path
and itemize the stale test files in the report (they are not to be edited). `npm run lint` on
`Apps/api` has a known 6-error pre-existing baseline (`prisma/seed.ts` ×3,
`validate-request.middleware.ts` ×3) — unchanged is green.

**Sweep** (paste the results into the report):

```bash
grep -rn "order.productId\|order\.quantity\b\|productNameSnapshot" Apps/api/src/modules/orders Apps/api/src/modules/billing
grep -rn "snapshotLine\b" Apps/api/src Apps/contract/src
grep -rn "\.costOfGoods\|\.profit\b" Apps/api/src/modules/statistics
grep -rn "order\.productName\|order\.quantity\|order\.unitPrice\|order\.resolvedPrice" Apps/web/src
```

Every hit must be either an `OrderLine`/`line.` access or a comment.

---

## 7. Manual verification checklist

No automated test runs. The owner performs these in the browser.

**Placement still works end-to-end**
1. `/products/:id` as a guest → order a product (delivery home). The confirmation page shows the
   product name × quantity, the delivery fee and the grand total, exactly as before.
2. `/products/:id` signed in as a client → order with pickup. Same.
3. `/cart` → order a favourited item. Same.
4. `SELECT * FROM "OrderLine" WHERE "orderId" = '<the new order>';` → **one row**, its
   `resolvedPrice` equal to its `unitPrice`, `costOfGoods` and `profit` **null**.
5. `/admin/inventory` → the product's **reserved** quantity rose by the ordered amount.

**The back office reads the lines**
6. `/admin/orders` → the new order's row shows the product name and quantity in their columns.
7. Click the row → the details dialog lists the line with its resolved-vs-charged price.
8. `/staff/orders` → identical (the page is the same component in staff scope).

**Confirm still behaves exactly as before this set**
9. Confirm the order from the details dialog, optionally overriding the charged price. It moves to
   CONFIRMED, stock moves from reserved to consumed, and an invoice appears under
   `/admin/invoices` → outgoing with **one** line carrying the right label, quantity and price.
10. `SELECT "totalCost", "totalProfit" FROM "Order" WHERE reference = '…';` — both set.
    `SELECT "costOfGoods", profit FROM "OrderLine" WHERE "orderId" = '…';` — both set, and they sum
    to the order totals.
11. `/admin/statistics` loads and its revenue/profit figures still include that order.

**Cancel and return**
12. Place a second order, cancel it while PENDING from `/orders` (client) — reservation released.
13. Place and confirm a third, then `/admin/orders` → details → Issue return. The dialog now shows
    **one quantity input per product line**, defaulted to the ordered quantity. Submit with restock
    on → the order reads RETURNED and the product's on-hand quantity rose.

**The new status value exists but is not yet reachable**
14. `/orders` (client) → the filter chips now include "Cancelled by client" with a count of 0.
    Selecting it shows the empty state. Nothing can reach that status until S10.

---

## 8. Execution protocol

Start Set plan execution. After finishing, write `Docs/Stage-04-Fixes/results/report-S09.md`
describing what changed, ending with the verification checklist above. The owner reviews and
approves before S10 begins.
