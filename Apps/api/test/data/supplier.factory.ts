import { faker } from '@faker-js/faker';
import { CreateSupplierSchema, type CreateSupplierCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const createSupplierPayload = (overrides: Partial<CreateSupplierCommand> = {}): CreateSupplierCommand =>
  CreateSupplierSchema.parse({
    name: `${faker.company.name()} ${faker.string.alphanumeric(6)}`,
    ...overrides,
  });

export type SeedSupplierOptions = {
  code?: string;
  name?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  location?: string;
  credit?: number;
  totalPaid?: number;
  totalInvoiced?: number;
  isEnabled?: boolean;
};

// Codes/refs are random strings here, not sequence-allocated — real allocation is
// SequenceService's own job under test (mirrors the plan §A note for these factories).
export const seedSupplier = async (options: SeedSupplierOptions = {}) => {
  const suffix = faker.string.alphanumeric(8).toUpperCase();
  return prisma.supplier.create({
    data: {
      code: options.code ?? `FRN-${suffix}`,
      name: options.name ?? `${faker.company.name()} ${suffix}`,
      ...(options.contactName != null ? { contactName: options.contactName } : {}),
      ...(options.phone != null ? { phone: options.phone } : {}),
      ...(options.email != null ? { email: options.email } : {}),
      ...(options.location != null ? { location: options.location } : {}),
      credit: options.credit ?? 0,
      totalPaid: options.totalPaid ?? 0,
      totalInvoiced: options.totalInvoiced ?? 0,
      isEnabled: options.isEnabled ?? true,
    },
  });
};
