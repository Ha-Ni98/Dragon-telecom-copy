import { Router } from 'express';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  STATS_ROUTES,
  UserType,
  CashRegisterDocumentsQuerySchema,
  CashRegisterQuerySchema,
  ChartParamsSchema,
  ChartsQuerySchema,
  FilteredQuerySchema,
  ReportParamsSchema,
  ReportQuerySchema,
  TopProductsQuerySchema,
} from '@dragon-telecom/contract';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';

const router = Router();

// 1. Manual DI — Prisma-only (no injected cross-module services, no listener: statistics
// emits/listens to nothing).
const service = new StatisticsService(prisma);
const controller = new StatisticsController(service);

const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });
// S18/P5 — was `types: [UserType.STAFF]`, so an ADMIN browsing /staff (which the staff sidebar
// explicitly supports — effectivePages() returns every PageKey for ADMIN) 403'd on the page's
// only query. getStaffDashboard(staffId) filters "my sales"/"my drafts" by staffId and computes
// pending-orders/low-stock globally, so an admin caller simply sees zeroed "my" figures
// alongside the real global ones — no service change needed.
const staffDashboardViewer = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], checkDB: true });

// 2. Routes (validation uses contract schemas per segment)
router.get(STATS_ROUTES.ADMIN_DASHBOARD, adminOnly, controller.getAdminDashboard);
router.get(STATS_ROUTES.STAFF_DASHBOARD, staffDashboardViewer, controller.getStaffDashboard);
router.get(STATS_ROUTES.OVERVIEW, adminOnly, controller.getOverview);
router.get(STATS_ROUTES.FILTERED, adminOnly, validateRequest({ query: FilteredQuerySchema }), controller.getFiltered);
router.get(
  STATS_ROUTES.CHARTS,
  adminOnly,
  validateRequest({ params: ChartParamsSchema, query: ChartsQuerySchema }),
  controller.getChart,
);
router.get(STATS_ROUTES.TOP_PRODUCTS, adminOnly, validateRequest({ query: TopProductsQuerySchema }), controller.getTopProducts);
router.get(
  STATS_ROUTES.REPORT,
  adminOnly,
  validateRequest({ params: ReportParamsSchema, query: ReportQuerySchema }),
  controller.getReport,
);

// S33 — the Caisse (admin only). The more specific path first, by habit.
router.get(
  STATS_ROUTES.CASH_REGISTER_DOCUMENTS,
  adminOnly,
  validateRequest({ query: CashRegisterDocumentsQuerySchema }),
  controller.getCashRegisterDocuments,
);
router.get(STATS_ROUTES.CASH_REGISTER, adminOnly, validateRequest({ query: CashRegisterQuerySchema }), controller.getCashRegister);

export { router };
