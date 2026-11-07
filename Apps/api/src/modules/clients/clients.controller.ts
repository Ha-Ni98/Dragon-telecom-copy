import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import type {
  AddCartItemCommand,
  AdminClientListQuery,
  AdminUpdateClientCommand,
  ApproveClientCommand,
  CartItemParams,
  ChangeMyPasswordCommand,
  ClientIdParams,
  CreatePosClientCommand,
  PosClientIdParams,
  PosClientListQuery,
  PosClientSearchQuery,
  PurchasedProductParams,
  PurchasedProductsQuery,
  RegisterClientCommand,
  RejectClientCommand,
  ResetClientPasswordCommand,
  UpdateMeCommand,
  UpdatePosClientCommand,
  ValidatePhoneCommand,
} from '@dragon-telecom/contract';
import type { IClientsService } from './clients.interface';

export class ClientsController {
  constructor(private service: IClientsService) {}

  // --- Web identity (public + client) ---

  validatePhone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone } = req.validated.body as ValidatePhoneCommand;
      sendSuccess(res, await this.service.validatePhone(phone), 200);
    } catch (error) {
      next(error);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.register(req.validated.body as RegisterClientCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // requireAuth({types:[CLIENT]}) runs before this handler and always sets req.user.clientId.
      sendSuccess(res, await this.service.getMe(req.user!.clientId!), 200);
    } catch (error) {
      next(error);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.updateMe(req.user!.clientId!, req.validated.body as UpdateMeCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  changeMyPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.changeMyPassword(req.user!.clientId!, req.validated.body as ChangeMyPasswordCommand);
      sendSuccess(res, null, 200);
    } catch (error) {
      next(error);
    }
  };

  // --- Cart (client) ---

  getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getCart(req.user!.clientId!, req.user), 200);
    } catch (error) {
      next(error);
    }
  };

  addCartItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.addCartItem(req.user!.clientId!, req.validated.body as AddCartItemCommand);
      sendSuccess(res, null, 201);
    } catch (error) {
      next(error);
    }
  };

  removeCartItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId } = req.validated.params as CartItemParams;
      await this.service.removeCartItem(req.user!.clientId!, productId);
      sendSuccess(res, null, 204);
    } catch (error) {
      next(error);
    }
  };

  // --- Admin client pipeline ---

  listClients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listClients(req.validated.query as AdminClientListQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  clientStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.clientStats(), 200);
    } catch (error) {
      next(error);
    }
  };

  getClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ClientIdParams;
      sendSuccess(res, await this.service.getClient(id), 200);
    } catch (error) {
      next(error);
    }
  };

  getClientOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ClientIdParams;
      sendSuccess(res, await this.service.getClientOverview(id), 200);
    } catch (error) {
      next(error);
    }
  };

  approveClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ClientIdParams;
      // requireAuth({types:[ADMIN], checkDB:true}) runs before this handler — ADMIN always
      // carries a Staff profile (identity's own createUser invariant), so staffId is always set.
      const result = await this.service.approveClient(id, req.validated.body as ApproveClientCommand, req.user!.staffId!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  rejectClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ClientIdParams;
      const result = await this.service.rejectClient(id, req.validated.body as RejectClientCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  resetClientPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ClientIdParams;
      await this.service.resetClientPassword(id, req.validated.body as ResetClientPasswordCommand);
      sendSuccess(res, null, 200);
    } catch (error) {
      next(error);
    }
  };

  adminUpdateClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ClientIdParams;
      const result = await this.service.adminUpdateClient(id, req.validated.body as AdminUpdateClientCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // --- POS clients ---

  searchPosClients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.searchPosClients(req.validated.query as PosClientSearchQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  quickCreatePosClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.quickCreatePosClient(req.validated.body as CreatePosClientCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  listPosClients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listPosClients(req.validated.query as PosClientListQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  // S36 — the "Products bought" tab. Thin handlers: identity resolution and the SQL live in the service.
  listClientPurchasedProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as ClientIdParams;
      sendSuccess(res, await this.service.listClientPurchasedProducts(id, req.validated.query as PurchasedProductsQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  listClientPurchasedProductDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, productId } = req.validated.params as PurchasedProductParams;
      const query = req.validated.query as PurchasedProductsQuery;
      sendSuccess(res, await this.service.listClientPurchasedProductDocuments(id, productId, query), 200);
    } catch (error) {
      next(error);
    }
  };

  listPosClientPurchasedProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as PosClientIdParams;
      sendSuccess(res, await this.service.listPosClientPurchasedProducts(id, req.validated.query as PurchasedProductsQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  listPosClientPurchasedProductDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, productId } = req.validated.params as PurchasedProductParams;
      const query = req.validated.query as PurchasedProductsQuery;
      sendSuccess(res, await this.service.listPosClientPurchasedProductDocuments(id, productId, query), 200);
    } catch (error) {
      next(error);
    }
  };

  createPosClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createPosClient(req.validated.body as CreatePosClientCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updatePosClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as PosClientIdParams;
      const result = await this.service.updatePosClient(id, req.validated.body as UpdatePosClientCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };
}
