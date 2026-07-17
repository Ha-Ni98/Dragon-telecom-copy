import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { eventBus } from '../../../../src/common/events/event-bus';
import { ObservabilityService } from '../../../../src/modules/observability/observability.service';
import { ObservabilityListener } from '../../../../src/modules/observability/observability.listener';
import { SAMPLE_EVENTS } from '../../../data/audit-log.factory';

const {
  auditLogFindFirstMock,
  auditLogCreateMock,
  staffSearchLogCreateMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  auditLogFindFirstMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  staffSearchLogCreateMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@common/config/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const prismaMock = {
  auditLog: { findFirst: auditLogFindFirstMock, create: auditLogCreateMock },
  staffSearchLog: { create: staffSearchLogCreateMock },
};

// The listener's handlers are fire-and-forget (never awaited by eventBus.emit, by design — see
// the "never throws into the emitter" guarantee); this lets their internal async work drain
// before assertions run.
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('ObservabilityListener', () => {
  // Registered exactly once for the whole file: eventBus is a module-level singleton, and
  // calling setup() more than once would attach duplicate listeners, double-invoking the
  // service per emit.
  beforeAll(() => {
    const service = new ObservabilityService(prismaMock as never);
    new ObservabilityListener(service).setup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    auditLogFindFirstMock.mockResolvedValue(null);
  });

  describe('narration', () => {
    it('order.statusChanged narrates both the from and to status', async () => {
      const sample = SAMPLE_EVENTS['order.statusChanged'];
      eventBus.emit('order.statusChanged', sample);
      await flush();

      expect(auditLogCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: 'order.statusChanged',
          entityType: 'Order',
          entityId: sample.orderId,
          description: expect.stringContaining(sample.fromStatus),
        }),
      });
      const { description } = (auditLogCreateMock.mock.calls[0] as [{ data: { description: string } }])[0].data;
      expect(description).toContain(sample.fromStatus);
      expect(description).toContain(sample.toStatus);
    });

    it('posClient.creditChanged narrates both previousCredit and newCredit', async () => {
      const sample = SAMPLE_EVENTS['posClient.creditChanged'];
      eventBus.emit('posClient.creditChanged', sample);
      await flush();

      const { description } = (auditLogCreateMock.mock.calls[0] as [{ data: { description: string } }])[0].data;
      expect(description).toContain(String(sample.previousCredit));
      expect(description).toContain(String(sample.newCredit));
      expect(description).toContain(sample.cause);
    });

    it('settings.changed uses the payload description verbatim', async () => {
      const sample = SAMPLE_EVENTS['settings.changed'];
      eventBus.emit('settings.changed', sample);
      await flush();

      expect(auditLogCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ actionType: 'settings.changed', entityType: 'Settings', description: sample.description }),
      });
    });

    it('deliveryFees.changed uses the payload description verbatim', async () => {
      const sample = SAMPLE_EVENTS['deliveryFees.changed'];
      eventBus.emit('deliveryFees.changed', sample);
      await flush();

      expect(auditLogCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ actionType: 'deliveryFees.changed', entityType: 'DeliveryFee', description: sample.description }),
      });
    });

    it('auth.loggedIn narrates the actor and sets alwaysAppend (skips the dedupe check)', async () => {
      const sample = SAMPLE_EVENTS['auth.loggedIn'];
      eventBus.emit('auth.loggedIn', sample);
      await flush();

      expect(auditLogFindFirstMock).not.toHaveBeenCalled();
      expect(auditLogCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: 'auth.loggedIn',
          entityType: 'User',
          entityId: sample.userId,
          userId: sample.userId,
          ipAddress: sample.ipAddress,
        }),
      });
    });
  });

  describe('idempotency', () => {
    it('replaying an already-recorded event is a no-op (still exactly one row)', async () => {
      const sample = SAMPLE_EVENTS['settings.changed'];
      auditLogFindFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'existing' });

      eventBus.emit('settings.changed', sample);
      await flush();
      eventBus.emit('settings.changed', sample);
      await flush();

      expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('resilience', () => {
    it('swallows a failing recordAuditEvent without throwing into the emitter, and logs it', async () => {
      auditLogFindFirstMock.mockRejectedValueOnce(new Error('boom'));

      expect(() => eventBus.emit('settings.changed', SAMPLE_EVENTS['settings.changed'])).not.toThrow();
      await flush();

      expect(loggerErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'settings.changed' }),
        expect.any(String),
      );
    });
  });

  describe('activity — product.searched', () => {
    it('writes exactly one StaffSearchLog row from the event payload', async () => {
      const sample = SAMPLE_EVENTS['product.searched'];
      eventBus.emit('product.searched', sample);
      await flush();

      expect(staffSearchLogCreateMock).toHaveBeenCalledTimes(1);
      expect(staffSearchLogCreateMock).toHaveBeenCalledWith({
        data: { userId: sample.userId, query: sample.query },
      });
      // Never touches the audit sink — activity and audit are separate concerns.
      expect(auditLogCreateMock).not.toHaveBeenCalled();
    });
  });
});
