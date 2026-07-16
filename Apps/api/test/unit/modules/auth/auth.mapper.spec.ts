import { describe, it, expect } from 'vitest';
import { AuthTokensResponseSchema, SessionUserResponseSchema, UserRole } from '@your-app/contract';
import { AuthMapper } from '@modules/auth/auth.mapper';
import { userEntity } from '../../../data/user.factory';

describe('AuthMapper.toAuthTokensDTO', () => {
  it('parses cleanly against AuthTokensResponseSchema', () => {
    const dto = AuthMapper.toAuthTokensDTO('access-token', 'refresh-token', UserRole.ADMIN);
    expect(() => AuthTokensResponseSchema.parse(dto)).not.toThrow();
  });

  it('returns the exact tokens and role provided', () => {
    const dto = AuthMapper.toAuthTokensDTO('acc', 'ref', UserRole.USER);
    expect(dto.accessToken).toBe('acc');
    expect(dto.refreshToken).toBe('ref');
    expect(dto.role).toBe(UserRole.USER);
  });

  it('never exposes password or tokenHash on the returned object', () => {
    const dto = AuthMapper.toAuthTokensDTO('a', 'b', UserRole.ADMIN) as Record<string, unknown>;
    expect(dto).not.toHaveProperty('password');
    expect(dto).not.toHaveProperty('tokenHash');
  });
});

describe('AuthMapper.toSessionUserDTO', () => {
  it('parses cleanly against SessionUserResponseSchema', () => {
    const user = userEntity({ role: UserRole.ADMIN });
    const dto = AuthMapper.toSessionUserDTO(user);
    expect(() => SessionUserResponseSchema.parse(dto)).not.toThrow();
  });

  it('composes id, username, role, and fullName from the User row', () => {
    const user = userEntity({ role: UserRole.ADMIN, fullName: 'Alice Admin' });
    const dto = AuthMapper.toSessionUserDTO(user);
    expect(dto.id).toBe(user.id);
    expect(dto.username).toBe(user.username);
    expect(dto.role).toBe(UserRole.ADMIN);
    expect(dto.fullName).toBe('Alice Admin');
  });

  it('never exposes password or tokenHash', () => {
    const user = userEntity({ role: UserRole.ADMIN });
    const dto = AuthMapper.toSessionUserDTO(user) as Record<string, unknown>;
    expect(dto).not.toHaveProperty('password');
    expect(dto).not.toHaveProperty('tokenHash');
  });
});
