-- Stage-04 S1: dual average costs, repair invoicing model, supplier paid date.
-- Hand-edited from Prisma's raw diff (plan-S01 Action 3): the raw diff DROPs+ADDs
-- Product.averageCost, which would zero every product's average cost. This version RENAMEs
-- it instead, so existing values are preserved, and backfills the new avgPrice/paidDate
-- columns from ledger data already in the database.

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
