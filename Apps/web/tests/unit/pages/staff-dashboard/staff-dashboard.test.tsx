import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { PageKey } from "@dragon-telecom/contract";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockStaffDashboard } from "../../../fixtures/data/statistics.mock";
import * as useStatisticsHook from "@/hooks/useStatistics";
import * as usePermissionsHook from "@/hooks/usePermissions";
import StaffDashboard from "@/pages/staff/dashboard/StaffDashboard";

vi.mock("@/hooks/useStatistics");
vi.mock("@/hooks/usePermissions");

function mockDashboard(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(useStatisticsHook.useStaffDashboard).mockReturnValue({
    data: overrides.isLoading || overrides.isError ? undefined : mockStaffDashboard,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  } as never);
}

function mockPermissions(pageKeys: PageKey[]) {
  vi.mocked(usePermissionsHook.usePermissions).mockReturnValue({ data: pageKeys } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions([PageKey.STAFF_ORDERS]);
});

describe("StaffDashboard (STF-01)", () => {
  it("shows per-section skeletons while loading, never a full-page blank", () => {
    mockDashboard({ isLoading: true });
    const { container } = renderWithRoutes({ "/staff": <StaffDashboard /> }, "/staff");

    expect(screen.getByText("staff.dashboard.title")).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders sales-today, drafts, pending-orders, and low-stock from the one query", () => {
    mockDashboard();
    renderWithRoutes({ "/staff": <StaffDashboard /> }, "/staff");

    expect(screen.getByText("staff.dashboard.mySalesToday")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(mockStaffDashboard.myDrafts[0].reference)).toBeInTheDocument();
    expect(screen.getByText("orders.pendingOrders")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(mockStaffDashboard.lowStock[0].name)).toBeInTheDocument();
  });

  it("hides the pending-orders widget when the viewer lacks STAFF_ORDERS", () => {
    mockPermissions([]);
    mockDashboard();
    renderWithRoutes({ "/staff": <StaffDashboard /> }, "/staff");
    expect(screen.queryByText("orders.pendingOrders")).not.toBeInTheDocument();
  });

  it("shows the pending-orders widget when the viewer holds STAFF_ORDERS", () => {
    mockPermissions([PageKey.STAFF_ORDERS]);
    mockDashboard();
    renderWithRoutes({ "/staff": <StaffDashboard /> }, "/staff");
    expect(screen.getByText("orders.pendingOrders")).toBeInTheDocument();
  });

  it("silently hides every widget on error while the layout/title stays intact", () => {
    mockDashboard({ isError: true });
    renderWithRoutes({ "/staff": <StaffDashboard /> }, "/staff");

    expect(screen.getByText("staff.dashboard.title")).toBeInTheDocument();
    expect(screen.queryByText("staff.dashboard.mySalesToday")).not.toBeInTheDocument();
    expect(screen.queryByText("staff.dashboard.myDrafts")).not.toBeInTheDocument();
    expect(screen.queryByText("admin.dashboard.lowStockAlert")).not.toBeInTheDocument();
    // No visible error banner/alert anywhere (silent-hide, not a shown error state).
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
