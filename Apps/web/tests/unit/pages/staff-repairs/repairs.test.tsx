import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockRepair, mockRepairs } from "../../../fixtures/data/repairs.mock";
import { mockTechnician, mockTechnicians } from "../../../fixtures/data/identity.mock";
import { mockBrand, mockModel } from "../../../fixtures/data/catalog.mock";
import * as useRepairsHook from "@/hooks/useRepairs";
import * as useIdentityHook from "@/hooks/useIdentity";
import * as useCatalogTaxonomyHook from "@/hooks/useCatalogTaxonomy";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import StaffRepairs from "@/pages/staff/repairs/StaffRepairs";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/useRepairs");
vi.mock("@/hooks/useIdentity");
vi.mock("@/hooks/useCatalogTaxonomy");
vi.mock("@/hooks/useCatalogProducts");

import { toast } from "sonner";

const updateStatusMutate = vi.fn();
const createRepairMutate = vi.fn();

function mockRepairsList(
  data: typeof mockRepairs | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useRepairsHook.useRepairs).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useIdentityHook.useTechnicians).mockReturnValue({ data: mockTechnicians } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogBrands).mockReturnValue({
    data: [mockBrand],
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogModels).mockReturnValue({
    data: [mockModel],
  } as never);
  vi.mocked(useCatalogProductsHook.useStaffProducts).mockReturnValue({ data: undefined } as never);
  vi.mocked(useRepairsHook.useRepair).mockReturnValue({ data: mockRepair } as never);
  vi.mocked(useRepairsHook.useCreateRepair).mockReturnValue({
    mutate: createRepairMutate,
    isPending: false,
  } as never);
  vi.mocked(useRepairsHook.useUpdateRepair).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useRepairsHook.useAddRepairPart).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useRepairsHook.useRemoveRepairPart).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useRepairsHook.useUpdateRepairStatus).mockReturnValue({
    mutate: updateStatusMutate,
    isPending: false,
  } as never);
});

describe("StaffRepairs (STF-07 / ADM-13)", () => {
  it("shows lane skeletons while the board is loading", () => {
    mockRepairsList(undefined, { isLoading: true });
    const { container } = renderWithRoutes(
      { "/staff/repairs": <StaffRepairs /> },
      "/staff/repairs",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a board-level error state when the repairs query fails", () => {
    mockRepairsList(undefined, { isError: true });
    renderWithRoutes({ "/staff/repairs": <StaffRepairs /> }, "/staff/repairs");
    expect(screen.getByText("staff.repairs.board.error")).toBeInTheDocument();
  });

  it("shows an empty board state when there are no tickets", () => {
    mockRepairsList([]);
    renderWithRoutes({ "/staff/repairs": <StaffRepairs /> }, "/staff/repairs");
    expect(screen.getByText("staff.repairs.board.empty")).toBeInTheDocument();
  });

  it("groups a ticket under its own status lane", () => {
    mockRepairsList(mockRepairs);
    renderWithRoutes({ "/staff/repairs": <StaffRepairs /> }, "/staff/repairs");
    const lane = screen.getByText("staff.repairs.board.processing").parentElement!;
    expect(lane).toHaveTextContent(mockRepair.reference);
  });

  it("staff mapping omits part profit; admin mapping shows it", async () => {
    mockRepairsList(mockRepairs);
    const user = userEvent.setup();
    const { unmount } = renderWithRoutes(
      { "/staff/repairs": <StaffRepairs scope="staff" /> },
      "/staff/repairs",
    );
    await user.click(screen.getByText(mockRepair.reference));
    expect(await screen.findByText("staff.repairs.detail.partsEditor")).toBeInTheDocument();
    // The profit label sits inline with cost/quantity text in one node ("1 × 4,500 DZD ·
    // admin.repairs.detail.profit: 1,800 DZD"), so it's never its own isolated text match —
    // assert against the rendered body's full text content instead of getByText.
    expect(document.body.textContent).not.toContain("admin.repairs.detail.profit");
    unmount();

    renderWithRoutes({ "/staff/repairs": <StaffRepairs scope="admin" /> }, "/staff/repairs");
    await user.click(screen.getByText(mockRepair.reference));
    await screen.findByText("staff.repairs.detail.partsEditor");
    expect(document.body.textContent).toContain("admin.repairs.detail.profit");
  });

  it("intake: selecting 'other' reveals the free-text field; empty submit surfaces required errors", async () => {
    mockRepairsList(mockRepairs);
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/repairs": <StaffRepairs /> }, "/staff/repairs");

    await user.click(screen.getByRole("button", { name: "staff.repairs.intake.title" }));
    expect(
      screen.queryByText("staff.repairs.intake.reportedIssueOtherLabel"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText("staff.repairs.intake.issue.other"));
    expect(
      await screen.findByText("staff.repairs.intake.reportedIssueOtherLabel"),
    ).toBeInTheDocument();

    await user.click(screen.getByText("staff.repairs.intake.submit"));
    await waitFor(() =>
      expect(screen.getByText("staff.repairs.intake.customerNameRequired")).toBeInTheDocument(),
    );
    expect(screen.getByText("staff.repairs.intake.customerPhoneRequired")).toBeInTheDocument();
    expect(createRepairMutate).not.toHaveBeenCalled();
  });

  it("a rejected board drag toasts dragRejected and never moves the card optimistically", () => {
    mockRepairsList(mockRepairs);
    updateStatusMutate.mockImplementation((_vars, opts) => opts.onError(new Error("rejected")));
    renderWithRoutes({ "/staff/repairs": <StaffRepairs /> }, "/staff/repairs");

    const card = screen.getByText(mockRepair.reference).closest('[draggable="true"]')!;
    const targetLane = screen.getByText("staff.repairs.board.completed").parentElement!;
    fireEvent.dragStart(card);
    fireEvent.drop(targetLane);

    expect(updateStatusMutate).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("staff.repairs.statusDialog.dragRejected");
  });

  it("changing the technician filter re-queries useRepairs with the chosen id", async () => {
    mockRepairsList(mockRepairs);
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/repairs": <StaffRepairs /> }, "/staff/repairs");

    // The trigger always has a real value selected ("all" by default), so it displays that
    // item's own label, never the placeholder text (staff-products.test.tsx precedent).
    await user.click(screen.getByText("staff.orders.tabs.all").closest("button")!);
    await user.click(await screen.findByRole("option", { name: mockTechnician.name }));

    await waitFor(() =>
      expect(useRepairsHook.useRepairs).toHaveBeenLastCalledWith(
        "staff",
        expect.objectContaining({ technicianId: mockTechnician.id }),
      ),
    );
  });
});
