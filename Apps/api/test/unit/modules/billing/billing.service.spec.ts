import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { SaleOrigin } from '@dragon-telecom/contract';
import type { AppError } from '../../../../src/common/errors';
import { BillingService } from '../../../../src/modules/billing/billing.service';
import type { IClientCreditPort, IStoreSettingsPort } from '../../../../src/modules/billing/billing.interface';
import { buildOrderConfirmedEvent, buildSaleConfirmedEvent } from '../../../data/billing-events.factory';

const {
  saleFindUniqueOrThrowMock,
  saleFindManyMock,
  saleLineFindManyMock,
  orderFindUniqueOrThrowMock,
  posClientFindUniqueMock,
  posClientFindUniqueOrThrowMock,
  posClientUpdateMock,
  clientFindFirstMock,
  clientFindUniqueMock,
  invoiceFindUniqueMock,
  invoiceFindUniqueOrThrowMock,
  invoiceCreateMock,
  invoiceUpdateMock,
  invoiceFindManyMock,
  invoiceCountMock,
  clientPaymentCreateMock,
  clientPaymentFindManyMock,
  clientPaymentCountMock,
  clientPaymentAggregateMock,
  productFindManyMock,
  queryRawMock,
  transactionMock,
  eventBusEmitMock,
} = vi.hoisted(() => ({
  saleFindUniqueOrThrowMock: vi.fn(),
  saleFindManyMock: vi.fn(),
  saleLineFindManyMock: vi.fn(),
  orderFindUniqueOrThrowMock: vi.fn(),
  posClientFindUniqueMock: vi.fn(),
  posClientFindUniqueOrThrowMock: vi.fn(),
  posClientUpdateMock: vi.fn(),
  clientFindFirstMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
  invoiceFindUniqueMock: vi.fn(),
  invoiceFindUniqueOrThrowMock: vi.fn(),
  invoiceCreateMock: vi.fn(),
  invoiceUpdateMock: vi.fn(),
  invoiceFindManyMock: vi.fn(),
  invoiceCountMock: vi.fn(),
  clientPaymentCreateMock: vi.fn(),
  clientPaymentFindManyMock: vi.fn(),
  clientPaymentCountMock: vi.fn(),
  clientPaymentAggregateMock: vi.fn(),
  productFindManyMock: vi.fn(),
  queryRawMock: vi.fn(),
  transactionMock: vi.fn(),
  eventBusEmitMock: vi.fn(),
}));

vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));

const prismaMock = {
  sale: { findUniqueOrThrow: saleFindUniqueOrThrowMock, findMany: saleFindManyMock },
  saleLine: { findMany: saleLineFindManyMock },
  order: { findUniqueOrThrow: orderFindUniqueOrThrowMock },
  posClient: { findUnique: posClientFindUniqueMock, findUniqueOrThrow: posClientFindUniqueOrThrowMock, update: posClientUpdateMock },
  client: { findFirst: clientFindFirstMock, findUnique: clientFindUniqueMock },
  invoice: {
    findUnique: invoiceFindUniqueMock,
    findUniqueOrThrow: invoiceFindUniqueOrThrowMock,
    create: invoiceCreateMock,
    update: invoiceUpdateMock,
    findMany: invoiceFindManyMock,
    count: invoiceCountMock,
  },
  clientPayment: {
    create: clientPaymentCreateMock,
    findMany: clientPaymentFindManyMock,
    count: clientPaymentCountMock,
    aggregate: clientPaymentAggregateMock,
  },
  product: { findMany: productFindManyMock },
  $queryRaw: queryRawMock,
  $transaction: transactionMock,
};

const SALE_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const POS_CLIENT_ID = '44444444-4444-4444-8444-444444444444';

const prismaKnownError = (code: string) => new Prisma.PrismaClientKnownRequestError('mock prisma error', { code, clientVersion: '6.19.3' });

const buildSaleRow = (overrides: Record<string, unknown> = {}) => ({
  id: SALE_ID,
  reference: 'SAL-2026-0001',
  staffId: STAFF_ID,
  lines: [
    {
      productId: PRODUCT_ID,
      productNameSnapshot: 'Screen Protector',
      quantity: 2,
      unitPrice: new Prisma.Decimal(1000),
      costOfGoods: new Prisma.Decimal(400),
      profit: new Prisma.Decimal(1600),
      lineTotal: new Prisma.Decimal(2000),
      serialNumbers: null,
    },
  ],
  ...overrides,
});

describe('BillingService', () => {
  const sequenceMock = { nextNumber: vi.fn() };
  const clientCreditMock: IClientCreditPort = { applyPayment: vi.fn() };
  const settingsMock: IStoreSettingsPort = {
    getSettings: vi.fn().mockResolvedValue({
      store: { name: 'Dragon Telecom', address: '1 Rue Test', phone: '0555000000' },
      invoicing: { prefixes: {}, nextSequences: {} },
      delivery: { defaultHome: 500, defaultOffice: 300 },
      storefront: { featuredProductIds: [] },
    }),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    queryRawMock.mockResolvedValue([{ id: POS_CLIENT_ID }]);
    saleFindManyMock.mockResolvedValue([]);
    saleLineFindManyMock.mockResolvedValue([]);
    (settingsMock.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      store: { name: 'Dragon Telecom', address: '1 Rue Test', phone: '0555000000' },
      invoicing: { prefixes: {}, nextSequences: {} },
      delivery: { defaultHome: 500, defaultOffice: 300 },
      storefront: { featuredProductIds: [] },
    });
  });

  const service = () => new BillingService(prismaMock as never, sequenceMock as never, settingsMock, clientCreditMock);

  const expectRejection = async (promise: Promise<unknown>): Promise<AppError> => {
    try {
      await promise;
    } catch (err) {
      return err as AppError;
    }
    throw new Error('Expected promise to reject');
  };

  describe('issueFromSale', () => {
    it('skips REPAIR-origin sales entirely — no invoice, no sequence allocation', async () => {
      await service().issueFromSale(buildSaleConfirmedEvent({ origin: SaleOrigin.REPAIR }));

      expect(sequenceMock.nextNumber).not.toHaveBeenCalled();
      expect(invoiceCreateMock).not.toHaveBeenCalled();
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('issues once from a POS sale, reading cost/profit off the persisted SaleLine rows', async () => {
      saleFindUniqueOrThrowMock.mockResolvedValueOnce(buildSaleRow());
      sequenceMock.nextNumber.mockResolvedValueOnce('FAC-2026-0001');
      invoiceCreateMock.mockResolvedValueOnce({ id: 'invoice-1' });

      await service().issueFromSale(buildSaleConfirmedEvent({ saleId: SALE_ID, origin: SaleOrigin.POS, totalAmount: 2000, paidAmount: 2000 }));

      expect(invoiceCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            number: 'FAC-2026-0001',
            sourceType: 'SALE',
            sourceId: SALE_ID,
            totalCost: 400,
            totalProfit: 1600,
            staffId: STAFF_ID,
          }),
        }),
      );
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'invoice.issued',
        expect.objectContaining({ invoiceNumber: 'FAC-2026-0001', sourceType: 'SALE', sourceReference: 'SAL-2026-0001' }),
      );
    });

    it('replay (Invoice @@unique(sourceType, sourceId) hit) is swallowed as a no-op — one invoice survives', async () => {
      saleFindUniqueOrThrowMock.mockResolvedValueOnce(buildSaleRow());
      sequenceMock.nextNumber.mockResolvedValueOnce('FAC-2026-0002');
      invoiceCreateMock.mockRejectedValueOnce(prismaKnownError('P2002'));

      await expect(service().issueFromSale(buildSaleConfirmedEvent({ saleId: SALE_ID }))).resolves.toBeUndefined();

      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });
  });

  describe('issueFromOrder', () => {
    it('issues an ORDER invoice with no Sale row involved at all, copying Order.costOfGoods/profit (audit fix A3)', async () => {
      orderFindUniqueOrThrowMock.mockResolvedValueOnce({
        id: 'order-1',
        reference: 'ORD-2026-0001',
        costOfGoods: new Prisma.Decimal(400),
        profit: new Prisma.Decimal(600),
      });
      sequenceMock.nextNumber.mockResolvedValueOnce('FAC-2026-0003');
      invoiceCreateMock.mockResolvedValueOnce({ id: 'invoice-2' });

      await service().issueFromOrder(buildOrderConfirmedEvent({ orderId: 'order-1' }));

      expect(saleFindUniqueOrThrowMock).not.toHaveBeenCalled();
      expect(invoiceCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sourceType: 'ORDER', totalCost: 400, totalProfit: 600 }) }),
      );
      const createArgs = invoiceCreateMock.mock.calls[0]?.[0];
      expect(createArgs.data.lines.create[0]).toEqual(
        expect.objectContaining({ costSnapshot: 400, profit: 600 }),
      );
    });

    it('defaults totalCost/totalProfit to 0 when a confirmed order is somehow missing them (defensive null-guard, never throws)', async () => {
      orderFindUniqueOrThrowMock.mockResolvedValueOnce({
        id: 'order-1',
        reference: 'ORD-2026-0001',
        costOfGoods: null,
        profit: null,
      });
      sequenceMock.nextNumber.mockResolvedValueOnce('FAC-2026-0004');
      invoiceCreateMock.mockResolvedValueOnce({ id: 'invoice-3' });

      await expect(service().issueFromOrder(buildOrderConfirmedEvent({ orderId: 'order-1' }))).resolves.toBeUndefined();

      expect(invoiceCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sourceType: 'ORDER', totalCost: 0, totalProfit: 0 }) }),
      );
    });
  });

  describe('cancelInvoice', () => {
    it('changes status only and leaves the sequence gap (no sequence call at all)', async () => {
      invoiceFindUniqueMock.mockResolvedValueOnce({ number: 'FAC-2026-0001', status: 'ISSUED' });
      invoiceUpdateMock.mockResolvedValueOnce({});
      invoiceFindUniqueMock.mockResolvedValueOnce({
        id: 'invoice-1',
        number: 'FAC-2026-0001',
        status: 'CANCELLED',
        sourceType: 'SALE',
        sourceId: SALE_ID,
        totalAmount: new Prisma.Decimal(2000),
        paidAmount: new Prisma.Decimal(2000),
        totalCost: new Prisma.Decimal(400),
        totalProfit: new Prisma.Decimal(1600),
        clientNameSnapshot: 'Walk-in Customer',
        clientAddressSnapshot: null,
        posClientId: null,
        previousCredit: null,
        newCredit: null,
        issuedAt: new Date(),
        dueDate: null,
        staff: { firstName: 'A', lastName: 'B' },
        lines: [],
      });
      saleFindUniqueOrThrowMock.mockResolvedValueOnce({ id: SALE_ID, reference: 'SAL-2026-0001' });

      await service().cancelInvoice('FAC-2026-0001', { reason: 'customer request' }, STAFF_ID);

      expect(sequenceMock.nextNumber).not.toHaveBeenCalled();
      expect(invoiceUpdateMock).toHaveBeenCalledWith({ where: { number: 'FAC-2026-0001' }, data: { status: 'CANCELLED' } });
      expect(eventBusEmitMock).toHaveBeenCalledWith('invoice.cancelled', { invoiceNumber: 'FAC-2026-0001', reason: 'customer request' });
    });

    it('cancelling an already-CANCELLED invoice is idempotent — no second emit', async () => {
      const cancelledRow = {
        id: 'invoice-1',
        number: 'FAC-2026-0001',
        status: 'CANCELLED',
        sourceType: 'SALE',
        sourceId: SALE_ID,
        totalAmount: new Prisma.Decimal(2000),
        paidAmount: new Prisma.Decimal(2000),
        totalCost: new Prisma.Decimal(400),
        totalProfit: new Prisma.Decimal(1600),
        clientNameSnapshot: 'Walk-in Customer',
        clientAddressSnapshot: null,
        posClientId: null,
        previousCredit: null,
        newCredit: null,
        issuedAt: new Date(),
        dueDate: null,
        staff: { firstName: 'A', lastName: 'B' },
        lines: [],
      };
      // cancelInvoice reloads via getAdminInvoice once it decides there's nothing to do —
      // two findUnique calls even on the already-cancelled path.
      invoiceFindUniqueMock.mockResolvedValueOnce(cancelledRow).mockResolvedValueOnce(cancelledRow);

      await service().cancelInvoice('FAC-2026-0001', {}, STAFF_ID);

      expect(invoiceUpdateMock).not.toHaveBeenCalled();
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });
  });

  describe('createClientPayment', () => {
    it('snapshots previousCredit/newCredit (via the injected credit port) and emits payment.clientRecorded', async () => {
      (clientCreditMock.applyPayment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 1000, newCredit: 600 });
      sequenceMock.nextNumber.mockResolvedValueOnce('REG-2026-0001');
      clientPaymentCreateMock.mockResolvedValueOnce({
        id: 'payment-1',
        reference: 'REG-2026-0001',
        posClientId: POS_CLIENT_ID,
        invoiceId: null,
        amount: new Prisma.Decimal(400),
        previousCredit: new Prisma.Decimal(1000),
        newCredit: new Prisma.Decimal(600),
        paidAt: new Date(),
        staffId: STAFF_ID,
        posClient: { name: 'Karim Store' },
        invoice: null,
        staff: { firstName: 'A', lastName: 'B' },
      });

      const dto = await service().createClientPayment({ posClientId: POS_CLIENT_ID, amount: 400 }, STAFF_ID);

      // Credit is written in-tx via the injected port now (credit-serialization fix, plan §C5)
      // — no post-commit listener applies it.
      expect(clientCreditMock.applyPayment).toHaveBeenCalledWith(prismaMock, POS_CLIENT_ID, { amount: 400 });
      expect(dto.previousCredit).toBe(1000);
      expect(dto.newCredit).toBe(600);
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'payment.clientRecorded',
        expect.objectContaining({ paymentId: 'payment-1', posClientId: POS_CLIENT_ID, amount: 400, previousCredit: 1000, newCredit: 600 }),
      );
    });

    it('permits overpayment — newCredit goes negative (store owes)', async () => {
      (clientCreditMock.applyPayment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 100, newCredit: -400 });
      sequenceMock.nextNumber.mockResolvedValueOnce('REG-2026-0002');
      clientPaymentCreateMock.mockResolvedValueOnce({
        id: 'payment-2',
        reference: 'REG-2026-0002',
        posClientId: POS_CLIENT_ID,
        invoiceId: null,
        amount: new Prisma.Decimal(500),
        previousCredit: new Prisma.Decimal(100),
        newCredit: new Prisma.Decimal(-400),
        paidAt: new Date(),
        staffId: STAFF_ID,
        posClient: { name: 'Karim Store' },
        invoice: null,
        staff: { firstName: 'A', lastName: 'B' },
      });

      const dto = await service().createClientPayment({ posClientId: POS_CLIENT_ID, amount: 500 }, STAFF_ID);

      expect(dto.newCredit).toBe(-400);
    });

    it('on-account (no invoiceNumber) persists the payment but never touches an invoice', async () => {
      (clientCreditMock.applyPayment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 0, newCredit: -200 });
      sequenceMock.nextNumber.mockResolvedValueOnce('REG-2026-0003');
      clientPaymentCreateMock.mockResolvedValueOnce({
        id: 'payment-3',
        reference: 'REG-2026-0003',
        posClientId: POS_CLIENT_ID,
        invoiceId: null,
        amount: new Prisma.Decimal(200),
        previousCredit: new Prisma.Decimal(0),
        newCredit: new Prisma.Decimal(-200),
        paidAt: new Date(),
        staffId: STAFF_ID,
        posClient: { name: 'Karim Store' },
        invoice: null,
        staff: { firstName: 'A', lastName: 'B' },
      });

      await service().createClientPayment({ posClientId: POS_CLIENT_ID, amount: 200 }, STAFF_ID);

      expect(invoiceFindUniqueMock).not.toHaveBeenCalled();
      expect(invoiceFindUniqueOrThrowMock).not.toHaveBeenCalled();
      const createCall = clientPaymentCreateMock.mock.calls[0]?.[0] as { data: { invoiceId?: string } };
      expect(createCall.data).not.toHaveProperty('invoiceId');
    });

    it('400s on an unknown invoiceNumber', async () => {
      invoiceFindUniqueMock.mockResolvedValueOnce(null);

      const err = await expectRejection(
        service().createClientPayment({ posClientId: POS_CLIENT_ID, invoiceNumber: 'FAC-9999-9999', amount: 100 }, STAFF_ID),
      );

      expect(err.statusCode).toBe(400);
    });

    describe('a payment targeting an invoice recomputes paidAmount/status in the same transaction (credit-serialization fix, plan §C5)', () => {
      const INVOICE_ID = '55555555-5555-4555-8555-555555555555';

      it('flips ISSUED → PARTIALLY_PAID when the ledger sum is below totalAmount', async () => {
        invoiceFindUniqueMock.mockResolvedValueOnce({ id: INVOICE_ID, posClientId: POS_CLIENT_ID });
        (clientCreditMock.applyPayment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 2000, newCredit: 1200 });
        sequenceMock.nextNumber.mockResolvedValueOnce('REG-2026-0004');
        clientPaymentAggregateMock.mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(800) } });
        invoiceFindUniqueOrThrowMock.mockResolvedValueOnce({ totalAmount: new Prisma.Decimal(2000), status: 'ISSUED' });
        clientPaymentCreateMock.mockResolvedValueOnce({
          id: 'payment-4',
          reference: 'REG-2026-0004',
          posClientId: POS_CLIENT_ID,
          invoiceId: INVOICE_ID,
          amount: new Prisma.Decimal(800),
          previousCredit: new Prisma.Decimal(2000),
          newCredit: new Prisma.Decimal(1200),
          paidAt: new Date(),
          staffId: STAFF_ID,
          posClient: { name: 'Karim Store' },
          invoice: { number: 'FAC-2026-0001' },
          staff: { firstName: 'A', lastName: 'B' },
        });

        await service().createClientPayment(
          { posClientId: POS_CLIENT_ID, invoiceNumber: 'FAC-2026-0001', amount: 800 },
          STAFF_ID,
        );

        expect(invoiceUpdateMock).toHaveBeenCalledWith({
          where: { id: INVOICE_ID },
          data: { paidAmount: 800, status: 'PARTIALLY_PAID' },
        });
      });

      it('flips to PAID once the ledger sum reaches totalAmount', async () => {
        invoiceFindUniqueMock.mockResolvedValueOnce({ id: INVOICE_ID, posClientId: POS_CLIENT_ID });
        (clientCreditMock.applyPayment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 1200, newCredit: -800 });
        sequenceMock.nextNumber.mockResolvedValueOnce('REG-2026-0005');
        clientPaymentAggregateMock.mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(2000) } });
        invoiceFindUniqueOrThrowMock.mockResolvedValueOnce({ totalAmount: new Prisma.Decimal(2000), status: 'PARTIALLY_PAID' });
        clientPaymentCreateMock.mockResolvedValueOnce({
          id: 'payment-5',
          reference: 'REG-2026-0005',
          posClientId: POS_CLIENT_ID,
          invoiceId: INVOICE_ID,
          amount: new Prisma.Decimal(1200),
          previousCredit: new Prisma.Decimal(1200),
          newCredit: new Prisma.Decimal(-800),
          paidAt: new Date(),
          staffId: STAFF_ID,
          posClient: { name: 'Karim Store' },
          invoice: { number: 'FAC-2026-0001' },
          staff: { firstName: 'A', lastName: 'B' },
        });

        await service().createClientPayment(
          { posClientId: POS_CLIENT_ID, invoiceNumber: 'FAC-2026-0001', amount: 1200 },
          STAFF_ID,
        );

        expect(invoiceUpdateMock).toHaveBeenCalledWith({ where: { id: INVOICE_ID }, data: { paidAmount: 2000, status: 'PAID' } });
      });

      it('never revives a CANCELLED invoice', async () => {
        invoiceFindUniqueMock.mockResolvedValueOnce({ id: INVOICE_ID, posClientId: POS_CLIENT_ID });
        (clientCreditMock.applyPayment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ previousCredit: 0, newCredit: -500 });
        sequenceMock.nextNumber.mockResolvedValueOnce('REG-2026-0006');
        invoiceFindUniqueOrThrowMock.mockResolvedValueOnce({ totalAmount: new Prisma.Decimal(2000), status: 'CANCELLED' });
        clientPaymentCreateMock.mockResolvedValueOnce({
          id: 'payment-6',
          reference: 'REG-2026-0006',
          posClientId: POS_CLIENT_ID,
          invoiceId: INVOICE_ID,
          amount: new Prisma.Decimal(500),
          previousCredit: new Prisma.Decimal(0),
          newCredit: new Prisma.Decimal(-500),
          paidAt: new Date(),
          staffId: STAFF_ID,
          posClient: { name: 'Karim Store' },
          invoice: { number: 'FAC-2026-0001' },
          staff: { firstName: 'A', lastName: 'B' },
        });

        await service().createClientPayment(
          { posClientId: POS_CLIENT_ID, invoiceNumber: 'FAC-2026-0001', amount: 500 },
          STAFF_ID,
        );

        expect(clientPaymentAggregateMock).not.toHaveBeenCalled();
        expect(invoiceUpdateMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('read scoping', () => {
    it('getMyInvoice 404s when the caller\'s linked posClientId does not match the invoice\'s', async () => {
      const CALLING_CLIENT_ID = 'client-1';
      clientFindUniqueMock.mockResolvedValueOnce({ posClientId: POS_CLIENT_ID });
      invoiceFindUniqueMock.mockResolvedValueOnce({
        number: 'FAC-2026-0001',
        posClientId: 'someone-elses-pos-client',
        sourceType: 'SALE',
        sourceId: SALE_ID,
        totalAmount: new Prisma.Decimal(2000),
        paidAmount: new Prisma.Decimal(2000),
        totalCost: new Prisma.Decimal(400),
        totalProfit: new Prisma.Decimal(1600),
        clientNameSnapshot: 'Karim Store',
        clientAddressSnapshot: null,
        previousCredit: null,
        newCredit: null,
        issuedAt: new Date(),
        dueDate: null,
        staff: { firstName: 'A', lastName: 'B' },
        lines: [],
      });

      const err = await expectRejection(service().getMyInvoice('FAC-2026-0001', CALLING_CLIENT_ID));

      expect(err.statusCode).toBe(404);
    });

    it('getMyInvoice 404s a client with no linked PosClient at all (never approved)', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ posClientId: null });
      invoiceFindUniqueMock.mockResolvedValueOnce({
        number: 'FAC-2026-0001',
        posClientId: POS_CLIENT_ID,
        sourceType: 'SALE',
        sourceId: SALE_ID,
        totalAmount: new Prisma.Decimal(2000),
        paidAmount: new Prisma.Decimal(2000),
        totalCost: new Prisma.Decimal(400),
        totalProfit: new Prisma.Decimal(1600),
        clientNameSnapshot: 'Karim Store',
        clientAddressSnapshot: null,
        previousCredit: null,
        newCredit: null,
        issuedAt: new Date(),
        dueDate: null,
        staff: { firstName: 'A', lastName: 'B' },
        lines: [],
      });

      const err = await expectRejection(service().getMyInvoice('FAC-2026-0001', 'unapproved-client'));

      expect(err.statusCode).toBe(404);
    });

    it('getMyInvoices returns an empty page for a client with no linked PosClient (no error)', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ posClientId: null });

      const result = await service().getMyInvoices({ page: 1, limit: 20 } as never, 'unapproved-client');

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(invoiceFindManyMock).not.toHaveBeenCalled();
    });

    it('getStaffInvoice 403s a staff member who did not issue it', async () => {
      invoiceFindUniqueMock.mockResolvedValueOnce({
        number: 'FAC-2026-0001',
        posClientId: null,
        staffId: 'someone-else',
        sourceType: 'SALE',
        sourceId: SALE_ID,
        totalAmount: new Prisma.Decimal(2000),
        paidAmount: new Prisma.Decimal(2000),
        totalCost: new Prisma.Decimal(400),
        totalProfit: new Prisma.Decimal(1600),
        clientNameSnapshot: 'Walk-in Customer',
        clientAddressSnapshot: null,
        previousCredit: null,
        newCredit: null,
        issuedAt: new Date(),
        dueDate: null,
        staff: { firstName: 'A', lastName: 'B' },
        lines: [],
      });

      const err = await expectRejection(service().getStaffInvoice('FAC-2026-0001', STAFF_ID));

      expect(err.statusCode).toBe(403);
    });
  });

  describe('PDF rendering', () => {
    it('getAdminInvoicePdf returns a non-empty Buffer with the application/pdf mime and a .pdf filename', async () => {
      invoiceFindUniqueMock.mockResolvedValueOnce({
        number: 'FAC-2026-0001',
        posClientId: null,
        staffId: STAFF_ID,
        sourceType: 'SALE',
        sourceId: SALE_ID,
        status: 'ISSUED',
        totalAmount: new Prisma.Decimal(2000),
        paidAmount: new Prisma.Decimal(2000),
        totalCost: new Prisma.Decimal(400),
        totalProfit: new Prisma.Decimal(1600),
        clientNameSnapshot: 'Walk-in Customer',
        clientAddressSnapshot: null,
        previousCredit: null,
        newCredit: null,
        issuedAt: new Date(),
        dueDate: null,
        staff: { firstName: 'A', lastName: 'B' },
        lines: [{ id: 'line-1', label: 'Screen Protector', quantity: 1, unitPrice: new Prisma.Decimal(1000), costSnapshot: new Prisma.Decimal(400), profit: new Prisma.Decimal(600), lineTotal: new Prisma.Decimal(1000), serialNumbers: null }],
      });

      const result = await service().getAdminInvoicePdf('FAC-2026-0001');

      expect(result.mime).toBe('application/pdf');
      expect(result.filename).toBe('FAC-2026-0001.pdf');
      expect(result.body.length).toBeGreaterThan(0);
      expect(result.body.subarray(0, 4).toString('latin1')).toBe('%PDF');
    });
  });
});
