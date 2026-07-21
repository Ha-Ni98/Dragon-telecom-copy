import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockAdminProduct,
  mockAdminProductsPaginated,
  mockProductStats,
  mockFamilyWithCount,
  mockBrand,
  mockModel,
} from "../../../fixtures/data/catalog.mock";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import * as useCatalogTaxonomyHook from "@/hooks/useCatalogTaxonomy";
import * as useObservabilityHook from "@/hooks/useObservability";
import AdminProducts from "@/pages/admin/products/AdminProducts";

vi.mock("@/hooks/useCatalogProducts");
vi.mock("@/hooks/useCatalogTaxonomy");
vi.mock("@/hooks/useObservability");

const refetchProducts = vi.fn();
const updateProductMutate = vi.fn();

function mockProducts(
  data: typeof mockAdminProductsPaginated | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useCatalogProductsHook.useAdminCatalogProducts).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchProducts,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCatalogProductsHook.useProductStats).mockReturnValue({
    data: mockProductStats,
    isLoading: false,
  } as never);
  vi.mocked(useCatalogProductsHook.useUpdateProduct).mockReturnValue({
    mutate: updateProductMutate,
    isPending: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
    data: [mockFamilyWithCount],
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogBrands).mockReturnValue({
    data: [mockBrand],
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogModels).mockReturnValue({
    data: [mockModel],
  } as never);
  vi.mocked(useObservabilityHook.useSendStaffSearch).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
});

describe("AdminProducts (ADM-02)", () => {
  it("shows stat + table skeletons while loading", () => {
    mockProducts(undefined, { isLoading: true });
    vi.mocked(useCatalogProductsHook.useProductStats).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);
    const { container } = renderWithRoutes(
      { "/admin/products": <AdminProducts /> },
      "/admin/products",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the products query errors, and retry re-fetches", async () => {
    mockProducts(undefined, { isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/products": <AdminProducts /> }, "/admin/products");

    expect(screen.getByText("admin.productsList.table.error")).toBeInTheDocument();
    await user.click(screen.getByText("common.actions.tryAgain"));
    expect(refetchProducts).toHaveBeenCalled();
  });

  it("shows EmptyState when there are no products", () => {
    mockProducts({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    renderWithRoutes({ "/admin/products": <AdminProducts /> }, "/admin/products");
    expect(screen.getByText("admin.productsList.table.empty")).toBeInTheDocument();
  });

  it("renders a product row with an Edit <Link> to ADM-04 (scope-confinement — not a click handler)", () => {
    mockProducts(mockAdminProductsPaginated);
    renderWithRoutes({ "/admin/products": <AdminProducts /> }, "/admin/products");
    expect(screen.getAllByText(mockAdminProduct.name).length).toBeGreaterThanOrEqual(1);
    const editLinks = screen.getAllByRole("link", { name: "admin.productsList.table.edit" });
    expect(editLinks.length).toBeGreaterThan(0);
    expect(editLinks[0]).toHaveAttribute("href", `/admin/products/${mockAdminProduct.id}`);
  });

  it("toggling publish flips the switch optimistically, then rolls back on a failed mutation", async () => {
    mockProducts(mockAdminProductsPaginated);
    let capturedOnError: (() => void) | undefined;
    updateProductMutate.mockImplementation((_vars, opts) => {
      capturedOnError = opts.onError;
    });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/products": <AdminProducts /> }, "/admin/products");

    // Re-query after every state change rather than holding one element reference — the
    // `checked` prop flip remounts the underlying Radix Switch node rather than updating it
    // in place, so a stale reference would silently keep reporting its pre-click attributes.
    const getPublishSwitch = () =>
      screen.getAllByRole("switch", { name: "admin.productsList.table.published" })[0];
    expect(getPublishSwitch()).toHaveAttribute("aria-checked", "true");

    await user.click(getPublishSwitch());
    expect(getPublishSwitch()).toHaveAttribute("aria-checked", "false");

    act(() => capturedOnError?.());
    expect(getPublishSwitch()).toHaveAttribute("aria-checked", "true");
  });
});
