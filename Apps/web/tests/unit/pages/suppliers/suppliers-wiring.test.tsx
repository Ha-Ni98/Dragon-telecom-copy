import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockSupplier,
  mockSuppliersPaginated,
  mockSupplierStats,
} from "../../../fixtures/data/purchasing.mock";
import * as usePurchasingSuppliersHook from "@/hooks/usePurchasingSuppliers";
import AdminSuppliers from "@/pages/admin/suppliers/AdminSuppliers";

vi.mock("@/hooks/usePurchasingSuppliers");

const refetchSuppliers = vi.fn();
const refetchStats = vi.fn();
const createMutate = vi.fn();
const updateMutate = vi.fn();

function mockSuppliers(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(usePurchasingSuppliersHook.usePurchasingSuppliers).mockReturnValue({
    data: mockSuppliersPaginated,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchSuppliers,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSuppliers();
  vi.mocked(usePurchasingSuppliersHook.usePurchasingSupplierStats).mockReturnValue({
    data: mockSupplierStats,
    isLoading: false,
    isError: false,
    refetch: refetchStats,
  } as never);
  vi.mocked(usePurchasingSuppliersHook.useCreatePurchasingSupplier).mockReturnValue({
    mutateAsync: createMutate,
    isPending: false,
  } as never);
  vi.mocked(usePurchasingSuppliersHook.useUpdatePurchasingSupplier).mockReturnValue({
    mutate: updateMutate,
    isPending: false,
  } as never);
});

describe("AdminSuppliers (ADM-07 list) wiring", () => {
  it("shows the table skeleton while loading", () => {
    mockSuppliers({ isLoading: true });
    const { container } = renderWithRoutes(
      { "/admin/suppliers": <AdminSuppliers /> },
      "/admin/suppliers",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the list query errors, and retry re-fetches", async () => {
    mockSuppliers({ isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/suppliers": <AdminSuppliers /> }, "/admin/suppliers");

    expect(screen.getByText("admin.suppliers.error")).toBeInTheDocument();
    await user.click(screen.getByText("common.retry"));
    expect(refetchSuppliers).toHaveBeenCalled();
  });

  it("renders supplier rows and stats from the live hooks", () => {
    renderWithRoutes({ "/admin/suppliers": <AdminSuppliers /> }, "/admin/suppliers");
    expect(screen.getAllByText(mockSupplier.name).length).toBeGreaterThanOrEqual(1);
  });

  it("disabling a supplier calls the live update mutation", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/suppliers": <AdminSuppliers /> }, "/admin/suppliers");

    const disableButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-ban"));
    await user.click(disableButtons[0]);

    expect(updateMutate).toHaveBeenCalledWith(
      { id: mockSupplier.id, command: { isEnabled: false } },
      expect.anything(),
    );
  });

  it("creates a supplier via the live mutation", async () => {
    createMutate.mockResolvedValue(mockSupplier);
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/suppliers": <AdminSuppliers /> }, "/admin/suppliers");

    await user.click(screen.getByText("admin.suppliers.addSupplier"));
    await user.type(
      screen.getByPlaceholderText("admin.suppliers.supplierNamePlaceholder"),
      "Acme Parts",
    );
    await user.click(screen.getByText("common.save"));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
  });
});
