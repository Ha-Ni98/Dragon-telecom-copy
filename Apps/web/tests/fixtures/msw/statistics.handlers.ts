import { http, HttpResponse } from "msw";
import { STATS_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import {
  mockAdminDashboard,
  mockStaffDashboard,
  mockOverview,
  mockFiltered,
  mockChartPoints,
  mockTopProducts,
  mockReport,
} from "../data/statistics.mock";

// STATS_ROUTES are full literal paths, including `:chart`/`:type` placeholders — msw matches
// those as path patterns natively (same builder as services, test-rules §3). CHARTS/REPORT each
// live under their own distinct static prefix (`/admin/statistics/charts/*`, `/admin/reports/*`)
// so there is no `:id`-pattern greedy-match hazard like Sprints 3-6's *_STATS/*_BY_ID ordering.
export const statisticsUrls = {
  adminDashboard: apiUrl(STATS_ROUTES.ADMIN_DASHBOARD),
  staffDashboard: apiUrl(STATS_ROUTES.STAFF_DASHBOARD),
  overview: apiUrl(STATS_ROUTES.OVERVIEW),
  filtered: apiUrl(STATS_ROUTES.FILTERED),
  charts: apiUrl(STATS_ROUTES.CHARTS),
  topProducts: apiUrl(STATS_ROUTES.TOP_PRODUCTS),
  report: apiUrl(STATS_ROUTES.REPORT),
};

const MOCK_REPORT_CSV = "label,value\n2026-01,10000\n";

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3).
export const statisticsHandlers = [
  http.get(statisticsUrls.adminDashboard, () => ok(mockAdminDashboard)),
  http.get(statisticsUrls.staffDashboard, () => ok(mockStaffDashboard)),
  http.get(statisticsUrls.overview, () => ok(mockOverview)),
  http.get(statisticsUrls.filtered, () => ok(mockFiltered)),
  http.get(statisticsUrls.charts, () => ok(mockChartPoints)),
  http.get(statisticsUrls.topProducts, () => ok(mockTopProducts)),
  // JSON branch by default; exportReportCsv's tests override with `?format=csv` via a
  // dedicated handler below (msw matches on path, not query, so the query param itself is
  // inert here — the CSV branch is exercised by the query.exportCsv test using a `server.use()`
  // override, mirroring platform's exportFees precedent).
  http.get(statisticsUrls.report, () => ok(mockReport)),
];

export const statisticsErrorHandlers = {
  reportServerError: () =>
    http.get(statisticsUrls.report, () =>
      fail(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to generate report", 500),
    ),
  // Deliberately bypasses the ApiResponse envelope (backend controller: streams a Buffer/string
  // body instead), mirrors platform's feesExport CSV handler.
  reportCsv: () =>
    http.get(
      statisticsUrls.report,
      () =>
        new HttpResponse(MOCK_REPORT_CSV, {
          status: 200,
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="report.csv"',
          },
        }),
    ),
};
