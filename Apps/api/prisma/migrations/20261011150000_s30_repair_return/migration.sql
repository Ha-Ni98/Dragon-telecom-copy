-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'REPAIR_CANCELLED';
ALTER TYPE "MovementType" ADD VALUE 'REPAIR_RETURN';

-- AlterEnum
ALTER TYPE "RepairStatus" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "ClientPayment" ADD COLUMN     "reversalOfId" TEXT;

-- AlterTable
ALTER TABLE "Repair" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "returnedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RepairPart" ADD COLUMN     "consumptionMovementId" TEXT,
ADD COLUMN     "restockedOnReturn" BOOLEAN;

-- CreateIndex
CREATE INDEX "ClientPayment_reversalOfId_idx" ON "ClientPayment"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairPart_consumptionMovementId_key" ON "RepairPart"("consumptionMovementId");

-- AddForeignKey
ALTER TABLE "RepairPart" ADD CONSTRAINT "RepairPart_consumptionMovementId_fkey" FOREIGN KEY ("consumptionMovementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPayment" ADD CONSTRAINT "ClientPayment_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "ClientPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

