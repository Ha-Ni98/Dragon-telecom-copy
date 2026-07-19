import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ErrorCode } from '@dragon-telecom/contract';
import { AuthError, BadRequestError } from '../../../src/common/errors';
import { globalErrorHandler } from '../../../src/common/middlewares/error.middleware';

const buildRes = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = vi.fn().mockReturnValue(res) as unknown as Response['json'];
  return res;
};

describe('globalErrorHandler', () => {
  it('maps an AppError to its statusCode and the ApiResponse error envelope', () => {
    const res = buildRes();
    const err = new AuthError('Missing token');

    globalErrorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: ErrorCode.AUTH_UNAUTHORIZED, message: 'Missing token' }),
      }),
    );
  });

  it('maps a ZodError to 400 VALIDATION_ERROR with issues as details', () => {
    const res = buildRes();
    const result = z.object({ email: z.email() }).safeParse({ email: 'not-an-email' });
    if (result.success) throw new Error('expected validation to fail');

    globalErrorHandler(result.error, {} as Request, res, vi.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
      }),
    );
  });

  it('maps an unknown error to 500 INTERNAL_SERVER_ERROR', () => {
    const res = buildRes();

    globalErrorHandler(new Error('boom'), {} as Request, res, vi.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: ErrorCode.INTERNAL_SERVER_ERROR, message: 'Internal Server Error' },
    });
  });

  it('carries details through for errors that provide them', () => {
    const res = buildRes();
    const err = new BadRequestError('Invalid field', { field: 'email' });

    globalErrorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ details: { field: 'email' } }),
      }),
    );
  });
});
