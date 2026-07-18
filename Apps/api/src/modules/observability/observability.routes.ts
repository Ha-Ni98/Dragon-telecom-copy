import { Router } from 'express';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  OBS_ROUTES,
  UserType,
  ClientActivitySchema,
  StaffSearchSchema,
  ClientActivityIdParamsSchema,
  ClientActivityQuerySchema,
  StaffSearchesQuerySchema,
  LogsQuerySchema,
} from '@dragon-telecom/contract';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';
import { ObservabilityListener } from './observability.listener';

const router = Router();

// 1. Manual DI
const service = new ObservabilityService(prisma);
const controller = new ObservabilityController(service);

// The listener is wired once, right here at module load — registerModules imports this file
// exactly once at startup, so every audit/activity handler is live before the app ever serves a
// request. No ordering dependency on other modules: handlers for not-yet-emitting modules are
// inert until those modules emit.
const listener = new ObservabilityListener(service);
listener.setup();

const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });

// 2. Routes (validation uses contract schemas per segment)
router.post(
  OBS_ROUTES.CLIENT_BEACON,
  requireAuth({ types: [UserType.CLIENT] }),
  validateRequest({ body: ClientActivitySchema }),
  controller.recordClientActivity,
);
router.post(
  OBS_ROUTES.STAFF_SEARCH_BEACON,
  requireAuth({ types: [UserType.STAFF, UserType.ADMIN] }),
  validateRequest({ body: StaffSearchSchema }),
  controller.recordStaffSearch,
);

router.get(
  OBS_ROUTES.CLIENT_ACTIVITY,
  adminOnly,
  validateRequest({ params: ClientActivityIdParamsSchema, query: ClientActivityQuerySchema }),
  controller.getClientActivity,
);
router.get(
  OBS_ROUTES.STAFF_SEARCHES,
  adminOnly,
  validateRequest({ query: StaffSearchesQuerySchema }),
  controller.listStaffSearches,
);
router.get(OBS_ROUTES.LOGS, adminOnly, validateRequest({ query: LogsQuerySchema }), controller.listLogs);
router.get(OBS_ROUTES.LOG_STATS, adminOnly, controller.getLogStats);

export { router };
