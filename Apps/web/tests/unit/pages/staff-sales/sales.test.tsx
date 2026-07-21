import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockSale, mockSalesPaginated } from "../../../fixtures/data/sales.mock";
import * as useSalesHook from "@/hooks/useSales";
import * as useIdentityHook from "@/hooks/useIdentity";
import * as usePosClientsHook from "@/hooks/usePosClients";
import StaffSales from "@/pages/staff/sales/StaffSales";

vi.mock("@/hooks/useSales");
vi.mock("@/hooks/useIdentity");
vi.mock("@/hooks/usePosClients");

const refetchSales = vi.fn();
const returnMutate = vi.fn();

function mockSales(
  data: typeof mockSalesPaginated | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useSalesHook.useSales).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchSales,
  } as never);
}

function mockSaleDetail(
  data: typeof mockSale | undefined,
  isError = false,
  error: unknown = undefined,
) {
  vi.mocked(useSalesHook.useSale).mockReturnValue({
    data,
    isLoading: false,
    isError,
    error,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSaleDetail(undefined);
  vi.mocked(useSalesHook.useCreateReturn).mockReturnValue({
    mutate: returnMutate,
    isPending: false,
  } as never);
  vi.mocked(useIdentityHook.useUsers).mockReturnValue({ data: undefined } as never);
  vi.mocked(usePosClientsHook.usePosClientSearch).mockReturnValue({ data: undefined } as never);
});

describe("StaffSales (STF-05 / ADM-10)", () => {
  it("shows a TableSkeleton while loading", () => {
    mockSales(undefined, { isLoading: true });
    const { container } = renderWithRoutes({ "/staff/sales": <StaffSales /> }, "/staff/sales");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the sales query errors, and retry re-fetches", async () => {
    mockSales(undefined, { isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/sales": <StaffSales /> }, "/staff/sales");

    expect(screen.getByText("staff.sales.table.error")).toBeInTheDocument();
    await user.click(screen.getByText("common.actions.tryAgain"));
    expect(refetchSales).toHaveBeenCalled();
  });

  it("shows EmptyState when there are no sales", () => {
    mockSales({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    renderWithRoutes({ "/staff/sales": <StaffSales /> }, "/staff/sales");
    expect(screen.getByText("staff.sales.table.empty")).toBeInTheDocument();
  });

  it("staff mapping omits the seller column and footer total", () => {
    mockSales(mockSalesPaginated);
    renderWithRoutes({ "/staff/sales": <StaffSales scope="staff" /> }, "/staff/sales");
    expect(screen.getAllByText(mockSale.reference).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("admin.sales.table.seller")).not.toBeInTheDocument();
    expect(screen.queryByText("admin.sales.table.footerTotal")).not.toBeInTheDocument();
  });

  it("admin mapping shows the seller column and a filtered-set footer total", () => {
    mockSales(mockSalesPaginated);
    renderWithRoutes({ "/staff/sales": <StaffSales scope="admin" /> }, "/staff/sales");
    expect(screen.getByText("admin.sales.table.seller")).toBeInTheDocument();
    expect(screen.getByText("admin.sales.table.footerTotal")).toBeInTheDocument();
  });

  it("issue-return: quantity beyond sold-minus-returned surfaces a Zod error", async () => {
    mockSales(mockSalesPaginated);
    mockSaleDetail(mockSale);
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/sales": <StaffSales scope="admin" /> }, "/staff/sales");

    await user.click(screen.getAllByText(mockSale.reference)[0]);
    await user.click(await screen.findByText("admin.sales.detail.issueReturn"));

    await user.click(screen.getByRole("checkbox"));
    const qtyInput = screen.getByLabelText("admin.sales.returnDialog.quantityLabel");
    await user.clear(qtyInput);
    await user.type(qtyInput, "3");
    // fireEvent.submit, not user.click on the submit button — the quantity input also carries
    // a native HTML `max` attribute (mirroring the same bound the Zod refine checks), so
    // user-event's realistic constraint-validation would block the click before the submit
    // event ever fires, never exercising the Zod path this test means to cover.
    fireEvent.submit(screen.getByText("admin.sales.returnDialog.submit").closest("form")!);

    await waitFor(() =>
      expect(
        screen.getByText("admin.sales.returnDialog.quantityExceedsRemaining"),
      ).toBeInTheDocument(),
    );
    expect(returnMutate).not.toHaveBeenCalled();
  });

  it("shows the forbidden panel instead of sale content on a 403", async () => {
    mockSales(mockSalesPaginated);
    mockSaleDetail(undefined, true, {
      isAxiosError: true,
      response: { status: 403 },
    });
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/sales": <StaffSales /> }, "/staff/sales");

    await user.click(screen.getAllByText(mockSale.reference)[0]);
    expect(await screen.findByText("staff.sales.detail.forbidden")).toBeInTheDocument();
  });
});
