import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockStockRows,
  mockMovementsPaginated,
  mockReservationsPaginated,
  mockAdjustmentResult,
} from "../../../fixtures/data/inventory.mock";
import { mockAdminProduct, mockAdminProductsPaginated } from "../../../fixtures/data/catalog.mock";
import * as useInventoryHook from "@/hooks/useInventory";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import AdminInventory from "@/pages/admin/inventory/AdminInventory";

vi.mock("@/hooks/useInventory");
vi.mock("@/hooks/useCatalogProducts");

const refetchStock = vi.fn();
const refetchMovements = vi.fn();
const refetchReservations = vi.fn();
const createAdjustmentMutate = vi.fn();

function mockStock(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(useInventoryHook.useStock).mockReturnValue({
    data: mockStockRows,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchStock,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStock();
  vi.mocked(useInventoryHook.useExportStockCsv).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useInventoryHook.useMovements).mockReturnValue({
    data: mockMovementsPaginated,
    isLoading: false,
    isError: false,
    refetch: refetchMovements,
  } as never);
  vi.mocked(useInventoryHook.useReservations).mockReturnValue({
    data: mockReservationsPaginated,
    isLoading: false,
    isError: false,
    refetch: refetchReservations,
  } as never);
  vi.mocked(useInventoryHook.useCreateAdjustment).mockReturnValue({
    mutate: createAdjustmentMutate,
    isPending: false,
  } as never);
  vi.mocked(useCatalogProductsHook.useAdminCatalogProducts).mockReturnValue({
    data: mockAdminProductsPaginated,
    isLoading: false,
    isError: false,
  } as never);
});

describe("AdminInventory (ADM-06) wiring", () => {
  it("shows the stock skeleton while loading", () => {
    mockStock({ isLoading: true });
    const { container } = renderWithRoutes(
      { "/admin/inventory": <AdminInventory /> },
      "/admin/inventory",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the stock query errors, and retry re-fetches", async () => {
    mockStock({ isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/inventory": <AdminInventory /> }, "/admin/inventory");

    expect(screen.getByText("admin.inventory.error")).toBeInTheDocument();
    await user.click(screen.getByText("common.actions.tryAgain"));
    expect(refetchStock).toHaveBeenCalled();
  });

  it("renders the stock rows from the live hook", () => {
    renderWithRoutes({ "/admin/inventory": <AdminInventory /> }, "/admin/inventory");
    expect(screen.getAllByText(mockStockRows[0].name).length).toBeGreaterThanOrEqual(1);
  });

  it("renders movement rows on the movements tab", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/inventory": <AdminInventory /> }, "/admin/inventory");
    await user.click(screen.getByText("admin.inventory.tabs.movements"));
    expect(
      screen.getAllByText(mockMovementsPaginated.items[0].productName).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders reservation rows on the reservations tab", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/inventory": <AdminInventory /> }, "/admin/inventory");
    await user.click(screen.getByText("admin.inventory.tabs.reservations"));
    expect(
      screen.getAllByText(mockReservationsPaginated.items[0].productName).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("submits a valid adjustment via the live mutation", async () => {
    createAdjustmentMutate.mockImplementation((_values, opts) => {
      opts?.onSuccess?.(mockAdjustmentResult);
    });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/inventory": <AdminInventory /> }, "/admin/inventory");
    await user.click(screen.getByText("admin.inventory.tabs.adjustments"));

    // A decrease (5 < the mocked product's quantityOnHand of 10) needs no `unitCost`.
    const productInput = screen.getByPlaceholderText("admin.inventory.adjustment.product");
    await user.type(productInput, mockAdminProduct.id);

    const countedInput = screen.getByPlaceholderText("admin.inventory.adjustment.countedQuantity");
    await user.clear(countedInput);
    await user.type(countedInput, "5");

    await user.click(screen.getByText("admin.inventory.adjustment.submit"));

    await waitFor(() => expect(createAdjustmentMutate).toHaveBeenCalled());
  });
});
