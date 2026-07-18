import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma, SupplierInvoiceStatus as PrismaSupplierInvoiceStatus } from '@prisma/client';
import { DocType, MovementType } from '@dragon-telecom/contract';
import type { AppError } from '../../../../src/common/errors';
import { PurchasingService } from '../../../../src/modules/purchasing/purchasing.service';
import type { ICatalogRepricePort } from '../../../../src/modules/purchasing/purchasing.interface';
import type { IInventoryService } from '../../../../src/modules/inventory/inventory.interface';

const {
  supplierFindUniqueMock,
  supplierFindUniqueOrThrowMock,
  supplierFindManyMock,
  supplierCountMock,
  supplierCreateMock,
  supplierUpdateMock,
  supplierAggregateMock,
  supplierInvoiceFindUniqueMock,
  supplierInvoiceFindManyMock,
  supplierInvoiceCountMock,
  supplierInvoiceCreateMock,
  supplierInvoiceUpdateMock,
  supplierInvoiceAggregateMock,
  supplierInvoiceLineFindManyMock,
  supplierPaymentFindManyMock,
  supplierPaymentCountMock,
  supplierPaymentCreateMock,
  queryRawMock,
  transactionMock,
  eventBusEmitMock,
} = vi.hoisted(() => ({
  supplierFindUniqueMock: vi.fn(),
  supplierFindUniqueOrThrowMock: vi.fn(),
  supplierFindManyMock: vi.fn(),
  supplierCountMock: vi.fn(),
  supplierCreateMock: vi.fn(),
  supplierUpdateMock: vi.fn(),
  supplierAggregateMock: vi.fn(),
  supplierInvoiceFindUniqueMock: vi.fn(),
  supplierInvoiceFindManyMock: vi.fn(),
  supplierInvoiceCountMock: vi.fn(),
  supplierInvoiceCreateMock: vi.fn(),
  supplierInvoiceUpdateMock: vi.fn(),
  supplierInvoiceAggregateMock: vi.fn(),
  supplierInvoiceLineFindManyMock: vi.fn(),
  supplierPaymentFindManyMock: vi.fn(),
  supplierPaymentCountMock: vi.fn(),
  supplierPaymentCreateMock: vi.fn(),
  queryRawMock: vi.fn(),
  transactionMock: vi.fn(),
  eventBusEmitMock: vi.fn(),
}));

vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));

const prismaMock = {
  supplier: {
    findUnique: supplierFindUniqueMock,
    findUniqueOrThrow: supplierFindUniqueOrThrowMock,
    findMany: supplierFindManyMock,
    count: supplierCountMock,
    create: supplierCreateMock,
    update: supplierUpdateMock,
    aggregate: supplierAggregateMock,
  },
  supplierInvoice: {
    findUnique: supplierInvoiceFindUniqueMock,
    findMany: supplierInvoiceFindManyMock,
    count: supplierInvoiceCountMock,
    create: supplierInvoiceCreateMock,
    update: supplierInvoiceUpdateMock,
    aggregate: supplierInvoiceAggregateMock,
  },
  supplierInvoiceLine: { findMany: supplierInvoiceLineFindManyMock },
  supplierPayment: {
    findMany: supplierPaymentFindManyMock,
    count: supplierPaymentCountMock,
    create: supplierPaymentCreateMock,
  },
  $queryRaw: queryRawMock,
  $transaction: transactionMock,
};

const SUPPLIER_ID = '11111111-1111-4111-8111-111111111111';
const INVOICE_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_A = '33333333-3333-4333-8333-333333333333';
const PRODUCT_B = '44444444-4444-4444-8444-444444444444';
const STAFF_ID = '55555555-5555-4555-8555-555555555555';

const prismaKnownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('mock prisma error', { code, clientVersion: '6.19.3' });

const buildSupplierRow = (overrides: Record<string, unknown> = {}) => ({
  id: SUPPLIER_ID,
  code: 'FRN-2026-0001',
  name: 'Acme Parts',
  contactName: null,
  phone: null,
  email: null,
  location: null,
  credit: new Prisma.Decimal(0),
  totalPaid: new Prisma.Decimal(0),
  totalInvoiced: new Prisma.Decimal(0),
  isEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildStaffRelation = () => ({ firstName: 'John', lastName: 'Doe' });

const buildInvoiceRow = (overrides: Record<string, unknown> = {}, lines: Record<string, unknown>[] = []) => ({
  id: INVOICE_ID,
  reference: 'DRAFT-ABC123',
  supplierReference: null,
  supplierId: SUPPLIER_ID,
  status: PrismaSupplierInvoiceStatus.DRAFT,
  invoiceDate: new Date('2026-01-15T00:00:00.000Z'),
  dueDate: null,
  shippingCost: new Prisma.Decimal(0),
  amountOnly: null,
  totalAmount: new Prisma.Decimal(0),
  paidAmount: new Prisma.Decimal(0),
  previousCredit: null,
  newCredit: null,
  note: null,
  staffId: STAFF_ID,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  supplier: { name: 'Acme Parts' },
  staff: buildStaffRelation(),
  lines,
  ...overrides,
});

const buildLine = (overrides: Record<string, unknown> = {}) => ({
  id: 'line-1',
  supplierInvoiceId: INVOICE_ID,
  productId: PRODUCT_A,
  productNameSnapshot: 'Screen Protector',
  quantity: 10,
  unitCost: new Prisma.Decimal(100),
  landedUnitCost: new Prisma.Decimal(100),
  lineTotal: new Prisma.Decimal(1000),
  serialNumbers: null,
  ...overrides,
});

describe('PurchasingService', () => {
  const sequenceMock = { nextNumber: vi.fn() };
  const inventoryMock: IInventoryService = {
    reserve: vi.fn(),
    release: vi.fn(),
    addLayer: vi.fn(),
    consumeFifo: vi.fn(),
    returnIn: vi.fn(),
    flushEvents: vi.fn(),
  };
  const catalogRepriceMock: ICatalogRepricePort = {
    getRepriceCandidates: vi.fn(),
    getCostBasis: vi.fn(),
  };

  beforeEach(() => {
    // resetAllMocks (not clearAllMocks): also clears any queued mockResolvedValueOnce
    // implementations left over from a previous test, so a test that throws before draining
    // its own queue can never leak a stale value into the next test.
    vi.resetAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    queryRawMock.mockResolvedValue([{ id: SUPPLIER_ID }]);
    (catalogRepriceMock.getCostBasis as ReturnType<typeof vi.fn>).mockResolvedValue([
      { productId: PRODUCT_A, name: 'Screen Protector', averageCost: 90, quantityOnHand: 5 },
      { productId: PRODUCT_B, name: 'Charger Cable', averageCost: 50, quantityOnHand: 20 },
    ]);
    (catalogRepriceMock.getRepriceCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  const service = () => new PurchasingService(prismaMock as never, sequenceMock as never, inventoryMock, catalogRepriceMock);

  const expectRejection = async (promise: Promise<unknown>): Promise<AppError> => {
    try {
      await promise;
    } catch (err) {
      return err as AppError;
    }
    throw new Error('Expected promise to reject');
  };

  describe('updateSupplier', () => {
    it('maps a vanished supplier (P2025) to a NotFoundError', async () => {
      supplierUpdateMock.mockRejectedValueOnce(prismaKnownError('P2025'));

      const err = await expectRejection(service().updateSupplier(SUPPLIER_ID, { name: 'New Name' }));

      expect(err.statusCode).toBe(404);
    });
  });

  describe('createInvoice — landed cost', () => {
    it('computes lineTotal/landedUnitCost/totalAmount for a two-line invoice with shipping', async () => {
      supplierFindUniqueMock.mockResolvedValueOnce({ id: SUPPLIER_ID });
      supplierInvoiceCreateMock.mockResolvedValueOnce(buildInvoiceRow());
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(buildInvoiceRow());

      await service().createInvoice(
        {
          supplierId: SUPPLIER_ID,
          invoiceDate: '2026-01-15',
          shippingCost: 100,
          lines: [
            { productId: PRODUCT_A, quantity: 10, unitCost: 100 }, // lineTotal 1000
            { productId: PRODUCT_B, quantity: 5, unitCost: 40 }, // lineTotal 200
          ],
        },
        STAFF_ID,
      );

      // sumLineTotals = 1200; shipping 100 apportioned by lineTotal share.
      // line A: unitCost 100 + 100*(1000/1200)/10 = 100 + 8.3333... = 108.3333...
      // line B: unitCost 40 + 100*(200/1200)/5 = 40 + 3.3333... = 43.3333...
      const createCall = supplierInvoiceCreateMock.mock.calls[0]?.[0] as {
        data: { totalAmount: number; lines: { create: { landedUnitCost: number; lineTotal: number }[] } };
      };
      expect(createCall.data.totalAmount).toBeCloseTo(1300, 5); // 1200 + 100 shipping
      expect(createCall.data.lines.create[0]?.lineTotal).toBe(1000);
      expect(createCall.data.lines.create[0]?.landedUnitCost).toBeCloseTo(108.3333, 3);
      expect(createCall.data.lines.create[1]?.lineTotal).toBe(200);
      expect(createCall.data.lines.create[1]?.landedUnitCost).toBeCloseTo(43.3333, 3);
    });

    it('uses amountOnly as totalAmount and writes zero lines', async () => {
      supplierFindUniqueMock.mockResolvedValueOnce({ id: SUPPLIER_ID });
      supplierInvoiceCreateMock.mockResolvedValueOnce(buildInvoiceRow());
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(buildInvoiceRow());

      await service().createInvoice({ supplierId: SUPPLIER_ID, invoiceDate: '2026-01-15', amountOnly: 5000 }, STAFF_ID);

      const createCall = supplierInvoiceCreateMock.mock.calls[0]?.[0] as { data: { totalAmount: number; amountOnly: number } };
      expect(createCall.data.totalAmount).toBe(5000);
      expect(createCall.data.amountOnly).toBe(5000);
      expect(createCall.data).not.toHaveProperty('lines');
    });

    it('400s on an unknown productId', async () => {
      supplierFindUniqueMock.mockResolvedValueOnce({ id: SUPPLIER_ID });
      (catalogRepriceMock.getCostBasis as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const err = await expectRejection(
        service().createInvoice(
          { supplierId: SUPPLIER_ID, invoiceDate: '2026-01-15', lines: [{ productId: PRODUCT_A, quantity: 1, unitCost: 10 }] },
          STAFF_ID,
        ),
      );

      expect(err.statusCode).toBe(400);
    });
  });

  describe('updateInvoice', () => {
    it('409s when the invoice is not DRAFT', async () => {
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(buildInvoiceRow({ status: PrismaSupplierInvoiceStatus.CONFIRMED }));

      const err = await expectRejection(service().updateInvoice(INVOICE_ID, { note: 'x' }));

      expect(err.statusCode).toBe(409);
      expect(supplierInvoiceUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('confirmInvoice', () => {
    it('adds one layer per line at landed cost, snapshots credit, and emits once', async () => {
      const line1 = buildLine({ productId: PRODUCT_A, quantity: 10, landedUnitCost: new Prisma.Decimal(108.3333) });
      const line2 = buildLine({ id: 'line-2', productId: PRODUCT_B, quantity: 5, landedUnitCost: new Prisma.Decimal(43.3333) });
      const invoice = buildInvoiceRow({ totalAmount: new Prisma.Decimal(1300) }, [line1, line2]);
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(invoice);
      queryRawMock.mockResolvedValueOnce([{ id: SUPPLIER_ID }]);
      supplierFindUniqueOrThrowMock.mockResolvedValueOnce(buildSupplierRow());
      sequenceMock.nextNumber.mockResolvedValueOnce('SUP-2026-0001');
      (inventoryMock.addLayer as ReturnType<typeof vi.fn>).mockResolvedValue({ movementId: 'movement-1' });

      const result = await service().confirmInvoice(INVOICE_ID, STAFF_ID);

      expect(inventoryMock.addLayer).toHaveBeenCalledTimes(2);
      expect(inventoryMock.addLayer).toHaveBeenNthCalledWith(
        1,
        prismaMock,
        PRODUCT_A,
        10,
        108.3333,
        MovementType.SUPPLIER_INVOICE,
        { referenceType: 'SUPPLIER_INVOICE', referenceId: INVOICE_ID, staffId: STAFF_ID },
      );
      expect(sequenceMock.nextNumber).toHaveBeenCalledWith(prismaMock, DocType.SUPPLIER_INVOICE);
      expect(supplierInvoiceUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reference: 'SUP-2026-0001',
            status: PrismaSupplierInvoiceStatus.CONFIRMED,
            previousCredit: 0,
            newCredit: 1300,
          }),
        }),
      );
      expect(inventoryMock.flushEvents).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledWith('supplierInvoice.confirmed', {
        invoiceId: INVOICE_ID,
        supplierId: SUPPLIER_ID,
        totalAmount: 1300,
        previousCredit: 0,
        newCredit: 1300,
      });
      expect(result.reference).toBe('SUP-2026-0001');
    });

    it('is a no-op on double-confirm: adds no layers, emits nothing again', async () => {
      const confirmed = buildInvoiceRow({ status: PrismaSupplierInvoiceStatus.CONFIRMED, reference: 'SUP-2026-0001' }, []);
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(confirmed);

      const result = await service().confirmInvoice(INVOICE_ID, STAFF_ID);

      expect(inventoryMock.addLayer).not.toHaveBeenCalled();
      expect(eventBusEmitMock).not.toHaveBeenCalled();
      expect(result.reference).toBe('SUP-2026-0001');
    });

    it('409s confirming a CANCELLED invoice', async () => {
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(buildInvoiceRow({ status: PrismaSupplierInvoiceStatus.CANCELLED }, []));

      const err = await expectRejection(service().confirmInvoice(INVOICE_ID, STAFF_ID));

      expect(err.statusCode).toBe(409);
    });

    it('zero-line (amountOnly) confirm raises credit with zero addLayer calls', async () => {
      const invoice = buildInvoiceRow({ totalAmount: new Prisma.Decimal(5000), amountOnly: new Prisma.Decimal(5000) }, []);
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(invoice);
      supplierFindUniqueOrThrowMock.mockResolvedValueOnce(buildSupplierRow());
      sequenceMock.nextNumber.mockResolvedValueOnce('SUP-2026-0002');

      await service().confirmInvoice(INVOICE_ID, STAFF_ID);

      expect(inventoryMock.addLayer).not.toHaveBeenCalled();
      expect(supplierInvoiceUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ previousCredit: 0, newCredit: 5000 }) }),
      );
    });
  });

  describe('cancelInvoice', () => {
    it('reverses credit and emits supplierInvoice.cancelled only when the invoice was CONFIRMED', async () => {
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(
        buildInvoiceRow({ status: PrismaSupplierInvoiceStatus.CONFIRMED, totalAmount: new Prisma.Decimal(1300) }),
      );
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(buildInvoiceRow({ status: PrismaSupplierInvoiceStatus.CANCELLED }));

      await service().cancelInvoice(INVOICE_ID, {}, STAFF_ID);

      expect(eventBusEmitMock).toHaveBeenCalledWith('supplierInvoice.cancelled', { invoiceId: INVOICE_ID, supplierId: SUPPLIER_ID });
    });

    it('cancelling a DRAFT invoice emits nothing (nothing to reverse)', async () => {
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(buildInvoiceRow({ status: PrismaSupplierInvoiceStatus.DRAFT }));
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(buildInvoiceRow({ status: PrismaSupplierInvoiceStatus.CANCELLED }));

      await service().cancelInvoice(INVOICE_ID, {}, STAFF_ID);

      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('is idempotent on an already-CANCELLED invoice', async () => {
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(buildInvoiceRow({ status: PrismaSupplierInvoiceStatus.CANCELLED }));
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce(buildInvoiceRow({ status: PrismaSupplierInvoiceStatus.CANCELLED }));

      await service().cancelInvoice(INVOICE_ID, {}, STAFF_ID);

      expect(supplierInvoiceUpdateMock).not.toHaveBeenCalled();
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });
  });

  describe('createPayment', () => {
    it('snapshots previousCredit/newCredit and emits payment.supplierRecorded', async () => {
      supplierFindUniqueMock.mockResolvedValueOnce({ id: SUPPLIER_ID });
      queryRawMock.mockResolvedValueOnce([{ id: SUPPLIER_ID }]);
      supplierFindUniqueOrThrowMock.mockResolvedValueOnce(buildSupplierRow({ credit: new Prisma.Decimal(1000) }));
      sequenceMock.nextNumber.mockResolvedValueOnce('PAY-2026-0001');
      supplierPaymentCreateMock.mockResolvedValueOnce({
        id: 'payment-1',
        reference: 'PAY-2026-0001',
        supplierId: SUPPLIER_ID,
        supplierInvoiceId: null,
        amount: new Prisma.Decimal(400),
        previousCredit: new Prisma.Decimal(1000),
        newCredit: new Prisma.Decimal(600),
        paidAt: new Date('2026-01-01T00:00:00.000Z'),
        staffId: STAFF_ID,
        supplier: { name: 'Acme Parts' },
        supplierInvoice: null,
        staff: buildStaffRelation(),
      });

      const dto = await service().createPayment({ supplierId: SUPPLIER_ID, amount: 400 }, STAFF_ID);

      expect(dto.previousCredit).toBe(1000);
      expect(dto.newCredit).toBe(600);
      expect(eventBusEmitMock).toHaveBeenCalledWith('payment.supplierRecorded', {
        paymentId: 'payment-1',
        supplierId: SUPPLIER_ID,
        amount: 400,
        previousCredit: 1000,
        newCredit: 600,
      });
    });

    it('permits overpayment — newCredit goes negative (supplier owes)', async () => {
      supplierFindUniqueMock.mockResolvedValueOnce({ id: SUPPLIER_ID });
      queryRawMock.mockResolvedValueOnce([{ id: SUPPLIER_ID }]);
      supplierFindUniqueOrThrowMock.mockResolvedValueOnce(buildSupplierRow({ credit: new Prisma.Decimal(100) }));
      sequenceMock.nextNumber.mockResolvedValueOnce('PAY-2026-0002');
      supplierPaymentCreateMock.mockResolvedValueOnce({
        id: 'payment-2',
        reference: 'PAY-2026-0002',
        supplierId: SUPPLIER_ID,
        supplierInvoiceId: null,
        amount: new Prisma.Decimal(500),
        previousCredit: new Prisma.Decimal(100),
        newCredit: new Prisma.Decimal(-400),
        paidAt: new Date(),
        staffId: STAFF_ID,
        supplier: { name: 'Acme Parts' },
        supplierInvoice: null,
        staff: buildStaffRelation(),
      });

      const dto = await service().createPayment({ supplierId: SUPPLIER_ID, amount: 500 }, STAFF_ID);

      expect(dto.newCredit).toBe(-400);
    });

    it('400s on an unknown supplierId', async () => {
      supplierFindUniqueMock.mockResolvedValueOnce(null);

      const err = await expectRejection(service().createPayment({ supplierId: SUPPLIER_ID, amount: 100 }, STAFF_ID));

      expect(err.statusCode).toBe(400);
    });
  });

  describe('listener-invoked cache handlers', () => {
    it('applySupplierInvoiceConfirmed sets credit from the snapshot and increments totalInvoiced', async () => {
      await service().applySupplierInvoiceConfirmed({
        invoiceId: INVOICE_ID,
        supplierId: SUPPLIER_ID,
        totalAmount: 1300,
        previousCredit: 0,
        newCredit: 1300,
      });

      expect(supplierUpdateMock).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: { credit: 1300, totalInvoiced: { increment: 1300 } },
      });
    });

    it('applySupplierInvoiceCancelled reverses credit/totalInvoiced using the invoice\'s own totalAmount', async () => {
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce({ totalAmount: new Prisma.Decimal(1300) });

      await service().applySupplierInvoiceCancelled({ invoiceId: INVOICE_ID, supplierId: SUPPLIER_ID });

      expect(supplierUpdateMock).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: { credit: { decrement: 1300 }, totalInvoiced: { decrement: 1300 } },
      });
    });

    it('applyPaymentSupplierRecorded sets credit and increments totalPaid, updating the linked invoice paidAmount', async () => {
      supplierInvoiceFindUniqueMock.mockResolvedValueOnce({ id: INVOICE_ID, paidAmount: new Prisma.Decimal(0) });

      await service().applyPaymentSupplierRecorded({
        paymentId: 'payment-1',
        supplierId: SUPPLIER_ID,
        supplierInvoiceReference: 'SUP-2026-0001',
        amount: 400,
        previousCredit: 1000,
        newCredit: 600,
      });

      expect(supplierUpdateMock).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: { credit: 600, totalPaid: { increment: 400 } },
      });
      expect(supplierInvoiceUpdateMock).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: { paidAmount: { increment: 400 } },
      });
    });
  });
});
