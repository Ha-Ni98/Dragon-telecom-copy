import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { OrderStatus, OrderType, PlaceOrderSchema, ReturnOrderSchema } from '@dragon-telecom/contract';
import { OrdersMapper } from '../../../../src/modules/orders/orders.mapper';
import { makeOrder } from '../../../data/order.factory';
import { makePlaceOrderCommand } from '../../../data/place-order.factory';

const now = new Date('2026-01-02T00:00:00.000Z');
const placedAt = new Date('2026-01-01T00:00:00.000Z'); // exactly 24h before `now`
const WILAYA_ID = '11111111-1111-4111-8111-111111111111';
const COMMUNE_ID = '22222222-2222-4222-8222-222222222222';

describe('OrdersMapper.toOrderDto', () => {
  it('staff mapping (includeMargins:false) omits costOfGoods/profit', () => {
    const order = makeOrder({ costOfGoods: new Prisma.Decimal(400), profit: new Prisma.Decimal(200) });
    const dto = OrdersMapper.toOrderDto(order, { includeMargins: false, now });

    expect(dto).not.toHaveProperty('costOfGoods');
    expect(dto).not.toHaveProperty('profit');
  });

  it('admin mapping (includeMargins:true) keeps costOfGoods/profit when stored', () => {
    const order = makeOrder({ costOfGoods: new Prisma.Decimal(400), profit: new Prisma.Decimal(200) });
    const dto = OrdersMapper.toOrderDto(order, { includeMargins: true, now });

    expect(dto.costOfGoods).toBe(400);
    expect(dto.profit).toBe(200);
  });

  it('omits costOfGoods/profit for admin too when the order is not yet confirmed (columns null)', () => {
    const order = makeOrder({ costOfGoods: null, profit: null });
    const dto = OrdersMapper.toOrderDto(order, { includeMargins: true, now });

    expect(dto).not.toHaveProperty('costOfGoods');
    expect(dto).not.toHaveProperty('profit');
  });

  it('PICKUP orders omit wilaya/commune/address and carry a zero delivery fee', () => {
    const order = makeOrder({ orderType: OrderType.PICKUP, wilaya: null, commune: null, address: null });
    const dto = OrdersMapper.toOrderDto(order, { includeMargins: false, now });

    expect(dto).not.toHaveProperty('wilaya');
    expect(dto).not.toHaveProperty('commune');
    expect(dto).not.toHaveProperty('address');
    expect(dto.deliveryFee).toBe(0);
  });

  it('delivery orders surface wilaya/commune/address from the joined row', () => {
    const order = makeOrder({
      orderType: OrderType.DELIVERY_HOME,
      wilayaId: WILAYA_ID,
      communeId: COMMUNE_ID,
      address: '12 Rue Test',
      wilaya: { id: WILAYA_ID, frName: 'Alger', arName: 'الجزائر' },
      commune: { id: COMMUNE_ID, frName: 'Bab El Oued', arName: 'باب الوادي' },
    });
    const dto = OrdersMapper.toOrderDto(order, { includeMargins: false, now });

    expect(dto.wilaya).toEqual({ id: WILAYA_ID, frName: 'Alger', arName: 'الجزائر' });
    expect(dto.commune).toEqual({ id: COMMUNE_ID, frName: 'Bab El Oued', arName: 'باب الوادي' });
    expect(dto.address).toBe('12 Rue Test');
  });

  it('derives ageHours from placedAt vs. the supplied `now`', () => {
    const order = makeOrder({ placedAt });
    const dto = OrdersMapper.toOrderDto(order, { includeMargins: false, now });

    expect(dto.ageHours).toBe(24);
  });

  it('canBeCancelled is true only while PENDING', () => {
    const pending = OrdersMapper.toOrderDto(makeOrder({ status: OrderStatus.PENDING }), {
      includeMargins: false,
      now,
    });
    const confirmed = OrdersMapper.toOrderDto(makeOrder({ status: OrderStatus.CONFIRMED }), {
      includeMargins: false,
      now,
    });

    expect(pending.canBeCancelled).toBe(true);
    expect(confirmed.canBeCancelled).toBe(false);
  });

  it('surfaces both resolvedPrice and unitPrice so a confirm-time price override is measurable', () => {
    const order = makeOrder({ resolvedPrice: new Prisma.Decimal(900), unitPrice: new Prisma.Decimal(1000) });
    const dto = OrdersMapper.toOrderDto(order, { includeMargins: false, now });

    expect(dto.resolvedPrice).toBe(900);
    expect(dto.unitPrice).toBe(1000);
    expect(dto.resolvedPrice).not.toBe(dto.unitPrice);
  });

  it('parses a comma-joined serialNumbers column back into an array', () => {
    const order = makeOrder({ serialNumbers: 'SN-1,SN-2' });
    const dto = OrdersMapper.toOrderDto(order, { includeMargins: false, now });

    expect(dto.serialNumbers).toEqual(['SN-1', 'SN-2']);
  });

  it('omits serialNumbers entirely when the column is null', () => {
    const dto = OrdersMapper.toOrderDto(makeOrder({ serialNumbers: null }), { includeMargins: false, now });

    expect(dto).not.toHaveProperty('serialNumbers');
  });

  it('converts Decimal money fields to plain numbers', () => {
    const order = makeOrder({
      subtotal: new Prisma.Decimal(1000),
      deliveryFee: new Prisma.Decimal(300),
      totalAmount: new Prisma.Decimal(1300),
      paidAmount: new Prisma.Decimal(1300),
    });
    const dto = OrdersMapper.toOrderDto(order, { includeMargins: false, now });

    expect(dto.subtotal).toBe(1000);
    expect(dto.deliveryFee).toBe(300);
    expect(dto.totalAmount).toBe(1300);
    expect(dto.paidAmount).toBe(1300);
  });

  it('never throws on a valid row (conformance guard)', () => {
    expect(() => OrdersMapper.toOrderDto(makeOrder(), { includeMargins: true, now })).not.toThrow();
    expect(() => OrdersMapper.toOrderDto(makeOrder(), { includeMargins: false, now })).not.toThrow();
  });
});

describe('OrdersMapper.toStatsDto', () => {
  it('maps a groupBy status roll-up onto the seven named fields', () => {
    const dto = OrdersMapper.toStatsDto({
      [OrderStatus.PENDING]: 3,
      [OrderStatus.CONFIRMED]: 1,
      [OrderStatus.COMPLETED]: 5,
    });

    expect(dto).toEqual({
      pending: 3,
      confirmed: 1,
      packaged: 0,
      inDelivery: 0,
      completed: 5,
      cancelled: 0,
      returned: 0,
    });
  });

  it('defaults every status to 0 when no counts are supplied', () => {
    const dto = OrdersMapper.toStatsDto({});

    expect(dto).toEqual({
      pending: 0,
      confirmed: 0,
      packaged: 0,
      inDelivery: 0,
      completed: 0,
      cancelled: 0,
      returned: 0,
    });
  });
});

describe('OrdersMapper.toPersistencePlace', () => {
  const ctx = { reference: 'ORD-2026-0001', productName: 'Test Product', resolvedPrice: 1000, fee: 0, clientId: null };

  it('freezes resolvedPrice and unitPrice equal at placement', () => {
    const cmd = makePlaceOrderCommand({ orderType: OrderType.PICKUP, quantity: 2 });
    const input = OrdersMapper.toPersistencePlace(cmd, ctx);

    expect(input.resolvedPrice).toBe(1000);
    expect(input.unitPrice).toBe(1000);
    expect(input.status).toBe(OrderStatus.PENDING);
    expect(input.paidAmount).toBe(0);
  });

  it('computes subtotal/totalAmount from resolvedPrice × quantity + fee', () => {
    const cmd = makePlaceOrderCommand({ orderType: OrderType.PICKUP, quantity: 3 });
    const input = OrdersMapper.toPersistencePlace(cmd, { ...ctx, resolvedPrice: 500, fee: 200 });

    expect(input.subtotal).toBe(1500);
    expect(input.totalAmount).toBe(1700);
  });

  it('omits delivery fields for a PICKUP order even if the caller supplies a fee', () => {
    const cmd = makePlaceOrderCommand({ orderType: OrderType.PICKUP });
    const input = OrdersMapper.toPersistencePlace(cmd, ctx);

    expect(input).not.toHaveProperty('wilayaId');
    expect(input).not.toHaveProperty('communeId');
    expect(input).not.toHaveProperty('address');
  });

  it('includes wilayaId/communeId/address for a delivery order', () => {
    const cmd = makePlaceOrderCommand({
      orderType: OrderType.DELIVERY_HOME,
      delivery: { wilayaId: WILAYA_ID, communeId: COMMUNE_ID, address: '12 Rue Test' },
    });
    const input = OrdersMapper.toPersistencePlace(cmd, { ...ctx, fee: 400 });

    expect(input.wilayaId).toBe(WILAYA_ID);
    expect(input.communeId).toBe(COMMUNE_ID);
    expect(input.address).toBe('12 Rue Test');
    expect(input.deliveryFee).toBe(400);
  });

  it('resolves clientId from ctx (null for guests)', () => {
    const cmd = makePlaceOrderCommand({ orderType: OrderType.PICKUP });

    const guestInput = OrdersMapper.toPersistencePlace(cmd, { ...ctx, clientId: null });
    expect(guestInput.clientId).toBeNull();

    const clientInput = OrdersMapper.toPersistencePlace(cmd, { ...ctx, clientId: 'client-1' });
    expect(clientInput.clientId).toBe('client-1');
  });
});

// Audit fix B2: `note`/return `reason` never had a persistence column (Order has neither) and
// were silently dropped by the mapper — dropped from the contract itself instead of migrating a
// column. Neither schema uses `.strict()` (that's a deliberate one-off elsewhere, clients'
// UpdateMeSchema, for a spec-mandated 400) — consistent with every other order command here,
// an unrecognized field is silently stripped by Zod's object default, not rejected.
describe('PlaceOrderSchema — note removed from the contract (audit fix B2)', () => {
  it('silently strips a `note` field instead of rejecting the request', () => {
    const parsed = PlaceOrderSchema.parse({
      productId: '11111111-1111-4111-8111-111111111111',
      quantity: 1,
      orderType: OrderType.PICKUP,
      contact: { fullName: 'Karim', phone: '0555000000' },
      note: 'this field no longer exists',
    });

    expect(parsed).not.toHaveProperty('note');
  });
});

describe('ReturnOrderSchema — reason removed from the contract (audit fix B2)', () => {
  it('silently strips a `reason` field instead of rejecting the request', () => {
    const parsed = ReturnOrderSchema.parse({
      quantity: 1,
      restock: false,
      refundAmount: 1000,
      reason: 'this field no longer exists',
    });

    expect(parsed).not.toHaveProperty('reason');
  });
});

describe('OrdersMapper.ageHours', () => {
  it('computes elapsed hours between two dates', () => {
    expect(OrdersMapper.ageHours(placedAt, now)).toBe(24);
  });
});
