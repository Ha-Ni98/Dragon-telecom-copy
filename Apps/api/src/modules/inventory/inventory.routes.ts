import { Router } from 'express';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  INVENTORY_ROUTES,
  UserType,
  StockQuerySchema,
  MovementsQuerySchema,
  ReservationsQuerySchema,
  CreateAdjustmentSchema,
} from '@dragon-telecom/contract';
import { sequenceService } from '../platform/platform.routes';
import { catalogPricingService } from '../catalog/catalog.routes';
import { InventoryService, InventoryReadService } from './inventory.service';
import { InventoryController } from './inventory.controller';

const router = Router();

// 1. Manual DI
const engine = new InventoryService(prisma);
const readService = new InventoryReadService(prisma, sequenceService, catalogPricingService, engine);
const controller = new InventoryController(readService);

// Exported singleton for downstream document-module DI (reserve/release/addLayer/consumeFifo/
// returnIn — the spec's injected-service connection rule). Built once, on the shared `prisma`
// singleton; consumers import this into their own composition roots (plan §6), mirroring
// platform's sequenceService/deliveryFeeService export.
export const inventoryService = engine;

const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });

// 2. Routes (validation uses contract schemas per segment) — all four are admin-only, static
// paths (no :id ordering hazard, plan §5.1).
router.get(INVENTORY_ROUTES.STOCK, adminOnly, validateRequest({ query: StockQuerySchema }), controller.getStock);
router.get(
  INVENTORY_ROUTES.MOVEMENTS,
  adminOnly,
  validateRequest({ query: MovementsQuerySchema }),
  controller.listMovements,
);
router.get(
  INVENTORY_ROUTES.RESERVATIONS,
  adminOnly,
  validateRequest({ query: ReservationsQuerySchema }),
  controller.listReservations,
);
router.post(
  INVENTORY_ROUTES.ADJUSTMENTS,
  adminOnly,
  validateRequest({ body: CreateAdjustmentSchema }),
  controller.createAdjustment,
);

export { router };
