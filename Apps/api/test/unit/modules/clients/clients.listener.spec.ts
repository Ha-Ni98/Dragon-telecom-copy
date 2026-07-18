import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { eventBus } from '../../../../src/common/events/event-bus';
import { ClientsService } from '../../../../src/modules/clients/clients.service';
import { ClientsListener } from '../../../../src/modules/clients/clients.listener';
import type { ICatalogCartPort, IIdentityProvisioningPort } from '../../../../src/modules/clients/clients.interface';

const {
  clientFindUniqueMock,
  clientUpdateMock,
  posClientCreateMock,
  posClientUpdateMock,
  transactionMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  clientFindUniqueMock: vi.fn(),
  clientUpdateMock: vi.fn(),
  posClientCreateMock: vi.fn(),
  posClientUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@common/config/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const prismaMock = {
  client: { findUnique: clientFindUniqueMock, update: clientUpdateMock },
  posClient: { create: posClientCreateMock, update: posClientUpdateMock },
  $transaction: transactionMock,
};

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const POS_CLIENT_ID = '44444444-4444-4444-8444-444444444444';
const CATEGORY_ID = '55555555-5555-4555-8555-555555555555';

// The listener's handlers are fire-and-forget (never awaited by eventBus.emit, by design — see
// clients.listener.ts's safeRun); this lets their internal async work drain before assertions
// run (same helper as observability.listener.spec.ts).
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('ClientsListener', () => {
  // Registered exactly once for the whole file: eventBus is a module-level singleton.
  beforeAll(() => {
    const identityMock: IIdentityProvisioningPort = { provisionClientUser: vi.fn(), resetPassword: vi.fn() };
    const sequenceMock = { nextNumber: vi.fn().mockResolvedValue('POS-2026-0001') };
    const catalogCartMock: ICatalogCartPort = { getCartProducts: vi.fn() };
    const service = new ClientsService(prismaMock as never, identityMock, sequenceMock as never, catalogCartMock);
    new ClientsListener(service).setup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  describe('client.approved', () => {
    it('materializes the linked PosClient on first emission', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ posClientId: null });
      posClientCreateMock.mockResolvedValueOnce({ id: POS_CLIENT_ID });

      eventBus.emit('client.approved', {
        clientId: CLIENT_ID,
        posClientSeed: { name: 'John Doe', categoryId: CATEGORY_ID },
      });
      await flush();

      expect(posClientCreateMock).toHaveBeenCalledTimes(1);
      expect(clientUpdateMock).toHaveBeenCalledWith({ where: { id: CLIENT_ID }, data: { posClientId: POS_CLIENT_ID } });
    });

    it('replay ⇒ exactly one PosClient (idempotent by Client.posClientId already set)', async () => {
      clientFindUniqueMock.mockResolvedValueOnce({ posClientId: null });
      posClientCreateMock.mockResolvedValueOnce({ id: POS_CLIENT_ID });

      eventBus.emit('client.approved', { clientId: CLIENT_ID, posClientSeed: { name: 'John Doe', categoryId: CATEGORY_ID } });
      await flush();

      // Second emission of the *same* event: the guard now sees posClientId already set.
      clientFindUniqueMock.mockResolvedValueOnce({ posClientId: POS_CLIENT_ID });
      eventBus.emit('client.approved', { clientId: CLIENT_ID, posClientSeed: { name: 'John Doe', categoryId: CATEGORY_ID } });
      await flush();

      expect(posClientCreateMock).toHaveBeenCalledTimes(1);
    });
  });

  // These four apply their event's own one-shot delta (credit as a `set` from the emitting
  // module's own snapshot where one exists; totalPaid/totalSold as plain increments per the
  // spec's literal wording) — correctness relies on the emitting module firing exactly once per
  // document, the same single-emission guarantee purchasing's own DRAFT→CONFIRMED guard already
  // provides its listener (see clients.service.ts's applySaleConfirmed comment). Not tested here
  // as ledger-replay-safe, since that would require SaleStatus/OrderStatus filtering rules that
  // belong to the not-yet-built sales/orders modules.
  describe('dormant cache handlers — one-shot application', () => {
    it('sale.confirmed sets the credit snapshot and increments totalPaid/totalSold', async () => {
      eventBus.emit('sale.confirmed', {
        saleId: 's1',
        origin: 'POS' as never,
        posClientId: POS_CLIENT_ID,
        totalAmount: 1000,
        paidAmount: 800,
        newCredit: 200,
        snapshotLines: [],
      });
      await flush();

      expect(posClientUpdateMock).toHaveBeenCalledWith({
        where: { id: POS_CLIENT_ID },
        data: { credit: 200, totalPaid: { increment: 800 }, totalSold: { increment: 1000 } },
      });
    });

    it('payment.clientRecorded sets credit and increments totalPaid', async () => {
      eventBus.emit('payment.clientRecorded', {
        paymentId: 'p1',
        posClientId: POS_CLIENT_ID,
        amount: 500,
        previousCredit: 1000,
        newCredit: 500,
      });
      await flush();

      expect(posClientUpdateMock).toHaveBeenCalledWith({
        where: { id: POS_CLIENT_ID },
        data: { credit: 500, totalPaid: { increment: 500 } },
      });
    });
  });

  describe('error isolation', () => {
    it('swallows a handler failure — never propagates back into eventBus.emit', async () => {
      posClientUpdateMock.mockRejectedValueOnce(new Error('db down'));

      expect(() =>
        eventBus.emit('payment.clientRecorded', {
          paymentId: 'p1',
          posClientId: POS_CLIENT_ID,
          amount: 500,
          previousCredit: 1000,
          newCredit: 500,
        }),
      ).not.toThrow();
      await flush();

      expect(loggerErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'payment.clientRecorded' }),
        expect.any(String),
      );
    });
  });
});
