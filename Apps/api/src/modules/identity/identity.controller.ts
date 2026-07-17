import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import type {
  CreateRoleCommand,
  CreateTechnicianCommand,
  CreateUserCommand,
  LoginCommand,
  PagesQuery,
  RefreshCommand,
  RoleIdParams,
  SetRolePagesCommand,
  TechnicianIdParams,
  UpdateRoleCommand,
  UpdateTechnicianCommand,
  UpdateUserCommand,
  UserIdParams,
  UserListQuery,
} from '@dragon-telecom/contract';
import type { IIdentityService, RequestContext } from './identity.interface';

const buildRequestContext = (req: Request): RequestContext => ({
  ...(req.ip != null ? { ipAddress: req.ip } : {}),
  ...(req.headers['user-agent'] != null ? { userAgent: req.headers['user-agent'] } : {}),
});

export class IdentityController {
  constructor(private service: IIdentityService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.login(req.validated.body as LoginCommand, buildRequestContext(req));
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.refresh(req.validated.body as RefreshCommand, buildRequestContext(req));
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // requireAuth() runs before this handler and always sets req.user.
      await this.service.logout(req.user!.sub);
      sendSuccess(res, null, 200);
    } catch (error) {
      next(error);
    }
  };

  mePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pages = await this.service.getEffectivePages(req.user!);
      sendSuccess(res, pages, 200);
    } catch (error) {
      next(error);
    }
  };

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listUsers(req.validated.query as UserListQuery);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as UserIdParams;
      const result = await this.service.getUser(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createUser(req.validated.body as CreateUserCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as UserIdParams;
      const result = await this.service.updateUser(id, req.validated.body as UpdateUserCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  listRoles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listRoles();
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createRole(req.validated.body as CreateRoleCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as RoleIdParams;
      const result = await this.service.updateRole(id, req.validated.body as UpdateRoleCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  setRolePages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as RoleIdParams;
      const result = await this.service.setRolePages(id, req.validated.body as SetRolePagesCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  listPages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listPages(req.validated.query as PagesQuery);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  listTechnicians = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listTechnicians();
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  createTechnician = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createTechnician(req.validated.body as CreateTechnicianCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateTechnician = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as TechnicianIdParams;
      const result = await this.service.updateTechnician(id, req.validated.body as UpdateTechnicianCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };
}
