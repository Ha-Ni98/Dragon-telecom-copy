import { Router } from 'express';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  PURCHASING_ROUTES,
  UserType,
  CancelSupplierInvoiceSchema,
  CreateSupplierInvoiceSchema,
  CreateSupplierPaymentSchema,
  CreateSupplierSchema,
  SupplierIdParamsSchema,
  SupplierInvoiceIdParamsSchema,
  SupplierInvoiceListQuerySchema,
  SupplierListQuerySchema,
  SupplierPaymentListQuerySchema,
  UpdateSupplierInvoiceSchema,
  UpdateSupplierSchema,
} from '@dragon-telecom/contract';
// Direct sibling-module imports — purchasing depends one-directionally on inventory/platform/
// catalog (no reverse dependency), the same shape clients.routes.ts established in Sprint 4
// (itself mirroring inventory.routes.ts's own sequenceService import). No adapter shim needed:
// inventoryService/catalogProductService already satisfy IInventoryService/ICatalogRepricePort
// structurally.
import { sequenceService } from '../platform/platform.routes';
import { inventoryService } from '../inventory/inventory.routes';
import { catalogProductService } from '../catalog/catalog.routes';
import { PurchasingService } from './purchasing.service';
import { PurchasingListener } from './purchasing.listener';
import { PurchasingController } from './purchasing.controller';

const router = Router();

// 1. Manual DI
const service = new PurchasingService(prisma, sequenceService, inventoryService, catalogProductService);
const controller = new PurchasingController(service);
new PurchasingListener(service).setup();

const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });

// 2. Routes (validation uses contract schemas per segment) — every route is admin-only.
// SUPPLIER_STATS registered before SUPPLIER_BY_ID so "stats" is never captured as `:id`.
router.get(PURCHASING_ROUTES.SUPPLIERS, adminOnly, validateRequest({ query: SupplierListQuerySchema }), controller.listSuppliers);
router.post(PURCHASING_ROUTES.SUPPLIERS, adminOnly, validateRequest({ body: CreateSupplierSchema }), controller.createSupplier);
router.get(PURCHASING_ROUTES.SUPPLIER_STATS, adminOnly, controller.supplierStats);
router.get(
  PURCHASING_ROUTES.SUPPLIER_DETAIL,
  adminOnly,
  validateRequest({ params: SupplierIdParamsSchema }),
  controller.getSupplier,
);
router.patch(
  PURCHASING_ROUTES.SUPPLIER_BY_ID,
  adminOnly,
  validateRequest({ params: SupplierIdParamsSchema, body: UpdateSupplierSchema }),
  controller.updateSupplier,
);

router.get(
  PURCHASING_ROUTES.INVOICES,
  adminOnly,
  validateRequest({ query: SupplierInvoiceListQuerySchema }),
  controller.listInvoices,
);
router.post(
  PURCHASING_ROUTES.INVOICES,
  adminOnly,
  validateRequest({ body: CreateSupplierInvoiceSchema }),
  controller.createInvoice,
);
router.get(
  PURCHASING_ROUTES.INVOICE_BY_ID,
  adminOnly,
  validateRequest({ params: SupplierInvoiceIdParamsSchema }),
  controller.getInvoice,
);
router.patch(
  PURCHASING_ROUTES.INVOICE_BY_ID,
  adminOnly,
  validateRequest({ params: SupplierInvoiceIdParamsSchema, body: UpdateSupplierInvoiceSchema }),
  controller.updateInvoice,
);
router.post(
  PURCHASING_ROUTES.CONFIRM,
  adminOnly,
  validateRequest({ params: SupplierInvoiceIdParamsSchema }),
  controller.confirmInvoice,
);
router.post(
  PURCHASING_ROUTES.CANCEL,
  adminOnly,
  validateRequest({ params: SupplierInvoiceIdParamsSchema, body: CancelSupplierInvoiceSchema }),
  controller.cancelInvoice,
);

router.get(
  PURCHASING_ROUTES.PAYMENTS,
  adminOnly,
  validateRequest({ query: SupplierPaymentListQuerySchema }),
  controller.listPayments,
);
router.post(
  PURCHASING_ROUTES.PAYMENTS,
  adminOnly,
  validateRequest({ body: CreateSupplierPaymentSchema }),
  controller.createPayment,
);

export { router };
