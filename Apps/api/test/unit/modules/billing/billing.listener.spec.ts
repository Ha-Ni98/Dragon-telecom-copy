import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { SaleOrigin } from '@dragon-telecom/contract';
import { eventBus } from '../../../../src/common/events/event-bus';
import { BillingService } from '../../../../src/modules/billing/billing.service';
import { BillingListener } from '../../../../src/modules/billing/billing.listener';
import type { IStoreSettingsPort } from '../../../../src/modules/billing/billing.interface';
import { buildSaleConfirmedEvent } from '../../../data/billing-events.factory';

const {
  saleFindUniqueOrThrowMock,
  invoiceCreateMock,
  invoiceFindUniqueMock,
  invoiceUpdateMock,
  clientPaymentAggregateMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  saleFindUniqueOrThrowMock: vi.fn(),
  invoiceCreateMock: vi.fn(),
  invoiceFindUniqueMock: vi.fn(),
  invoiceUpdateMock: vi.fn(),
  clientPaymentAggregateMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@common/config/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const prismaMock = {
  sale: { findUniqueOrThrow: saleFindUniqueOrThrowMock },
  invoice: { create: invoiceCreateMock, findUnique: invoiceFindUniqueMock, update: invoiceUpdateMock },
  clientPayment: { aggregate: clientPaymentAggregateMock },
  $transaction: undefined as unknown, // set in beforeAll
};

const SALE_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';

const buildSaleRow = () => ({
  id: SALE_ID,
  reference: 'SAL-2026-0001',
  staffId: STAFF_ID,
  lines: [
    {
      productId: PRODUCT_ID,
      productNameSnapshot: 'Screen Protector',
      quantity: 1,
      unitPrice: new Prisma.Decimal(1000),
      costOfGoods: new Prisma.Decimal(400),
      profit: new Prisma.Decimal(600),
      lineTotal: new Prisma.Decimal(1000),
      serialNumbers: null,
    },
  ],
});

// Fire-and-forget handlers (safeRun never awaits) — let their internal async work drain before
// assertions run, same helper as sales/purchasing/clients.listener.spec.ts.
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('BillingListener', () => {
  // A plain subscriber on the real bus — observes the listener's own re-emit (invoice.issued)
  // without touching the event-bus module.
  const invoiceIssuedSpy = vi.fn();

  beforeAll(() => {
    (prismaMock.$transaction as unknown) = vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    const sequenceMock = { nextNumber: vi.fn().mockResolvedValue('FAC-2026-0001') };
    const settingsMock: IStoreSettingsPort = { getSettings: vi.fn() };
    const service = new BillingService(prismaMock as never, sequenceMock as never, settingsMock);
    new BillingListener(service).setup();
    eventBus.on('invoice.issued', invoiceIssuedSpy);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sale.confirmed (POS) issues exactly one invoice', async () => {
    saleFindUniqueOrThrowMock.mockResolvedValueOnce(buildSaleRow());
    invoiceCreateMock.mockResolvedValueOnce({ id: 'invoice-1' });

    eventBus.emit('sale.confirmed', buildSaleConfirmedEvent({ saleId: SALE_ID, origin: SaleOrigin.POS }));
    await flush();

    expect(invoiceCreateMock).toHaveBeenCalledTimes(1);
    expect(invoiceIssuedSpy).toHaveBeenCalledTimes(1);
    expect(invoiceIssuedSpy).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'SALE' }));
  });

  it('sale.confirmed (REPAIR) is ignored — no invoice, no emit', async () => {
    eventBus.emit('sale.confirmed', buildSaleConfirmedEvent({ saleId: SALE_ID, origin: SaleOrigin.REPAIR }));
    await flush();

    expect(saleFindUniqueOrThrowMock).not.toHaveBeenCalled();
    expect(invoiceCreateMock).not.toHaveBeenCalled();
    expect(invoiceIssuedSpy).not.toHaveBeenCalled();
  });

  it('payment.clientRecorded recompute flips status and is idempotent on replay', async () => {
    invoiceFindUniqueMock.mockResolvedValue({ id: 'invoice-1', totalAmount: new Prisma.Decimal(1000), status: 'ISSUED' });
    clientPaymentAggregateMock.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(1000) } });

    const payload = { paymentId: 'p1', posClientId: 'pc1', invoiceNumber: 'FAC-2026-0001', amount: 1000, previousCredit: 0, newCredit: 0 };
    eventBus.emit('payment.clientRecorded', payload);
    await flush();
    eventBus.emit('payment.clientRecorded', payload);
    await flush();

    expect(invoiceUpdateMock).toHaveBeenCalledTimes(2);
    for (const call of invoiceUpdateMock.mock.calls) {
      expect((call as [{ data: { status: string; paidAmount: number } }])[0].data).toEqual({ paidAmount: 1000, status: 'PAID' });
    }
  });

  it('swallows a handler failure — never propagates back into eventBus.emit', async () => {
    saleFindUniqueOrThrowMock.mockRejectedValueOnce(new Error('db down'));

    expect(() => eventBus.emit('sale.confirmed', buildSaleConfirmedEvent({ saleId: SALE_ID, origin: SaleOrigin.POS }))).not.toThrow();
    await flush();

    expect(loggerErrorMock).toHaveBeenCalledWith(expect.objectContaining({ event: 'sale.confirmed' }), expect.any(String));
    expect(invoiceIssuedSpy).not.toHaveBeenCalled();
  });
});
