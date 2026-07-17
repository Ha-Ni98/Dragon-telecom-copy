import { faker } from '@faker-js/faker';
import { CreateBrandSchema, type CreateBrandCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const createBrandPayload = (overrides: Partial<CreateBrandCommand> = {}): CreateBrandCommand =>
  CreateBrandSchema.parse({
    name: `${faker.company.name()} ${faker.string.alphanumeric(6)}`,
    ...overrides,
  });

export type SeedBrandOptions = {
  name?: string;
  slug?: string;
  logoUrl?: string;
  isEnabled?: boolean;
};

export const seedBrand = async (options: SeedBrandOptions = {}) => {
  const suffix = faker.string.alphanumeric(6).toLowerCase();
  const name = options.name ?? `${faker.company.name()} ${suffix}`;
  return prisma.brand.create({
    data: {
      name,
      slug: options.slug ?? `${faker.helpers.slugify(name).toLowerCase()}-${suffix}`,
      ...(options.logoUrl != null ? { logoUrl: options.logoUrl } : {}),
      isEnabled: options.isEnabled ?? true,
    },
  });
};
