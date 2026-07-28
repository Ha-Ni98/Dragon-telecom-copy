import { Router } from 'express';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  SALE_ROUTES,
  UserType,
  PageKey,
  ConfirmSaleSchema,
  CreateReturnSchema,
  ReturnListQuerySchema,
  SaleDraftSchema,
  SaleIdParamsSchema,
  SaleListQuerySchema,
  SaleReferenceParamsSchema,
  UpdateSaleDraftSchema,
} from '@dragon-telecom/contract';
// Direct sibling-module imports — sales depends one-directionally on platform/inventory/catalog/
// clients/billing (no reverse dependency), the same shape purchasing.routes.ts established in
// Sprint 7 of set 05. catalogProductService satisfies ICatalogPosPricingPort structurally (its
// resolvePosPrices method, added in set-06 Sprint 1, matches the port's signature exactly);
// clientsService satisfies IClientCreditPort structurally (credit-serialization fix, plan §C3,
// split into applyDocumentCharge/applyLedgerPayment in S5); billingService satisfies
// IBillingIssuePort structurally (issueInvoiceInTx/captureClientPaymentInTx, S5/R2) — no adapter
// needed for any of the three.
import { sequenceService } from '../platform/platform.routes';
import { inventoryService } from '../inventory/inventory.routes';
import { catalogProductService } from '../catalog/catalog.routes';
import { clientsService } from '../clients/clients.routes';
import { billingService } from '../billing/billing.routes';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

const router = Router();

// 1. Manual DI
const service = new SalesService(prisma, sequenceService, inventoryService, catalogProductService, clientsService, billingService);
const controller = new SalesController(service);

// Access per plan §I.2/§D-1 — `types` is always paired explicitly with `pages` (ADMIN bypasses
// the page check inside requireAuth itself; STAFF must additionally hold the listed page),
// mirroring catalog's own staffProductsOrAdmin precedent.
const staffPosOrAdmin = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], pages: [PageKey.STAFF_POS], checkDB: true });
const staffSalesOrAdmin = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], pages: [PageKey.STAFF_SALES], checkDB: true });
// S18 — also backs the POS-clients detail drawer's Sales tab, whose page key is
// STAFF_POS_CLIENTS, not STAFF_SALES.
const staffSalesListOrAdmin = requireAuth({
  types: [UserType.STAFF, UserType.ADMIN],
  anyPages: [PageKey.STAFF_SALES, PageKey.STAFF_POS_CLIENTS],
  checkDB: true,
});
// No page restriction — the owner-or-admin guard + margin-gating both live in the service.
const staffOrAdmin = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], checkDB: true });
const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });

// 2. Routes (validation uses contract schemas per segment)
router.post(SALE_ROUTES.CREATE_DRAFT, staffPosOrAdmin, validateRequest({ body: SaleDraftSchema }), controller.createDraft);
router.patch(
  SALE_ROUTES.UPDATE_DRAFT,
  staffPosOrAdmin,
  validateRequest({ params: SaleIdParamsSchema, body: UpdateSaleDraftSchema }),
  controller.updateDraft,
);
router.delete(
  SALE_ROUTES.DELETE_DRAFT,
  staffPosOrAdmin,
  validateRequest({ params: SaleIdParamsSchema }),
  controller.deleteDraft,
);
router.post(
  SALE_ROUTES.CONFIRM,
  staffPosOrAdmin,
  validateRequest({ params: SaleIdParamsSchema, body: ConfirmSaleSchema }),
  controller.confirm,
);
router.get(SALE_ROUTES.STAFF_LIST, staffSalesListOrAdmin, validateRequest({ query: SaleListQuerySchema }), controller.listStaffSales);
router.get(SALE_ROUTES.ADMIN_LIST, adminOnly, validateRequest({ query: SaleListQuerySchema }), controller.listAdminSales);
router.get(SALE_ROUTES.STAFF_DETAIL, staffOrAdmin, validateRequest({ params: SaleReferenceParamsSchema }), controller.getSale);
router.get(SALE_ROUTES.ADMIN_DETAIL, adminOnly, validateRequest({ params: SaleReferenceParamsSchema }), controller.getSale);
router.get(SALE_ROUTES.ADMIN_RETURNS_LIST, adminOnly, validateRequest({ query: ReturnListQuerySchema }), controller.listReturns);
router.post(SALE_ROUTES.ADMIN_RETURN, adminOnly, validateRequest({ body: CreateReturnSchema }), controller.createReturn);

// S18/D-2 — staff holding the sales page gets the Returns tab + issue-return, same as admin.
router.get(SALE_ROUTES.STAFF_RETURNS_LIST, staffSalesOrAdmin, validateRequest({ query: ReturnListQuerySchema }), controller.listReturns);
router.post(SALE_ROUTES.STAFF_RETURN, staffSalesOrAdmin, validateRequest({ body: CreateReturnSchema }), controller.createReturn);

export { router };
