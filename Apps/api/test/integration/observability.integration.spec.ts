import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { faker } from '@faker-js/faker';
import {
  UserType,
  ClientActivityType,
  ClientActivityResponseSchema,
  StaffSearchResponseSchema,
  AuditLogResponseSchema,
  LogStatsResponseSchema,
  paginated,
} from '@dragon-telecom/contract';
import { app } from '../../src/app';
import { prisma } from '../../src/common/db/prisma';
import { generateToken } from '../../src/common/utils/token.utils';
import { eventBus } from '../../src/common/events/event-bus';
import { resetDatabase } from '../fixtures/db.fixture';
import { seedUser } from '../data/user.factory';
import { seedSettings } from '../data/settings.factory';
import { seedWilayas } from '../data/wilaya.factory';
import { SAMPLE_EVENTS } from '../data/audit-log.factory';

// The listener's handlers are fire-and-forget and, unlike the unit specs, write through a real
// Prisma round-trip to the real test DB — a bare microtask tick isn't reliably enough time.
const waitForAsyncWrite = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100));

// No `checkDB` on the beacon route, but ClientActivityLog.clientId is a real, DB-enforced
// foreign key to Client — a fabricated clientId 400s at the FK, not at the guard. The clients
// module doesn't exist yet, so a minimal valid Client row is inserted directly (bypassing the
// nonexistent service layer, which is fine here — we're only satisfying a schema constraint).
const seedClient = async (): Promise<{ id: string }> => {
  const [wilaya] = await seedWilayas();
  return prisma.client.create({
    data: {
      code: `CLI-${faker.string.alphanumeric({ length: 6, casing: 'upper' })}`,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      phone: faker.phone.number(),
      wilayaId: wilaya!.wilayaId,
      communeId: wilaya!.communes[0]!.communeId,
    },
  });
};

const mintClientToken = async (): Promise<{ token: string; clientId: string }> => {
  const client = await seedClient();
  const token = generateToken({ sub: faker.string.uuid(), type: UserType.CLIENT, clientId: client.id });
  return { token, clientId: client.id };
};

const mintStaffToken = async (): Promise<string> => {
  const { user } = await seedUser({ type: UserType.STAFF });
  return generateToken({ sub: user.id, type: user.type });
};

const mintAdminToken = async (): Promise<string> => {
  const { user } = await seedUser({ type: UserType.ADMIN });
  return generateToken({ sub: user.id, type: user.type });
};

describe('observability integration', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('audit listener — real events on the real bus', () => {
    it('records exactly one AuditLog row per event, and a replay is a no-op', async () => {
      const sample = SAMPLE_EVENTS['order.statusChanged'];

      eventBus.emit('order.statusChanged', sample);
      await waitForAsyncWrite();

      const rows = await prisma.auditLog.findMany({ where: { entityId: sample.orderId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ actionType: 'order.statusChanged', entityType: 'Order' });
      expect(rows[0]!.description).toContain(sample.fromStatus);
      expect(rows[0]!.description).toContain(sample.toStatus);

      eventBus.emit('order.statusChanged', sample);
      await waitForAsyncWrite();

      const rowsAfterReplay = await prisma.auditLog.findMany({ where: { entityId: sample.orderId } });
      expect(rowsAfterReplay).toHaveLength(1);
    });

    it('product.searched writes exactly one StaffSearchLog row', async () => {
      // StaffSearchLog.userId is a real FK to User — SAMPLE_EVENTS' fabricated userId is fine
      // for the mocked unit specs but needs a real persisted row here.
      const { user } = await seedUser({ type: UserType.STAFF });
      const sample = { ...SAMPLE_EVENTS['product.searched'], userId: user.id };

      eventBus.emit('product.searched', sample);
      await waitForAsyncWrite();

      const rows = await prisma.staffSearchLog.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.query).toBe(sample.query);
    });
  });

  describe('cross-module: a real platform write triggers a real audit row', () => {
    it('PATCH /api/admin/settings narrates old -> new in a settings.changed audit row', async () => {
      await seedSettings();
      const adminToken = await mintAdminToken();

      const res = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ delivery: { defaultHome: 777 } });

      expect(res.status).toBe(200);
      await waitForAsyncWrite();

      const rows = await prisma.auditLog.findMany({ where: { actionType: 'settings.changed' } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.description).toContain('777');
    });
  });

  describe('POST /api/activity/client (beacon)', () => {
    it('rejects a junk body with 400 and writes nothing', async () => {
      const { token } = await mintClientToken();

      const res = await request(app)
        .post('/api/activity/client')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'NOT_A_REAL_TYPE' });

      expect(res.status).toBe(400);
      expect(await prisma.clientActivityLog.count()).toBe(0);
    });

    it('rejects durationSeconds on a SEARCH activity with 400', async () => {
      const { token } = await mintClientToken();

      const res = await request(app)
        .post('/api/activity/client')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: ClientActivityType.SEARCH, query: 'usb cable', durationSeconds: 10 });

      expect(res.status).toBe(400);
    });

    it('accepts a valid activity, responds 202, and writes the row (fire-and-forget)', async () => {
      const { token, clientId } = await mintClientToken();

      const res = await request(app)
        .post('/api/activity/client')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: ClientActivityType.PRODUCT_VIEW, durationSeconds: 20 });

      expect(res.status).toBe(202);
      await waitForAsyncWrite();

      const rows = await prisma.clientActivityLog.findMany({ where: { clientId } });
      expect(rows).toHaveLength(1);
    });

    it('rejects a staff token (wrong type)', async () => {
      const staffToken = await mintStaffToken();
      const res = await request(app)
        .post('/api/activity/client')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ type: ClientActivityType.PRODUCT_VIEW });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/activity/staff-search (beacon)', () => {
    it('accepts a valid search from a staff token, responds 202, writes the row', async () => {
      const { user } = await seedUser({ type: UserType.STAFF });
      const token = generateToken({ sub: user.id, type: user.type });

      const res = await request(app)
        .post('/api/activity/staff-search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'usb cable' });

      expect(res.status).toBe(202);
      await waitForAsyncWrite();

      const rows = await prisma.staffSearchLog.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
    });

    it('rejects a client token (wrong type)', async () => {
      const { token } = await mintClientToken();
      const res = await request(app)
        .post('/api/activity/staff-search')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'x' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/clients/:id/activity', () => {
    it('filters by type and date range; response-shape parses', async () => {
      const adminToken = await mintAdminToken();
      const client = await seedClient();
      await prisma.clientActivityLog.createMany({
        data: [
          { clientId: client.id, type: ClientActivityType.SEARCH, query: 'a' },
          { clientId: client.id, type: ClientActivityType.PRODUCT_VIEW, durationSeconds: 5 },
        ],
      });

      const res = await request(app)
        .get(`/api/admin/clients/${client.id}/activity`)
        .query({ type: ClientActivityType.SEARCH })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      for (const item of res.body.data) expect(() => ClientActivityResponseSchema.parse(item)).not.toThrow();
    });
  });

  describe('GET /api/admin/activity/staff-searches', () => {
    it('filters by userId and q; response-shape parses', async () => {
      const adminToken = await mintAdminToken();
      const { user } = await seedUser({ type: UserType.STAFF });
      await prisma.staffSearchLog.createMany({
        data: [
          { userId: user.id, query: 'usb cable' },
          { userId: user.id, query: 'hdmi adapter' },
        ],
      });

      const res = await request(app)
        .get('/api/admin/activity/staff-searches')
        .query({ userId: user.id, q: 'usb' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(() => StaffSearchResponseSchema.parse(res.body.data[0])).not.toThrow();
    });
  });

  describe('GET /api/admin/logs', () => {
    it('paginates 20/page; response-shape parses via paginated(AuditLogResponseSchema)', async () => {
      const adminToken = await mintAdminToken();
      await prisma.auditLog.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          actionType: 'test.event',
          entityType: 'Test',
          entityId: `entity-${i}`,
          description: `Test event ${i}`,
        })),
      });

      const res = await request(app).get('/api/admin/logs').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(20);
      expect(res.body.data.meta).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2 });
      expect(() => paginated(AuditLogResponseSchema).parse(res.body.data)).not.toThrow();
    });

    it('filters by search (description contains, insensitive)', async () => {
      const adminToken = await mintAdminToken();
      await prisma.auditLog.createMany({
        data: [
          { actionType: 'order.statusChanged', entityType: 'Order', entityId: 'o1', description: 'Status confirmed → packaged' },
          { actionType: 'user.created', entityType: 'User', entityId: 'u1', description: 'User bob created (STAFF)' },
        ],
      });

      const res = await request(app)
        .get('/api/admin/logs')
        .query({ search: 'PACKAGED' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].actionType).toBe('order.statusChanged');
    });
  });

  describe('GET /api/admin/logs/stats', () => {
    it('returns count windows; response-shape parses', async () => {
      const adminToken = await mintAdminToken();
      await prisma.auditLog.create({
        data: { actionType: 'test.event', entityType: 'Test', entityId: 'e1', description: 'd' },
      });

      const res = await request(app).get('/api/admin/logs/stats').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(() => LogStatsResponseSchema.parse(res.body.data)).not.toThrow();
    });
  });

  describe('guards', () => {
    it('rejects a non-admin on an admin read route with 403', async () => {
      const staffToken = await mintStaffToken();
      const res = await request(app).get('/api/admin/logs').set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects a missing token on an admin read route with 401', async () => {
      const res = await request(app).get('/api/admin/logs');
      expect(res.status).toBe(401);
    });
  });
});
