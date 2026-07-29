import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { ChartType, ReportType } from "@dragon-telecom/contract";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  mockAdminDashboard,
  mockStaffDashboard,
  mockOverview,
  mockFiltered,
  mockChartPoints,
  mockTopProducts,
  mockReport,
} from "../../fixtures/data/statistics.mock";
import {
  useAdminDashboard,
  useStaffDashboard,
  useOverview,
  useFiltered,
  useChart,
  useTopProducts,
  useReport,
  useExportReportCsv,
} from "@/hooks/useStatistics";

describe("dashboards", () => {
  it("useAdminDashboard resolves the admin dashboard DTO", async () => {
    const { result } = renderHook(() => useAdminDashboard(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAdminDashboard);
  });

  it("useStaffDashboard resolves the staff dashboard DTO", async () => {
    const { result } = renderHook(() => useStaffDashboard(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStaffDashboard);
  });
});

describe("overview / filtered / charts / top products", () => {
  it("useOverview resolves the overview DTO", async () => {
    const { result } = renderHook(() => useOverview(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockOverview);
  });

  it("useFiltered resolves the filtered DTO", async () => {
    const { result } = renderHook(() => useFiltered({}), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockFiltered);
  });

  it("useChart resolves the chart points for a given chart type", async () => {
    const { result } = renderHook(() => useChart(ChartType.REVENUE, {}), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockChartPoints);
  });

  it("useTopProducts resolves the top-products list", async () => {
    const { result } = renderHook(() => useTopProducts({}), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTopProducts);
  });
});

describe("useReport / useExportReportCsv", () => {
  it("useReport resolves the JSON report DTO", async () => {
    const { result } = renderHook(() => useReport(ReportType.SALES_BY_PRODUCT, {}), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockReport);
  });

  it("useExportReportCsv is imperative and resolves a Blob", async () => {
    const { result } = renderHook(() => useExportReportCsv(), { wrapper: createQueryWrapper() });
    result.current.mutate({ type: ReportType.SALES_BY_PRODUCT, query: {} });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeInstanceOf(Blob);
  });
});
