import { faker } from '@faker-js/faker';
import { prisma } from '../../src/common/db/prisma';

export type SeedPosClientOptions = {
  code?: string;
  name?: string;
  categoryId?: string;
  isEnabled?: boolean;
};

export const seedPosClient = async (options: SeedPosClientOptions = {}) =>
  prisma.posClient.create({
    data: {
      code: options.code ?? `POS-${faker.string.alphanumeric(8).toUpperCase()}`,
      name: options.name ?? faker.company.name(),
      ...(options.categoryId != null ? { categoryId: options.categoryId } : {}),
      isEnabled: options.isEnabled ?? true,
    },
  });
