import { faker } from '@faker-js/faker';
import { CreateClientCategorySchema, type CreateClientCategoryCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const createClientCategoryPayload = (
  overrides: Partial<CreateClientCategoryCommand> = {},
): CreateClientCategoryCommand =>
  CreateClientCategorySchema.parse({
    name: `${faker.commerce.department()} ${faker.string.alphanumeric(6)}`,
    ...overrides,
  });

export type SeedClientCategoryOptions = {
  name?: string;
  isEnabled?: boolean;
};

export const seedClientCategory = async (options: SeedClientCategoryOptions = {}) =>
  prisma.clientCategory.create({
    data: {
      name: options.name ?? `${faker.commerce.department()} ${faker.string.alphanumeric(6)}`,
      isEnabled: options.isEnabled ?? true,
    },
  });
