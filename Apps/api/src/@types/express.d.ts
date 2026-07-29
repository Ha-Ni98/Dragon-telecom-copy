import type { JWTPayload } from '@dragon-telecom/contract';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      validated: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
