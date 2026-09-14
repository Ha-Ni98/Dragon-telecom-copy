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
  type StockQuery,
  type MovementsQuery,
  type MovementDto,
  type ReservationsQuery,
  type ReservationDto,
  type CreateAdjustmentCommand,
  type AdjustmentResultDto,
} from "@dragon-telecom/contract";

// Split from the dual-return backend method (paginated rows | export-Blob) into two functions —
// a query hook can only have one result type, and `export=csv|pdf` is a distinct caller intent.
// S28 — `getStock` is now paginated server-side, so it returns PaginatedResult<StockRowDto>
// instead of a bare array; `StockListQuery` is the contract query minus `export`, and `page` /
// `limit` are required because StockQuerySchema gives them `.default()`s.
export type StockListQuery = Omit<StockQuery, "export">;

export async function getStock(query: StockListQuery): Promise<PaginatedResult<StockRowDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<StockRowDto>>>(
    apiPath(INVENTORY_ROUTES.STOCK),
    {
      params: {
        lowStockOnly: query.lowStockOnly,
        search: query.search,
        page: query.page,
        limit: query.limit,
      },
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Bypasses the envelope entirely (same pattern as platform.service.ts's exportFees — the
// backend's getStock checks `'body' in result` and sends raw Content-Type/Content-Disposition
// instead of calling sendSuccess when `export` is set).
//
// S25 — mirrors the table's own filters (search/lowStockOnly) instead of always sending none.
// The old "sends no filters" behaviour was a real defect the S25 audit found: an admin filtered
// to "low stock only" and clicking Export got the whole catalogue regardless.
// S28 — `page`/`limit` are stripped: the export is the whole filtered stock table, never the page
// on screen, exactly like exportMovements below.
export async function exportStock(
  query: Omit<StockQuery, "export" | "page" | "limit">,
  format: "csv" | "pdf",
): Promise<Blob> {
  const res = await api.get<Blob>(apiPath(INVENTORY_ROUTES.STOCK), {
    params: { lowStockOnly: query.lowStockOnly, search: query.search, export: format },
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

// Bypasses the envelope (backend streams the body directly) — same pattern as exportStock above.
// `page`/`limit` are stripped: the export is the whole filtered ledger, never the page on screen
// (S25 — no export of any kind existed here before this set).
export async function exportMovements(
  query: Omit<MovementsQuery, "export" | "page" | "limit">,
  format: "csv" | "pdf",
): Promise<Blob> {
  const res = await api.get<Blob>(apiPath(INVENTORY_ROUTES.MOVEMENTS), {
    params: { ...query, export: format },
    responseType: "blob",
  });
  return res.data;
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
