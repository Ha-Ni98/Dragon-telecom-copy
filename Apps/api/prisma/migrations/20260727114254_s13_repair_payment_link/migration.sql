-- AlterTable
ALTER TABLE "ClientPayment" ADD COLUMN     "repairId" TEXT;

-- CreateIndex
CREATE INDEX "ClientPayment_repairId_idx" ON "ClientPayment"("repairId");

-- AddForeignKey
ALTER TABLE "ClientPayment" ADD CONSTRAINT "ClientPayment_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- S13/§0.4 — pre-S13 COMPLETED repairs already consumed their parts under the old rule and
-- would consume a second time at PICKED_UP. The database is not in production (owner-confirmed
-- draft data); repair history is discarded rather than reconciled. Stock movements already
-- written are left in place — run a stock count afterwards if quantityOnHand matters.
DELETE FROM "ClientPayment" WHERE "repairId" IS NOT NULL;
DELETE FROM "RepairStatusHistory";
DELETE FROM "RepairPart";
DELETE FROM "Repair";
