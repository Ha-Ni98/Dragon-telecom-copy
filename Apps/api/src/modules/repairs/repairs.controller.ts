import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import type {
  AddRepairPartCommand,
  CreateRepairCommand,
  RepairIdParams,
  RepairListQuery,
  RepairPartParams,
  RepairStatusCommand,
  UpdateRepairCommand,
} from '@dragon-telecom/contract';
import type { IRepairsService } from './repairs.interface';

export class RepairsController {
  constructor(private service: IRepairsService) {}

  // Serves both STAFF_LIST and ADMIN_LIST — staff⇒created-by-me, admin⇒all (scoped in the
  // service off the same req.user actor).
  listRepairs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listRepairs(req.validated.query as RepairListQuery, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // Serves both STAFF_BY_ID and ADMIN_BY_ID (set-03 B1).
  getRepair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as RepairIdParams;
      const result = await this.service.getRepair(id, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // Serves both STAFF_CREATE and ADMIN_CREATE.
  createRepair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createRepair(req.validated.body as CreateRepairCommand, req.user!);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateRepair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as RepairIdParams;
      const result = await this.service.updateRepair(id, req.validated.body as UpdateRepairCommand, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  addPart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as RepairIdParams;
      const result = await this.service.addPart(id, req.validated.body as AddRepairPartCommand, req.user!);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  removePart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, partId } = req.validated.params as RepairPartParams;
      const result = await this.service.removePart(id, partId, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  changeStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as RepairIdParams;
      const result = await this.service.changeStatus(id, req.validated.body as RepairStatusCommand, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };
}
