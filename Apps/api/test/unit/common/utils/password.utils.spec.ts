import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../../../src/common/utils/password.utils';

describe('password.utils', () => {
  it('hashes a password to a value different from the plaintext', async () => {
    const hash = await hashPassword('Password123!');
    expect(hash).not.toBe('Password123!');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('compare returns true for the correct password', async () => {
    const hash = await hashPassword('Password123!');
    await expect(comparePassword('Password123!', hash)).resolves.toBe(true);
  });

  it('compare returns false for an incorrect password', async () => {
    const hash = await hashPassword('Password123!');
    await expect(comparePassword('WrongPassword!', hash)).resolves.toBe(false);
  });
});
