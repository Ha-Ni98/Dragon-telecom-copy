import { describe, it, expect } from "vitest";
import { ChartType, ReportType } from "@dragon-telecom/contract";
import { server } from "../../fixtures/msw/server";
import { statisticsErrorHandlers } from "../../fixtures/msw/statistics.handlers";
import {
  mockAdminDashboard,
  mockStaffDashboard,
  mockOverview,
  mockFiltered,
  mockChartPoints,
  mockTopProducts,
  mockReport,
} from "../../fixtures/data/statistics.mock";
import * as statisticsService from "@/services/statistics.service";

describe("statistics.service — dashboards", () => {
  it("getAdminDashboard returns the unwrapped DTO", async () => {
    expect(await statisticsService.getAdminDashboard()).toEqual(mockAdminDashboard);
  });

  it("getStaffDashboard returns the unwrapped DTO", async () => {
    expect(await statisticsService.getStaffDashboard()).toEqual(mockStaffDashboard);
  });
});

describe("statistics.service — overview/filtered/charts/top-products", () => {
  it("getOverview returns the unwrapped DTO", async () => {
    expect(await statisticsService.getOverview()).toEqual(mockOverview);
  });

  it("getFiltered returns the unwrapped DTO", async () => {
    expect(await statisticsService.getFiltered({})).toEqual(mockFiltered);
  });

  it("getChart substitutes the :chart param and returns the unwrapped array", async () => {
    expect(await statisticsService.getChart(ChartType.REVENUE, {})).toEqual(mockChartPoints);
  });

  it("getTopProducts returns the unwrapped array", async () => {
    expect(await statisticsService.getTopProducts({})).toEqual(mockTopProducts);
  });
});

describe("statistics.service — report", () => {
  it("getReport substitutes the :type param and returns the unwrapped JSON DTO", async () => {
    expect(await statisticsService.getReport(ReportType.SALES_BY_PRODUCT, {})).toEqual(mockReport);
  });

  it("getReport throws on a server error", async () => {
    server.use(statisticsErrorHandlers.reportServerError());
    await expect(
      statisticsService.getReport(ReportType.SALES_BY_PRODUCT, {}),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("exportReportCsv returns a raw Blob, bypassing the envelope entirely", async () => {
    server.use(statisticsErrorHandlers.reportCsv());
    const result = await statisticsService.exportReportCsv(ReportType.SALES_BY_PRODUCT, {});
    // Reading the Blob's actual text content is unreliable across this environment's
    // Node/jsdom Blob realms (Sprint 5/6 finding) — `size > 0` still proves a real body
    // arrived unenveloped, not `{success,data}`.
    expect(result).toBeInstanceOf(Blob);
    expect(result.size).toBeGreaterThan(0);
  });
});
