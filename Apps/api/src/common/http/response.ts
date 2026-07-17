import type { Response } from 'express';
import type { ApiResponse } from '@dragon-telecom/contract';

export const sendSuccess = <T>(res: Response, data: T, status = 200, message?: string): void => {
  const body: ApiResponse<T> = message === undefined ? { success: true, data } : { success: true, data, message };
  res.status(status).json(body);
};
