import { describe, it, expect } from 'vitest';
import request from 'supertest';
import {
  AUTH_ROUTES,
  DELIVERY_COMPANY_ROUTES,
  AuthTokensResponseSchema,
  SessionUserResponseSchema,
  DeliveryCompanyResponseSchema,
  UserRole,
} from '@your-app/contract';
import { app } from '../../src/app';

const SAMPLE_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// EXTENSION POINT (modules): add each new module's route constant here so its
// BASE is asserted, then add a registration + response-schema block below.
const ALL_ROUTES = [
  ['AUTH_ROUTES', AUTH_ROUTES],
  ['DELIVERY_COMPANY_ROUTES', DELIVERY_COMPANY_ROUTES],
] as const;

describe('Contract route constants', () => {
  it.each(ALL_ROUTES)('%s is an object with a defined BASE', (_name, routes) => {
    expect(typeof routes).toBe('object');
    expect((routes as { BASE: string }).BASE).toBeDefined();
  });
});

const API = `/api/v1${AUTH_ROUTES.BASE}`;

describe('AUTH_ROUTES — registration', () => {
  it('POST /auth/login is registered (not 404)', async () => {
    // Empty body → validateRequest returns 400 before any DB access
    const res = await request(app).post(`${API}${AUTH_ROUTES.LOGIN}`).send({});
    expect(res.status).not.toBe(404);
  });

  it('POST /auth/refresh is registered (not 404)', async () => {
    const res = await request(app).post(`${API}${AUTH_ROUTES.REFRESH}`).send({});
    expect(res.status).not.toBe(404);
  });

  it('POST /auth/logout is registered (requireAuth → 401, not 404)', async () => {
    const res = await request(app).post(`${API}${AUTH_ROUTES.LOGOUT}`).send({});
    expect(res.status).toBe(401);
  });

  it('GET /auth/me is registered (requireAuth → 401, not 404)', async () => {
    const res = await request(app).get(`${API}${AUTH_ROUTES.ME}`);
    expect(res.status).toBe(401);
  });
});

describe('AUTH response schemas', () => {
  it('AuthTokensResponseSchema accepts a valid shape', () => {
    const data = { accessToken: 'eyJ.tok.en', refreshToken: 'raw-opaque-token', role: UserRole.ADMIN };
    expect(() => AuthTokensResponseSchema.parse(data)).not.toThrow();
  });

  it('SessionUserResponseSchema accepts a valid shape', () => {
    const data = {
      id: SAMPLE_UUID,
      username: 'alice',
      role: UserRole.ADMIN,
      fullName: 'Alice Admin',
    };
    expect(() => SessionUserResponseSchema.parse(data)).not.toThrow();
  });
});

const DC_API = `/api/v1${DELIVERY_COMPANY_ROUTES.BASE}`;

describe('DELIVERY_COMPANY_ROUTES — registration', () => {
  it('GET /delivery-companies is registered (requireAuth → 401, not 404)', async () => {
    const res = await request(app).get(`${DC_API}${DELIVERY_COMPANY_ROUTES.GET_ALL}`);
    expect(res.status).toBe(401);
  });

  it('POST /delivery-companies is registered (requireAuth → 401, not 404)', async () => {
    const res = await request(app).post(`${DC_API}${DELIVERY_COMPANY_ROUTES.CREATE}`).send({});
    expect(res.status).toBe(401);
  });

  it('PATCH /delivery-companies/:id is registered (requireAuth → 401, not 404)', async () => {
    const path = DELIVERY_COMPANY_ROUTES.UPDATE.replace(':id', SAMPLE_UUID);
    const res = await request(app).patch(`${DC_API}${path}`).send({});
    expect(res.status).toBe(401);
  });

  it('POST /delivery-companies/:id/toggle is registered (requireAuth → 401, not 404)', async () => {
    const path = DELIVERY_COMPANY_ROUTES.TOGGLE.replace(':id', SAMPLE_UUID);
    const res = await request(app).post(`${DC_API}${path}`);
    expect(res.status).toBe(401);
  });
});

describe('DELIVERY_COMPANY response schemas', () => {
  it('DeliveryCompanyResponseSchema accepts a valid shape', () => {
    expect(() =>
      DeliveryCompanyResponseSchema.parse({
        id: SAMPLE_UUID,
        name: 'Fast Delivery',
        registeredName: 'Fast Delivery SARL',
        isActive: true,
      }),
    ).not.toThrow();
  });
});
