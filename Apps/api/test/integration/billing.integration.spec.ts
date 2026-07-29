import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { UserType as PrismaUserType } from '@prisma/client';
import { InvoiceResponseSchema, MovementType, UserType } from '@dragon-telecom/contract';
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
import { seedPosClient } from '../data/pos-client.factory';
import { seedClientUser } from '../data/client.factory';
import { seedWilayas } from '../data/wilaya.factory';
import { inventoryService } from '../../src/modules/inventory/inventory.routes';

const mintStaffToken = (user: { id: string; type: PrismaUserType; staff?: { id: string } | null }): string =>
  generateToken({ sub: user.id, type: user.type as UserType, ...(user.staff ? { staffId: user.staff.id } : {}) });

const seedStaffWithPages = async (pageKeys: string[]) => {
  await seedPages();
  const role = await seedRole({ pageKeys });
  const { user } = await seedUser({ type: UserType.STAFF, roleIds: [role.id] });
  return { user, token: mintStaffToken(user) };
};

const mintAdminToken = async () => {
  const { user } = await seedUser({ type: UserType.ADMIN });
  return { user, token: mintStaffToken(user) };
};

// Real backing FIFO layer (not a raw quantityOnHand write) — sales' confirm consumes real
// StockMovement/IN layers, same precedent as sales.integration.spec.ts's own helper.
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

// Drives a real draft → confirm through the sales module's own HTTP routes (set-06 Sprint 4) —
// the same POS flow whose sale.confirmed emission this module's own listener consumes.
const confirmRealSale = async (
  token: string,
  productId: string,
  options: { quantity?: number; unitPrice?: number; paidAmount?: number; posClientId?: string } = {},
) => {
  const quantity = options.quantity ?? 1;
  const unitPrice = options.unitPrice ?? 1000;
  const draftRes = await request(app)
    .post('/api/staff/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      lines: [{ productId, quantity, unitPrice }],
      ...(options.posClientId != null ? { posClientId: options.posClientId } : {}),
    });
  const saleId = draftRes.body.data.id as string;

  const confirmRes = await request(app)
    .post(`/api/staff/sales/${saleId}/confirm`)
    .set('Authorization', `Bearer ${token}`)
    .send({ paidAmount: options.paidAmount ?? quantity * unitPrice });

  return { saleId, confirmRes };
};

// The billing listener runs post-commit, asynchronously (real DB I/O) — poll until the
// observable effect lands or the timeout trips, same precedent as clients.integration.spec.ts.
const waitFor = async (check: () => Promise<boolean>, timeoutMs = 2000, intervalMs = 25): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('waitFor: condition not met within timeout');
};

describe('billing integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedSettings();
  });

  describe('end-to-end: POS sale confirm → invoice issued', () => {
    it('issues exactly one invoice from a real sale.confirmed emission, and a replay is a no-op', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_POS']);
      const product = await seedStockedProduct({ staffId: user.staff!.id });
      const { token: adminToken } = await mintAdminToken();

      const { saleId, confirmRes } = await confirmRealSale(token, product.id, { quantity: 2, unitPrice: 1000, paidAmount: 2000 });
      expect(confirmRes.status).toBe(200);

      let invoiceRow: { number: string } | null = null;
      await waitFor(async () => {
        invoiceRow = await prisma.invoice.findUnique({ where: { sourceType_sourceId: { sourceType: 'SALE', sourceId: saleId } } });
        return invoiceRow != null;
      });

      const getRes = await request(app).get(`/api/admin/invoices/${invoiceRow!.number}`).set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      expect(() => InvoiceResponseSchema.parse(getRes.body.data)).not.toThrow();
      expect(getRes.body.data.sourceReference).toBe(confirmRes.body.data.reference);
      expect(getRes.body.data.totalAmount).toBe(2000);

      // Replay: billing's own listener re-fed the same sale.confirmed payload it already
      // processed — the @@unique(sourceType, sourceId) constraint makes the second issue a
      // silent no-op (proven at the service level in Sprint 6; proven end-to-end here).
      eventBus.emit('sale.confirmed', {
        saleId,
        origin: 'POS',
        totalAmount: 2000,
        paidAmount: 2000,
        snapshotLines: [{ productId: product.id, productName: product.name, quantity: 2, unitPrice: 1000, lineTotal: 2000 }],
      } as never);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const count = await prisma.invoice.count({ where: { sourceType: 'SALE', sourceId: saleId } });
      expect(count).toBe(1);
    });

    it('a REPAIR-origin sale.confirmed never issues an invoice (no Sale row even required)', async () => {
      eventBus.emit('sale.confirmed', {
        saleId: '00000000-0000-4000-8000-000000000000',
        origin: 'REPAIR',
        totalAmount: 500,
        paidAmount: 500,
        snapshotLines: [],
      } as never);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const count = await prisma.invoice.count({ where: { sourceType: 'SALE' } });
      expect(count).toBe(0);
    });
  });

  describe('order.confirmed (synthetic — orders module unbuilt)', () => {
    it('issues an ORDER invoice with no Sale row involved at all', async () => {
      const { user } = await mintAdminToken();
      const brand = await seedBrand();
      const family = await seedFamily();
      const product = await seedProduct({ brandId: brand.id, familyId: family.id, defaultSalePrice: 800 });

      const order = await prisma.order.create({
        data: {
          reference: `ORD-${Date.now()}`,
          orderType: 'PICKUP',
          contactName: 'Test Buyer',
          contactPhone: '0555111222',
          productId: product.id,
          productNameSnapshot: product.name,
          quantity: 1,
          resolvedPrice: 800,
          unitPrice: 800,
          subtotal: 800,
          totalAmount: 800,
          paidAmount: 800,
        },
      });

      eventBus.emit('order.confirmed', {
        orderId: order.id,
        snapshotLine: { productId: product.id, productName: product.name, quantity: 1, unitPrice: 800, lineTotal: 800 },
        totals: { subtotal: 800, deliveryFee: 0, totalAmount: 800, paidAmount: 800 },
        confirmedByStaffId: user.staff!.id,
      } as never);

      let invoiceRow: { number: string; totalCost: unknown } | null = null;
      await waitFor(async () => {
        invoiceRow = await prisma.invoice.findUnique({ where: { sourceType_sourceId: { sourceType: 'ORDER', sourceId: order.id } } });
        return invoiceRow != null;
      });

      const saleCount = await prisma.sale.count();
      expect(saleCount).toBe(0);
    });
  });

  describe('cancel — sequence gap survives', () => {
    it('a cancelled invoice number is never reused by the next issued invoice', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_POS']);
      const { token: adminToken } = await mintAdminToken();
      const productA = await seedStockedProduct({ staffId: user.staff!.id, defaultSalePrice: 1000 });
      const productB = await seedStockedProduct({ staffId: user.staff!.id, defaultSalePrice: 1000 });

      const first = await confirmRealSale(token, productA.id);
      let firstInvoice: { number: string } | null = null;
      await waitFor(async () => {
        firstInvoice = await prisma.invoice.findUnique({ where: { sourceType_sourceId: { sourceType: 'SALE', sourceId: first.saleId } } });
        return firstInvoice != null;
      });

      const cancelRes = await request(app)
        .post(`/api/admin/invoices/${firstInvoice!.number}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'test' });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const second = await confirmRealSale(token, productB.id);
      let secondInvoice: { number: string } | null = null;
      await waitFor(async () => {
        secondInvoice = await prisma.invoice.findUnique({ where: { sourceType_sourceId: { sourceType: 'SALE', sourceId: second.saleId } } });
        return secondInvoice != null;
      });

      expect(secondInvoice!.number).not.toBe(firstInvoice!.number);
      const totalIssued = await prisma.invoice.count();
      expect(totalIssued).toBe(2); // the cancelled one still exists — never deleted, never renumbered
    });
  });

  describe('client payments', () => {
    it('a recorded payment flips the invoice status', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_POS', 'STAFF_INVOICES']);
      const posClient = await seedPosClient();
      const product = await seedStockedProduct({ staffId: user.staff!.id, defaultSalePrice: 1000 });

      const { saleId } = await confirmRealSale(token, product.id, { posClientId: posClient.id, paidAmount: 0 });
      let invoiceRow: { number: string } | null = null;
      await waitFor(async () => {
        invoiceRow = await prisma.invoice.findUnique({ where: { sourceType_sourceId: { sourceType: 'SALE', sourceId: saleId } } });
        return invoiceRow != null;
      });

      const paymentRes = await request(app)
        .post('/api/staff/client-payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ posClientId: posClient.id, invoiceNumber: invoiceRow!.number, amount: 1000 });
      expect(paymentRes.status).toBe(201);

      await waitFor(async () => {
        const invoice = await prisma.invoice.findUnique({ where: { number: invoiceRow!.number } });
        return invoice?.status === 'PAID';
      });
    });

    it('client A cannot fetch client B\'s invoice — 404', async () => {
      const [wilaya] = await seedWilayas();
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_POS']);
      const posClientA = await seedPosClient();
      const product = await seedStockedProduct({ staffId: staffUser.staff!.id, defaultSalePrice: 1000 });

      const { user: clientUserA, client: clientA } = await seedClientUser({
        wilayaId: wilaya!.wilayaId,
        communeId: wilaya!.communes[0]!.communeId,
        posClientId: posClientA.id,
      });
      const { user: clientUserB, client: clientB } = await seedClientUser({
        wilayaId: wilaya!.wilayaId,
        communeId: wilaya!.communes[0]!.communeId,
      });
      expect(clientB.posClientId).toBeNull();

      const { saleId } = await confirmRealSale(staffToken, product.id, { posClientId: posClientA.id });
      let invoiceRow: { number: string } | null = null;
      await waitFor(async () => {
        invoiceRow = await prisma.invoice.findUnique({ where: { sourceType_sourceId: { sourceType: 'SALE', sourceId: saleId } } });
        return invoiceRow != null;
      });

      const tokenA = generateToken({ sub: clientUserA.id, type: UserType.CLIENT, clientId: clientA.id });
      const tokenB = generateToken({ sub: clientUserB.id, type: UserType.CLIENT, clientId: clientB.id });

      const aReads = await request(app).get(`/api/clients/me/invoices/${invoiceRow!.number}`).set('Authorization', `Bearer ${tokenA}`);
      expect(aReads.status).toBe(200);

      const bReads = await request(app).get(`/api/clients/me/invoices/${invoiceRow!.number}`).set('Authorization', `Bearer ${tokenB}`);
      expect(bReads.status).toBe(404);
    });

    it('STAFF_INVOICES list is scoped to issued-by-me', async () => {
      const { user: staffA, token: tokenA } = await seedStaffWithPages(['STAFF_POS', 'STAFF_INVOICES']);
      const { token: tokenB } = await seedStaffWithPages(['STAFF_POS', 'STAFF_INVOICES']);
      const productA = await seedStockedProduct({ staffId: staffA.staff!.id, defaultSalePrice: 1000 });

      const { saleId } = await confirmRealSale(tokenA, productA.id);
      await waitFor(async () => {
        const invoice = await prisma.invoice.findUnique({ where: { sourceType_sourceId: { sourceType: 'SALE', sourceId: saleId } } });
        return invoice != null;
      });

      const bListRes = await request(app).get('/api/staff/invoices').set('Authorization', `Bearer ${tokenB}`);
      expect(bListRes.status).toBe(200);
      expect(bListRes.body.data.items).toEqual([]);

      const aListRes = await request(app).get('/api/staff/invoices').set('Authorization', `Bearer ${tokenA}`);
      expect(aListRes.status).toBe(200);
      expect(aListRes.body.data.items).toHaveLength(1);
    });

    it('concurrent payments on the same posClient serialize — snapshots chain without overlap', async () => {
      const { token } = await seedStaffWithPages(['STAFF_POS', 'STAFF_INVOICES']);
      const posClient = await seedPosClient({ isEnabled: true });
      await prisma.posClient.update({ where: { id: posClient.id }, data: { credit: 1000 } });

      const [res1, res2] = await Promise.all([
        request(app).post('/api/staff/client-payments').set('Authorization', `Bearer ${token}`).send({ posClientId: posClient.id, amount: 300 }),
        request(app).post('/api/staff/client-payments').set('Authorization', `Bearer ${token}`).send({ posClientId: posClient.id, amount: 200 }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const snapshots = [res1.body.data, res2.body.data].sort((a, b) => b.previousCredit - a.previousCredit);
      expect(snapshots[0]?.previousCredit).toBe(1000);
      expect(snapshots[1]?.previousCredit).toBe(snapshots[0]?.newCredit);
      expect(snapshots[1]?.newCredit).toBe(500); // 1000 - 300 - 200

      const finalPosClient = await prisma.posClient.findUniqueOrThrow({ where: { id: posClient.id } });
      expect(finalPosClient.credit.toNumber()).toBe(500);
    });
  });

  describe('PDF', () => {
    it('GET .../pdf returns a real application/pdf response', async () => {
      const { user, token } = await seedStaffWithPages(['STAFF_POS']);
      const { token: adminToken } = await mintAdminToken();
      const product = await seedStockedProduct({ staffId: user.staff!.id, defaultSalePrice: 1000 });

      const { saleId } = await confirmRealSale(token, product.id);
      let invoiceRow: { number: string } | null = null;
      await waitFor(async () => {
        invoiceRow = await prisma.invoice.findUnique({ where: { sourceType_sourceId: { sourceType: 'SALE', sourceId: saleId } } });
        return invoiceRow != null;
      });

      const pdfRes = await request(app)
        .get(`/api/admin/invoices/${invoiceRow!.number}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect((pdfRes.body as Buffer).length).toBeGreaterThan(0);
    });
  });
});
