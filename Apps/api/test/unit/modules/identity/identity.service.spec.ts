import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma, UserType as PrismaUserType } from '@prisma/client';
import { AuthType, ErrorCode, UserType as ContractUserType, type CreateUserCommand } from '@dragon-telecom/contract';
import { AppError } from '../../../../src/common/errors';
import { IdentityService } from '../../../../src/modules/identity/identity.service';

const {
  userFindFirstMock,
  userFindUniqueMock,
  userUpdateMock,
  userCreateMock,
  userCountMock,
  userFindManyMock,
  clientFindUniqueMock,
  refreshTokenFindUniqueMock,
  refreshTokenCreateMock,
  refreshTokenUpdateMock,
  refreshTokenUpdateManyMock,
  userRoleFindManyMock,
  pageFindManyMock,
  roleFindUniqueMock,
  roleFindUniqueOrThrowMock,
  roleFindManyMock,
  roleCreateMock,
  roleUpdateMock,
  rolePageDeleteManyMock,
  rolePageCreateManyMock,
  technicianFindManyMock,
  technicianCreateMock,
  technicianUpdateMock,
  transactionMock,
  eventBusEmitMock,
  comparePasswordMock,
  hashPasswordMock,
  generateTokenMock,
  generateRefreshTokenMock,
  hashRefreshTokenMock,
} = vi.hoisted(() => ({
  userFindFirstMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userUpdateMock: vi.fn(),
  userCreateMock: vi.fn(),
  userCountMock: vi.fn(),
  userFindManyMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
  refreshTokenFindUniqueMock: vi.fn(),
  refreshTokenCreateMock: vi.fn(),
  refreshTokenUpdateMock: vi.fn(),
  refreshTokenUpdateManyMock: vi.fn(),
  userRoleFindManyMock: vi.fn(),
  pageFindManyMock: vi.fn(),
  roleFindUniqueMock: vi.fn(),
  roleFindUniqueOrThrowMock: vi.fn(),
  roleFindManyMock: vi.fn(),
  roleCreateMock: vi.fn(),
  roleUpdateMock: vi.fn(),
  rolePageDeleteManyMock: vi.fn(),
  rolePageCreateManyMock: vi.fn(),
  technicianFindManyMock: vi.fn(),
  technicianCreateMock: vi.fn(),
  technicianUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  eventBusEmitMock: vi.fn(),
  comparePasswordMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  generateTokenMock: vi.fn(),
  generateRefreshTokenMock: vi.fn(),
  hashRefreshTokenMock: vi.fn(),
}));

vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));
vi.mock('@common/utils/password.utils', () => ({ comparePassword: comparePasswordMock, hashPassword: hashPasswordMock }));
vi.mock('@common/utils/token.utils', () => ({ generateToken: generateTokenMock, verifyToken: vi.fn() }));
vi.mock('@common/utils/refresh-token.utils', () => ({
  generateRefreshToken: generateRefreshTokenMock,
  hashRefreshToken: hashRefreshTokenMock,
}));

const prismaMock = {
  user: {
    findFirst: userFindFirstMock,
    findUnique: userFindUniqueMock,
    update: userUpdateMock,
    create: userCreateMock,
    count: userCountMock,
    findMany: userFindManyMock,
  },
  client: { findUnique: clientFindUniqueMock },
  refreshToken: {
    findUnique: refreshTokenFindUniqueMock,
    create: refreshTokenCreateMock,
    update: refreshTokenUpdateMock,
    updateMany: refreshTokenUpdateManyMock,
  },
  userRole: { findMany: userRoleFindManyMock },
  page: { findMany: pageFindManyMock },
  role: {
    findUnique: roleFindUniqueMock,
    findUniqueOrThrow: roleFindUniqueOrThrowMock,
    findMany: roleFindManyMock,
    create: roleCreateMock,
    update: roleUpdateMock,
  },
  rolePage: { deleteMany: rolePageDeleteManyMock, createMany: rolePageCreateManyMock },
  technician: { findMany: technicianFindManyMock, create: technicianCreateMock, update: technicianUpdateMock },
  $transaction: transactionMock,
};

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';
const OLD_TOKEN_ID = '44444444-4444-4444-8444-444444444444';
const NEW_TOKEN_ID = '55555555-5555-4555-8555-555555555555';
const ROLE_ID = '66666666-6666-4666-8666-666666666666';
const TECH_ID = '77777777-7777-4777-8777-777777777777';

const prismaKnownError = (code: string, message = 'mock prisma error') =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: '6.19.3' });

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
    hashPasswordMock.mockImplementation(async (plain: string) => `hashed(${plain})`);
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

  describe('createUser', () => {
    const cmd: CreateUserCommand = {
      username: 'newstaff',
      email: 'newstaff@example.com',
      password: 'Password123!',
      type: ContractUserType.STAFF,
      profile: { firstName: 'New', lastName: 'Staff' },
      roleIds: [ROLE_ID],
    };

    it('hashes the password, creates the user, and emits user.created (no external tx)', async () => {
      userCreateMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      pageFindManyMock.mockResolvedValueOnce([]);

      const dto = await service().createUser(cmd);

      expect(hashPasswordMock).toHaveBeenCalledWith('Password123!');
      expect(userCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: 'newstaff',
            passwordHash: 'hashed(Password123!)',
            type: ContractUserType.STAFF,
          }),
        }),
      );
      expect(eventBusEmitMock).toHaveBeenCalledWith('user.created', { user: dto });
    });

    it('does not emit when called with an external tx — the caller owns commit timing', async () => {
      const txMock = { user: { create: userCreateMock }, page: { findMany: pageFindManyMock } };
      userCreateMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      pageFindManyMock.mockResolvedValueOnce([]);

      await service().createUser(cmd, txMock as never);

      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('maps a duplicate username/email (P2002) to a ConflictError', async () => {
      userCreateMock.mockRejectedValueOnce(prismaKnownError('P2002'));

      const err = await expectRejection(service().createUser(cmd));

      expect(err.statusCode).toBe(409);
      expect(err.code).toBe(ErrorCode.RESOURCE_CONFLICT);
    });
  });

  describe('provisionClientUser', () => {
    const txMock = { user: { create: userCreateMock } };

    it('creates a CLIENT user with no Staff row, hashing the password, honouring the passed tx', async () => {
      userCreateMock.mockResolvedValueOnce(buildClientUser({ id: USER_ID }));

      const result = await service().provisionClientUser(
        { username: 'newclient', password: 'ClientPass123!' },
        txMock as never,
      );

      expect(hashPasswordMock).toHaveBeenCalledWith('ClientPass123!');
      expect(userCreateMock).toHaveBeenCalledWith({
        data: { username: 'newclient', passwordHash: 'hashed(ClientPass123!)', type: PrismaUserType.CLIENT },
      });
      expect(userCreateMock.mock.calls[0]?.[0]?.data).not.toHaveProperty('staff');
      expect(result).toEqual({ userId: USER_ID });
    });

    it('emits nothing — the caller emits once its own transaction commits', async () => {
      userCreateMock.mockResolvedValueOnce(buildClientUser({ id: USER_ID }));

      await service().provisionClientUser({ username: 'newclient', password: 'ClientPass123!' }, txMock as never);

      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('maps a duplicate username (P2002) to a ConflictError', async () => {
      userCreateMock.mockRejectedValueOnce(prismaKnownError('P2002'));

      const err = await expectRejection(
        service().provisionClientUser({ username: 'dup', password: 'ClientPass123!' }, txMock as never),
      );

      expect(err.statusCode).toBe(409);
      expect(err.code).toBe(ErrorCode.RESOURCE_CONFLICT);
    });
  });

  describe('updateUser', () => {
    it('blocks disabling the last enabled admin with a 409', async () => {
      userFindUniqueMock.mockResolvedValueOnce(buildStaffUser({ type: PrismaUserType.ADMIN, userRoles: [] }));
      userCountMock.mockResolvedValueOnce(1);

      const err = await expectRejection(service().updateUser(USER_ID, { isEnabled: false }));

      expect(err.statusCode).toBe(409);
      expect(err.code).toBe(ErrorCode.RESOURCE_CONFLICT);
      expect(userUpdateMock).not.toHaveBeenCalled();
    });

    it('allows disabling an admin when another enabled admin remains', async () => {
      userFindUniqueMock.mockResolvedValueOnce(buildStaffUser({ type: PrismaUserType.ADMIN, userRoles: [] }));
      userCountMock.mockResolvedValueOnce(2);
      userUpdateMock.mockResolvedValueOnce(buildStaffUser({ type: PrismaUserType.ADMIN, isEnabled: false, userRoles: [] }));
      refreshTokenUpdateManyMock.mockResolvedValueOnce({ count: 1 });
      pageFindManyMock.mockResolvedValueOnce([]);

      await service().updateUser(USER_ID, { isEnabled: false });

      expect(userUpdateMock).toHaveBeenCalled();
    });

    it('disabling a user revokes its active tokens in the same transaction', async () => {
      userFindUniqueMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      userUpdateMock.mockResolvedValueOnce(buildStaffUser({ isEnabled: false, userRoles: [] }));
      refreshTokenUpdateManyMock.mockResolvedValueOnce({ count: 2 });
      pageFindManyMock.mockResolvedValueOnce([]);

      await service().updateUser(USER_ID, { isEnabled: false });

      expect(transactionMock).toHaveBeenCalled();
      expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
        where: { userId: USER_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('changing the password revokes active tokens too', async () => {
      userFindUniqueMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      userUpdateMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      refreshTokenUpdateManyMock.mockResolvedValueOnce({ count: 1 });
      pageFindManyMock.mockResolvedValueOnce([]);

      await service().updateUser(USER_ID, { password: 'NewPassword123!' });

      expect(hashPasswordMock).toHaveBeenCalledWith('NewPassword123!');
      expect(refreshTokenUpdateManyMock).toHaveBeenCalled();
    });

    it('a plain profile update does not revoke tokens and skips the transaction', async () => {
      userFindUniqueMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      userUpdateMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      pageFindManyMock.mockResolvedValueOnce([]);

      await service().updateUser(USER_ID, { profile: { jobTitle: 'Lead Cashier' } });

      expect(refreshTokenUpdateManyMock).not.toHaveBeenCalled();
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('emits user.updated, and additionally user.roleChanged when roleIds is provided', async () => {
      userFindUniqueMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      userUpdateMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      pageFindManyMock.mockResolvedValueOnce([]);

      const dto = await service().updateUser(USER_ID, { roleIds: [ROLE_ID] });

      expect(eventBusEmitMock).toHaveBeenCalledWith('user.updated', { user: dto });
      expect(eventBusEmitMock).toHaveBeenCalledWith('user.roleChanged', { userId: USER_ID, roleIds: [ROLE_ID] });
    });

    it('does not emit user.roleChanged when roleIds is not part of the update', async () => {
      userFindUniqueMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      userUpdateMock.mockResolvedValueOnce(buildStaffUser({ userRoles: [] }));
      pageFindManyMock.mockResolvedValueOnce([]);

      await service().updateUser(USER_ID, { profile: { jobTitle: 'Lead Cashier' } });

      expect(eventBusEmitMock).not.toHaveBeenCalledWith('user.roleChanged', expect.anything());
    });
  });

  describe('setRolePages', () => {
    it('rejects when a page key does not exist (400)', async () => {
      roleFindUniqueMock.mockResolvedValueOnce({ id: ROLE_ID });
      pageFindManyMock.mockResolvedValueOnce([]);

      const err = await expectRejection(service().setRolePages(ROLE_ID, { pageKeys: ['NOT_A_REAL_KEY'] }));

      expect(err.statusCode).toBe(400);
      expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(rolePageDeleteManyMock).not.toHaveBeenCalled();
    });

    it('rejects an ADMIN-scope page key (400)', async () => {
      roleFindUniqueMock.mockResolvedValueOnce({ id: ROLE_ID });
      pageFindManyMock.mockResolvedValueOnce([{ id: 'page-1', key: 'ADM_DASHBOARD', scope: 'ADMIN' }]);

      const err = await expectRejection(service().setRolePages(ROLE_ID, { pageKeys: ['ADM_DASHBOARD'] }));

      expect(err.statusCode).toBe(400);
      expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('replaces the role pages on success', async () => {
      roleFindUniqueMock.mockResolvedValueOnce({ id: ROLE_ID });
      pageFindManyMock.mockResolvedValueOnce([{ id: 'page-1', key: 'STAFF_POS', scope: 'STAFF' }]);
      roleFindUniqueOrThrowMock.mockResolvedValueOnce({
        id: ROLE_ID,
        code: 'ROLE_1',
        name: 'Role One',
        description: null,
        isEnabled: true,
        rolePages: [{ page: { key: 'STAFF_POS' } }],
      });

      const dto = await service().setRolePages(ROLE_ID, { pageKeys: ['STAFF_POS'] });

      expect(rolePageDeleteManyMock).toHaveBeenCalledWith({ where: { roleId: ROLE_ID } });
      expect(rolePageCreateManyMock).toHaveBeenCalledWith({ data: [{ roleId: ROLE_ID, pageId: 'page-1' }] });
      expect(dto.pageKeys).toEqual(['STAFF_POS']);
    });
  });

  describe('resetPassword', () => {
    it('hashes the new password and revokes active tokens', async () => {
      userUpdateMock.mockResolvedValueOnce({});
      refreshTokenUpdateManyMock.mockResolvedValueOnce({ count: 1 });

      await service().resetPassword(USER_ID, 'BrandNewPassword1!');

      expect(hashPasswordMock).toHaveBeenCalledWith('BrandNewPassword1!');
      expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: USER_ID }, data: { passwordHash: 'hashed(BrandNewPassword1!)' } });
      expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
        where: { userId: USER_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('runs both writes against the provided tx, not a new transaction', async () => {
      const txUserUpdate = vi.fn().mockResolvedValueOnce({});
      const txRefreshUpdateMany = vi.fn().mockResolvedValueOnce({ count: 0 });
      const txMock = { user: { update: txUserUpdate }, refreshToken: { updateMany: txRefreshUpdateMany } };

      await service().resetPassword(USER_ID, 'BrandNewPassword1!', txMock as never);

      expect(txUserUpdate).toHaveBeenCalled();
      expect(txRefreshUpdateMany).toHaveBeenCalled();
      expect(transactionMock).not.toHaveBeenCalled();
    });
  });

  describe('roles, pages, and technicians (basic CRUD)', () => {
    it('listRoles maps every role through the mapper', async () => {
      roleFindManyMock.mockResolvedValueOnce([
        { id: ROLE_ID, code: 'ROLE_1', name: 'Role One', description: null, isEnabled: true, rolePages: [] },
      ]);

      const roles = await service().listRoles();

      expect(roles).toHaveLength(1);
      expect(roles[0]?.code).toBe('ROLE_1');
    });

    it('createRole maps a duplicate code (P2002) to a ConflictError', async () => {
      roleCreateMock.mockRejectedValueOnce(prismaKnownError('P2002'));

      const err = await expectRejection(service().createRole({ code: 'DUP', name: 'Dup' }));

      expect(err.statusCode).toBe(409);
    });

    it('updateRole maps a missing role (P2025) to a NotFoundError', async () => {
      roleUpdateMock.mockRejectedValueOnce(prismaKnownError('P2025'));

      const err = await expectRejection(service().updateRole(ROLE_ID, { name: 'New name' }));

      expect(err.statusCode).toBe(404);
    });

    it('listPages filters by scope when provided', async () => {
      pageFindManyMock.mockResolvedValueOnce([]);

      await service().listPages({ scope: 'STAFF' as never });

      expect(pageFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { scope: 'STAFF' } }));
    });

    it('createTechnician / updateTechnician round-trip through the mapper', async () => {
      technicianCreateMock.mockResolvedValueOnce({ id: TECH_ID, name: 'Tech One', phone: null, isEnabled: true });
      const created = await service().createTechnician({ name: 'Tech One' });
      expect(created.name).toBe('Tech One');

      technicianUpdateMock.mockResolvedValueOnce({ id: TECH_ID, name: 'Tech One', phone: null, isEnabled: false });
      const updated = await service().updateTechnician(TECH_ID, { isEnabled: false });
      expect(updated.isEnabled).toBe(false);
    });

    it('updateTechnician maps a missing technician (P2025) to a NotFoundError', async () => {
      technicianUpdateMock.mockRejectedValueOnce(prismaKnownError('P2025'));

      const err = await expectRejection(service().updateTechnician(TECH_ID, { isEnabled: false }));

      expect(err.statusCode).toBe(404);
    });
  });

  describe('listUsers / getUser', () => {
    it('listUsers paginates and excludes CLIENT rows by default', async () => {
      userCountMock.mockResolvedValueOnce(1);
      userFindManyMock.mockResolvedValueOnce([buildStaffUser({ userRoles: [] })]);
      pageFindManyMock.mockResolvedValueOnce([]);

      const result = await service().listUsers({ page: 1, limit: 10 });

      expect(userCountMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ type: { in: [PrismaUserType.ADMIN, PrismaUserType.STAFF] } }) }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('getUser 404s for a CLIENT-type id (out of this endpoint domain)', async () => {
      userFindUniqueMock.mockResolvedValueOnce(buildClientUser());

      const err = await expectRejection(service().getUser(USER_ID));

      expect(err.statusCode).toBe(404);
    });
  });
});
