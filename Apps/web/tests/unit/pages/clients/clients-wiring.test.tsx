import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockAdminClientPending,
  mockAdminClientsPaginated,
  mockClientStats,
} from "../../../fixtures/data/clients.mock";
import * as useClientDirectoryHook from "@/hooks/useClientDirectory";
import AdminClients from "@/pages/admin/clients/AdminClients";

vi.mock("@/hooks/useClientDirectory");

const refetchClients = vi.fn();
const refetchStats = vi.fn();
const updateMutate = vi.fn();

function mockClients(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(useClientDirectoryHook.useClientDirectory).mockReturnValue({
    data: mockAdminClientsPaginated,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchClients,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClients();
  vi.mocked(useClientDirectoryHook.useClientDirectoryStats).mockReturnValue({
    data: mockClientStats,
    isLoading: false,
    isError: false,
    refetch: refetchStats,
  } as never);
  vi.mocked(useClientDirectoryHook.useUpdateClientDirectoryEntry).mockReturnValue({
    mutateAsync: updateMutate,
    isPending: false,
  } as never);
});

describe("AdminClients (ADM-12 list) wiring", () => {
  it("shows the table skeleton while loading", () => {
    mockClients({ isLoading: true });
    const { container } = renderWithRoutes(
      { "/admin/clients": <AdminClients /> },
      "/admin/clients",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the list query errors, and retry re-fetches", async () => {
    mockClients({ isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/clients": <AdminClients /> }, "/admin/clients");

    expect(screen.getByText("admin.clients.error")).toBeInTheDocument();
    await user.click(screen.getByText("common.retry"));
    expect(refetchClients).toHaveBeenCalled();
  });

  it("renders client rows from the live hook", () => {
    renderWithRoutes({ "/admin/clients": <AdminClients /> }, "/admin/clients");
    expect(screen.getAllByText(mockAdminClientPending.fullName).length).toBeGreaterThanOrEqual(1);
  });

  it("opens the modify dialog with the real client's data and saves via the live mutation", async () => {
    updateMutate.mockResolvedValue(mockAdminClientPending);
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/clients": <AdminClients /> }, "/admin/clients");

    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-square-pen, svg.lucide-edit"));
    await user.click(editButtons[0]);

    // Regression: Sprint 3 scaffold's handleEdit never set selectedClient, so this dialog title
    // (which renders the real client's name) could never have appeared.
    expect(screen.getByText("admin.clients.modifyDialog.title")).toBeInTheDocument();

    await user.click(screen.getByText("common.save"));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
  });
});
