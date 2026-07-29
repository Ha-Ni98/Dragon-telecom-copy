import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { UserType, PageKey } from '@dragon-telecom/contract';
import { mintAuthToken } from '../../fixtures/auth.fixture';
import { AuthError, ForbiddenError } from '../../../src/common/errors';
import { requireAuth } from '../../../src/common/middlewares/auth.middleware';

const { findUniqueMock, userRoleFindManyMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  userRoleFindManyMock: vi.fn(),
}));

vi.mock('../../../src/common/db/prisma', () => ({
  prisma: { user: { findUnique: findUniqueMock }, userRole: { findMany: userRoleFindManyMock } },
}));

const buildReq = (authorization?: string): Request =>
  ({ headers: authorization ? { authorization } : {}, validated: {} }) as Request;

describe('requireAuth', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    userRoleFindManyMock.mockReset();
  });

  it('rejects a missing token with AuthError', async () => {
    const req = buildReq();
    const next = vi.fn();

    await requireAuth()(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });

  it('rejects an invalid token with AuthError', async () => {
    const req = buildReq('Bearer not-a-real-token');
    const next = vi.fn();

    await requireAuth()(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });

  it('sets req.user on a valid token', async () => {
    const { token, user } = mintAuthToken({ type: UserType.STAFF });
    const req = buildReq(`Bearer ${token}`);
    const next = vi.fn();

    await requireAuth()(req, {} as Response, next as unknown as NextFunction);

    expect(req.user).toMatchObject({ sub: user.id, type: UserType.STAFF });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects when the user type is not in the allowed list', async () => {
    const { token } = mintAuthToken({ type: UserType.CLIENT });
    const req = buildReq(`Bearer ${token}`);
    const next = vi.fn();

    await requireAuth({ types: [UserType.ADMIN, UserType.STAFF] })(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('checkDB rejects a disabled user without hitting the route', async () => {
    const { token, user } = mintAuthToken({ type: UserType.STAFF });
    findUniqueMock.mockResolvedValueOnce({ type: user.type, isEnabled: false });
    const req = buildReq(`Bearer ${token}`);
    const next = vi.fn();

    await requireAuth({ checkDB: true })(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: user.id },
      select: { type: true, isEnabled: true },
    });
  });

  it('checkDB refreshes the type from a fresh lookup', async () => {
    const { token, user } = mintAuthToken({ type: UserType.STAFF });
    findUniqueMock.mockResolvedValueOnce({ type: UserType.ADMIN, isEnabled: true });
    const req = buildReq(`Bearer ${token}`);
    const next = vi.fn();

    await requireAuth({ checkDB: true })(req, {} as Response, next as unknown as NextFunction);

    expect(req.user).toMatchObject({ sub: user.id, type: UserType.ADMIN });
    expect(next).toHaveBeenCalledWith();
  });

  it('optional:true lets a missing token through with no req.user', async () => {
    const req = buildReq();
    const next = vi.fn();

    await requireAuth({ optional: true })(req, {} as Response, next as unknown as NextFunction);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('optional:true lets an invalid token through with no req.user', async () => {
    const req = buildReq('Bearer not-a-real-token');
    const next = vi.fn();

    await requireAuth({ optional: true })(req, {} as Response, next as unknown as NextFunction);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('optional:true still populates req.user on a valid token', async () => {
    const { token, user } = mintAuthToken({ type: UserType.CLIENT });
    const req = buildReq(`Bearer ${token}`);
    const next = vi.fn();

    await requireAuth({ optional: true })(req, {} as Response, next as unknown as NextFunction);

    expect(req.user).toMatchObject({ sub: user.id, type: UserType.CLIENT });
    expect(next).toHaveBeenCalledWith();
  });

  it('pages: passes when the effective page set includes every required page', async () => {
    const { token, user } = mintAuthToken({ type: UserType.STAFF });
    userRoleFindManyMock.mockResolvedValueOnce([
      { role: { isEnabled: true, rolePages: [{ page: { key: PageKey.STAFF_PRODUCTS } }] } },
    ]);
    const req = buildReq(`Bearer ${token}`);
    const next = vi.fn();

    await requireAuth({ types: [UserType.STAFF, UserType.ADMIN], pages: [PageKey.STAFF_PRODUCTS] })(
      req,
      {} as Response,
      next as unknown as NextFunction,
    );

    expect(userRoleFindManyMock).toHaveBeenCalledWith({
      where: { userId: user.id },
      include: { role: { include: { rolePages: { include: { page: true } } } } },
    });
    expect(req.user).toMatchObject({ sub: user.id, type: UserType.STAFF });
    expect(next).toHaveBeenCalledWith();
  });

  it('pages: rejects with ForbiddenError when the required page is missing', async () => {
    const { token } = mintAuthToken({ type: UserType.STAFF });
    userRoleFindManyMock.mockResolvedValueOnce([
      { role: { isEnabled: true, rolePages: [{ page: { key: PageKey.STAFF_SALES } }] } },
    ]);
    const req = buildReq(`Bearer ${token}`);
    const next = vi.fn();

    await requireAuth({ types: [UserType.STAFF, UserType.ADMIN], pages: [PageKey.STAFF_PRODUCTS] })(
      req,
      {} as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('pages: ignores disabled roles when building the effective set', async () => {
    const { token } = mintAuthToken({ type: UserType.STAFF });
    userRoleFindManyMock.mockResolvedValueOnce([
      { role: { isEnabled: false, rolePages: [{ page: { key: PageKey.STAFF_PRODUCTS } }] } },
    ]);
    const req = buildReq(`Bearer ${token}`);
    const next = vi.fn();

    await requireAuth({ pages: [PageKey.STAFF_PRODUCTS] })(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('pages: ADMIN bypasses the page check without querying the DB', async () => {
    const { token, user } = mintAuthToken({ type: UserType.ADMIN });
    const req = buildReq(`Bearer ${token}`);
    const next = vi.fn();

    await requireAuth({ pages: [PageKey.STAFF_PRODUCTS] })(req, {} as Response, next as unknown as NextFunction);

    expect(userRoleFindManyMock).not.toHaveBeenCalled();
    expect(req.user).toMatchObject({ sub: user.id, type: UserType.ADMIN });
    expect(next).toHaveBeenCalledWith();
  });
});
