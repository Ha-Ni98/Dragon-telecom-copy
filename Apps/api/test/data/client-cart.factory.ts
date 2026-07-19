import { prisma } from '../../src/common/db/prisma';

export type SeedClientCartItemOptions = {
  addedAt?: Date;
};

// ClientCart has no CreateXxxCommand counterpart (AddCartItemCommand only carries productId —
// clientId comes from the authenticated viewer, not the body) — persistence-only, like
// stock-movement.factory.ts.
export const seedClientCartItem = (clientId: string, productId: string, options: SeedClientCartItemOptions = {}) =>
  prisma.clientCart.create({
    data: {
      clientId,
      productId,
      ...(options.addedAt != null ? { addedAt: options.addedAt } : {}),
    },
  });
