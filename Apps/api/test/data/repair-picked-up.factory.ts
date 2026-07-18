import { faker } from '@faker-js/faker';
import type { RepairsEvents } from '@dragon-telecom/contract';

// Not schema-validated (event payloads are plain TS types, not zod schemas) — a plain builder
// for the event sales.listener.ts consumes (plan §I.2).
export const buildRepairPickedUpEvent = (
  overrides: Partial<RepairsEvents['repair.pickedUp']> = {},
): RepairsEvents['repair.pickedUp'] => ({
  repairId: faker.string.uuid(),
  totalAmount: 100,
  paidAmount: 100,
  totalCost: 60,
  totalProfit: 40,
  labourPrice: 20,
  snapshotParts: [
    {
      productId: faker.string.uuid(),
      productName: 'Test Part',
      quantity: 1,
      unitPrice: 80,
      costOfGoods: 60,
      profit: 20,
      lineTotal: 80,
    },
  ],
  ...overrides,
});
