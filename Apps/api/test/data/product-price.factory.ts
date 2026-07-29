import { prisma } from '../../src/common/db/prisma';

export type SeedProductPriceOptions = {
  productId: string;
  clientCategoryId: string;
  price?: number;
};

export const seedProductPrice = async (options: SeedProductPriceOptions) =>
  prisma.productPrice.create({
    data: {
      productId: options.productId,
      clientCategoryId: options.clientCategoryId,
      price: options.price ?? 1500,
    },
  });
