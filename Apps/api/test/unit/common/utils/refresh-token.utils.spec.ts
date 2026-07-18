import { describe, it, expect } from 'vitest';
import { generateRefreshToken, hashRefreshToken } from '../../../../src/common/utils/refresh-token.utils';

describe('refresh-token.utils', () => {
  it('generates a token whose hash matches hashRefreshToken(token)', () => {
    const { token, tokenHash } = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(tokenHash);
  });

  it('generates a different token (and hash) on each call', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it('hashRefreshToken is deterministic for the same input', () => {
    const { token } = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it('the stored hash never contains the raw token', () => {
    const { token, tokenHash } = generateRefreshToken();
    expect(tokenHash).not.toContain(token);
  });
});
