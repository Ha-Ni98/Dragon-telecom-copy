import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import { AuthError } from '@common/errors';
import type { CreateAdjustmentCommand, MovementsQuery, ReservationsQuery, StockQuery } from '@dragon-telecom/contract';
import type { IInventoryReadService } from './inventory.interface';

export class InventoryController {
  constructor(private service: IInventoryReadService) {}

  getStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getStock(req.validated.query as StockQuery);
      if ('body' in result) {
        res.setHeader('Content-Type', result.mime);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.status(200).send(result.body);
        return;
      }
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  listMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listMovements(req.validated.query as MovementsQuery));
    } catch (error) {
      next(error);
    }
  };

  listReservations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listReservations(req.validated.query as ReservationsQuery));
    } catch (error) {
      next(error);
    }
  };

  createAdjustment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staffId = req.user?.staffId;
      if (!staffId) throw new AuthError('Admin user has no staff profile');
      const result = await this.service.createAdjustment(req.validated.body as CreateAdjustmentCommand, staffId);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };
}
