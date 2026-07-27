import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import { ForbiddenError } from '@common/errors';
import {
  CLIENT_ROUTES,
  POS_CLIENT_ROUTES,
  PageKey,
  UserType,
  AddCartItemSchema,
  AdminClientListQuerySchema,
  AdminUpdateClientSchema,
  ApproveClientSchema,
  CartItemParamsSchema,
  ChangeMyPasswordSchema,
  ClientIdParamsSchema,
  CreatePosClientSchema,
  PosClientIdParamsSchema,
  PosClientListQuerySchema,
  PosClientSearchQuerySchema,
  RegisterClientSchema,
  RejectClientSchema,
  ResetClientPasswordSchema,
  UpdateMeSchema,
  UpdatePosClientSchema,
  ValidatePhoneSchema,
} from '@dragon-telecom/contract';
// Direct sibling-module imports — clients depends one-directionally on identity/catalog/platform
// (no reverse dependency), the exact same shape inventory.routes.ts already uses for
// sequenceService/catalogPricingService. No stub+swap adapter is needed here (unlike catalog's
// InventoryPortStub): both singletons are fully built and exported before clients.routes.ts is
// ever imported, since modules/index.ts imports identity/catalog ahead of clients.
import { sequenceService } from '../platform/platform.routes';
import { catalogProductService } from '../catalog/catalog.routes';
import { identityService } from '../identity/identity.routes';
import { ClientsService } from './clients.service';
import { ClientsListener } from './clients.listener';
import { ClientsController } from './clients.controller';

const router = Router();

// 1. Manual DI — catalogProductService/identityService satisfy ICatalogCartPort/
// IIdentityProvisioningPort structurally (no adapter shim needed — their method signatures
// already match exactly).
const service = new ClientsService(prisma, identityService, sequenceService, catalogProductService);
const controller = new ClientsController(service);
new ClientsListener(service).setup();

// Exported for sales/orders/billing to inject as their own locally-declared credit-port
// interface (structural typing — the same one-directional shape catalogProductService already
// establishes for purchasing/sales/orders). PosClient belongs to this module; other modules
// must write it only through applyDocumentCharge/applyLedgerPayment (credit-serialization fix,
// plan §C2; split into these two orthogonal primitives, plan S5).
export const clientsService = service;

const clientOnly = requireAuth({ types: [UserType.CLIENT] });
const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });
// STAFF_POS_CLIENTS is one page — requireAuth's AND semantics collapse to a plain single-page
// check here, no OR guard needed (ADMIN bypasses automatically inside requireAuth).
const staffPosClientsOrAdmin = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], pages: [PageKey.STAFF_POS_CLIENTS] });

// requireAuth({pages}) requires ALL listed pages (AND); the spec's access column for SEARCH is
// "STAFF_POS or STAFF_POS_CLIENTS" (OR) — a genuine HOW mismatch (plan §D-2), resolved with a
// small one-off inline guard rather than redesigning requireAuth's shared pages semantics for
// every other module. Reuses identity's already-built getEffectivePages (no duplicated
// userRole/rolePage query here).
const posSearchGuard = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], checkDB: true });
const posSearchPagesGuard = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user!.type === UserType.ADMIN) return next();
    const effectivePages = await identityService.getEffectivePages(req.user!);
    if (effectivePages.includes(PageKey.STAFF_POS) || effectivePages.includes(PageKey.STAFF_POS_CLIENTS)) {
      return next();
    }
    throw new ForbiddenError('Insufficient permissions');
  } catch (err) {
    next(err);
  }
};

// 2. Routes (validation uses contract schemas per segment)

// Web identity — public
router.post(CLIENT_ROUTES.VALIDATE_PHONE, validateRequest({ body: ValidatePhoneSchema }), controller.validatePhone);
router.post(CLIENT_ROUTES.REGISTER, validateRequest({ body: RegisterClientSchema }), controller.register);

// Web identity — client
router.get(CLIENT_ROUTES.ME, clientOnly, controller.getMe);
router.patch(CLIENT_ROUTES.ME, clientOnly, validateRequest({ body: UpdateMeSchema }), controller.updateMe);
router.post(
  CLIENT_ROUTES.ME_PASSWORD,
  clientOnly,
  validateRequest({ body: ChangeMyPasswordSchema }),
  controller.changeMyPassword,
);

// Cart — client
router.get(CLIENT_ROUTES.CART, clientOnly, controller.getCart);
router.post(CLIENT_ROUTES.CART, clientOnly, validateRequest({ body: AddCartItemSchema }), controller.addCartItem);
router.delete(
  CLIENT_ROUTES.CART_ITEM,
  clientOnly,
  validateRequest({ params: CartItemParamsSchema }),
  controller.removeCartItem,
);

// Admin client pipeline — ADMIN_STATS registered before ADMIN_DETAIL so "stats" is never
// captured as the `:id` param (plan §B.1 note). ADMIN_OVERVIEW (S8 J4) is likewise registered
// before ADMIN_DETAIL for the same defensive convention, though it can't actually collide here
// (different segment count).
router.get(CLIENT_ROUTES.ADMIN_LIST, adminOnly, validateRequest({ query: AdminClientListQuerySchema }), controller.listClients);
router.get(CLIENT_ROUTES.ADMIN_STATS, adminOnly, controller.clientStats);
router.get(
  CLIENT_ROUTES.ADMIN_OVERVIEW,
  adminOnly,
  validateRequest({ params: ClientIdParamsSchema }),
  controller.getClientOverview,
);
router.get(CLIENT_ROUTES.ADMIN_DETAIL, adminOnly, validateRequest({ params: ClientIdParamsSchema }), controller.getClient);
router.post(
  CLIENT_ROUTES.APPROVE,
  adminOnly,
  validateRequest({ params: ClientIdParamsSchema, body: ApproveClientSchema }),
  controller.approveClient,
);
router.post(
  CLIENT_ROUTES.REJECT,
  adminOnly,
  validateRequest({ params: ClientIdParamsSchema, body: RejectClientSchema }),
  controller.rejectClient,
);
router.post(
  CLIENT_ROUTES.RESET_PASSWORD,
  adminOnly,
  validateRequest({ params: ClientIdParamsSchema, body: ResetClientPasswordSchema }),
  controller.resetClientPassword,
);
router.patch(
  CLIENT_ROUTES.ADMIN_UPDATE,
  adminOnly,
  validateRequest({ params: ClientIdParamsSchema, body: AdminUpdateClientSchema }),
  controller.adminUpdateClient,
);

// POS clients
router.get(
  POS_CLIENT_ROUTES.SEARCH,
  posSearchGuard,
  posSearchPagesGuard,
  validateRequest({ query: PosClientSearchQuerySchema }),
  controller.searchPosClients,
);
router.post(
  POS_CLIENT_ROUTES.QUICK_CREATE,
  staffPosClientsOrAdmin,
  validateRequest({ body: CreatePosClientSchema }),
  controller.quickCreatePosClient,
);
router.get(POS_CLIENT_ROUTES.ADMIN, adminOnly, validateRequest({ query: PosClientListQuerySchema }), controller.listPosClients);
router.post(POS_CLIENT_ROUTES.ADMIN, adminOnly, validateRequest({ body: CreatePosClientSchema }), controller.createPosClient);
router.patch(
  POS_CLIENT_ROUTES.ADMIN_BY_ID,
  adminOnly,
  validateRequest({ params: PosClientIdParamsSchema, body: UpdatePosClientSchema }),
  controller.updatePosClient,
);

export { router };
