import { faker } from '@faker-js/faker';
import { Prisma } from '@prisma/client';
import { OrderStatus, OrderType } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';
import type { OrderRow } from '../../src/modules/orders/orders.mapper';

const DEFAULT_PLACED_AT = new Date('2026-01-01T00:00:00.000Z');

// Plain OrderRow builder — reused across the mapper spec (Sprint 1) and the service spec
// (Sprint 2, mocking prisma.order.findUnique/update). Kept in test/data (unlike sales'
// buildSaleRow, duplicated per-spec-file) since both layers here need the identical joined
// shape (order + wilaya + commune), per the sprint plan.
export const makeOrder = (overrides: Partial<OrderRow> = {}): OrderRow => {
  const suffix = faker.string.alphanumeric(8).toUpperCase();
  return {
    id: faker.string.uuid(),
    reference: `ORD-${suffix}`,
    clientId: null,
    status: OrderStatus.PENDING,
    orderType: OrderType.PICKUP,
    contactName: faker.person.fullName(),
    contactPhone: faker.string.numeric(10),
    wilayaId: null,
    communeId: null,
    address: null,
    deliveryCompany: null,
    trackingNumber: null,
    productId: faker.string.uuid(),
    productNameSnapshot: faker.commerce.productName(),
    quantity: 1,
    resolvedPrice: new Prisma.Decimal(1000),
    unitPrice: new Prisma.Decimal(1000),
    serialNumbers: null,
    subtotal: new Prisma.Decimal(1000),
    deliveryFee: new Prisma.Decimal(0),
    totalAmount: new Prisma.Decimal(1000),
    paidAmount: new Prisma.Decimal(0),
    costOfGoods: null,
    profit: null,
    placedAt: DEFAULT_PLACED_AT,
    confirmedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    confirmedByStaffId: null,
    cancellationReason: null,
    createdAt: DEFAULT_PLACED_AT,
    updatedAt: DEFAULT_PLACED_AT,
    wilaya: null,
    commune: null,
    ...overrides,
  };
};

export type SeedOrderOptions = {
  productId: string;
  clientId?: string | null;
  status?: OrderStatus;
  orderType?: OrderType;
  reference?: string;
  contactName?: string;
  contactPhone?: string;
  wilayaId?: string;
  communeId?: string;
  address?: string;
  deliveryCompany?: string;
  trackingNumber?: string;
  productNameSnapshot?: string;
  quantity?: number;
  resolvedPrice?: number;
  unitPrice?: number;
  serialNumbers?: string;
  subtotal?: number;
  deliveryFee?: number;
  totalAmount?: number;
  paidAmount?: number;
  costOfGoods?: number;
  profit?: number;
  placedAt?: Date;
  confirmedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  confirmedByStaffId?: string;
  cancellationReason?: string;
};

// Real DB row — for later integration sprints (place→confirm→status flows) and any service
// spec that prefers a genuinely persisted row over the plain makeOrder() builder.
export const seedOrder = async (options: SeedOrderOptions) => {
  const suffix = faker.string.alphanumeric(8).toUpperCase();
  const resolvedPrice = options.resolvedPrice ?? 1000;
  const unitPrice = options.unitPrice ?? resolvedPrice;
  const quantity = options.quantity ?? 1;
  const deliveryFee = options.deliveryFee ?? 0;
  const subtotal = options.subtotal ?? resolvedPrice * quantity;
  const totalAmount = options.totalAmount ?? subtotal + deliveryFee;

  return prisma.order.create({
    data: {
      reference: options.reference ?? `ORD-${suffix}`,
      clientId: options.clientId ?? null,
      status: options.status ?? OrderStatus.PENDING,
      orderType: options.orderType ?? OrderType.PICKUP,
      contactName: options.contactName ?? faker.person.fullName(),
      contactPhone: options.contactPhone ?? faker.string.numeric(10),
      ...(options.wilayaId != null ? { wilayaId: options.wilayaId } : {}),
      ...(options.communeId != null ? { communeId: options.communeId } : {}),
      ...(options.address != null ? { address: options.address } : {}),
      ...(options.deliveryCompany != null ? { deliveryCompany: options.deliveryCompany } : {}),
      ...(options.trackingNumber != null ? { trackingNumber: options.trackingNumber } : {}),
      productId: options.productId,
      productNameSnapshot: options.productNameSnapshot ?? 'Test Product',
      quantity,
      resolvedPrice,
      unitPrice,
      ...(options.serialNumbers != null ? { serialNumbers: options.serialNumbers } : {}),
      subtotal,
      deliveryFee,
      totalAmount,
      paidAmount: options.paidAmount ?? 0,
      ...(options.costOfGoods != null ? { costOfGoods: options.costOfGoods } : {}),
      ...(options.profit != null ? { profit: options.profit } : {}),
      ...(options.placedAt != null ? { placedAt: options.placedAt } : {}),
      ...(options.confirmedAt != null ? { confirmedAt: options.confirmedAt } : {}),
      ...(options.deliveredAt != null ? { deliveredAt: options.deliveredAt } : {}),
      ...(options.cancelledAt != null ? { cancelledAt: options.cancelledAt } : {}),
      ...(options.confirmedByStaffId != null ? { confirmedByStaffId: options.confirmedByStaffId } : {}),
      ...(options.cancellationReason != null ? { cancellationReason: options.cancellationReason } : {}),
    },
    include: { wilaya: true, commune: true },
  });
};
