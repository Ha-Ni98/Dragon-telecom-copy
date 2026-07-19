import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import { logger } from '@common/config/logger';
import type {
  ClientActivityCommand,
  ClientActivityIdParams,
  ClientActivityQuery,
  LogsQuery,
  StaffSearchCommand,
  StaffSearchesQuery,
} from '@dragon-telecom/contract';
import type { IObservabilityService } from './observability.interface';

export class ObservabilityController {
  constructor(private service: IObservabilityService) {}

  // Fast 202 path — responds immediately, then fires the write without blocking the caller;
  // failures are logged, never surfaced (spec BL 2).
  recordClientActivity = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const clientId = req.user!.clientId!;
      const cmd = req.validated.body as ClientActivityCommand;
      sendSuccess(res, null, 202);
      void this.service.recordClientActivity(clientId, cmd).catch((err: unknown) => {
        logger.error({ err }, 'observability: failed to record a client activity beacon');
      });
    } catch (error) {
      next(error);
    }
  };

  // Recorded decision (audit fix plan §6): the staff-search double-write risk is resolved in
  // favor of the server-side `product.searched` emission (catalog.service.ts's
  // emitProductSearched) — this beacon stays implemented but Stage 3 must never call it for
  // staff/admin product searches, only for whatever non-product-search beacons still need it.
  recordStaffSearch = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const userId = req.user!.sub;
      const cmd = req.validated.body as StaffSearchCommand;
      sendSuccess(res, null, 202);
      void this.service.recordStaffSearch(userId, cmd).catch((err: unknown) => {
        logger.error({ err }, 'observability: failed to record a staff search beacon');
      });
    } catch (error) {
      next(error);
    }
  };

  getClientActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ClientActivityIdParams;
      const result = await this.service.getClientActivity(id, req.validated.query as ClientActivityQuery);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  listStaffSearches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listStaffSearches(req.validated.query as StaffSearchesQuery);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  listLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listLogs(req.validated.query as LogsQuery);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  getLogStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getLogStats();
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };
}
