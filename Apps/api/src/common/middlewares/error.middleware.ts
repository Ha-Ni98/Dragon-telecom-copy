import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { ApiResponse } from '@dragon-telecom/contract';
import { ErrorCode } from '@dragon-telecom/contract';
import { AppError } from '../errors/app-error';
import { logger } from '../config/logger';

export const globalErrorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof AppError) {
    const body: ApiResponse = {
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ApiResponse = {
      success: false,
      error: { code: ErrorCode.VALIDATION_ERROR, message: 'Validation failed', details: err.issues },
    };
    res.status(400).json(body);
    return;
  }

  logger.error({ err }, 'Uncaught exception');
  const body: ApiResponse = {
    success: false,
    error: { code: ErrorCode.INTERNAL_SERVER_ERROR, message: 'Internal Server Error' },
  };
  res.status(500).json(body);
};
