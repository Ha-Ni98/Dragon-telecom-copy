import { Router } from 'express';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  REPAIR_ROUTES,
  UserType,
  PageKey,
  AddRepairPartSchema,
  CreateRepairSchema,
  RepairIdParamsSchema,
  RepairListQuerySchema,
  RepairPartParamsSchema,
  RepairStatusSchema,
  UpdateRepairSchema,
} from '@dragon-telecom/contract';
// Direct sibling-module imports — repairs depends one-directionally on platform/inventory (no
// reverse dependency), the same shape orders/sales/purchasing established.
import { sequenceService } from '../platform/platform.routes';
import { inventoryService } from '../inventory/inventory.routes';
import { RepairsService } from './repairs.service';
import { RepairsController } from './repairs.controller';

const router = Router();

// 1. Manual DI — no listener: repairs listens to nothing (contract confirmed).
const service = new RepairsService(prisma, inventoryService, sequenceService);
const controller = new RepairsController(service);

// Access per plan §II.2/§D-5 — mutations are page-gated only, not creator-scoped (the
// created-by-me restriction applies to LIST alone, resolved in the service via the intake
// history marker, §C-1).
const staffRepairsOrAdmin = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], pages: [PageKey.STAFF_REPAIRS], checkDB: true });
const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });

// 2. Routes (validation uses contract schemas per segment)
router.get(REPAIR_ROUTES.STAFF_LIST, staffRepairsOrAdmin, validateRequest({ query: RepairListQuerySchema }), controller.listRepairs);
router.get(REPAIR_ROUTES.ADMIN_LIST, adminOnly, validateRequest({ query: RepairListQuerySchema }), controller.listRepairs);

router.post(REPAIR_ROUTES.STAFF_CREATE, staffRepairsOrAdmin, validateRequest({ body: CreateRepairSchema }), controller.createRepair);
router.post(REPAIR_ROUTES.ADMIN_CREATE, adminOnly, validateRequest({ body: CreateRepairSchema }), controller.createRepair);

router.patch(
  REPAIR_ROUTES.STAFF_UPDATE,
  staffRepairsOrAdmin,
  validateRequest({ params: RepairIdParamsSchema, body: UpdateRepairSchema }),
  controller.updateRepair,
);
router.patch(
  REPAIR_ROUTES.ADMIN_UPDATE,
  adminOnly,
  validateRequest({ params: RepairIdParamsSchema, body: UpdateRepairSchema }),
  controller.updateRepair,
);

router.post(
  REPAIR_ROUTES.STAFF_PARTS,
  staffRepairsOrAdmin,
  validateRequest({ params: RepairIdParamsSchema, body: AddRepairPartSchema }),
  controller.addPart,
);
router.post(
  REPAIR_ROUTES.ADMIN_PARTS,
  adminOnly,
  validateRequest({ params: RepairIdParamsSchema, body: AddRepairPartSchema }),
  controller.addPart,
);

router.delete(
  REPAIR_ROUTES.STAFF_PART_BY_ID,
  staffRepairsOrAdmin,
  validateRequest({ params: RepairPartParamsSchema }),
  controller.removePart,
);
router.delete(
  REPAIR_ROUTES.ADMIN_PART_BY_ID,
  adminOnly,
  validateRequest({ params: RepairPartParamsSchema }),
  controller.removePart,
);

router.post(
  REPAIR_ROUTES.STAFF_STATUS,
  staffRepairsOrAdmin,
  validateRequest({ params: RepairIdParamsSchema, body: RepairStatusSchema }),
  controller.changeStatus,
);
router.post(
  REPAIR_ROUTES.ADMIN_STATUS,
  adminOnly,
  validateRequest({ params: RepairIdParamsSchema, body: RepairStatusSchema }),
  controller.changeStatus,
);

export { router };
