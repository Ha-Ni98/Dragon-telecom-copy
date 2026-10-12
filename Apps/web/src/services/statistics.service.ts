// Statistics domain (dashboards/overview/filtered/charts/top-products/reports) — Sub-02,
// contract-typed, HTTP-wired (integration plan.md §2.8). No Sub-01 stub existed under this file
// name; the pre-existing `dashboard.service.ts`/`admin-statistics.service.ts` stay untouched —
// real page rewiring is Sub-03. All routes are reads (no command file at all).
import { api } from "@/lib/axios";
import { apiPath, withParams } from "@/lib/api-path";
import {
  STATS_ROUTES,
  ReportFormat,
  type ApiResponse,
  type CashRegisterDocumentDto,
  type CashRegisterDocumentsQuery,
  type CashRegisterDto,
  type CashRegisterQuery,
  type PaginatedResult,
  type AdminDashboardDto,
  type StaffDashboardDto,
  type OverviewDto,
  type FilteredDto,
  type FilteredQuery,
  type ChartsQuery,
  type ChartType,
  type TopProductsQuery,
  type ReportDto,
  type ReportQuery,
  type ReportType,
} from "@dragon-telecom/contract";

// CHARTS has no dedicated contract response schema — it reuses ReportDto.chart's own
// {label,value}[] item shape (Apps/api's statistics.mapper.ts ChartPoint, extracted the same
// way from ReportResponseSchema.shape.chart). Derived from ReportDto rather than redeclared.
export type ChartPoint = ReportDto["chart"][number];

// TOP_PRODUCTS has no response shape at all in the contract (not even an informal field list) —
// a locally-declared type mirroring Apps/api's own non-contract TopProductResponseSchema
// (statistics.mapper.ts), same "fill a genuine gap without touching the frozen contract"
// precedent as orders' AdminCancelOrderCommand / platform's ImportFeesResult.
export type TopProductDto = {
  productId: string;
  productName: string;
  brandName: string;
  familyName: string;
  quantitySold: number;
  revenue: number;
  averagePrice: number;
  imageUrl?: string;
};

export async function getAdminDashboard(): Promise<AdminDashboardDto> {
  const res = await api.get<ApiResponse<AdminDashboardDto>>(apiPath(STATS_ROUTES.ADMIN_DASHBOARD));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Strictly staffId=me server-side (spec BL#5) — never a query param.
export async function getStaffDashboard(): Promise<StaffDashboardDto> {
  const res = await api.get<ApiResponse<StaffDashboardDto>>(apiPath(STATS_ROUTES.STAFF_DASHBOARD));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getOverview(): Promise<OverviewDto> {
  const res = await api.get<ApiResponse<OverviewDto>>(apiPath(STATS_ROUTES.OVERVIEW));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getFiltered(query: FilteredQuery): Promise<FilteredDto> {
  const res = await api.get<ApiResponse<FilteredDto>>(apiPath(STATS_ROUTES.FILTERED), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getChart(chart: ChartType, query: ChartsQuery): Promise<ChartPoint[]> {
  const res = await api.get<ApiResponse<ChartPoint[]>>(
    withParams(apiPath(STATS_ROUTES.CHARTS), { chart }),
    { params: query },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getTopProducts(query: TopProductsQuery): Promise<TopProductDto[]> {
  const res = await api.get<ApiResponse<TopProductDto[]>>(apiPath(STATS_ROUTES.TOP_PRODUCTS), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// JSON branch (format unset or "table") — dual-return split, matching platform's
// getStock/exportStockCsv precedent: a query hook can only have one result type, so the
// format=csv branch is a separate function below (exportReportCsv) that bypasses the envelope.
export async function getReport(type: ReportType, query: ReportQuery): Promise<ReportDto> {
  const res = await api.get<ApiResponse<ReportDto>>(
    withParams(apiPath(STATS_ROUTES.REPORT), { type }),
    { params: query },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Binary/text download (format=csv|pdf) — deliberately bypasses the ApiResponse envelope (backend
// controller: streams a Buffer/string body instead), mirrors platform's exportFees. S25 added the
// `pdf` format alongside `csv`.
export async function exportReport(
  type: ReportType,
  query: Omit<ReportQuery, "format">,
  format: ReportFormat.CSV | ReportFormat.PDF,
): Promise<Blob> {
  const res = await api.get<Blob>(withParams(apiPath(STATS_ROUTES.REPORT), { type }), {
    params: { ...query, format },
    responseType: "blob",
  });
  return res.data;
}

// S33 — the Caisse: one Africa/Algiers day's summary, and the documents behind one figure.
export async function getCashRegister(query: CashRegisterQuery): Promise<CashRegisterDto> {
  const res = await api.get<ApiResponse<CashRegisterDto>>(apiPath(STATS_ROUTES.CASH_REGISTER), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getCashRegisterDocuments(
  query: CashRegisterDocumentsQuery,
): Promise<PaginatedResult<CashRegisterDocumentDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<CashRegisterDocumentDto>>>(
    apiPath(STATS_ROUTES.CASH_REGISTER_DOCUMENTS),
    { params: query },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
