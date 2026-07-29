import { http } from "msw";
import { PURCHASING_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import {
  mockSuppliersPaginated,
  mockSupplierDetail,
  mockSupplier,
  mockSupplierStats,
  mockSupplierInvoicesPaginated,
  mockSupplierInvoiceDraft,
  mockConfirmResult,
  mockSupplierPaymentsPaginated,
  mockSupplierPayment,
} from "../data/purchasing.mock";

export const purchasingUrls = {
  suppliers: apiUrl(PURCHASING_ROUTES.SUPPLIERS),
  supplierStats: apiUrl(PURCHASING_ROUTES.SUPPLIER_STATS),
  supplierDetail: apiUrl(PURCHASING_ROUTES.SUPPLIER_DETAIL),
  supplierById: apiUrl(PURCHASING_ROUTES.SUPPLIER_BY_ID),
  invoices: apiUrl(PURCHASING_ROUTES.INVOICES),
  invoiceById: apiUrl(PURCHASING_ROUTES.INVOICE_BY_ID),
  confirm: apiUrl(PURCHASING_ROUTES.CONFIRM),
  cancel: apiUrl(PURCHASING_ROUTES.CANCEL),
  payments: apiUrl(PURCHASING_ROUTES.PAYMENTS),
};

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3).
export const purchasingHandlers = [
  http.get(purchasingUrls.suppliers, () => ok(mockSuppliersPaginated)),
  http.post(purchasingUrls.suppliers, () => ok(mockSupplier, 201)),
  // SUPPLIER_STATS ("/admin/suppliers/stats") registered before SUPPLIER_DETAIL/SUPPLIER_BY_ID
  // ("/admin/suppliers/:id") — mirrors the backend's own route-ordering comment
  // (purchasing.routes.ts), same PRODUCT_STATS/ADMIN_STATS lesson from Sprints 3-4.
  http.get(purchasingUrls.supplierStats, () => ok(mockSupplierStats)),
  http.get(purchasingUrls.supplierDetail, () => ok(mockSupplierDetail)),
  http.patch(purchasingUrls.supplierById, () => ok(mockSupplier)),
  http.get(purchasingUrls.invoices, () => ok(mockSupplierInvoicesPaginated)),
  http.post(purchasingUrls.invoices, () => ok(mockSupplierInvoiceDraft, 201)),
  http.get(purchasingUrls.invoiceById, () => ok(mockSupplierInvoiceDraft)),
  http.patch(purchasingUrls.invoiceById, () => ok(mockSupplierInvoiceDraft)),
  http.post(purchasingUrls.confirm, () => ok(mockConfirmResult)),
  http.post(purchasingUrls.cancel, () => ok(mockSupplierInvoiceDraft)),
  http.get(purchasingUrls.payments, () => ok(mockSupplierPaymentsPaginated)),
  http.post(purchasingUrls.payments, () => ok(mockSupplierPayment, 201)),
];

export const purchasingErrorHandlers = {
  supplierNotFound: () =>
    http.get(purchasingUrls.supplierDetail, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Supplier not found", 404),
    ),
  // amountOnly XOR lines (spec Business Logic #1) — one representative 400.
  createInvoiceValidationError: () =>
    http.post(purchasingUrls.invoices, () =>
      fail(ErrorCode.VALIDATION_ERROR, "Exactly one of amountOnly or lines is required", 400),
    ),
  // PATCH after confirm — a backend guard (409), asserted here for the "DRAFT-only" invariant.
  updateInvoiceConflict: () =>
    http.patch(purchasingUrls.invoiceById, () =>
      fail(ErrorCode.RESOURCE_CONFLICT, "Only DRAFT invoices can be updated", 409),
    ),
  confirmInvoiceConflict: () =>
    http.post(purchasingUrls.confirm, () =>
      fail(ErrorCode.RESOURCE_CONFLICT, "Invoice already confirmed", 409),
    ),
};
