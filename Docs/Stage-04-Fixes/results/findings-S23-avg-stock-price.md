# Findings — Set 23: `avgStockPrice` maintenance *(audit — no code changed)*

Audit of how `Product.avgStockPrice` is maintained across every movement type, against the
owner-approved corrected rule in `Docs/Stage-04-Fixes/sets-22-25.md` § S23.

**Nothing in this document has been implemented.** No source file was modified, no test was run,
no data was touched. The only commands executed against the database were `SELECT`s.

**Prerequisite for the fix plan:** none. S23's fix is self-contained inside the inventory engine.
S24 (statistics audit) depends on this one, because stock valuation reads `avgStockPrice`.

---

## Summary

| # | Severity | Where | What |
|---|----------|-------|------|
| **F1** | **Critical** | `inventory.service.ts` › `InventoryService.consumeFifo` | No OUT movement recomputes `avgStockPrice`. The stored figure drifts from the true FIFO value of remaining stock at every OUT, in either direction. **Confirmed on live data: 3 of 16 stocked products already drifted; total stock valuation understated by 7 558.34 DZD (1.7 %).** |
| **F2** | **High** | `inventory.service.ts` › `InventoryReadService.createAdjustment` (line 633) | The drift is **not display-only**. The ADJUSTMENT_IN default unit cost is `product.avgStockPrice`, so a drifted average is written into a real FIFO layer, becoming permanent wrong `costOfGoods` and wrong stored `profit` on every future OUT that drains it. |
| **F3** | **Medium** | The corrected formula itself | The incremental form reads a `Decimal(12,2)`-rounded average and divides the residual over an ever-smaller quantity. Recommend implementing via the equivalent layer identity, which is exact, needs **zero extra queries**, and is self-healing. **Needs an owner decision** (self-healing changes existing wrong values on the next movement). |
| **F4** | **Low** | `inventory.service.ts` › `addLayerCore` (line 283) | The `newOnHand === 0 ? 0` branch encodes the *opposite* of the corrected zero rule ("keep the last average"). Currently unreachable, but it is the wrong precedent for the OUT path being added. |
| **F5** | **Low** | `catalog/inventory.port.stub.ts` | Dead-but-constructed stub writes `avgStockPrice: input.unitCost` as an outright overwrite and bypasses the FIFO ledger entirely. Swapped out at module load, so it never runs — a live footgun with a now-false comment. |
| **F6** | **Informational — owner decision** | `Docs/Stage-00-Conception/database-description.md` | The conception document records "recomputed on **IN only**" and "a display reference" in two places. The corrected rule contradicts both, and F2 shows "display reference" was never true. The Stage-00 text needs amending. |

### Verified correct — no change required

- The **IN** recompute formula (all four IN types), verified against the layer identity.
- **`RETURN_IN` re-enters at the consumed cost**, not the current average — verified.
- **None of the three PENDING types touches the average** — verified in code and on live data.
- Every write happens **inside the caller's transaction on a `SELECT … FOR UPDATE`-locked row**.
  No listener anywhere writes `avgStockPrice`.
- **`avgPrice` is untouched** by everything except the two purchase-receipt IN types.

---

## Audit surface — how the column is written

Only **two files in the entire API** write `Product.avgStockPrice`:

1. `Apps/api/src/modules/inventory/inventory.service.ts` › `InventoryService.addLayerCore`
   (line 316) — the single IN path.
2. `Apps/api/src/modules/catalog/inventory.port.stub.ts` (line 21) — dead code, see **F5**.

Likewise, only those two files write `quantityOnHand`, and only the engine writes
`StockMovement` / `StockMovementConsumption` rows (`stockMovement.create` appears at
`inventory.service.ts:62`, `:97`, `:178`, `:285` and nowhere else). The audit surface is
therefore genuinely closed: every movement in the system flows through
`reserve` / `release` / `addLayer` / `consumeFifo` / `returnIn`.

### Per movement type

| Type | Direction | Path | Touches `avgStockPrice` today | Correct? |
|---|---|---|---|---|
| `SUPPLIER_INVOICE` | IN | `purchasing.service.ts:383` → `addLayer` → `addLayerCore` | Yes, weighted | ✅ |
| `INITIAL_STOCK` | IN | `catalog.service.ts:643` → port adapter (`modules/index.ts:23`) → `addLayerCore` | Yes, weighted | ✅ |
| `ADJUSTMENT_IN` | IN | `createAdjustment` line 634 → `addLayer` → `addLayerCore` | Yes, weighted | ✅ formula; ❌ its **input** — see **F2** |
| `RETURN_IN` | IN | `sales.service.ts:444` / `orders.service.ts:689` → `returnIn` → `addLayerCore` per cost group | Yes, weighted, at the **consumed** cost | ✅ |
| `SALE` | OUT | `sales.service.ts:186` → `consumeFifo` | **No** | ❌ **F1** |
| `ORDER_OUT` | OUT | `orders.service.ts:414` → `consumeFifo` | **No** | ❌ **F1** |
| `REPAIR_CONSUMPTION` | OUT | `repairs.service.ts:318` → `consumeFifo` | **No** | ❌ **F1** |
| `ADJUSTMENT_OUT` | OUT | `createAdjustment` line 637 → `consumeFifo` (`revenue = null`, so `profit` is null but `costOfGoods` **is** stored) | **No** | ❌ **F1** |
| `PENDING_ORDER` | PENDING | `orders.service.ts:149` → `reserve` | No | ✅ correct |
| `PENDING_REPAIR` | PENDING | `repairs.service.ts:186` → `reserve` | No | ✅ correct |
| `PENDING_RELEASE` | PENDING | `release` (orders/repairs/sales cancel paths) | No | ✅ correct |

`reserve` (lines 52–84) and `release` (lines 86–122) write `quantityReserved` only — they never
read or write `avgStockPrice`, `quantityOnHand` or any FIFO layer. The corrected rule's "a
reservation moves no layers" requirement is already satisfied; **the fix must not change these
two methods.**

### Transaction and locking

Every mutating engine method opens with `lockProduct` (line 337), which issues
`SELECT id FROM "Product" WHERE id = $1 FOR UPDATE` inside the caller's `tx` and holds that lock
for the caller's whole transaction. `addLayerCore`'s `tx.product.update` (line 314) and
`consumeFifo`'s (line 211) both run under that lock, in the same transaction as the movement
rows. Events are **buffered** (`this.buffer`, `flushEvents`) and emitted only after the caller
commits, and no listener writes stock or money columns — `eventBus.on` registrations exist only
in `orders.listener.ts`, `clients.listener.ts` and `observability.listener.ts`, none of which
touch `Product`. **Hard rule 6 is satisfied today and the fix keeps it satisfied**, because the
new recompute goes into the `tx.product.update` call that already exists at line 211.

### `avgPrice` is out of scope and stays out

`avgPrice` is written only inside the `PURCHASE_RECEIPT_TYPES` guard (`addLayerCore` lines
306–312, aggregate over `SUPPLIER_INVOICE` + `INITIAL_STOCK` IN rows). `consumeFifo` never
mentions it. **No finding in this report proposes touching it**, and the fix must leave both the
guard and the aggregate exactly as they are.

---

## F1 — *Critical* — OUT movements never recompute `avgStockPrice`

**File / function:** `Apps/api/src/modules/inventory/inventory.service.ts` ›
`InventoryService.consumeFifo`, lines 135–221. The offending line is the product write at
**line 211**:

```ts
await tx.product.update({ where: { id: productId }, data: { quantityOnHand: newOnHand } });
```

`quantityOnHand` moves; `avgStockPrice` does not. Because all four OUT types funnel through this
one method, the defect applies uniformly to `SALE`, `ORDER_OUT`, `REPAIR_CONSUMPTION` and
`ADJUSTMENT_OUT`.

Under classic weighted-average costing this would be right, because an OUT would remove quantity
and value at the same average. This app costs at **FIFO**: the drain plan built at lines 159–168
consumes *specific* layers, whose cost is generally not the average. So the average cost of the
**remaining** layers does change, and the stored figure diverges — **upward drift understates it
when the cheapest layers are drained first (the normal case), and downward drift overstates it
when the drained layers happen to be dearer than average.** Both directions occur on live data.

### Worked example (real data, dev database)

Product **"Motherboard Iphone 13 pro"**, complete movement history as stored:

| # | Date | Type | Qty | Unit cost | `costOfGoods` | `quantityOnHand` after |
|---|---|---|---|---|---|---|
| 1 | 2026-07-28 | `INITIAL_STOCK` | +6 | 11 000.00 | — | 6 |
| 2 | 2026-08-04 | `SUPPLIER_INVOICE` | +6 | 16 000.00 | — | 12 |
| 3 | 2026-08-04 | `SALE` | −2 | — | 22 000.00 | 10 |
| 4 | 2026-08-04 | `SALE` | −1 | — | 11 000.00 | 9 |

Step by step:

- **After #1** — one layer, 6 @ 11 000. Stored average 11 000.00. True 11 000.00. ✅
- **After #2** — `addLayerCore` computes `(6 × 11 000 + 6 × 16 000) / 12 = 13 500.00`.
  Stored 13 500.00. True `(66 000 + 96 000) / 12 = 13 500.00`. ✅
- **After #3** — FIFO drains 2 units from the 11 000 layer, `costOfGoods = 22 000.00`.
  Remaining layers: 4 @ 11 000 + 6 @ 16 000 = 140 000 over 10 units → **true average 14 000.00**.
  **Stored: still 13 500.00** — understated by 500.00 per unit.
  Corrected rule: `(13 500 × 12 − 22 000) / 10 = 140 000 / 10 = 14 000.00`. ✅ matches the identity.
- **After #4** — FIFO drains 1 more unit from the 11 000 layer, `costOfGoods = 11 000.00`.
  Remaining: 3 @ 11 000 + 6 @ 16 000 = 129 000 over 9 units → **true average 14 333.33**.
  **Stored: still 13 500.00** — understated by **833.33 per unit**.
  Corrected rule: `(14 000 × 10 − 11 000) / 9 = 129 000 / 9 = 14 333.33`. ✅

**Consequence today:** this product's stock valuation is reported as
`9 × 13 500.00 = 121 500.00` when the true FIFO value of the stock on the shelf is
`129 000.00` — **7 500.00 DZD missing from one product**, and the gap widened at each of the two
sales, exactly as predicted.

### The drift also runs the other way

Product **"Motherboard Samsung note 10 plus"**:

| # | Type | Qty | Unit cost | `costOfGoods` | On hand after |
|---|---|---|---|---|---|
| 1 | `INITIAL_STOCK` | +2 | 9 000.00 | — | 2 |
| 2 | `ADJUSTMENT_IN` | +1 | 8 500.00 | — | 3 |
| 3 | `PENDING_ORDER` | +1 *(reservation)* | — | — | 3 |
| 4 | `PENDING_RELEASE` | −1 *(reservation)* | — | — | 3 |
| 5 | `ORDER_OUT` | −1 | — | 9 000.00 | 2 |

Stored average after #2 is `(2 × 9 000 + 1 × 8 500) / 3 = 8 833.33`. Movements #3 and #4 leave it
alone — **confirming on live data that the PENDING types do not touch the average**, as required.
Movement #5 drains one unit from the *dearer* 9 000 layer, so the true remaining average falls to
`(1 × 9 000 + 1 × 8 500) / 2 = 8 750.00`, while the stored figure stays **8 833.33 — overstated by
83.33 per unit.** Corrected rule: `(8 833.33 × 3 − 9 000) / 2 = 8 749.995 → 8 750.00`. ✅

A third product, **"Battery Iphone 15 Pro"**, is understated by 32.14 per unit
(stored 8 225.00 vs. true 8 257.14) by the same mechanism.

### Portfolio impact, measured

Across all 16 stocked products in the dev database:

| Figure | Value |
|---|---|
| Stock valuation as reported (`Σ quantityOnHand × avgStockPrice`) | **441 041.66** |
| True FIFO value (`Σ remainingQuantity × unitCost` over live layers) | **448 600.00** |
| Gap | **7 558.34 understated (1.7 %)** |
| Products where `quantityOnHand ≠ Σ remaining layer qty` | **0 of 16** |

The last row matters for the fix: **the FIFO layer invariant is intact**, so the layer identity
is a safe basis to compute from.

### Proposed fix

Recompute inside `consumeFifo`, in the transaction that already holds the row lock, by extending
the existing `tx.product.update` at line 211 — no new query, no new lock, no new transaction:

```ts
// FIFO OUT changes the average cost of what is left: the drained layers are not priced at the
// average. Σ over the layers already loaded at line 151, minus what this movement drained.
const remainingValueAfter = layers.reduce((sum, layer) => {
  const drained = drains.find((d) => d.layerId === layer.id)?.drainQty ?? 0;
  return sum + ((layer.remainingQuantity ?? 0) - drained) * layer.unitCost!.toNumber();
}, 0);

await tx.product.update({
  where: { id: productId },
  data: {
    quantityOnHand: newOnHand,
    // newOnHand === 0 → keep the last average (S23 rule): it keeps margin displays and
    // repricing defaults meaningful while the product is temporarily out of stock, and the
    // next IN overwrites it anyway.
    ...(newOnHand > 0 ? { avgStockPrice: remainingValueAfter / newOnHand } : {}),
  },
});
```

`layers` (line 151) and `drains` (line 158) are both already in memory at that point. See **F3**
for why this identity form is preferred over the literal incremental arithmetic, and for the
owner decision it carries.

`reserve`, `release`, `returnIn` and `addLayerCore` need no change for F1.

---

## F2 — *High* — the drift escapes into real FIFO costs via the adjustment default

**File / function:** `Apps/api/src/modules/inventory/inventory.service.ts` ›
`InventoryReadService.createAdjustment`, **line 633**:

```ts
lineUnitCost = line.unitCost ?? product.avgStockPrice.toNumber();
```

This is the recorded behaviour from S4 / D10 — a positive adjustment delta defaults its unit cost
to the product's `avgStockPrice`, and the UI pre-fills the same value
(`adjustment-line-editor.tsx:58`) with the helper text *"The average price is …"*
(`admin.inventory.adjustment.avgStockPriceHint`). The default is not the problem; **its input
is.** Because F1 leaves `avgStockPrice` drifted, the cost written into the new FIFO layer is
wrong — and that layer is permanent.

This is what makes F1 more than a reporting defect. `database-description.md` line 6 calls the
average "a display reference" and line 183 says "profit is strictly FIFO"; through this one line,
the drifted display reference **becomes** a FIFO cost.

### Worked example

Take "Motherboard Iphone 13 pro" from F1 at its current state: 9 units on hand, true average
14 333.33, stored 13 500.00. An admin performs a stock count that finds one extra unit and
accepts the pre-filled default.

- **Today:** an `ADJUSTMENT_IN` layer of 1 @ **13 500.00** is created. When that unit is later
  sold at 18 000.00, the stored `costOfGoods` is 13 500.00 and the stored `profit` is
  **4 500.00**.
- **With F1 fixed:** the default is 14 333.33, the layer is 1 @ 14 333.33, and the same sale
  stores `costOfGoods` 14 333.33 and `profit` **3 666.67**.

**The reported profit on that sale is overstated by 833.33 — permanently.** No later correction
touches it: `SaleLine.profit`, `RepairPart.profit` and `StockMovement.profit` are snapshots, and
every statistics figure reads the stored value (which is the correct design — see S24).

### Proposed fix

No separate change: fixing **F1** fixes this, because the default then reads a correct average.
Two things the fix plan should nonetheless do:

1. **Do not** "improve" the default by computing it from the layers here — the default must stay
   `avgStockPrice`, per D10 and S4. Only its input needs to be right.
2. The plain unlocked read at **line 617** (`tx.product.findUnique`, whose comment at lines
   610–616 already documents the staleness trade-off) is the source of `product.avgStockPrice`
   for this default. It is read *before* the engine takes its lock, so within a single
   multi-line adjustment that both consumes and receives the same product, the second line's
   default is computed from a pre-transaction snapshot. **Severity: low, and pre-existing.** The
   fix plan should either extend the existing comment to say so explicitly, or re-read the
   product under the engine's lock. Flagged rather than resolved — it is a behaviour change to
   the adjustment form's defaults and belongs to the owner.

---

## F3 — *Medium* — incremental arithmetic on a 2-decimal column; recommend the layer identity

**Owner decision required.**

`Product.avgStockPrice` is `Decimal(12,2)` (`schema.prisma:463`). Postgres rounds on store, so the
incremental formula always reads a **rounded** average, multiplies it by the quantity, subtracts
an exact `costOfGoods`, and divides the residual over a **smaller** quantity. The rounding error
is therefore amplified by `quantityOnHandBefore / quantityOnHandAfter` at every OUT, and it
compounds across a chain of movements.

### Worked example

The real "Motherboard Samsung note 10 plus" case from F1 shows it, benignly:

- True average after `ADJUSTMENT_IN` is `26 500 / 3 = 8 833.3333…`, **stored as 8 833.33**.
- Incremental recompute at the `ORDER_OUT`: `(8 833.33 × 3 − 9 000) / 2 = 17 499.99 / 2 =
  **8 749.995**`, versus the identity's exact **8 750.00**.
- Here `Decimal(12,2)` rounds 8 749.995 back to 8 750.00 and the error vanishes — **by luck.**

A constructed case where it does not:

- Layers 1 @ 100.00 and 2 @ 110.00 → true average `320 / 3 = 106.6666…`, stored **106.67**.
- An OUT of 2 drains 1 @ 100 + 1 @ 110, `costOfGoods = 210.00`, leaving 1 @ 110.00.
- Incremental: `(106.67 × 3 − 210) / 1 = 110.01`. Identity: **110.00**. The entire rounding
  residual of three units lands on the one unit left.

The general bound: the residual is up to `0.005 × quantityOnHandBefore` and is divided by
`quantityOnHandAfter`. Selling 99 of 100 units concentrates a 0.50 error onto a single remaining
unit. In the pathological tail — a large cheap-accessory stock whose remaining true value is
below `0.005 × quantityOnHandBefore` — the incremental form can produce a **negative** average.
The identity form cannot: it is a sum of non-negative layer values.

### Proposed fix — and the decision

Implement the corrected rule as the **layer identity** given in the S23 brief
(`Σ(remaining layer qty × layer cost) ÷ Σ(remaining qty)`), as shown in F1's patch, rather than
as literal incremental arithmetic. It is:

- **Exact** — no rounding input, no amplification, no negative-average tail.
- **Free** — `consumeFifo` already loads every live layer at line 151 and already computes the
  drain plan at lines 159–168. Zero extra queries, zero extra locks.
- **Verifiable** — it is the same expression the audit's SQL used to measure the 7 558.34 gap.

**The decision it carries:** the identity form is **self-healing**. The first OUT after the fix
lands writes the *true* average, discarding whatever drift that product had accumulated. The
literal incremental form instead carries the existing wrong value forward indefinitely (a product
that never receives another IN keeps its error for good).

Self-healing is **not** a data backfill — no script, no migration, nothing rewrites history, and
the corrected logic still only applies "from the next movement onward" exactly as the standing
context requires. But it does mean **some existing wrong averages will silently become right**,
which is a visible change to figures the owner may be watching. Flagging it rather than assuming
it. If the owner prefers strictly-incremental arithmetic, the fix plan uses
`(oldAvg × onHandBefore − costOfGoods) / onHandAfter` and accepts F3's rounding behaviour.

**Recommendation: the identity form.**

### Note on the IN side

If the identity is used on OUT only, `addLayerCore` still folds a ≤ 0.005 rounding residual in at
each IN (it holds no layer list, so using the identity there would cost one extra `findMany`).
Under the identity-on-OUT fix that residual is wiped at the next OUT, so it never accumulates.
**Recommendation: leave `addLayerCore`'s formula as it is** — see F4 for the one line in it that
should change.

---

## F4 — *Low* — `addLayerCore`'s zero branch encodes the opposite of the corrected zero rule

**File / function:** `Apps/api/src/modules/inventory/inventory.service.ts` › `addLayerCore`,
**line 283**:

```ts
const newAvgStockPrice = newOnHand === 0 ? 0 : (product.quantityOnHand * oldAvgStockPrice + qty * unitCost) / newOnHand;
```

The corrected rule states: **when the resulting quantity is zero, keep the last average** — never
reset to zero, so margin displays and repricing defaults stay meaningful for a temporarily
out-of-stock product. This branch resets to `0`.

**It is currently unreachable.** Every `addLayer` / `returnIn` caller passes `qty > 0`
(`createProduct` guards `initialQuantity > 0`; `createAdjustment` only calls it on `delta > 0`;
purchasing passes a schema-positive line quantity; `returnIn` passes per-cost-group sums), and
`quantityOnHand` is never negative — so `newOnHand` is always ≥ 1. There is no wrong figure in the
database from this line, which is why it is Low and not High.

It matters anyway because **the OUT path being added in F1 has a reachable zero case** (selling
the last unit), and this line is the nearest precedent an executor will copy.

### Proposed fix

Make the two paths consistent: either drop the dead ternary entirely, or make it keep
`oldAvgStockPrice`. Whichever is chosen, the OUT path must **omit `avgStockPrice` from the update**
when `newOnHand === 0` (as in F1's patch), and the comment above the line should state the zero
rule so it is not "corrected" back later. The stale comment at lines 267–270 ("both are IN-direction
writes that recompute avgStockPrice the same way") also needs revisiting once OUT recomputes too —
**hard rule 4**.

---

## F5 — *Low* — dead `InventoryPortStub` still writes the column, and its comment is now false

**File:** `Apps/api/src/modules/catalog/inventory.port.stub.ts`, lines 17–23.

```ts
await tx.product.update({
  where: { id: input.productId },
  data: { quantityOnHand: { increment: input.quantity }, avgStockPrice: input.unitCost },
});
```

This writes `avgStockPrice` as an **outright overwrite**, not a weighted recompute, and creates
**no `StockMovement` row at all** — so it would break the FIFO layer invariant that the whole of
this audit (and F3's proposed fix) rests on.

**It never runs.** `catalog.routes.ts:45` constructs it, but `registerModules`
(`modules/index.ts:41`) calls `catalogProductService.useInventory(inventoryPortAdapter)` at module
load, before any request is served, replacing it with the real engine. The stub is reachable only
if that wiring line is ever removed.

Its own comment (lines 4–11) is stale in the sense of **hard rule 4**: it says *"Swap this file's
export for the inventory module's real composition-root singleton in one line once it exists"* —
it exists, and the swap was done, elsewhere.

### Proposed fix

Delete `inventory.port.stub.ts` and its construction at `catalog.routes.ts:45`, having first
confirmed `catalogProductService`'s constructor tolerates the port arriving only via
`useInventory`. If the owner prefers to keep a stub for isolated catalog testing, leave the file
but rewrite the comment to say it is superseded and must never write `avgStockPrice`.
**Low severity, no wrong data — housekeeping that the fix set may reasonably decline.**

---

## F6 — *Informational, owner decision* — the conception document contradicts the corrected rule

**File:** `Docs/Stage-00-Conception/database-description.md` — the recorded source of truth.

- **Line 6** (invariant 1): *"`averageCost` is a display reference recomputed on **IN only**."*
- **Line 183** (rule 4): *"`averageCost` recomputes on IN only — display reference; profit is
  strictly FIFO. Restocked returns re-enter at consumed cost."*
- **Line 72:** *"Quantity + averageCost columns are owned by the inventory module — nothing else
  writes them."* (Still true in substance — see F5 for the one dead exception.)

The corrected S23 rule contradicts "IN only" directly. It also retires "display reference": **F2
shows the figure has been feeding real FIFO layer costs since S4**, through the adjustment
default that D10 itself specifies.

Note also that the document still uses the pre-S1 column name `averageCost` throughout; S1
renamed it to `avgStockPrice` and added the distinct `avgPrice`.

### Proposed fix

Not code. The fix plan should amend both lines to state the corrected rule — recomputed on **IN
and OUT**, unchanged by PENDING, last value kept at zero quantity — and drop "display reference"
in favour of naming its two real roles (stock valuation, and the adjustment-default cost basis).
Whether Stage-00 is amended in place or annotated is the owner's call; the memory note that only
`Docs/Stage-00-Conception/` is authoritative makes leaving it contradictory the worst option.

---

## Consumers of `avgStockPrice` — which figures move once the rule is corrected

Every figure below is understated or overstated **today**, by the per-unit drift of the products
involved. None of them needs a code change; they all read the column and will simply be right.

| Consumer | File | Effect of the fix |
|---|---|---|
| **Stock valuation (statistics overview)** — "Total product value" | `statistics.service.ts:50, 58` (`getOverview`) → `admin-statistics-overview-cards.tsx:38` | **Moves.** On current dev data: 441 041.66 → 448 600.00. **The single largest visible change.** Hand-off to S24. |
| **Stock levels table** — "Avg. stock price" and "Total cost" columns, and the mobile row | `inventory.mapper.ts:35, 44` (`toStockRowDto`) → `stock-levels-table.tsx:67–75, 93` | **Moves** per drifted product, both columns (`stockValue` = on-hand × avg). |
| **Stock CSV export** — `avgStockPrice` and `stockValue` columns | `inventory.service.ts:373–384, 414–432` (`getStock`, `export=csv`) | **Moves**, same two figures. Also in scope for S25's export audit. |
| **Product info page** — "Avg. stock price" and "Stock value" | `catalog.mapper.ts:142` → `AdminProductInformation.tsx:112–119` | **Moves.** |
| **Products list table** — average-cost column (desktop and mobile) | `admin-products-table.tsx:99–101, 179` | **Moves.** |
| **Margin displays** — product pricing section, guest / default / per-category | `enhanced-pricing-section.tsx:77, 104, 130` via `MarginDisplay` | **Moves** — margins narrow where the average was understated. The green/red threshold can flip on thin margins. |
| **Supplier-invoice reprice section** — displayed avg + all three margin rows | `catalog.service.ts:1025` (`getRepriceCandidates`) → `reprice-prompt.tsx:98–99, 116, 131, 159` | **Moves.** Note this reads the post-`addLayer` average inside purchasing's confirm transaction (`purchasing.service.ts:396`) — still correct after the fix. |
| **Supplier-invoice DRAFT projection** — `projectedNewAvgStockPrice` per line | `catalog.service.ts:1056` (`getCostBasis`) → `purchasing.service.ts:664–668` | **Moves.** The projection formula itself is right; it was projecting from a drifted basis. No change needed. |
| **Adjustment form** — pre-filled unit cost + *"The average price is …"* helper | `inventory.service.ts:633`; `AdminInventory.tsx:82`, `adjustment-line-editor.tsx:58, 129–133` | **Moves — and this is F2.** The only consumer that writes the value back into stored data. |
| **Invoice snapshot (admin audience)** — per-line "current average cost" beside the stored `costSnapshot` | `billing.service.ts:374, 500–508`; `billing.mapper.ts:100, 110` → `InvoiceSnapshotView.tsx:67–68` | **Moves.** Display-only, correctly *beside* the stored snapshot, never replacing it — verified. |

**Not consumers** (verified by grep): no report or mapper derives cost or profit from
`avgStockPrice`. `SaleLine.costOfGoods/profit`, `OrderLine`, `RepairPart.costOfGoods/profit`,
`InvoiceLine.costSnapshot/profit` and `StockMovement.costOfGoods/profit` are all stored
snapshots written from `consumeFifo`'s FIFO result. That separation is correct and **must be
preserved** — it is also the first thing S24 has to confirm.

---

## Adjacent observations — deliberately out of scope

Recorded so they are not lost, not proposed as S23 work:

1. **`returnIn` appends restocked units to the back of the FIFO queue.** It creates a *new* IN
   layer per distinct original cost (`inventory.service.ts:243–252`) rather than restoring
   `remainingQuantity` on the original layer, so a returned unit is consumed last, not in its
   original position. **The average is unaffected** (it is order-independent), so this is not an
   S23 finding — but it does change which cost a *future* OUT records. Worth a decision at some
   point; it is not a defect against any recorded rule.
2. **Repairs cannot be cancelled after `PICKED_UP`** (`repairs.service.ts:223`: "CANCELLED from
   any non-terminal state"), so `cancelRepair`'s release-only path can never strand consumed
   parts. Checked because it would have been an avg/on-hand defect. **It is not one.**
3. **`listReservations` paginates in memory** (`inventory.service.ts:552–560`) — already flagged
   in its own comment, unrelated to this set.

---

## How the owner can reproduce these findings

Read-only. Nothing here changes data.

1. **See the gap on real data.** Against the dev database:
   ```sql
   SELECT p.name, p."quantityOnHand", p."avgStockPrice" AS stored,
          ROUND(SUM(m."remainingQuantity" * m."unitCost")
                / NULLIF(SUM(m."remainingQuantity"), 0), 2) AS fifo_true
   FROM "Product" p
   LEFT JOIN "StockMovement" m
     ON m."productId" = p.id AND m.direction = 'IN' AND m."remainingQuantity" > 0
   GROUP BY p.id, p.name, p."quantityOnHand", p."avgStockPrice"
   HAVING SUM(m."remainingQuantity") IS NOT NULL
   ORDER BY 3 DESC;
   ```
   Expect "Motherboard Iphone 13 pro" at **13 500.00 stored vs 14 333.33 true**, "Motherboard
   Samsung note 10 plus" at **8 833.33 vs 8 750.00**, "Battery Iphone 15 Pro" at
   **8 225.00 vs 8 257.14**; the other 13 products match exactly (they have a single live layer,
   where drift is impossible).

2. **Watch it happen in the browser.** Open *Admin → Inventory → Stock levels* and note a
   product's "Avg. stock price" and "Total cost". Sell one unit of it in the POS at a price that
   drains the **oldest** layer, where that layer's cost differs from the displayed average.
   Refresh: **on-hand drops by one, the average does not move at all**, and "Total cost" falls by
   exactly the old average rather than by the cost actually consumed.

3. **Confirm PENDING is innocent.** Place an order for that product (stock reserves), then cancel
   it (stock releases). The average is unchanged at both steps — correct, and it must stay that
   way after the fix.

4. **See F2's leak.** With a drifted product, open *Admin → Inventory → New adjustment*, pick it,
   and enter a count one higher than the system quantity. The pre-filled unit cost and the
   *"The average price is …"* helper both show the **drifted** average — that is the number that
   would be written into a permanent FIFO layer.

---

## Status

**Audit complete. No code changed. Stopping here for the owner's decisions**, per the S23 brief.

Two decisions are needed before the fix plan can be written:

1. **F3** — identity form (exact, self-healing, recommended) or literal incremental arithmetic
   (carries existing drift forward)?
2. **F6** — amend `database-description.md`'s "IN only" / "display reference" wording as part of
   the fix set?

Two more are optional and can be folded in or dropped: **F5** (delete the dead stub) and **F2.2**
(re-read the product under lock for the adjustment default, a behaviour change to the form's
pre-fill).

Per the standing context, **no data backfill is proposed**; existing averages on test data stay
wrong, except where F3's identity form heals them at the next OUT.
