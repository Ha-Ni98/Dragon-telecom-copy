import { faker } from '@faker-js/faker';
import { CreateFamilySchema, type CreateFamilyCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const createFamilyPayload = (overrides: Partial<CreateFamilyCommand> = {}): CreateFamilyCommand =>
  CreateFamilySchema.parse({
    name: `${faker.commerce.productAdjective()} ${faker.string.alphanumeric(6)}`,
    ...overrides,
  });

export type SeedFamilyOptions = {
  name?: string;
  slug?: string;
  iconUrl?: string;
  parentId?: string;
  isUniversal?: boolean;
  isFeatured?: boolean;
  isEnabled?: boolean;
};

export const seedFamily = async (options: SeedFamilyOptions = {}) => {
  const suffix = faker.string.alphanumeric(6).toLowerCase();
  const name = options.name ?? `${faker.commerce.productAdjective()} ${suffix}`;
  return prisma.family.create({
    data: {
      name,
      slug: options.slug ?? `${faker.helpers.slugify(name).toLowerCase()}-${suffix}`,
      ...(options.iconUrl != null ? { iconUrl: options.iconUrl } : {}),
      ...(options.parentId != null ? { parentId: options.parentId } : {}),
      isUniversal: options.isUniversal ?? false,
      isFeatured: options.isFeatured ?? false,
      isEnabled: options.isEnabled ?? true,
    },
  });
};
