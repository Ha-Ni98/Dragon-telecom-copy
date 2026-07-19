import { faker } from '@faker-js/faker';
import { StaffSearchSchema, type StaffSearchCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const staffSearchPayload = (overrides: Partial<StaffSearchCommand> = {}): StaffSearchCommand =>
  StaffSearchSchema.parse({
    query: faker.commerce.productName(),
    ...overrides,
  });

export type SeedStaffSearchOptions = {
  userId: string;
  query?: string;
  matchedProductId?: string;
};

export const seedStaffSearch = async (options: SeedStaffSearchOptions) =>
  prisma.staffSearchLog.create({
    data: {
      userId: options.userId,
      query: options.query ?? faker.commerce.productName(),
      ...(options.matchedProductId != null ? { matchedProductId: options.matchedProductId } : {}),
    },
  });
