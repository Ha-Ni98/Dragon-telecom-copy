import { faker } from '@faker-js/faker';
import { CreateSupplierPaymentSchema, type CreateSupplierPaymentCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const createSupplierPaymentPayload = (
  overrides: Partial<CreateSupplierPaymentCommand> = {},
): CreateSupplierPaymentCommand =>
  CreateSupplierPaymentSchema.parse({
    supplierId: faker.string.uuid(),
    amount: 500,
    ...overrides,
  });

export type SeedSupplierPaymentOptions = {
  supplierId: string;
  staffId: string;
  supplierInvoiceId?: string;
  reference?: string;
  amount?: number;
  previousCredit?: number;
  newCredit?: number;
  paidAt?: Date;
};

// Codes/refs are random strings here — real allocation is SequenceService's own job under test.
export const seedSupplierPayment = async (options: SeedSupplierPaymentOptions) => {
  const suffix = faker.string.alphanumeric(8).toUpperCase();
  const previousCredit = options.previousCredit ?? 0;
  const amount = options.amount ?? 500;
  return prisma.supplierPayment.create({
    data: {
      reference: options.reference ?? `PAY-${suffix}`,
      supplierId: options.supplierId,
      ...(options.supplierInvoiceId != null ? { supplierInvoiceId: options.supplierInvoiceId } : {}),
      amount,
      previousCredit,
      newCredit: options.newCredit ?? previousCredit - amount,
      ...(options.paidAt != null ? { paidAt: options.paidAt } : {}),
      staffId: options.staffId,
    },
  });
};
