import { Router } from 'express';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  IDENTITY_ROUTES,
  UserType,
  LoginSchema,
  RefreshSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserListQuerySchema,
  UserIdParamsSchema,
  CreateRoleSchema,
  UpdateRoleSchema,
  RoleIdParamsSchema,
  SetRolePagesSchema,
  PagesQuerySchema,
  CreateTechnicianSchema,
  UpdateTechnicianSchema,
  TechnicianIdParamsSchema,
} from '@dragon-telecom/contract';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';

const router = Router();

// 1. Manual DI
const service = new IdentityService(prisma);
const controller = new IdentityController(service);

// Exported for the aggregator (modules/index.ts) to inject into the clients module's
// composition root — clients' approve flow calls provisionClientUser/resetPassword through
// this same singleton (plan §C-1), never a second IdentityService instance.
export const identityService = service;

// checkDB:true closes the "disabled admin's still-valid access token" window (refresh tokens
// are already revoked on disable — see plan §5.1).
const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });

// 2. Routes (validation uses contract schemas per segment)
router.post(IDENTITY_ROUTES.LOGIN, validateRequest({ body: LoginSchema }), controller.login);
router.post(IDENTITY_ROUTES.REFRESH, validateRequest({ body: RefreshSchema }), controller.refresh);
router.post(IDENTITY_ROUTES.LOGOUT, requireAuth(), controller.logout);
router.get(
  IDENTITY_ROUTES.ME_PERMISSIONS,
  requireAuth({ types: [UserType.STAFF, UserType.ADMIN] }),
  controller.mePermissions,
);

router.get(IDENTITY_ROUTES.USERS, adminOnly, validateRequest({ query: UserListQuerySchema }), controller.listUsers);
router.post(IDENTITY_ROUTES.USERS, adminOnly, validateRequest({ body: CreateUserSchema }), controller.createUser);
router.get(IDENTITY_ROUTES.USER_BY_ID, adminOnly, validateRequest({ params: UserIdParamsSchema }), controller.getUser);
router.patch(
  IDENTITY_ROUTES.USER_BY_ID,
  adminOnly,
  validateRequest({ params: UserIdParamsSchema, body: UpdateUserSchema }),
  controller.updateUser,
);

router.get(IDENTITY_ROUTES.ROLES, adminOnly, controller.listRoles);
router.post(IDENTITY_ROUTES.ROLES, adminOnly, validateRequest({ body: CreateRoleSchema }), controller.createRole);
router.patch(
  IDENTITY_ROUTES.ROLE_BY_ID,
  adminOnly,
  validateRequest({ params: RoleIdParamsSchema, body: UpdateRoleSchema }),
  controller.updateRole,
);
router.put(
  IDENTITY_ROUTES.ROLE_PAGES,
  adminOnly,
  validateRequest({ params: RoleIdParamsSchema, body: SetRolePagesSchema }),
  controller.setRolePages,
);

router.get(IDENTITY_ROUTES.PAGES, adminOnly, validateRequest({ query: PagesQuerySchema }), controller.listPages);

router.get(IDENTITY_ROUTES.TECHNICIANS, adminOnly, controller.listTechnicians);
router.post(
  IDENTITY_ROUTES.TECHNICIANS,
  adminOnly,
  validateRequest({ body: CreateTechnicianSchema }),
  controller.createTechnician,
);
router.patch(
  IDENTITY_ROUTES.TECHNICIAN_BY_ID,
  adminOnly,
  validateRequest({ params: TechnicianIdParamsSchema, body: UpdateTechnicianSchema }),
  controller.updateTechnician,
);

export { router };
