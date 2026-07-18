import { faker } from '@faker-js/faker';
import { AddRepairPartSchema, type AddRepairPartCommand } from '@dragon-telecom/contract';

export const makeRepairPart = (overrides: Partial<AddRepairPartCommand> = {}): AddRepairPartCommand =>
  AddRepairPartSchema.parse({
    productId: faker.string.uuid(),
    quantity: 1,
    unitPrice: 100,
    ...overrides,
  });
