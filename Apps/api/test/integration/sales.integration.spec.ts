import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { UserType as PrismaUserType } from '@prisma/client';
import { MovementType, ReceiptResponseSchema, SaleResponseSchema, UserType } from '@dragon-telecom/contract';
import { app } from '../../src/app';
import { prisma } from '../../src/common/db/prisma';
import { generateToken } from '../../src/common/utils/token.utils';
import { eventBus } from '../../src/common/events/event-bus';
import { resetDatabase } from '../fixtures/db.fixture';
import { seedSettings } from '../data/settings.factory';
import { seedUser } from '../data/user.factory';
import { seedPages } from '../data/page.factory';
import { seedRole } from '../data/role.factory';
import { seedBrand } from '../data/brand.factory';
import { seedFamily } from '../data/family.factory';
import { seedProduct } from '../data/product.factory';
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

// Seeds a product with a real backing FIFO layer (via the injected engine, not a raw
// quantityOnHand column write) — sales' confirm consumes real StockMovement/IN layers, so a
// product seeded only with a cached quantityOnHand (no layer) would 409 as if stock were
// exhausted, regardless of the cached number.
const seedStockedProduct = async (options: { staffId: string; quantity?: number; unitCost?: number; defaultSalePrice?: number }) => {
  const brand = await seedBrand();
  const family = await seedFamily();
  const product = await seedProduct({
    brandId: brand.id,
    familyId: family.id,
    defaultSalePrice: options.defaultSalePrice ?? 1000,
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

describe('sales integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedSettings();
  });

  describe('draft → confirm end-to-end', () => {
    it('creates a draft, confirms it, drops real stock, and emits sale.confirmed', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_POS']);
      const product = await seedStockedProduct({ staffId: user.staff!.id, quantity: 10, unitCost: 400, defaultSalePrice: 1000 });
      const emitSpy = vi.spyOn(eventBus, 'emit');

      const draftRes = await request(app)
        .post('/api/staff/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({ lines: [{ productId: product.id, quantity: 2, unitPrice: 1000 }] });
      expect(draftRes.status).toBe(201);
      expect(() => SaleResponseSchema.parse(draftRes.body.data)).not.toThrow();
      expect(draftRes.body.data.status).toBe('DRAFT');
      const saleId = draftRes.body.data.id as string;

      const confirmRes = await request(app)
        .post(`/api/staff/sales/${saleId}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paidAmount: 2000 });

      expect(confirmRes.status).toBe(200);
      expect(() => ReceiptResponseSchema.parse(confirmRes.body.data)).not.toThrow();
      expect(confirmRes.body.data.total).toBe(2000);
      expect(confirmRes.body.data.totalPaid).toBe(2000);
      expect(confirmRes.body.data.newCredit).toBe(0);

      const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updatedProduct.quantityOnHand).toBe(8); // 10 - 2, real FIFO consumption

      expect(emitSpy).toHaveBeenCalledWith('sale.confirmed', expect.objectContaining({ saleId, origin: 'POS', totalAmount: 2000 }));
      emitSpy.mockRestore();
    });
  });

  describe('confirm — stock exhaustion and underpayment gates', () => {
    it('409s and leaves the sale DRAFT when stock is exhausted', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_POS']);
      const product = await seedStockedProduct({ staffId: user.staff!.id, quantity: 1, unitCost: 400, defaultSalePrice: 1000 });

      const draftRes = await request(app)
        .post('/api/staff/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({ lines: [{ productId: product.id, quantity: 5, unitPrice: 1000 }] }); // more than the 1 in stock
      const saleId = draftRes.body.data.id as string;

      const confirmRes = await request(app)
        .post(`/api/staff/sales/${saleId}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paidAmount: 5000 });

      expect(confirmRes.status).toBe(409);

      const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
      expect(sale.status).toBe('DRAFT');
    });

    it('400s an underpaid confirm with no linked posClient (CREDIT_REQUIRES_CLIENT)', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_POS']);
      const product = await seedStockedProduct({ staffId: user.staff!.id, quantity: 10, unitCost: 400, defaultSalePrice: 1000 });

      const draftRes = await request(app)
        .post('/api/staff/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({ lines: [{ productId: product.id, quantity: 2, unitPrice: 1000 }] });
      const saleId = draftRes.body.data.id as string;

      const confirmRes = await request(app)
        .post(`/api/staff/sales/${saleId}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paidAmount: 500 }); // totalAmount is 2000, no posClientId attached

      expect(confirmRes.status).toBe(400);
    });
  });

  describe('ownership + access scoping', () => {
    it('staff A reading staff B\'s sale (and staff B\'s DRAFT) both 403; admin can read either', async () => {
      const { user: staffA, token: tokenA } = await seedStaffWithPages(['STAFF_POS', 'STAFF_SALES']);
      const { token: tokenB } = await seedStaffWithPages(['STAFF_POS', 'STAFF_SALES']);
      const product = await seedStockedProduct({ staffId: staffA.staff!.id, quantity: 10, defaultSalePrice: 1000 });
      const { token: adminToken } = await mintAdminToken();

      const draftRes = await request(app)
        .post('/api/staff/sales')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ lines: [{ productId: product.id, quantity: 1, unitPrice: 1000 }] });
      const reference = draftRes.body.data.reference as string;

      // Still DRAFT — staff B (non-owner) gets 403, not a 200 leaking someone else's draft.
      const bReadsDraft = await request(app).get(`/api/staff/sales/${reference}`).set('Authorization', `Bearer ${tokenB}`);
      expect(bReadsDraft.status).toBe(403);

      const confirmRes = await request(app)
        .post(`/api/staff/sales/${draftRes.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ paidAmount: 1000 });
      expect(confirmRes.status).toBe(200);
      // confirm allocates the real SAL-YYYY-NNNN reference — the DRAFT placeholder above is now
      // stale (a lookup by it now 404s, not just 403).
      const confirmedReference = confirmRes.body.data.reference as string;

      const bReadsCompleted = await request(app)
        .get(`/api/staff/sales/${confirmedReference}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(bReadsCompleted.status).toBe(403);

      const adminReads = await request(app)
        .get(`/api/admin/sales/${confirmedReference}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminReads.status).toBe(200);
      expect(adminReads.body.data.reference).toBe(confirmedReference);
    });

    it('STAFF_LIST is scoped to the caller — staff B never sees staff A\'s sale in their own list', async () => {
      const { user: staffA, token: tokenA } = await seedStaffWithPages(['STAFF_POS', 'STAFF_SALES']);
      const { token: tokenB } = await seedStaffWithPages(['STAFF_POS', 'STAFF_SALES']);
      const product = await seedStockedProduct({ staffId: staffA.staff!.id, quantity: 10, defaultSalePrice: 1000 });

      await request(app)
        .post('/api/staff/sales')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ lines: [{ productId: product.id, quantity: 1, unitPrice: 1000 }] });

      const bListRes = await request(app).get('/api/staff/sales').set('Authorization', `Bearer ${tokenB}`);
      expect(bListRes.status).toBe(200);
      expect(bListRes.body.data.items).toEqual([]);

      const aListRes = await request(app).get('/api/staff/sales').set('Authorization', `Bearer ${tokenA}`);
      expect(aListRes.status).toBe(200);
      expect(aListRes.body.data.items).toHaveLength(1);
    });
  });

  describe('POST /api/admin/returns (admin-only, restock)', () => {
    it('403s a STAFF caller (even one holding STAFF_POS/STAFF_SALES)', async () => {
      const { token } = await seedStaffWithPages(['STAFF_POS', 'STAFF_SALES']);

      const res = await request(app)
        .post('/api/admin/returns')
        .set('Authorization', `Bearer ${token}`)
        .send({ saleId: '00000000-0000-4000-8000-000000000000', type: 'REFUND', lines: [] });

      expect(res.status).toBe(403);
    });

    it('restock:true restores real stock via the injected engine', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_POS']);
      const product = await seedStockedProduct({ staffId: user.staff!.id, quantity: 10, unitCost: 400, defaultSalePrice: 1000 });
      const { token: adminToken } = await mintAdminToken();

      const draftRes = await request(app)
        .post('/api/staff/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({ lines: [{ productId: product.id, quantity: 3, unitPrice: 1000 }] });
      const saleId = draftRes.body.data.id as string;

      await request(app)
        .post(`/api/staff/sales/${saleId}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paidAmount: 3000 });

      const afterConfirm = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterConfirm.quantityOnHand).toBe(7); // 10 - 3

      // SaleDto.lines[] carries no SaleLine id (contract gap, flagged in the sprint report) — the
      // real DB row is the only way to obtain the saleLineId a return command requires.
      const saleLine = await prisma.saleLine.findFirstOrThrow({ where: { saleId } });

      const returnRes = await request(app)
        .post('/api/admin/returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          saleId,
          type: 'REFUND',
          lines: [{ saleLineId: saleLine.id, quantity: 2, restock: true, refundAmount: 2000 }],
        });

      expect(returnRes.status).toBe(200);
      expect(returnRes.body.data.status).toBe('PARTIALLY_RETURNED');

      const afterReturn = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterReturn.quantityOnHand).toBe(9); // 7 + 2 restocked

      const returnInMovement = await prisma.stockMovement.findFirst({ where: { productId: product.id, type: 'RETURN_IN' } });
      expect(returnInMovement).not.toBeNull();
    });
  });
});
