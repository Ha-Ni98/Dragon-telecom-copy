import { faker } from '@faker-js/faker';
import { CreateProductSchema, type CreateProductCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

// CreateProductSchema's refinements enforce the XOR pairs and the qty/pricing coupling —
// override `initialQuantity` (and `familyId`/`brandId`) explicitly to steer which branch is
// exercised. Defaults to a stocked, priceless-until-set product (qty > 0, cost present, no
// guest/default/category prices) so the happy path parses without extra overrides.
export const createProductPayload = (overrides: Partial<CreateProductCommand> = {}): CreateProductCommand => {
  const initialQuantity = overrides.initialQuantity ?? 10;
  return CreateProductSchema.parse({
    name: `${faker.commerce.productName()} ${faker.string.alphanumeric(6)}`,
    familyId: faker.string.uuid(),
    brandId: faker.string.uuid(),
    initialQuantity,
    ...(initialQuantity > 0 ? { initialUnitCost: 1000 } : {}),
    ...overrides,
  });
};

export type SeedProductOptions = {
  familyId: string;
  brandId: string;
  deviceModelId?: string;
  sku?: string;
  barcode?: string;
  name?: string;
  description?: string;
  guestPrice?: number | null;
  defaultSalePrice?: number;
  averageCost?: number;
  quantityOnHand?: number;
  quantityReserved?: number;
  reorderThreshold?: number;
  isPublished?: boolean;
  isEnabled?: boolean;
};

export const seedProduct = async (options: SeedProductOptions) => {
  const suffix = faker.string.alphanumeric(8).toUpperCase();
  return prisma.product.create({
    data: {
      sku: options.sku ?? `SKU-${suffix}`,
      ...(options.barcode != null ? { barcode: options.barcode } : {}),
      name: options.name ?? `${faker.commerce.productName()} ${suffix}`,
      ...(options.description != null ? { description: options.description } : {}),
      familyId: options.familyId,
      brandId: options.brandId,
      ...(options.deviceModelId != null ? { deviceModelId: options.deviceModelId } : {}),
      ...(options.guestPrice !== undefined ? { guestPrice: options.guestPrice } : {}),
      ...(options.defaultSalePrice != null ? { defaultSalePrice: options.defaultSalePrice } : {}),
      averageCost: options.averageCost ?? 0,
      quantityOnHand: options.quantityOnHand ?? 0,
      quantityReserved: options.quantityReserved ?? 0,
      reorderThreshold: options.reorderThreshold ?? 0,
      isPublished: options.isPublished ?? false,
      isEnabled: options.isEnabled ?? true,
    },
    include: { brand: true, family: true, deviceModel: true, images: true },
  });
};
