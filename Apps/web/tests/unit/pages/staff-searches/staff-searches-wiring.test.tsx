import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockStaffSearch, mockStaffSearches } from "../../../fixtures/data/observability.mock";
import { mockUsersPaginated } from "../../../fixtures/data/identity.mock";
import * as useObservabilityHook from "@/hooks/useObservability";
import * as useIdentityHook from "@/hooks/useIdentity";
import AdminStaffSearches from "@/pages/admin/staff-searches/AdminStaffSearches";

vi.mock("@/hooks/useObservability");
vi.mock("@/hooks/useIdentity");

const refetchSearches = vi.fn();

function mockSearches(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(useObservabilityHook.useStaffSearches).mockReturnValue({
    data: mockStaffSearches,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchSearches,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSearches();
  vi.mocked(useIdentityHook.useUsers).mockReturnValue({
    data: mockUsersPaginated,
    isLoading: false,
    isError: false,
  } as never);
});

describe("AdminStaffSearches (ADM-19) wiring", () => {
  it("shows the table skeleton while loading", () => {
    mockSearches({ isLoading: true });
    const { container } = renderWithRoutes(
      { "/admin/activity/staff-searches": <AdminStaffSearches /> },
      "/admin/activity/staff-searches",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the query errors, and retry re-fetches", async () => {
    mockSearches({ isError: true });
    const user = userEvent.setup();
    renderWithRoutes(
      { "/admin/activity/staff-searches": <AdminStaffSearches /> },
      "/admin/activity/staff-searches",
    );

    expect(screen.getByText("admin.staffSearches.error")).toBeInTheDocument();
    await user.click(screen.getByText("common.actions.tryAgain"));
    expect(refetchSearches).toHaveBeenCalled();
  });

  it("renders staff-search rows with a product link from the live hook", () => {
    renderWithRoutes(
      { "/admin/activity/staff-searches": <AdminStaffSearches /> },
      "/admin/activity/staff-searches",
    );
    expect(screen.getAllByText(mockStaffSearch.query).length).toBeGreaterThanOrEqual(1);
    const productLink = screen.getAllByRole("link", {
      name: mockStaffSearch.matchedProduct!.name,
    })[0];
    expect(productLink).toHaveAttribute("href", "/admin/inventory");
  });
});
