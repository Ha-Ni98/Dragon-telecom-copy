import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../env';
import { prisma } from '../db/prisma';
import { AuthError, ForbiddenError } from '../errors';
import { JWTPayloadSchema, UserType, type PageKey } from '@dragon-telecom/contract';

type RequireAuthOptions = {
  types?: UserType[];
  checkDB?: boolean;
  // `optional`: the route stays public — a missing/invalid token skips straight to `next()`
  // with no `req.user`, instead of throwing. Only the token's *shape* (viewer identity) is
  // gated on presence; the route itself never is.
  optional?: boolean;
  // `pages`: STAFF must hold every listed page in their enabled roles' union (DB-checked,
  // mirrors identity's effectivePages); ADMIN always bypasses.
  pages?: PageKey[];
};

export const requireAuth = (options: RequireAuthOptions = {}) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        if (options.optional) return void next();
        throw new AuthError('Missing token');
      }

      let payload;
      try {
        const decoded = jwt.verify(header.slice(7), env.JWT_SECRET);
        payload = JWTPayloadSchema.parse(decoded); // validate shape, no `any`
      } catch (err) {
        if (options.optional) return void next();
        throw err;
      }

      if (options.checkDB) {
        const fresh = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { type: true, isEnabled: true },
        });
        if (!fresh || !fresh.isEnabled) throw new AuthError('Account disabled or deleted');
        // Prisma's generated $Enums.UserType and the contract's UserType are distinct
        // nominal types with identical string values (schema.prisma's own invariant).
        payload.type = fresh.type as UserType;
      }

      if (options.types && !options.types.includes(payload.type)) {
        throw new ForbiddenError('Insufficient permissions');
      }

      if (options.pages && options.pages.length > 0 && payload.type !== UserType.ADMIN) {
        const userRoles = await prisma.userRole.findMany({
          where: { userId: payload.sub },
          include: { role: { include: { rolePages: { include: { page: true } } } } },
        });
        const effectiveKeys = new Set<string>();
        for (const userRole of userRoles) {
          if (!userRole.role.isEnabled) continue;
          for (const rolePage of userRole.role.rolePages) effectiveKeys.add(rolePage.page.key);
        }
        const missing = options.pages.filter((page) => !effectiveKeys.has(page));
        if (missing.length > 0) {
          throw new ForbiddenError('Insufficient permissions', { missingPages: missing });
        }
      }

      req.user = payload;
      next();
    } catch (err) {
      next(err instanceof jwt.JsonWebTokenError ? new AuthError('Invalid token') : err);
    }
  };
