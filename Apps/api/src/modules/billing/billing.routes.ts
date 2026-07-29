import { Router } from 'express';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  BILLING_ROUTES,
  UserType,
  PageKey,
  CancelInvoiceSchema,
  ClientPaymentListQuerySchema,
  CreateClientPaymentSchema,
  InvoiceListQuerySchema,
  InvoiceNumberParamsSchema,
} from '@dragon-telecom/contract';
// Direct sibling-module imports — billing depends one-directionally on platform/clients (no
// reverse dependency), same shape as sales/purchasing's own sequenceService import.
// clientsService satisfies IClientCreditPort structurally (credit-serialization fix, plan §C5)
// — no adapter needed.
import { sequenceService } from '../platform/platform.routes';
import { PlatformService } from '../platform/platform.service';
import { clientsService } from '../clients/clients.routes';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

const router = Router();

// 1. Manual DI — a second PlatformService instance satisfies IStoreSettingsPort (getSettings
// only). platform.routes.ts exports no service singleton (only sequenceService/
// deliveryFeeService); PlatformService is stateless beyond holding `prisma`, so a second
// instance alongside platform's own is harmless — no owned state, no duplicated writes.
// No listener here any more (S10) — billing subscribes to nothing: every invoice/payment in the
// codebase is issued in-transaction by its owning module (sales since S5; orders' completion,
// repairs' pickup in S13), never post-commit.
const settingsPort = new PlatformService(prisma);
const service = new BillingService(prisma, sequenceService, settingsPort, clientsService);
const controller = new BillingController(service);

// Exported singleton for downstream in-transaction consumers (sales' confirm/createReturn, S5;
// orders' completion, S10; repairs' pickup, S13) — they call issueInvoiceInTx /
// captureClientPaymentInTx inside their own transaction. One-directional: billing imports
// platform and clients, never sales/orders/repairs, so no cycle is possible.
export const billingService = service;

const clientOnly = requireAuth({ types: [UserType.CLIENT] });
const staffInvoicesOrAdmin = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], pages: [PageKey.STAFF_INVOICES], checkDB: true });
const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });
// S18 — backs the POS-clients drawer's Payments tab (D-5); STAFF_INVOICES is included so the
// staff invoices page could use the same route if it ever surfaces payments.
const staffPaymentsReadOrAdmin = requireAuth({
  types: [UserType.STAFF, UserType.ADMIN],
  anyPages: [PageKey.STAFF_INVOICES, PageKey.STAFF_POS_CLIENTS],
  checkDB: true,
});

// 2. Routes (validation uses contract schemas per segment). Literal suffixes (/pdf, /cancel)
// registered before each family's bare :number route — defensive; no actual segment-count
// collision exists here (Express dispatches on method+path together), but matches the
// codebase's established ordering convention.
router.get(BILLING_ROUTES.MY_INVOICES, clientOnly, validateRequest({ query: InvoiceListQuerySchema }), controller.getMyInvoices);
router.get(BILLING_ROUTES.MY_INVOICE_PDF, clientOnly, validateRequest({ params: InvoiceNumberParamsSchema }), controller.getMyInvoicePdf);
router.get(BILLING_ROUTES.MY_INVOICE_BY_NUMBER, clientOnly, validateRequest({ params: InvoiceNumberParamsSchema }), controller.getMyInvoice);

router.get(
  BILLING_ROUTES.STAFF_INVOICES,
  staffInvoicesOrAdmin,
  validateRequest({ query: InvoiceListQuerySchema }),
  controller.listStaffInvoices,
);
router.get(
  BILLING_ROUTES.STAFF_INVOICE_PDF,
  staffInvoicesOrAdmin,
  validateRequest({ params: InvoiceNumberParamsSchema }),
  controller.getStaffInvoicePdf,
);
router.get(
  BILLING_ROUTES.STAFF_INVOICE_BY_NUMBER,
  staffInvoicesOrAdmin,
  validateRequest({ params: InvoiceNumberParamsSchema }),
  controller.getStaffInvoice,
);
router.post(
  BILLING_ROUTES.STAFF_CLIENT_PAYMENTS,
  staffInvoicesOrAdmin,
  validateRequest({ body: CreateClientPaymentSchema }),
  controller.createClientPayment,
);

router.get(BILLING_ROUTES.ADMIN_INVOICES, adminOnly, validateRequest({ query: InvoiceListQuerySchema }), controller.listAdminInvoices);
router.post(
  BILLING_ROUTES.CANCEL,
  adminOnly,
  validateRequest({ params: InvoiceNumberParamsSchema, body: CancelInvoiceSchema }),
  controller.cancelInvoice,
);
router.get(BILLING_ROUTES.ADMIN_INVOICE_PDF, adminOnly, validateRequest({ params: InvoiceNumberParamsSchema }), controller.getAdminInvoicePdf);
router.get(
  BILLING_ROUTES.ADMIN_INVOICE_BY_NUMBER,
  adminOnly,
  validateRequest({ params: InvoiceNumberParamsSchema }),
  controller.getAdminInvoice,
);
router.post(
  BILLING_ROUTES.ADMIN_CLIENT_PAYMENTS,
  adminOnly,
  validateRequest({ body: CreateClientPaymentSchema }),
  controller.createClientPayment,
);
router.get(
  BILLING_ROUTES.ADMIN_CLIENT_PAYMENTS_LIST,
  adminOnly,
  validateRequest({ query: ClientPaymentListQuerySchema }),
  controller.listClientPayments,
);
router.get(
  BILLING_ROUTES.STAFF_CLIENT_PAYMENTS_LIST,
  staffPaymentsReadOrAdmin,
  validateRequest({ query: ClientPaymentListQuerySchema }),
  controller.listClientPayments,
);

export { router };
