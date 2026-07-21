import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockAdminProduct } from "../../../fixtures/data/catalog.mock";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import * as useInventoryHook from "@/hooks/useInventory";
import * as useProductHistoryHook from "@/hooks/useProductHistory";
import AdminProductInformation from "@/pages/admin/products/AdminProductInformation";

vi.mock("@/hooks/useCatalogProducts");
vi.mock("@/hooks/useInventory");
vi.mock("@/hooks/useProductHistory");

const updateProductMutate = vi.fn();
const updatePricingMutate = vi.fn();

function mockProduct(
  data: typeof mockAdminProduct | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useCatalogProductsHook.useAdminCatalogProduct).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCatalogProductsHook.useUpdateProduct).mockReturnValue({
    mutate: updateProductMutate,
    isPending: false,
  } as never);
  vi.mocked(useCatalogProductsHook.useUpdatePricing).mockReturnValue({
    mutate: updatePricingMutate,
    isPending: false,
  } as never);
  vi.mocked(useCatalogProductsHook.useAddProductImages).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useCatalogProductsHook.useUpdateProductImages).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useInventoryHook.useMovements).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as never);
  vi.mocked(useProductHistoryHook.useProductSupplyHistory).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as never);
  vi.mocked(useProductHistoryHook.useProductSalesHistory).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as never);
});

describe("AdminProductInformation (ADM-04)", () => {
  it("shows card skeletons while the product is loading", () => {
    mockProduct(undefined, { isLoading: true });
    const { container } = renderWithRoutes(
      { "/admin/products/:productId": <AdminProductInformation /> },
      `/admin/products/${mockAdminProduct.id}`,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows NotFoundState on a 404", () => {
    mockProduct(undefined, { isError: true });
    renderWithRoutes(
      { "/admin/products/:productId": <AdminProductInformation /> },
      `/admin/products/${mockAdminProduct.id}`,
    );
    expect(screen.getByText("admin.productInfo.notFound")).toBeInTheDocument();
  });

  it("renders the product read-only, then the edit toggle turns the name into an input", async () => {
    mockProduct(mockAdminProduct);
    const user = userEvent.setup();
    renderWithRoutes(
      { "/admin/products/:productId": <AdminProductInformation /> },
      `/admin/products/${mockAdminProduct.id}`,
    );

    // The name shows twice at rest — the header <h1> and the details card's read-only <p>.
    expect(screen.getAllByText(mockAdminProduct.name).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByLabelText("admin.productsAdd.nameLabel")).not.toBeInTheDocument();

    await user.click(screen.getByText("admin.productInfo.edit"));
    expect(screen.getByLabelText("admin.productsAdd.nameLabel")).toHaveValue(mockAdminProduct.name);
  });

  it("cancel restores view mode without calling either save mutation", async () => {
    mockProduct(mockAdminProduct);
    const user = userEvent.setup();
    renderWithRoutes(
      { "/admin/products/:productId": <AdminProductInformation /> },
      `/admin/products/${mockAdminProduct.id}`,
    );

    await user.click(screen.getByText("admin.productInfo.edit"));
    await user.clear(screen.getByLabelText("admin.productsAdd.nameLabel"));
    await user.type(screen.getByLabelText("admin.productsAdd.nameLabel"), "Renamed Product");
    await user.click(screen.getByText("admin.productInfo.cancel"));

    expect(screen.getAllByText(mockAdminProduct.name).length).toBeGreaterThanOrEqual(2);
    expect(updateProductMutate).not.toHaveBeenCalled();
    expect(updatePricingMutate).not.toHaveBeenCalled();
  });

  it("save calls both useUpdateProduct and useUpdatePricing with the edited details", async () => {
    mockProduct(mockAdminProduct);
    const user = userEvent.setup();
    renderWithRoutes(
      { "/admin/products/:productId": <AdminProductInformation /> },
      `/admin/products/${mockAdminProduct.id}`,
    );

    await user.click(screen.getByText("admin.productInfo.edit"));
    await user.clear(screen.getByLabelText("admin.productsAdd.nameLabel"));
    await user.type(screen.getByLabelText("admin.productsAdd.nameLabel"), "Renamed Product");
    await user.click(screen.getByText("admin.productInfo.save"));

    await waitFor(() =>
      expect(updateProductMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockAdminProduct.id,
          command: expect.objectContaining({ name: "Renamed Product" }),
        }),
      ),
    );
    expect(updatePricingMutate).toHaveBeenCalled();
  });
});
