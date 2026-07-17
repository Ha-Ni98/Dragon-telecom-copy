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
});
