// Inventory domain — Sub-02, contract-typed, HTTP-wired (integration plan.md §2.4). No Sub-01
// stub existed under this file name or any other — inventory has no MVP UI ported yet, so this
// is genuinely new territory (only use-low-stock-products.ts touches inventory-adjacent data,
// via the dashboard's own stats endpoint, not this module).
import { api } from "@/lib/axios";
import { apiPath } from "@/lib/api-path";
import {
  INVENTORY_ROUTES,
  type ApiResponse,
  type PaginatedResult,
  type StockRowDto,
  type MovementsQuery,
  type MovementDto,
  type ReservationsQuery,
  type ReservationDto,
  type CreateAdjustmentCommand,
  type AdjustmentResultDto,
} from "@dragon-telecom/contract";

// Split from the dual-return backend method (StockRowDto[] | export-Blob) into two functions —
// a query hook can only have one result type, and `export=csv` is a distinct caller intent.
export async function getStock(lowStockOnly?: boolean): Promise<StockRowDto[]> {
  const res = await api.get<ApiResponse<StockRowDto[]>>(apiPath(INVENTORY_ROUTES.STOCK), {
    params: { lowStockOnly },
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Bypasses the envelope entirely (same pattern as platform.service.ts's exportFees — the
// backend's getStock checks `'body' in result` and sends raw Content-Type/Content-Disposition
// instead of calling sendSuccess when `export=csv` is set).
export async function exportStockCsv(): Promise<Blob> {
  const res = await api.get<Blob>(apiPath(INVENTORY_ROUTES.STOCK), {
    params: { export: "csv" },
    responseType: "blob",
  });
  return res.data;
}

export async function listMovements(query: MovementsQuery): Promise<PaginatedResult<MovementDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<MovementDto>>>(
    apiPath(INVENTORY_ROUTES.MOVEMENTS),
    {
      params: query,
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listReservations(
  query: ReservationsQuery,
): Promise<PaginatedResult<ReservationDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<ReservationDto>>>(
    apiPath(INVENTORY_ROUTES.RESERVATIONS),
    {
      params: query,
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createAdjustment(
  command: CreateAdjustmentCommand,
): Promise<AdjustmentResultDto> {
  const res = await api.post<ApiResponse<AdjustmentResultDto>>(
    apiPath(INVENTORY_ROUTES.ADJUSTMENTS),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
