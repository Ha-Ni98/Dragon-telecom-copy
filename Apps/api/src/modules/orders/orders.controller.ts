import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import type {
  BackofficeOrdersQuery,
  MyOrdersQuery,
  OrderIdParams,
  PlaceOrderCommand,
  ReturnOrderCommand,
  UpdateOrderStatusCommand,
} from '@dragon-telecom/contract';
import type { CancelOrderCommand } from './orders.interface';
import type { IOrdersService } from './orders.interface';

export class OrdersController {
  constructor(private service: IOrdersService) {}

  // public|client — requireAuth({optional:true}) upstream, so req.user may be undefined (guest).
  placeOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.placeOrder(req.validated.body as PlaceOrderCommand, req.user);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  listMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listMyOrders(req.validated.query as MyOrdersQuery, req.user!.clientId!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  cancelMyOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as OrderIdParams;
      const result = await this.service.cancelMyOrder(id, req.user!.clientId!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // Serves both STAFF_LIST and ADMIN_LIST (plan §I.2) — same data either way, margins gated
  // in the service off the same req.user actor.
  listBackoffice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listBackoffice(req.validated.query as BackofficeOrdersQuery, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // Serves both STAFF_STATUS and ADMIN_STATUS.
  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as OrderIdParams;
      const result = await this.service.updateStatus(id, req.validated.body as UpdateOrderStatusCommand, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  cancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as OrderIdParams;
      const result = await this.service.cancelOrder(id, req.validated.body as CancelOrderCommand, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  returnOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as OrderIdParams;
      const result = await this.service.returnOrder(id, req.validated.body as ReturnOrderCommand, req.user!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // Serves both STAFF_STATS and ADMIN_STATS — identical data, no actor needed.
  getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getStats(), 200);
    } catch (error) {
      next(error);
    }
  };
}
