import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { UserType as PrismaUserType } from '@prisma/client';
import {
  UserType,
  SupplierResponseSchema,
  SupplierInvoiceResponseSchema,
  ConfirmResultResponseSchema,
  SupplierPaymentResponseSchema,
} from '@dragon-telecom/contract';
import { app } from '../../src/app';
import { prisma } from '../../src/common/db/prisma';
import { generateToken } from '../../src/common/utils/token.utils';
import { resetDatabase } from '../fixtures/db.fixture';
import { seedSettings } from '../data/settings.factory';
import { seedUser } from '../data/user.factory';
import { seedSupplier } from '../data/supplier.factory';
import { seedBrand } from '../data/brand.factory';
import { seedFamily } from '../data/family.factory';
import { seedProduct } from '../data/product.factory';

const mintTokenFor = (user: { id: string; type: PrismaUserType; staff?: { id: string } | null }): string =>
  generateToken({ sub: user.id, type: user.type as UserType, ...(user.staff ? { staffId: user.staff.id } : {}) });

describe('purchasing integration', () => {
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase();
    await seedSettings();
    const { user: adminUser } = await seedUser({ type: UserType.ADMIN });
    adminToken = mintTokenFor(adminUser);
  });

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  describe('supplier CRUD', () => {
    it('creates, lists, gets the detail aggregate, and updates a supplier', async () => {
      const createRes = await request(app)
        .post('/api/admin/suppliers')
        .set(auth())
        .send({ name: 'Acme Parts', initialCredit: 500 });
      expect(createRes.status).toBe(201);
      expect(() => SupplierResponseSchema.parse(createRes.body.data)).not.toThrow();
      expect(createRes.body.data.credit).toBe(500);
      const supplierId = createRes.body.data.id as string;

      const listRes = await request(app).get('/api/admin/suppliers').set(auth());
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items).toHaveLength(1);

      const detailRes = await request(app).get(`/api/admin/suppliers/${supplierId}`).set(auth());
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.supplier.id).toBe(supplierId);
      expect(detailRes.body.data.invoices).toEqual([]);
      expect(detailRes.body.data.payments).toEqual([]);

      const updateRes = await request(app)
        .patch(`/api/admin/suppliers/${supplierId}`)
        .set(auth())
        .send({ isEnabled: false });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.isEnabled).toBe(false);

      const statsRes = await request(app).get('/api/admin/suppliers/stats').set(auth());
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.totalSuppliers).toBe(1);
      expect(statsRes.body.data.totalCredit).toBe(500);
    });
  });

  describe('invoice DRAFT → confirm → reprice candidates → payment ledger', () => {
    it('walks the full lifecycle against a real product and supplier', async () => {
      const supplier = await seedSupplier();
      const brand = await seedBrand();
      const family = await seedFamily();
      const product = await seedProduct({ brandId: brand.id, familyId: family.id, quantityOnHand: 10, averageCost: 100 });

      const createRes = await request(app)
        .post('/api/admin/supplier-invoices')
        .set(auth())
        .send({
          supplierId: supplier.id,
          invoiceDate: '2026-01-15',
          shippingCost: 50,
          lines: [{ productId: product.id, quantity: 10, unitCost: 100 }],
        });
      expect(createRes.status).toBe(201);
      expect(() => SupplierInvoiceResponseSchema.parse(createRes.body.data)).not.toThrow();
      expect(createRes.body.data.status).toBe('DRAFT');
      expect(createRes.body.data.lines[0]).toHaveProperty('projectedNewAverageCost');
      const invoiceId = createRes.body.data.id as string;

      const confirmRes = await request(app).post(`/api/admin/supplier-invoices/${invoiceId}/confirm`).set(auth());
      expect(confirmRes.status).toBe(200);
      expect(() => ConfirmResultResponseSchema.parse(confirmRes.body.data)).not.toThrow();
      expect(confirmRes.body.data.repriceCandidates).toHaveLength(1);
      expect(confirmRes.body.data.repriceCandidates[0].productId).toBe(product.id);

      const confirmedInvoice = await prisma.supplierInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(confirmedInvoice.status).toBe('CONFIRMED');
      expect(confirmedInvoice.reference).not.toMatch(/^DRAFT-/);

      const movements = await prisma.stockMovement.findMany({ where: { productId: product.id } });
      expect(movements).toHaveLength(1);
      expect(movements[0]?.quantity).toBe(10);

      const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(updatedProduct.quantityOnHand).toBe(20);

      const supplierAfterConfirm = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } });
      expect(supplierAfterConfirm.credit.toNumber()).toBe(1050); // 10*100 + 50 shipping

      // Double-confirm is a no-op — no second movement, same reference.
      const reconfirmRes = await request(app).post(`/api/admin/supplier-invoices/${invoiceId}/confirm`).set(auth());
      expect(reconfirmRes.status).toBe(200);
      expect(reconfirmRes.body.data.reference).toBe(confirmedInvoice.reference);
      const movementsAfterReconfirm = await prisma.stockMovement.findMany({ where: { productId: product.id } });
      expect(movementsAfterReconfirm).toHaveLength(1);

      const paymentRes = await request(app)
        .post('/api/admin/supplier-payments')
        .set(auth())
        .send({ supplierId: supplier.id, supplierInvoiceReference: confirmedInvoice.reference, amount: 400 });
      expect(paymentRes.status).toBe(201);
      expect(() => SupplierPaymentResponseSchema.parse(paymentRes.body.data)).not.toThrow();
      expect(paymentRes.body.data.previousCredit).toBe(1050);
      expect(paymentRes.body.data.newCredit).toBe(650);

      const supplierAfterPayment = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } });
      expect(supplierAfterPayment.credit.toNumber()).toBe(650);
      expect(supplierAfterPayment.totalPaid.toNumber()).toBe(400);

      const paymentsListRes = await request(app).get(`/api/admin/supplier-payments?supplierId=${supplier.id}`).set(auth());
      expect(paymentsListRes.body.data.items).toHaveLength(1);
    });

    it('PATCH after confirm 409s — the invoice is immutable', async () => {
      const supplier = await seedSupplier();
      const createRes = await request(app)
        .post('/api/admin/supplier-invoices')
        .set(auth())
        .send({ supplierId: supplier.id, invoiceDate: '2026-01-15', amountOnly: 1000 });
      const invoiceId = createRes.body.data.id as string;

      await request(app).post(`/api/admin/supplier-invoices/${invoiceId}/confirm`).set(auth());

      const patchRes = await request(app)
        .patch(`/api/admin/supplier-invoices/${invoiceId}`)
        .set(auth())
        .send({ note: 'too late' });
      expect(patchRes.status).toBe(409);
    });

    it('amountOnly + lines together 400s', async () => {
      const supplier = await seedSupplier();
      const res = await request(app)
        .post('/api/admin/supplier-invoices')
        .set(auth())
        .send({
          supplierId: supplier.id,
          invoiceDate: '2026-01-15',
          amountOnly: 100,
          lines: [{ productId: '00000000-0000-4000-8000-000000000000', quantity: 1, unitCost: 10 }],
        });
      expect(res.status).toBe(400);
    });
  });

  describe('cancel', () => {
    it('reverses credit only for a previously-confirmed invoice', async () => {
      const supplier = await seedSupplier();
      const createRes = await request(app)
        .post('/api/admin/supplier-invoices')
        .set(auth())
        .send({ supplierId: supplier.id, invoiceDate: '2026-01-15', amountOnly: 800 });
      const invoiceId = createRes.body.data.id as string;

      await request(app).post(`/api/admin/supplier-invoices/${invoiceId}/confirm`).set(auth());
      const afterConfirm = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } });
      expect(afterConfirm.credit.toNumber()).toBe(800);

      const cancelRes = await request(app)
        .post(`/api/admin/supplier-invoices/${invoiceId}/cancel`)
        .set(auth())
        .send({ reason: 'goods rejected' });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const afterCancel = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } });
      expect(afterCancel.credit.toNumber()).toBe(0);
    });

    it('cancelling a DRAFT invoice does not touch credit (nothing to reverse)', async () => {
      const supplier = await seedSupplier();
      const createRes = await request(app)
        .post('/api/admin/supplier-invoices')
        .set(auth())
        .send({ supplierId: supplier.id, invoiceDate: '2026-01-15', amountOnly: 800 });
      const invoiceId = createRes.body.data.id as string;

      const cancelRes = await request(app).post(`/api/admin/supplier-invoices/${invoiceId}/cancel`).set(auth()).send({});
      expect(cancelRes.status).toBe(200);

      const supplierAfter = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } });
      expect(supplierAfter.credit.toNumber()).toBe(0);
    });
  });

  describe('concurrency', () => {
    it('two parallel payments on the same supplier serialize (FOR UPDATE) — both snapshots are consistent', async () => {
      const supplier = await seedSupplier({ credit: 1000 });

      const [res1, res2] = await Promise.all([
        request(app).post('/api/admin/supplier-payments').set(auth()).send({ supplierId: supplier.id, amount: 300 }),
        request(app).post('/api/admin/supplier-payments').set(auth()).send({ supplierId: supplier.id, amount: 200 }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      // Serialized, not interleaved: the two previousCredit/newCredit snapshots must chain
      // without overlapping (one payment's previousCredit equals the other's newCredit).
      const snapshots = [res1.body.data, res2.body.data].sort((a, b) => b.previousCredit - a.previousCredit);
      expect(snapshots[0].previousCredit).toBe(1000);
      expect(snapshots[1].previousCredit).toBe(snapshots[0].newCredit);
      expect(snapshots[1].newCredit).toBe(500); // 1000 - 300 - 200

      const finalSupplier = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } });
      expect(finalSupplier.credit.toNumber()).toBe(500);
      expect(finalSupplier.totalPaid.toNumber()).toBe(500);
    });

    it('two parallel confirms of the same invoice are safe — exactly one set of movements', async () => {
      const supplier = await seedSupplier();
      const brand = await seedBrand();
      const family = await seedFamily();
      const product = await seedProduct({ brandId: brand.id, familyId: family.id, quantityOnHand: 0, averageCost: 0 });

      const createRes = await request(app)
        .post('/api/admin/supplier-invoices')
        .set(auth())
        .send({ supplierId: supplier.id, invoiceDate: '2026-01-15', lines: [{ productId: product.id, quantity: 5, unitCost: 50 }] });
      const invoiceId = createRes.body.data.id as string;

      const [confirm1, confirm2] = await Promise.all([
        request(app).post(`/api/admin/supplier-invoices/${invoiceId}/confirm`).set(auth()),
        request(app).post(`/api/admin/supplier-invoices/${invoiceId}/confirm`).set(auth()),
      ]);

      expect(confirm1.status).toBe(200);
      expect(confirm2.status).toBe(200);

      const movements = await prisma.stockMovement.findMany({ where: { productId: product.id } });
      expect(movements).toHaveLength(1);

      const finalSupplier = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } });
      expect(finalSupplier.credit.toNumber()).toBe(250); // 5*50, exactly once
    });
  });

  // "Supplier.credit == opening + Σ confirmed invoices − Σ payments" (spec BL#6 conformance).
  describe('Supplier.credit == opening + Σ confirmed − Σ payments (property)', () => {
    it('holds after a mix of confirms and payments', async () => {
      const supplier = await seedSupplier({ credit: 200 }); // opening

      const invoiceA = await request(app)
        .post('/api/admin/supplier-invoices')
        .set(auth())
        .send({ supplierId: supplier.id, invoiceDate: '2026-01-15', amountOnly: 1000 });
      await request(app).post(`/api/admin/supplier-invoices/${invoiceA.body.data.id}/confirm`).set(auth());

      const invoiceB = await request(app)
        .post('/api/admin/supplier-invoices')
        .set(auth())
        .send({ supplierId: supplier.id, invoiceDate: '2026-01-16', amountOnly: 500 });
      await request(app).post(`/api/admin/supplier-invoices/${invoiceB.body.data.id}/confirm`).set(auth());

      await request(app).post('/api/admin/supplier-payments').set(auth()).send({ supplierId: supplier.id, amount: 300 });
      await request(app).post('/api/admin/supplier-payments').set(auth()).send({ supplierId: supplier.id, amount: 400 });

      const finalSupplier = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } });
      // opening 200 + confirmed(1000+500) - payments(300+400) = 1000
      expect(finalSupplier.credit.toNumber()).toBe(1000);
    });
  });

  // Credit-serialization fix (plan-credit-serialization.md §C1): the exact scenario the audit
  // report diagnosed — no Promise.all, just two back-to-back sequential requests fast enough to
  // race a post-commit listener. Now that the write lives inside the confirm/payment transaction
  // itself, this is no longer timing-dependent.
  describe('two sequential rapid payments (no Promise.all)', () => {
    it('produce the correct final credit', async () => {
      const supplier = await seedSupplier({ credit: 1000 });

      const first = await request(app).post('/api/admin/supplier-payments').set(auth()).send({ supplierId: supplier.id, amount: 300 });
      const second = await request(app).post('/api/admin/supplier-payments').set(auth()).send({ supplierId: supplier.id, amount: 200 });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.data.previousCredit).toBe(first.body.data.newCredit);

      const finalSupplier = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } });
      expect(finalSupplier.credit.toNumber()).toBe(500); // 1000 - 300 - 200
      expect(finalSupplier.totalPaid.toNumber()).toBe(500);
    });
  });
});
