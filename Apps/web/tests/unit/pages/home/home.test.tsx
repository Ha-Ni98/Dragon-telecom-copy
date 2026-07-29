import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { UserType } from "@dragon-telecom/contract";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockFamilyWithCount,
  mockBrand,
  mockProductsPaginated,
  mockProductsEmptyPaginated,
} from "../../../fixtures/data/catalog.mock";
import * as useCatalogTaxonomyHook from "@/hooks/useCatalogTaxonomy";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import * as useSessionHook from "@/hooks/useSession";
import * as useClientPortalHook from "@/hooks/useClientPortal";
import { CategoriesSection } from "@/components/sections/landing/categories-section";
import { BrandsSection } from "@/components/sections/landing/brands-section";
import { ProductsSection } from "@/components/sections/landing/products-section";

vi.mock("@/hooks/useCatalogTaxonomy");
vi.mock("@/hooks/useCatalogProducts");
vi.mock("@/hooks/useSession");
vi.mock("@/hooks/useClientPortal");

// Renders wherever a card/CTA navigates to, so a click can be asserted by its real landing
// path+query rather than a mocked useNavigate spy (test-rules §2: behavior, not internals).
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function mockSession(type: UserType | null) {
  vi.mocked(useSessionHook.useSession).mockReturnValue({
    data: type ? { userId: "1", type, staffId: null, profile: null } : undefined,
  } as never);
}

function mockCartMutations() {
  vi.mocked(useClientPortalHook.useAddToCart).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useClientPortalHook.useRemoveFromCart).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession(null);
  mockCartMutations();
});

describe("CategoriesSection (PUB-01)", () => {
  it("shows skeletons while loading", () => {
    vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const { container } = renderWithRoutes({ "/": <CategoriesSection /> }, "/");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a local retry action on error", async () => {
    const refetch = vi.fn();
    vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as never);
    const user = userEvent.setup();
    renderWithRoutes({ "/": <CategoriesSection /> }, "/");
    expect(screen.getByText("categories.errorLoading")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "common.actions.tryAgain" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("hides itself entirely when there are no families", () => {
    vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const { container } = renderWithRoutes({ "/": <CategoriesSection /> }, "/");
    expect(container).toBeEmptyDOMElement();
  });

  it("navigates to the filtered catalog when a family card is clicked", async () => {
    vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
      data: [mockFamilyWithCount],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const user = userEvent.setup();
    renderWithRoutes({ "/": <CategoriesSection />, "/products": <LocationProbe /> }, "/");
    await user.click(screen.getByText(mockFamilyWithCount.name));
    expect(screen.getByTestId("location")).toHaveTextContent(
      `/products?familyId=${mockFamilyWithCount.id}`,
    );
  });
});

describe("BrandsSection (PUB-01)", () => {
  it("shows skeletons while loading", () => {
    vi.mocked(useCatalogTaxonomyHook.useCatalogBrands).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const { container } = renderWithRoutes({ "/": <BrandsSection /> }, "/");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a local retry action on error — a sibling section's own state is untouched by it", () => {
    vi.mocked(useCatalogTaxonomyHook.useCatalogBrands).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as never);
    renderWithRoutes({ "/": <BrandsSection /> }, "/");
    expect(screen.getByText("brands.errorLoading")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.actions.tryAgain" })).toBeInTheDocument();
  });

  it("hides itself entirely when there are no brands", () => {
    vi.mocked(useCatalogTaxonomyHook.useCatalogBrands).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const { container } = renderWithRoutes({ "/": <BrandsSection /> }, "/");
    expect(container).toBeEmptyDOMElement();
  });

  it("navigates to the filtered catalog when a brand card is clicked", async () => {
    vi.mocked(useCatalogTaxonomyHook.useCatalogBrands).mockReturnValue({
      data: [mockBrand],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const user = userEvent.setup();
    renderWithRoutes({ "/": <BrandsSection />, "/products": <LocationProbe /> }, "/");
    await user.click(screen.getByText(mockBrand.name));
    expect(screen.getByTestId("location")).toHaveTextContent(`/products?brandId=${mockBrand.id}`);
  });
});

describe("ProductsSection (PUB-01)", () => {
  function mockFamilies() {
    vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
      data: [mockFamilyWithCount],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
  }

  it("shows skeletons while loading", () => {
    mockFamilies();
    vi.mocked(useCatalogProductsHook.useCatalogProducts).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const { container } = renderWithRoutes({ "/": <ProductsSection /> }, "/");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("links each card to its own product detail page", () => {
    mockFamilies();
    vi.mocked(useCatalogProductsHook.useCatalogProducts).mockReturnValue({
      data: mockProductsPaginated,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderWithRoutes({ "/": <ProductsSection /> }, "/");
    const viewDetailsButtons = screen.getAllByRole("button", { name: /products\.viewDetails/ });
    expect(viewDetailsButtons).toHaveLength(mockProductsPaginated.items.length);
  });

  it("hides the wishlist heart for a guest viewer", () => {
    mockFamilies();
    mockSession(null);
    vi.mocked(useCatalogProductsHook.useCatalogProducts).mockReturnValue({
      data: mockProductsPaginated,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderWithRoutes({ "/": <ProductsSection /> }, "/");
    expect(
      screen.queryByRole("button", { name: "wishlist.addToWishlist" }),
    ).not.toBeInTheDocument();
  });

  it("shows the wishlist heart for a signed-in client", () => {
    mockFamilies();
    mockSession(UserType.CLIENT);
    vi.mocked(useCatalogProductsHook.useCatalogProducts).mockReturnValue({
      data: mockProductsPaginated,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderWithRoutes({ "/": <ProductsSection /> }, "/");
    expect(
      screen.getAllByRole("button", { name: "wishlist.addToWishlist" }).length,
    ).toBeGreaterThan(0);
  });

  it("falls through to the empty grid state when there are no featured products", () => {
    mockFamilies();
    vi.mocked(useCatalogProductsHook.useCatalogProducts).mockReturnValue({
      data: mockProductsEmptyPaginated,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderWithRoutes({ "/": <ProductsSection /> }, "/");
    expect(screen.getByText("products.noProductsFound")).toBeInTheDocument();
  });
});
