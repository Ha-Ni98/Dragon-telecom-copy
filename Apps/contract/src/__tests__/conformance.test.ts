import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BooleanQuerySchema } from '../common/types';

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
