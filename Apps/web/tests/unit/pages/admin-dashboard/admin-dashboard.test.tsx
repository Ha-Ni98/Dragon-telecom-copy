import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockAdminDashboard } from "../../../fixtures/data/statistics.mock";
import * as useStatisticsHook from "@/hooks/useStatistics";
import AdminDashboard from "@/pages/admin/dashboard/AdminDashboard";

vi.mock("@/hooks/useStatistics");

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const refetch = vi.fn();

function mockDashboard(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(useStatisticsHook.useAdminDashboard).mockReturnValue({
    data: overrides.isLoading || overrides.isError ? undefined : mockAdminDashboard,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminDashboard (ADM-01)", () => {
  it("shows per-section skeletons while loading, never a full-page blank", () => {
    mockDashboard({ isLoading: true });
    const { container } = renderWithRoutes({ "/admin": <AdminDashboard /> }, "/admin");

    expect(screen.getByText("admin.dashboard.overview")).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders the stat cards with % change and every widget from the one query", () => {
    mockDashboard();
    renderWithRoutes({ "/admin": <AdminDashboard /> }, "/admin");

    // Stats + % change.
    expect(screen.getByText("admin.dashboard.totalClients")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText(/4\.2%/)).toBeInTheDocument();
    // Work queues.
    expect(screen.getByText("orders.pendingOrders")).toBeInTheDocument();
    expect(screen.getByText("admin.dashboard.pendingRegistrations")).toBeInTheDocument();
    expect(
      screen.getAllByText(mockAdminDashboard.pendingOrders[0].reference).length,
    ).toBeGreaterThanOrEqual(1);
    // pendingClients[0] and recentClients[0] are the same fixture person in orders.mock.ts, so
    // this name legitimately renders twice (once per widget).
    expect(
      screen.getAllByText(mockAdminDashboard.pendingClients[0].fullName).length,
    ).toBeGreaterThanOrEqual(2);
    // Recent activity + low stock.
    expect(screen.getByText("admin.dashboard.recentOrders")).toBeInTheDocument();
    expect(screen.getByText("admin.dashboard.recentClients")).toBeInTheDocument();
    expect(screen.getByText(mockAdminDashboard.lowStockProducts[0].name)).toBeInTheDocument();
    // Repairs + draft sales.
    expect(screen.getByText("admin.dashboard.repairsByStatus")).toBeInTheDocument();
    expect(screen.getByText("repairs.status.intake")).toBeInTheDocument();
    expect(screen.getByText("admin.dashboard.draftSalesByStaff")).toBeInTheDocument();
    expect(screen.getByText(mockAdminDashboard.draftSalesByStaff[0].staffName)).toBeInTheDocument();
  });

  it("shows a per-section retry chip on error, with the layout intact", () => {
    mockDashboard({ isError: true });
    renderWithRoutes({ "/admin": <AdminDashboard /> }, "/admin");

    expect(screen.getByText("admin.dashboard.overview")).toBeInTheDocument();
    const retryChips = screen.getAllByText("admin.dashboard.retryChip");
    // Every section that takes isError/onRetry renders its own chip — not one shared banner.
    expect(retryChips.length).toBeGreaterThanOrEqual(2);
  });

  it("retrying a section calls the same refetch", async () => {
    mockDashboard({ isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin": <AdminDashboard /> }, "/admin");

    await user.click(screen.getAllByText("admin.dashboard.retryChip")[0]);
    expect(refetch).toHaveBeenCalled();
  });

  it("a pending-order row navigates to /admin/orders", async () => {
    mockDashboard();
    const user = userEvent.setup();
    renderWithRoutes(
      {
        "/admin": (
          <>
            <AdminDashboard />
            <LocationProbe />
          </>
        ),
        "/admin/orders": <LocationProbe />,
      },
      "/admin",
    );

    await user.click(screen.getAllByText(mockAdminDashboard.pendingOrders[0].reference)[0]);
    expect(await screen.findByTestId("location")).toHaveTextContent("/admin/orders");
  });
});
