import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { eventBus } from '../../../../src/common/events/event-bus';
import { SalesService } from '../../../../src/modules/sales/sales.service';
import { SalesListener } from '../../../../src/modules/sales/sales.listener';
import type { ICatalogPosPricingPort, IClientCreditPort } from '../../../../src/modules/sales/sales.interface';
import type { IInventoryService } from '../../../../src/modules/inventory/inventory.interface';

const {
  repairFindUniqueMock,
  repairStatusHistoryFindFirstMock,
  repairUpdateManyMock,
  saleCreateMock,
  queryRawMock,
  transactionMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  repairFindUniqueMock: vi.fn(),
  repairStatusHistoryFindFirstMock: vi.fn(),
  repairUpdateManyMock: vi.fn(),
  saleCreateMock: vi.fn(),
  queryRawMock: vi.fn(),
  transactionMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@common/config/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const prismaMock = {
  repair: { findUnique: repairFindUniqueMock, updateMany: repairUpdateManyMock },
  repairStatusHistory: { findFirst: repairStatusHistoryFindFirstMock },
  sale: { create: saleCreateMock },
  $queryRaw: queryRawMock,
  $transaction: transactionMock,
};

const REPAIR_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';

const buildRepairPickedUpEvent = () => ({
  repairId: REPAIR_ID,
  totalAmount: 100,
  paidAmount: 100,
  totalCost: 60,
  totalProfit: 40,
  labourPrice: 20,
  snapshotParts: [
    { productId: PRODUCT_ID, productName: 'Test Part', quantity: 1, unitPrice: 80, costOfGoods: 60, profit: 20, lineTotal: 80 },
  ],
});

// Fire-and-forget handlers (safeRun never awaits) — let their internal async work drain before
// assertions run, same helper as purchasing/clients.listener.spec.ts.
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('SalesListener', () => {
  // A plain subscriber on the real bus (exactly how clients.listener.ts consumes sale.confirmed
  // in production) — observes the listener's own re-emit without touching the event-bus module.
  const saleConfirmedSpy = vi.fn();

  beforeAll(() => {
    const sequenceMock = { nextNumber: vi.fn().mockResolvedValue('SAL-2026-0001') };
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
    const service = new SalesService(prismaMock as never, sequenceMock as never, inventoryMock, catalogPricingMock, clientCreditMock);
    new SalesListener(service).setup();
    eventBus.on('sale.confirmed', saleConfirmedSpy);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  it('repair.pickedUp records one sale and emits exactly one sale.confirmed(origin:REPAIR)', async () => {
    repairFindUniqueMock.mockResolvedValueOnce({ saleId: null });
    repairStatusHistoryFindFirstMock.mockResolvedValueOnce({ staffId: STAFF_ID });
    saleCreateMock.mockResolvedValueOnce({ id: 'repair-sale-1' });
    repairUpdateManyMock.mockResolvedValueOnce({ count: 1 });

    eventBus.emit('repair.pickedUp', buildRepairPickedUpEvent());
    await flush();

    expect(saleCreateMock).toHaveBeenCalledTimes(1);
    expect(saleConfirmedSpy).toHaveBeenCalledTimes(1);
    expect(saleConfirmedSpy).toHaveBeenCalledWith(expect.objectContaining({ origin: 'REPAIR' }));
  });

  it('replaying the same repairId ⇒ exactly one sale (idempotency latch, genuinely tested)', async () => {
    // First delivery: not yet recorded.
    repairFindUniqueMock.mockResolvedValueOnce({ saleId: null });
    repairStatusHistoryFindFirstMock.mockResolvedValueOnce({ staffId: STAFF_ID });
    saleCreateMock.mockResolvedValueOnce({ id: 'repair-sale-2' });
    repairUpdateManyMock.mockResolvedValueOnce({ count: 1 });

    // Second delivery (replay): Repair.saleId is now set, short-circuits before any write.
    repairFindUniqueMock.mockResolvedValueOnce({ saleId: 'repair-sale-2' });

    const payload = buildRepairPickedUpEvent();
    eventBus.emit('repair.pickedUp', payload);
    await flush();
    eventBus.emit('repair.pickedUp', payload);
    await flush();

    expect(saleCreateMock).toHaveBeenCalledTimes(1);
    expect(saleConfirmedSpy).toHaveBeenCalledTimes(1);
  });

  it('swallows a handler failure — never propagates back into eventBus.emit', async () => {
    repairFindUniqueMock.mockRejectedValueOnce(new Error('db down'));

    expect(() => eventBus.emit('repair.pickedUp', buildRepairPickedUpEvent())).not.toThrow();
    await flush();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'repair.pickedUp' }),
      expect.any(String),
    );
    expect(saleConfirmedSpy).not.toHaveBeenCalled();
  });
});
