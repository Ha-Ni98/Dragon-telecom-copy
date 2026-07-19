import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Prisma, UserType as PrismaUserType } from '@prisma/client';
import { MovementType, OrderResponseSchema, OrderStatsResponseSchema, UserType } from '@dragon-telecom/contract';
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
import { seedClientUser } from '../data/client.factory';
import { seedPosClient } from '../data/pos-client.factory';
import { seedWilayas } from '../data/wilaya.factory';
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

// getCartProducts (the viewer-pricing port, Sprint 2 discovery) resolves ONLY tier-price/
// guestPrice — never defaultSalePrice — so any product orderable via PLACE needs a real
// guestPrice, unlike sales' own seedStockedProduct (which relies on defaultSalePrice).
const seedOrderableProduct = async (options: { staffId: string; quantity?: number; unitCost?: number; guestPrice?: number | null }) => {
  const brand = await seedBrand();
  const family = await seedFamily();
  // `??` can't distinguish an explicit `null` (no guestPrice) from "unset" — options.guestPrice
  // must be checked against `undefined` specifically, mirroring seedProduct's own convention.
  const guestPrice = options.guestPrice !== undefined ? options.guestPrice : 1000;
  const product = await seedProduct({ brandId: brand.id, familyId: family.id, guestPrice });
  await prisma.$transaction(async (tx) => {
    await inventoryService.addLayer(tx, product.id, options.quantity ?? 10, options.unitCost ?? 400, MovementType.SUPPLIER_INVOICE, {
      referenceType: 'SUPPLIER_INVOICE',
      referenceId: product.id,
      staffId: options.staffId,
    });
  });
  return prisma.product.findUniqueOrThrow({ where: { id: product.id } });
};

// PICKUP requires a client token (BL#1) — guests can only ever place a DELIVERY order, so
// every test below that just needs *a* real PENDING order to progress through confirm/status/
// cancel places a guest DELIVERY_HOME order instead of PICKUP.
const placeGuestDeliveryOrder = async (productId: string, quantity = 1) => {
  const [wilaya] = await seedWilayas();
  return request(app)
    .post('/api/orders')
    .send({
      productId,
      quantity,
      orderType: 'DELIVERY_HOME',
      contact: { fullName: 'Guest', phone: '0555000000' },
      delivery: { wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId },
    });
};

// Post-commit listeners (billing/clients) run asynchronously — poll until the observable
// effect lands or the timeout trips, same precedent as billing/clients.integration.spec.ts.
const waitFor = async (check: () => Promise<boolean>, timeoutMs = 2000, intervalMs = 25): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('waitFor: condition not met within timeout');
};

describe('orders integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedSettings();
  });

  describe('PLACE — guest/client auth + viewer pricing', () => {
    it('rejects a guest PICKUP (400 — requires a client token)', async () => {
      const { user } = await seedStaffWithPages([]);
      const product = await seedOrderableProduct({ staffId: user.staff!.id });

      const res = await request(app)
        .post('/api/orders')
        .send({ productId: product.id, quantity: 1, orderType: 'PICKUP', contact: { fullName: 'Guest', phone: '0555000000' } });

      expect(res.status).toBe(400);
    });

    it('rejects a guest whose product has no guestPrice (403 GUEST_PRICE_HIDDEN)', async () => {
      const { user } = await seedStaffWithPages([]);
      const product = await seedOrderableProduct({ staffId: user.staff!.id, guestPrice: null });
      const [wilaya] = await seedWilayas();

      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: product.id,
          quantity: 1,
          orderType: 'DELIVERY_HOME',
          contact: { fullName: 'Guest', phone: '0555000000' },
          delivery: { wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId },
        });

      expect(res.status).toBe(403);
    });

    it('a guest with a guestPrice can place a DELIVERY_HOME order at the default delivery fee', async () => {
      const { user } = await seedStaffWithPages([]);
      const product = await seedOrderableProduct({ staffId: user.staff!.id, guestPrice: 1200 });
      const [wilaya] = await seedWilayas();

      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: product.id,
          quantity: 2,
          orderType: 'DELIVERY_HOME',
          contact: { fullName: 'Guest', phone: '0555000000' },
          delivery: { wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId },
        });

      expect(res.status).toBe(201);
      expect(() => OrderResponseSchema.parse(res.body.data)).not.toThrow();
      expect(res.body.data.resolvedPrice).toBe(1200);
      expect(res.body.data.unitPrice).toBe(1200);
      expect(res.body.data.deliveryFee).toBe(500); // DEFAULT_SETTINGS.delivery.defaultHome
      expect(res.body.data.subtotal).toBe(2400);
      expect(res.body.data.totalAmount).toBe(2900);
      expect(res.body.data.clientId).toBeUndefined();
    });

    it('rejects a placement whose body clientId does not match the authenticated client', async () => {
      const { user: staffUser } = await seedStaffWithPages([]);
      const product = await seedOrderableProduct({ staffId: staffUser.staff!.id });
      const [wilaya] = await seedWilayas();
      const { user, client } = await seedClientUser({ wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId });
      const token = generateToken({ sub: user.id, type: UserType.CLIENT, clientId: client.id });

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product.id,
          quantity: 1,
          clientId: '00000000-0000-4000-8000-000000000000',
          orderType: 'PICKUP',
          contact: { fullName: 'Karim', phone: '0555000000' },
        });

      expect(res.status).toBe(403);
    });
  });

  describe('place → confirm end-to-end', () => {
    it('drops real stock, emits order.confirmed once, issues one ORDER invoice, and bumps PosClient.totalSold', async () => {
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_ORDERS']);
      const product = await seedOrderableProduct({ staffId: staffUser.staff!.id, quantity: 10, unitCost: 400, guestPrice: 1000 });
      const [wilaya] = await seedWilayas();
      const posClient = await seedPosClient();
      const { user, client } = await seedClientUser({
        wilayaId: wilaya!.wilayaId,
        communeId: wilaya!.communes[0]!.communeId,
        posClientId: posClient.id,
      });
      const clientToken = generateToken({ sub: user.id, type: UserType.CLIENT, clientId: client.id });

      const placeRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ productId: product.id, quantity: 3, orderType: 'PICKUP', contact: { fullName: 'Karim', phone: '0555000000' } });
      expect(placeRes.status).toBe(201);
      const orderId = placeRes.body.data.id as string;

      const afterPlace = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterPlace.quantityOnHand).toBe(10);
      expect(afterPlace.quantityReserved).toBe(3);

      const confirmRes = await request(app)
        .post(`/api/staff/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.status).toBe('CONFIRMED');

      const afterConfirm = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterConfirm.quantityOnHand).toBe(7); // 10 - 3, real FIFO consumption
      expect(afterConfirm.quantityReserved).toBe(0);

      let invoiceRow: { number: string; totalCost: Prisma.Decimal; totalProfit: Prisma.Decimal } | null = null;
      await waitFor(async () => {
        invoiceRow = await prisma.invoice.findUnique({ where: { sourceType_sourceId: { sourceType: 'ORDER', sourceId: orderId } } });
        return invoiceRow != null;
      });
      expect(invoiceRow).not.toBeNull();

      // The issued ORDER invoice's cost/profit must equal the confirmed order's own stored FIFO
      // figures, not be zeroed out (audit fix A3).
      const confirmedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(invoiceRow!.totalCost.toNumber()).toBe(confirmedOrder.costOfGoods!.toNumber());
      expect(invoiceRow!.totalProfit.toNumber()).toBe(confirmedOrder.profit!.toNumber());
      expect(invoiceRow!.totalCost.toNumber()).toBe(1200); // 3 units @ unitCost 400 (seedOrderableProduct)

      await waitFor(async () => {
        const updated = await prisma.posClient.findUniqueOrThrow({ where: { id: posClient.id } });
        return updated.totalSold.toNumber() === 3000;
      });

      // Double confirm ⇒ idempotent, no second invoice.
      const secondConfirm = await request(app)
        .post(`/api/staff/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});
      expect(secondConfirm.status).toBe(200);
      const invoiceCount = await prisma.invoice.count({ where: { sourceType: 'ORDER', sourceId: orderId } });
      expect(invoiceCount).toBe(1);
    });

    it('an admin-driven confirm attributes Order.confirmedByStaffId and StockMovement.staffId to the admin\'s own Staff id, not system.internal (audit fix A2)', async () => {
      const { user: staffUser } = await seedStaffWithPages(['STAFF_ORDERS']);
      const product = await seedOrderableProduct({ staffId: staffUser.staff!.id, quantity: 5, unitCost: 400, guestPrice: 1000 });
      const { user: adminUser, token: adminToken } = await mintAdminToken();

      const placeRes = await placeGuestDeliveryOrder(product.id, 1);
      const orderId = placeRes.body.data.id as string;

      const confirmRes = await request(app)
        .post(`/api/staff/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(confirmRes.status).toBe(200);

      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.confirmedByStaffId).toBe(adminUser.staff!.id);

      const movement = await prisma.stockMovement.findFirstOrThrow({
        where: { referenceType: 'ORDER', referenceId: orderId, direction: 'OUT' },
      });
      expect(movement.staffId).toBe(adminUser.staff!.id);

      const systemStaff = await prisma.staff.findFirst({ where: { user: { username: 'system.internal' } } });
      expect(movement.staffId).not.toBe(systemStaff?.id);
    });

    it('mirrors Order.paidAmount from a real payment.clientRecorded emission (§C-2)', async () => {
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_ORDERS']);
      const product = await seedOrderableProduct({ staffId: staffUser.staff!.id, guestPrice: 1000 });
      const [wilaya] = await seedWilayas();
      const posClient = await seedPosClient();

      const placeRes = await request(app)
        .post('/api/orders')
        .send({
          productId: product.id,
          quantity: 2,
          orderType: 'DELIVERY_HOME',
          contact: { fullName: 'Guest', phone: '0555000000' },
          delivery: { wilayaId: wilaya!.wilayaId, communeId: wilaya!.communes[0]!.communeId },
        });
      const orderId = placeRes.body.data.id as string;

      await request(app).post(`/api/staff/orders/${orderId}/confirm`).set('Authorization', `Bearer ${staffToken}`).send({});

      let invoiceRow: { id: string; number: string } | null = null;
      await waitFor(async () => {
        invoiceRow = await prisma.invoice.findUnique({ where: { sourceType_sourceId: { sourceType: 'ORDER', sourceId: orderId } } });
        return invoiceRow != null;
      });

      await prisma.clientPayment.create({
        data: {
          reference: `REG-${orderId.slice(0, 8)}`,
          posClientId: posClient.id,
          invoiceId: invoiceRow!.id,
          amount: 2500,
          previousCredit: 0,
          newCredit: -2500,
          staffId: staffUser.staff!.id,
        },
      });

      const paymentPayload = {
        paymentId: '00000000-0000-4000-8000-000000000001',
        posClientId: posClient.id,
        invoiceNumber: invoiceRow!.number,
        amount: 2500,
        previousCredit: 0,
        newCredit: -2500,
      };

      // billing.listener.ts is subscribed to this same event and independently recomputes
      // Invoice.paidAmount from Σ ClientPayment.amount — racing orders' own listener (which
      // just reads whatever Invoice.paidAmount currently holds) on the very same emission.
      // The accepted §C-2 design is eventually-consistent *across replay*, not atomically
      // ordered within one emission — so settle billing's recompute first...
      eventBus.emit('payment.clientRecorded', paymentPayload);
      await waitFor(async () => {
        const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceRow!.id } });
        return invoice.paidAmount.toNumber() === 2500;
      });

      // ...then replay the identical event: Invoice.paidAmount is now settled, so this second,
      // otherwise-idempotent emission is what orders' own listener deterministically mirrors.
      eventBus.emit('payment.clientRecorded', paymentPayload);
      await waitFor(async () => {
        const updated = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
        return updated.paidAmount.toNumber() === 2500;
      });
    });
  });

  describe('status machine — forward-only to COMPLETED', () => {
    it('advances CONFIRMED → PACKAGED → IN_DELIVERY (requires company/tracking) → COMPLETED; rejects backward', async () => {
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_ORDERS']);
      const product = await seedOrderableProduct({ staffId: staffUser.staff!.id });

      const placeRes = await placeGuestDeliveryOrder(product.id);
      const orderId = placeRes.body.data.id as string;

      await request(app).post(`/api/staff/orders/${orderId}/confirm`).set('Authorization', `Bearer ${staffToken}`).send({});

      const toPackaged = await request(app)
        .patch(`/api/staff/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'PACKAGED' });
      expect(toPackaged.status).toBe(200);

      const missingTracking = await request(app)
        .patch(`/api/staff/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'IN_DELIVERY' });
      expect(missingTracking.status).toBe(400);

      const toInDelivery = await request(app)
        .patch(`/api/staff/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'IN_DELIVERY', deliveryCompany: 'Yalidine', trackingNumber: 'TRK-1' });
      expect(toInDelivery.status).toBe(200);

      const backward = await request(app)
        .patch(`/api/staff/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'PACKAGED' });
      expect(backward.status).toBe(400);

      const toCompleted = await request(app)
        .patch(`/api/staff/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'COMPLETED' });
      expect(toCompleted.status).toBe(200);
      expect(toCompleted.body.data.status).toBe('COMPLETED');
      expect(toCompleted.body.data.deliveredAt).not.toBeNull();
    });
  });

  describe('admin-only cancel/return', () => {
    it('staff (holding STAFF_ORDERS) is 403d on the admin-only cancel/return routes', async () => {
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_ORDERS']);
      const product = await seedOrderableProduct({ staffId: staffUser.staff!.id });

      const placeRes = await placeGuestDeliveryOrder(product.id);
      const orderId = placeRes.body.data.id as string;

      const cancelRes = await request(app)
        .post(`/api/admin/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});
      expect(cancelRes.status).toBe(403);

      const returnRes = await request(app)
        .post(`/api/admin/orders/${orderId}/return`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ quantity: 1, restock: true, refundAmount: 1000 });
      expect(returnRes.status).toBe(403);
    });

    it('admin cancel from PENDING releases the reservation back to available stock', async () => {
      const { user: staffUser } = await seedStaffWithPages([]);
      const product = await seedOrderableProduct({ staffId: staffUser.staff!.id, quantity: 10 });
      const { token: adminToken } = await mintAdminToken();

      const placeRes = await placeGuestDeliveryOrder(product.id, 4);
      const orderId = placeRes.body.data.id as string;

      const cancelRes = await request(app).post(`/api/admin/orders/${orderId}/cancel`).set('Authorization', `Bearer ${adminToken}`).send({});
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const afterCancel = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterCancel.quantityReserved).toBe(0);
      expect(afterCancel.quantityOnHand).toBe(10);
    });

    it('admin return from COMPLETED with restock:true restores real stock via a RETURN_IN movement', async () => {
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_ORDERS']);
      const product = await seedOrderableProduct({ staffId: staffUser.staff!.id, quantity: 10, unitCost: 400 });
      const { token: adminToken } = await mintAdminToken();

      const placeRes = await placeGuestDeliveryOrder(product.id, 2);
      const orderId = placeRes.body.data.id as string;

      await request(app).post(`/api/staff/orders/${orderId}/confirm`).set('Authorization', `Bearer ${staffToken}`).send({});
      await request(app)
        .patch(`/api/staff/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'PACKAGED' });
      await request(app)
        .patch(`/api/staff/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'IN_DELIVERY', deliveryCompany: 'Yalidine', trackingNumber: 'TRK-1' });
      await request(app).patch(`/api/staff/orders/${orderId}/status`).set('Authorization', `Bearer ${staffToken}`).send({ status: 'COMPLETED' });

      const afterConfirm = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterConfirm.quantityOnHand).toBe(8); // 10 - 2

      const returnRes = await request(app)
        .post(`/api/admin/orders/${orderId}/return`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 2, restock: true, refundAmount: 2000 });
      expect(returnRes.status).toBe(200);
      expect(returnRes.body.data.status).toBe('RETURNED');

      const afterReturn = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(afterReturn.quantityOnHand).toBe(10); // 8 + 2 restocked

      const returnInMovement = await prisma.stockMovement.findFirst({ where: { productId: product.id, type: 'RETURN_IN' } });
      expect(returnInMovement).not.toBeNull();
    });
  });

  describe('backoffice list + stats', () => {
    it('STAFF_LIST and ADMIN_LIST see the same rows (orders have no owner staff)', async () => {
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_ORDERS']);
      const product = await seedOrderableProduct({ staffId: staffUser.staff!.id });
      const { token: adminToken } = await mintAdminToken();

      await placeGuestDeliveryOrder(product.id);

      const staffList = await request(app).get('/api/staff/orders').set('Authorization', `Bearer ${staffToken}`);
      const adminList = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${adminToken}`);

      expect(staffList.status).toBe(200);
      expect(adminList.status).toBe(200);
      expect(staffList.body.data.items).toHaveLength(1);
      expect(adminList.body.data.items).toHaveLength(1);
      expect(staffList.body.data.items[0].id).toBe(adminList.body.data.items[0].id);
    });

    it('STAFF_STATS reflects a per-status roll-up', async () => {
      const { user: staffUser, token: staffToken } = await seedStaffWithPages(['STAFF_ORDERS']);
      const product = await seedOrderableProduct({ staffId: staffUser.staff!.id, quantity: 10 });

      await placeGuestDeliveryOrder(product.id);
      await placeGuestDeliveryOrder(product.id);

      const statsRes = await request(app).get('/api/staff/orders/stats').set('Authorization', `Bearer ${staffToken}`);
      expect(statsRes.status).toBe(200);
      expect(() => OrderStatsResponseSchema.parse(statsRes.body.data)).not.toThrow();
      expect(statsRes.body.data.pending).toBe(2);
    });
  });
});
