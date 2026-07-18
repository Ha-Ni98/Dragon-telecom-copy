import { randomBytes, createHash } from 'node:crypto';

// Deterministic (not bcrypt/argon2) so the raw token can be hashed again on lookup — the
// token itself already carries 256 bits of entropy from randomBytes, so a keyed HMAC adds
// no practical benefit over plain SHA-256 here.
export const hashRefreshToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const generateRefreshToken = (): { token: string; tokenHash: string } => {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashRefreshToken(token) };
};
