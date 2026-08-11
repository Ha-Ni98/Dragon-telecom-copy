# Report — Set 23: `avgStockPrice` maintenance (fix)

Executed against `Docs/Stage-04-Fixes/plans/plan-S23-avg-stock-price.md` on `version-1-2`,
2026-08-11. Follows the audit in
`Docs/Stage-04-Fixes/results/findings-S23-avg-stock-price.md`, with the owner's two decisions:
**F3 → the layer-identity form** (accepted as self-healing), **F6 → amend Stage-00**.

All 7 planned actions (A1–A7) executed as written, in order. No test file was edited. No test
suite was run. No migration was created — the only schema edit is a comment.

---

## What changed

### Backend (`Apps/api`)

- **`inventory.service.ts` › `consumeFifo`** (the fix — A1). Every OUT movement (`SALE`,
  `ORDER_OUT`, `REPAIR_CONSUMPTION`, `ADJUSTMENT_OUT`) now recomputes `avgStockPrice` from the
  remaining FIFO layers, in the same `tx.product.update` call that already writes
  `quantityOnHand`, still inside the caller's transaction under the row lock `lockProduct` takes.
  Computed as `layerValueBefore - costOfGoods`, where `layerValueBefore` sums
  `remainingQuantity × unitCost` over the `layers` array the method already loads before any
  write — zero extra queries, zero extra locks. At `newOnHand === 0` the key is omitted from the
  update entirely, so the column keeps its last value rather than resetting or dividing by zero.
- **`inventory.service.ts` › `addLayerCore`** (A2). The unreachable `newOnHand === 0 ? 0` branch
  now reads `newOnHand === 0 ? oldAvgStockPrice`, matching the same zero rule on the IN side. No
  stored value changes — the branch was never reachable (every caller passes `qty > 0`) — this is
  precedent-consistency for the newly-reachable OUT case.
- **`inventory.service.ts`** (A3) — updated the stale comment above `addLayerCore` that described
  the recompute as IN-only; it now states the column is maintained on IN *and* OUT, and left alone
  by the three PENDING types.
- **`prisma/schema.prisma`** (A4) — `avgStockPrice`'s trailing comment rewritten to describe the
  corrected rule. **No column, type, or default changed — no migration was created or needed.**
- **`catalog/inventory.port.stub.ts`** — **deleted** (A5). It overwrote `avgStockPrice` outright
  and wrote no `StockMovement` row, which would have broken the FIFO layer invariant A1's fix now
  depends on. It never ran in production (replaced by the real engine at module-load time via
  `registerModules()`), so nothing behavioral changes; confirmed no test file imported it.
- **`catalog/catalog.routes.ts`** (A5) — the DI placeholder for `IInventoryPort` is now an inline
  object whose `addLayer` throws if it is ever actually invoked, instead of silently writing wrong
  data. Also updated the two adjacent comments that named the deleted class
  (`catalog.service.ts`'s `useInventory` doc comment, plus one comment each in
  `modules/index.ts` and `clients/clients.routes.ts` that referenced it by name).

### Documentation (`Docs/Stage-00-Conception`) — A6, A7

- **`database-description.md`** — structural rule 1 and invariant 4 rewritten to state the
  corrected rule (recomputed on IN *and* OUT, from the remaining-layer identity, untouched by
  PENDING, last value kept at zero quantity) and to retire "display reference" — F2 established
  the figure feeds real FIFO layer costs via the adjustment default. The `Product` field list and
  its ownership note renamed `averageCost` → `avgStockPrice` + `avgPrice`.
- **`Module-Contracts/inventory.md`** — Business Logic §3 rewritten with the full corrected
  formula (including the "quantity is always `quantityOnHand`, never `onHand − reserved`" and
  "`avgPrice` untouched" clauses); the module summary line, the injected-service block's inline
  comments, `StockRowDto`'s shape, BL§1's column list, BL§4's default-cost wording, and the Test
  Scenarios line all renamed/extended to match. **A fourth stale "IN only" location the audit
  didn't catalogue** — this file's own BL§3 was the literal source the engine's old comment cited
  as "spec BL#3" — was found while executing A6 and is now corrected too.
- **A7 naming sweep** (separable, executed) — `Module-Contracts/catalog.md`,
  `Module-Contracts/statistics.md`, `Module-Contracts/purchasing.md`, and Stage-00's own
  `schema.prisma` reference copy: every remaining `averageCost`/`avgCost` renamed to
  `avgStockPrice`, and the Stage-00 schema copy gained the missing `avgPrice` line to match the
  live schema.

Confirmed: `grep -rn "averageCost|avgCost" Docs/Stage-00-Conception/` now returns nothing.

### Not changed (verified, not just assumed)

- **No contract file.** Every consumer reads `avgStockPrice` through DTOs whose shape was already
  correct; only the value changes.
- **No frontend file.** Every UI consumer listed in the audit (stock table, product info, margin
  displays, adjustment form, reprice prompt, invoice snapshot) reads the value through existing
  hooks/queries and needed no code change.
- **`reserve` / `release`** — untouched. Verified they still never read or write
  `avgStockPrice`/`quantityOnHand`/any FIFO layer.
- **`avgPrice`** and its `PURCHASE_RECEIPT_TYPES` guard — untouched.
- **No translation key** added or changed — nothing here is new user-facing text, only an existing
  figure's value.

---

## Known consequence — one test will now fail (per plan §9, reported not fixed)

`Apps/api/test/unit/modules/inventory/inventory.service.spec.ts:308`:

```ts
it('never touches averageCost (avgCost recomputes on IN only)', async () => {
```

This test asserts the exact behavior A1 deliberately changes and **will now fail**. Per hard rule
3 it was not modified and the suite was not run. Flagging for the owner's decision — the plan
anticipated this and instructed against fixing it here.

---

## Validation gates

All read-only checks, per hard rule 3 (no test file edited, no test suite run).

| Gate | Result |
|---|---|
| `Apps/contract` `tsc --noEmit` | Clean (this set makes no contract change) |
| `Apps/api` `tsc --noEmit`, full incl. `test/**` | **228 lines, byte-identical** to the pre-change baseline (captured via `git stash` / re-run / `git stash pop`) — same pre-existing `test/**` fixture-drift lines as report-S21 recorded, zero new errors, zero errors in `src/**` |
| `Apps/api` `npm run lint` | **8 pre-existing errors, identical** to baseline (seed.ts, validate-request.middleware.ts, orders.service.ts — all pre-existing, none touched by this set) |
| `Apps/web` `tsc --noEmit` | Clean (this set makes no frontend change) |
| `Apps/web` `npm run lint` | Pre-existing prettier noise only, unrelated — zero web files touched by this set |
| `grep -rn "InventoryPortStub" Apps/api/src` | Empty |
| `grep -rn "averageCost\|avgCost" Docs/Stage-00-Conception/` | Empty |

---

## Manual verification checklist

Copied from the plan, for the owner to run in the browser and against the dev database. There is
no test gate — this is what verifies correctness.

**Before starting, record the baseline** — *Admin → Statistics*, note **Total product value**, and
*Admin → Inventory → Stock levels*, note "Avg. stock price" and "Total cost" for a product with at
least two FIFO layers at different costs. On the dev data at audit time, "Motherboard Iphone 13
pro" showed **13 500.00** with 9 on hand; its true value was **14 333.33** — expect that gap to
close as you sell through it below.

1. **The average moves on a sale, and to the right number.** Sell 1 unit of that product in the
   POS. Return to *Stock levels*: on hand drops by 1 **and** "Avg. stock price" now changes —
   where before it stayed frozen. Because the identity form is self-healing, the first sale after
   this fix jumps the figure straight to the true FIFO average of the remaining layers, not a
   small step from the old stored value. That jump is expected once, per product; subsequent
   movements move it smoothly.

2. **Cross-check the number.** For the product you just sold, confirm the displayed average
   equals the true remaining-layer average:
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

3. **Stock valuation follows.** *Admin → Statistics* → **Total product value** has moved by
   exactly the same amount as the "Total cost" column for that product.

4. **Reservations still do nothing.** Place an online order for that product and confirm it. On
   *Stock levels*, reserved rises, available falls, **and the average is unchanged**. Cancel the
   order: reserved falls back, **average still unchanged**. This must hold — a reservation moves
   no layers.

5. **Order completion moves it, at the right moment.** Place and confirm another order, then walk
   it to **COMPLETED**. The average moves only at COMPLETED, not at confirmation, packaging or
   delivery.

6. **Repairs behave the same.** Add a part to a repair (reserved rises, average unchanged), then
   take the repair to **PICKED_UP**. The average moves only at PICKED_UP.

7. **`ADJUSTMENT_OUT` counts too.** *Admin → Inventory → New adjustment*, count one **fewer** than
   the system quantity for a multi-layer product. After saving, the average has moved — an
   adjustment-out has no revenue but does consume real layers.

8. **The adjustment default is now correct.** Reopen *New adjustment* for that same product and
   enter a count one **higher**. The pre-filled unit cost and the *"The average price is …"*
   helper now show the **true** average, not the stale one. Save it, then check that the new
   layer was created at that cost:
   ```sql
   SELECT type, quantity, "unitCost", "remainingQuantity" FROM "StockMovement"
   WHERE "productId" = '…' AND direction = 'IN' ORDER BY "createdAt" DESC LIMIT 3;
   ```

9. **Last unit out keeps the average.** Sell a product down to **0 on hand**. `avgStockPrice`
   must **retain its last value**, not reset to 0 — check *Stock levels* and *Product info*.
   Margin displays on that product's pricing section must still render a real margin rather than
   the "no cost basis" fallback.

10. **The next IN still overwrites it.** Receive that zero-stock product on a supplier invoice and
    confirm the invoice. The average becomes the received unit cost, and the reprice section at
    the top shows that same figure with its three margin rows.

11. **`avgPrice` never moved.** Throughout all of the above, *Product info*'s **"Avg. price"**
    (the unweighted supplier-invoice figure) changes **only** at step 10, and only because a
    supplier invoice was confirmed. It must not react to any sale, order, repair or adjustment.

12. **Nothing else regressed.** Create a product with initial stock (average = the initial unit
    cost); sell part of a sale and return it with restock (the returned units re-enter at their
    **original consumed** cost, so the average moves back toward its pre-sale value, not to some
    blended figure); confirm the invoice snapshot for an admin still shows both the stored
    per-line cost **and** the current average beside it.
