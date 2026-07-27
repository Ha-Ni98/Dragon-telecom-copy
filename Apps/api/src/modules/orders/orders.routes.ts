import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  ORDER_ROUTES,
  UserType,
  PageKey,
  MyOrdersQuerySchema,
  BackofficeOrdersQuerySchema,
  OrderIdParamsSchema,
  PlaceOrderSchema,
  ReturnOrderSchema,
  UpdateOrderStatusSchema,
} from '@dragon-telecom/contract';
// Direct sibling-module imports — orders depends one-directionally on platform/inventory/
// catalog/clients/billing (no reverse dependency), the same shape sales/purchasing established
// in sets 05/06. catalogProductService satisfies ICatalogViewerPricingPort structurally (its
// getCartProducts method — already public, already consumed this same way by clients'
// ICatalogCartPort); clientsService satisfies IOrderCreditPort structurally
// (credit-serialization fix, plan §C4); billingService satisfies IBillingIssuePort structurally
// (issueInvoiceInTx/captureClientPaymentInTx, S5/S10) — no adapter needed for any of them.
// billing imports only platform and clients, never orders, so no import cycle is created.
import { sequenceService, deliveryFeeService } from '../platform/platform.routes';
import { inventoryService } from '../inventory/inventory.routes';
import { catalogProductService } from '../catalog/catalog.routes';
import { clientsService } from '../clients/clients.routes';
import { billingService } from '../billing/billing.routes';
import { OrdersService } from './orders.service';
import { OrdersListener } from './orders.listener';
import { OrdersController } from './orders.controller';

// No contract schema for CANCEL's body (plan §I.2 footnote, §D-4) — reusing
// UpdateOrderStatusSchema would accept fields CANCEL never uses; a minimal inline schema,
// same "no new contract schema" resolution as set 06's CREDIT_REQUIRES_CLIENT.
const CancelOrderSchema = z.object({ reason: z.string().optional() });

const router = Router();

// 1. Manual DI
const service = new OrdersService(
  prisma,
  deliveryFeeService,
  inventoryService,
  sequenceService,
  catalogProductService,
  clientsService,
  billingService,
);
const controller = new OrdersController(service);
new OrdersListener(service).setup();

// Access per plan §I.2/§D-1/§D-2 — PLACE stays public (optional viewer, same precedent as
// catalog's optionalViewer); CLIENT-only routes mirror clients.routes.ts's clientOnly (no
// checkDB there either); STAFF_ORDERS-or-admin mirrors sales' staffPosOrAdmin shape.
const optionalViewer = requireAuth({ optional: true });
const clientOnly = requireAuth({ types: [UserType.CLIENT] });
const staffOrdersOrAdmin = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], pages: [PageKey.STAFF_ORDERS], checkDB: true });
const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });

// 2. Routes (validation uses contract schemas per segment)
router.post(ORDER_ROUTES.PLACE, optionalViewer, validateRequest({ body: PlaceOrderSchema }), controller.placeOrder);
router.get(ORDER_ROUTES.MY_LIST, clientOnly, validateRequest({ query: MyOrdersQuerySchema }), controller.listMyOrders);
router.post(ORDER_ROUTES.MY_CANCEL, clientOnly, validateRequest({ params: OrderIdParamsSchema }), controller.cancelMyOrder);

router.get(
  ORDER_ROUTES.STAFF_LIST,
  staffOrdersOrAdmin,
  validateRequest({ query: BackofficeOrdersQuerySchema }),
  controller.listBackoffice,
);
router.get(
  ORDER_ROUTES.ADMIN_LIST,
  adminOnly,
  validateRequest({ query: BackofficeOrdersQuerySchema }),
  controller.listBackoffice,
);

// STATS registered before the status/cancel/return :id routes below (specific-before-parametric
// discipline, plan §I.2) — though no genuine collision exists here since every STATS route is
// GET while its siblings under the same prefix are POST/PATCH.
router.get(ORDER_ROUTES.STAFF_STATS, staffOrdersOrAdmin, controller.getStats);
router.get(ORDER_ROUTES.ADMIN_STATS, adminOnly, controller.getStats);

router.patch(
  ORDER_ROUTES.STAFF_STATUS,
  staffOrdersOrAdmin,
  validateRequest({ params: OrderIdParamsSchema, body: UpdateOrderStatusSchema }),
  controller.updateStatus,
);
router.patch(
  ORDER_ROUTES.ADMIN_STATUS,
  adminOnly,
  validateRequest({ params: OrderIdParamsSchema, body: UpdateOrderStatusSchema }),
  controller.updateStatus,
);

router.post(
  ORDER_ROUTES.CANCEL,
  adminOnly,
  validateRequest({ params: OrderIdParamsSchema, body: CancelOrderSchema }),
  controller.cancelOrder,
);
router.post(
  ORDER_ROUTES.RETURN,
  adminOnly,
  validateRequest({ params: OrderIdParamsSchema, body: ReturnOrderSchema }),
  controller.returnOrder,
);

export { router };
