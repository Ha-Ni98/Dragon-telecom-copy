import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { UserType, ProductWithPricingResponseSchema, ProductStatsResponseSchema } from '@dragon-telecom/contract';
import { app } from '../../src/app';
import { generateToken } from '../../src/common/utils/token.utils';
import { eventBus } from '../../src/common/events/event-bus';
import { resetDatabase } from '../fixtures/db.fixture';
import { seedUser } from '../data/user.factory';
import { seedPages } from '../data/page.factory';
import { seedRole } from '../data/role.factory';
import { seedBrand } from '../data/brand.factory';
import { seedFamily } from '../data/family.factory';
import { seedProduct } from '../data/product.factory';
import { seedClientCategory } from '../data/client-category.factory';
import { seedProductPrice } from '../data/product-price.factory';
import { seedPosClient } from '../data/pos-client.factory';
import { seedClientUser } from '../data/client.factory';
import { seedWilayas } from '../data/wilaya.factory';

const mintToken = async (type: (typeof UserType)[keyof typeof UserType]): Promise<string> => {
  const { user } = await seedUser({ type: type as never });
  return generateToken({ sub: user.id, type: user.type });
};

describe('catalog integration', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('GET /api/products (public) — leak check', () => {
    it('a guest listing never carries cost, exact/reserved quantity, or sku', async () => {
      const brand = await seedBrand();
      const family = await seedFamily();
      await seedProduct({
        brandId: brand.id,
        familyId: family.id,
        guestPrice: 1000,
        quantityOnHand: 25,
        quantityReserved: 5,
        isPublished: true,
      });

      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      const item = res.body.data.items[0];
      expect(item).not.toHaveProperty('sku');
      expect(item).not.toHaveProperty('quantityOnHand');
      expect(item).not.toHaveProperty('quantityReserved');
      expect(item).not.toHaveProperty('averageCost');
      expect(() => ProductWithPricingResponseSchema.parse(item)).not.toThrow();
    });
  });

  describe('GET /api/brands (public) vs GET /api/products/:id — disabled brand', () => {
    it('hides the disabled brand from the public list but its product still resolves by id', async () => {
      const brand = await seedBrand({ isEnabled: false });
      const family = await seedFamily();
      const product = await seedProduct({
        brandId: brand.id,
        familyId: family.id,
        guestPrice: 500,
        isPublished: true,
      });

      const brandsRes = await request(app).get('/api/brands');
      expect(brandsRes.body.data.find((b: { id: string }) => b.id === brand.id)).toBeUndefined();

      const detailRes = await request(app).get(`/api/products/${product.id}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.brand.id).toBe(brand.id);
    });
  });

  describe('GET /api/products (public) — optional auth changes viewer-resolved pricing', () => {
    it('a guest and a tiered CLIENT see different currentPrice for the same product', async () => {
      const brand = await seedBrand();
      const family = await seedFamily();
      const category = await seedClientCategory();
      const product = await seedProduct({
        brandId: brand.id,
        familyId: family.id,
        guestPrice: 1000,
        isPublished: true,
      });
      await seedProductPrice({ productId: product.id, clientCategoryId: category.id, price: 700 });

      const [wilaya] = await seedWilayas();
      const posClient = await seedPosClient({ categoryId: category.id });
      const { user, client } = await seedClientUser({
        wilayaId: wilaya!.wilayaId,
        communeId: wilaya!.communes[0]!.communeId,
        posClientId: posClient.id,
      });
      const clientToken = generateToken({ sub: user.id, type: UserType.CLIENT, clientId: client.id });

      const guestRes = await request(app).get('/api/products');
      expect(guestRes.body.data.items[0].currentPrice).toBe(1000);

      const clientRes = await request(app).get('/api/products').set('Authorization', `Bearer ${clientToken}`);
      expect(clientRes.body.data.items[0].currentPrice).toBe(700);
    });
  });

  describe('POST /api/admin/products (admin) — create with stock', () => {
    it('qty>0 creates the first layer (reflected in quantityOnHand/averageCost) and unlocks pricing', async () => {
      const token = await mintToken(UserType.ADMIN);
      const brand = await seedBrand();
      const family = await seedFamily();

      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Charger',
          familyId: family.id,
          brandId: brand.id,
          initialQuantity: 20,
          initialUnitCost: 800,
          guestPrice: 1200,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.quantityOnHand).toBe(20);
      expect(res.body.data.averageCost).toBe(800);
      expect(res.body.data.guestPrice).toBe(1200);
    });
  });

  describe('PATCH /api/admin/products/:id/pricing (admin)', () => {
    it('updates pricing and emits product.repriced', async () => {
      const token = await mintToken(UserType.ADMIN);
      const brand = await seedBrand();
      const family = await seedFamily();
      const product = await seedProduct({ brandId: brand.id, familyId: family.id, guestPrice: 500 });
      const emitSpy = vi.spyOn(eventBus, 'emit');

      const res = await request(app)
        .patch(`/api/admin/products/${product.id}/pricing`)
        .set('Authorization', `Bearer ${token}`)
        .send({ guestPrice: 900 });

      expect(res.status).toBe(200);
      expect(res.body.data.guestPrice).toBe(900);
      expect(emitSpy).toHaveBeenCalledWith('product.repriced', expect.objectContaining({ productId: product.id }));
      emitSpy.mockRestore();
    });
  });

  describe('PATCH /api/admin/client-categories/:id (admin) — disable guard', () => {
    it('409s when an enabled PosClient still belongs to the category', async () => {
      const token = await mintToken(UserType.ADMIN);
      const category = await seedClientCategory();
      await seedPosClient({ categoryId: category.id, isEnabled: true });

      const res = await request(app)
        .patch(`/api/admin/client-categories/${category.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isEnabled: false });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/staff/products (staff, page-gated)', () => {
    it('403s a STAFF user without the STAFF_PRODUCTS page', async () => {
      await seedPages();
      const role = await seedRole({ pageKeys: ['STAFF_SALES'] });
      const { user } = await seedUser({ type: UserType.STAFF, roleIds: [role.id] });
      const token = generateToken({ sub: user.id, type: user.type });

      const res = await request(app).get('/api/staff/products').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('200s a STAFF user with the STAFF_PRODUCTS page', async () => {
      await seedPages();
      const role = await seedRole({ pageKeys: ['STAFF_PRODUCTS'] });
      const { user } = await seedUser({ type: UserType.STAFF, roleIds: [role.id] });
      const token = generateToken({ sub: user.id, type: user.type });

      const res = await request(app).get('/api/staff/products').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('200s an ADMIN regardless of page assignment', async () => {
      const token = await mintToken(UserType.ADMIN);

      const res = await request(app).get('/api/staff/products').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('route ordering — PRODUCT_STATS vs ADMIN_PRODUCT_BY_ID', () => {
    it('GET /api/admin/products/stats returns the stats shape, not a uuid-param 400', async () => {
      const token = await mintToken(UserType.ADMIN);

      const res = await request(app).get('/api/admin/products/stats').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(() => ProductStatsResponseSchema.parse(res.body.data)).not.toThrow();
    });
  });
});
