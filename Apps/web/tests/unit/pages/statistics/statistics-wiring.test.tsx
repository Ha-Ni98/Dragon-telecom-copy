import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockOverview,
  mockFiltered,
  mockChartPoints,
  mockTopProducts,
  mockReport,
} from "../../../fixtures/data/statistics.mock";
import { mockFamily } from "../../../fixtures/data/catalog.mock";
import * as useStatisticsHook from "@/hooks/useStatistics";
import * as useCatalogTaxonomyHook from "@/hooks/useCatalogTaxonomy";
import AdminStatistics from "@/pages/admin/statistics/AdminStatistics";

vi.mock("@/hooks/useStatistics");
vi.mock("@/hooks/useCatalogTaxonomy");

const exportCsvMutate = vi.fn();
const refetchTopProducts = vi.fn();
const refetchReport = vi.fn();

function mockOverviewQuery(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(useStatisticsHook.useOverview).mockReturnValue({
    data: overrides.isError ? undefined : mockOverview,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOverviewQuery();
  vi.mocked(useStatisticsHook.useFiltered).mockReturnValue({
    data: mockFiltered,
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useStatisticsHook.useChart).mockReturnValue({
    data: mockChartPoints,
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useStatisticsHook.useTopProducts).mockReturnValue({
    data: mockTopProducts,
    isLoading: false,
    isError: false,
    refetch: refetchTopProducts,
  } as never);
  vi.mocked(useStatisticsHook.useReport).mockReturnValue({
    data: mockReport,
    isLoading: false,
    isError: false,
    refetch: refetchReport,
  } as never);
  vi.mocked(useStatisticsHook.useExportReportCsv).mockReturnValue({
    mutate: exportCsvMutate,
    isPending: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
    data: [mockFamily],
    isLoading: false,
    isError: false,
  } as never);
});

describe("AdminStatistics (ADM-15) wiring", () => {
  it("shows the overview stat-card skeleton while loading", () => {
    mockOverviewQuery({ isLoading: true });
    const { container } = renderWithRoutes(
      { "/admin/statistics": <AdminStatistics /> },
      "/admin/statistics",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("isolates a widget error — the overview card's failure never blanks the top-products widget", () => {
    mockOverviewQuery({ isError: true });
    renderWithRoutes({ "/admin/statistics": <AdminStatistics /> }, "/admin/statistics");

    expect(screen.getByText("admin.statistics.error")).toBeInTheDocument();
    expect(screen.getAllByText(mockTopProducts[0].productName).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the report picker's rows from the live useReport hook", () => {
    renderWithRoutes({ "/admin/statistics": <AdminStatistics /> }, "/admin/statistics");
    // DataTable renders desktop + mobile rows simultaneously in jsdom (set-02 note).
    expect(
      screen.getAllByText(String(mockReport.rows[0].quantitySold)).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("exports the current report as CSV via the live mutation", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/statistics": <AdminStatistics /> }, "/admin/statistics");

    await user.click(screen.getByText("admin.statistics.reports.exportCsv"));
    expect(exportCsvMutate).toHaveBeenCalled();
  });
});
