import { faker } from '@faker-js/faker';
import { CreateClientPaymentSchema, type CreateClientPaymentCommand } from '@dragon-telecom/contract';

export const createClientPaymentPayload = (
  overrides: Partial<CreateClientPaymentCommand> = {},
): CreateClientPaymentCommand =>
  CreateClientPaymentSchema.parse({
    posClientId: faker.string.uuid(),
    amount: 500,
    ...overrides,
  });
