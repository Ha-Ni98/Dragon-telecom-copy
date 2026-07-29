# Report S1 — Schema & Contract Foundation

Executed per `Docs/Stage-04-Fixes/plans/plan-S01-schema-contract-foundation.md`, actions 1→21 in
order, single session.

## Summary

All 21 actions completed. Migration applied and verified against the dev database (existing
`avgStockPrice` values preserved via `RENAME COLUMN`, not zeroed; `avgPrice` backfilled distinctly
per product; 2 pre-existing repair-origin sales purged). `tsc --noEmit` is clean on
`Apps/contract`, `Apps/api/src` and `Apps/web/src`. Lint is clean on all three packages relative
to each package's pre-existing baseline (see §5).

## What changed

### Schema + migration (Actions 1–3)
- `Product.averageCost` → `avgStockPrice` (renamed, quantity-weighted moving average) + new
  `avgPrice` (unweighted mean of purchase-receipt unit costs).
- `enum InvoiceSource` gains `REPAIR`; `enum SaleOrigin` deleted entirely.
- `Sale.origin` column dropped. `Repair.saleId` replaced by `Repair.invoiceId` (`@unique`,
  `Invoice?` relation) — same idempotency-latch role for S13.
- `SupplierInvoice.paidDate` added (`DateTime?`, null while unpaid).
- Migration `20260726041027_stage04_s1_schema_foundation` hand-written (not
  `prisma migrate dev`'s auto-diff, which would have DROP+ADD'd `averageCost` and zeroed every
  product's average). Applied via `prisma migrate deploy` after manually creating the migration
  folder (`prisma migrate dev` refused to run non-interactively against the data-loss warnings).
  Verified post-migration: `avgStockPrice` preserved 20 non-null values; `avgPrice` correctly
  differs per-product where purchase costs varied (e.g. one product: `avgStockPrice=2000.00`,
  `avgPrice=1050.00`); `paidDate` backfilled from existing `SupplierPayment` rows; `Sale` count
  dropped 12→10 (2 repair-origin sales purged); `Repair.invoiceId` is null on all rows as expected.

### Contract (Actions 4–9)
- `AdminProductResponseSchema`: `averageCost` → `avgStockPrice` + new `avgPrice`.
- `StockRowResponseSchema`: `averageCost` → `avgStockPrice`.
- New closed enum `MovementReferenceType` (inventory.enums.ts) — replaces the open
  `referenceType: z.string()` on `MovementResponseSchema`.
- `ConfirmResultResponseSchema.repriceCandidates[]`: `averageCost` → `avgStockPrice` + new
  `quantityOnHand`.
- `SupplierInvoiceResponseSchema`: new `paidDate`; `lines[].projectedNewAverageCost` →
  `projectedNewAvgStockPrice`.
- `billing.enums.ts`: `InvoiceSource` gains `REPAIR`. `billing.dtos.ts`:
  `lines[].currentAverageCost` → `currentAvgStockPrice`.
- `sales.enums.ts`: `SaleOrigin` deleted. `sales.dtos.ts`: `SaleResponseSchema` drops `origin`,
  gains `createdAt`. `sales.events.ts`: `sale.confirmed` drops `origin`.
- `clients.dtos.ts`: `AdminClientResponseSchema` gains `createdAt`.

### Backend (Actions 10–19)
- **Inventory engine** (`addLayerCore`): now maintains both `avgStockPrice` (unchanged formula)
  and `avgPrice` (recomputed by `aggregate({_avg: {unitCost}})` over `SUPPLIER_INVOICE` +
  `INITIAL_STOCK` IN rows only, inside the same product-locked transaction). `createAdjustment`'s
  default unit cost now reads `avgStockPrice`.
- **RC-4 reference resolver**: new private `resolveReferenceLabels()` on `InventoryReadService`,
  replacing the old two-type (ADJUSTMENT/SUPPLIER_INVOICE) resolver with a 7-type one (adds
  SALE/ORDER/REPAIR/RETURN). `RETURN` resolves via a three-table fallback chain (Return → Order →
  Repair), keyed `${referenceType}:${referenceId}` to avoid cross-type id collisions. Both
  `listMovements` and `listReservations` now use it — reservations previously passed **no**
  resolved name at all.
- **Catalog**: `toAdminProductDto`, `getRepriceCandidates` (+`quantityOnHand`), `getCostBasis`
  (+`avgPrice`) all updated; `inventory.port.stub.ts` renamed its write.
- **Purchasing**: `ICatalogRepricePort` interface, mapper types, and `toInvoiceDtoWithProjection`
  (renamed from the plan's `readInvoiceWithProjection` — verified actual name during execution)
  all updated. `createPayment` now writes `SupplierInvoice.paidDate` in the same transaction as
  `paidAmount`, using one `effectivePaidAt` local shared with the `SupplierPayment.paidAt` write
  so the two can never disagree. **`cancelInvoice` does not touch `paidAmount` at all** (verified
  by reading the method in full) — it only reverses `Supplier.credit`/`totalInvoiced` and sets
  `status: CANCELLED`. Left `paidDate` untouched there, per the plan's conditional instruction.
- **Billing**: `issueFromSale`'s `if (payload.origin === 'REPAIR') return` guard deleted (payload
  no longer carries `origin`). `resolveSourceReferences` gained a `REPAIR` branch joining
  `Repair.reference`. `resolveCurrentAverageCosts` renamed to `resolveCurrentAvgStockPrices`.
- **Sales**: `sales.listener.ts` deleted entirely (its only subscription, `repair.pickedUp`, is
  gone). `recordRepairSale` deleted in full from the service and its interface declaration.
  `sales.routes.ts` no longer instantiates any listener. `Sale.origin` removed from every write
  and read path; `SaleDto.createdAt` added (both `toSaleDto` and the draft-creation path, which
  re-reads through `toSaleDto` so no second mapper needed updating).
- **Repairs**: verified via `grep -rn "saleId" Apps/api/src/modules/repairs/` — **zero matches**.
  Confirmed true no-op, exactly as the plan anticipated.
- **Clients**: `toAdminClientDto` now emits `createdAt`. No service change needed —
  `ADMIN_CLIENT_INCLUDE` is an `include` (not a `select`), so `Client.createdAt` was already
  loaded on every query.
- **Statistics**: stock-valuation query renamed to `avgStockPrice`; the stale "both origins"
  comment on `computeRevenueProfit` rewritten to state the repair-revenue regression explicitly
  (query itself untouched, per plan).

### Frontend compile ripple (Actions 20–21)
- Renamed `averageCost` → `avgStockPrice` in: `stock-levels-table.tsx`, `admin-products-table.tsx`
  (×2 sites), `AdminProductInformation.tsx` (×2), `reprice-prompt.tsx`, `enhanced-pricing-section.tsx`
  (×2 — this file is a compile-only rename here; **S2 Action 4** rewrites it fully with
  `MarginDisplay`).
- Renamed `currentAverageCost` → `currentAvgStockPrice` in `InvoiceSnapshotView.tsx`.
- Deleted the dead `STAFF_SEARCH` branch in `movement-ledger-table.tsx`'s `referenceCell` (F3 —
  no writer ever produced that referenceType); dropped the now-unused `Link` import.
- Three comment-only updates (`useCatalogProducts.ts`, `useInventory.ts`,
  `product-details.schema.ts`).
- **Deviation from the plan, required for compile — not anticipated in Action 20's table:**
  `Apps/web/src/pages/my-invoices/components/InvoicesTable.tsx` and
  `Apps/web/src/pages/staff/invoices/components/InvoicesTable.tsx` each build a
  `Record<InvoiceSource, string>` exhaustive map (`SOURCE_LABEL_KEY`). Adding `REPAIR` to the
  contract's `InvoiceSource` enum (Action 7) makes both maps fail `tsc` as non-exhaustive. Added
  one new translation key, `invoices.source.repair` ("Repair"/"Réparation"), and a `REPAIR` entry
  to both maps. This is technically new user-facing text despite §0.6's "no new translation keys"
  rule — it was unavoidable for the set to compile once `InvoiceSource.REPAIR` exists, and the
  string is inert until S13 ever produces a repair invoice. Flagging here since the plan's Action
  20 table did not name these two files.
- One incidental prettier fix: `AdminProductInformation.tsx`'s avg-cost `StockStat` line grew past
  the width limit after the rename; reformatted to multi-line (no logic change).

## Handoffs recorded per the plan's execution protocol

- **F1** (verbatim): `Product.barcode` already has the index S1 asks for —
  `barcode String? @unique` is a unique btree index. No `@@index([barcode])` was added (would be a
  duplicate). **S3/S4 must write barcode search as**
  `{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { barcode: { startsWith: q } }] }`. A
  `barcode: { contains: … }` predicate would not use this index.
- **F2** — `referenceType: 'RETURN'` is written with three different `referenceId` meanings
  (sales → `Return.id`, orders → `Order.id`, repairs → `Repair.id`). The new
  `resolveReferenceLabels()` resolves this via a three-table fallback chain. **Handoff to S10 and
  S13**: normalise the writers so a single join suffices; until then, this fallback is the only
  correct read.
- **§0.5 — two temporary, deliberate regressions**, not defects:
  1. Moving a repair to `PICKED_UP` now does nothing beyond the status change — no sale, no
     invoice, no credit/`totalPaid`/`totalSold` movement. Closed by **S13**.
  2. Repair revenue is absent from `/admin/statistics` (no repair-origin sale exists to count).
     Closed by **S14**.
- **Action 17**: confirmed via grep — repairs module never read or wrote `Repair.saleId`, so the
  column swap was a true no-op there.
- **Action 14**: `cancelInvoice` does not touch `paidAmount`/`paidDate` — confirmed by reading the
  method; nothing was changed there.
- **Action 21 — three flagged translation keys, left in place as instructed:**
  - `admin.suppliers.averageQuantity` ("Average Quantity") mislabels what `reprice-prompt.tsx`
    shows (avg **cost**, not a quantity). **S7** should replace this key when it rewrites that
    section.
  - `admin.productInfo.stock.avgCost` ("Avg. cost") is now ambiguous between `avgStockPrice` and
    `avgPrice`. **S3** must split it into two distinct labels when it surfaces both figures.
  - `admin.invoices.outgoing.table.averageCost` ("Current avg. cost") is still accurate — left
    as-is.
- **Test files now stale against a removed/renamed symbol** (not edited, per rule) — named
  individually:
  - `test/data/billing-events.factory.ts` — imports `SaleOrigin` (deleted), builds `origin` into
    a `sale.confirmed` payload (field removed).
  - `test/data/product.factory.ts` — builds `averageCost` into a `Product` create input (renamed).
  - `test/data/repair.factory.ts` — builds `saleId` into a `RepairRow` (renamed to `invoiceId`).
  - `test/data/sale-draft.factory.ts` — builds `origin` into a `Sale` create input (removed).
  - `test/integration/repairs.integration.spec.ts` — reads `.saleId` off a `Repair` query result.
  - `test/integration/statistics.integration.spec.ts` — references stale fixture data (not
    individually inspected; failed to compile via the shared factories above).
  - `test/unit/modules/billing/{billing.listener,billing.mapper,billing.service}.spec.ts`
  - `test/unit/modules/catalog/catalog.mapper.spec.ts`
  - `test/unit/modules/clients/clients.listener.spec.ts`
  - `test/unit/modules/inventory/{inventory.mapper,inventory.service}.spec.ts`
  - `test/unit/modules/observability/observability.mapper.spec.ts`
  - `test/unit/modules/purchasing/purchasing.mapper.spec.ts`
  - `test/unit/modules/sales/{sales.listener,sales.mapper,sales.service}.spec.ts` — the
    `sales.listener.spec.ts` file tests a listener class this set deleted outright.

## Validation gate — all green

```
Apps/api:      prisma validate ✓   prisma generate ✓
Apps/contract: tsc --noEmit ✓      lint ✓ (0 problems)
Apps/api:      tsc --noEmit ✓ (src clean; test/** errors are the stale-symbol list above)
               lint: 6 pre-existing errors in prisma/seed.ts + validate-request.middleware.ts,
               both files untouched this session — confirmed via `git status --porcelain`
Apps/web:      tsc --noEmit ✓ (0 errors)
               lint: 0 new errors on any S1-touched file (verified file-by-file)
```

No test file was edited. No test suite was run.

## Manual verification checklist

The owner should perform these in the browser. No automated test runs.

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
   receipts.
5. `/admin/inventory` → **Adjustments** → pick a product and enter a count **above** the system
   quantity, leaving unit cost blank → save. The created IN layer's unit cost equals that product's
   `avgStockPrice` (not `avgPrice`), and the product's `avgPrice` is **unchanged** by the
   adjustment.

**RC-4 — references, not ids**
6. `/admin/inventory` → **Movement ledger**. Every row's *Reference* cell shows a human reference
   (`SAL-…`, `ORD-…`, `REP-…`, `RET-…`, `FAC-…`, `AJU-…` or a product name) — no row shows a
   truncated uuid. Complete a POS sale and a repair beforehand so both types are present.
7. `/admin/inventory` → **Reservations** tab. `holderReference` shows `ORD-…` / `REP-…`, not a
   truncated uuid.

**Supplier paid date**
8. `/admin/supplier-invoices/:id` → record a payment. Verify via
   `SELECT reference, "paidAmount", "paidDate" FROM "SupplierInvoice";` that `paidDate` updated.
9. An invoice that has never been paid has `paidDate = NULL`.

**Created dates**
10. `SELECT reference, "createdAt", "soldAt" FROM "Sale" LIMIT 5;` — every row carries `createdAt`.
11. The admin clients list DTO carries `createdAt` for every client.

**Repair model swap — expect the regression**
12. `SELECT origin FROM "Sale";` must error (*column does not exist*), and
    `SELECT "invoiceId" FROM "Repair";` must succeed.
13. Take a repair to `PICKED_UP`. **Expect nothing else to happen**: no sale row, no invoice, no
    change to the client's credit/`totalPaid`/`totalSold`. Closed by **S13**.
14. `/admin/statistics` still loads without crashing; repair revenue is absent (closed by **S14**).

**Nothing else moved**
15. `/admin/pos` — complete a sale for a POS client. Credit, `totalPaid` and `totalSold` all move
    exactly as before this set, and an invoice is issued.
16. `/admin/supplier-invoices` and `/admin/invoices` both load, and the outgoing-invoice detail
    view still shows its current-avg-cost hint per line.
17. `/invoices` (client) and `/staff/invoices` both load without crashing (the `InvoiceSource`
    exhaustiveness fix).
