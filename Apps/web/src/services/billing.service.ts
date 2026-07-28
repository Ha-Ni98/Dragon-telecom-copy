// Billing domain (invoices + client-payments) — Sub-02, contract-typed, HTTP-wired (integration
// plan.md §2.12). Tier 5 — no MVP UI consumes this yet; the data layer is built ahead of Sub-03.
// No Sub-01 stub exists under this file name.
import { api } from "@/lib/axios";
import { apiPath, withParams } from "@/lib/api-path";
import {
  BILLING_ROUTES,
  type ApiResponse,
  type PaginatedResult,
  type InvoiceDto,
  type InvoiceListQuery,
  type CancelInvoiceCommand,
  type CreateClientPaymentCommand,
  type ClientPaymentDto,
  type ClientPaymentListQuery,
} from "@dragon-telecom/contract";

// STAFF_*/ADMIN_* dual-mounted pairs for invoices reads + client-payment creation. MY_* (client)
// and CANCEL/CLIENT_PAYMENTS_LIST (admin-only) are single routes with their own functions below.
export type BillingScope = "staff" | "admin";

// Paginated, NOT a bare array as plan.md's own placeholder guessed — InvoiceListQuery carries
// page/limit and getMyInvoices genuinely accepts it (confirmed against billing.interface.ts's
// `getMyInvoices(query, clientId)` signature and billing.routes.ts's MY_INVOICES validation).
export async function getMyInvoices(query: InvoiceListQuery): Promise<PaginatedResult<InvoiceDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<InvoiceDto>>>(
    apiPath(BILLING_ROUTES.MY_INVOICES),
    { params: query },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getMyInvoice(number: string): Promise<InvoiceDto> {
  const res = await api.get<ApiResponse<InvoiceDto>>(
    withParams(apiPath(BILLING_ROUTES.MY_INVOICE_BY_NUMBER), { number }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Bypasses the ApiResponse envelope entirely (backend's PdfResult, streamed directly) — mirrors
// platform's exportFees / statistics' exportReportCsv.
export async function getMyInvoicePdf(number: string): Promise<Blob> {
  const res = await api.get<Blob>(withParams(apiPath(BILLING_ROUTES.MY_INVOICE_PDF), { number }), {
    responseType: "blob",
  });
  return res.data;
}

export async function listInvoices(
  scope: BillingScope,
  query: InvoiceListQuery,
): Promise<PaginatedResult<InvoiceDto>> {
  const route = scope === "admin" ? BILLING_ROUTES.ADMIN_INVOICES : BILLING_ROUTES.STAFF_INVOICES;
  const res = await api.get<ApiResponse<PaginatedResult<InvoiceDto>>>(apiPath(route), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Detail is keyed by `number` (string), not id.
export async function getInvoice(scope: BillingScope, number: string): Promise<InvoiceDto> {
  const route =
    scope === "admin"
      ? BILLING_ROUTES.ADMIN_INVOICE_BY_NUMBER
      : BILLING_ROUTES.STAFF_INVOICE_BY_NUMBER;
  const res = await api.get<ApiResponse<InvoiceDto>>(withParams(apiPath(route), { number }));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getInvoicePdf(scope: BillingScope, number: string): Promise<Blob> {
  const route =
    scope === "admin" ? BILLING_ROUTES.ADMIN_INVOICE_PDF : BILLING_ROUTES.STAFF_INVOICE_PDF;
  const res = await api.get<Blob>(withParams(apiPath(route), { number }), { responseType: "blob" });
  return res.data;
}

// Admin-only, single route.
export async function cancelInvoice(
  number: string,
  command: CancelInvoiceCommand,
): Promise<InvoiceDto> {
  const res = await api.post<ApiResponse<InvoiceDto>>(
    withParams(apiPath(BILLING_ROUTES.CANCEL), { number }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// ADMIN_CLIENT_PAYMENTS and CLIENT_PAYMENTS_LIST share the literal URL `/admin/client-payments`
// (POST vs GET, confirmed against billing.routes.ts) — two service fns below, one route constant
// for the GET side; STAFF_CLIENT_PAYMENTS is its own distinct URL (`/staff/client-payments`).
export async function createClientPayment(
  scope: BillingScope,
  command: CreateClientPaymentCommand,
): Promise<ClientPaymentDto> {
  const route =
    scope === "admin" ? BILLING_ROUTES.ADMIN_CLIENT_PAYMENTS : BILLING_ROUTES.STAFF_CLIENT_PAYMENTS;
  const res = await api.post<ApiResponse<ClientPaymentDto>>(apiPath(route), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// S18 — scoped: backs the POS-clients drawer's Payments tab in both scopes (D-5), and the
// staff invoices page if it ever surfaces payments.
export async function listClientPayments(
  scope: BillingScope,
  query: ClientPaymentListQuery,
): Promise<PaginatedResult<ClientPaymentDto>> {
  const route =
    scope === "admin"
      ? BILLING_ROUTES.ADMIN_CLIENT_PAYMENTS_LIST
      : BILLING_ROUTES.STAFF_CLIENT_PAYMENTS_LIST;
  const res = await api.get<ApiResponse<PaginatedResult<ClientPaymentDto>>>(apiPath(route), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
