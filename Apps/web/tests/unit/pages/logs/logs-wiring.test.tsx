import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockAuditLog,
  mockAuditLogsPaginated,
  mockLogStats,
} from "../../../fixtures/data/observability.mock";
import { mockUsersPaginated } from "../../../fixtures/data/identity.mock";
import * as useObservabilityHook from "@/hooks/useObservability";
import * as useIdentityHook from "@/hooks/useIdentity";
import AdminLogs from "@/pages/admin/logs/AdminLogs";

vi.mock("@/hooks/useObservability");
vi.mock("@/hooks/useIdentity");

const refetchLogs = vi.fn();
const refetchStats = vi.fn();

function mockLogsQuery(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(useObservabilityHook.useLogs).mockReturnValue({
    data: overrides.isError ? undefined : mockAuditLogsPaginated,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchLogs,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLogsQuery();
  vi.mocked(useObservabilityHook.useLogStats).mockReturnValue({
    data: mockLogStats,
    isLoading: false,
    isError: false,
    refetch: refetchStats,
  } as never);
  vi.mocked(useIdentityHook.useUsers).mockReturnValue({
    data: mockUsersPaginated,
    isLoading: false,
    isError: false,
  } as never);
});

describe("AdminLogs (ADM-18) wiring", () => {
  it("shows the table skeleton while loading", () => {
    mockLogsQuery({ isLoading: true });
    const { container } = renderWithRoutes({ "/admin/logs": <AdminLogs /> }, "/admin/logs");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the logs query errors, and retry re-fetches", async () => {
    mockLogsQuery({ isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/logs": <AdminLogs /> }, "/admin/logs");

    expect(screen.getByText("common.retry")).toBeInTheDocument();
    await user.click(screen.getByText("common.retry"));
    expect(refetchLogs).toHaveBeenCalled();
  });

  it("renders log rows and stats from the live hooks, with no mutation UI", () => {
    renderWithRoutes({ "/admin/logs": <AdminLogs /> }, "/admin/logs");

    // DataTable renders desktop + mobile rows simultaneously in jsdom (set-02 note).
    expect(screen.getAllByText(mockAuditLog.description).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(mockLogStats.total.toLocaleString())).toBeInTheDocument();
    expect(
      screen.queryAllByRole("button").filter((b) => b.querySelector("svg.lucide-trash-2")),
    ).toHaveLength(0);
  });

  it("sources the user filter from the real useUsers (identity) hook, not a stub", () => {
    renderWithRoutes({ "/admin/logs": <AdminLogs /> }, "/admin/logs");
    expect(useIdentityHook.useUsers).toHaveBeenCalled();
  });
});
