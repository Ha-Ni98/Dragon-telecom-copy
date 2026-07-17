import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  DocType,
  FeeSource,
  UserType,
  WilayaResponseSchema,
  FeeResponseSchema,
  SettingsResponseSchema,
  PublicSettingsResponseSchema,
  AdminFeesResponseSchema,
} from '@dragon-telecom/contract';
import { app } from '../../src/app';
import { prisma } from '../../src/common/db/prisma';
import { generateToken } from '../../src/common/utils/token.utils';
import { eventBus } from '../../src/common/events/event-bus';
import { sequenceService, deliveryFeeService } from '../../src/modules/platform/platform.routes';
import { resetDatabase } from '../fixtures/db.fixture';
import { seedUser } from '../data/user.factory';
import { seedWilayas } from '../data/wilaya.factory';
import { seedFee } from '../data/delivery-fee.factory';
import { seedSettings } from '../data/settings.factory';
import { validFeesWorkbook, mixedFeesWorkbook } from '../data/fees-import.fixture';
import { DEFAULT_SETTINGS } from '../../prisma/settings-defaults';

const mintAdminToken = async (): Promise<string> => {
  const { user } = await seedUser({ type: UserType.ADMIN });
  return generateToken({ sub: user.id, type: user.type });
};

describe('platform integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedSettings();
  });

  describe('GET /api/wilayas (public)', () => {
    it('returns bilingual wilayas with nested communes, no auth required', async () => {
      await seedWilayas();

      const res = await request(app).get('/api/wilayas');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      const first = res.body.data[0];
      expect(first.frName).toBeTruthy();
      expect(first.arName).toBeTruthy();
      expect(Array.isArray(first.communes)).toBe(true);
      for (const wilaya of res.body.data) expect(() => WilayaResponseSchema.parse(wilaya)).not.toThrow();
    });
  });

  describe('GET /api/delivery-fees (public) — resolution precedence', () => {
    it('resolves commune → wilaya → default, reporting the correct source', async () => {
      const [seededWilaya] = await seedWilayas();
      const wilayaId = seededWilaya!.wilayaId;
      const communeId = seededWilaya!.communes[0]!.communeId;

      // 1. No fee row at all -> settings default
      const defaultRes = await request(app).get('/api/delivery-fees').query({ wilayaId, communeId });
      expect(defaultRes.status).toBe(200);
      expect(defaultRes.body.data).toEqual({
        deliveryHome: DEFAULT_SETTINGS.delivery.defaultHome,
        deliveryOffice: DEFAULT_SETTINGS.delivery.defaultOffice,
        source: FeeSource.DEFAULT,
      });
      expect(() => FeeResponseSchema.parse(defaultRes.body.data)).not.toThrow();

      // 2. A wilaya-level row -> source: wilaya
      await seedFee({ wilayaId, communeId: null, deliveryHome: 600, deliveryOffice: 350 });
      const wilayaRes = await request(app).get('/api/delivery-fees').query({ wilayaId, communeId });
      expect(wilayaRes.body.data).toEqual({ deliveryHome: 600, deliveryOffice: 350, source: FeeSource.WILAYA });

      // 3. A commune-level override -> source: commune (wins over the wilaya row)
      await seedFee({ wilayaId, communeId, deliveryHome: 800, deliveryOffice: 450 });
      const communeRes = await request(app).get('/api/delivery-fees').query({ wilayaId, communeId });
      expect(communeRes.body.data).toEqual({ deliveryHome: 800, deliveryOffice: 450, source: FeeSource.COMMUNE });
    });
  });

  describe('GET/PUT /api/admin/delivery-fees (admin)', () => {
    it('round-trips: PUT a wilaya-level fee, then GET reflects it', async () => {
      const token = await mintAdminToken();
      const [seededWilaya] = await seedWilayas();
      const wilayaId = seededWilaya!.wilayaId;

      const putRes = await request(app)
        .put('/api/admin/delivery-fees')
        .set('Authorization', `Bearer ${token}`)
        .send({ rows: [{ wilayaId, communeId: null, deliveryHome: 700, deliveryOffice: 400 }] });

      expect(putRes.status).toBe(200);
      expect(() => AdminFeesResponseSchema.parse(putRes.body.data)).not.toThrow();
      const putWilaya = putRes.body.data.wilayas.find((w: { wilayaId: string }) => w.wilayaId === wilayaId);
      expect(putWilaya).toMatchObject({ deliveryHome: 700, deliveryOffice: 400 });

      const getRes = await request(app).get('/api/admin/delivery-fees').set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      const getWilaya = getRes.body.data.wilayas.find((w: { wilayaId: string }) => w.wilayaId === wilayaId);
      expect(getWilaya).toMatchObject({ deliveryHome: 700, deliveryOffice: 400 });
    });
  });

  describe('POST /api/admin/delivery-fees/import (admin)', () => {
    it('rejects the whole file when one row is invalid, writing nothing', async () => {
      const token = await mintAdminToken();
      const [seededWilaya] = await seedWilayas();
      const buffer = await mixedFeesWorkbook(seededWilaya!.wilayaCode);

      const res = await request(app)
        .post('/api/admin/delivery-fees/import')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', buffer, 'fees.xlsx');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details.errors.length).toBeGreaterThan(0);

      const feeCount = await prisma.deliveryFee.count();
      expect(feeCount).toBe(0);
    });

    it('imports a well-formed file successfully', async () => {
      const token = await mintAdminToken();
      const [seededWilaya] = await seedWilayas();
      const buffer = await validFeesWorkbook(seededWilaya!.wilayaCode, 500, 300);

      const res = await request(app)
        .post('/api/admin/delivery-fees/import')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', buffer, 'fees.xlsx');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ imported: 1 });

      const fee = await prisma.deliveryFee.findFirst({ where: { wilayaId: seededWilaya!.wilayaId, communeId: null } });
      expect(fee).toMatchObject({ deliveryHome: expect.anything(), deliveryOffice: expect.anything() });
    });
  });

  describe('GET /api/admin/delivery-fees/export (admin) — round-trips with import', () => {
    it('re-importing an exported excel file is a no-op', async () => {
      const token = await mintAdminToken();
      const [seededWilaya] = await seedWilayas();
      const wilayaId = seededWilaya!.wilayaId;
      await seedFee({ wilayaId, communeId: null, deliveryHome: 650, deliveryOffice: 375 });

      // superagent only auto-buffers a handful of registered mime types (json/text/octet-stream/
      // pdf/image) into `res.body` — an xlsx spreadsheetml response isn't one of them, so an
      // explicit binary parser is needed to get the raw bytes back out as a Buffer.
      const exportRes = await request(app)
        .get('/api/admin/delivery-fees/export')
        .set('Authorization', `Bearer ${token}`)
        .buffer()
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(exportRes.status).toBe(200);
      expect(exportRes.headers['content-type']).toContain('spreadsheetml');

      await prisma.deliveryFee.deleteMany();

      const importRes = await request(app)
        .post('/api/admin/delivery-fees/import')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', exportRes.body as Buffer, 'export.xlsx');

      expect(importRes.status).toBe(200);
      expect(importRes.body.data).toEqual({ imported: 1 });

      const restored = await prisma.deliveryFee.findFirst({ where: { wilayaId, communeId: null } });
      expect(restored?.deliveryHome.toNumber()).toBe(650);
      expect(restored?.deliveryOffice.toNumber()).toBe(375);
    });
  });

  describe('GET/PATCH /api/admin/settings (admin)', () => {
    it('GET returns defaults; PATCH updates and narrates old -> new via settings.changed', async () => {
      const token = await mintAdminToken();

      const getRes = await request(app).get('/api/admin/settings').set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(() => SettingsResponseSchema.parse(getRes.body.data)).not.toThrow();
      expect(getRes.body.data.delivery).toEqual(DEFAULT_SETTINGS.delivery);

      const emitted: { description: string }[] = [];
      const listener = (payload: { description: string }) => emitted.push(payload);
      eventBus.on('settings.changed', listener);

      const patchRes = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ delivery: { defaultHome: 999 } });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.delivery.defaultHome).toBe(999);
      expect(emitted).toHaveLength(1);
      expect(emitted[0]!.description).toContain('500');
      expect(emitted[0]!.description).toContain('999');
    });

    it('rejects a nextSequences decrease with 409', async () => {
      const token = await mintAdminToken();
      const lowered = { ...DEFAULT_SETTINGS.invoicing.nextSequences, [DocType.SALE]: 0 };

      const res = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ invoicing: { nextSequences: lowered } });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/settings/public (public)', () => {
    it('exposes only the storefront section, no auth required', async () => {
      const res = await request(app).get('/api/settings/public');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.data)).toEqual(['storefront']);
      expect(() => PublicSettingsResponseSchema.parse(res.body.data)).not.toThrow();
    });
  });

  describe('SequenceService (injected, no HTTP route)', () => {
    it('is monotonic under concurrency and never reuses a number', async () => {
      const numbers = await Promise.all(
        Array.from({ length: 5 }, () => prisma.$transaction((tx) => sequenceService.nextNumber(tx, DocType.SALE))),
      );

      expect(new Set(numbers).size).toBe(5);
      const suffixes = numbers.map((n) => Number(n.split('-').pop())).sort((a, b) => a - b);
      expect(suffixes).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('DeliveryFeeService (injected, no HTTP route)', () => {
    it('resolves the requested leg through the same precedence as the public route', async () => {
      const [seededWilaya] = await seedWilayas();
      await seedFee({ wilayaId: seededWilaya!.wilayaId, communeId: null, deliveryHome: 600, deliveryOffice: 350 });

      const home = await deliveryFeeService.resolve(seededWilaya!.wilayaId, null, 'home');
      expect(home).toBe(600);
    });
  });

  describe('guards', () => {
    it('rejects a non-admin on an admin route with 403', async () => {
      const { user } = await seedUser({ type: UserType.STAFF });
      const token = generateToken({ sub: user.id, type: user.type });

      const res = await request(app).get('/api/admin/settings').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('rejects a missing token on an admin route with 401', async () => {
      const res = await request(app).get('/api/admin/settings');
      expect(res.status).toBe(401);
    });

    it('reaches public routes unauthenticated', async () => {
      const res = await request(app).get('/api/wilayas');
      expect(res.status).toBe(200);
    });
  });
});
