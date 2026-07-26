import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockOrderPickup,
  mockOrderDelivery,
  mockOrdersPaginated,
  mockOrderStats,
} from "../../../fixtures/data/orders.mock";
import { OrderStatus } from "@dragon-telecom/contract";
import * as useOrdersDirectoryHook from "@/hooks/useOrdersDirectory";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import * as useObservabilityHook from "@/hooks/useObservability";
import StaffOrders from "@/pages/staff/orders/StaffOrders";

vi.mock("@/hooks/useOrdersDirectory");
vi.mock("@/hooks/useCatalogProducts");
vi.mock("@/hooks/useObservability");

const refetchOrders = vi.fn();
const confirmMutate = vi.fn();
const statusMutate = vi.fn();
const cancelMutate = vi.fn();
const returnMutate = vi.fn();

function mockOrders(
  data: typeof mockOrdersPaginated | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useOrdersDirectoryHook.useOrdersList).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchOrders,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useOrdersDirectoryHook.useOrderStats).mockReturnValue({
    data: mockOrderStats,
    isLoading: false,
  } as never);
  vi.mocked(useOrdersDirectoryHook.useConfirmOrder).mockReturnValue({
    mutate: confirmMutate,
    isPending: false,
  } as never);
  vi.mocked(useOrdersDirectoryHook.useUpdateOrderStatus).mockReturnValue({
    mutate: statusMutate,
    isPending: false,
  } as never);
  vi.mocked(useOrdersDirectoryHook.useAdminCancelOrder).mockReturnValue({
    mutate: cancelMutate,
    isPending: false,
  } as never);
  vi.mocked(useOrdersDirectoryHook.useReturnOrder).mockReturnValue({
    mutate: returnMutate,
    isPending: false,
  } as never);
  vi.mocked(useCatalogProductsHook.useAdminCatalogProduct).mockReturnValue({
    data: undefined,
  } as never);
  vi.mocked(useObservabilityHook.useSendStaffSearch).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
});

describe("StaffOrders (STF-04 / ADM-09)", () => {
  it("shows stat + table skeletons while loading", () => {
    mockOrders(undefined, { isLoading: true });
    vi.mocked(useOrdersDirectoryHook.useOrderStats).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);
    const { container } = renderWithRoutes({ "/staff/orders": <StaffOrders /> }, "/staff/orders");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the orders query errors, and retry re-fetches", async () => {
    mockOrders(undefined, { isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/orders": <StaffOrders /> }, "/staff/orders");

    expect(screen.getByText("staff.orders.table.error")).toBeInTheDocument();
    await user.click(screen.getByText("common.actions.tryAgain"));
    expect(refetchOrders).toHaveBeenCalled();
  });

  it("shows EmptyState when there are no orders", () => {
    mockOrders({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    renderWithRoutes({ "/staff/orders": <StaffOrders /> }, "/staff/orders");
    expect(screen.getByText("staff.orders.table.empty")).toBeInTheDocument();
  });

  it("renders order rows on success", () => {
    mockOrders(mockOrdersPaginated);
    renderWithRoutes({ "/staff/orders": <StaffOrders /> }, "/staff/orders");
    expect(screen.getAllByText(mockOrderPickup.reference).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(mockOrderDelivery.contactName).length).toBeGreaterThanOrEqual(1);
  });

  it("defaults to the PENDING tab on first load", () => {
    mockOrders(mockOrdersPaginated);
    renderWithRoutes({ "/staff/orders": <StaffOrders /> }, "/staff/orders");
    expect(useOrdersDirectoryHook.useOrdersList).toHaveBeenCalledWith(
      "staff",
      expect.objectContaining({ status: OrderStatus.PENDING }),
    );
  });

  it("surfaces INSUFFICIENT_STOCK inline on the confirm dialog when the server rejects", async () => {
    mockOrders(mockOrdersPaginated);
    confirmMutate.mockImplementation((_vars, opts) => {
      opts.onError({
        isAxiosError: true,
        response: {
          data: {
            success: false,
            error: { code: "RESOURCE_CONFLICT", message: "INSUFFICIENT_STOCK" },
          },
        },
      });
    });
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/orders": <StaffOrders /> }, "/staff/orders");

    await user.click(screen.getAllByText(mockOrderPickup.reference)[0]);
    await user.click(await screen.findByText("staff.orders.confirmDialog.submit"));
    await user.click(screen.getByText("staff.orders.confirmDialog.submit"));

    await waitFor(() =>
      expect(screen.getByText("staff.orders.confirmDialog.insufficientStock")).toBeInTheDocument(),
    );
  });

  it("shows Cancel/Return actions for scope=admin but not for scope=staff", async () => {
    const completedOrder = { ...mockOrderDelivery, status: OrderStatus.COMPLETED };
    mockOrders({ items: [completedOrder], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    const user = userEvent.setup();

    const { unmount } = renderWithRoutes(
      { "/staff/orders": <StaffOrders scope="staff" /> },
      "/staff/orders",
    );
    await user.click(screen.getAllByText(completedOrder.reference)[0]);
    expect(await screen.findByText("staff.orders.showDialog.title")).toBeInTheDocument();
    expect(screen.queryByText("admin.orders.cancelDialog.title")).not.toBeInTheDocument();
    expect(screen.queryByText("admin.orders.returnDialog.title")).not.toBeInTheDocument();
    unmount();

    renderWithRoutes({ "/staff/orders": <StaffOrders scope="admin" /> }, "/staff/orders");
    await user.click(screen.getAllByText(completedOrder.reference)[0]);
    expect(await screen.findByText("admin.orders.cancelDialog.title")).toBeInTheDocument();
    expect(screen.getByText("admin.orders.returnDialog.title")).toBeInTheDocument();
  });
});
