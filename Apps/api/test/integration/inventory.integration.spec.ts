import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { UserType, AdjustmentReason, MovementType } from '@dragon-telecom/contract';
import { app } from '../../src/app';
import { prisma } from '../../src/common/db/prisma';
import { generateToken } from '../../src/common/utils/token.utils';
import { eventBus } from '../../src/common/events/event-bus';
import { resetDatabase } from '../fixtures/db.fixture';
import { seedUser } from '../data/user.factory';
import { seedBrand } from '../data/brand.factory';
import { seedFamily } from '../data/family.factory';
import { seedProduct, type SeedProductOptions } from '../data/product.factory';
import { seedSettings } from '../data/settings.factory';
import { inventoryService } from '../../src/modules/inventory/inventory.routes';

const mintAdminToken = async (): Promise<{ token: string; staffId: string }> => {
  const { user } = await seedUser({ type: UserType.ADMIN });
  if (!user.staff) throw new Error('seedUser did not create a Staff profile');
  return {
    token: generateToken({ sub: user.id, type: user.type, staffId: user.staff.id }),
    staffId: user.staff.id,
  };
};

const seedBaseProduct = async (overrides: Partial<Omit<SeedProductOptions, 'familyId' | 'brandId'>> = {}) => {
  const brand = await seedBrand();
  const family = await seedFamily();
  return seedProduct({ brandId: brand.id, familyId: family.id, ...overrides });
};

describe('inventory integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    // createAdjustment allocates its reference via SequenceService, which requires the
    // "invoicing" Setting row to already exist (SELECT ... FOR UPDATE, no fallback) — seeded
    // unconditionally here since every describe block below may exercise POST /adjustments.
    await seedSettings();
  });

  describe('admin guard', () => {
    it('401s every route without a token', async () => {
      const routes = [
        ['get', '/api/admin/inventory/stock'],
        ['get', '/api/admin/inventory/movements'],
        ['get', '/api/admin/inventory/reservations'],
        ['post', '/api/admin/inventory/adjustments'],
      ] as const;
      for (const [method, path] of routes) {
        const res = await request(app)[method](path);
        expect(res.status, path).toBe(401);
      }
    });

    it('403s a non-admin (STAFF) token', async () => {
      const { user } = await seedUser({ type: UserType.STAFF });
      const token = generateToken({ sub: user.id, type: user.type });

      const res = await request(app).get('/api/admin/inventory/stock').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/inventory/stock', () => {
    it('returns levels with stockValue/isLow, and lowStockOnly filters correctly', async () => {
      const { token } = await mintAdminToken();
      const healthy = await seedBaseProduct({
        quantityOnHand: 20,
        quantityReserved: 0,
        averageCost: 100,
        reorderThreshold: 5,
      });
      const low = await seedBaseProduct({
        quantityOnHand: 3,
        quantityReserved: 0,
        averageCost: 50,
        reorderThreshold: 5,
      });

      const fullRes = await request(app).get('/api/admin/inventory/stock').set('Authorization', `Bearer ${token}`);
      expect(fullRes.status).toBe(200);
      const healthyRow = fullRes.body.data.find((row: { productId: string }) => row.productId === healthy.id);
      expect(healthyRow.stockValue).toBe(2000);
      expect(healthyRow.isLow).toBe(false);

      const lowOnlyRes = await request(app)
        .get('/api/admin/inventory/stock?lowStockOnly=true')
        .set('Authorization', `Bearer ${token}`);
      const ids = lowOnlyRes.body.data.map((row: { productId: string }) => row.productId);
      expect(ids).toContain(low.id);
      expect(ids).not.toContain(healthy.id);
    });

    it('export=csv returns a CSV attachment', async () => {
      const { token } = await mintAdminToken();
      await seedBaseProduct({ quantityOnHand: 10 });

      const res = await request(app)
        .get('/api/admin/inventory/stock?export=csv')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text.split('\n')[0]).toContain('productId');
    });
  });

  describe('GET /api/admin/inventory/movements', () => {
    it('reflects a real INITIAL_STOCK movement written via the swapped-in inventory engine', async () => {
      const { token } = await mintAdminToken();
      const brand = await seedBrand();
      const family = await seedFamily();

      const createRes = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Charger Cable',
          familyId: family.id,
          brandId: brand.id,
          initialQuantity: 12,
          initialUnitCost: 300,
        });
      expect(createRes.status).toBe(201);
      const productId = createRes.body.data.id;

      const movementsRes = await request(app)
        .get(`/api/admin/inventory/movements?productId=${productId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(movementsRes.status).toBe(200);
      expect(movementsRes.body.data.items).toHaveLength(1);
      const [movement] = movementsRes.body.data.items;
      expect(movement.type).toBe(MovementType.INITIAL_STOCK);
      expect(movement.direction).toBe('IN');
      expect(movement.quantity).toBe(12);
      expect(movement.unitCost).toBe(300);
      expect(movement.referenceLabel).toBe('Charger Cable'); // PRODUCT reference resolves to its own name

      // Proves the real engine ran (not the old stub): a genuine StockMovement row exists.
      const rows = await prisma.stockMovement.findMany({ where: { productId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.staffId).toBeTruthy();
    });

    it('filters by type/date/staff and paginates', async () => {
      const { token, staffId } = await mintAdminToken();
      const product = await seedBaseProduct();

      await prisma.$transaction(async (tx) => {
        await inventoryService.addLayer(tx, product.id, 5, 100, MovementType.SUPPLIER_INVOICE, {
          referenceType: 'SUPPLIER_INVOICE',
          referenceId: product.id,
          staffId,
        });
      });

      const res = await request(app)
        .get(`/api/admin/inventory/movements?type=${MovementType.SUPPLIER_INVOICE}&staffId=${staffId}&page=1&limit=20`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
    });
  });

  describe('GET /api/admin/inventory/reservations', () => {
    it('shows an open reservation with holder + ageHours', async () => {
      const { token, staffId } = await mintAdminToken();
      const product = await seedBaseProduct({ quantityOnHand: 10 });
      const orderId = '11111111-1111-4111-8111-111111111111';

      await prisma.$transaction(async (tx) => {
        await inventoryService.reserve(tx, product.id, 4, { referenceType: 'ORDER', referenceId: orderId, staffId });
      });

      const res = await request(app).get('/api/admin/inventory/reservations').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      const [reservation] = res.body.data.items;
      expect(reservation.productId).toBe(product.id);
      expect(reservation.quantity).toBe(4);
      expect(reservation.holderType).toBe('ORDER');
      expect(typeof reservation.ageHours).toBe('number');
    });
  });

  describe('POST /api/admin/inventory/adjustments', () => {
    it('COUNT with mixed IN/OUT lines applies real column deltas and returns an ADJUSTMENT reference', async () => {
      const { token, staffId } = await mintAdminToken();
      // inProduct's IN delta never drains a layer, so a phantom (unbacked) baseline is fine.
      const inProduct = await seedBaseProduct({ quantityOnHand: 10, averageCost: 200 });
      // outProduct's OUT delta *does* drain a real layer — seed at 0 and let addLayer establish
      // the whole balance, so the drain isn't relying on an unbacked phantom quantity.
      const outProduct = await seedBaseProduct({ quantityOnHand: 0 });
      await prisma.$transaction(async (tx) => {
        await inventoryService.addLayer(tx, outProduct.id, 10, 150, MovementType.SUPPLIER_INVOICE, {
          referenceType: 'SUPPLIER_INVOICE',
          referenceId: outProduct.id,
          staffId,
        });
      });

      const res = await request(app)
        .post('/api/admin/inventory/adjustments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: AdjustmentReason.COUNT,
          lines: [
            { productId: inProduct.id, countedQuantity: 15 }, // +5 IN, default cost = avgCost (200)
            { productId: outProduct.id, countedQuantity: 4 }, // -6 OUT, drains 6 of the real 10-unit layer
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.reference).toMatch(/^ADJ-/);
      expect(res.body.data.lines).toHaveLength(2);

      const updatedIn = await prisma.product.findUniqueOrThrow({ where: { id: inProduct.id } });
      expect(updatedIn.quantityOnHand).toBe(15);

      const updatedOut = await prisma.product.findUniqueOrThrow({ where: { id: outProduct.id } });
      expect(updatedOut.quantityOnHand).toBe(4);
    });

    it('DAMAGE (OUT-only) sets profit null on the resulting movement', async () => {
      const { token, staffId } = await mintAdminToken();
      // Seeding quantityOnHand directly (no real FIFO layer behind it) would make the engine's
      // layer-drain loop find nothing to consume and hard-fail — establish a real layer instead.
      const product = await seedBaseProduct({ quantityOnHand: 0 });
      await prisma.$transaction(async (tx) => {
        await inventoryService.addLayer(tx, product.id, 20, 100, MovementType.SUPPLIER_INVOICE, {
          referenceType: 'SUPPLIER_INVOICE',
          referenceId: product.id,
          staffId,
        });
      });

      const res = await request(app)
        .post('/api/admin/inventory/adjustments')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: AdjustmentReason.DAMAGE, lines: [{ productId: product.id, countedQuantity: 15 }] });

      expect(res.status).toBe(201);
      const [line] = res.body.data.lines;
      const movement = await prisma.stockMovement.findUnique({ where: { id: line.movementId } });
      expect(movement?.type).toBe(MovementType.ADJUSTMENT_OUT);
      expect(movement?.profit).toBeNull();
    });

    it('an IN line with prices reprices the product atomically (verified via the catalog read)', async () => {
      const { token } = await mintAdminToken();
      const product = await seedBaseProduct({ quantityOnHand: 10, guestPrice: 500 });

      const res = await request(app)
        .post('/api/admin/inventory/adjustments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: AdjustmentReason.CORRECTION,
          lines: [{ productId: product.id, countedQuantity: 15, unitCost: 100, prices: { guestPrice: 777 } }],
        });

      expect(res.status).toBe(201);

      const catalogRes = await request(app)
        .get(`/api/admin/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(catalogRes.body.data.guestPrice).toBe(777);
      expect(catalogRes.body.data.quantityOnHand).toBe(15);
    });

    it('over-consumption rejects with 409 and leaves every line unwritten (no partial write)', async () => {
      const { token } = await mintAdminToken();
      const untouched = await seedBaseProduct({ quantityOnHand: 10 });
      // available = onHand(5) - reserved(4) = 1; counting down to 0 asks the engine to consume 5.
      const overConsumed = await seedBaseProduct({ quantityOnHand: 5, quantityReserved: 4 });

      const res = await request(app)
        .post('/api/admin/inventory/adjustments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: AdjustmentReason.LOSS,
          lines: [
            { productId: untouched.id, countedQuantity: 15 }, // +5 IN — would succeed in isolation
            { productId: overConsumed.id, countedQuantity: 0 }, // -5 OUT, but only 1 is available -> 409
          ],
        });

      expect(res.status).toBe(409);

      const stillUntouched = await prisma.product.findUniqueOrThrow({ where: { id: untouched.id } });
      expect(stillUntouched.quantityOnHand).toBe(10); // the earlier line's effect was rolled back too

      const adjustmentRows = await prisma.stockAdjustment.findMany();
      expect(adjustmentRows).toHaveLength(0); // the StockAdjustment header itself didn't survive either
    });

    it('emits inventory.adjusted after a successful adjustment', async () => {
      const { token } = await mintAdminToken();
      const product = await seedBaseProduct({ quantityOnHand: 10 });
      const emitSpy = vi.spyOn(eventBus, 'emit');

      const res = await request(app)
        .post('/api/admin/inventory/adjustments')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: AdjustmentReason.COUNT, lines: [{ productId: product.id, countedQuantity: 12 }] });

      expect(res.status).toBe(201);
      expect(emitSpy).toHaveBeenCalledWith(
        'inventory.adjusted',
        expect.objectContaining({ reference: res.body.data.reference }),
      );
      emitSpy.mockRestore();
    });
  });
});
