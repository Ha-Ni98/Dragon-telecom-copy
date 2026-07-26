// Sales/POS domain (drafts/confirm/returns) — Sub-02, contract-typed, HTTP-wired (integration
// plan.md §2.10). Tier 5 — no MVP UI consumes this yet; the data layer is built ahead of Sub-03.
// No Sub-01 stub exists under this file name.
import { api } from "@/lib/axios";
import { apiPath, withParams } from "@/lib/api-path";
import {
  SALE_ROUTES,
  type ApiResponse,
  type PaginatedResult,
  type SaleDraftCommand,
  type UpdateSaleDraftCommand,
  type ConfirmSaleCommand,
  type SaleDto,
  type ReceiptDto,
  type SaleListQuery,
  type CreateReturnCommand,
} from "@dragon-telecom/contract";

// CREATE_DRAFT/UPDATE_DRAFT/CONFIRM/RETURN are single (non-dual-mounted) routes — only
// STAFF_LIST/ADMIN_LIST and STAFF_DETAIL/ADMIN_DETAIL are actually STAFF_*/ADMIN_* pairs
// (confirmed against sales.routes.ts; the plan's "STAFF_*/ADMIN_* dual-mounted pairs" note
// applies to those two families only, not every route in this domain).
export type SalesScope = "staff" | "admin";

export async function createDraft(command: SaleDraftCommand): Promise<SaleDto> {
  const res = await api.post<ApiResponse<SaleDto>>(apiPath(SALE_ROUTES.CREATE_DRAFT), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateDraft(id: string, command: UpdateSaleDraftCommand): Promise<SaleDto> {
  const res = await api.patch<ApiResponse<SaleDto>>(
    withParams(apiPath(SALE_ROUTES.UPDATE_DRAFT), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// 204, no body — the draft row is gone, there is nothing to map back.
export async function deleteDraft(id: string): Promise<void> {
  await api.delete(withParams(apiPath(SALE_ROUTES.DELETE_DRAFT), { id }));
}

// Returns a ReceiptDto (customer-facing, cost/profit-free) — a different shape from SaleDto,
// which getSale/listSales return.
export async function confirmSale(id: string, command: ConfirmSaleCommand): Promise<ReceiptDto> {
  const res = await api.post<ApiResponse<ReceiptDto>>(
    withParams(apiPath(SALE_ROUTES.CONFIRM), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listSales(
  scope: SalesScope,
  query: SaleListQuery,
): Promise<PaginatedResult<SaleDto>> {
  const route = scope === "admin" ? SALE_ROUTES.ADMIN_LIST : SALE_ROUTES.STAFF_LIST;
  const res = await api.get<ApiResponse<PaginatedResult<SaleDto>>>(apiPath(route), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Detail is keyed by `reference` (string), not id.
export async function getSale(scope: SalesScope, reference: string): Promise<SaleDto> {
  const route = scope === "admin" ? SALE_ROUTES.ADMIN_DETAIL : SALE_ROUTES.STAFF_DETAIL;
  const res = await api.get<ApiResponse<SaleDto>>(withParams(apiPath(route), { reference }));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Admin-only, single route (no :id/:reference param — CreateReturnCommand carries its own
// `saleId`, confirmed against sales.routes.ts: RETURN is the bare `/admin/returns`).
export async function createReturn(command: CreateReturnCommand): Promise<SaleDto> {
  const res = await api.post<ApiResponse<SaleDto>>(apiPath(SALE_ROUTES.RETURN), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
