import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BooleanQuerySchema } from '../common/types';
import { LoginSchema } from '../modules/auth/auth.command';
import {
  GetDeliveryCompaniesQuerySchema,
  CreateDeliveryCompanySchema,
  DeliveryCompanyResponseSchema,
} from '../modules/delivery-company';

// UUIDs below are valid v4 (version digit = 4, variant bits = a/8)
const UUID1 = '123e4567-e89b-42d3-a456-426614174000';

// ── BooleanQuerySchema ─────────────────────────────────────────────────────
describe('BooleanQuerySchema', () => {
  it('parses "false" as false (the z.coerce.boolean bug)', () => {
    assert.equal(BooleanQuerySchema.parse('false'), false);
  });

  it('parses "true" as true', () => {
    assert.equal(BooleanQuerySchema.parse('true'), true);
  });

  it('passes through an actual boolean', () => {
    assert.equal(BooleanQuerySchema.parse(true), true);
    assert.equal(BooleanQuerySchema.parse(false), false);
  });

  it('rejects an unrecognised string', () => {
    assert.throws(() => BooleanQuerySchema.parse('yes'));
  });
});

// ── Boolean query params in a real query schema ────────────────────────────
describe('GetDeliveryCompaniesQuerySchema active param', () => {
  it('"false" → active: false', () => {
    const q = GetDeliveryCompaniesQuerySchema.parse({ active: 'false' });
    assert.equal(q.active, false);
  });

  it('"true" → active: true', () => {
    const q = GetDeliveryCompaniesQuerySchema.parse({ active: 'true' });
    assert.equal(q.active, true);
  });
});

// ── Auth ───────────────────────────────────────────────────────────────────
describe('LoginSchema', () => {
  it('accepts valid credentials', () => {
    const cmd = LoginSchema.parse({ username: 'admin', password: 'secret' });
    assert.equal(cmd.username, 'admin');
  });

  it('rejects missing password', () => {
    assert.throws(() => LoginSchema.parse({ username: 'admin' }));
  });
});

// ── Command validation (example module) ────────────────────────────────────
describe('CreateDeliveryCompanySchema', () => {
  it('accepts a valid payload', () => {
    const cmd = CreateDeliveryCompanySchema.parse({
      name: 'Fast Delivery',
      registeredName: 'Fast Delivery SARL',
    });
    assert.equal(cmd.name, 'Fast Delivery');
  });

  it('rejects a missing registeredName', () => {
    assert.throws(() => CreateDeliveryCompanySchema.parse({ name: 'Fast Delivery' }));
  });
});

// ── DTO shape validation (example module) ──────────────────────────────────
describe('DeliveryCompanyResponseSchema', () => {
  it('parses a valid payload', () => {
    const dto = DeliveryCompanyResponseSchema.parse({
      id: UUID1,
      name: 'Fast Delivery',
      registeredName: 'Fast Delivery SARL',
      isActive: true,
    });
    assert.equal(dto.name, 'Fast Delivery');
  });

  it('rejects a payload with a bad uuid', () => {
    assert.throws(() =>
      DeliveryCompanyResponseSchema.parse({
        id: 'not-a-uuid',
        name: 'Fast Delivery',
        registeredName: 'Fast Delivery SARL',
        isActive: true,
      }),
    );
  });
});
