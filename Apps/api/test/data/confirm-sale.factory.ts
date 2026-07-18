import { ConfirmSaleSchema, type ConfirmSaleCommand } from '@dragon-telecom/contract';

export const createConfirmSalePayload = (overrides: Partial<ConfirmSaleCommand> = {}): ConfirmSaleCommand =>
  ConfirmSaleSchema.parse({
    paidAmount: 100,
    ...overrides,
  });
