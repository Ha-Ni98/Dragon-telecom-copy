import { faker } from '@faker-js/faker';
import { CreateTechnicianSchema, type CreateTechnicianCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const createTechnicianPayload = (
  overrides: Partial<CreateTechnicianCommand> = {},
): CreateTechnicianCommand =>
  CreateTechnicianSchema.parse({
    name: faker.person.fullName(),
    phone: faker.phone.number(),
    ...overrides,
  });

export type SeedTechnicianOptions = { name?: string; phone?: string; isEnabled?: boolean };

export const seedTechnician = (options: SeedTechnicianOptions = {}) =>
  prisma.technician.create({
    data: {
      name: options.name ?? faker.person.fullName(),
      ...(options.phone != null ? { phone: options.phone } : {}),
      isEnabled: options.isEnabled ?? true,
    },
  });
