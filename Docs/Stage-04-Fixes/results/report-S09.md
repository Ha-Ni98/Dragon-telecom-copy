# Report — Set 9 (Orders: schema, contract & order lines)

Executed against `Docs/Stage-04-Fixes/plans/plan-S09-orders-schema-contract-lines.md`, all 28
actions, 2026-07-27. Both validation gates green (tsc + lint, contract/api/web). No test file was
edited or read. No test suite was run. Implements **D1** (orders are multi-line) and the schema
half of **D4** (`CANCELLED_BY_CLIENT`). No behavioral change — every guard, status check and
credit call kept its current semantics; S10 changes the behavior.

---

## What changed

### Prisma schema & migration (Actions 1–5)

`Apps/api/prisma/schema.prisma`:
- `OrderStatus` gains `CANCELLED_BY_CLIENT`, between `CANCELLED` and `RETURNED`.
- `Order` loses `productId`, `productNameSnapshot`, `quantity`, `resolvedPrice`, `unitPrice`,
  `serialNumbers`; `costOfGoods`/`profit` renamed to `totalCost`/`totalProfit`; gains the `lines
  OrderLine[]` back-relation.
- New `model OrderLine`: `orderId`, `productId`, `productNameSnapshot`, `quantity`,
  `resolvedPrice`, `unitPrice`, `costOfGoods?`, `profit?`, `lineTotal`, `serialNumbers?`, indexed on
  `orderId` and `productId`.
- `Product.orders Order[]` → `Product.orderLines OrderLine[]`.

Migration `20260727092237_stage04_s9_order_lines` created and applied. The dev database was reset
first (`prisma migrate reset --force`, with the owner's explicit consent — Prisma's own
non-interactive safety guard required it) since `prisma migrate dev` refused to run non-interactively
against a schema change that would have dropped non-empty columns; the reset made the drop a no-op
against empty tables. Both the reset and the migration itself ran against `dragon_telecom_dev`
only — `dragon_telecom_test` (a separate database) was untouched.

### Contract (Actions 6–9)

- `orders.enums.ts`: `OrderStatus.CANCELLED_BY_CLIENT` added.
- `orders.dtos.ts`: new `OrderLineResponseSchema`/`OrderLineDto`; `OrderResponseSchema` drops the
  six folded product fields and the two order-level margin fields, gains `lines:
  OrderLineResponseSchema[]` and `totalCost?`/`totalProfit?`. `OrderStatsResponseSchema` gains
  `cancelledByClient`.
- `orders.command.ts`: `PlaceOrderSchema`'s `productId`/`quantity` replaced by `lines: {productId,
  quantity}[]` (min 1). `ReturnOrderSchema`'s flat `quantity` replaced by `lines: {orderLineId,
  quantity}[]` (min 1). `ConfirmOrderSchema`/`UpdateOrderStatusSchema` left untouched, as specified
  (S10's job).
- `orders.events.ts`: `order.confirmed.snapshotLine` (object) → `snapshotLines` (array of the same
  shape). Also added `order.cancelled.byClient?: boolean` here — that field is S10 material
  (Action 4 of the S10 plan), added a set early since both sets landed in the same session; noted
  so a reviewer isn't surprised to see it already present when reading the S10 diff.

### Backend (Actions 10–14)

- `orders.mapper.ts`: `OrderRow` gains `lines: OrderLine[]`. `toOrderDto` builds `lines` via a new
  `toLineDto` (same margin gate, same serial-parsing convention, now per line) and reads
  `totalCost`/`totalProfit` off the order under the same gate. `PlaceOrderContext` takes a `lines`
  array instead of a single `productName`/`resolvedPrice` pair. `toPersistencePlace` sums
  `resolvedPrice × quantity` across lines for `subtotal` and emits a nested `lines: { create: […] }`
  write. `toStatsDto` adds `cancelledByClient`.
- `orders.service.ts`: `ORDER_INCLUDE` now includes `lines` (ordered by `id: 'asc'` for a stable
  DTO shape). `placeOrder` resolves every line's price through one `getCartProducts` call (keyed by
  a `Map`, since the port doesn't guarantee input order) and reserves stock per line inside the
  transaction. `cancelMyOrder` and `cancelOrder` release every line instead of one. `confirmOrder`
  loops `existing.lines`, running one release/consume pair per line and writing each line's
  `unitPrice`/`lineTotal`/`costOfGoods`/`profit`; it keeps a **transitional shim** — when the order
  has exactly one line, `cmd.unitPrice` (still a single scalar, since `ConfirmOrderCommand` is
  untouched this set) overrides that one line's price, exactly matching today's single-product
  behavior. `returnOrder` now validates and iterates `cmd.lines` against a `Map` built from
  `existing.lines`, rejecting an unknown `orderLineId` or an over-quantity return with
  `BadRequestError`.
- `billing.service.ts`: `issueFromOrder` re-fetches the order **with its lines included** and reads
  `totalCost`/`totalProfit` (renamed columns) plus builds the invoice's `lines` from the order's own
  `OrderLine` rows rather than the event payload's `snapshotLine`. `resolveCurrentAvgStockPrices`'s
  ORDER branch now does the same best-effort (label, quantity, unitPrice) correlation the SALE
  branch always used, since an order can have more than one line and no longer carries a bare
  `productId` FK; its doc comment (which claimed ORDER invoices were unambiguous) is corrected.
- `statistics.service.ts`: `computeRevenueProfit`'s order aggregate reads `totalProfit` instead of
  the now-gone `profit` column — a pure rename, no behavior change (S10 is what fixes the actual
  double-counting/timing issue flagged in the plan's F8).

### Frontend (Actions 15–27)

- `product-detail/order.schema.ts`: the `AssertAssignable` compile-time guard replaced by a typed
  `toPlaceOrderCommand(values, clientId)` mapper (wraps the single collected product into a
  one-element `lines` array) — the function's `: PlaceOrderCommand` return annotation is now the
  guard.
- `ProductDetails.tsx` / `cart/Cart.tsx`: both call the new mapper instead of spreading form data
  directly into `PlaceOrderCommand`.
- `OrdersTable.tsx`: product/quantity columns now derive from `row.original.lines` (joined names,
  summed quantities); mobile row does the same.
- `OrderShowDialog.tsx`: the single product block is now one bordered row per `order.lines` entry.
- `StaffOrders.tsx`: the live-availability re-check now reads `showOrder?.lines[0]?.productId`,
  with a comment noting it still covers only the first line (S11's job to revisit).
- `OrderConfirmDialog.tsx`: `defaultValues.unitPrice` now reads `order?.lines[0]?.unitPrice`
  (this dialog and its schema are deleted in S10 — this was the one-line keep-it-compiling change
  named in the plan).
- `OrderCard.tsx`: header comment corrected (OrderDto is multi-line again, `OrderStatus` now has 8
  values); all three `Record<OrderStatus, …>` maps (`STATUS_ICON`/`STATUS_COLOR`/`STATUS_LABEL_KEY`)
  gained a `CANCELLED_BY_CLIENT` entry; the product/quantity line now joins every order line.
- `OrderConfirmationBody.tsx`: one row per line, with the "Product" label shown only on the first.
- `order-status-labels.ts` / `OrderStatusFilters.tsx`: both gained a `CANCELLED_BY_CLIENT` entry
  (label key + filter-chip position, immediately after `CANCELLED`).
- `return-order.schema.ts`: rebuilt around `ReturnOrderCommand`'s new `lines` shape — the factory
  now takes the order's lines and enforces a per-line `.max()` via `superRefine`; switched from
  `register(..., { valueAsNumber: true })`-style bare `z.number()` to `z.coerce.number()` for both
  numeric fields (the `NaN`-on-empty-input trap documented in `report-S03.md`). Because
  `z.coerce.number()`'s *input* type is `unknown` (not `number`), a plain single-generic
  `useForm<ReturnOrderFormValues>` no longer type-checked against `zodResolver` — fixed using this
  codebase's existing 3-generic `useForm<Input, unknown, Output>` precedent
  (`register.schema.ts`/`Register.tsx`; the same gotcha is documented in `supplier.schema.ts`'s
  `optionalEmail` comment). Added `export type ReturnOrderFormInput = z.input<...>` alongside the
  existing `ReturnOrderFormValues`.
- `return-order-dialog.tsx`: renders one quantity input per order line (each labelled with the
  product name), wired to `useForm<ReturnOrderFormInput, unknown, ReturnOrderFormValues>`.
- `translations.json`: one new key, `orders.cancelledByClient` (en/fr filled, ar left `""` per
  convention).

### Documentation (Action 28)

`Docs/Stage-00-Conception/database-description.md` §8: the **model** half rewritten — `Order` no
longer described as "single product, folded into the order row"; a new `OrderLine` paragraph added;
`status` enum text gains `CANCELLED_BY_CLIENT`. The **lifecycle** sentences (confirm-time
consumption, etc.) were deliberately left as they were — they are still accurate at the end of S9
(nothing behavioral changed) and are S10's Action 18 to rewrite.

---

## Findings during execution

**One file outside the plan's named list needed a fix, caught by the web `tsc` gate.**
`Apps/web/src/components/shared/CancelOrderDialog.tsx:69` read `order.productName`/`order.quantity`
directly — not named in the plan's action list, but broken by the DTO shape change. Fixed the same
way as every other single-line-order consumer (joined `lines.map(...)`), and rewrote its header
comment, which had claimed "OrderDto is single-product" and is now stale.

**Prisma's own safety guard blocked the non-interactive migration.** `prisma migrate dev` refused
to run non-interactively once it detected the schema change would drop non-empty `Order` columns,
and a subsequent `prisma migrate reset --force` was itself intercepted by a harness-level guard
requiring explicit human consent for destructive database actions run by an AI agent. The owner was
asked directly, gave explicit consent quoting the exact database ("not in production, only draft"),
and the reset proceeded under `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. Only
`dragon_telecom_dev` was affected; the migration that followed applied cleanly with no drop
warnings since the tables were already empty.

**A few new prettier-only lint findings, fixed rather than left as noise.** The four files with the
most substantial new JSX (`return-order-dialog.tsx`, `OrderConfirmationBody.tsx`,
`OrderShowDialog.tsx`, `OrdersTable.tsx`) picked up a handful of line-wrap-only `prettier/prettier`
findings on first pass. Rather than stack new noise onto this codebase's already-documented ~10.2k
pre-existing lint baseline (`Docs/Stage-04-Fixes/results/report-S03.md`/set-04 plan), these were
auto-fixed with `eslint --fix` scoped to just those four files; `tsc` was re-verified clean
afterward. Nothing pre-existing was touched — confirmed by diffing `ProductDetails.tsx`, which
lint also flagged, but whose diff is 3 lines and unrelated to the ~40 pre-existing indentation
findings later in that same file.

No other deviations from the plan were required.

---

## Sweep results (plan §6) — all four clean

```
1. grep -rn "order.productId\|order\.quantity\b\|productNameSnapshot" Apps/api/src/modules/orders Apps/api/src/modules/billing
   → Every hit is a `line.productNameSnapshot`/`line.productId` access (OrderLine field), never
     `order.productId`/`order.quantity`. ✓

2. grep -rn "snapshotLine\b" Apps/api/src Apps/contract/src
   → One hit, a comment noting the rename to `snapshotLines`. ✓

3. grep -rn "\.costOfGoods\|\.profit\b" Apps/api/src/modules/statistics
   → All hits are `sale.lines`/`SaleLine` reads (sales-by-category) or the `AdminDashboardDto`'s
     own `profit`/`profitChangePct` fields — nothing reads the old `Order.costOfGoods`/`profit`. ✓

4. grep -rn "order\.productName\|order\.quantity\|order\.unitPrice\|order\.resolvedPrice" Apps/web/src
   → Empty. ✓
```

---

## Validation gate — all green

```
Apps/contract: npx tsc --noEmit ✓ (0 errors)          npm run lint ✓ (0 problems)

Apps/api:      npx prisma validate ✓ ("the schema at prisma/schema.prisma is valid")
               npx tsc --noEmit — src/** is 0 errors (grep-filtered for lines starting with
               `src/`; every remaining error is under `test/`, itemized below).
               npm run lint ✓ — 6 pre-existing errors (prisma/seed.ts ×3,
               validate-request.middleware.ts ×3), identical to the S1/S4/S5 baseline, both
               files untouched this session.

Apps/web:      npx tsc --noEmit ✓ (0 errors)
               npm run lint — pre-existing ~3900-error prettier-noise baseline (documented,
               set-04 plan/report-S03.md); the handful of *new* findings in files this set
               touched were fixed with a scoped `eslint --fix`, re-verified with `tsc` afterward.
```

**Stale tests (not edited, not run) — every `test/**` error from `npx tsc --noEmit`:**

| File | What's stale |
|---|---|
| `test/unit/modules/orders/orders.mapper.spec.ts` | Constructs `OrderRow`/`PlaceOrderContext` fixtures with the old flat `productId`/`quantity`/`resolvedPrice`/`unitPrice`/`costOfGoods`/`serialNumbers` shape; asserts on `OrderDto.productName`/`resolvedPrice`/`unitPrice`/`serialNumbers` directly instead of via `lines[]`. |
| `test/unit/modules/orders/orders.service.spec.ts` | Calls `placeOrder`/`returnOrder` with the old flat command shapes (`productId`/`quantity` instead of `lines`); mocks `IOrderCreditPort` with `applyOrderSold` (already stale from S5, unrelated to this set). |
| `test/unit/modules/sales/*.spec.ts`, `test/unit/modules/purchasing/purchasing.mapper.spec.ts` | Already stale from S1/S5 (documented in those sets' reports) — untouched here, no new errors layered on by S9. |

No test file was edited. No test suite was run.

---

## Handoffs recorded (plan implicit)

1. **S10** consumes: the contract's `lines[]` shape on `PlaceOrderCommand`/`OrderDto`, the
   `ReturnOrderCommand.lines` shape, `Order.totalCost`/`totalProfit`, `OrderLine.costOfGoods`/
   `profit`, and `OrderStatus.CANCELLED_BY_CLIENT`. `orders.service.ts`'s `confirmOrder` is deleted
   wholesale in S10 (folded into `updateStatus`), so its transitional single-line shim is
   short-lived by design.
2. `billing.service.ts`'s `resolveCurrentAvgStockPrices` ORDER branch now shares the SALE branch's
   documented best-effort-matching limitation — worth remembering if a future statistics or
   supplier-invoice-hint set ever audits `avgStockPrice` correlation accuracy.
3. `order.cancelled.byClient` already exists in the contract (added a set early, see Findings
   above) — S10 is what actually populates it from `cancelMyOrder`/`cancelOrder`.

---

## Manual verification checklist

The owner performs these in the browser. No automated test runs.

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

The owner reviews and approves before S10 begins.
