import { describe, it, expect } from 'vitest';
import request from 'supertest';
import {
  IDENTITY_ROUTES,
  CATALOG_ROUTES,
  CLIENT_ROUTES,
  POS_CLIENT_ROUTES,
  INVENTORY_ROUTES,
  PLATFORM_ROUTES,
  PURCHASING_ROUTES,
  SALE_ROUTES,
  ORDER_ROUTES,
  REPAIR_ROUTES,
  BILLING_ROUTES,
  STATS_ROUTES,
  OBS_ROUTES,
} from '@dragon-telecom/contract';
import { env } from '../../src/env';
import { app } from '../../src/app';

// Sub-01 mounts no module routers yet (src/modules/ is empty by design — see plan.md).
// This establishes the enumeration + prefix-composition mechanism now; once Sub-02 mounts
// routers, extend this with live supertest requests asserting each composed path resolves
// (not 404) on `app`.
const ROUTE_MAPS: Record<string, Record<string, string>> = {
  IDENTITY_ROUTES,
  CATALOG_ROUTES,
  CLIENT_ROUTES,
  POS_CLIENT_ROUTES,
  INVENTORY_ROUTES,
  PLATFORM_ROUTES,
  PURCHASING_ROUTES,
  SALE_ROUTES,
  ORDER_ROUTES,
  REPAIR_ROUTES,
  BILLING_ROUTES,
  STATS_ROUTES,
  OBS_ROUTES,
};

describe('route conformance', () => {
  it('every *_ROUTES constant is a relative path (the env.API_PREFIX is not baked in)', () => {
    for (const [mapName, routes] of Object.entries(ROUTE_MAPS)) {
      for (const [key, path] of Object.entries(routes)) {
        expect(path.startsWith('/'), `${mapName}.${key} = "${path}"`).toBe(true);
        expect(path.startsWith(env.API_PREFIX), `${mapName}.${key} = "${path}"`).toBe(false);
      }
    }
  });

  it('composes every route under env.API_PREFIX without a double slash', () => {
    for (const [mapName, routes] of Object.entries(ROUTE_MAPS)) {
      for (const [key, path] of Object.entries(routes)) {
        const composed = `${env.API_PREFIX}${path}`;
        expect(composed, `${mapName}.${key}`).not.toContain('//');
        expect(composed.startsWith(env.API_PREFIX), `${mapName}.${key}`).toBe(true);
      }
    }
  });

  // Sub-02 mounts identity now — live requests confirm every path actually resolves on `app`
  // (an unmatched Express route returns a bare non-JSON 404 with no `success` key; every route
  // that *does* resolve responds through our envelope — sendSuccess or globalErrorHandler —
  // even when unauthenticated/invalid, both of which always include `success`). Deliberately
  // DB-free: every request below is sent with no Authorization header, so requireAuth's
  // missing-token check short-circuits before any `checkDB` lookup or service/Prisma call —
  // keeping this file in test:unit's "fast, no DB" tier per test-rules.md §3. Response-shape
  // (parsing real payloads through the contract DTO schemas) is covered where real authenticated
  // 200/201 responses already exist: test/integration/identity.integration.spec.ts.
  describe('identity route resolution (mounted, no DB required)', () => {
    it('every IDENTITY_ROUTES path resolves on `app`, not a raw unmatched-route 404', async () => {
      const dummyId = '00000000-0000-4000-8000-000000000000';
      const cases: { method: 'get' | 'post' | 'patch' | 'put'; path: string }[] = [
        { method: 'post', path: IDENTITY_ROUTES.LOGIN },
        { method: 'post', path: IDENTITY_ROUTES.REFRESH },
        { method: 'post', path: IDENTITY_ROUTES.LOGOUT },
        { method: 'get', path: IDENTITY_ROUTES.ME_PERMISSIONS },
        { method: 'get', path: IDENTITY_ROUTES.USERS },
        { method: 'post', path: IDENTITY_ROUTES.USERS },
        { method: 'get', path: IDENTITY_ROUTES.USER_BY_ID.replace(':id', dummyId) },
        { method: 'patch', path: IDENTITY_ROUTES.USER_BY_ID.replace(':id', dummyId) },
        { method: 'get', path: IDENTITY_ROUTES.ROLES },
        { method: 'post', path: IDENTITY_ROUTES.ROLES },
        { method: 'patch', path: IDENTITY_ROUTES.ROLE_BY_ID.replace(':id', dummyId) },
        { method: 'put', path: IDENTITY_ROUTES.ROLE_PAGES.replace(':id', dummyId) },
        { method: 'get', path: IDENTITY_ROUTES.PAGES },
        { method: 'get', path: IDENTITY_ROUTES.TECHNICIANS },
        { method: 'post', path: IDENTITY_ROUTES.TECHNICIANS },
        { method: 'patch', path: IDENTITY_ROUTES.TECHNICIAN_BY_ID.replace(':id', dummyId) },
      ];

      for (const { method, path } of cases) {
        const res = await request(app)[method](`${env.API_PREFIX}${path}`);
        expect(res.body, `${method.toUpperCase()} ${path} (status ${res.status})`).toHaveProperty('success');
      }
    });
  });

  // WILAYAS / FEE / SETTINGS_PUBLIC are public routes (no requireAuth guard) — unlike every
  // identity route, hitting them unauthenticated would still run the real DB-backed handler,
  // breaking this tier's "fast, no DB" promise (test-rules.md §3). Their resolution +
  // response-shape are covered in test/integration/platform.integration.spec.ts instead, where a
  // real test DB is already up. Only the admin-guarded routes are checked here, deliberately
  // scoped down from "every PLATFORM_ROUTES path" — same trick as the identity block:
  // requireAuth's missing-token check short-circuits before any Prisma call either way.
  describe('platform route resolution (admin-guarded routes only, mounted, no DB required)', () => {
    it('every admin-guarded PLATFORM_ROUTES path resolves on `app`, not a raw unmatched-route 404', async () => {
      const cases: { method: 'get' | 'post' | 'patch' | 'put'; path: string }[] = [
        { method: 'get', path: PLATFORM_ROUTES.ADMIN_FEES },
        { method: 'put', path: PLATFORM_ROUTES.ADMIN_FEES },
        { method: 'post', path: PLATFORM_ROUTES.FEES_IMPORT },
        { method: 'get', path: PLATFORM_ROUTES.FEES_EXPORT },
        { method: 'get', path: PLATFORM_ROUTES.SETTINGS },
        { method: 'patch', path: PLATFORM_ROUTES.SETTINGS },
      ];

      for (const { method, path } of cases) {
        const res = await request(app)[method](`${env.API_PREFIX}${path}`);
        expect(res.body, `${method.toUpperCase()} ${path} (status ${res.status})`).toHaveProperty('success');
      }
    });
  });

  // Every OBS_ROUTES path is guarded (unlike platform's 3 public routes) — the identity
  // precedent applies directly here: requireAuth's missing-token check short-circuits before any
  // Prisma call, so all 6 routes stay DB-free.
  describe('observability route resolution (mounted, no DB required)', () => {
    it('every OBS_ROUTES path resolves on `app`, not a raw unmatched-route 404', async () => {
      const dummyId = '00000000-0000-4000-8000-000000000000';
      const cases: { method: 'get' | 'post'; path: string }[] = [
        { method: 'post', path: OBS_ROUTES.CLIENT_BEACON },
        { method: 'post', path: OBS_ROUTES.STAFF_SEARCH_BEACON },
        { method: 'get', path: OBS_ROUTES.CLIENT_ACTIVITY.replace(':id', dummyId) },
        { method: 'get', path: OBS_ROUTES.STAFF_SEARCHES },
        { method: 'get', path: OBS_ROUTES.LOGS },
        { method: 'get', path: OBS_ROUTES.LOG_STATS },
      ];

      for (const { method, path } of cases) {
        const res = await request(app)[method](`${env.API_PREFIX}${path}`);
        expect(res.body, `${method.toUpperCase()} ${path} (status ${res.status})`).toHaveProperty('success');
      }
    });
  });

  // BRANDS/FAMILIES/MODELS/PRODUCTS/PRODUCT_DETAIL are public (or optional-viewer, which still
  // runs the DB-backed handler unauthenticated) — same reasoning as platform's public routes,
  // covered in test/integration/catalog.integration.spec.ts instead. Only the guarded routes
  // (requireAuth short-circuits before any Prisma call on a missing token, including the
  // `pages`-gated STAFF_PRODUCTS check) are checked here, DB-free.
  describe('catalog route resolution (guarded routes only, mounted, no DB required)', () => {
    it('every guarded CATALOG_ROUTES path resolves on `app`, not a raw unmatched-route 404', async () => {
      const dummyId = '00000000-0000-4000-8000-000000000000';
      const cases: { method: 'get' | 'post' | 'patch' | 'put'; path: string }[] = [
        { method: 'get', path: CATALOG_ROUTES.STAFF_PRODUCTS },
        { method: 'get', path: CATALOG_ROUTES.CATEGORIES },
        { method: 'get', path: CATALOG_ROUTES.PRODUCT_STATS },
        { method: 'get', path: CATALOG_ROUTES.ADMIN_PRODUCTS },
        { method: 'post', path: CATALOG_ROUTES.ADMIN_PRODUCTS },
        { method: 'get', path: CATALOG_ROUTES.ADMIN_PRODUCT_BY_ID.replace(':id', dummyId) },
        { method: 'patch', path: CATALOG_ROUTES.ADMIN_PRODUCT_BY_ID.replace(':id', dummyId) },
        { method: 'patch', path: CATALOG_ROUTES.PRICING.replace(':id', dummyId) },
        { method: 'post', path: CATALOG_ROUTES.IMAGES.replace(':id', dummyId) },
        { method: 'patch', path: CATALOG_ROUTES.IMAGES.replace(':id', dummyId) },
        { method: 'get', path: CATALOG_ROUTES.ADMIN_BRANDS },
        { method: 'post', path: CATALOG_ROUTES.ADMIN_BRANDS },
        { method: 'patch', path: CATALOG_ROUTES.ADMIN_BRAND_BY_ID.replace(':id', dummyId) },
        { method: 'get', path: CATALOG_ROUTES.ADMIN_FAMILIES },
        { method: 'post', path: CATALOG_ROUTES.ADMIN_FAMILIES },
        { method: 'patch', path: CATALOG_ROUTES.ADMIN_FAMILY_BY_ID.replace(':id', dummyId) },
        { method: 'get', path: CATALOG_ROUTES.ADMIN_MODELS },
        { method: 'post', path: CATALOG_ROUTES.ADMIN_MODELS },
        { method: 'patch', path: CATALOG_ROUTES.ADMIN_MODEL_BY_ID.replace(':id', dummyId) },
        { method: 'put', path: CATALOG_ROUTES.MODEL_FAMILIES.replace(':id', dummyId) },
        { method: 'post', path: CATALOG_ROUTES.CATEGORIES_CUD },
        { method: 'patch', path: CATALOG_ROUTES.CATEGORY_BY_ID.replace(':id', dummyId) },
      ];

      for (const { method, path } of cases) {
        const res = await request(app)[method](`${env.API_PREFIX}${path}`);
        expect(res.body, `${method.toUpperCase()} ${path} (status ${res.status})`).toHaveProperty('success');
      }
    });
    // PRODUCT_STATS-before-ADMIN_PRODUCT_BY_ID route ordering can't be distinguished DB-free:
    // both routes share the same `adminOnly` guard, which 401s identically before either route's
    // `validateRequest` ever runs on an unauthenticated request. Verified for real, authenticated,
    // in test/integration/catalog.integration.spec.ts instead (§4.3).
  });

  // Every INVENTORY_ROUTES path is admin-guarded (no public routes at all) — the platform/
  // identity precedent applies directly: requireAuth's missing-token check short-circuits
  // before any Prisma call, so all four routes stay DB-free. Response-shape + authenticated
  // behavior (stock/movements/reservations/adjustments) are covered in
  // test/integration/inventory.integration.spec.ts instead, where a real test DB is already up.
  describe('inventory route resolution (mounted, no DB required)', () => {
    it('every INVENTORY_ROUTES path resolves on `app`, not a raw unmatched-route 404', async () => {
      const cases: { method: 'get' | 'post'; path: string }[] = [
        { method: 'get', path: INVENTORY_ROUTES.STOCK },
        { method: 'get', path: INVENTORY_ROUTES.MOVEMENTS },
        { method: 'get', path: INVENTORY_ROUTES.RESERVATIONS },
        { method: 'post', path: INVENTORY_ROUTES.ADJUSTMENTS },
      ];

      for (const { method, path } of cases) {
        const res = await request(app)[method](`${env.API_PREFIX}${path}`);
        expect(res.body, `${method.toUpperCase()} ${path} (status ${res.status})`).toHaveProperty('success');
      }
    });
  });

  // VALIDATE_PHONE/REGISTER are public (no requireAuth guard) — same reasoning as platform's
  // public routes: hitting them unauthenticated still runs the real DB-backed handler, breaking
  // this tier's "fast, no DB" promise. Covered in test/integration/clients.integration.spec.ts
  // instead. Every other CLIENT_ROUTES/POS_CLIENT_ROUTES path is guarded (client/staff/admin),
  // so requireAuth's missing-token check short-circuits before any Prisma call — including the
  // POS_CLIENT_ROUTES.SEARCH custom OR-page guard, whose first stage is `requireAuth` too.
  describe('clients route resolution (guarded routes only, mounted, no DB required)', () => {
    it('every guarded CLIENT_ROUTES/POS_CLIENT_ROUTES path resolves on `app`, not a raw unmatched-route 404', async () => {
      const dummyId = '00000000-0000-4000-8000-000000000000';
      const cases: { method: 'get' | 'post' | 'patch' | 'delete'; path: string }[] = [
        { method: 'get', path: CLIENT_ROUTES.ME },
        { method: 'patch', path: CLIENT_ROUTES.ME },
        { method: 'post', path: CLIENT_ROUTES.ME_PASSWORD },
        { method: 'get', path: CLIENT_ROUTES.CART },
        { method: 'post', path: CLIENT_ROUTES.CART },
        { method: 'delete', path: CLIENT_ROUTES.CART_ITEM.replace(':productId', dummyId) },
        { method: 'get', path: CLIENT_ROUTES.ADMIN_LIST },
        { method: 'get', path: CLIENT_ROUTES.ADMIN_STATS },
        { method: 'get', path: CLIENT_ROUTES.ADMIN_DETAIL.replace(':id', dummyId) },
        { method: 'post', path: CLIENT_ROUTES.APPROVE.replace(':id', dummyId) },
        { method: 'post', path: CLIENT_ROUTES.REJECT.replace(':id', dummyId) },
        { method: 'post', path: CLIENT_ROUTES.RESET_PASSWORD.replace(':id', dummyId) },
        { method: 'patch', path: CLIENT_ROUTES.ADMIN_UPDATE.replace(':id', dummyId) },
        { method: 'get', path: POS_CLIENT_ROUTES.SEARCH },
        { method: 'post', path: POS_CLIENT_ROUTES.QUICK_CREATE },
        { method: 'get', path: POS_CLIENT_ROUTES.ADMIN },
        { method: 'post', path: POS_CLIENT_ROUTES.ADMIN },
        { method: 'patch', path: POS_CLIENT_ROUTES.ADMIN_BY_ID.replace(':id', dummyId) },
      ];

      for (const { method, path } of cases) {
        const res = await request(app)[method](`${env.API_PREFIX}${path}`);
        expect(res.body, `${method.toUpperCase()} ${path} (status ${res.status})`).toHaveProperty('success');
      }
    });
    // ADMIN_STATS-before-ADMIN_DETAIL route ordering can't be distinguished DB-free: both share
    // the same adminOnly guard, which 401s identically before validateRequest ever runs on an
    // unauthenticated request. Verified for real, authenticated, in
    // test/integration/clients.integration.spec.ts instead.
  });

  // Every PURCHASING_ROUTES path is admin-guarded (no public routes at all) — the inventory
  // precedent applies directly: requireAuth's missing-token check short-circuits before any
  // Prisma call, so all routes stay DB-free.
  describe('purchasing route resolution (mounted, no DB required)', () => {
    it('every PURCHASING_ROUTES path resolves on `app`, not a raw unmatched-route 404', async () => {
      const dummyId = '00000000-0000-4000-8000-000000000000';
      const cases: { method: 'get' | 'post' | 'patch'; path: string }[] = [
        { method: 'get', path: PURCHASING_ROUTES.SUPPLIERS },
        { method: 'post', path: PURCHASING_ROUTES.SUPPLIERS },
        { method: 'get', path: PURCHASING_ROUTES.SUPPLIER_STATS },
        { method: 'get', path: PURCHASING_ROUTES.SUPPLIER_DETAIL.replace(':id', dummyId) },
        { method: 'patch', path: PURCHASING_ROUTES.SUPPLIER_BY_ID.replace(':id', dummyId) },
        { method: 'get', path: PURCHASING_ROUTES.INVOICES },
        { method: 'post', path: PURCHASING_ROUTES.INVOICES },
        { method: 'get', path: PURCHASING_ROUTES.INVOICE_BY_ID.replace(':id', dummyId) },
        { method: 'patch', path: PURCHASING_ROUTES.INVOICE_BY_ID.replace(':id', dummyId) },
        { method: 'post', path: PURCHASING_ROUTES.CONFIRM.replace(':id', dummyId) },
        { method: 'post', path: PURCHASING_ROUTES.CANCEL.replace(':id', dummyId) },
        { method: 'get', path: PURCHASING_ROUTES.PAYMENTS },
        { method: 'post', path: PURCHASING_ROUTES.PAYMENTS },
      ];

      for (const { method, path } of cases) {
        const res = await request(app)[method](`${env.API_PREFIX}${path}`);
        expect(res.body, `${method.toUpperCase()} ${path} (status ${res.status})`).toHaveProperty('success');
      }
    });
    // SUPPLIER_STATS-before-SUPPLIER_BY_ID route ordering can't be distinguished DB-free (both
    // share the same adminOnly guard) — verified for real, authenticated, in
    // test/integration/purchasing.integration.spec.ts instead.
  });

  // Every SALE_ROUTES path is guarded (no public routes at all) — the inventory/purchasing
  // precedent applies directly: requireAuth's missing-token check short-circuits before any
  // Prisma call (including the pages-gated STAFF_POS/STAFF_SALES checks), so all routes stay
  // DB-free.
  describe('sales route resolution (mounted, no DB required)', () => {
    it('every SALE_ROUTES path resolves on `app`, not a raw unmatched-route 404', async () => {
      const dummyId = '00000000-0000-4000-8000-000000000000';
      const cases: { method: 'get' | 'post' | 'patch'; path: string }[] = [
        { method: 'post', path: SALE_ROUTES.CREATE_DRAFT },
        { method: 'patch', path: SALE_ROUTES.UPDATE_DRAFT.replace(':id', dummyId) },
        { method: 'post', path: SALE_ROUTES.CONFIRM.replace(':id', dummyId) },
        { method: 'get', path: SALE_ROUTES.STAFF_LIST },
        { method: 'get', path: SALE_ROUTES.ADMIN_LIST },
        { method: 'get', path: SALE_ROUTES.STAFF_DETAIL.replace(':reference', 'SAL-2026-0001') },
        { method: 'get', path: SALE_ROUTES.ADMIN_DETAIL.replace(':reference', 'SAL-2026-0001') },
        { method: 'post', path: SALE_ROUTES.RETURN },
      ];

      for (const { method, path } of cases) {
        const res = await request(app)[method](`${env.API_PREFIX}${path}`);
        expect(res.body, `${method.toUpperCase()} ${path} (status ${res.status})`).toHaveProperty('success');
      }
    });
    // STAFF_LIST/CREATE_DRAFT share one literal path (different methods) and STAFF_DETAIL/
    // ADMIN_DETAIL a shared :reference-shape — none of that is distinguishable DB-free since
    // Express dispatches on method+path together; verified for real, authenticated, in
    // test/integration/sales.integration.spec.ts instead.
  });

  // Every BILLING_ROUTES path is guarded (no public routes at all) — the sales/purchasing
  // precedent applies directly: requireAuth's missing-token check short-circuits before any
  // Prisma call, so all routes stay DB-free. PDF routes are included here too (their guard runs
  // before any PDF rendering is attempted).
  describe('billing route resolution (mounted, no DB required)', () => {
    it('every BILLING_ROUTES path resolves on `app`, not a raw unmatched-route 404', async () => {
      const dummyNumber = 'FAC-2026-0001';
      const cases: { method: 'get' | 'post'; path: string }[] = [
        { method: 'get', path: BILLING_ROUTES.MY_INVOICES },
        { method: 'get', path: BILLING_ROUTES.MY_INVOICE_BY_NUMBER.replace(':number', dummyNumber) },
        { method: 'get', path: BILLING_ROUTES.MY_INVOICE_PDF.replace(':number', dummyNumber) },
        { method: 'get', path: BILLING_ROUTES.STAFF_INVOICES },
        { method: 'get', path: BILLING_ROUTES.STAFF_INVOICE_BY_NUMBER.replace(':number', dummyNumber) },
        { method: 'get', path: BILLING_ROUTES.STAFF_INVOICE_PDF.replace(':number', dummyNumber) },
        { method: 'post', path: BILLING_ROUTES.STAFF_CLIENT_PAYMENTS },
        { method: 'get', path: BILLING_ROUTES.ADMIN_INVOICES },
        { method: 'get', path: BILLING_ROUTES.ADMIN_INVOICE_BY_NUMBER.replace(':number', dummyNumber) },
        { method: 'get', path: BILLING_ROUTES.ADMIN_INVOICE_PDF.replace(':number', dummyNumber) },
        { method: 'post', path: BILLING_ROUTES.CANCEL.replace(':number', dummyNumber) },
        { method: 'post', path: BILLING_ROUTES.ADMIN_CLIENT_PAYMENTS },
        { method: 'get', path: BILLING_ROUTES.CLIENT_PAYMENTS_LIST },
      ];

      for (const { method, path } of cases) {
        const res = await request(app)[method](`${env.API_PREFIX}${path}`);
        expect(res.body, `${method.toUpperCase()} ${path} (status ${res.status})`).toHaveProperty('success');
      }
    });
    // ADMIN_CLIENT_PAYMENTS (POST) and CLIENT_PAYMENTS_LIST (GET) share one literal path,
    // distinguished only by method — not a routing ambiguity (Express dispatches on method+path
    // together); verified for real, authenticated, in test/integration/billing.integration.spec.ts
    // instead.
  });

  // PLACE is public|client (requireAuth({optional:true})) — a missing token still skips
  // straight to next() with no DB call at all (auth.middleware.ts's own optional branch), and
  // an empty POST body then fails validateRequest's PlaceOrderSchema check before the
  // controller/service ever runs — so it stays DB-free here too, same as every other
  // (fully guarded) ORDER_ROUTES path.
  describe('orders route resolution (mounted, no DB required)', () => {
    it('every ORDER_ROUTES path resolves on `app`, not a raw unmatched-route 404', async () => {
      const dummyId = '00000000-0000-4000-8000-000000000000';
      const cases: { method: 'get' | 'post' | 'patch'; path: string }[] = [
        { method: 'post', path: ORDER_ROUTES.PLACE },
        { method: 'get', path: ORDER_ROUTES.MY_LIST },
        { method: 'post', path: ORDER_ROUTES.MY_CANCEL.replace(':id', dummyId) },
        { method: 'get', path: ORDER_ROUTES.STAFF_LIST },
        { method: 'get', path: ORDER_ROUTES.ADMIN_LIST },
        { method: 'post', path: ORDER_ROUTES.STAFF_CONFIRM.replace(':id', dummyId) },
        { method: 'post', path: ORDER_ROUTES.ADMIN_CONFIRM.replace(':id', dummyId) },
        { method: 'patch', path: ORDER_ROUTES.STAFF_STATUS.replace(':id', dummyId) },
        { method: 'patch', path: ORDER_ROUTES.ADMIN_STATUS.replace(':id', dummyId) },
        { method: 'post', path: ORDER_ROUTES.CANCEL.replace(':id', dummyId) },
        { method: 'post', path: ORDER_ROUTES.RETURN.replace(':id', dummyId) },
        { method: 'get', path: ORDER_ROUTES.STAFF_STATS },
        { method: 'get', path: ORDER_ROUTES.ADMIN_STATS },
      ];

      for (const { method, path } of cases) {
        const res = await request(app)[method](`${env.API_PREFIX}${path}`);
        expect(res.body, `${method.toUpperCase()} ${path} (status ${res.status})`).toHaveProperty('success');
      }
    });
    // STAFF_STATS/STAFF_CONFIRM etc. share the `/staff/orders` prefix but distinct literal
    // suffixes (stats/confirm/status) — no ordering ambiguity; verified for real, authenticated,
    // in test/integration/orders.integration.spec.ts instead.
  });
});
