import { http, HttpResponse } from "msw";
import { BILLING_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import {
  mockInvoice,
  mockInvoicesPaginated,
  mockClientPayment,
  mockClientPaymentsPaginated,
} from "../data/billing.mock";

const MOCK_PDF = "%PDF-1.4 mock invoice content";

// BILLING_ROUTES are full literal paths, including a `:number` placeholder — msw matches it as a
// path pattern natively. No route-ordering hazard: `:number`-only routes and their `/pdf`/
// `/cancel` siblings differ in segment count, unlike the STATS-before-:id cases in earlier
// sprints. ADMIN_CLIENT_PAYMENTS/CLIENT_PAYMENTS_LIST share one literal URL (POST vs GET,
// confirmed against billing.routes.ts) — same same-URL-different-method pattern as Sprint 6's
// SUPPLIER_BY_ID/SUPPLIER_DETAIL.
export const billingUrls = {
  myInvoices: apiUrl(BILLING_ROUTES.MY_INVOICES),
  myInvoiceByNumber: apiUrl(BILLING_ROUTES.MY_INVOICE_BY_NUMBER),
  myInvoicePdf: apiUrl(BILLING_ROUTES.MY_INVOICE_PDF),
  staffInvoices: apiUrl(BILLING_ROUTES.STAFF_INVOICES),
  staffInvoiceByNumber: apiUrl(BILLING_ROUTES.STAFF_INVOICE_BY_NUMBER),
  staffInvoicePdf: apiUrl(BILLING_ROUTES.STAFF_INVOICE_PDF),
  adminInvoices: apiUrl(BILLING_ROUTES.ADMIN_INVOICES),
  adminInvoiceByNumber: apiUrl(BILLING_ROUTES.ADMIN_INVOICE_BY_NUMBER),
  adminInvoicePdf: apiUrl(BILLING_ROUTES.ADMIN_INVOICE_PDF),
  cancel: apiUrl(BILLING_ROUTES.CANCEL),
  staffClientPayments: apiUrl(BILLING_ROUTES.STAFF_CLIENT_PAYMENTS),
  adminClientPayments: apiUrl(BILLING_ROUTES.ADMIN_CLIENT_PAYMENTS),
  clientPaymentsList: apiUrl(BILLING_ROUTES.CLIENT_PAYMENTS_LIST),
};

const pdfResponse = () =>
  new HttpResponse(MOCK_PDF, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="invoice.pdf"',
    },
  });

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3).
export const billingHandlers = [
  http.get(billingUrls.myInvoices, () => ok(mockInvoicesPaginated)),
  http.get(billingUrls.myInvoiceByNumber, () => ok(mockInvoice)),
  // Deliberately bypasses the ApiResponse envelope (backend: PdfResult, streamed directly).
  http.get(billingUrls.myInvoicePdf, pdfResponse),
  http.get(billingUrls.staffInvoices, () => ok(mockInvoicesPaginated)),
  http.get(billingUrls.staffInvoiceByNumber, () => ok(mockInvoice)),
  http.get(billingUrls.staffInvoicePdf, pdfResponse),
  http.get(billingUrls.adminInvoices, () => ok(mockInvoicesPaginated)),
  http.get(billingUrls.adminInvoiceByNumber, () => ok(mockInvoice)),
  http.get(billingUrls.adminInvoicePdf, pdfResponse),
  http.post(billingUrls.cancel, () => ok(mockInvoice)),
  http.post(billingUrls.staffClientPayments, () => ok(mockClientPayment, 201)),
  http.post(billingUrls.adminClientPayments, () => ok(mockClientPayment, 201)),
  http.get(billingUrls.clientPaymentsList, () => ok(mockClientPaymentsPaginated)),
];

export const billingErrorHandlers = {
  invoiceNotFound: () =>
    http.get(billingUrls.staffInvoiceByNumber, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Invoice not found", 404),
    ),
  cancelConflict: () =>
    http.post(billingUrls.cancel, () =>
      fail(ErrorCode.RESOURCE_CONFLICT, "Invoice already cancelled", 409),
    ),
  createClientPaymentValidationError: () =>
    http.post(billingUrls.staffClientPayments, () =>
      fail(ErrorCode.VALIDATION_ERROR, "amount must be positive", 400),
    ),
};
