import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import {
  ClientActivityType,
  UserType,
  type PaginatedResult,
  type ProductWithPricingDto,
} from "@dragon-telecom/contract";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockBrand,
  mockFamilyWithCount,
  mockProductsPaginated,
  mockProductsEmptyPaginated,
  mockProductGuestHidden,
} from "../../../fixtures/data/catalog.mock";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import * as useCatalogTaxonomyHook from "@/hooks/useCatalogTaxonomy";
import * as useObservabilityHook from "@/hooks/useObservability";
import * as useSessionHook from "@/hooks/useSession";
import * as useClientPortalHook from "@/hooks/useClientPortal";
import Products from "@/pages/Products";

vi.mock("@/hooks/useCatalogProducts");
vi.mock("@/hooks/useCatalogTaxonomy");
vi.mock("@/hooks/useObservability");
vi.mock("@/hooks/useSession");
vi.mock("@/hooks/useClientPortal");

// The real page renders alongside this on the same route — real useSearchParams under a real
// MemoryRouter, so "filter → URL sync" is checked against the router's actual resulting
// location, not a mocked setSearchParams call (test-rules §2: behavior over internals).
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

const sendActivityMutate = vi.fn();

function mockProducts(
  data: PaginatedResult<ProductWithPricingDto> | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useCatalogProductsHook.useCatalogProducts).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    error: null,
    refetch: vi.fn(),
  } as never);
}

function mockTaxonomy() {
  vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
    data: [mockFamilyWithCount],
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogBrands).mockReturnValue({
    data: [mockBrand],
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogModels).mockReturnValue({
    data: [],
  } as never);
}

function mockSession(type: UserType | null) {
  vi.mocked(useSessionHook.useSession).mockReturnValue({
    data: type ? { userId: "1", type, staffId: null, profile: null } : undefined,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTaxonomy();
  mockSession(null);
  vi.mocked(useObservabilityHook.useSendClientActivity).mockReturnValue({
    mutate: sendActivityMutate,
    isPending: false,
  } as never);
  vi.mocked(useClientPortalHook.useAddToCart).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useClientPortalHook.useRemoveFromCart).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
});

describe("Products (Catalog, PUB-02)", () => {
  it("shows a skeleton grid while the products query is loading", () => {
    mockProducts(undefined, { isLoading: true });
    const { container } = renderWithRoutes({ "/products": <Products /> }, "/products");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("writes the brand filter to the URL and clears an existing model filter", async () => {
    mockProducts(mockProductsPaginated);
    const user = userEvent.setup();
    renderWithRoutes(
      {
        "/products": (
          <>
            <Products />
            <LocationProbe />
          </>
        ),
      },
      "/products?modelId=de000000-0000-4000-8000-000000000001",
    );

    await user.click(screen.getByLabelText("products.filters.brand"));
    await user.click(await screen.findByRole("option", { name: mockBrand.name }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(`/products?brandId=${mockBrand.id}`),
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("modelId");
  });

  it("shows EmptyState with a clear-filters reset that clears the URL", async () => {
    mockProducts(mockProductsEmptyPaginated);
    const user = userEvent.setup();
    renderWithRoutes(
      {
        "/products": (
          <>
            <Products />
            <LocationProbe />
          </>
        ),
      },
      `/products?brandId=${mockBrand.id}`,
    );

    expect(screen.getByText("products.noProductsFound")).toBeInTheDocument();
    // Two "clear all" buttons render: ProductFilters' own header action (active-filter badge)
    // and the grid's EmptyState reset — the EmptyState one (last in DOM order) is what this
    // test means to exercise.
    const clearButtons = screen.getAllByRole("button", { name: "products.filters.clearAll" });
    await user.click(clearButtons[clearButtons.length - 1]);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/products"));
    expect(screen.getByTestId("location")).not.toHaveTextContent("brandId");
  });

  it("shows the 'sign in to see the price' zone for a guest on a price-hidden product", () => {
    mockSession(null);
    mockProducts({
      items: [mockProductGuestHidden],
      meta: { page: 1, limit: 15, total: 1, totalPages: 1 },
    });
    renderWithRoutes({ "/products": <Products /> }, "/products");
    expect(screen.getByText("products.signIn")).toBeInTheDocument();
    expect(screen.getByText("products.viewPrices")).toBeInTheDocument();
  });

  it("fires a SEARCH beacon once the debounced search settles, for a signed-in client", async () => {
    mockSession(UserType.CLIENT);
    mockProducts(mockProductsPaginated);
    const user = userEvent.setup();
    renderWithRoutes({ "/products": <Products /> }, "/products");

    await user.type(screen.getByLabelText("products.filters.search"), "iphone");

    await waitFor(
      () =>
        expect(sendActivityMutate).toHaveBeenCalledWith({
          type: ClientActivityType.SEARCH,
          query: "iphone",
        }),
      { timeout: 2000 },
    );
  });

  it("never fires a SEARCH beacon for a guest", async () => {
    mockSession(null);
    mockProducts(mockProductsPaginated);
    const user = userEvent.setup();
    renderWithRoutes({ "/products": <Products /> }, "/products");

    await user.type(screen.getByLabelText("products.filters.search"), "iphone");
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(sendActivityMutate).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: ClientActivityType.SEARCH }),
    );
  });
});
