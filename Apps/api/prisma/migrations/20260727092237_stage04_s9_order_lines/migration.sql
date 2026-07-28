/*
  Warnings:

  - You are about to drop the column `costOfGoods` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `productNameSnapshot` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `profit` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedPrice` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `serialNumbers` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `Order` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLED_BY_CLIENT';

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_productId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "costOfGoods",
DROP COLUMN "productId",
DROP COLUMN "productNameSnapshot",
DROP COLUMN "profit",
DROP COLUMN "quantity",
DROP COLUMN "resolvedPrice",
DROP COLUMN "serialNumbers",
DROP COLUMN "unitPrice",
ADD COLUMN     "totalCost" DECIMAL(12,2),
ADD COLUMN     "totalProfit" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "resolvedPrice" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "costOfGoods" DECIMAL(12,2),
    "profit" DECIMAL(12,2),
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "serialNumbers" TEXT,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderLine_productId_idx" ON "OrderLine"("productId");

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
