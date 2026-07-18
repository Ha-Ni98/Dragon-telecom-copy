import { faker } from '@faker-js/faker';
import { CreateReturnSchema, ReturnType, type CreateReturnCommand } from '@dragon-telecom/contract';

export const createReturnPayload = (overrides: Partial<CreateReturnCommand> = {}): CreateReturnCommand =>
  CreateReturnSchema.parse({
    saleId: faker.string.uuid(),
    type: ReturnType.REFUND,
    lines: [{ saleLineId: faker.string.uuid(), quantity: 1, restock: true, refundAmount: 100 }],
    ...overrides,
  });
