import { faker } from '@faker-js/faker';
import { CreateSupplierInvoiceSchema, type CreateSupplierInvoiceCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

// CreateSupplierInvoiceSchema's refine() enforces amountOnly XOR lines — defaults to the
// lines branch (a single line) unless the caller explicitly opts into amountOnly.
export const createSupplierInvoicePayload = (
  overrides: Partial<CreateSupplierInvoiceCommand> = {},
): CreateSupplierInvoiceCommand => {
  const usesAmountOnly = overrides.amountOnly !== undefined;
  return CreateSupplierInvoiceSchema.parse({
    supplierId: faker.string.uuid(),
    invoiceDate: '2026-01-15',
    ...(usesAmountOnly ? {} : { lines: [{ productId: faker.string.uuid(), quantity: 10, unitCost: 100 }] }),
    ...overrides,
  });
};

export type SeedSupplierInvoiceLineOptions = {
  productId: string;
  productNameSnapshot?: string;
  quantity?: number;
  unitCost?: number;
  landedUnitCost?: number;
  lineTotal?: number;
  serialNumbers?: string;
};

export type SeedSupplierInvoiceOptions = {
  supplierId: string;
  staffId: string;
  reference?: string;
  supplierReference?: string;
  status?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  invoiceDate?: Date;
  dueDate?: Date;
  shippingCost?: number;
  amountOnly?: number;
  totalAmount?: number;
  paidAmount?: number;
  previousCredit?: number;
  newCredit?: number;
  note?: string;
  lines?: SeedSupplierInvoiceLineOptions[];
};

// Codes/refs are random strings here — real allocation is SequenceService's own job under test.
export const seedSupplierInvoice = async (options: SeedSupplierInvoiceOptions) => {
  const suffix = faker.string.alphanumeric(8).toUpperCase();
  return prisma.supplierInvoice.create({
    data: {
      reference: options.reference ?? `SUP-${suffix}`,
      ...(options.supplierReference != null ? { supplierReference: options.supplierReference } : {}),
      supplierId: options.supplierId,
      status: options.status ?? 'DRAFT',
      invoiceDate: options.invoiceDate ?? new Date(),
      ...(options.dueDate != null ? { dueDate: options.dueDate } : {}),
      shippingCost: options.shippingCost ?? 0,
      ...(options.amountOnly != null ? { amountOnly: options.amountOnly } : {}),
      totalAmount: options.totalAmount ?? 0,
      paidAmount: options.paidAmount ?? 0,
      ...(options.previousCredit != null ? { previousCredit: options.previousCredit } : {}),
      ...(options.newCredit != null ? { newCredit: options.newCredit } : {}),
      ...(options.note != null ? { note: options.note } : {}),
      staffId: options.staffId,
      ...(options.lines?.length
        ? {
            lines: {
              create: options.lines.map((line) => ({
                productId: line.productId,
                productNameSnapshot: line.productNameSnapshot ?? 'Test Product',
                quantity: line.quantity ?? 1,
                unitCost: line.unitCost ?? 100,
                landedUnitCost: line.landedUnitCost ?? line.unitCost ?? 100,
                lineTotal: line.lineTotal ?? (line.quantity ?? 1) * (line.unitCost ?? 100),
                ...(line.serialNumbers != null ? { serialNumbers: line.serialNumbers } : {}),
              })),
            },
          }
        : {}),
    },
    include: { lines: true },
  });
};
