import type { Prisma } from '@prisma/client';
import type { IInventoryPort } from './catalog.interface';

// Stand-in for the not-yet-built inventory module (plan §7.1) — satisfies `IInventoryPort` so
// `createProduct`'s injected call has something real to run against. A true implementation
// would write a `StockMovement` row (FIFO layer, `staffId`-attributed); that's not possible here
// since `addLayer`'s signature carries no acting-staff identity, and building real FIFO/staff
// attribution is the inventory module's own job, not catalog's. This stub instead applies the
// same net effect directly to the columns inventory owns (`quantityOnHand`/`avgStockPrice`) so
// the product created here is materially correct end-to-end. Swap this file's export for the
// inventory module's real composition-root singleton in one line once it exists.
export class InventoryPortStub implements IInventoryPort {
  async addLayer(
    tx: Prisma.TransactionClient,
    input: { productId: string; quantity: number; unitCost: number },
  ): Promise<void> {
    await tx.product.update({
      where: { id: input.productId },
      data: {
        quantityOnHand: { increment: input.quantity },
        avgStockPrice: input.unitCost,
      },
    });
  }
}
