import { faker } from '@faker-js/faker';
import { ClientActivitySchema, ClientActivityType, type ClientActivityCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const clientActivityPayload = (overrides: Partial<ClientActivityCommand> = {}): ClientActivityCommand =>
  ClientActivitySchema.parse({
    type: ClientActivityType.PRODUCT_VIEW,
    durationSeconds: 30,
    ...overrides,
  });

// The contract's own `.refine()` rejects this combination (durationSeconds is invalid on
// SEARCH — spec BL 2 / Test Scenarios: "SEARCH + duration -> 400"). Deliberately NOT parsed
// through ClientActivitySchema (that would throw here instead of at the endpoint under test).
export const invalidSearchWithDurationPayload = (): Record<string, unknown> => ({
  type: ClientActivityType.SEARCH,
  query: faker.commerce.productName(),
  durationSeconds: 10,
});

export type SeedClientActivityOptions = {
  clientId: string;
  type?: ClientActivityCommand['type'];
  query?: string;
  productId?: string;
  durationSeconds?: number;
};

export const seedClientActivity = async (options: SeedClientActivityOptions) =>
  prisma.clientActivityLog.create({
    data: {
      clientId: options.clientId,
      type: options.type ?? ClientActivityType.PRODUCT_VIEW,
      ...(options.query != null ? { query: options.query } : {}),
      ...(options.productId != null ? { productId: options.productId } : {}),
      ...(options.durationSeconds != null ? { durationSeconds: options.durationSeconds } : {}),
    },
  });
