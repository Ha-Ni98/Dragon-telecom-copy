import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { UserType as PrismaUserType } from '@prisma/client';
import { MovementType, RepairResponseSchema, UserType } from '@dragon-telecom/contract';
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

// Seeds a product with a real backing FIFO layer (via the injected engine) — repairs' own
// COMPLETED consumes real StockMovement/IN layers, same precedent as sales/orders' own
// seedStockedProduct.
const seedStockedProduct = async (options: { staffId: string; quantity?: number; unitCost?: number }) => {
  const brand = await seedBrand();
  const family = await seedFamily();
  const product = await seedProduct({ brandId: brand.id, familyId: family.id });
  await prisma.$transaction(async (tx) => {
    await inventoryService.addLayer(tx, product.id, options.quantity ?? 10, options.unitCost ?? 400, MovementType.SUPPLIER_INVOICE, {
      referenceType: 'SUPPLIER_INVOICE',
      referenceId: product.id,
      staffId: options.staffId,
    });
  });
  return prisma.product.findUniqueOrThrow({ where: { id: product.id } });
};

// Post-commit listeners (sales/observability) run asynchronously — poll until the observable
// effect lands or the timeout trips, same precedent as orders/billing/clients.integration.spec.ts.
const waitFor = async (check: () => Promise<boolean>, timeoutMs = 2000, intervalMs = 25): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('waitFor: condition not met within timeout');
};

describe('repairs integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedSettings();
  });

  describe('full lifecycle: intake → parts → PROCESSING → COMPLETED → PICKED_UP', () => {
    it('drops real stock at COMPLETED, stores part cost/profit, and records exactly one REPAIR-origin sale at PICKED_UP (no invoice)', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_REPAIRS']);
      const product = await seedStockedProduct({ staffId: user.staff!.id, quantity: 10, unitCost: 400 });
      const technician = await seedTechnician();

      const intakeRes = await request(app)
        .post('/api/staff/repairs')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerName: 'Karim Belkacem', customerPhone: '0555000000', reportedIssues: ['charging'] });
      expect(intakeRes.status).toBe(201);
      expect(() => RepairResponseSchema.parse(intakeRes.body.data)).not.toThrow();
      expect(intakeRes.body.data.status).toBe('INTAKE');
      const repairId = intakeRes.body.data.id as string;

      const addPartRes = await request(app)
        .post(`/api/staff/repairs/${repairId}/parts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.id, quantity: 2, unitPrice: 500 });
      expect(addPartRes.status).toBe(201);
      expect(addPartRes.body.data.partsTotal).toBe(1000);
      expect(addPartRes.body.data.totalAmount).toBe(1000);

      const afterAddPart = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterAddPart.quantityReserved).toBe(2);

      // PROCESSING without a technician assigned yet -> 400.
      const missingTechnician = await request(app)
        .post(`/api/staff/repairs/${repairId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'PROCESSING' });
      expect(missingTechnician.status).toBe(400);

      await request(app)
        .patch(`/api/staff/repairs/${repairId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ technicianId: technician.id });

      const toProcessing = await request(app)
        .post(`/api/staff/repairs/${repairId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'PROCESSING' });
      expect(toProcessing.status).toBe(200);

      const toCompleted = await request(app)
        .post(`/api/staff/repairs/${repairId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'COMPLETED' });
      expect(toCompleted.status).toBe(200);
      // Margin-gated: a STAFF caller never sees totalCost/totalProfit/part costOfGoods —
      // verify the real figures were stored via a direct DB read instead.
      expect(toCompleted.body.data).not.toHaveProperty('totalCost');
      expect(toCompleted.body.data).not.toHaveProperty('totalProfit');
      const completedRepair = await prisma.repair.findUniqueOrThrow({ where: { id: repairId } });
      expect(completedRepair.totalCost?.toNumber()).toBe(800); // 2 * 400
      expect(completedRepair.totalProfit?.toNumber()).toBe(200); // 1000 - 800
      const completedPart = await prisma.repairPart.findFirstOrThrow({ where: { repairId } });
      expect(completedPart.costOfGoods?.toNumber()).toBe(800);

      const afterCompleted = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterCompleted.quantityOnHand).toBe(8); // 10 - 2, real FIFO consumption
      expect(afterCompleted.quantityReserved).toBe(0);

      const toPickedUp = await request(app)
        .post(`/api/staff/repairs/${repairId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'PICKED_UP', paidAmount: 1000 });
      expect(toPickedUp.status).toBe(200);
      expect(toPickedUp.body.data.status).toBe('PICKED_UP');

      let repairRow: { saleId: string | null } | null = null;
      await waitFor(async () => {
        repairRow = await prisma.repair.findUnique({ where: { id: repairId }, select: { saleId: true } });
        return repairRow?.saleId != null;
      });
      expect(repairRow!.saleId).not.toBeNull();

      const sales = await prisma.sale.findMany({ where: { id: repairRow!.saleId! } });
      expect(sales).toHaveLength(1);
      expect(sales[0]!.origin).toBe('REPAIR');

      const invoiceCount = await prisma.invoice.count({ where: { sourceId: repairRow!.saleId! } });
      expect(invoiceCount).toBe(0); // REPAIR-origin sale never issues an invoice
    });
  });

  describe('cancel — pending vs. already-consumed parts', () => {
    it('cancelling from PROCESSING releases pending parts automatically (no consumedPartReturns needed)', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_REPAIRS']);
      const product = await seedStockedProduct({ staffId: user.staff!.id, quantity: 10 });
      const technician = await seedTechnician();

      const intakeRes = await request(app)
        .post('/api/staff/repairs')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerName: 'Karim', customerPhone: '0555000000', reportedIssues: ['charging'] });
      const repairId = intakeRes.body.data.id as string;

      await request(app)
        .post(`/api/staff/repairs/${repairId}/parts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.id, quantity: 3, unitPrice: 500 });

      await request(app).patch(`/api/staff/repairs/${repairId}`).set('Authorization', `Bearer ${token}`).send({ technicianId: technician.id });
      await request(app).post(`/api/staff/repairs/${repairId}/status`).set('Authorization', `Bearer ${token}`).send({ toStatus: 'PROCESSING' });

      const afterReserve = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterReserve.quantityReserved).toBe(3);

      const cancelRes = await request(app)
        .post(`/api/staff/repairs/${repairId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'CANCELLED', note: 'customer withdrew' });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const afterCancel = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterCancel.quantityReserved).toBe(0);
      expect(afterCancel.quantityOnHand).toBe(10);
    });

    it('cancelling post-COMPLETED without consumedPartReturns leaves the consumed part untouched', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_REPAIRS']);
      const product = await seedStockedProduct({ staffId: user.staff!.id, quantity: 10, unitCost: 400 });
      const technician = await seedTechnician();

      const intakeRes = await request(app)
        .post('/api/staff/repairs')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerName: 'Karim', customerPhone: '0555000000', reportedIssues: ['charging'] });
      const repairId = intakeRes.body.data.id as string;

      await request(app)
        .post(`/api/staff/repairs/${repairId}/parts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.id, quantity: 2, unitPrice: 500 });

      await request(app).patch(`/api/staff/repairs/${repairId}`).set('Authorization', `Bearer ${token}`).send({ technicianId: technician.id });
      await request(app).post(`/api/staff/repairs/${repairId}/status`).set('Authorization', `Bearer ${token}`).send({ toStatus: 'PROCESSING' });
      await request(app).post(`/api/staff/repairs/${repairId}/status`).set('Authorization', `Bearer ${token}`).send({ toStatus: 'COMPLETED' });

      const afterCompleted = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterCompleted.quantityOnHand).toBe(8); // 10 - 2

      // CANCELLED is allowed from COMPLETED (only CANCELLED/PICKED_UP are excluded) — but
      // without consumedPartReturns, the already-consumed part is not restocked.
      const cancelRes = await request(app)
        .post(`/api/staff/repairs/${repairId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'CANCELLED' });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const afterCancel = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterCancel.quantityOnHand).toBe(8); // unchanged — no restock requested
    });

    it('cancelling post-COMPLETED with an explicit consumedPartReturns entry restocks at the consumed cost', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_REPAIRS']);
      const product = await seedStockedProduct({ staffId: user.staff!.id, quantity: 10, unitCost: 400 });
      const technician = await seedTechnician();

      const intakeRes = await request(app)
        .post('/api/staff/repairs')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerName: 'Karim', customerPhone: '0555000000', reportedIssues: ['charging'] });
      const repairId = intakeRes.body.data.id as string;

      const addPartRes = await request(app)
        .post(`/api/staff/repairs/${repairId}/parts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.id, quantity: 2, unitPrice: 500 });
      const partId = addPartRes.body.data.parts[0].id as string;

      await request(app).patch(`/api/staff/repairs/${repairId}`).set('Authorization', `Bearer ${token}`).send({ technicianId: technician.id });
      await request(app).post(`/api/staff/repairs/${repairId}/status`).set('Authorization', `Bearer ${token}`).send({ toStatus: 'PROCESSING' });
      await request(app).post(`/api/staff/repairs/${repairId}/status`).set('Authorization', `Bearer ${token}`).send({ toStatus: 'COMPLETED' });

      const afterCompleted = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterCompleted.quantityOnHand).toBe(8); // 10 - 2

      const cancelRes = await request(app)
        .post(`/api/staff/repairs/${repairId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'CANCELLED', consumedPartReturns: [{ partId, restock: true }] });
      expect(cancelRes.status).toBe(200);

      const afterCancel = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterCancel.quantityOnHand).toBe(10); // 8 + 2 restocked

      const returnInMovement = await prisma.stockMovement.findFirst({ where: { productId: product.id, type: 'RETURN_IN' } });
      expect(returnInMovement).not.toBeNull();
    });
  });

  describe('access scoping', () => {
    it('staff sees only tickets they created; admin sees all (leak test)', async () => {
      const { token: tokenA } = await seedStaffWithPages(['STAFF_REPAIRS']);
      const { token: tokenB } = await seedStaffWithPages(['STAFF_REPAIRS']);
      const { token: adminToken } = await mintAdminToken();

      await request(app)
        .post('/api/staff/repairs')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ customerName: 'Client A', customerPhone: '0555000001', reportedIssues: ['charging'] });

      const bListRes = await request(app).get('/api/staff/repairs').set('Authorization', `Bearer ${tokenB}`);
      expect(bListRes.status).toBe(200);
      expect(bListRes.body.data).toEqual([]);

      const aListRes = await request(app).get('/api/staff/repairs').set('Authorization', `Bearer ${tokenA}`);
      expect(aListRes.status).toBe(200);
      expect(aListRes.body.data).toHaveLength(1);

      const adminListRes = await request(app).get('/api/admin/repairs').set('Authorization', `Bearer ${adminToken}`);
      expect(adminListRes.status).toBe(200);
      expect(adminListRes.body.data).toHaveLength(1);
    });
  });
});
