import { describe, it, expect } from 'vitest';
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
});
