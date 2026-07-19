import { faker } from '@faker-js/faker';
import {
  SaleDraftSchema,
  UpdateSaleDraftSchema,
  type SaleDraftCommand,
  type UpdateSaleDraftCommand,
} from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';

export const createSaleDraftPayload = (overrides: Partial<SaleDraftCommand> = {}): SaleDraftCommand =>
  SaleDraftSchema.parse({
    lines: [{ productId: faker.string.uuid(), quantity: 1, unitPrice: 100 }],
    ...overrides,
  });

export const createUpdateSaleDraftPayload = (
  overrides: Partial<UpdateSaleDraftCommand> = {},
): UpdateSaleDraftCommand => UpdateSaleDraftSchema.parse({ ...overrides });

export type SeedSaleLineOptions = {
  productId: string;
  productNameSnapshot?: string;
  quantity?: number;
  resolvedPrice?: number;
  unitPrice?: number;
  costOfGoods?: number;
  profit?: number;
  lineTotal?: number;
  serialNumbers?: string;
};

export type SeedSaleOptions = {
  staffId: string;
  posClientId?: string;
  reference?: string;
  origin?: 'POS' | 'REPAIR';
  status?: 'DRAFT' | 'COMPLETED' | 'RETURNED' | 'PARTIALLY_RETURNED' | 'CANCELLED';
  subtotal?: number;
  discountAmount?: number;
  totalAmount?: number;
  paidAmount?: number;
  previousCredit?: number;
  newCredit?: number;
  totalCost?: number;
  totalProfit?: number;
  soldAt?: Date;
  note?: string;
  lines?: SeedSaleLineOptions[];
};

// Codes/refs are random strings here — real allocation is SequenceService's own job under test.
export const seedSale = async (options: SeedSaleOptions) => {
  const suffix = faker.string.alphanumeric(8).toUpperCase();
  return prisma.sale.create({
    data: {
      reference: options.reference ?? `SAL-${suffix}`,
      ...(options.posClientId != null ? { posClientId: options.posClientId } : {}),
      origin: options.origin ?? 'POS',
      status: options.status ?? 'DRAFT',
      subtotal: options.subtotal ?? 0,
      discountAmount: options.discountAmount ?? 0,
      totalAmount: options.totalAmount ?? 0,
      paidAmount: options.paidAmount ?? 0,
      ...(options.previousCredit != null ? { previousCredit: options.previousCredit } : {}),
      ...(options.newCredit != null ? { newCredit: options.newCredit } : {}),
      totalCost: options.totalCost ?? 0,
      totalProfit: options.totalProfit ?? 0,
      ...(options.soldAt != null ? { soldAt: options.soldAt } : {}),
      staffId: options.staffId,
      ...(options.note != null ? { note: options.note } : {}),
      ...(options.lines?.length
        ? {
            lines: {
              create: options.lines.map((line) => ({
                productId: line.productId,
                productNameSnapshot: line.productNameSnapshot ?? 'Test Product',
                quantity: line.quantity ?? 1,
                resolvedPrice: line.resolvedPrice ?? line.unitPrice ?? 100,
                unitPrice: line.unitPrice ?? 100,
                costOfGoods: line.costOfGoods ?? 0,
                profit: line.profit ?? 0,
                lineTotal: line.lineTotal ?? (line.quantity ?? 1) * (line.unitPrice ?? 100),
                ...(line.serialNumbers != null ? { serialNumbers: line.serialNumbers } : {}),
              })),
            },
          }
        : {}),
    },
    include: { lines: true },
  });
};
