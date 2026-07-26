import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import type {
  ConfirmSaleCommand,
  CreateReturnCommand,
  SaleDraftCommand,
  SaleIdParams,
  SaleListQuery,
  SaleReferenceParams,
  UpdateSaleDraftCommand,
} from '@dragon-telecom/contract';
import type { ISalesService } from './sales.interface';

export class SalesController {
  constructor(private service: ISalesService) {}

  // requireAuth({pages:[STAFF_POS]}) runs before this handler — STAFF/ADMIN always carry a
  // Staff profile (identity's own createUser invariant), so staffId is always set.
  createDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createDraft(req.validated.body as SaleDraftCommand, req.user!.staffId!);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as SaleIdParams;
      const result = await this.service.updateDraft(id, req.validated.body as UpdateSaleDraftCommand, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  deleteDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as SaleIdParams;
      await this.service.deleteDraft(id, req.user!);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  confirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as SaleIdParams;
      const result = await this.service.confirm(id, req.validated.body as ConfirmSaleCommand, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  listStaffSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listStaffSales(req.validated.query as SaleListQuery, req.user!.staffId!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  listAdminSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listAdminSales(req.validated.query as SaleListQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  // Serves both STAFF_DETAIL and ADMIN_DETAIL (plan §I.2) — the owner-or-admin guard and
  // margin-gating both live in the service, keyed off the same req.user actor either way.
  getSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reference } = req.validated.params as SaleReferenceParams;
      sendSuccess(res, await this.service.getSale(reference, req.user!), 200);
    } catch (error) {
      next(error);
    }
  };

  createReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createReturn(req.validated.body as CreateReturnCommand, req.user!.staffId!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };
}
