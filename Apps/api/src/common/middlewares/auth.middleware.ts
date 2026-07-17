import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../env';
import { prisma } from '../db/prisma';
import { AuthError, ForbiddenError } from '../errors';
import { JWTPayloadSchema, type UserType } from '@dragon-telecom/contract';

export const requireAuth = (options: { types?: UserType[]; checkDB?: boolean } = {}) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw new AuthError('Missing token');

      const decoded = jwt.verify(header.slice(7), env.JWT_SECRET);
      const payload = JWTPayloadSchema.parse(decoded); // validate shape, no `any`

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

      req.user = payload;
      next();
    } catch (err) {
      next(err instanceof jwt.JsonWebTokenError ? new AuthError('Invalid token') : err);
    }
  };
