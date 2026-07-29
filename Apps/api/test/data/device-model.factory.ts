import { faker } from '@faker-js/faker';
import { CreateModelSchema, type CreateModelCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const createModelPayload = (overrides: Partial<CreateModelCommand> = {}): CreateModelCommand =>
  CreateModelSchema.parse({
    brandId: faker.string.uuid(),
    name: `${faker.commerce.productName()} ${faker.string.alphanumeric(6)}`,
    ...overrides,
  });

export type SeedDeviceModelOptions = {
  brandId: string;
  name?: string;
  slug?: string;
  isEnabled?: boolean;
  familyIds?: string[];
};

export const seedDeviceModel = async (options: SeedDeviceModelOptions) => {
  const suffix = faker.string.alphanumeric(6).toLowerCase();
  const name = options.name ?? `${faker.commerce.productName()} ${suffix}`;
  const model = await prisma.deviceModel.create({
    data: {
      brandId: options.brandId,
      name,
      slug: options.slug ?? `${faker.helpers.slugify(name).toLowerCase()}-${suffix}`,
      isEnabled: options.isEnabled ?? true,
    },
  });

  if (options.familyIds?.length) {
    await prisma.deviceModelFamily.createMany({
      data: options.familyIds.map((familyId) => ({ deviceModelId: model.id, familyId })),
    });
  }

  return model;
};
