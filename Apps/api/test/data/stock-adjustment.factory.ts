import { faker } from '@faker-js/faker';
import { AdjustmentReason, CreateAdjustmentSchema, type CreateAdjustmentCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const createAdjustmentPayload = (
  overrides: Partial<CreateAdjustmentCommand> = {},
): CreateAdjustmentCommand =>
  CreateAdjustmentSchema.parse({
    reason: AdjustmentReason.COUNT,
    lines: [{ productId: faker.string.uuid(), countedQuantity: faker.number.int({ min: 0, max: 100 }) }],
    ...overrides,
  });

export type SeedStockAdjustmentLine = {
  productId: string;
  countedQuantity: number;
  previousQuantity: number;
  delta: number;
  unitCost?: number;
};

export type SeedStockAdjustmentOptions = {
  reference?: string;
  reason?: AdjustmentReason;
  note?: string;
  staffId: string;
  lines?: SeedStockAdjustmentLine[];
};

export const seedStockAdjustment = (options: SeedStockAdjustmentOptions) => {
  const suffix = faker.string.alphanumeric(8).toUpperCase();
  return prisma.stockAdjustment.create({
    data: {
      reference: options.reference ?? `ADJ-${suffix}`,
      reason: options.reason ?? AdjustmentReason.COUNT,
      ...(options.note != null ? { note: options.note } : {}),
      staffId: options.staffId,
      lines: {
        create: (options.lines ?? []).map((line) => ({
          productId: line.productId,
          countedQuantity: line.countedQuantity,
          previousQuantity: line.previousQuantity,
          delta: line.delta,
          ...(line.unitCost != null ? { unitCost: line.unitCost } : {}),
        })),
      },
    },
    include: { lines: true },
  });
};
