// Purchasing domain (suppliers/supplier-invoices/payments) — Sub-02, contract-typed, HTTP-wired
// (integration plan.md §2.7). No same-named Sub-01 stub existed (the pre-existing
// `admin-suppliers.service.ts`/`supplier-information.service.ts` classes, consumed by
// AdminSuppliers.tsx/AdminSupplierInformation.tsx via use-admin-suppliers.ts/
// use-supplier-information.ts, stay untouched until Sub-03 — same "new file, old stub
// coexists" pattern as platform.service.ts in Sprint 5). Every new hook is prefixed
// usePurchasingX specifically to avoid the 15 pre-existing exports across those two stub hook
// files (useCreateSupplier/useUpdateSupplier/useSupplierById/useSupplierDetails/etc.).
import { api } from "@/lib/axios";
import { apiPath, withParams } from "@/lib/api-path";
import { normalizeEmptyStrings } from "@/lib/validation/normlize-command";
import {
  PURCHASING_ROUTES,
  type ApiResponse,
  type PaginatedResult,
  type SupplierListQuery,
  type SupplierDto,
  type SupplierStatsDto,
  type SupplierDetailDto,
  type CreateSupplierCommand,
  type UpdateSupplierCommand,
  type SupplierInvoiceListQuery,
  type SupplierInvoiceDto,
  type CreateSupplierInvoiceCommand,
  type UpdateSupplierInvoiceCommand,
  type ConfirmResultDto,
  type CancelSupplierInvoiceCommand,
  type SupplierPaymentListQuery,
  type SupplierPaymentDto,
  type CreateSupplierPaymentCommand,
} from "@dragon-telecom/contract";

// --- Suppliers ---

export async function listSuppliers(
  query: SupplierListQuery,
): Promise<PaginatedResult<SupplierDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<SupplierDto>>>(
    apiPath(PURCHASING_ROUTES.SUPPLIERS),
    {
      params: query,
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function supplierStats(): Promise<SupplierStatsDto> {
  const res = await api.get<ApiResponse<SupplierStatsDto>>(
    apiPath(PURCHASING_ROUTES.SUPPLIER_STATS),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// SUPPLIER_DETAIL and SUPPLIER_BY_ID resolve to the identical literal path
// ("/admin/suppliers/:id") — two contract route constants for the same URL, split by HTTP verb
// (GET vs PATCH) for readability in the backend router. Either works; used per-operation here.
export async function getSupplier(id: string): Promise<SupplierDetailDto> {
  const res = await api.get<ApiResponse<SupplierDetailDto>>(
    withParams(apiPath(PURCHASING_ROUTES.SUPPLIER_DETAIL), { id }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createSupplier(command: CreateSupplierCommand): Promise<SupplierDto> {
  const res = await api.post<ApiResponse<SupplierDto>>(
    apiPath(PURCHASING_ROUTES.SUPPLIERS),
    normalizeEmptyStrings(command),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateSupplier(
  id: string,
  command: UpdateSupplierCommand,
): Promise<SupplierDto> {
  const res = await api.patch<ApiResponse<SupplierDto>>(
    withParams(apiPath(PURCHASING_ROUTES.SUPPLIER_BY_ID), { id }),
    normalizeEmptyStrings(command),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// --- Supplier invoices ---

export async function listSupplierInvoices(
  query: SupplierInvoiceListQuery,
): Promise<PaginatedResult<SupplierInvoiceDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<SupplierInvoiceDto>>>(
    apiPath(PURCHASING_ROUTES.INVOICES),
    {
      params: query,
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getSupplierInvoice(id: string): Promise<SupplierInvoiceDto> {
  const res = await api.get<ApiResponse<SupplierInvoiceDto>>(
    withParams(apiPath(PURCHASING_ROUTES.INVOICE_BY_ID), { id }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createSupplierInvoice(
  command: CreateSupplierInvoiceCommand,
): Promise<SupplierInvoiceDto> {
  const res = await api.post<ApiResponse<SupplierInvoiceDto>>(
    apiPath(PURCHASING_ROUTES.INVOICES),
    normalizeEmptyStrings(command),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateSupplierInvoice(
  id: string,
  command: UpdateSupplierInvoiceCommand,
): Promise<SupplierInvoiceDto> {
  const res = await api.patch<ApiResponse<SupplierInvoiceDto>>(
    withParams(apiPath(PURCHASING_ROUTES.INVOICE_BY_ID), { id }),
    normalizeEmptyStrings(command),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// No command body — confirmed against purchasing.routes.ts (CONFIRM validates only
// SupplierInvoiceIdParamsSchema); staffId is injected server-side from the auth token.
export async function confirmSupplierInvoice(id: string): Promise<ConfirmResultDto> {
  const res = await api.post<ApiResponse<ConfirmResultDto>>(
    withParams(apiPath(PURCHASING_ROUTES.CONFIRM), { id }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function cancelSupplierInvoice(
  id: string,
  command: CancelSupplierInvoiceCommand,
): Promise<SupplierInvoiceDto> {
  const res = await api.post<ApiResponse<SupplierInvoiceDto>>(
    withParams(apiPath(PURCHASING_ROUTES.CANCEL), { id }),
    normalizeEmptyStrings(command),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// --- Payments (admin ledger) ---

export async function listSupplierPayments(
  query: SupplierPaymentListQuery,
): Promise<PaginatedResult<SupplierPaymentDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<SupplierPaymentDto>>>(
    apiPath(PURCHASING_ROUTES.PAYMENTS),
    {
      params: query,
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createSupplierPayment(
  command: CreateSupplierPaymentCommand,
): Promise<SupplierPaymentDto> {
  const res = await api.post<ApiResponse<SupplierPaymentDto>>(
    apiPath(PURCHASING_ROUTES.PAYMENTS),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
