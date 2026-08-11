# Plan — Set 23: `avgStockPrice` maintenance (fix)

Executes the owner's decisions on `Docs/Stage-04-Fixes/results/findings-S23-avg-stock-price.md`.

**Owner decisions taken (2026-08-11):**

1. **F3 → the layer-identity form.** `avgStockPrice` on an OUT is computed from the live FIFO
   layers, not from the stored (rounded) average. Exact, no extra queries, and **self-healing** —
   the first OUT after this lands writes the true average for that product, discarding its
   accumulated drift. This is accepted, and is not a data backfill: no script runs, no history is
   rewritten, the corrected logic simply applies from the next movement onward.
2. **F6 → amend the conception documents** so Stage-00 states the corrected rule.

Also included, per the report's recommendations: **F1** (the defect itself), **F2** (fixed by F1 —
see A1's note), **F4** (the zero branch), **F5** (delete the dead stub).
**F2.2 is deliberately NOT included** — see §6.

---

## 0. Scope, prerequisites and non-goals

**Prerequisite sets:** none. This set is self-contained inside the inventory engine.
It **must land before any S24 fix work**, because stock valuation reads `avgStockPrice` and S24's
audit will report figures computed with the corrected rule.

**No contract change. No schema change. No migration. No new translation keys. No frontend change.**

The executor must not add any of those. Every consumer listed in the findings report reads
`avgStockPrice` through DTOs that already exist and already carry the right shape; they change
value, not type. If an action below appears to require a contract or schema edit, the executor has
misread it — stop and ask.

**Files touched (7):**

| # | File | Kind |
|---|---|---|
| A1, A2, A3 | `Apps/api/src/modules/inventory/inventory.service.ts` | logic + comments |
| A4 | `Apps/api/prisma/schema.prisma` | **comment only — no migration** |
| A5 | `Apps/api/src/modules/catalog/inventory.port.stub.ts` | **deleted** |
| A5 | `Apps/api/src/modules/catalog/catalog.routes.ts` | DI placeholder |
| A6 | `Docs/Stage-00-Conception/database-description.md` | doc |
| A6 | `Docs/Stage-00-Conception/Module-Contracts/inventory.md` | doc |
| A7 | `Docs/Stage-00-Conception/Module-Contracts/{catalog,statistics,purchasing}.md`, `Docs/Stage-00-Conception/schema.prisma` | doc, naming only — **separable** |

**Order:** A1 → A2 → A3 → A4 → A5 → A6 → A7. A1 and A2 are in the same file and A2's comment
refers to A1's behaviour, so do them in order. A4–A7 are documentation and depend on A1–A2 being
settled, not on each other.

---

## 1. A1 — `consumeFifo` recomputes `avgStockPrice` from the live FIFO layers *(Critical — F1)*

**File:** `Apps/api/src/modules/inventory/inventory.service.ts`
**Function:** `InventoryService.consumeFifo` (lines 135–221)

This single change fixes all four OUT types — `SALE`, `ORDER_OUT`, `REPAIR_CONSUMPTION` and
`ADJUSTMENT_OUT` — because every one of them reaches the ledger through this method and no other.
It also fixes **F2** by consequence: `createAdjustment`'s ADJUSTMENT_IN default (line 633) reads
`product.avgStockPrice`, so once the column is right, the cost written into the new FIFO layer is
right. **Do not change that default** — reading `avgStockPrice` there is required by D10 and S4;
only its input was wrong.

### A1.1 — compute the remaining layer value

Insert directly **after** the existing `newOnHand` / `profit` declarations (currently lines
175–176), before the `tx.stockMovement.create` call:

```ts
    // S23 — a FIFO OUT changes the average cost of what is LEFT: the layers this movement drained
    // are not priced at the average, so removing them shifts it. Computed as the identity
    // Σ(remaining layer qty × layer cost) ÷ Σ(remaining qty) rather than the incremental
    // (oldAvg × onHandBefore − costOfGoods) ÷ onHandAfter: the stored column is Decimal(12,2), and
    // feeding a rounded average back in amplifies its residual by onHandBefore/onHandAfter at
    // every OUT. `layers` (loaded above, before any write) is every live layer, and `costOfGoods`
    // is exactly what this movement takes out of them — so the subtraction below IS the identity,
    // at zero extra queries. `unitCost` is non-null on every IN row by construction (addLayerCore
    // always writes it); the same assumption the drain loop above already makes.
    const layerValueBefore = layers.reduce(
      (sum, layer) => sum + (layer.remainingQuantity ?? 0) * layer.unitCost!.toNumber(),
      0,
    );
    const layerValueAfter = layerValueBefore - costOfGoods;
```

### A1.2 — write it in the existing product update

Replace the update at **line 211**:

```ts
    await tx.product.update({ where: { id: productId }, data: { quantityOnHand: newOnHand } });
```

with:

```ts
    await tx.product.update({
      where: { id: productId },
      data: {
        quantityOnHand: newOnHand,
        // Zero on hand → keep the last average (S23 rule), never reset and never divide by zero:
        // it keeps margin displays and the adjustment default meaningful for a temporarily
        // out-of-stock product, and the next IN overwrites it anyway. Omitting the key leaves the
        // column untouched.
        ...(newOnHand > 0 ? { avgStockPrice: layerValueAfter / newOnHand } : {}),
      },
    });
  }
```

*(the trailing `}` above is illustrative of position only — do not add a brace; the method body
continues unchanged at the `postAvailable` line.)*

### A1.3 — invariants the executor must not break

- **Do not move the update out of the transaction, and do not add a second one.** It already runs
  inside the caller's `tx`, under the `SELECT … FOR UPDATE` taken by `lockProduct` at the top of
  the method. That satisfies hard rule 6 and must stay that way.
- **Do not touch `reserve` or `release`** (lines 52–122). Reservations move no layers;
  `PENDING_ORDER`, `PENDING_REPAIR` and `PENDING_RELEASE` must continue not to affect the average.
  This was verified correct on live data.
- **Do not touch `avgPrice`** anywhere. It is maintained only by the `PURCHASE_RECEIPT_TYPES`
  guard in `addLayerCore` (lines 306–312) and must stay that way.
- **Do not add rounding.** `Product.avgStockPrice` is `Decimal(12,2)`; Postgres rounds on store.
  Rounding in JS as well would reintroduce exactly the residual this form exists to avoid.
- **Do not reorder the layer read.** `layers` is fetched at line 151 *before* any write, so it
  cannot see the OUT row this method is about to create. Keep it there.

### A1.4 — expected behaviour, worked against real data

Product "Motherboard Iphone 13 pro" — layers 6 @ 11 000 then 6 @ 16 000, average 13 500.00,
9 on hand after two sales.

| Movement | `costOfGoods` | `layerValueBefore` | `layerValueAfter` | `newOnHand` | Stored avg |
|---|---|---|---|---|---|
| `SALE` −2 (drains 11 000 layer) | 22 000 | 162 000 | 140 000 | 10 | **14 000.00** *(was: unchanged 13 500.00)* |
| `SALE` −1 (drains 11 000 layer) | 11 000 | 140 000 | 129 000 | 9 | **14 333.33** *(was: unchanged 13 500.00)* |

Both match `Σ(remaining qty × cost) ÷ Σ remaining qty` exactly. That product's stock valuation
moves from 121 500.00 to 129 000.00, and the store-wide figure from 441 041.66 to 448 600.00.

---

## 2. A2 — `addLayerCore`'s zero branch keeps the last average *(Low — F4)*

**File:** same. **Function:** `InventoryService.addLayerCore` (lines 271–329)

**Line 283** currently resets the average to zero when the resulting quantity is zero, which is the
opposite of the corrected rule. The branch is **currently unreachable** (every caller passes
`qty > 0` and `quantityOnHand` is never negative), so no stored figure is wrong because of it — it
is fixed because it is the nearest precedent to A1's newly-reachable zero case, and leaving the two
paths contradicting each other invites a later "correction" back to the wrong behaviour.

Replace:

```ts
    const newAvgStockPrice = newOnHand === 0 ? 0 : (product.quantityOnHand * oldAvgStockPrice + qty * unitCost) / newOnHand;
```

with:

```ts
    // Weighted by quantityOnHand — physical layers, never onHand − reserved. The zero guard can
    // only fire on a broken invariant (every caller passes qty > 0 and onHand is never negative);
    // it keeps the last average rather than resetting, matching consumeFifo's zero rule (S23).
    const newAvgStockPrice =
      newOnHand === 0 ? oldAvgStockPrice : (product.quantityOnHand * oldAvgStockPrice + qty * unitCost) / newOnHand;
```

**The IN formula itself is not changing.** It was verified correct against the layer identity for
all four IN types, including `RETURN_IN` re-entering at the consumed cost. It stays incremental so
that `addLayerCore` needs no layer query; the ≤ 0.005 rounding residual it can fold in is wiped by
the next OUT under A1's identity form.

---

## 3. A3 — stale comments in the engine *(hard rule 4)*

**File:** same.

**A3.1** — the comment above `addLayerCore` (lines 267–270) says IN movements *"recompute
avgStockPrice the same way"* and cites *"spec BL#3"*, which is the "IN only" rule A6 is about to
retire. Replace the first sentence:

```ts
  // Shared by public addLayer and returnIn's per-cost-group loop — both are IN-direction writes
  // that recompute avgStockPrice the same way (spec BL#3 applies to every IN movement, RETURN_IN
  // included). avgPrice (D10) only moves for purchase-receipt types (PURCHASE_RECEIPT_TYPES) —
  // RETURN_IN and ADJUSTMENT_IN never touch it.
```

with:

```ts
  // Shared by public addLayer and returnIn's per-cost-group loop — both are IN-direction writes
  // that recompute avgStockPrice the same way, for every IN type including RETURN_IN (which
  // re-enters at the ORIGINAL consumed cost, not the current average). Since S23 the OUT side
  // recomputes too, from the layer identity in consumeFifo — the column is maintained on IN *and*
  // OUT, and left alone by the three PENDING types. avgPrice (D10) only moves for purchase-receipt
  // types (PURCHASE_RECEIPT_TYPES) — RETURN_IN and ADJUSTMENT_IN never touch it.
```

**A3.2** — leave the `lockProduct` comment (lines 331–341) unchanged. It already names
`avgStockPrice` among the state this lock serialises, and that is still exactly true.

**A3.3** — leave `createAdjustment`'s unlocked-read comment (lines 610–616) unchanged. See §6.

---

## 4. A4 — schema comment *(comment only, no migration)*

**File:** `Apps/api/prisma/schema.prisma`, lines 463–464.

**No column changes. Do not create a migration.** Replace only the trailing comment:

```prisma
  avgStockPrice    Decimal  @default(0) @db.Decimal(12, 2) // quantity-weighted moving average (D10):
  //   margins, adjustment defaults, stock valuation. Profit is still FIFO, never this figure.
```

with:

```prisma
  avgStockPrice    Decimal  @default(0) @db.Decimal(12, 2) // average cost of the layers still on
  //   hand (D10): margins, adjustment defaults, stock valuation. Maintained on IN (weighted) and
  //   on OUT (S23: from the remaining-layer identity, since a FIFO OUT drains specific layers
  //   whose cost is not the average); untouched by the three PENDING types; last value kept at
  //   zero quantity. Profit is still FIFO from the movement's own costOfGoods, never this figure.
```

Then run `npx prisma generate` **only if the executor's environment requires it** — a comment
change produces no client change, so it should not be necessary.

---

## 5. A5 — delete the dead `InventoryPortStub` *(Low — F5)*

The stub writes `avgStockPrice: input.unitCost` as an outright overwrite and creates **no
`StockMovement` row**, so it would break the very FIFO layer invariant A1 now computes from. It
never runs — `registerModules` (`modules/index.ts:41`) replaces it via `useInventory()` at module
load, before any request is served — but it is a live footgun and its comment ("swap this once the
real one exists") is false. **Verified: no test file imports it**, so deleting it breaks no test
compile.

**A5.1** — delete `Apps/api/src/modules/catalog/inventory.port.stub.ts`.

**A5.2** — in `Apps/api/src/modules/catalog/catalog.routes.ts`:

- Remove the import at line 39: `import { InventoryPortStub } from './inventory.port.stub';`
- Add a type import for the port (the file does not currently import from `catalog.interface`):
  `import type { IInventoryPort } from './catalog.interface';`
- Replace line 45, `const inventory = new InventoryPortStub();`, with:

```ts
// The real FIFO engine is injected by registerModules() (modules/index.ts) at module-load time,
// before any request is served. This placeholder exists only to satisfy the constructor at that
// ordering. If it is ever actually called the wiring is broken, and it must fail loudly rather
// than write inventory-owned columns behind the FIFO ledger's back (S23 F5 — the stub it replaces
// did exactly that, overwriting avgStockPrice and creating no movement row).
const inventory: IInventoryPort = {
  addLayer: () => {
    throw new Error(
      'CatalogProductService.inventory was never wired — registerModules() must call useInventory() before serving requests',
    );
  },
};
```

- Leave the comment at lines 51–52 (`Exported for the aggregator … replacing the InventoryPortStub
  above`) but change "the InventoryPortStub above" to "the placeholder above".

**A5.3** — `CatalogProductService`'s constructor signature (`catalog.service.ts:416–419`) and
`useInventory` (line 424) are **unchanged**. Its comment at lines 421–423 mentions
"InventoryPortStub" — change that phrase to "the placeholder port" as well.

---

## 6. Explicitly NOT in scope

**F2.2 — re-reading the product under lock for the adjustment default.** `createAdjustment` reads
`product.avgStockPrice` at line 617 with a plain unlocked `findUnique`, before the engine takes its
row lock, so a concurrent movement between the two could make the default marginally stale. The
report rated this **low and pre-existing**, and the trade-off is already documented in the comment
at lines 610–616. Changing it would alter what the adjustment form pre-fills, which is a
user-visible behaviour change that has nothing to do with the defect this set exists to fix.
**Not planned. Left for the owner to raise separately if wanted.**

**The two adjacent observations** from the report — `returnIn` appending restocked units to the
back of the FIFO queue, and `listReservations` paginating in memory — are out of scope and must not
be touched.

**No data backfill, repair script or corrective migration** (standing context + hard rule 7). The
self-healing property of A1 is a consequence of the corrected read, not a backfill: it only ever
takes effect as part of a real movement's own transaction.

---

## 7. A6 — amend the conception documents *(F6 — owner decision 2)*

Stage-00 is the recorded source of truth, so it must not be left contradicting the rule now in
force. Four load-bearing statements change.

### A6.1 — `Docs/Stage-00-Conception/database-description.md`

**Line 6**, structural rule 1 — replace the final sentence
*"`averageCost` is a display reference recomputed on IN only."* with:

> `avgStockPrice` is the average cost of the layers still on hand: recomputed on IN (quantity-weighted) **and** on OUT (from the remaining layers, since a FIFO OUT drains specific layers whose cost is not the average), untouched by PENDING, last value kept when quantity reaches zero.

**Line 183**, invariant 4 — replace:

> 4. `averageCost` recomputes on IN only — display reference; profit is strictly FIFO. Restocked returns re-enter at consumed cost.

with:

> 4. `avgStockPrice` recomputes on IN and OUT, and equals `Σ(remaining layer qty × layer cost) ÷ Σ(remaining qty)` at all times; PENDING never moves it; at zero quantity the last value is kept. It drives stock valuation, margin displays and the adjustment default unit cost — so it is **not** merely a display figure. Profit is still strictly FIFO, from each movement's own stored `costOfGoods`. Restocked returns re-enter at the consumed cost. `avgPrice` is separate: the unweighted mean of purchase unit costs, supplier-invoice context only.

*(The second sentence of the old text — "display reference" — is being retired deliberately: the
ADJUSTMENT_IN default has fed this figure into real FIFO layer costs since S4. That is finding
F2 and the owner has accepted it.)*

**Line 71** — in the `Product` field list, rename `averageCost` to `avgStockPrice` and add
`avgPrice` beside it, matching the live schema since S1.

**Line 72** — *"Quantity + averageCost columns are owned by the inventory module"* → *"Quantity +
`avgStockPrice`/`avgPrice` columns are owned by the inventory module"*.

### A6.2 — `Docs/Stage-00-Conception/Module-Contracts/inventory.md`

**Line 57**, Business Logic 3 — replace:

> 3. avgCost on IN only: `(oldQty×oldAvg + inQty×unitCost)/(oldQty+inQty)`.

with:

> 3. `avgStockPrice` on IN: `(oldQty×oldAvg + inQty×unitCost)/(oldQty+inQty)`. On OUT: `Σ(remaining layer qty × layer cost) ÷ Σ(remaining qty)` — equivalently `(oldAvg×onHandBefore − costOfGoods) ÷ onHandAfter`, computed from the layers so the `Decimal(12,2)` residual cannot accumulate. Quantity is always `quantityOnHand`, never `onHand − reserved`. PENDING movements never touch it. At `onHandAfter = 0` the last value is kept. `avgPrice` (unweighted purchase-receipt mean) is maintained only from `SUPPLIER_INVOICE` + `INITIAL_STOCK` and is untouched by all of this.

**Line 42** — the injected-service block's inline comment `// IN + avgCost recompute` →
`// IN + avgStockPrice recompute`, and add `// OUT + avgStockPrice recompute` to the `consumeFifo`
line (line 43).

**Line 55**, Business Logic 1 — `quantity/averageCost columns` → `quantity/avgStockPrice/avgPrice
columns`.

**Line 58**, Business Logic 4 — `default = current avgCost` → `default = current avgStockPrice`.

**Line 2** — `Owns Product.quantityOnHand / quantityReserved / averageCost.` →
`Owns Product.quantityOnHand / quantityReserved / avgStockPrice / avgPrice.`

**Line 23** — in the `StockRowDto` shape, `averageCost` → `avgStockPrice`.

**Test Scenarios block (line 62)** — append one sentence so the spec's own scenarios cover the new
rule: *"Layers 10@100 + 10@150, consume 15 ⇒ COGS 1750, layer 5@150 remains ⇒ `avgStockPrice` 150
(was 125 before the OUT)."* This is a **specification** sentence in a Stage-00 document; the
executor must **not** write or modify any test file to match it.

---

## 8. A7 — remaining `averageCost` naming drift *(separable — the owner may drop this action)*

Pre-existing since S1 renamed the column; not caused by this set. Included because leaving Stage-00
half-renamed is worse than either extreme. **Pure find-and-replace, no rule changes:**

| File | Line | Change |
|---|---|---|
| `Docs/Stage-00-Conception/Module-Contracts/catalog.md` | 38 | `averageCost` → `avgStockPrice` in `AdminProductDto` (add `avgPrice`, which the live DTO also carries) |
| `Docs/Stage-00-Conception/Module-Contracts/catalog.md` | 60 | `quantity/averageCost columns are owned by inventory` → `quantity/avgStockPrice/avgPrice columns …` |
| `Docs/Stage-00-Conception/Module-Contracts/statistics.md` | 43 | `stockValue = Σ quantityOnHand × averageCost` → `× avgStockPrice` |
| `Docs/Stage-00-Conception/Module-Contracts/purchasing.md` | 36 | `repriceCandidates: { productId; name; averageCost;` → `avgStockPrice;` |
| `Docs/Stage-00-Conception/schema.prisma` | 463 | `averageCost … // display reference; profit is FIFO` → `avgStockPrice … // avg cost of layers on hand; maintained on IN and OUT (S23); profit is FIFO` + an `avgPrice` line matching the live schema |

After A7, `grep -rn "averageCost\|avgCost" Docs/Stage-00-Conception/` must return nothing.

---

## 9. Known consequence the executor must report, not fix

`Apps/api/test/unit/modules/inventory/inventory.service.spec.ts` **line 308** contains:

```ts
it('never touches averageCost (avgCost recomputes on IN only)', async () => {
```

This test asserts the exact behaviour A1 deliberately changes, so **it will fail once A1 lands.**

Per hard rule 3 the executor **must not modify it and must not run the suite**. Record it in the
set report as a known-failing test requiring an owner decision, together with any other assertion
in that file that pins `avgStockPrice` across a `consumeFifo` call. Do not attempt to preserve the
old behaviour to keep the test green.

For context, `Apps/api` `tsc --noEmit` over `test/**` already reports ~228 pre-existing lines of
fixture drift (recorded in report-S21); this set must not increase that count, which A5's stub
deletion was checked against.

---

## 10. Validation gates

Per hard rule 3 — compile and lint only, no test run.

1. `cd Apps/contract && npx tsc --noEmit` — expected clean (nothing in this set touches the
   contract; run it to prove that).
2. `cd Apps/api && npx tsc --noEmit` — the `src/**` portion must be clean. Compare `test/**` output
   against the pre-change baseline (`git stash` and re-run) and confirm it is **identical**.
3. `cd Apps/api && npm run lint` — must pass. Note the recorded gotcha: this used to crash rather
   than warn on real findings on Node 18; that was fixed, so a crash now means a genuine problem.
4. `cd Apps/web && npx tsc --noEmit && npm run lint` — expected unchanged; the frontend is not
   touched by this set.
5. `grep -rn "InventoryPortStub" Apps/api/src` must return nothing.
6. `grep -rn "averageCost\|avgCost" Docs/Stage-00-Conception/` must return nothing (after A7; if
   the owner drops A7, only `Module-Contracts/inventory.md` and `database-description.md` must be
   clean).

---

## 11. Manual verification checklist (browser)

The owner verifies behaviour; there is no test gate.

**Before starting, record the baseline** — *Admin → Statistics*, note **Total product value**, and
*Admin → Inventory → Stock levels*, note "Avg. stock price" and "Total cost" for a product with at
least two FIFO layers at different costs. On the current dev data, "Motherboard Iphone 13 pro"
shows **13 500.00** with 9 on hand; its true value is **14 333.33**.

1. **The average moves on a sale, and to the right number.** Sell 1 unit of that product in the
   POS. Return to *Stock levels*: on hand drops by 1 **and** "Avg. stock price" now changes — where
   before it stayed frozen. Because the identity form is self-healing, the first sale after this
   fix jumps the figure straight to the true FIFO average of the remaining layers (for the product
   above: to **14 333.33** or beyond, not a small step from 13 500.00). That jump is expected once,
   per product; subsequent movements move it smoothly.

2. **Cross-check the number.** For the product you just sold, confirm the displayed average equals
   the true remaining-layer average:
   ```sql
   SELECT p.name, p."quantityOnHand", p."avgStockPrice" AS stored,
          ROUND(SUM(m."remainingQuantity" * m."unitCost")
                / NULLIF(SUM(m."remainingQuantity"), 0), 2) AS fifo_true
   FROM "Product" p
   LEFT JOIN "StockMovement" m
     ON m."productId" = p.id AND m.direction = 'IN' AND m."remainingQuantity" > 0
   WHERE p.name = '…'
   GROUP BY p.id, p.name, p."quantityOnHand", p."avgStockPrice";
   ```
   **`stored` must now equal `fifo_true`.** Re-running the same query without the `WHERE` clause
   should show the gap closing product by product as each one sees its next OUT.

3. **Stock valuation follows.** *Admin → Statistics* → **Total product value** has moved by exactly
   the same amount as the "Total cost" column for that product. On current data the store-wide
   figure trends from 441 041.66 toward 448 600.00 as products see movement.

4. **Reservations still do nothing.** Place an online order for that product and confirm it. On
   *Stock levels*, reserved rises, available falls, **and the average is unchanged**. Cancel the
   order: reserved falls back, **average still unchanged**. This must hold — a reservation moves no
   layers.

5. **Order completion moves it, at the right moment.** Place and confirm another order, then walk
   it to **COMPLETED**. The average moves only at COMPLETED, not at confirmation, packaging or
   delivery.

6. **Repairs behave the same.** Add a part to a repair (reserved rises, average unchanged), then
   take the repair to **PICKED_UP**. The average moves only at PICKED_UP.

7. **`ADJUSTMENT_OUT` counts too.** *Admin → Inventory → New adjustment*, count one **fewer** than
   the system quantity for a multi-layer product. After saving, the average has moved — an
   adjustment-out has no revenue but does consume real layers.

8. **The adjustment default is now correct (F2).** Reopen *New adjustment* for that same product
   and enter a count one **higher**. The pre-filled unit cost and the *"The average price is …"*
   helper now show the **true** average, not the stale one. Save it, then check that the new layer
   was created at that cost:
   ```sql
   SELECT type, quantity, "unitCost", "remainingQuantity" FROM "StockMovement"
   WHERE "productId" = '…' AND direction = 'IN' ORDER BY "createdAt" DESC LIMIT 3;
   ```

9. **Last unit out keeps the average.** Sell a product down to **0 on hand**. `avgStockPrice` must
   **retain its last value**, not reset to 0 — check *Stock levels* and *Product info*. Margin
   displays on that product's pricing section must still render a real margin rather than the "no
   cost basis" fallback.

10. **The next IN still overwrites it.** Receive that zero-stock product on a supplier invoice and
    confirm the invoice. The average becomes the received unit cost, and the reprice section at the
    top shows that same figure with its three margin rows.

11. **`avgPrice` never moved.** Throughout all of the above, *Product info*'s **"Avg. price"**
    (the unweighted supplier-invoice figure) changes **only** at step 10, and only because a
    supplier invoice was confirmed. It must not react to any sale, order, repair or adjustment.

12. **Nothing else regressed.** Create a product with initial stock (average = the initial unit
    cost); sell part of a sale and return it with restock (the returned units re-enter at their
    **original consumed** cost, so the average moves back toward its pre-sale value, not to some
    blended figure); confirm the invoice snapshot for an admin still shows both the stored
    per-line cost **and** the current average beside it.
