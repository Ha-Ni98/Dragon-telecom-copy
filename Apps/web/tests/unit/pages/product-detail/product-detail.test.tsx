import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserType } from "@dragon-telecom/contract";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockProductDetail } from "../../../fixtures/data/catalog.mock";
import { mockWilayas, mockFeeDefault } from "../../../fixtures/data/platform.mock";
import { mockClientMe } from "../../../fixtures/data/clients.mock";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import * as usePlatformHook from "@/hooks/usePlatform";
import * as useClientPortalHook from "@/hooks/useClientPortal";
import * as useOrdersPortalHook from "@/hooks/useOrdersPortal";
import * as useObservabilityHook from "@/hooks/useObservability";
import * as useSessionHook from "@/hooks/useSession";
import * as AuthProviderModule from "@/components/providers/AuthProvider";
import ProductDetails from "@/pages/ProductDetails";

vi.mock("@/hooks/useCatalogProducts");
vi.mock("@/hooks/usePlatform");
vi.mock("@/hooks/useClientPortal");
vi.mock("@/hooks/useOrdersPortal");
vi.mock("@/hooks/useObservability");
vi.mock("@/hooks/useSession");
vi.mock("@/components/providers/AuthProvider");

function mockAuth(isAuthenticated: boolean) {
  vi.mocked(AuthProviderModule.useAuth).mockReturnValue({
    isAuthenticated,
    isReady: true,
    displayName: null,
    login: vi.fn(),
    isLoggingIn: false,
    logout: vi.fn(),
  } as never);
}

function mockSession(type: UserType | null) {
  vi.mocked(useSessionHook.useSession).mockReturnValue({
    data: type ? { userId: "1", type, staffId: null, profile: null } : undefined,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth(false);
  mockSession(null);
  vi.mocked(usePlatformHook.useWilayas).mockReturnValue({ data: mockWilayas } as never);
  vi.mocked(usePlatformHook.usePlatformDeliveryFee).mockReturnValue({
    data: mockFeeDefault,
    isLoading: false,
  } as never);
  vi.mocked(useClientPortalHook.useClientMe).mockReturnValue({ data: undefined } as never);
  vi.mocked(useClientPortalHook.useAddToCart).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useClientPortalHook.useRemoveFromCart).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useOrdersPortalHook.usePlaceOrder).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useObservabilityHook.useSendClientActivity).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
});

function mockProduct(overrides: Partial<typeof mockProductDetail> = {}) {
  vi.mocked(useCatalogProductsHook.useCatalogProduct).mockReturnValue({
    data: { ...mockProductDetail, relatedIds: [], ...overrides },
    isLoading: false,
    isError: false,
    error: null,
  } as never);
}

describe("ProductDetails (PUB-03)", () => {
  it("renders a 404 view for an unknown product id", () => {
    vi.mocked(useCatalogProductsHook.useCatalogProduct).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: "Not found" },
    } as never);
    renderWithRoutes(
      { "/products/:id": <ProductDetails /> },
      "/products/00000000-0000-4000-8000-000000000099",
    );
    expect(screen.getByText("product.notFound")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "product.browseProducts" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("shows the resolved price for a viewer the price is exposed to", () => {
    mockProduct({ currentPrice: 4500, priceHidden: false });
    renderWithRoutes({ "/products/:id": <ProductDetails /> }, `/products/${mockProductDetail.id}`);
    expect(screen.getByText(/4,500/)).toBeInTheDocument();
    expect(screen.queryByText("product.signInToSeePrice")).not.toBeInTheDocument();
  });

  it("shows the 'sign in to see price' zone for a guest on a price-hidden product", () => {
    mockAuth(false);
    mockProduct({ currentPrice: undefined, guestPrice: undefined, priceHidden: true });
    renderWithRoutes({ "/products/:id": <ProductDetails /> }, `/products/${mockProductDetail.id}`);
    expect(screen.getByText("product.signInToSeePrice")).toBeInTheDocument();
  });

  it("opens the order modal from Order Now", async () => {
    mockAuth(true);
    mockSession(UserType.CLIENT);
    vi.mocked(useClientPortalHook.useClientMe).mockReturnValue({ data: mockClientMe } as never);
    mockProduct({ currentPrice: 4500, priceHidden: false, inStock: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/products/:id": <ProductDetails /> }, `/products/${mockProductDetail.id}`);

    await user.click(screen.getByRole("button", { name: /product\.orderNow/ }));
    expect(await screen.findByLabelText("product.quantity")).toBeInTheDocument();
  });
});
