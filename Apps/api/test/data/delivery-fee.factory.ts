import { faker } from '@faker-js/faker';
import { UpsertFeesSchema, type UpsertFeesCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const upsertFeesPayload = (overrides: Partial<UpsertFeesCommand> = {}): UpsertFeesCommand =>
  UpsertFeesSchema.parse({
    rows: [{ wilayaId: faker.string.uuid(), communeId: null, deliveryHome: 500, deliveryOffice: 300 }],
    ...overrides,
  });

export type SeedFeeOptions = {
  wilayaId: string;
  communeId?: string | null;
  deliveryHome?: number;
  deliveryOffice?: number;
};

// communeId omitted/undefined => the wilaya-level row (Prisma default null); pass a real
// commune id for a commune-level override.
export const seedFee = async (options: SeedFeeOptions) =>
  prisma.deliveryFee.create({
    data: {
      wilayaId: options.wilayaId,
      communeId: options.communeId ?? null,
      deliveryHome: options.deliveryHome ?? 500,
      deliveryOffice: options.deliveryOffice ?? 300,
    },
  });
