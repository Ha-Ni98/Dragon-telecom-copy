import { describe, it, expect, vi } from 'vitest';
import { z, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { validateRequest } from '../../../src/common/middlewares/validate-request.middleware';

const buildReq = (overrides: Partial<Request> = {}): Request =>
  ({ body: {}, query: {}, params: {}, validated: {}, ...overrides }) as Request;

describe('validateRequest', () => {
  it('writes the coerced query result to req.validated.query', () => {
    const schema = z.object({ page: z.coerce.number() });
    const req = buildReq({ query: { page: '2' } });
    const next = vi.fn();

    validateRequest({ query: schema })(req, {} as Response, next as unknown as NextFunction);

    expect(req.validated.query).toEqual({ page: 2 });
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with a ZodError when the body fails validation', () => {
    const schema = z.object({ email: z.email() });
    const req = buildReq({ body: { email: 'not-an-email' } });
    const next = vi.fn();

    validateRequest({ body: schema })(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ZodError);
  });

  it('leaves unspecified segments undefined in req.validated', () => {
    const schema = z.object({ id: z.uuid() });
    const req = buildReq({ params: { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6' } });
    const next = vi.fn();

    validateRequest({ params: schema })(req, {} as Response, next as unknown as NextFunction);

    expect(req.validated.body).toBeUndefined();
    expect(req.validated.query).toBeUndefined();
    expect(req.validated.params).toEqual({ id: '3fa85f64-5717-4562-b3fc-2c963f66afa6' });
  });
});
