import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken } from '../../../../src/common/utils/token.utils';

describe('token.utils', () => {
  it('round-trips a payload through generateToken/verifyToken', () => {
    const token = generateToken({ sub: 'user-1', type: 'STAFF' });
    const decoded = verifyToken(token);
    expect(decoded).toMatchObject({ sub: 'user-1', type: 'STAFF' });
  });

  it('rejects a tampered token', () => {
    const token = generateToken({ sub: 'user-1', type: 'STAFF' });
    const parts = token.split('.');
    const tampered = `${parts[0] ?? ''}.${(parts[1] ?? '') + 'x'}.${parts[2] ?? ''}`;

    expect(() => verifyToken(tampered)).toThrow();
  });
});
