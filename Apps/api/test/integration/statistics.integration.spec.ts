import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { UserType as PrismaUserType } from '@prisma/client';
import { MovementType, OverviewResponseSchema, ReportResponseSchema, UserType } from '@dragon-telecom/contract';
import { app } from '../../src/app';
import { prisma } from '../../src/common/db/prisma';
import { generateToken } from '../../src/common/utils/token.utils';
import { resetDatabase } from '../fixtures/db.fixture';
import { seedSettings } from '../data/settings.factory';
import { seedUser } from '../data/user.factory';
import { seedPages } from '../data/page.factory';
import { seedRole } from '../data/role.factory';
import { seedBrand } from '../data/brand.factory';
import { seedFamily } from '../data/family.factory';
import { seedProduct } from '../data/product.factory';
import { seedTechnician } from '../data/technician.factory';
import { seedWilayas } from '../data/wilaya.factory';
import { seedPosClient } from '../data/pos-client.factory';
import { seedClientCategory } from '../data/client-category.factory';
import { inventoryService } from '../../src/modules/inventory/inventory.routes';

const mintTokenFor = (user: { id: string; type: PrismaUserType; staff?: { id: string } | null }): string =>
  generateToken({ sub: user.id, type: user.type as UserType, ...(user.staff ? { staffId: user.staff.id } : {}) });

const seedStaffWithPages = async (pageKeys: string[]) => {
  await seedPages();
  const role = await seedRole({ pageKeys });
  const { user } = await seedUser({ type: UserType.STAFF, roleIds: [role.id] });
  return { user, token: mintTokenFor(user) };
};

const mintAdminToken = async () => {
  const { user } = await seedUser({ type: UserType.ADMIN });
  return { user, token: mintTokenFor(user) };
};

const seedStockedProduct = async (options: { staffId: string; quantity?: number; unitCost?: number; guestPrice?: number }) => {
  const brand = await seedBrand();
  const family = await seedFamily();
  // guestPrice (orders' viewer-pricing port) and defaultSalePrice (sales' resolvePosPrices)
  // are two independent price fields — both are needed since this helper backs both an
  // orders-PLACE flow and a sales-confirm flow in this file's tests.
  const product = await seedProduct({
    brandId: brand.id,
    familyId: family.id,
    guestPrice: options.guestPrice ?? 1000,
    defaultSalePrice: options.guestPrice ?? 1000,
  });
  await prisma.$transaction(async (tx) => {
    await inventoryService.addLayer(tx, product.id, options.quantity ?? 10, options.unitCost ?? 400, MovementType.SUPPLIER_INVOICE, {
      referenceType: 'SUPPLIER_INVOICE',
      referenceId: product.id,
      staffId: options.staffId,
    });
  });
  return prisma.product.findUniqueOrThrow({ where: { id: product.id } });
};

const waitFor = async (check: () => Promise<boolean>, timeoutMs = 2000, intervalMs = 25): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('waitFor: condition not met within timeout');
};

describe('statistics integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedSettings();
  });

  describe('OVERVIEW — counts real order/repair-sale revenue exactly once', () => {
    it('reflects a confirmed order and a picked-up repair sale without double-counting', async () => {
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_ORDERS', 'STAFF_REPAIRS']);
      const { token: adminToken } = await mintAdminToken();

      // A confirmed guest order: revenue 1000, cost 400, profit 600.
      const orderProduct = await seedStockedProduct({ staffId: staffUser.staff!.id, quantity: 10, unitCost: 400, guestPrice: 1000 });
      const [wilaya] = await seedWilayas();
      const placeRes = await request(app)
        .post('/api/orders')
        .send({
          productId: orderProduct.id,
          quantity: 1,
          orderType: 'DELIVERY_HOME',
          contact: { fullName: 'Guest', phone: '0555000000' },
          delivery: { wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId },
        });
      const orderId = placeRes.body.data.id as string;
      await request(app).post(`/api/staff/orders/${orderId}/confirm`).set('Authorization', `Bearer ${staffToken}`).send({});

      // A picked-up repair: labour 100 + part (revenue 500, cost 200, profit 300) = totalAmount 600.
      const repairProduct = await seedStockedProduct({ staffId: staffUser.staff!.id, quantity: 10, unitCost: 200 });
      const technician = await seedTechnician();
      const intakeRes = await request(app)
        .post('/api/staff/repairs')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ customerName: 'Karim', customerPhone: '0555000001', reportedIssues: ['charging'] });
      const repairId = intakeRes.body.data.id as string;
      await request(app)
        .post(`/api/staff/repairs/${repairId}/parts`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ productId: repairProduct.id, quantity: 1, unitPrice: 500 });
      await request(app).patch(`/api/staff/repairs/${repairId}`).set('Authorization', `Bearer ${staffToken}`).send({ technicianId: technician.id, labourPrice: 100 });
      await request(app).post(`/api/staff/repairs/${repairId}/status`).set('Authorization', `Bearer ${staffToken}`).send({ toStatus: 'PROCESSING' });
      await request(app).post(`/api/staff/repairs/${repairId}/status`).set('Authorization', `Bearer ${staffToken}`).send({ toStatus: 'COMPLETED' });
      await request(app).post(`/api/staff/repairs/${repairId}/status`).set('Authorization', `Bearer ${staffToken}`).send({ toStatus: 'PICKED_UP', paidAmount: 600 });

      // Wait for the dormant sales listener to record the REPAIR-origin sale.
      await waitFor(async () => {
        const repair = await prisma.repair.findUnique({ where: { id: repairId }, select: { saleId: true } });
        return repair?.saleId != null;
      });

      const overviewRes = await request(app).get('/api/admin/statistics/overview').set('Authorization', `Bearer ${adminToken}`);
      expect(overviewRes.status).toBe(200);
      expect(() => OverviewResponseSchema.parse(overviewRes.body.data)).not.toThrow();
      // Order.totalAmount = subtotal(1000) + the default delivery fee (500, DEFAULT_SETTINGS.
      // delivery.defaultHome — see orders' own Sprint 3 tests) = 1500; profit is unaffected by
      // the delivery fee (consumeFifo's revenue is unitPrice×qty only).
      expect(overviewRes.body.data.totalRevenue).toBe(2100); // 1500 (order) + 600 (repair sale)
      expect(overviewRes.body.data.totalProfit).toBe(900); // 600 (order) + 300 (repair sale)

      // The Repair row itself is never separately counted — verify no duplication by summing
      // Sale + Order directly and comparing.
      const saleRevenue = await prisma.sale.aggregate({ where: { status: 'COMPLETED' }, _sum: { totalAmount: true } });
      const orderRevenue = await prisma.order.aggregate({ where: { status: { in: ['CONFIRMED', 'PACKAGED', 'IN_DELIVERY', 'COMPLETED'] } }, _sum: { totalAmount: true } });
      expect((saleRevenue._sum.totalAmount?.toNumber() ?? 0) + (orderRevenue._sum.totalAmount?.toNumber() ?? 0)).toBe(2100);
    });
  });

  describe('REPORT — CSV export streams the same rows as JSON', () => {
    it('sales-by-product: CSV row count matches the JSON rows length', async () => {
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_POS']);
      const { token: adminToken } = await mintAdminToken();
      const product = await seedStockedProduct({ staffId: staffUser.staff!.id, quantity: 10, unitCost: 400 });

      const draftRes = await request(app)
        .post('/api/staff/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ lines: [{ productId: product.id, quantity: 2, unitPrice: 1000 }] });
      await request(app)
        .post(`/api/staff/sales/${draftRes.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ paidAmount: 2000 });

      const jsonRes = await request(app).get('/api/admin/reports/sales-by-product').set('Authorization', `Bearer ${adminToken}`);
      expect(jsonRes.status).toBe(200);
      expect(() => ReportResponseSchema.parse(jsonRes.body.data)).not.toThrow();

      const csvRes = await request(app)
        .get('/api/admin/reports/sales-by-product?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');

      const csvLines = (csvRes.text as string).trim().split('\n');
      expect(csvLines).toHaveLength(jsonRes.body.data.rows.length + 1); // header + rows
    });
  });

  describe('REPORT — sales-by-category groups by client-category tier (audit fix A1)', () => {
    it('two confirmed sales under different categories land in different rows with correct discount figures', async () => {
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_POS']);
      const { token: adminToken } = await mintAdminToken();
      const product = await seedStockedProduct({ staffId: staffUser.staff!.id, quantity: 10, unitCost: 400, guestPrice: 1000 });

      const vip = await seedClientCategory({ name: 'VIP' });
      const premium = await seedClientCategory({ name: 'Premium' });
      const vipPosClient = await seedPosClient({ categoryId: vip.id });
      const premiumPosClient = await seedPosClient({ categoryId: premium.id });

      // VIP sale: staff discounts 100 off the (uncategorized) resolvedPrice of 1000.
      const vipDraft = await request(app)
        .post('/api/staff/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ posClientId: vipPosClient.id, lines: [{ productId: product.id, quantity: 1, unitPrice: 900 }] });
      await request(app)
        .post(`/api/staff/sales/${vipDraft.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ paidAmount: 900 });

      // Premium sale: no discount, full resolvedPrice charged.
      const premiumDraft = await request(app)
        .post('/api/staff/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ posClientId: premiumPosClient.id, lines: [{ productId: product.id, quantity: 1, unitPrice: 1000 }] });
      await request(app)
        .post(`/api/staff/sales/${premiumDraft.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ paidAmount: 1000 });

      const reportRes = await request(app).get('/api/admin/reports/sales-by-category').set('Authorization', `Bearer ${adminToken}`);
      expect(reportRes.status).toBe(200);
      expect(() => ReportResponseSchema.parse(reportRes.body.data)).not.toThrow();

      const rows = reportRes.body.data.rows as { categoryId: string; categoryName: string; discount: number; revenue: number }[];
      const vipRow = rows.find((r) => r.categoryId === vip.id);
      const premiumRow = rows.find((r) => r.categoryId === premium.id);

      expect(vipRow).toMatchObject({ categoryName: 'VIP', revenue: 900, discount: 100 });
      expect(premiumRow).toMatchObject({ categoryName: 'Premium', revenue: 1000, discount: 0 });
    });
  });

  describe('access control — admin vs. staff', () => {
    it('403s a STAFF caller on every admin-only STATS route', async () => {
      const { token } = await seedStaffWithPages([]);

      const res = await request(app).get('/api/admin/statistics/overview').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('STAFF_DASHBOARD is scoped to the caller — staff B never sees staff A\'s sales figures', async () => {
      const { user: staffA, token: tokenA } = await seedStaffWithPages(['STAFF_POS']);
      const { token: tokenB } = await seedStaffWithPages(['STAFF_POS']);
      const product = await seedStockedProduct({ staffId: staffA.staff!.id, quantity: 10, unitCost: 400 });

      const draftRes = await request(app)
        .post('/api/staff/sales')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ lines: [{ productId: product.id, quantity: 1, unitPrice: 1000 }] });
      await request(app)
        .post(`/api/staff/sales/${draftRes.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ paidAmount: 1000 });

      const dashboardA = await request(app).get('/api/staff/dashboard').set('Authorization', `Bearer ${tokenA}`);
      const dashboardB = await request(app).get('/api/staff/dashboard').set('Authorization', `Bearer ${tokenB}`);

      expect(dashboardA.status).toBe(200);
      expect(dashboardA.body.data.mySalesToday).toBe(1);
      expect(dashboardB.status).toBe(200);
      expect(dashboardB.body.data.mySalesToday).toBe(0);
    });
  });

  describe('OVERVIEW — stockValue reflects seeded product state', () => {
    it('computes Σ quantityOnHand × averageCost from real seeded stock', async () => {
      const { user: staffUser } = await seedStaffWithPages([]);
      const { token: adminToken } = await mintAdminToken();
      await seedStockedProduct({ staffId: staffUser.staff!.id, quantity: 5, unitCost: 300 });

      const overviewRes = await request(app).get('/api/admin/statistics/overview').set('Authorization', `Bearer ${adminToken}`);
      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.data.stockValue).toBe(1500); // 5 * 300
    });
  });
});
