import { faker } from '@faker-js/faker';
import type { MovementDirection, MovementType } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

// No HTTP command creates a StockMovement directly (spec: movements are only written by the
// injected engine / the internal adjustment path) — this is a persistence-only factory, unlike
// the command+seed pairs elsewhere.
export type SeedStockMovementOptions = {
  productId: string;
  staffId: string;
  direction?: MovementDirection;
  type?: MovementType;
  quantity?: number;
  unitCost?: number;
  remainingQuantity?: number | null;
  costOfGoods?: number;
  profit?: number;
  balanceAfter?: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
};

// Defaults to a live IN layer (an un-drained FIFO layer, remainingQuantity = quantity). Override
// direction/type for an OUT row (SALE/ORDER_OUT/REPAIR_CONSUMPTION/ADJUSTMENT_OUT) or a PENDING
// row (PENDING_ORDER/PENDING_REPAIR/PENDING_RELEASE).
export const seedStockMovement = (options: SeedStockMovementOptions) => {
  const direction = options.direction ?? 'IN';
  const quantity = options.quantity ?? 10;
  return prisma.stockMovement.create({
    data: {
      productId: options.productId,
      direction,
      type: options.type ?? 'SUPPLIER_INVOICE',
      quantity,
      ...(options.unitCost != null ? { unitCost: options.unitCost } : {}),
      ...(direction === 'IN'
        ? { remainingQuantity: options.remainingQuantity ?? quantity }
        : options.remainingQuantity !== undefined
          ? { remainingQuantity: options.remainingQuantity }
          : {}),
      ...(options.costOfGoods != null ? { costOfGoods: options.costOfGoods } : {}),
      ...(options.profit != null ? { profit: options.profit } : {}),
      balanceAfter: options.balanceAfter ?? quantity,
      referenceType: options.referenceType ?? 'SUPPLIER_INVOICE',
      referenceId: options.referenceId ?? faker.string.uuid(),
      ...(options.reason != null ? { reason: options.reason } : {}),
      staffId: options.staffId,
    },
  });
};
