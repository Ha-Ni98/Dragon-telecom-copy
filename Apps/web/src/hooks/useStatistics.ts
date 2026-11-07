import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ReportFormat,
  type FilteredQuery,
  type ChartsQuery,
  type ChartType,
  type TopProductsQuery,
  type ReportQuery,
  type ReportType,
  type CashRegisterQuery,
  type CashRegisterDocumentsQuery,
} from "@dragon-telecom/contract";
import * as statisticsService from "@/services/statistics.service";
import { qk } from "@/lib/query-keys";

// Names distinct from use-dashboard-stats.ts / use-dashboard-data.ts / use-admin-statistics.ts
// (useDashboardStats/useDashboardSummary/useDashboardData/useRefreshDashboardData/
// useAdminStatisticsOverview/useAdminStatisticsFiltered/useAdminStatistics/…), the pre-existing
// Sub-01 stub surfaces still serving AdminDashboard.tsx/AdminStatistics.tsx until Sub-03.
//
// Dashboards/stats are read-only (no command file at all) — no invalidation is authored on any
// hook here; they get swept by `qk.stats.all()` from upstream mutations elsewhere (plan §3 cross-
// domain invalidation matrix).

export function useAdminDashboard() {
  return useQuery({
    queryKey: qk.stats.adminDashboard(),
    queryFn: statisticsService.getAdminDashboard,
  });
}

// Strictly the caller's own dashboard (staffId=me, server-derived) — no id param.
export function useStaffDashboard() {
  return useQuery({
    queryKey: qk.stats.staffDashboard(),
    queryFn: statisticsService.getStaffDashboard,
  });
}

export function useOverview() {
  return useQuery({
    queryKey: qk.stats.overview(),
    queryFn: statisticsService.getOverview,
  });
}

export function useFiltered(query: FilteredQuery) {
  return useQuery({
    queryKey: qk.stats.filtered(query),
    queryFn: () => statisticsService.getFiltered(query),
  });
}

export function useChart(chart: ChartType, query: ChartsQuery) {
  return useQuery({
    queryKey: qk.stats.chart(chart, query),
    queryFn: () => statisticsService.getChart(chart, query),
  });
}

export function useTopProducts(query: TopProductsQuery) {
  return useQuery({
    queryKey: qk.stats.topProducts(query),
    queryFn: () => statisticsService.getTopProducts(query),
  });
}

export function useReport(type: ReportType, query: ReportQuery) {
  return useQuery({
    queryKey: qk.stats.report(type, query),
    queryFn: () => statisticsService.getReport(type, query),
  });
}

// Imperative (triggers a file download) rather than a query — exportReport returns a Blob, not
// cacheable domain data. Mirrors useExportAdminDeliveryFees (usePlatform.ts).
export function useExportReport() {
  return useMutation({
    mutationFn: ({
      type,
      query,
      format,
    }: {
      type: ReportType;
      query: Omit<ReportQuery, "format">;
      format: ReportFormat.CSV | ReportFormat.PDF;
    }) => statisticsService.exportReport(type, query, format),
  });
}

// S33 — staleTime 0: repairs, supplier invoices and supplier payments don't invalidate
// qk.stats.all() (S33/F4), so the Caisse refetches every time it is opened.
export function useCashRegister(query: CashRegisterQuery) {
  return useQuery({
    queryKey: qk.stats.cashRegister(query),
    queryFn: () => statisticsService.getCashRegister(query),
    staleTime: 0,
  });
}

export function useCashRegisterDocuments(
  query: CashRegisterDocumentsQuery,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: qk.stats.cashRegisterDocuments(query),
    queryFn: () => statisticsService.getCashRegisterDocuments(query),
    enabled: options?.enabled,
    staleTime: 0,
  });
}

// S35 — the staff dashboard's cash register; staleTime 0 like the admin Caisse (S33/F4).
export function useStaffCashRegister() {
  return useQuery({
    queryKey: qk.stats.staffCashRegister(),
    queryFn: statisticsService.getStaffCashRegister,
    staleTime: 0,
  });
}
