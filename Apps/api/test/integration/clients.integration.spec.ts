import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { UserType as PrismaUserType } from '@prisma/client';
import {
  UserType,
  PageKey,
  ClientMeResponseSchema,
  AdminClientResponseSchema,
  PosClientResponseSchema,
  ClientStatsResponseSchema,
  paginated,
} from '@dragon-telecom/contract';
import { app } from '../../src/app';
import { prisma } from '../../src/common/db/prisma';
import { eventBus } from '../../src/common/events/event-bus';
import { generateToken } from '../../src/common/utils/token.utils';
import { resetDatabase } from '../fixtures/db.fixture';
import { seedWilayas } from '../data/wilaya.factory';
import { seedSettings } from '../data/settings.factory';
import { seedUser } from '../data/user.factory';
import { seedClientUser } from '../data/client.factory';
import { seedClientCategory } from '../data/client-category.factory';
import { seedPosClient } from '../data/pos-client.factory';
import { seedBrand } from '../data/brand.factory';
import { seedFamily } from '../data/family.factory';
import { seedProduct } from '../data/product.factory';
import { seedRefreshToken } from '../data/refresh-token.factory';
import { seedPages } from '../data/page.factory';
import { seedRole } from '../data/role.factory';

// Same convention as identity.integration.spec.ts: admin routes use requireAuth({checkDB:true}),
// which does a real DB lookup by sub, so tokens must be minted for real persisted users.
const mintTokenFor = (user: { id: string; type: PrismaUserType; staff?: { id: string } | null }): string =>
  generateToken({ sub: user.id, type: user.type as UserType, ...(user.staff ? { staffId: user.staff.id } : {}) });

// The `client.approved` listener runs post-commit, asynchronously (real DB I/O — a single
// microtask flush isn't enough, unlike the mocked-Prisma unit/listener specs) — poll until the
// observable effect (Client.posClientId) lands or the timeout trips.
const waitFor = async (check: () => Promise<boolean>, timeoutMs = 2000, intervalMs = 25): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('waitFor: condition not met within timeout');
};

describe('clients integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedSettings();
  });

  describe('phone / register', () => {
    it('reports available, then pending after register, and 409s a duplicate register', async () => {
      const [wilaya] = await seedWilayas();

      const availableRes = await request(app).post('/api/auth/validate-phone').send({ phone: '0550000001' });
      expect(availableRes.status).toBe(200);
      expect(availableRes.body.data).toEqual({ isValid: true, status: 'available' });

      const registerRes = await request(app).post('/api/auth/register').send({
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '0550000001',
        wilayaId: wilaya!.wilayaId,
        communeId: wilaya!.communes[0]!.communeId,
      });
      expect(registerRes.status).toBe(201);
      expect(typeof registerRes.body.data.id).toBe('string');

      const pendingRes = await request(app).post('/api/auth/validate-phone').send({ phone: '0550000001' });
      expect(pendingRes.body.data).toEqual({ isValid: false, status: 'pending' });

      const dupRes = await request(app).post('/api/auth/register').send({
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '0550000001',
        wilayaId: wilaya!.wilayaId,
        communeId: wilaya!.communes[0]!.communeId,
      });
      expect(dupRes.status).toBe(409);
    });
  });

  describe('me', () => {
    it('GET returns money proxied from the linked PosClient, with no status/category leak', async () => {
      const [wilaya] = await seedWilayas();
      const category = await seedClientCategory();
      const posClient = await seedPosClient({ categoryId: category.id });
      await prisma.posClient.update({ where: { id: posClient.id }, data: { credit: 500 } });
      const { user, client } = await seedClientUser({
        wilayaId: wilaya!.wilayaId,
        communeId: wilaya!.communes[0]!.communeId,
        posClientId: posClient.id,
      });
      const token = generateToken({ sub: user.id, type: UserType.CLIENT, clientId: client.id });

      const res = await request(app).get('/api/clients/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(() => ClientMeResponseSchema.parse(res.body.data)).not.toThrow();
      expect(res.body.data.credit).toBe(500);
      expect(res.body.data).not.toHaveProperty('status');
      expect(res.body.data).not.toHaveProperty('category');
    });

    it('PATCH with a phone field 400s — phone is immutable', async () => {
      const [wilaya] = await seedWilayas();
      const { user, client } = await seedClientUser({ wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId });
      const token = generateToken({ sub: user.id, type: UserType.CLIENT, clientId: client.id });

      const res = await request(app)
        .patch('/api/clients/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ storeName: 'New Store', phone: '0011223344' });

      expect(res.status).toBe(400);
    });

    it('PATCH updates storeName without touching phone', async () => {
      const [wilaya] = await seedWilayas();
      const { user, client } = await seedClientUser({ wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId });
      const token = generateToken({ sub: user.id, type: UserType.CLIENT, clientId: client.id });

      const res = await request(app).patch('/api/clients/me').set('Authorization', `Bearer ${token}`).send({ storeName: 'New Store' });

      expect(res.status).toBe(200);
      expect(res.body.data.storeName).toBe('New Store');
      expect(res.body.data.phone).toBe(client.phone);
    });
  });

  describe('cart', () => {
    it('add / list / remove round-trips against a real published product', async () => {
      const [wilaya] = await seedWilayas();
      const { user, client } = await seedClientUser({ wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId });
      const token = generateToken({ sub: user.id, type: UserType.CLIENT, clientId: client.id });
      const brand = await seedBrand();
      const family = await seedFamily();
      const product = await seedProduct({
        brandId: brand.id,
        familyId: family.id,
        isPublished: true,
        isEnabled: true,
        guestPrice: 500,
      });

      const addRes = await request(app).post('/api/clients/me/cart').set('Authorization', `Bearer ${token}`).send({ productId: product.id });
      expect(addRes.status).toBe(201);

      const listRes = await request(app).get('/api/clients/me/cart').set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].productId).toBe(product.id);
      expect(listRes.body.data[0].product.currentPrice).toBe(500);

      // Idempotent re-add — no conflict, no duplicate row.
      const reAddRes = await request(app).post('/api/clients/me/cart').set('Authorization', `Bearer ${token}`).send({ productId: product.id });
      expect(reAddRes.status).toBe(201);
      const listAfterReAdd = await request(app).get('/api/clients/me/cart').set('Authorization', `Bearer ${token}`);
      expect(listAfterReAdd.body.data).toHaveLength(1);

      const removeRes = await request(app).delete(`/api/clients/me/cart/${product.id}`).set('Authorization', `Bearer ${token}`);
      expect(removeRes.status).toBe(204);

      const listAfterRemove = await request(app).get('/api/clients/me/cart').set('Authorization', `Bearer ${token}`);
      expect(listAfterRemove.body.data).toEqual([]);

      // Idempotent re-remove — still 204, not a 404.
      const reRemoveRes = await request(app).delete(`/api/clients/me/cart/${product.id}`).set('Authorization', `Bearer ${token}`);
      expect(reRemoveRes.status).toBe(204);
    });
  });

  describe('approve → PosClient materialization', () => {
    it('provisions a CLIENT user, sets APPROVED, and the post-commit listener links a new PosClient', async () => {
      const [wilaya] = await seedWilayas();
      const { user: adminUser } = await seedUser({ type: UserType.ADMIN });
      const adminToken = mintTokenFor(adminUser);
      const category = await seedClientCategory();

      const registerRes = await request(app).post('/api/auth/register').send({
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '0550000002',
        wilayaId: wilaya!.wilayaId,
        communeId: wilaya!.communes[0]!.communeId,
      });
      const clientId = registerRes.body.data.id as string;

      const approveRes = await request(app)
        .post(`/api/admin/clients/${clientId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'janedoe', password: 'Password123!', categoryId: category.id });

      expect(approveRes.status).toBe(200);
      expect(() => AdminClientResponseSchema.parse(approveRes.body.data)).not.toThrow();
      expect(approveRes.body.data.status).toBe('APPROVED');

      await waitFor(async () => {
        const updated = await prisma.client.findUnique({ where: { id: clientId }, select: { posClientId: true } });
        return updated?.posClientId != null;
      });

      const loginRes = await request(app).post('/api/auth/login').send({ username: 'janedoe', password: 'Password123!' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.authType).toBe('client');
    });

    it('409s approving a non-PENDING client', async () => {
      const [wilaya] = await seedWilayas();
      const { user: adminUser } = await seedUser({ type: UserType.ADMIN });
      const adminToken = mintTokenFor(adminUser);
      const category = await seedClientCategory();
      const { client } = await seedClientUser({ wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId });

      const res = await request(app)
        .post(`/api/admin/clients/${client.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'someone', password: 'Password123!', categoryId: category.id });

      expect(res.status).toBe(409);
    });
  });

  describe('reset-password logs the client out everywhere', () => {
    it('revokes existing refresh tokens and the new password logs in', async () => {
      const [wilaya] = await seedWilayas();
      const { user: adminUser } = await seedUser({ type: UserType.ADMIN });
      const adminToken = mintTokenFor(adminUser);
      const { user, client } = await seedClientUser({ wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId });
      const { token: oldRefreshToken } = await seedRefreshToken({ userId: user.id });

      const resetRes = await request(app)
        .post(`/api/admin/clients/${client.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newPassword: 'BrandNewPass123!' });
      expect(resetRes.status).toBe(200);

      const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefreshToken });
      expect(refreshRes.status).toBe(401);

      const loginRes = await request(app).post('/api/auth/login').send({ username: user.username, password: 'BrandNewPass123!' });
      expect(loginRes.status).toBe(200);
    });
  });

  describe('admin list / detail / stats', () => {
    it('reflect the registered pipeline', async () => {
      const [wilaya] = await seedWilayas();
      const { user: adminUser } = await seedUser({ type: UserType.ADMIN });
      const adminToken = mintTokenFor(adminUser);

      await request(app).post('/api/auth/register').send({
        firstName: 'Jane', lastName: 'Doe', phone: '0550000003', wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId,
      });
      await request(app).post('/api/auth/register').send({
        firstName: 'John', lastName: 'Smith', phone: '0550000004', wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId,
      });

      const statsRes = await request(app).get('/api/admin/clients/stats').set('Authorization', `Bearer ${adminToken}`);
      expect(statsRes.status).toBe(200);
      expect(() => ClientStatsResponseSchema.parse(statsRes.body.data)).not.toThrow();
      expect(statsRes.body.data).toEqual({ totalClients: 2, pending: 2, approved: 0, rejected: 0 });

      const listRes = await request(app).get('/api/admin/clients').set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(() => paginated(AdminClientResponseSchema).parse(listRes.body.data)).not.toThrow();
      expect(listRes.body.data.items).toHaveLength(2);

      const firstId = listRes.body.data.items[0].id as string;
      const detailRes = await request(app).get(`/api/admin/clients/${firstId}`).set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.id).toBe(firstId);
    });
  });

  describe('pos-client search — OR page scope', () => {
    it('allows a staff user holding only STAFF_POS_CLIENTS (not STAFF_POS)', async () => {
      await seedPages();
      const role = await seedRole({ pageKeys: [PageKey.STAFF_POS_CLIENTS] });
      const { user: staffUser } = await seedUser({ type: UserType.STAFF, roleIds: [role.id] });
      const staffToken = mintTokenFor(staffUser);
      await seedPosClient({ name: 'Findable Shop' });

      const res = await request(app).get('/api/staff/pos-clients/search?q=Findable').set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(() => PosClientResponseSchema.parse(res.body.data[0])).not.toThrow();
    });

    it('403s a staff user holding neither STAFF_POS nor STAFF_POS_CLIENTS', async () => {
      await seedPages();
      const role = await seedRole({ pageKeys: [PageKey.STAFF_PRODUCTS] });
      const { user: staffUser } = await seedUser({ type: UserType.STAFF, roleIds: [role.id] });
      const staffToken = mintTokenFor(staffUser);

      const res = await request(app).get('/api/staff/pos-clients/search?q=x').set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });

    it('quick-create succeeds for a staff user holding STAFF_POS_CLIENTS', async () => {
      await seedPages();
      const role = await seedRole({ pageKeys: [PageKey.STAFF_POS_CLIENTS] });
      const { user: staffUser } = await seedUser({ type: UserType.STAFF, roleIds: [role.id] });
      const staffToken = mintTokenFor(staffUser);

      const res = await request(app)
        .post('/api/staff/pos-clients')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Counter Add' });

      expect(res.status).toBe(201);
      expect(() => PosClientResponseSchema.parse(res.body.data)).not.toThrow();
    });
  });

  describe('pos-client isEnabled toggle', () => {
    it('admin can disable a PosClient', async () => {
      const { user: adminUser } = await seedUser({ type: UserType.ADMIN });
      const adminToken = mintTokenFor(adminUser);
      const posClient = await seedPosClient();

      const res = await request(app)
        .patch(`/api/admin/pos-clients/${posClient.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isEnabled: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isEnabled).toBe(false);
    });
  });

  // "PosClient.credit == ledger recompute" (sprints §4 property test), scoped to what's
  // actually buildable today: credit is a `set` from whichever event's own snapshot last wrote
  // it (Sprint 3's deliberate design — see clients.service.ts's applyClientPaymentRecorded
  // comment), not a from-scratch recompute (no stored opening-balance column exists, and
  // billing/sales don't exist yet to populate a real ledger). The property this proves end to
  // end, against the real listener wired onto the real eventBus: after `payment.clientRecorded`
  // fires, the persisted PosClient.credit exactly equals that event's own `newCredit` — the
  // cache always reflects the last snapshot it was told about.
  describe('PosClient.credit reflects the emitting event\'s own snapshot (property)', () => {
    it('credit after payment.clientRecorded equals the event\'s newCredit exactly', async () => {
      const posClient = await seedPosClient();
      await prisma.posClient.update({ where: { id: posClient.id }, data: { credit: 1000 } });

      eventBus.emit('payment.clientRecorded', {
        paymentId: 'test-payment-1',
        posClientId: posClient.id,
        amount: 400,
        previousCredit: 1000,
        newCredit: 600,
      });

      await waitFor(async () => {
        const updated = await prisma.posClient.findUnique({ where: { id: posClient.id }, select: { credit: true } });
        return updated?.credit.toNumber() === 600;
      });

      const final = await prisma.posClient.findUnique({ where: { id: posClient.id } });
      expect(final?.credit.toNumber()).toBe(600);
      expect(final?.totalPaid.toNumber()).toBe(400);
    });
  });
});
