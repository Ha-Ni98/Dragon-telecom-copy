import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { OrderStatus, OrderType, UserType } from '@dragon-telecom/contract';
import type { AppError } from '../../../../src/common/errors';
import { OrdersService } from '../../../../src/modules/orders/orders.service';
import type { ICatalogViewerPricingPort } from '../../../../src/modules/orders/orders.interface';
import type { IInventoryService } from '../../../../src/modules/inventory/inventory.interface';

const {
  orderFindUniqueMock,
  orderFindUniqueOrThrowMock,
  orderCreateMock,
  orderUpdateMock,
  orderFindManyMock,
  orderCountMock,
  orderGroupByMock,
  clientFindUniqueMock,
  invoiceFindUniqueMock,
  userUpsertMock,
  staffFindUniqueMock,
  stockMovementFindFirstMock,
  stockMovementConsumptionFindManyMock,
  transactionMock,
  eventBusEmitMock,
} = vi.hoisted(() => ({
  orderFindUniqueMock: vi.fn(),
  orderFindUniqueOrThrowMock: vi.fn(),
  orderCreateMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderCountMock: vi.fn(),
  orderGroupByMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
  invoiceFindUniqueMock: vi.fn(),
  userUpsertMock: vi.fn(),
  staffFindUniqueMock: vi.fn(),
  stockMovementFindFirstMock: vi.fn(),
  stockMovementConsumptionFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
  eventBusEmitMock: vi.fn(),
}));

vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));

const prismaMock = {
  order: {
    findUnique: orderFindUniqueMock,
    findUniqueOrThrow: orderFindUniqueOrThrowMock,
    create: orderCreateMock,
    update: orderUpdateMock,
    findMany: orderFindManyMock,
    count: orderCountMock,
    groupBy: orderGroupByMock,
  },
  client: { findUnique: clientFindUniqueMock },
  invoice: { findUnique: invoiceFindUniqueMock },
  user: { upsert: userUpsertMock },
  staff: { findUnique: staffFindUniqueMock },
  stockMovement: { findFirst: stockMovementFindFirstMock },
  stockMovementConsumption: { findMany: stockMovementConsumptionFindManyMock },
  $transaction: transactionMock,
};

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const SYSTEM_STAFF_ID = '44444444-4444-4444-8444-444444444444';
const CLIENT_ID = '55555555-5555-4555-8555-555555555555';
const POS_CLIENT_ID = '66666666-6666-4666-8666-666666666666';
const now = new Date('2026-01-01T00:00:00.000Z');

const buildOrderRow = (overrides: Record<string, unknown> = {}) => ({
  id: ORDER_ID,
  reference: 'ORD-2026-0001',
  clientId: null,
  status: OrderStatus.PENDING,
  orderType: OrderType.PICKUP,
  contactName: 'Karim Belkacem',
  contactPhone: '0555000000',
  wilayaId: null,
  communeId: null,
  address: null,
  deliveryCompany: null,
  trackingNumber: null,
  productId: PRODUCT_ID,
  productNameSnapshot: 'Screen Protector',
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
  placedAt: now,
  confirmedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  confirmedByStaffId: null,
  cancellationReason: null,
  createdAt: now,
  updatedAt: now,
  wilaya: null,
  commune: null,
  ...overrides,
});

describe('OrdersService', () => {
  const deliveryFeeMock = { resolve: vi.fn() };
  const inventoryMock: IInventoryService = {
    reserve: vi.fn(),
    release: vi.fn(),
    addLayer: vi.fn(),
    consumeFifo: vi.fn(),
    returnIn: vi.fn(),
    flushEvents: vi.fn(),
  };
  const sequenceMock = { nextNumber: vi.fn() };
  const catalogPricingMock: ICatalogViewerPricingPort = { getCartProducts: vi.fn() };

  const staffActor = { sub: STAFF_ID, type: UserType.STAFF, staffId: STAFF_ID };
  const adminActor = { sub: 'admin-1', type: UserType.ADMIN }; // no staffId — no Staff row for admins
  const clientActor = { sub: 'client-user-1', type: UserType.CLIENT, clientId: CLIENT_ID };

  beforeEach(() => {
    vi.resetAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    userUpsertMock.mockResolvedValue({ staff: { id: SYSTEM_STAFF_ID } });
    staffFindUniqueMock.mockResolvedValue({ id: SYSTEM_STAFF_ID });
    (catalogPricingMock.getCartProducts as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: PRODUCT_ID, name: 'Screen Protector', currentPrice: 1000, priceHidden: false },
    ]);
  });

  const service = () =>
    new OrdersService(prismaMock as never, deliveryFeeMock, inventoryMock, sequenceMock as never, catalogPricingMock);

  const expectRejection = async (promise: Promise<unknown>): Promise<AppError> => {
    try {
      await promise;
    } catch (err) {
      return err as AppError;
    }
    throw new Error('Expected promise to reject');
  };

  describe('placeOrder', () => {
    it('rejects a guest whose product has no resolvable/guest price with 403 GUEST_PRICE_HIDDEN', async () => {
      (catalogPricingMock.getCartProducts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: PRODUCT_ID, name: 'Screen Protector', priceHidden: true },
      ]);

      const err = await expectRejection(
        service().placeOrder({
          productId: PRODUCT_ID,
          quantity: 1,
          orderType: OrderType.DELIVERY_HOME,
          contact: { fullName: 'Guest', phone: '0555000000' },
          delivery: { wilayaId: 'w-1', communeId: 'c-1' },
        }),
      );

      expect(err.statusCode).toBe(403);
      expect(err.message).toBe('GUEST_PRICE_HIDDEN');
    });

    it('rejects a guest PICKUP with 400 (PICKUP requires a client token)', async () => {
      const err = await expectRejection(
        service().placeOrder({
          productId: PRODUCT_ID,
          quantity: 1,
          orderType: OrderType.PICKUP,
          contact: { fullName: 'Guest', phone: '0555000000' },
        }),
      );

      expect(err.statusCode).toBe(400);
    });

    it('rejects when the command clientId does not match the authenticated actor', async () => {
      const err = await expectRejection(
        service().placeOrder(
          {
            productId: PRODUCT_ID,
            quantity: 1,
            orderType: OrderType.PICKUP,
            clientId: 'someone-else',
            contact: { fullName: 'Karim', phone: '0555000000' },
          },
          clientActor,
        ),
      );

      expect(err.statusCode).toBe(403);
    });

    it('charges a zero delivery fee for PICKUP and never calls deliveryFee.resolve', async () => {
      orderCreateMock.mockResolvedValueOnce(buildOrderRow());
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(buildOrderRow());

      await service().placeOrder(
        {
          productId: PRODUCT_ID,
          quantity: 1,
          orderType: OrderType.PICKUP,
          contact: { fullName: 'Karim', phone: '0555000000' },
        },
        clientActor,
      );

      expect(deliveryFeeMock.resolve).not.toHaveBeenCalled();
      const createArgs = orderCreateMock.mock.calls[0]?.[0];
      expect(createArgs.data.deliveryFee).toBe(0);
    });

    it('resolves a delivery fee and reserves stock inside one transaction; freezes resolvedPrice=unitPrice', async () => {
      deliveryFeeMock.resolve.mockResolvedValueOnce(300);
      orderCreateMock.mockResolvedValueOnce(buildOrderRow({ orderType: OrderType.DELIVERY_HOME }));
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(buildOrderRow({ orderType: OrderType.DELIVERY_HOME }));

      await service().placeOrder(
        {
          productId: PRODUCT_ID,
          quantity: 2,
          orderType: OrderType.DELIVERY_HOME,
          contact: { fullName: 'Karim', phone: '0555000000' },
          delivery: { wilayaId: 'w-1', communeId: 'c-1' },
        },
        clientActor,
      );

      expect(deliveryFeeMock.resolve).toHaveBeenCalledWith('w-1', 'c-1', 'home');
      const createArgs = orderCreateMock.mock.calls[0]?.[0];
      expect(createArgs.data.resolvedPrice).toBe(createArgs.data.unitPrice);
      expect(inventoryMock.reserve).toHaveBeenCalledWith(
        prismaMock,
        PRODUCT_ID,
        2,
        expect.objectContaining({ referenceType: 'ORDER', referenceId: ORDER_ID }),
      );
      expect(inventoryMock.flushEvents).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledWith('order.placed', expect.objectContaining({ orderId: ORDER_ID }));
    });

    it('a stock conflict during reserve rolls back — no order survives the failed transaction', async () => {
      orderCreateMock.mockResolvedValueOnce(buildOrderRow());
      (inventoryMock.reserve as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('insufficient stock'));

      await expect(
        service().placeOrder(
          {
            productId: PRODUCT_ID,
            quantity: 1,
            orderType: OrderType.PICKUP,
            contact: { fullName: 'Karim', phone: '0555000000' },
          },
          clientActor,
        ),
      ).rejects.toThrow('insufficient stock');

      expect(eventBusEmitMock).not.toHaveBeenCalled();
      expect(inventoryMock.flushEvents).not.toHaveBeenCalled();
    });

    it('bootstraps and reuses a cached system staff id for guest/client placements', async () => {
      orderCreateMock.mockResolvedValue(buildOrderRow());
      orderFindUniqueOrThrowMock.mockResolvedValue(buildOrderRow());

      const cmd = {
        productId: PRODUCT_ID,
        quantity: 1,
        orderType: OrderType.PICKUP,
        contact: { fullName: 'Karim', phone: '0555000000' },
      };
      const instance = service();
      await instance.placeOrder(cmd, clientActor);
      await instance.placeOrder(cmd, clientActor);

      expect(userUpsertMock).toHaveBeenCalledTimes(1);
      expect(inventoryMock.reserve).toHaveBeenNthCalledWith(
        1,
        prismaMock,
        PRODUCT_ID,
        1,
        expect.objectContaining({ staffId: SYSTEM_STAFF_ID }),
      );
    });
  });

  describe('confirmOrder', () => {
    it('release + consumeFifo (ORDER_OUT) then stores costOfGoods/profit, freezing resolvedPrice', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ clientId: CLIENT_ID }));
      (inventoryMock.consumeFifo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        movementId: 'm1',
        costOfGoods: 400,
        profit: 600,
        consumptions: [],
      });
      clientFindUniqueMock.mockResolvedValueOnce({ posClientId: POS_CLIENT_ID });
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(
        buildOrderRow({ clientId: CLIENT_ID, status: OrderStatus.CONFIRMED, costOfGoods: new Prisma.Decimal(400), profit: new Prisma.Decimal(600) }),
      );

      await service().confirmOrder(ORDER_ID, {}, staffActor);

      expect(inventoryMock.release).toHaveBeenCalledTimes(1);
      expect(inventoryMock.consumeFifo).toHaveBeenCalledWith(
        prismaMock,
        PRODUCT_ID,
        1,
        1000,
        'ORDER_OUT',
        expect.objectContaining({ referenceType: 'ORDER', referenceId: ORDER_ID, staffId: STAFF_ID }),
      );
      const updateArgs = orderUpdateMock.mock.calls[0]?.[0];
      expect(updateArgs.data.resolvedPrice).toBeUndefined(); // never touched
      expect(updateArgs.data.costOfGoods).toBe(400);
      expect(updateArgs.data.profit).toBe(600);
      expect(inventoryMock.flushEvents).toHaveBeenCalledTimes(1);
    });

    it('double confirm: a second call short-circuits with no additional consumeFifo/event', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow());
      (inventoryMock.consumeFifo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        movementId: 'm1',
        costOfGoods: 400,
        profit: 600,
        consumptions: [],
      });
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.CONFIRMED }));

      await service().confirmOrder(ORDER_ID, {}, staffActor);
      expect(inventoryMock.consumeFifo).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledTimes(1);

      // Second call reloads the now-CONFIRMED order and returns it untouched.
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.CONFIRMED }));
      await service().confirmOrder(ORDER_ID, {}, staffActor);

      expect(inventoryMock.consumeFifo).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledTimes(1);
    });

    it('a FIFO shortfall propagates (409-style ConflictError from the engine) and the order stays PENDING — no event', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow());
      const conflict = Object.assign(new Error('insufficient stock'), { statusCode: 409 });
      (inventoryMock.consumeFifo as ReturnType<typeof vi.fn>).mockRejectedValueOnce(conflict);

      await expect(service().confirmOrder(ORDER_ID, {}, staffActor)).rejects.toMatchObject({ statusCode: 409 });

      expect(orderUpdateMock).not.toHaveBeenCalled();
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('order.confirmed carries the resolved posClientId when the order has a linked client', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ clientId: CLIENT_ID }));
      (inventoryMock.consumeFifo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        movementId: 'm1',
        costOfGoods: 400,
        profit: 600,
        consumptions: [],
      });
      clientFindUniqueMock.mockResolvedValueOnce({ posClientId: POS_CLIENT_ID });
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(buildOrderRow({ clientId: CLIENT_ID, status: OrderStatus.CONFIRMED }));

      await service().confirmOrder(ORDER_ID, {}, staffActor);

      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'order.confirmed',
        expect.objectContaining({ clientId: CLIENT_ID, posClientId: POS_CLIENT_ID }),
      );
    });

    it('order.confirmed omits posClientId for a guest order (clientId null)', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ clientId: null }));
      (inventoryMock.consumeFifo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        movementId: 'm1',
        costOfGoods: 400,
        profit: 600,
        consumptions: [],
      });
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(buildOrderRow({ clientId: null, status: OrderStatus.CONFIRMED }));

      await service().confirmOrder(ORDER_ID, {}, staffActor);

      expect(clientFindUniqueMock).not.toHaveBeenCalled();
      const payload = eventBusEmitMock.mock.calls.find((call) => call[0] === 'order.confirmed')?.[1];
      expect(payload).not.toHaveProperty('clientId');
      expect(payload).not.toHaveProperty('posClientId');
    });

    it('an admin actor (no staffId) leaves confirmedByStaffId untouched, using the system staff for the stock movement only', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow());
      (inventoryMock.consumeFifo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        movementId: 'm1',
        costOfGoods: 400,
        profit: 600,
        consumptions: [],
      });
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.CONFIRMED }));

      await service().confirmOrder(ORDER_ID, {}, adminActor);

      const updateArgs = orderUpdateMock.mock.calls[0]?.[0];
      expect(updateArgs.data).not.toHaveProperty('confirmedByStaffId');
      expect(inventoryMock.release).toHaveBeenCalledWith(
        prismaMock,
        PRODUCT_ID,
        1,
        expect.objectContaining({ staffId: SYSTEM_STAFF_ID }),
      );
    });
  });

  describe('updateStatus', () => {
    it('rejects a backward transition', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.CONFIRMED }));

      const err = await expectRejection(service().updateStatus(ORDER_ID, { status: OrderStatus.PENDING }, staffActor));
      expect(err.statusCode).toBe(400);
    });

    it('rejects a same-status no-op transition', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.CONFIRMED }));

      const err = await expectRejection(service().updateStatus(ORDER_ID, { status: OrderStatus.CONFIRMED }, staffActor));
      expect(err.statusCode).toBe(400);
    });

    it('rejects IN_DELIVERY without deliveryCompany/trackingNumber', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.PACKAGED }));

      const err = await expectRejection(service().updateStatus(ORDER_ID, { status: OrderStatus.IN_DELIVERY }, staffActor));
      expect(err.statusCode).toBe(400);
    });

    it('allows staff to advance every forward transition through COMPLETED', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.PACKAGED }));
      orderUpdateMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.IN_DELIVERY }));

      await service().updateStatus(
        ORDER_ID,
        { status: OrderStatus.IN_DELIVERY, deliveryCompany: 'Yalidine', trackingNumber: 'TRK-1' },
        staffActor,
      );

      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'order.statusChanged',
        expect.objectContaining({ fromStatus: OrderStatus.PACKAGED, toStatus: OrderStatus.IN_DELIVERY }),
      );
    });

    it('rejects any transition attempted from a terminal state (CANCELLED)', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.CANCELLED }));

      const err = await expectRejection(service().updateStatus(ORDER_ID, { status: OrderStatus.CONFIRMED }, staffActor));
      expect(err.statusCode).toBe(400);
    });
  });

  describe('cancelOrder / cancelMyOrder', () => {
    it('admin cancel from PENDING releases the reservation', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.PENDING }));
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.CANCELLED }));

      await service().cancelOrder(ORDER_ID, {}, adminActor);

      expect(inventoryMock.release).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledWith('order.cancelled', expect.objectContaining({ orderId: ORDER_ID }));
    });

    it('admin cancel from CONFIRMED does not call release (stock already consumed, not reserved)', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.CONFIRMED }));
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.CANCELLED }));

      await service().cancelOrder(ORDER_ID, {}, adminActor);

      expect(inventoryMock.release).not.toHaveBeenCalled();
    });

    it('rejects an admin cancel from COMPLETED', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.COMPLETED }));

      const err = await expectRejection(service().cancelOrder(ORDER_ID, {}, adminActor));
      expect(err.statusCode).toBe(409);
    });

    it('client cancel: own + PENDING only — rejects another client\'s order with 403', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.PENDING, clientId: 'someone-else' }));

      const err = await expectRejection(service().cancelMyOrder(ORDER_ID, CLIENT_ID));
      expect(err.statusCode).toBe(403);
    });

    it('client cancel rejects a non-PENDING own order with 409', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.CONFIRMED, clientId: CLIENT_ID }));

      const err = await expectRejection(service().cancelMyOrder(ORDER_ID, CLIENT_ID));
      expect(err.statusCode).toBe(409);
    });
  });

  describe('returnOrder', () => {
    it('rejects a return from a non-COMPLETED order', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.PENDING }));

      const err = await expectRejection(
        service().returnOrder(ORDER_ID, { quantity: 1, restock: false, refundAmount: 1000 }, adminActor),
      );
      expect(err.statusCode).toBe(409);
    });

    it('restock:true reconstructs original consumption and calls returnIn at the consumed cost', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.COMPLETED }));
      stockMovementFindFirstMock.mockResolvedValueOnce({ id: 'movement-out-1' });
      stockMovementConsumptionFindManyMock.mockResolvedValueOnce([
        { id: 'c1', inMovementId: 'movement-in-1', quantityConsumed: 1, unitCost: new Prisma.Decimal(400) },
      ]);
      (inventoryMock.returnIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ movementId: 'movement-return-1' });
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.RETURNED }));

      await service().returnOrder(ORDER_ID, { quantity: 1, restock: true, refundAmount: 1000 }, adminActor);

      expect(inventoryMock.returnIn).toHaveBeenCalledWith(
        prismaMock,
        [{ inMovementId: 'movement-in-1', qty: 1, unitCost: 400 }],
        1,
        expect.objectContaining({ referenceType: 'RETURN', referenceId: ORDER_ID }),
      );
      expect(eventBusEmitMock).toHaveBeenCalledWith('order.returned', expect.objectContaining({ refundAmount: 1000 }));
    });

    it('restock:false never touches the inventory return path', async () => {
      orderFindUniqueMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.COMPLETED }));
      orderFindUniqueOrThrowMock.mockResolvedValueOnce(buildOrderRow({ status: OrderStatus.RETURNED }));

      await service().returnOrder(ORDER_ID, { quantity: 1, restock: false, refundAmount: 1000 }, adminActor);

      expect(inventoryMock.returnIn).not.toHaveBeenCalled();
      expect(stockMovementFindFirstMock).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('maps a groupBy roll-up onto OrderStatsDto', async () => {
      orderGroupByMock.mockResolvedValueOnce([
        { status: OrderStatus.PENDING, _count: { _all: 3 } },
        { status: OrderStatus.COMPLETED, _count: { _all: 5 } },
      ]);

      const dto = await service().getStats();

      expect(dto.pending).toBe(3);
      expect(dto.completed).toBe(5);
      expect(dto.cancelled).toBe(0);
    });
  });

  describe('applyClientPaymentRecorded', () => {
    it('is a no-op when the event carries no invoiceNumber', async () => {
      await service().applyClientPaymentRecorded({ paymentId: 'p1', posClientId: POS_CLIENT_ID, amount: 100, previousCredit: 0, newCredit: -100 });

      expect(invoiceFindUniqueMock).not.toHaveBeenCalled();
    });

    it('ignores an invoice whose sourceType is not ORDER', async () => {
      invoiceFindUniqueMock.mockResolvedValueOnce({ sourceType: 'SALE', sourceId: 'sale-1', paidAmount: new Prisma.Decimal(500) });

      await service().applyClientPaymentRecorded({
        paymentId: 'p1',
        posClientId: POS_CLIENT_ID,
        invoiceNumber: 'FAC-2026-0001',
        amount: 100,
        previousCredit: 0,
        newCredit: -100,
      });

      expect(orderUpdateMock).not.toHaveBeenCalled();
    });

    it('mirrors Order.paidAmount from the invoice for an ORDER-sourced invoice', async () => {
      invoiceFindUniqueMock.mockResolvedValueOnce({ sourceType: 'ORDER', sourceId: ORDER_ID, paidAmount: new Prisma.Decimal(700) });

      await service().applyClientPaymentRecorded({
        paymentId: 'p1',
        posClientId: POS_CLIENT_ID,
        invoiceNumber: 'FAC-2026-0002',
        amount: 700,
        previousCredit: 0,
        newCredit: -700,
      });

      expect(orderUpdateMock).toHaveBeenCalledWith({ where: { id: ORDER_ID }, data: { paidAmount: expect.any(Prisma.Decimal) } });
    });
  });
});
