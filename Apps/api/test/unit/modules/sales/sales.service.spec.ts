import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { MovementType, ReturnType as SalesReturnType, UserType } from '@dragon-telecom/contract';
import type { AppError } from '../../../../src/common/errors';
import { SalesService } from '../../../../src/modules/sales/sales.service';
import type { ICatalogPosPricingPort, IClientCreditPort } from '../../../../src/modules/sales/sales.interface';
import type { IInventoryService } from '../../../../src/modules/inventory/inventory.interface';

const {
  saleFindUniqueMock,
  saleFindUniqueOrThrowMock,
  saleCreateMock,
  saleUpdateMock,
  saleFindManyMock,
  saleCountMock,
  saleLineUpdateMock,
  posClientFindUniqueOrThrowMock,
  posClientUpdateMock,
  productFindManyMock,
  returnCreateMock,
  returnLineFindManyMock,
  repairFindUniqueMock,
  repairUpdateManyMock,
  repairStatusHistoryFindFirstMock,
  stockMovementFindFirstMock,
  stockMovementConsumptionFindManyMock,
  queryRawMock,
  transactionMock,
  eventBusEmitMock,
} = vi.hoisted(() => ({
  saleFindUniqueMock: vi.fn(),
  saleFindUniqueOrThrowMock: vi.fn(),
  saleCreateMock: vi.fn(),
  saleUpdateMock: vi.fn(),
  saleFindManyMock: vi.fn(),
  saleCountMock: vi.fn(),
  saleLineUpdateMock: vi.fn(),
  posClientFindUniqueOrThrowMock: vi.fn(),
  posClientUpdateMock: vi.fn(),
  productFindManyMock: vi.fn(),
  returnCreateMock: vi.fn(),
  returnLineFindManyMock: vi.fn(),
  repairFindUniqueMock: vi.fn(),
  repairUpdateManyMock: vi.fn(),
  repairStatusHistoryFindFirstMock: vi.fn(),
  stockMovementFindFirstMock: vi.fn(),
  stockMovementConsumptionFindManyMock: vi.fn(),
  queryRawMock: vi.fn(),
  transactionMock: vi.fn(),
  eventBusEmitMock: vi.fn(),
}));

vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));

const prismaMock = {
  sale: {
    findUnique: saleFindUniqueMock,
    findUniqueOrThrow: saleFindUniqueOrThrowMock,
    create: saleCreateMock,
    update: saleUpdateMock,
    findMany: saleFindManyMock,
    count: saleCountMock,
  },
  saleLine: { update: saleLineUpdateMock },
  posClient: { findUniqueOrThrow: posClientFindUniqueOrThrowMock, update: posClientUpdateMock },
  product: { findMany: productFindManyMock },
  return: { create: returnCreateMock },
  returnLine: { findMany: returnLineFindManyMock },
  repair: { findUnique: repairFindUniqueMock, updateMany: repairUpdateManyMock },
  repairStatusHistory: { findFirst: repairStatusHistoryFindFirstMock },
  stockMovement: { findFirst: stockMovementFindFirstMock },
  stockMovementConsumption: { findMany: stockMovementConsumptionFindManyMock },
  $queryRaw: queryRawMock,
  $transaction: transactionMock,
};

const SALE_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_STAFF_ID = '44444444-4444-4444-8444-444444444444';
const POS_CLIENT_ID = '55555555-5555-4555-8555-555555555555';
const LINE_ID = '66666666-6666-4666-8666-666666666666';
const REPAIR_ID = '77777777-7777-4777-8777-777777777777';
const now = new Date('2026-01-01T00:00:00.000Z');

const buildLineRow = (overrides: Record<string, unknown> = {}) => ({
  id: LINE_ID,
  saleId: SALE_ID,
  productId: PRODUCT_ID,
  productNameSnapshot: 'Screen Protector',
  quantity: 2,
  resolvedPrice: new Prisma.Decimal(0),
  unitPrice: new Prisma.Decimal(1000),
  costOfGoods: new Prisma.Decimal(0),
  profit: new Prisma.Decimal(0),
  lineTotal: new Prisma.Decimal(2000),
  serialNumbers: null,
  ...overrides,
});

const buildSaleRow = (overrides: Record<string, unknown> = {}, lines = [buildLineRow()]) => ({
  id: SALE_ID,
  reference: 'DRAFT-ABC123',
  posClientId: null,
  origin: 'POS',
  status: 'DRAFT',
  subtotal: new Prisma.Decimal(2000),
  discountAmount: new Prisma.Decimal(0),
  totalAmount: new Prisma.Decimal(2000),
  paidAmount: new Prisma.Decimal(0),
  previousCredit: null,
  newCredit: null,
  totalCost: new Prisma.Decimal(0),
  totalProfit: new Prisma.Decimal(0),
  soldAt: null,
  staffId: STAFF_ID,
  note: null,
  createdAt: now,
  updatedAt: now,
  posClient: null,
  staff: { firstName: 'Amina', lastName: 'Belkacem' },
  lines,
  ...overrides,
});

describe('SalesService', () => {
  const sequenceMock = { nextNumber: vi.fn() };
  const inventoryMock: IInventoryService = {
    reserve: vi.fn(),
    release: vi.fn(),
    addLayer: vi.fn(),
    consumeFifo: vi.fn(),
    returnIn: vi.fn(),
    flushEvents: vi.fn(),
  };
  const catalogPricingMock: ICatalogPosPricingPort = { resolvePosPrices: vi.fn() };
  const clientCreditMock: IClientCreditPort = { applySaleCharge: vi.fn(), applyReturnRefund: vi.fn() };

  const staffActor = { sub: STAFF_ID, type: UserType.STAFF, staffId: STAFF_ID };
  const otherStaffActor = { sub: OTHER_STAFF_ID, type: UserType.STAFF, staffId: OTHER_STAFF_ID };
  const adminActor = { sub: 'admin-1', type: UserType.ADMIN, staffId: STAFF_ID };

  beforeEach(() => {
    vi.resetAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    queryRawMock.mockResolvedValue([{ id: POS_CLIENT_ID }]);
    (catalogPricingMock.resolvePosPrices as ReturnType<typeof vi.fn>).mockResolvedValue([
      { productId: PRODUCT_ID, productName: 'Screen Protector', resolvedPrice: 900 },
    ]);
  });

  const service = () =>
    new SalesService(prismaMock as never, sequenceMock as never, inventoryMock, catalogPricingMock, clientCreditMock);

  const expectRejection = async (promise: Promise<unknown>): Promise<AppError> => {
    try {
      await promise;
    } catch (err) {
      return err as AppError;
    }
    throw new Error('Expected promise to reject');
  };

  describe('createDraft', () => {
    it('resolves productNameSnapshot and stores resolvedPrice=0 (unresolved until confirm)', async () => {
      productFindManyMock.mockResolvedValueOnce([{ id: PRODUCT_ID, name: 'Screen Protector' }]);
      saleCreateMock.mockResolvedValueOnce(buildSaleRow());

      await service().createDraft({ lines: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 1000 }] }, STAFF_ID);

      const createCall = saleCreateMock.mock.calls[0]?.[0] as {
        data: { staffId: string; status: string; lines: { create: { resolvedPrice: number; productNameSnapshot: string }[] } };
      };
      expect(createCall.data.staffId).toBe(STAFF_ID);
      expect(createCall.data.status).toBe('DRAFT');
      expect(createCall.data.lines.create[0]?.resolvedPrice).toBe(0);
      expect(createCall.data.lines.create[0]?.productNameSnapshot).toBe('Screen Protector');
    });

    it('400s on an unknown productId', async () => {
      productFindManyMock.mockResolvedValueOnce([]);

      const err = await expectRejection(
        service().createDraft({ lines: [{ productId: PRODUCT_ID, quantity: 1, unitPrice: 100 }] }, STAFF_ID),
      );

      expect(err.statusCode).toBe(400);
    });
  });

  describe('updateDraft', () => {
    it('403s when a non-owner, non-admin staff updates someone else\'s draft', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow());

      const err = await expectRejection(service().updateDraft(SALE_ID, {}, otherStaffActor));

      expect(err.statusCode).toBe(403);
    });

    it('409s updating a sale that is no longer DRAFT', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ status: 'COMPLETED' }));

      const err = await expectRejection(service().updateDraft(SALE_ID, { note: 'x' }, staffActor));

      expect(err.statusCode).toBe(409);
    });

    it('replaces lines wholesale when cmd.lines is provided', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow());
      productFindManyMock.mockResolvedValueOnce([{ id: PRODUCT_ID, name: 'Screen Protector' }]);
      saleUpdateMock.mockResolvedValueOnce(buildSaleRow());

      await service().updateDraft(SALE_ID, { lines: [{ productId: PRODUCT_ID, quantity: 5, unitPrice: 800 }] }, staffActor);

      const updateCall = saleUpdateMock.mock.calls[0]?.[0] as { data: { lines: { deleteMany: object; create: unknown[] } } };
      expect(updateCall.data.lines.deleteMany).toEqual({});
      expect(updateCall.data.lines.create).toHaveLength(1);
    });

    it('admin may update any staff\'s draft', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow());
      saleUpdateMock.mockResolvedValueOnce(buildSaleRow({ note: 'admin edit' }));

      await expect(service().updateDraft(SALE_ID, { note: 'admin edit' }, adminActor)).resolves.toBeDefined();
    });
  });

  describe('confirm', () => {
    it('409s and does not touch inventory when the sale is not DRAFT (double-confirm surface)', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ status: 'COMPLETED' }));

      const err = await expectRejection(service().confirm(SALE_ID, { paidAmount: 2000 }, staffActor));

      expect(err.statusCode).toBe(409);
      expect(inventoryMock.consumeFifo).not.toHaveBeenCalled();
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('exhausted stock: consumeFifo throws, sale stays DRAFT, no event', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ posClientId: POS_CLIENT_ID }));
      (clientCreditMock.applySaleCharge as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 0, newCredit: 0 });
      const insufficientStockError = Object.assign(new Error('INSUFFICIENT_STOCK'), { statusCode: 409 });
      (inventoryMock.consumeFifo as ReturnType<typeof vi.fn>).mockRejectedValueOnce(insufficientStockError);

      await expect(service().confirm(SALE_ID, { paidAmount: 2000 }, staffActor)).rejects.toThrow('INSUFFICIENT_STOCK');

      expect(saleUpdateMock).not.toHaveBeenCalled();
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('underpaid anonymous sale (no posClientId) 400s with CREDIT_REQUIRES_CLIENT', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow()); // totalAmount 2000, no posClientId

      const err = await expectRejection(service().confirm(SALE_ID, { paidAmount: 1000 }, staffActor));

      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('CREDIT_REQUIRES_CLIENT');
      expect(inventoryMock.consumeFifo).not.toHaveBeenCalled();
    });

    it('computes credit math and returns receipt figures on a full-payment confirm', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ posClientId: POS_CLIENT_ID }));
      (clientCreditMock.applySaleCharge as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 500, newCredit: 500 });
      (inventoryMock.consumeFifo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        movementId: 'movement-1',
        costOfGoods: 800,
        profit: 1200,
        consumptions: [],
      });
      sequenceMock.nextNumber.mockResolvedValueOnce('SAL-2026-0001');
      saleFindUniqueOrThrowMock.mockResolvedValueOnce(
        buildSaleRow({
          posClientId: POS_CLIENT_ID,
          status: 'COMPLETED',
          paidAmount: new Prisma.Decimal(2000),
          previousCredit: new Prisma.Decimal(500),
          newCredit: new Prisma.Decimal(500),
          soldAt: now,
        }),
      );

      const receipt = await service().confirm(SALE_ID, { paidAmount: 2000 }, staffActor);

      expect(clientCreditMock.applySaleCharge).toHaveBeenCalledWith(prismaMock, POS_CLIENT_ID, { totalAmount: 2000, paidAmount: 2000 });
      expect(inventoryMock.consumeFifo).toHaveBeenCalledWith(
        prismaMock,
        PRODUCT_ID,
        2,
        2000,
        MovementType.SALE,
        { referenceType: 'SALE', referenceId: SALE_ID, staffId: STAFF_ID },
      );
      expect(saleUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            reference: 'SAL-2026-0001',
            previousCredit: 500,
            newCredit: 500, // 500 + (2000 - 2000)
            totalCost: 800,
            totalProfit: 1200,
          }),
        }),
      );
      expect(inventoryMock.flushEvents).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'sale.confirmed',
        expect.objectContaining({ saleId: SALE_ID, origin: 'POS', previousCredit: 500, newCredit: 500 }),
      );
      expect(receipt.previousCredit).toBe(500);
      expect(receipt.newCredit).toBe(500);
      expect(receipt.grandTotal).toBe(2500);
    });

    it('double confirm: a second call 409s with no additional consumeFifo/event beyond the first', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ posClientId: POS_CLIENT_ID }));
      (clientCreditMock.applySaleCharge as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 0, newCredit: 0 });
      (inventoryMock.consumeFifo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        movementId: 'movement-1',
        costOfGoods: 800,
        profit: 1200,
        consumptions: [],
      });
      sequenceMock.nextNumber.mockResolvedValueOnce('SAL-2026-0001');
      saleFindUniqueOrThrowMock.mockResolvedValueOnce(buildSaleRow({ status: 'COMPLETED' }));

      await service().confirm(SALE_ID, { paidAmount: 2000 }, staffActor);
      expect(inventoryMock.consumeFifo).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledTimes(1);

      // Second confirm reloads the now-COMPLETED sale -> 409, no further consumption/emit.
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ status: 'COMPLETED' }));
      await expect(service().confirm(SALE_ID, { paidAmount: 2000 }, staffActor)).rejects.toMatchObject({ statusCode: 409 });

      expect(inventoryMock.consumeFifo).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSale', () => {
    it('403s when staff B reads staff A\'s sale', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow());

      const err = await expectRejection(service().getSale('SAL-2026-0001', otherStaffActor));

      expect(err.statusCode).toBe(403);
    });

    it('admin may read any sale, with margins included', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ status: 'COMPLETED' }, [buildLineRow({ profit: new Prisma.Decimal(400) })]));

      const dto = await service().getSale('SAL-2026-0001', adminActor);

      expect(dto.lines[0]?.profit).toBe(400);
    });

    it('owner staff reads their own sale without margins', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ status: 'COMPLETED' }, [buildLineRow({ profit: new Prisma.Decimal(400) })]));

      const dto = await service().getSale('SAL-2026-0001', staffActor);

      expect(dto.lines[0]).not.toHaveProperty('profit');
    });

    it('404s on an unknown reference', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(null);

      const err = await expectRejection(service().getSale('SAL-2026-9999', staffActor));

      expect(err.statusCode).toBe(404);
    });
  });

  describe('createReturn', () => {
    const RETURN_ID = '88888888-8888-4888-8888-888888888888';

    it('restock:true calls inventory.returnIn at the consumed cost', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(
        buildSaleRow({ status: 'COMPLETED' }, [buildLineRow({ quantity: 2, costOfGoods: new Prisma.Decimal(800) })]),
      );
      returnLineFindManyMock.mockResolvedValueOnce([]);
      sequenceMock.nextNumber.mockResolvedValueOnce('RET-2026-0001');
      returnCreateMock.mockResolvedValueOnce({ id: RETURN_ID, reference: 'RET-2026-0001' });
      stockMovementFindFirstMock.mockResolvedValueOnce({ id: 'movement-out-1' });
      stockMovementConsumptionFindManyMock.mockResolvedValueOnce([
        { id: 'c1', inMovementId: 'movement-in-1', quantityConsumed: 2, unitCost: new Prisma.Decimal(400) },
      ]);
      (inventoryMock.returnIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ movementId: 'movement-return-1' });
      saleFindUniqueOrThrowMock.mockResolvedValueOnce(buildSaleRow({ status: 'RETURNED' }));

      await service().createReturn(
        {
          saleId: SALE_ID,
          type: SalesReturnType.REFUND,
          lines: [{ saleLineId: LINE_ID, quantity: 2, restock: true, refundAmount: 2000 }],
        },
        STAFF_ID,
      );

      expect(inventoryMock.returnIn).toHaveBeenCalledWith(
        prismaMock,
        [{ inMovementId: 'movement-in-1', qty: 2, unitCost: 400 }],
        2,
        { referenceType: 'RETURN', referenceId: RETURN_ID, staffId: STAFF_ID },
      );
    });

    it('restock:false never calls inventory.returnIn', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ status: 'COMPLETED' }, [buildLineRow({ quantity: 2 })]));
      returnLineFindManyMock.mockResolvedValueOnce([]);
      sequenceMock.nextNumber.mockResolvedValueOnce('RET-2026-0002');
      returnCreateMock.mockResolvedValueOnce({ id: RETURN_ID, reference: 'RET-2026-0002' });
      saleFindUniqueOrThrowMock.mockResolvedValueOnce(buildSaleRow({ status: 'RETURNED' }));

      await service().createReturn(
        {
          saleId: SALE_ID,
          type: SalesReturnType.REFUND,
          lines: [{ saleLineId: LINE_ID, quantity: 2, restock: false, refundAmount: 2000 }],
        },
        STAFF_ID,
      );

      expect(inventoryMock.returnIn).not.toHaveBeenCalled();
    });

    it('400s when the return quantity exceeds sold minus already-returned', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ status: 'COMPLETED' }, [buildLineRow({ quantity: 2 })]));
      returnLineFindManyMock.mockResolvedValueOnce([{ saleLineId: LINE_ID, quantity: 1 }]); // 1 already returned

      const err = await expectRejection(
        service().createReturn(
          {
            saleId: SALE_ID,
            type: SalesReturnType.REFUND,
            lines: [{ saleLineId: LINE_ID, quantity: 2, restock: false, refundAmount: 100 }], // only 1 left
          },
          STAFF_ID,
        ),
      );

      expect(err.statusCode).toBe(400);
    });

    it('emits return.created with a negative creditEffect (refund reduces what the client owes)', async () => {
      saleFindUniqueMock.mockResolvedValueOnce(buildSaleRow({ status: 'COMPLETED', posClientId: POS_CLIENT_ID }, [buildLineRow({ quantity: 2 })]));
      returnLineFindManyMock.mockResolvedValueOnce([]);
      sequenceMock.nextNumber.mockResolvedValueOnce('RET-2026-0003');
      returnCreateMock.mockResolvedValueOnce({ id: RETURN_ID, reference: 'RET-2026-0003' });
      (clientCreditMock.applyReturnRefund as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 500, newCredit: 0 });
      saleFindUniqueOrThrowMock.mockResolvedValueOnce(buildSaleRow({ status: 'RETURNED', posClientId: POS_CLIENT_ID }));

      await service().createReturn(
        {
          saleId: SALE_ID,
          type: SalesReturnType.REFUND,
          lines: [{ saleLineId: LINE_ID, quantity: 2, restock: false, refundAmount: 500 }],
        },
        STAFF_ID,
      );

      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'return.created',
        expect.objectContaining({ returnId: RETURN_ID, saleId: SALE_ID, refundAmount: 500, posClientId: POS_CLIENT_ID, creditEffect: -500 }),
      );
      // Written in-tx via the injected credit port now (credit-serialization fix, plan §C3) —
      // no direct tx.posClient.update and no double-apply via the old clients-listener.
      expect(clientCreditMock.applyReturnRefund).toHaveBeenCalledWith(prismaMock, POS_CLIENT_ID, { creditEffect: -500 });
      expect(posClientUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('recordRepairSale', () => {
    const buildRepairEvent = (overrides: Record<string, unknown> = {}) => ({
      repairId: REPAIR_ID,
      totalAmount: 100,
      paidAmount: 100,
      totalCost: 60,
      totalProfit: 40,
      labourPrice: 20,
      snapshotParts: [
        { productId: PRODUCT_ID, productName: 'Test Part', quantity: 1, unitPrice: 80, costOfGoods: 60, profit: 20, lineTotal: 80 },
      ],
      ...overrides,
    });

    it('creates a COMPLETED REPAIR-origin sale and emits sale.confirmed(origin:REPAIR)', async () => {
      repairFindUniqueMock.mockResolvedValueOnce({ saleId: null });
      repairStatusHistoryFindFirstMock.mockResolvedValueOnce({ staffId: STAFF_ID });
      sequenceMock.nextNumber.mockResolvedValueOnce('SAL-2026-0002');
      saleCreateMock.mockResolvedValueOnce({ id: 'repair-sale-1' });
      repairUpdateManyMock.mockResolvedValueOnce({ count: 1 });

      await service().recordRepairSale(buildRepairEvent());

      expect(saleCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ origin: 'REPAIR', status: 'COMPLETED', staffId: STAFF_ID }),
        }),
      );
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'sale.confirmed',
        expect.objectContaining({ saleId: 'repair-sale-1', origin: 'REPAIR' }),
      );
    });

    it('is idempotent by repairId — a replay with saleId already set is a no-op (no sale, no event)', async () => {
      repairFindUniqueMock.mockResolvedValueOnce({ saleId: 'existing-sale-1' });

      await service().recordRepairSale(buildRepairEvent());

      expect(saleCreateMock).not.toHaveBeenCalled();
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('never calls inventory.consumeFifo (no FIFO re-consumption)', async () => {
      repairFindUniqueMock.mockResolvedValueOnce({ saleId: null });
      repairStatusHistoryFindFirstMock.mockResolvedValueOnce({ staffId: STAFF_ID });
      sequenceMock.nextNumber.mockResolvedValueOnce('SAL-2026-0003');
      saleCreateMock.mockResolvedValueOnce({ id: 'repair-sale-2' });
      repairUpdateManyMock.mockResolvedValueOnce({ count: 1 });

      await service().recordRepairSale(buildRepairEvent());

      expect(inventoryMock.consumeFifo).not.toHaveBeenCalled();
    });

    it('a repair sale linked to a posClient routes its credit effect through the injected port (credit-serialization fix, plan §C3)', async () => {
      repairFindUniqueMock.mockResolvedValueOnce({ saleId: null });
      repairStatusHistoryFindFirstMock.mockResolvedValueOnce({ staffId: STAFF_ID });
      sequenceMock.nextNumber.mockResolvedValueOnce('SAL-2026-0004');
      (clientCreditMock.applySaleCharge as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 0, newCredit: 0 });
      saleCreateMock.mockResolvedValueOnce({ id: 'repair-sale-3' });
      repairUpdateManyMock.mockResolvedValueOnce({ count: 1 });

      await service().recordRepairSale(buildRepairEvent({ posClientId: POS_CLIENT_ID }));

      expect(clientCreditMock.applySaleCharge).toHaveBeenCalledWith(prismaMock, POS_CLIENT_ID, { totalAmount: 100, paidAmount: 100 });
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'sale.confirmed',
        expect.objectContaining({ posClientId: POS_CLIENT_ID, previousCredit: 0, newCredit: 0 }),
      );
    });
  });
});
