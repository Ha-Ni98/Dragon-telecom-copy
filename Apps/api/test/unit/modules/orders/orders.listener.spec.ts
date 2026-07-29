import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { eventBus } from '../../../../src/common/events/event-bus';
import { OrdersService } from '../../../../src/modules/orders/orders.service';
import { OrdersListener } from '../../../../src/modules/orders/orders.listener';
import type { IInventoryService } from '../../../../src/modules/inventory/inventory.interface';
import type { ICatalogViewerPricingPort, IOrderCreditPort } from '../../../../src/modules/orders/orders.interface';
import { buildPaymentClientRecordedEvent } from '../../../data/payment-client-recorded.factory';

const { invoiceFindUniqueMock, orderUpdateMock, loggerErrorMock } = vi.hoisted(() => ({
  invoiceFindUniqueMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@common/config/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const prismaMock = {
  invoice: { findUnique: invoiceFindUniqueMock },
  order: { update: orderUpdateMock },
};

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

// Fire-and-forget handlers (safeRun never awaits) — let their internal async work drain before
// assertions run, same helper as billing/sales/clients.listener.spec.ts.
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('OrdersListener', () => {
  beforeAll(() => {
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
    const clientCreditMock: IOrderCreditPort = { applyOrderSold: vi.fn() };
    const service = new OrdersService(
      prismaMock as never,
      deliveryFeeMock,
      inventoryMock,
      sequenceMock as never,
      catalogPricingMock,
      clientCreditMock,
    );
    new OrdersListener(service).setup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mirrors Order.paidAmount for an invoice sourced from this order', async () => {
    invoiceFindUniqueMock.mockResolvedValueOnce({ sourceType: 'ORDER', sourceId: ORDER_ID, paidAmount: new Prisma.Decimal(700) });

    eventBus.emit('payment.clientRecorded', buildPaymentClientRecordedEvent({ invoiceNumber: 'FAC-2026-0001' }));
    await flush();

    expect(orderUpdateMock).toHaveBeenCalledWith({ where: { id: ORDER_ID }, data: { paidAmount: expect.any(Prisma.Decimal) } });
  });

  it('ignores a non-ORDER-sourced invoice', async () => {
    invoiceFindUniqueMock.mockResolvedValueOnce({ sourceType: 'SALE', sourceId: 'sale-1', paidAmount: new Prisma.Decimal(700) });

    eventBus.emit('payment.clientRecorded', buildPaymentClientRecordedEvent({ invoiceNumber: 'FAC-2026-0002' }));
    await flush();

    expect(orderUpdateMock).not.toHaveBeenCalled();
  });

  it('is idempotent under replay — an absolute mirror, not an increment', async () => {
    invoiceFindUniqueMock.mockResolvedValue({ sourceType: 'ORDER', sourceId: ORDER_ID, paidAmount: new Prisma.Decimal(1000) });

    const payload = buildPaymentClientRecordedEvent({ invoiceNumber: 'FAC-2026-0003' });
    eventBus.emit('payment.clientRecorded', payload);
    await flush();
    eventBus.emit('payment.clientRecorded', payload);
    await flush();

    expect(orderUpdateMock).toHaveBeenCalledTimes(2);
    for (const call of orderUpdateMock.mock.calls) {
      expect((call as [{ data: { paidAmount: Prisma.Decimal } }])[0].data.paidAmount.toNumber()).toBe(1000);
    }
  });

  it('swallows a handler failure — never propagates back into eventBus.emit', async () => {
    invoiceFindUniqueMock.mockRejectedValueOnce(new Error('db down'));

    expect(() =>
      eventBus.emit('payment.clientRecorded', buildPaymentClientRecordedEvent({ invoiceNumber: 'FAC-2026-0004' })),
    ).not.toThrow();
    await flush();

    expect(loggerErrorMock).toHaveBeenCalledWith(expect.objectContaining({ event: 'payment.clientRecorded' }), expect.any(String));
  });
});
