import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import type { PaginatedResult, StaffProductDto } from "@dragon-telecom/contract";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockStaffProduct,
  mockStaffProductsPaginated,
  mockFamilyWithCount,
  mockBrand,
  mockModel,
} from "../../../fixtures/data/catalog.mock";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import * as useCatalogTaxonomyHook from "@/hooks/useCatalogTaxonomy";
import * as useObservabilityHook from "@/hooks/useObservability";
import StaffProducts from "@/pages/staff/products/StaffProducts";

vi.mock("@/hooks/useCatalogProducts");
vi.mock("@/hooks/useCatalogTaxonomy");
vi.mock("@/hooks/useObservability");

// Real useSearchParams under a real MemoryRouter (catalog.test.tsx precedent) — "filter → URL"
// is checked against the router's actual resulting location, not a mocked setSearchParams call.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

const sendStaffSearchMutate = vi.fn();

function mockProducts(
  data: PaginatedResult<StaffProductDto> | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useCatalogProductsHook.useStaffProducts).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
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
    data: [mockModel],
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTaxonomy();
  vi.mocked(useObservabilityHook.useSendStaffSearch).mockReturnValue({
    mutate: sendStaffSearchMutate,
    isPending: false,
  } as never);
});

describe("StaffProducts (STF-03)", () => {
  it("shows a TableSkeleton while the products query is loading", () => {
    mockProducts(undefined, { isLoading: true });
    const { container } = renderWithRoutes(
      { "/staff/products": <StaffProducts /> },
      "/staff/products",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders the DTO columns incl. one per categoryPrices entry, with no image cell", () => {
    mockProducts(mockStaffProductsPaginated);
    renderWithRoutes({ "/staff/products": <StaffProducts /> }, "/staff/products");

    expect(screen.getAllByText(mockStaffProduct.name).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(String(mockStaffProduct.availableQuantity)).length,
    ).toBeGreaterThanOrEqual(1);
    // The one categoryPrices entry ("Repair Shops") gets its own column header.
    expect(screen.getAllByText("Repair Shops").length).toBeGreaterThanOrEqual(1);
    expect(document.querySelectorAll("img").length).toBe(0);
  });

  it("writes the chosen family to the URL", async () => {
    mockProducts(mockStaffProductsPaginated);
    const user = userEvent.setup();
    renderWithRoutes(
      {
        "/staff/products": (
          <>
            <StaffProducts />
            <LocationProbe />
          </>
        ),
      },
      "/staff/products",
    );

    // familyId always has a value (ALL by default — see StaffProductFilters.tsx), so the
    // trigger displays the selected item's own label, never the placeholder text.
    await user.click(screen.getByText("staff.products.allFamilies").closest("button")!);
    await user.click(await screen.findByRole("option", { name: mockFamilyWithCount.name }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        `familyId=${mockFamilyWithCount.id}`,
      ),
    );
  });

  it("clears modelId from the URL when the brand changes", async () => {
    mockProducts(mockStaffProductsPaginated);
    // A second, distinct brand option to switch to — set up before render so the trigger's
    // dropdown actually offers it (re-mocking after render doesn't retroactively re-render).
    const otherBrand = { ...mockBrand, id: "b1000000-0000-4000-8000-000000000099", name: "Apple" };
    vi.mocked(useCatalogTaxonomyHook.useCatalogBrands).mockReturnValue({
      data: [mockBrand, otherBrand],
    } as never);
    const user = userEvent.setup();
    renderWithRoutes(
      {
        "/staff/products": (
          <>
            <StaffProducts />
            <LocationProbe />
          </>
        ),
      },
      `/staff/products?brandId=${mockBrand.id}&modelId=${mockModel.id}`,
    );

    // brandId is already set in this test's initial URL, so the trigger displays mockBrand's
    // own name, not the "all brands" placeholder — same reasoning as the family-filter test.
    await user.click(screen.getByText(mockBrand.name).closest("button")!);
    await user.click(await screen.findByRole("option", { name: otherBrand.name }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(`brandId=${otherBrand.id}`),
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("modelId");
  });

  it("fires the STAFF_SEARCH beacon with the executed query once the debounce settles", async () => {
    mockProducts(mockStaffProductsPaginated);
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/products": <StaffProducts /> }, "/staff/products");

    await user.type(screen.getByPlaceholderText("staff.products.searchPlaceholder"), "galaxy");

    await waitFor(() => expect(sendStaffSearchMutate).toHaveBeenCalledWith({ query: "galaxy" }), {
      timeout: 2000,
    });
  });

  it("shows EmptyState with a filter-clearing reset when there are no results", async () => {
    mockProducts({ items: [], meta: { page: 1, limit: 15, total: 0, totalPages: 0 } });
    const user = userEvent.setup();
    renderWithRoutes(
      {
        "/staff/products": (
          <>
            <StaffProducts />
            <LocationProbe />
          </>
        ),
      },
      `/staff/products?brandId=${mockBrand.id}`,
    );

    expect(screen.getByText("staff.products.empty")).toBeInTheDocument();
    // Two "clear filters" buttons render — StaffProductFilters' own (since brandId is active)
    // and the table's EmptyState decoration (catalog.test.tsx's identical precedent); the
    // EmptyState one (last in DOM order) is what this test means to exercise.
    const clearButtons = screen.getAllByRole("button", { name: "admin.clients.clearFilters" });
    await user.click(clearButtons[clearButtons.length - 1]);
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/staff/products"),
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("brandId");
  });
});
