import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserType as PrismaUserType } from '@prisma/client';
import { AuthType, ErrorCode, UserType as ContractUserType } from '@dragon-telecom/contract';
import { AppError } from '../../../../src/common/errors';
import { IdentityService } from '../../../../src/modules/identity/identity.service';

const {
  userFindFirstMock,
  userFindUniqueMock,
  userUpdateMock,
  clientFindUniqueMock,
  refreshTokenFindUniqueMock,
  refreshTokenCreateMock,
  refreshTokenUpdateMock,
  refreshTokenUpdateManyMock,
  userRoleFindManyMock,
  pageFindManyMock,
  transactionMock,
  eventBusEmitMock,
  comparePasswordMock,
  generateTokenMock,
  generateRefreshTokenMock,
  hashRefreshTokenMock,
} = vi.hoisted(() => ({
  userFindFirstMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userUpdateMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
  refreshTokenFindUniqueMock: vi.fn(),
  refreshTokenCreateMock: vi.fn(),
  refreshTokenUpdateMock: vi.fn(),
  refreshTokenUpdateManyMock: vi.fn(),
  userRoleFindManyMock: vi.fn(),
  pageFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
  eventBusEmitMock: vi.fn(),
  comparePasswordMock: vi.fn(),
  generateTokenMock: vi.fn(),
  generateRefreshTokenMock: vi.fn(),
  hashRefreshTokenMock: vi.fn(),
}));

vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));
vi.mock('@common/utils/password.utils', () => ({ comparePassword: comparePasswordMock, hashPassword: vi.fn() }));
vi.mock('@common/utils/token.utils', () => ({ generateToken: generateTokenMock, verifyToken: vi.fn() }));
vi.mock('@common/utils/refresh-token.utils', () => ({
  generateRefreshToken: generateRefreshTokenMock,
  hashRefreshToken: hashRefreshTokenMock,
}));

const prismaMock = {
  user: { findFirst: userFindFirstMock, findUnique: userFindUniqueMock, update: userUpdateMock },
  client: { findUnique: clientFindUniqueMock },
  refreshToken: {
    findUnique: refreshTokenFindUniqueMock,
    create: refreshTokenCreateMock,
    update: refreshTokenUpdateMock,
    updateMany: refreshTokenUpdateManyMock,
  },
  userRole: { findMany: userRoleFindManyMock },
  page: { findMany: pageFindManyMock },
  $transaction: transactionMock,
};

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';
const OLD_TOKEN_ID = '44444444-4444-4444-8444-444444444444';
const NEW_TOKEN_ID = '55555555-5555-4555-8555-555555555555';

const buildStaffUser = (overrides: Record<string, unknown> = {}) => ({
  id: USER_ID,
  username: 'johndoe',
  email: 'john@example.com',
  passwordHash: 'hashed',
  type: PrismaUserType.STAFF,
  isEnabled: true,
  lastLoginAt: null,
  staff: { id: STAFF_ID, firstName: 'John', lastName: 'Doe', phone: null, jobTitle: null },
  client: null,
  ...overrides,
});

const buildClientUser = (overrides: Record<string, unknown> = {}) => ({
  id: USER_ID,
  username: 'clientuser',
  email: null,
  passwordHash: 'hashed',
  type: PrismaUserType.CLIENT,
  isEnabled: true,
  lastLoginAt: null,
  staff: null,
  client: { id: CLIENT_ID },
  ...overrides,
});

describe('IdentityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    generateTokenMock.mockReturnValue('signed.access.token');
    generateRefreshTokenMock.mockReturnValue({ token: 'raw-refresh-token', tokenHash: 'hashed-refresh-token' });
    hashRefreshTokenMock.mockImplementation((token: string) => `hash(${token})`);
  });

  const service = () => new IdentityService(prismaMock as never);

  const expectRejection = async (promise: Promise<unknown>): Promise<AppError> => {
    try {
      await promise;
      throw new Error('Expected the promise to reject');
    } catch (err) {
      return err as AppError;
    }
  };

  describe('login', () => {
    it('resolves by username or email directly', async () => {
      userFindFirstMock.mockResolvedValueOnce(buildStaffUser());
      comparePasswordMock.mockResolvedValueOnce(true);
      userUpdateMock.mockResolvedValueOnce({});
      refreshTokenCreateMock.mockResolvedValueOnce({});

      await service().login({ username: 'johndoe', password: 'Password123!' }, {});

      expect(userFindFirstMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { OR: [{ username: 'johndoe' }, { email: 'johndoe' }] } }),
      );
      expect(clientFindUniqueMock).not.toHaveBeenCalled();
    });

    it('falls back to phone -> approved client -> user when no direct match', async () => {
      userFindFirstMock.mockResolvedValueOnce(null);
      clientFindUniqueMock.mockResolvedValueOnce({ userId: USER_ID });
      userFindUniqueMock.mockResolvedValueOnce(buildClientUser());
      comparePasswordMock.mockResolvedValueOnce(true);
      userUpdateMock.mockResolvedValueOnce({});
      refreshTokenCreateMock.mockResolvedValueOnce({});

      const result = await service().login({ username: '0555000000', password: 'Password123!' }, {});

      expect(clientFindUniqueMock).toHaveBeenCalledWith({ where: { phone: '0555000000' }, select: { userId: true } });
      expect(result.authType).toBe(AuthType.CLIENT);
    });

    it('does not resolve a pending client (no userId) via phone', async () => {
      userFindFirstMock.mockResolvedValueOnce(null);
      clientFindUniqueMock.mockResolvedValueOnce({ userId: null });
      comparePasswordMock.mockResolvedValueOnce(false);

      await expect(service().login({ username: '0555000000', password: 'x' }, {})).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      });
      expect(userFindUniqueMock).not.toHaveBeenCalled();
    });

    it('returns an identical 401 body for unknown username, wrong password, and disabled user', async () => {
      // unknown
      userFindFirstMock.mockResolvedValueOnce(null);
      clientFindUniqueMock.mockResolvedValueOnce(null);
      comparePasswordMock.mockResolvedValueOnce(false);
      const unknownErr = await expectRejection(service().login({ username: 'ghost', password: 'x' }, {}));

      // wrong password
      userFindFirstMock.mockResolvedValueOnce(buildStaffUser());
      comparePasswordMock.mockResolvedValueOnce(false);
      const wrongPasswordErr = await expectRejection(service().login({ username: 'johndoe', password: 'wrong' }, {}));

      // disabled
      userFindFirstMock.mockResolvedValueOnce(buildStaffUser({ isEnabled: false }));
      comparePasswordMock.mockResolvedValueOnce(false);
      const disabledErr = await expectRejection(
        service().login({ username: 'johndoe', password: 'Password123!' }, {}),
      );

      for (const err of [unknownErr, wrongPasswordErr, disabledErr]) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      }
      expect(unknownErr.message).toBe(wrongPasswordErr.message);
      expect(wrongPasswordErr.message).toBe(disabledErr.message);
    });

    it('still calls comparePassword on the unknown-user path (no timing/enumeration oracle)', async () => {
      userFindFirstMock.mockResolvedValueOnce(null);
      clientFindUniqueMock.mockResolvedValueOnce(null);
      comparePasswordMock.mockResolvedValueOnce(false);

      await expect(service().login({ username: 'ghost', password: 'x' }, {})).rejects.toThrow();
      expect(comparePasswordMock).toHaveBeenCalledTimes(1);
    });

    it('on success: sets lastLoginAt, creates a refresh token, and emits auth.loggedIn after commit', async () => {
      userFindFirstMock.mockResolvedValueOnce(buildStaffUser());
      comparePasswordMock.mockResolvedValueOnce(true);
      userUpdateMock.mockResolvedValueOnce({});
      refreshTokenCreateMock.mockResolvedValueOnce({});

      const result = await service().login({ username: 'johndoe', password: 'Password123!' }, { ipAddress: '1.2.3.4' });

      expect(transactionMock).toHaveBeenCalled();
      expect(userUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: USER_ID }, data: expect.objectContaining({ lastLoginAt: expect.any(Date) }) }),
      );
      expect(refreshTokenCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID, tokenHash: 'hashed-refresh-token' }) }),
      );
      expect(eventBusEmitMock).toHaveBeenCalledWith('auth.loggedIn', {
        userId: USER_ID,
        authType: AuthType.STAFF,
        ipAddress: '1.2.3.4',
      });
      expect(result).toEqual({
        authType: AuthType.STAFF,
        accessToken: 'signed.access.token',
        refreshToken: 'raw-refresh-token',
        profile: { firstName: 'John', lastName: 'Doe' },
      });
    });

    it('mints a JWT payload with staffId for a STAFF/ADMIN login', async () => {
      userFindFirstMock.mockResolvedValueOnce(buildStaffUser());
      comparePasswordMock.mockResolvedValueOnce(true);
      userUpdateMock.mockResolvedValueOnce({});
      refreshTokenCreateMock.mockResolvedValueOnce({});

      await service().login({ username: 'johndoe', password: 'Password123!' }, {});

      expect(generateTokenMock).toHaveBeenCalledWith(
        expect.objectContaining({ sub: USER_ID, type: ContractUserType.STAFF, staffId: STAFF_ID }),
      );
    });

    it('mints a JWT payload with clientId for a CLIENT login', async () => {
      userFindFirstMock.mockResolvedValueOnce(buildClientUser());
      comparePasswordMock.mockResolvedValueOnce(true);
      userUpdateMock.mockResolvedValueOnce({});
      refreshTokenCreateMock.mockResolvedValueOnce({});

      await service().login({ username: 'clientuser', password: 'Password123!' }, {});

      expect(generateTokenMock).toHaveBeenCalledWith(
        expect.objectContaining({ sub: USER_ID, type: ContractUserType.CLIENT, clientId: CLIENT_ID }),
      );
    });
  });

  describe('refresh', () => {
    it('rotates: revokes the old token (with replacedByTokenId) and issues a new pair', async () => {
      refreshTokenFindUniqueMock.mockResolvedValueOnce({
        id: OLD_TOKEN_ID,
        userId: USER_ID,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      userFindUniqueMock.mockResolvedValueOnce(buildStaffUser());
      refreshTokenCreateMock.mockResolvedValueOnce({ id: NEW_TOKEN_ID });
      refreshTokenUpdateMock.mockResolvedValueOnce({});

      const result = await service().refresh({ refreshToken: 'raw-old-token' }, {});

      expect(refreshTokenCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID, tokenHash: 'hashed-refresh-token' }) }),
      );
      expect(refreshTokenUpdateMock).toHaveBeenCalledWith({
        where: { id: OLD_TOKEN_ID },
        data: { revokedAt: expect.any(Date), replacedByTokenId: NEW_TOKEN_ID },
      });
      expect(result).toEqual({ accessToken: 'signed.access.token', refreshToken: 'raw-refresh-token' });
    });

    it('reuse of an already-revoked token kills the whole chain and rejects with 401', async () => {
      refreshTokenFindUniqueMock.mockResolvedValueOnce({
        id: OLD_TOKEN_ID,
        userId: USER_ID,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      refreshTokenUpdateManyMock.mockResolvedValueOnce({ count: 2 });

      await expect(service().refresh({ refreshToken: 'reused-token' }, {})).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      });
      expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
        where: { userId: USER_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(refreshTokenCreateMock).not.toHaveBeenCalled();
    });

    it('an expired token rejects with 401 and does not rotate', async () => {
      refreshTokenFindUniqueMock.mockResolvedValueOnce({
        id: OLD_TOKEN_ID,
        userId: USER_ID,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service().refresh({ refreshToken: 'expired-token' }, {})).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      });
      expect(refreshTokenCreateMock).not.toHaveBeenCalled();
    });

    it('rejects a structurally-valid token for a since-disabled user and does not rotate', async () => {
      refreshTokenFindUniqueMock.mockResolvedValueOnce({
        id: OLD_TOKEN_ID,
        userId: USER_ID,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      userFindUniqueMock.mockResolvedValueOnce(buildStaffUser({ isEnabled: false }));

      await expect(service().refresh({ refreshToken: 'raw-old-token' }, {})).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      });
      expect(refreshTokenCreateMock).not.toHaveBeenCalled();
    });

    it('an unknown token rejects with 401', async () => {
      refreshTokenFindUniqueMock.mockResolvedValueOnce(null);

      await expect(service().refresh({ refreshToken: 'never-issued' }, {})).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      });
    });
  });

  describe('logout', () => {
    it('revokes every active refresh token for the user', async () => {
      refreshTokenUpdateManyMock.mockResolvedValueOnce({ count: 1 });

      await service().logout(USER_ID);

      expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
        where: { userId: USER_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('getEffectivePages', () => {
    it('STAFF: returns the union of enabled roles pages', async () => {
      userRoleFindManyMock.mockResolvedValueOnce([
        {
          role: {
            isEnabled: true,
            rolePages: [{ page: { key: 'STAFF_POS' } }, { page: { key: 'STAFF_SALES' } }],
          },
        },
        {
          role: { isEnabled: false, rolePages: [{ page: { key: 'STAFF_REPAIRS' } }] },
        },
      ]);

      const pages = await service().getEffectivePages({ sub: USER_ID, type: ContractUserType.STAFF });

      expect(pages.sort()).toEqual(['STAFF_POS', 'STAFF_SALES']);
      expect(pageFindManyMock).not.toHaveBeenCalled();
    });

    it('ADMIN: returns every page key regardless of roles', async () => {
      pageFindManyMock.mockResolvedValueOnce([{ key: 'STAFF_POS' }, { key: 'STAFF_SALES' }, { key: 'STAFF_REPAIRS' }]);

      const pages = await service().getEffectivePages({ sub: USER_ID, type: ContractUserType.ADMIN });

      expect(pages.sort()).toEqual(['STAFF_POS', 'STAFF_REPAIRS', 'STAFF_SALES']);
      expect(userRoleFindManyMock).not.toHaveBeenCalled();
    });
  });
});
