# Plan S1 — Schema & Contract Foundation

*Backend + contract + compile-level frontend ripple. Unblocks S3, S4, S7, S8, S13, S14.*

---

## 0. Before you start

### 0.1 Sets that must land first

**None.** S1 is the first set in the execution order.

### 0.2 What this set is and is not

This set is **mechanical model-layer work**: schema columns, contract schemas, mappers, and the
compile-level fallout across backend and frontend. **No behavioral change is in scope** beyond the
two engine writes named in Action 10 and the reference resolution in Action 12. Everything else
that *consumes* these fields belongs to the set that owns the page.

### 0.3 Decisions resolved with the owner for this plan

These three were ambiguous in `app-issues-01.md` §S1 and have been settled. Plan to them; do not
re-open them.

| # | Question | Resolution |
|---|---|---|
| **R1** | Which IN movements feed `avgPrice`? | **Purchase receipts only** — `MovementType.SUPPLIER_INVOICE` and `MovementType.INITIAL_STOCK`. `RETURN_IN` (restock at the original consumed cost — not a purchase) and `ADJUSTMENT_IN` (whose unit cost *defaults to* `avgStockPrice`, so including it would feed `avgStockPrice` back into `avgPrice` circularly) are excluded. |
| **R2** | What does "add `paidDate` to supplier payments" mean, given `SupplierPayment.paidAt` already exists and is already exposed? | Add **`SupplierInvoice.paidDate`** — the effective date of the most recent payment against that invoice, `null` while unpaid. `SupplierPayment.paidAt` and `CreateSupplierPaymentCommand.paidAt` (which already exists and is already operator-settable) are **unchanged**. |
| **R3** | What does "created date on the invoices list DTO" mean, given `InvoiceDto.issuedAt` already exists and `InvoicesTable` already renders it? | **`SaleDto.createdAt` only.** For invoices, `Invoice.issuedAt` **is** the created date (`@default(now())`, stamped at issuance) and is already rendered — no contract change. Do not add `InvoiceDto.createdAt`. |

### 0.4 Findings recorded during planning — read before acting

**F1 — `Product.barcode` already has the index S1 asks for.** `schema.prisma:457` declares
`barcode String? @unique`, which Postgres implements as a unique btree index. Action 2 therefore
does **not** add a second `@@index([barcode])` — it would be a duplicate index on the same column.
The index serves exact-match and `startsWith` lookups, which is what a barcode scanner produces.
**Instruction for S3/S4:** their barcode search must be written as
`{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { barcode: { startsWith: q } }] }`.
A `barcode: { contains: … }` predicate would **not** use this index — if the owner later wants
infix barcode matching, the correct index is a `pg_trgm` GIN index, which is out of scope here.
Record this verbatim in the report.

**F2 — `referenceType: 'RETURN'` is written by three modules with three different `referenceId`
meanings.** `sales.service.ts:283` passes the `Return.id`; `orders.service.ts:399` passes the
`Order.id`; `repairs.service.ts:250` passes the `Repair.id`. Action 12's resolver therefore
resolves `RETURN` through a **three-table fallback chain** rather than a single join. Do **not**
"fix" the writers in this set — S10 rewrites the orders return path and S13 rewrites the repairs
one; changing them now is churn that those sets would immediately overwrite. Note the wart in the
report so S10/S13 normalise it.

**F3 — `referenceType: 'STAFF_SEARCH'` is dead.** `movement-ledger-table.tsx:31` branches on it,
but **no service anywhere writes a StockMovement with that referenceType** (verified: the only
`referenceType:` literals in `Apps/api/src/modules/**` are ADJUSTMENT, ORDER, RETURN,
SUPPLIER_INVOICE, REPAIR, SALE, and PRODUCT). Action 20 deletes that branch.

**F4 — `Repair.saleId` is load-bearing as an idempotency latch, not just a link.**
`sales.service.ts:325-329` documents it as the `@unique` latch that makes `recordRepairSale`
idempotent. `Repair.invoiceId` inherits that role for S13; keep the `@unique`.

### 0.5 Temporary regressions this set deliberately introduces

`app-issues-01.md` §S1 states the new repair-issuance behavior lands in **S13** and the statistics
consequences in **S14**. Between S1 and S13, therefore:

1. **A repair pickup produces nothing.** Deleting `recordRepairSale` and the sales `repair.pickedUp`
   listener (Action 16) removes the only code path that, on pickup, created a Sale, applied
   `credit`/`totalPaid`/`totalSold` via the clients credit port, and recorded revenue. Until S13
   implements pickup-time invoice issuance, moving a repair to `PICKED_UP` changes the repair row
   and nothing else.
2. **Repair revenue disappears from statistics.** `statistics.service.ts:300` counts revenue as
   `Σ COMPLETED Sale rows (both origins)`; with no repair-origin sale row existing, repair revenue
   is simply absent until S14 reads repairs directly.

Both are expected. State them in the report so the owner does not read them as defects during
manual verification.

### 0.6 Standing rules for this set

- **No test file may be edited and no test suite may be run.** Validation is `tsc --noEmit`, lint,
  and `prisma validate`/`prisma generate` only.
- **No new user-facing text is introduced by this set**, so no `translations.json` keys are added.
  Three *existing* keys are touched only by rename-adjacent edits; Action 21 says exactly what to
  do with each.
- **Read the comment above every line you change**, and update any comment your change makes wrong.
  This schema and these services are heavily commented and several comments assert facts this set
  invalidates (`// Never REPAIR`, `// Single-product orders`, `// billing skips REPAIR-origin
  sales`, `// both origins`, `// modules not yet built`). Each is named in the action that
  invalidates it.
- **Money and stock caches stay in-transaction on locked rows.** Action 10 writes `avgStockPrice`
  and `avgPrice` inside `addLayerCore`, which already holds the `SELECT … FOR UPDATE` product lock.
  Action 14 writes `SupplierInvoice.paidDate` inside `createPayment`'s existing locked transaction.
  Do not move either into a listener — see `Docs/Stage-02-Backend/results/report-credit-serialization.md`.

---

## 1. Naming decided once, used everywhere

Per **D10**, the existing quantity-weighted `Product.averageCost` is renamed and a second,
unweighted figure is added. Every consumer reads exactly one of them:

| Field | Definition | Read by |
|---|---|---|
| **`avgStockPrice`** | Quantity-weighted moving average — the *existing* `averageCost` math, unchanged: `(onHand × oldAvg + qty × unitCost) / newOnHand` on every IN movement. | **Margin displays** (S2/S3), **inventory adjustment default unit cost** (S4), **stock valuation** (S14), reprice candidates and the projected-new-average hint (S7), invoice-line current-cost hint (S8). |
| **`avgPrice`** | Unweighted mean of purchase unit costs: `AVG(unitCost)` over the product's IN movements of type `SUPPLIER_INVOICE` or `INITIAL_STOCK` (**R1**). | **Supplier-invoice context only** — S7's *"avg price is …"* helper text beneath the Add-Invoice quantity field. Nothing else. |

The DTO field renames that follow from this, in full:

| Contract schema | Old field | New field |
|---|---|---|
| `AdminProductResponseSchema` | `averageCost` | `avgStockPrice` **+ new `avgPrice`** |
| `StockRowResponseSchema` | `averageCost` | `avgStockPrice` |
| `ConfirmResultResponseSchema.repriceCandidates[]` | `averageCost` | `avgStockPrice` **+ new `quantityOnHand`** |
| `SupplierInvoiceResponseSchema.lines[]` | `projectedNewAverageCost` | `projectedNewAvgStockPrice` |
| `InvoiceResponseSchema.lines[]` | `currentAverageCost` | `currentAvgStockPrice` |

---

## 2. Actions, in dependency order

Execute **1 → 21** in order. Actions 1–3 are the schema and migration; 4–9 are the contract; 10–19
are the backend; 20–21 are the frontend compile ripple. Nothing compiles between Action 1 and
Action 20 — run the full validation gate (§3) only at the end, not between actions.

---

### Action 1 — Prisma: dual average costs

**File:** `Apps/api/prisma/schema.prisma`

In `model Product` (currently line 465):

- Rename `averageCost` → **`avgStockPrice`**, keeping `Decimal @default(0) @db.Decimal(12, 2)`.
- Add **`avgPrice`** immediately after it, same type and default.
- Replace the existing trailing comment (`// display reference; profit is FIFO`) on both lines:

```prisma
  avgStockPrice    Decimal  @default(0) @db.Decimal(12, 2) // quantity-weighted moving average (D10):
  //   margins, adjustment defaults, stock valuation. Profit is still FIFO, never this figure.
  avgPrice         Decimal  @default(0) @db.Decimal(12, 2) // unweighted mean of purchase unit costs
  //   across SUPPLIER_INVOICE + INITIAL_STOCK receipts (D10). Supplier-invoice context only.
```

Use whatever comment placement matches the file's existing style (trailing `//` on the field line);
the two-line form above is illustrative of the content required, not the formatting.

---

### Action 2 — Prisma: repair invoicing model, supplier paid date, sale origin removal

**File:** `Apps/api/prisma/schema.prisma`

1. **`enum InvoiceSource`** (line 116): add `REPAIR`. Members become `SALE | ORDER | REPAIR`.

2. **`enum SaleOrigin`** (line 75): **delete the whole enum.**

3. **`model Sale`** (line 662):
   - Delete the field `origin SaleOrigin @default(POS)` and its `// REPAIR sales issue no invoice`
     comment.
   - Delete the back-relation `repair Repair?` (line 686).

4. **`model Repair`** (line 785):
   - Delete `saleId String? @unique` and its comment, and the relation `sale Sale? @relation(...)`.
   - Add, in their place:
     ```prisma
     invoiceId String? @unique // invoice issued at PICKED_UP (D9); also the pickup idempotency latch
     ```
     and, in the relation block:
     ```prisma
     invoice Invoice? @relation(fields: [invoiceId], references: [id])
     ```

5. **`model Invoice`** (line 856):
   - Add the required back-relation `repair Repair?` alongside the existing `lines`/`payments`.
   - Update the `sourceType` comment from `// SALE | ORDER — never repair` to
     `// SALE | ORDER | REPAIR (D9)`.

6. **`model SupplierInvoice`** (line 604): add, after `paidAmount`:
   ```prisma
   paidDate DateTime? // effective date of the most recent payment on this invoice; null while unpaid
   ```

7. **`Product.barcode`**: leave exactly as-is. Do **not** add `@@index([barcode])` — see **F1**.

**Do not touch** `model Order` in this set. Its folded single-product columns and the
`// Single-product orders: the line is folded into the order row.` comment above it belong to **S9**.

---

### Action 3 — The migration

Run `npx prisma migrate dev --name stage04_s1_schema_foundation` from `Apps/api`, then **hand-edit
the generated SQL** before applying it. Prisma will emit a DROP+ADD for the `averageCost` rename,
which would zero every product's average cost and make the owner's manual margin checks meaningless.
The database may drop data freely (standing context), but there is no reason to drop *this* data.

Required SQL, in this order:

```sql
-- 1. Drop the Repair -> Sale link first, so the repair-origin sales below can be deleted.
ALTER TABLE "Repair" DROP CONSTRAINT IF EXISTS "Repair_saleId_fkey";
DROP INDEX IF EXISTS "Repair_saleId_key";
ALTER TABLE "Repair" DROP COLUMN "saleId";

-- 2. Purge repair-origin sales. With Sale.origin gone they would be indistinguishable from POS
--    sales and would double-count against S14's statistics rework.
DELETE FROM "ReturnLine" WHERE "saleLineId" IN (
  SELECT sl.id FROM "SaleLine" sl JOIN "Sale" s ON s.id = sl."saleId" WHERE s.origin = 'REPAIR');
DELETE FROM "Return" WHERE "saleId" IN (SELECT id FROM "Sale" WHERE origin = 'REPAIR');
DELETE FROM "SaleLine" WHERE "saleId" IN (SELECT id FROM "Sale" WHERE origin = 'REPAIR');
DELETE FROM "Sale" WHERE origin = 'REPAIR';

-- 3. Drop the origin column and its enum.
ALTER TABLE "Sale" DROP COLUMN "origin";
DROP TYPE "SaleOrigin";

-- 4. Repair -> Invoice.
ALTER TABLE "Repair" ADD COLUMN "invoiceId" TEXT;
CREATE UNIQUE INDEX "Repair_invoiceId_key" ON "Repair"("invoiceId");
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. InvoiceSource gains REPAIR.
ALTER TYPE "InvoiceSource" ADD VALUE 'REPAIR';

-- 6. Dual average costs. RENAME, not DROP+ADD — preserves every product's current average.
ALTER TABLE "Product" RENAME COLUMN "averageCost" TO "avgStockPrice";
ALTER TABLE "Product" ADD COLUMN "avgPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
UPDATE "Product" p SET "avgPrice" = COALESCE((
  SELECT AVG(m."unitCost") FROM "StockMovement" m
  WHERE m."productId" = p.id
    AND m.direction = 'IN'
    AND m.type IN ('SUPPLIER_INVOICE', 'INITIAL_STOCK')
), 0);

-- 7. Supplier invoice paid date, backfilled from the existing payment ledger.
ALTER TABLE "SupplierInvoice" ADD COLUMN "paidDate" TIMESTAMP(3);
UPDATE "SupplierInvoice" si SET "paidDate" = (
  SELECT MAX(sp."paidAt") FROM "SupplierPayment" sp WHERE sp."supplierInvoiceId" = si.id);
```

The `UPDATE` in step 6 is not just a backfill — it is the **exact definition** of `avgPrice`, and
Action 10 must maintain the column so that this query would return the same value at any later
time. Keep the two in sync.

**If step 5 fails** with *"unsafe use of new value of enum type"*, the Postgres version requires
`ALTER TYPE … ADD VALUE` to be committed before the value is used. Nothing in this migration uses
`'REPAIR'`, so this should not happen; if it does, split step 5 into its own migration
(`stage04_s1_invoice_source_repair`) applied first.

Afterwards run `npx prisma generate`.

---

### Action 4 — Contract: catalog DTOs

**File:** `Apps/contract/src/modules/catalog/catalog.dtos.ts`

In `AdminProductResponseSchema` (line 60):
- Rename `averageCost: z.number()` → `avgStockPrice: z.number()`.
- Add `avgPrice: z.number()` immediately after it.
- Update the block comment at line 54 (`// Admin — full visibility: exact quantities, averageCost,
  …`) to name both figures and say which is which, per §1's table.

**File:** `Apps/contract/src/modules/catalog/catalog.command.ts` — line 71's comment mentions
`averageCost`; update the wording only. No command field changes.

---

### Action 5 — Contract: inventory enums + DTOs

**File:** `Apps/contract/src/modules/inventory/inventory.enums.ts`

Add a new enum (hard rule 1 — `referenceType` is a value shared between front and back and is
currently a magic string on both sides):

```ts
// StockMovement.referenceType — the source-document kind a movement is attributed to. Closed
// (not the open string it used to be) because S1's reference resolver must be exhaustive over it,
// and because the frontend compares against these values directly. Every writer is accounted for:
// PRODUCT (modules/index.ts's catalog initial-stock adapter), SUPPLIER_INVOICE (purchasing),
// ADJUSTMENT (inventory), SALE (sales), ORDER (orders), REPAIR (repairs), RETURN (sales, orders
// and repairs — see the resolver's own note on the three referenceId meanings).
export enum MovementReferenceType {
  PRODUCT = 'PRODUCT',
  SUPPLIER_INVOICE = 'SUPPLIER_INVOICE',
  ADJUSTMENT = 'ADJUSTMENT',
  SALE = 'SALE',
  ORDER = 'ORDER',
  REPAIR = 'REPAIR',
  RETURN = 'RETURN',
}
```

Do **not** add a `STAFF_SEARCH` member — nothing writes it (**F3**).

**File:** `Apps/contract/src/modules/inventory/inventory.dtos.ts`

- `StockRowResponseSchema` (line 11): rename `averageCost` → `avgStockPrice`.
- `MovementResponseSchema` (line 32): change `referenceType: z.string()` →
  `referenceType: z.enum(MovementReferenceType)`, importing it from `./inventory.enums`. Replace
  the block comment at lines 18–19 (which asserts the field is deliberately an open string) with
  one explaining why it is now closed.

**File:** `Apps/contract/src/modules/inventory/index.ts` — **no change needed.** It already does
`export * from './inventory.enums';`, so the new enum is re-exported automatically. Verified during
planning; confirm rather than edit.

---

### Action 6 — Contract: purchasing DTOs

**File:** `Apps/contract/src/modules/purchasing/purchasing.dtos.ts`

- `SupplierInvoiceResponseSchema`: add `paidDate: z.iso.datetime().optional()` after `paidAmount`.
- `SupplierInvoiceResponseSchema.lines[]`: rename `projectedNewAverageCost` →
  `projectedNewAvgStockPrice`; keep it `.optional()` and keep the `// Projection on DRAFT reads
  only (spec) — absent once CONFIRMED.` comment.
- `ConfirmResultResponseSchema.repriceCandidates[]`: rename `averageCost` → `avgStockPrice`, and
  add `quantityOnHand: z.number().int()`.

The `quantityOnHand` addition is for **S7**, whose reprice section shows *"the qty in stock beside
the avg stock qty"*. It is pure model-layer plumbing, so it lands here rather than forcing S7 to
reopen the contract. Note it as such in the report.

---

### Action 7 — Contract: billing enums + DTOs

**File:** `Apps/contract/src/modules/billing/billing.enums.ts`

- `InvoiceSource`: add `REPAIR = 'REPAIR'`.
- Delete the `// Never REPAIR (spec) — repair pickups are recorded as a repair-origin sale with no
  invoice, so this union has no third member.` comment and replace it with one stating D9: a repair
  issues an invoice and no sale record, at `PICKED_UP`.

**File:** `Apps/contract/src/modules/billing/billing.dtos.ts`

- `InvoiceResponseSchema.lines[]`: rename `currentAverageCost` → `currentAvgStockPrice`.
- Update the block comment at the top of the file, which names `currentAverageCost`.

Do **not** add `InvoiceDto.createdAt` (**R3**).

---

### Action 8 — Contract: sales enums, DTOs, events

**File:** `Apps/contract/src/modules/sales/sales.enums.ts` — delete `export enum SaleOrigin`
entirely.

**File:** `Apps/contract/src/modules/sales/sales.dtos.ts`
- Remove the `SaleOrigin` import and the `origin: z.enum(SaleOrigin)` field from
  `SaleResponseSchema`.
- Add `createdAt: z.iso.datetime()` to `SaleResponseSchema` (**R3**; consumed by S12's sales-table
  created-date column). Place it beside `soldAt`.

**File:** `Apps/contract/src/modules/sales/sales.events.ts`
- Remove the `import type { SaleOrigin }` line and the `origin: SaleOrigin;` member of
  `'sale.confirmed'`.
- Update the file's block comment, which describes the payload.

**File:** `Apps/contract/src/modules/sales/index.ts` — remove the `SaleOrigin` re-export.

---

### Action 9 — Contract: clients DTO

**File:** `Apps/contract/src/modules/clients/clients.dtos.ts`

`AdminClientResponseSchema`: add `createdAt: z.iso.datetime()`. This is the column the admin
clients table already renders empty (S8 consumes it).

---

### Action 10 — Inventory engine maintains both average costs

**File:** `Apps/api/src/modules/inventory/inventory.service.ts`

**10a — the purchase-receipt set.** Add a module-local const near the top of the file (backend-only
value; it does not belong in the contract):

```ts
// Which IN movements count as a "purchase receipt" for Product.avgPrice (D10, plan S1 R1).
// RETURN_IN re-enters stock at the original consumed cost (not a purchase) and ADJUSTMENT_IN's
// unit cost defaults to avgStockPrice (which would make avgPrice circular) — both excluded.
const PURCHASE_RECEIPT_TYPES: MovementType[] = [MovementType.SUPPLIER_INVOICE, MovementType.INITIAL_STOCK];
```

**10b — `addLayerCore` (line 265).** This method already holds the `SELECT … FOR UPDATE` product
lock via `lockProduct`, and is the single IN-direction write path (public `addLayer` and
`returnIn`'s per-cost-group loop both funnel through it). Change:

- Rename the local `oldAvg`/`newAvg` to `oldAvgStockPrice`/`newAvgStockPrice` and read
  `product.avgStockPrice` instead of `product.averageCost`. **The formula itself does not change.**
- **After** `tx.stockMovement.create(...)` (so the row just written is included), compute the new
  `avgPrice`:
  ```ts
  const receiptAvg = await tx.stockMovement.aggregate({
    _avg: { unitCost: true },
    where: { productId, direction: 'IN', type: { in: PURCHASE_RECEIPT_TYPES } },
  });
  const newAvgPrice = receiptAvg._avg.unitCost?.toNumber() ?? 0;
  ```
  Recomputing by aggregate rather than carrying an incremental running mean means no receipt-count
  column is needed and the value can never drift from its own definition — it is exactly the
  `UPDATE` in Action 3 step 6. The aggregate is a single indexed scan inside a transaction that
  already holds the product lock, so nothing else can be inserting IN rows for this product
  concurrently.
- Change the product update to write both:
  ```ts
  await tx.product.update({
    where: { id: productId },
    data: { quantityOnHand: newOnHand, avgStockPrice: newAvgStockPrice, avgPrice: newAvgPrice },
  });
  ```
- Update this method's leading comment (line 262-264), which currently says *"both are IN-direction
  writes that recompute averageCost the same way"* — it must now name both figures and state that
  only purchase-receipt types move `avgPrice`.

**10c — `lockProduct`'s comment (line 309-314)** lists `averageCost` among the columns this lock
serializes. Change to `avgStockPrice` and `avgPrice`.

**10d — `createAdjustment` (line 547).** `line.unitCost ?? product.averageCost.toNumber()` becomes
`line.unitCost ?? product.avgStockPrice.toNumber()`. This is the *adjustment default* consumer from
§1's table; **S4** adds the *"the average price is …"* helper text beside the input — do not add UI
here.

**10e — `STOCK_ROW_CSV_HEADERS` (line 358)** and the CSV row builder in `getStock` (line 392):
`'averageCost'` → `'avgStockPrice'`, `row.averageCost` → `row.avgStockPrice`.

---

### Action 11 — Inventory mapper

**File:** `Apps/api/src/modules/inventory/inventory.mapper.ts`

`toStockRowDto` (line 32): read `product.avgStockPrice`, emit `avgStockPrice`. `stockValue` stays
`product.quantityOnHand * avgStockPrice` — the stock-valuation consumer from §1's table.

---

### Action 12 — RC-4: resolve order / sale / repair / return references

**File:** `Apps/api/src/modules/inventory/inventory.service.ts` (`InventoryReadService`)

Today `listMovements` (line 427-455) batch-resolves only `ADJUSTMENT`, `SUPPLIER_INVOICE` and
`PRODUCT`; everything else falls through `InventoryMapper.resolveReferenceLabel`'s
`` `${referenceType} ${referenceId.slice(0, 8)}` `` fallback — which is the raw id the RC-4 row
reports. Those modules now all exist.

**12a — replace the ad-hoc per-type blocks with one private helper** on `InventoryReadService`:

```ts
// Resolves each movement's source document to its human reference (ORD-…, SAL-…, REP-…, RET-…,
// FAC-…, AJU-…) — RC-4. One batched query per referenceType, keyed by referenceId.
//
// RETURN is the awkward one: sales passes the Return.id, orders passes the Order.id and repairs
// passes the Repair.id for the very same referenceType (plan S1 finding F2), so it is resolved by
// trying all three tables and taking whichever id exists. S10 and S13 should normalise their
// writers; until then this fallback chain is the only correct read.
private async resolveReferenceLabels(
  rows: { referenceType: string; referenceId: string }[],
): Promise<Map<string, string>>
```

Key the returned map by `` `${referenceType}:${referenceId}` `` so the RETURN fallback can never
collide with a same-id hit from another type.

Per type, the batched lookup and the field to read:

| `referenceType` | Table | Field |
|---|---|---|
| `PRODUCT` | `product` | `name` |
| `ADJUSTMENT` | `stockAdjustment` | `reference` |
| `SUPPLIER_INVOICE` | `supplierInvoice` | `reference` |
| `SALE` | `sale` | `reference` |
| `ORDER` | `order` | `reference` |
| `REPAIR` | `repair` | `reference` |
| `RETURN` | `return`, then `order`, then `repair` (first hit wins) | `reference` |

Issue every lookup with `findMany({ where: { id: { in: [...] } }, select: { id: true, reference: true } })`,
skipping types with no ids in the page, and run them with a single `Promise.all` — the same shape
the existing two-type version already uses.

**12b — `listMovements`** builds its `referenceLabel` from this map, keeping
`InventoryMapper.resolveReferenceLabel(type, id, resolved)` as the not-found fallback (a movement
whose source document was hard-deleted must still render *something*, not throw).

**12c — `listReservations`** (line 496) calls `resolveReferenceLabel(group.referenceType,
group.referenceId)` with **no** resolved name at all, so every `holderReference` on the
reservations table is currently `ORDER a1b2c3d4`. Reservations are only ever `ORDER` or `REPAIR`
(the engine's own `reservationType` guard proves it), so resolve the page's groups through the same
helper before mapping.

**12d — `InventoryMapper.resolveReferenceLabel`'s comment** (lines 98-102) says *"reference types
whose document module isn't built yet (SALE/ORDER/REPAIR/RETURN) pass no resolvedName and get this
fallback"*. That is now false — rewrite it to describe the fallback as the deleted-document case
only.

---

### Action 13 — Catalog: expose both figures, feed the ports

**File:** `Apps/api/src/modules/catalog/catalog.mapper.ts`
- `toAdminProductDto` (line 142): emit `avgStockPrice: CatalogMapper.toMoney(product.avgStockPrice)`
  and `avgPrice: CatalogMapper.toMoney(product.avgPrice)`.
- Update the method's leading comment (line 118), which names `averageCost`.

**File:** `Apps/api/src/modules/catalog/catalog.service.ts`
- `getRepriceCandidates` (line 755): widen the declared return type and the mapped object to
  `avgStockPrice` (from `product.avgStockPrice`) plus `quantityOnHand: product.quantityOnHand`.
  Ensure the `findMany`'s `select`/shape actually loads `quantityOnHand`.
- `getCostBasis` (line 795): return **both** — `{ productId, name, avgStockPrice, avgPrice,
  quantityOnHand }`. Purchasing's projection uses `avgStockPrice`; **S7's *"avg price is …"* helper
  consumes `avgPrice`.** Add `avgPrice: true` to the `select`.
- Update the comments at lines 526, 597, 752-754 and 793-794, all of which name `averageCost`.

**File:** `Apps/api/src/modules/catalog/inventory.port.stub.ts` (line 21): `averageCost:
input.unitCost` → `avgStockPrice: input.unitCost`. This stub is replaced at wiring time by
`modules/index.ts`'s real adapter and never runs in the app; the edit is for compilation only. Its
comment at line 9 names the column — update it.

---

### Action 14 — Purchasing: paid date, renamed projections

**File:** `Apps/api/src/modules/purchasing/purchasing.interface.ts` — update the
`getRepriceCandidates` and `getCostBasis` declarations (lines 49-65) to match Action 13's new
shapes exactly.

**File:** `Apps/api/src/modules/purchasing/purchasing.mapper.ts`
- `RepriceCandidateRow` (line 33): `averageCost` → `avgStockPrice`, add `quantityOnHand: number`.
- `SupplierInvoiceLineRow`'s projection field and `toSupplierInvoiceDto`: rename
  `projectedNewAverageCost` → `projectedNewAvgStockPrice`.
- `toSupplierInvoiceDto`: emit `paidDate` — `...(invoice.paidDate != null ? { paidDate:
  invoice.paidDate.toISOString() } : {})`, matching the file's established optional-field style.

**File:** `Apps/api/src/modules/purchasing/purchasing.service.ts`
- `readInvoiceWithProjection` (line 630-637): `basis.averageCost` → `basis.avgStockPrice`; the
  projected value's property name follows Action 6's rename. The formula is unchanged — it projects
  the **new `avgStockPrice`**, not `avgPrice`.
- `createPayment` (line 464): inside the existing transaction, in the same
  `tx.supplierInvoice.update` call that already increments `paidAmount` (line 495), also set
  `paidDate`:
  ```ts
  await tx.supplierInvoice.update({
    where: { id: invoiceId },
    data: { paidAmount: { increment: cmd.amount }, paidDate: cmd.paidAt != null ? new Date(cmd.paidAt) : new Date() },
  });
  ```
  Use the **same effective date** the `SupplierPayment` row itself is written with at line 508
  (`cmd.paidAt ?? now`) so the two can never disagree. Extract it to a single local
  (`const effectivePaidAt = cmd.paidAt != null ? new Date(cmd.paidAt) : new Date();`) used by both
  writes. Extend the comment at lines 487-489, which already explains why this write is in-tx.
- `cancelInvoice`: if it resets `paidAmount`, reset `paidDate` to `null` in the same transaction.
  Read the method before deciding — if it does not touch `paidAmount`, leave `paidDate` alone and
  say so in the report.

---

### Action 15 — Billing: REPAIR source, drop the repair-origin guard

**File:** `Apps/api/src/modules/billing/billing.service.ts`

- `issueFromSale` (line 226): **delete** the line `if (payload.origin === 'REPAIR') return;` — the
  payload no longer has an `origin` and no repair-origin sale can exist. Delete the *"Skips REPAIR
  origin entirely (spec: …)"* sentence from the method's comment (lines 222-225) and keep the rest.
- `resolveSourceReferences` (line 431): add a third branch for
  `PrismaInvoiceSource.REPAIR` → `this.prisma.repair.findMany({ where: { id: { in: repairIds } },
  select: { id: true, reference: true } })`, merged into the same map. No REPAIR invoice exists yet
  — S13 creates the first — but the resolver must be complete the moment one does.
- `resolveCurrentAverageCosts` (line 452): rename the method to `resolveCurrentAvgStockPrices`,
  rename its `averageCostByProductId` local, and read `select: { id: true, avgStockPrice: true }`.
  Update the caller. Its long comment (lines 446-451) describes SALE-vs-ORDER correlation and is
  still accurate for those two; append a sentence noting REPAIR invoices are not correlated yet
  (S13 decides whether repair invoice lines carry a productId).

**File:** `Apps/api/src/modules/billing/billing.mapper.ts` — rename the `currentAverageCost` context
field and DTO output to `currentAvgStockPrice`; update the block comment at lines 18-20 which names
it.

**File:** `Apps/api/src/modules/billing/billing.listener.ts` — **no change.** Its `sale.confirmed`
and `order.confirmed` subscriptions stay exactly as they are.

---

### Action 16 — Sales: delete repair-sale recording, drop `origin`, add `createdAt`

This is the largest deletion in the set. Read §0.5 before starting.

**File:** `Apps/api/src/modules/sales/sales.listener.ts` — **delete the entire file.**
`repair.pickedUp` was its only subscription.

**File:** `Apps/api/src/modules/sales/sales.routes.ts` — delete the `import { SalesListener } from
'./sales.listener';` (line 28) and the `new SalesListener(service).setup();` call (line 36).

**File:** `Apps/api/src/modules/sales/sales.service.ts`
- **Delete `recordRepairSale`** in full (lines ~325-410), including its four-line leading comment.
- Line 180: delete `origin: SaleOrigin.POS,` from the draft/create data.
- The `sale.confirmed` emit in `confirmSale`: delete its `origin:` member.
- Remove now-unused imports: `SaleOrigin`, `PrismaSaleOrigin`, `RepairsEvents`, and anything else
  only `recordRepairSale` used (`DocType.SALE` and `ConflictError` are almost certainly still used
  by other methods — check each rather than deleting on sight; `tsc --noEmit` and lint will catch
  a wrong call either way).

**File:** `Apps/api/src/modules/sales/sales.interface.ts` — delete the `recordRepairSale`
declaration from `ISalesService`.

**File:** `Apps/api/src/modules/sales/sales.mapper.ts`
- `toSaleDto` (line 35): delete the `origin: sale.origin as SaleOrigin,` line and shorten the
  two-line comment above it, which explains the nominal-type cast for *both* `SaleOrigin` and
  `SaleStatus` — it must keep explaining the `SaleStatus` cast.
- Add `createdAt: sale.createdAt.toISOString(),` beside the existing `soldAt` handling.
- Line 110 (`toDraftSaleDto` or equivalent): delete `origin: SaleOrigin.POS,` and add `createdAt`
  for the draft shape — a draft has a real `createdAt`, so it is not optional. If the draft mapper
  synthesises a DTO without a persisted row, pass the draft's own creation timestamp through the
  existing `DraftMapContext`; extend that type if needed.
- Remove the `SaleOrigin` import.

---

### Action 17 — Repairs: no behavioral change

**File:** `Apps/api/src/modules/repairs/repairs.service.ts`

Verified during planning: repairs never reads or writes `Repair.saleId`, so the column swap causes
no fallout here. The `repair.pickedUp` event **keeps being emitted** exactly as it is — statistics
and observability may subscribe, and S13 will attach the new issuance path to it.

Confirm with `grep -n "saleId" Apps/api/src/modules/repairs/` before declaring this a no-op, and
record the result in the report. **Do not** implement invoice issuance here — that is S13.

---

### Action 18 — Clients mapper: created date

**File:** `Apps/api/src/modules/clients/clients.mapper.ts`

`toAdminClientDto` (line 79): add `createdAt: client.createdAt.toISOString(),`. Verify
`AdminClientRow` (its type alias, and the service's `include`/`select`) actually loads `createdAt`
— if the query uses an explicit `select`, add it there too.

---

### Action 19 — Statistics: rename only

**File:** `Apps/api/src/modules/statistics/statistics.service.ts`

- Line 39: `select: { quantityOnHand: true, averageCost: true }` → `avgStockPrice: true`.
- Line 46: `p.averageCost.toNumber()` → `p.avgStockPrice.toNumber()`; update the comment at line 44.
  This is the **stock valuation** consumer from §1's table (D10) — S14 will audit the surrounding
  query, but the field it must read is settled here.
- Line 300's comment — *"Revenue/profit = Σ COMPLETED Sale rows (both origins — a REPAIR-origin
  sale carries the …)"* — is now wrong. Rewrite it to state that repair revenue no longer arrives
  through sales at all (D9) and that reading repairs directly is **S14**'s job. Do **not** change
  the query.

---

### Action 20 — Frontend: compile ripple

Every one of these is a rename or a dead-branch deletion. **No UI behavior changes in this set** —
the pages that *use* these fields are S3, S4, S7, S8 and S14.

| File | Change |
|---|---|
| `Apps/web/src/pages/admin/inventory/components/stock-levels-table.tsx` | `accessorKey: "averageCost"` → `"avgStockPrice"` (line 52); `row.original.averageCost` → `.avgStockPrice` (line 54); update the DTO-field list in the comment at line 25. |
| `Apps/web/src/pages/admin/products/components/admin-products-table.tsx` | `accessorKey: "averageCost"` → `"avgStockPrice"` (line 98); `row.original.averageCost` → `.avgStockPrice` (line 100); `product.averageCost` → `.avgStockPrice` (line 162, mobile row). |
| `Apps/web/src/pages/admin/products/AdminProductInformation.tsx` | `product.averageCost` → `.avgStockPrice` at lines 105 and 108. Leave the `admin.productInfo.stock.avgCost` label as-is — **S3** adds the second `avgPrice` stat and relabels both. |
| `Apps/web/src/pages/admin/supplier-invoices/components/reprice-prompt.tsx` | `candidate.averageCost` → `.avgStockPrice` (line 60). |
| `Apps/web/src/pages/staff/invoices/components/InvoiceSnapshotView.tsx` | `line.currentAverageCost` → `.currentAvgStockPrice` (line 60, both the guard and the value). |
| `Apps/web/src/pages/admin/inventory/components/movement-ledger-table.tsx` | Delete the dead `if (movement.referenceType === "STAFF_SEARCH")` branch and its `<Link>` (lines 30-37) — **F3**; `referenceCell` becomes a plain `<span>{movement.referenceLabel}</span>`. Rewrite the comment above it (lines 27-29) and the `referenceType`-is-an-open-string claim at line 43, which Action 5 falsified. Drop the now-unused `Link` import if nothing else in the file uses it. |
| `Apps/web/src/hooks/useCatalogProducts.ts` (line 65), `Apps/web/src/hooks/useInventory.ts` (line 39), `Apps/web/src/pages/admin/products/product-details.schema.ts` (line 6) | Comments only — each names `averageCost`; update the wording. |

Then grep the whole of `Apps/web/src` for `averageCost`, `currentAverageCost`,
`projectedNewAverageCost`, `SaleOrigin` and `\.origin\b` and fix anything the table missed.
(`row.original.*` from TanStack Table is a false positive — ignore it.)

---

### Action 21 — Translation keys: nothing added, three flagged

This set adds **no** user-facing text, so `Apps/web/src/config/translations.json` gains no keys.
(Note for every later plan: the file is `translations.json` — plural — not `translation.json` as the
brief writes it, and its keys are **flat dotted strings** mapping to `{ en, fr, ar }`, with `ar`
left `""`.)

Three existing keys are now mislabelled or about to move. **Leave all three in place** and record
them in the report as handoffs:

| Key | Current value | Note |
|---|---|---|
| `admin.suppliers.averageQuantity` | "Average Quantity" | Used by `reprice-prompt.tsx:60` to label what is actually the **average cost**, not a quantity. **S7** rewrites this section — it should replace the key there. |
| `admin.productInfo.stock.avgCost` | "Avg. cost" | Now ambiguous between the two figures. **S3** must split it into distinct `avgStockPrice`/`avgPrice` labels. |
| `admin.invoices.outgoing.table.averageCost` | "Current avg. cost" | Still accurate (it labels `currentAvgStockPrice`). Key name is stale but renaming it is churn; leave it. |

---

## 3. Validation gate

From the repo root, in this order. **Do not run any test suite.**

```bash
cd Apps/api      && npx prisma validate && npx prisma generate
cd Apps/contract && npx tsc --noEmit && npm run lint
cd Apps/api      && npx tsc --noEmit && npm run lint
cd Apps/web      && npx tsc --noEmit && npm run lint
```

Notes:
- The contract must build **before** the api and web type-checks, since both consume it.
- `Apps/web` has roughly 10 200 pre-existing prettier-noise lint findings (recorded in the
  stage-03 set-04 results). Compare your lint output against the baseline on `main` rather than
  expecting zero; the only findings that matter are ones your diff introduced.
- Existing test files **will** fail to compile against the renamed fields and the deleted
  `SalesListener` — `Apps/api/test/**` and `Apps/web/tests/**` both reference `averageCost` and
  `sales.listener.spec.ts` tests a file this set deletes. **Do not edit them.** List every test
  file that references a removed symbol in the report so the owner can schedule that work.

---

## 4. Manual verification checklist

The owner performs these in the browser after the set is reported. No automated test runs.

**Dual average costs (D10)**
1. `/admin/products` — the products table's average-cost column still renders a value for every
   product that had one before the migration (proves the RENAME preserved data, not a DROP+ADD).
2. `/admin/products/:id` — the avg-cost stat and the stock-value figure below it are unchanged from
   before this set.
3. `/admin/supplier-invoices/new` → add a line for an existing product → save → confirm the
   invoice. Reopen the product's info page: the avg cost has moved by the quantity-weighted
   formula, not to the raw new unit cost.
4. Query the database directly for that product and confirm both columns:
   `SELECT name, "avgStockPrice", "avgPrice" FROM "Product" WHERE id = '…';`
   `avgPrice` must equal the plain mean of the unit costs of its supplier-invoice/initial-stock
   receipts — i.e. re-running Action 3's backfill `UPDATE` must not change it.
5. `/admin/inventory` → **Adjustments** → pick a product and enter a count **above** the system
   quantity, leaving unit cost blank → save. The created IN layer's unit cost equals that product's
   `avgStockPrice` (not `avgPrice`), and the product's `avgPrice` is **unchanged** by the
   adjustment (**R1**).

**RC-4 — references, not ids**
6. `/admin/inventory` → **Movement ledger**. Every row's *Reference* cell shows a human reference
   (`SAL-…`, `ORD-…`, `REP-…`, `RET-…`, `FAC-…`, `AJU-…` or a product name) and **no row shows a
   truncated uuid** like `SALE a1b2c3d4`. Complete a POS sale and a repair beforehand so both
   types are present.
7. `/admin/inventory` → **Reservations** tab. `holderReference` shows `ORD-…` / `REP-…`, not
   `ORDER a1b2c3d4`.

**Supplier paid date**
8. `/admin/supplier-invoices/:id` → record a payment. The supplier-invoices list now carries a paid
   date for that invoice. (S7 adds the *column*; if it is not yet rendered, verify via
   `SELECT reference, "paidAmount", "paidDate" FROM "SupplierInvoice";`.)
9. An invoice that has never been paid has `paidDate = NULL`.

**Created dates**
10. `SELECT reference, "createdAt", "soldAt" FROM "Sale" LIMIT 5;` — the API's sale responses now
    carry `createdAt`. (S12 renders the column.)
11. The admin clients list DTO carries `createdAt` for every client. (S8 renders the column.)

**Repair model swap — expect the regression**
12. `SELECT origin FROM "Sale";` must error (*column does not exist*), and
    `SELECT "invoiceId" FROM "Repair";` must succeed.
13. Take a repair to `PICKED_UP`. **Expect nothing else to happen**: no sale row, no invoice, no
    change to the client's credit/`totalPaid`/`totalSold`. This is §0.5's documented regression,
    closed by **S13** — confirm it looks like *nothing happened*, not like an error.
14. `/admin/statistics` still loads without crashing; repair revenue is absent (closed by **S14**).

**Nothing else moved**
15. `/admin/pos` — complete a sale for a POS client. Credit, `totalPaid` and `totalSold` all move
    exactly as before this set, and an invoice is issued. (Confirms Action 16's deletions did not
    touch the POS path.)
16. `/admin/supplier-invoices` and `/admin/invoices` both load, and the outgoing-invoice detail
    view still shows its current-avg-cost hint per line.

---

## 5. Execution protocol

Start Set S1 plan execution. After finishing, write
**`Docs/Stage-04-Fixes/results/report-S01.md`** describing what changed, and ending with the
**verification checklist** above. The report must additionally record:

- **F1** verbatim (the barcode-index finding and the search predicate S3/S4 must use).
- **F2** (the three-way `RETURN` `referenceId` inconsistency) as a handoff to S10 and S13.
- §0.5's two temporary regressions, so they are not mistaken for defects.
- Action 17's grep result (whether repairs really was a no-op).
- Action 14's `cancelInvoice` finding (whether it resets `paidAmount`, and what you did about
  `paidDate`).
- Action 21's three flagged translation keys, as handoffs to S3 and S7.
- Every **test file** that now references a removed or renamed symbol — named, not counted — since
  none may be edited in this set.

The owner reviews and approves before the next set begins.
