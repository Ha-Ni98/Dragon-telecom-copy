import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { eventBus } from '../../../../src/common/events/event-bus';
import { PurchasingService } from '../../../../src/modules/purchasing/purchasing.service';
import { PurchasingListener } from '../../../../src/modules/purchasing/purchasing.listener';
import type { ICatalogRepricePort } from '../../../../src/modules/purchasing/purchasing.interface';
import type { IInventoryService } from '../../../../src/modules/inventory/inventory.interface';

const {
  supplierUpdateMock,
  supplierInvoiceFindUniqueMock,
  supplierInvoiceUpdateMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  supplierUpdateMock: vi.fn(),
  supplierInvoiceFindUniqueMock: vi.fn(),
  supplierInvoiceUpdateMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@common/config/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const prismaMock = {
  supplier: { update: supplierUpdateMock },
  supplierInvoice: { findUnique: supplierInvoiceFindUniqueMock, update: supplierInvoiceUpdateMock },
};

const SUPPLIER_ID = '11111111-1111-4111-8111-111111111111';
const INVOICE_ID = '22222222-2222-4222-8222-222222222222';

// The listener's handlers are fire-and-forget (never awaited by eventBus.emit, by design — see
// purchasing.listener.ts's safeRun); this lets their internal async work drain before assertions
// run (same helper as observability/clients.listener.spec.ts).
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('PurchasingListener', () => {
  // Registered exactly once for the whole file: eventBus is a module-level singleton.
  beforeAll(() => {
    const sequenceMock = { nextNumber: vi.fn() };
    const inventoryMock: IInventoryService = {
      reserve: vi.fn(),
      release: vi.fn(),
      addLayer: vi.fn(),
      consumeFifo: vi.fn(),
      returnIn: vi.fn(),
      flushEvents: vi.fn(),
    };
    const catalogRepriceMock: ICatalogRepricePort = { getRepriceCandidates: vi.fn(), getCostBasis: vi.fn() };
    const service = new PurchasingService(prismaMock as never, sequenceMock as never, inventoryMock, catalogRepriceMock);
    new PurchasingListener(service).setup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supplierInvoice.confirmed sets credit from the snapshot and increments totalInvoiced', async () => {
    eventBus.emit('supplierInvoice.confirmed', {
      invoiceId: INVOICE_ID,
      supplierId: SUPPLIER_ID,
      totalAmount: 1300,
      previousCredit: 0,
      newCredit: 1300,
    });
    await flush();

    expect(supplierUpdateMock).toHaveBeenCalledWith({
      where: { id: SUPPLIER_ID },
      data: { credit: 1300, totalInvoiced: { increment: 1300 } },
    });
  });

  it('supplierInvoice.cancelled reverses credit/totalInvoiced by the invoice\'s own totalAmount', async () => {
    supplierInvoiceFindUniqueMock.mockResolvedValueOnce({ totalAmount: new Prisma.Decimal(1300) });

    eventBus.emit('supplierInvoice.cancelled', { invoiceId: INVOICE_ID, supplierId: SUPPLIER_ID });
    await flush();

    expect(supplierUpdateMock).toHaveBeenCalledWith({
      where: { id: SUPPLIER_ID },
      data: { credit: { decrement: 1300 }, totalInvoiced: { decrement: 1300 } },
    });
  });

  it('payment.supplierRecorded sets credit, increments totalPaid, and updates the linked invoice paidAmount', async () => {
    supplierInvoiceFindUniqueMock.mockResolvedValueOnce({ id: INVOICE_ID });

    eventBus.emit('payment.supplierRecorded', {
      paymentId: 'payment-1',
      supplierId: SUPPLIER_ID,
      supplierInvoiceReference: 'SUP-2026-0001',
      amount: 400,
      previousCredit: 1000,
      newCredit: 600,
    });
    await flush();

    expect(supplierUpdateMock).toHaveBeenCalledWith({
      where: { id: SUPPLIER_ID },
      data: { credit: 600, totalPaid: { increment: 400 } },
    });
    expect(supplierInvoiceUpdateMock).toHaveBeenCalledWith({
      where: { id: INVOICE_ID },
      data: { paidAmount: { increment: 400 } },
    });
  });

  it('replaying supplierInvoice.confirmed with the same payload sets the identical final state (idempotent by construction)', async () => {
    const payload = { invoiceId: INVOICE_ID, supplierId: SUPPLIER_ID, totalAmount: 1300, previousCredit: 0, newCredit: 1300 };

    eventBus.emit('supplierInvoice.confirmed', payload);
    await flush();
    eventBus.emit('supplierInvoice.confirmed', payload);
    await flush();

    expect(supplierUpdateMock).toHaveBeenCalledTimes(2);
    for (const call of supplierUpdateMock.mock.calls) {
      expect((call as [{ data: { credit: number } }])[0].data.credit).toBe(1300);
    }
  });

  it('swallows a handler failure — never propagates back into eventBus.emit', async () => {
    supplierUpdateMock.mockRejectedValueOnce(new Error('db down'));

    expect(() =>
      eventBus.emit('supplierInvoice.confirmed', {
        invoiceId: INVOICE_ID,
        supplierId: SUPPLIER_ID,
        totalAmount: 1300,
        previousCredit: 0,
        newCredit: 1300,
      }),
    ).not.toThrow();
    await flush();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'supplierInvoice.confirmed' }),
      expect.any(String),
    );
  });
});
