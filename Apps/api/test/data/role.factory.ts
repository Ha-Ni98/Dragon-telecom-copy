import { faker } from '@faker-js/faker';
import { CreateRoleSchema, type CreateRoleCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const createRolePayload = (overrides: Partial<CreateRoleCommand> = {}): CreateRoleCommand =>
  CreateRoleSchema.parse({
    code: faker.string.alphanumeric({ length: 8, casing: 'upper' }),
    name: faker.commerce.department(),
    ...overrides,
  });

export type SeedRoleOptions = {
  code?: string;
  name?: string;
  description?: string;
  isEnabled?: boolean;
  pageKeys?: string[];
};

// Persists a Role, optionally assigning RolePage rows for the given page keys (must already
// exist — see page.factory.ts's seedPages()).
export const seedRole = async (options: SeedRoleOptions = {}) => {
  const role = await prisma.role.create({
    data: {
      code: options.code ?? faker.string.alphanumeric({ length: 8, casing: 'upper' }),
      name: options.name ?? faker.commerce.department(),
      ...(options.description != null ? { description: options.description } : {}),
      isEnabled: options.isEnabled ?? true,
    },
  });

  if (options.pageKeys?.length) {
    const pages = await prisma.page.findMany({ where: { key: { in: options.pageKeys } } });
    await prisma.rolePage.createMany({
      data: pages.map((page) => ({ roleId: role.id, pageId: page.id })),
    });
  }

  return role;
};
