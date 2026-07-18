import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientActivityType } from '@dragon-telecom/contract';
import { ObservabilityService } from '../../../../src/modules/observability/observability.service';

const {
  clientActivityLogCreateMock,
  clientActivityLogFindManyMock,
  staffSearchLogCreateMock,
  staffSearchLogFindManyMock,
  auditLogFindFirstMock,
  auditLogCreateMock,
  auditLogFindManyMock,
  auditLogCountMock,
  transactionMock,
} = vi.hoisted(() => ({
  clientActivityLogCreateMock: vi.fn(),
  clientActivityLogFindManyMock: vi.fn(),
  staffSearchLogCreateMock: vi.fn(),
  staffSearchLogFindManyMock: vi.fn(),
  auditLogFindFirstMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  auditLogFindManyMock: vi.fn(),
  auditLogCountMock: vi.fn(),
  transactionMock: vi.fn(),
}));

const prismaMock = {
  clientActivityLog: { create: clientActivityLogCreateMock, findMany: clientActivityLogFindManyMock },
  staffSearchLog: { create: staffSearchLogCreateMock, findMany: staffSearchLogFindManyMock },
  auditLog: { findFirst: auditLogFindFirstMock, create: auditLogCreateMock, findMany: auditLogFindManyMock, count: auditLogCountMock },
  $transaction: transactionMock,
};

describe('ObservabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  const service = () => new ObservabilityService(prismaMock as never);

  describe('recordClientActivity', () => {
    it('maps fields onto a ClientActivityLog row, omitting absent optionals', async () => {
      await service().recordClientActivity('client-1', { type: ClientActivityType.SEARCH, query: 'usb cable' });

      expect(clientActivityLogCreateMock).toHaveBeenCalledWith({
        data: { clientId: 'client-1', type: ClientActivityType.SEARCH, query: 'usb cable' },
      });
    });

    it('includes productId and durationSeconds when present', async () => {
      await service().recordClientActivity('client-1', {
        type: ClientActivityType.PRODUCT_VIEW,
        productId: 'product-1',
        durationSeconds: 42,
      });

      expect(clientActivityLogCreateMock).toHaveBeenCalledWith({
        data: { clientId: 'client-1', type: ClientActivityType.PRODUCT_VIEW, productId: 'product-1', durationSeconds: 42 },
      });
    });
  });

  describe('recordStaffSearch', () => {
    it('maps userId + query, omitting matchedProductId when absent', async () => {
      await service().recordStaffSearch('user-1', { query: 'usb cable' });
      expect(staffSearchLogCreateMock).toHaveBeenCalledWith({ data: { userId: 'user-1', query: 'usb cable' } });
    });
  });

  describe('recordProductSearched', () => {
    it('writes a StaffSearchLog row from the event payload', async () => {
      await service().recordProductSearched({ userId: 'user-1', query: 'usb cable', matchedProductId: 'product-1' });
      expect(staffSearchLogCreateMock).toHaveBeenCalledWith({
        data: { userId: 'user-1', query: 'usb cable', matchedProductId: 'product-1' },
      });
    });
  });

  describe('recordAuditEvent', () => {
    const entry = { actionType: 'order.statusChanged', entityType: 'Order', entityId: 'order-1', description: 'status a → b' };

    it('is a no-op when an identical row already exists (replay)', async () => {
      auditLogFindFirstMock.mockResolvedValueOnce({ id: 'existing' });

      await service().recordAuditEvent(entry);

      expect(auditLogFindFirstMock).toHaveBeenCalledWith({
        where: {
          actionType: entry.actionType,
          entityType: entry.entityType,
          entityId: entry.entityId,
          description: entry.description,
        },
      });
      expect(auditLogCreateMock).not.toHaveBeenCalled();
    });

    it('creates the row when no identical one exists', async () => {
      auditLogFindFirstMock.mockResolvedValueOnce(null);

      await service().recordAuditEvent({ ...entry, userId: 'user-1', ipAddress: '10.0.0.1' });

      expect(auditLogCreateMock).toHaveBeenCalledWith({
        data: { ...entry, userId: 'user-1', ipAddress: '10.0.0.1' },
      });
    });

    it('always appends (skips the dedupe check) when alwaysAppend is set, even if a matching row exists', async () => {
      await service().recordAuditEvent({ ...entry, alwaysAppend: true });

      expect(auditLogFindFirstMock).not.toHaveBeenCalled();
      expect(auditLogCreateMock).toHaveBeenCalledWith({ data: entry });
    });
  });

  describe('getClientActivity', () => {
    it('filters by type and date range, joins product, newest first', async () => {
      clientActivityLogFindManyMock.mockResolvedValueOnce([
        { id: 'a', clientId: 'client-1', type: ClientActivityType.SEARCH, query: 'x', productId: null, durationSeconds: null, createdAt: new Date(), product: null },
      ]);

      const result = await service().getClientActivity('client-1', {
        type: ClientActivityType.SEARCH,
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(clientActivityLogFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: 'client-1',
            type: ClientActivityType.SEARCH,
            createdAt: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
          }),
          include: { product: true },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('product');
    });
  });

  describe('listStaffSearches', () => {
    it('filters by userId, date range, and q (contains, insensitive)', async () => {
      staffSearchLogFindManyMock.mockResolvedValueOnce([]);

      await service().listStaffSearches({ userId: 'user-1', q: 'cable' });

      expect(staffSearchLogFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', query: { contains: 'cable', mode: 'insensitive' } },
          include: { user: true, matchedProduct: true },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('listLogs', () => {
    it('filters, paginates, and returns meta', async () => {
      auditLogCountMock.mockResolvedValueOnce(42);
      auditLogFindManyMock.mockResolvedValueOnce([]);

      const result = await service().listLogs({ page: 2, limit: 20, actionType: 'order.statusChanged' });

      expect(auditLogFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { actionType: 'order.statusChanged' }, skip: 20, take: 20 }),
      );
      expect(result.meta).toEqual({ page: 2, limit: 20, total: 42, totalPages: 3 });
    });

    it('filters by search (description contains, insensitive)', async () => {
      auditLogCountMock.mockResolvedValueOnce(0);
      auditLogFindManyMock.mockResolvedValueOnce([]);

      await service().listLogs({ page: 1, limit: 20, search: 'packaged' });

      expect(auditLogFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { description: { contains: 'packaged', mode: 'insensitive' } } }),
      );
    });
  });

  describe('getLogStats', () => {
    it('returns the four count windows', async () => {
      auditLogCountMock.mockResolvedValueOnce(100).mockResolvedValueOnce(5).mockResolvedValueOnce(20).mockResolvedValueOnce(60);

      const stats = await service().getLogStats();

      expect(stats).toEqual({ total: 100, today: 5, week: 20, month: 60 });
    });
  });
});
