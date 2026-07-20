import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockCart, mockCartItem } from "../../../fixtures/data/clients.mock";
import { mockWilayas, mockFeeDefault } from "../../../fixtures/data/platform.mock";
import { mockOrderPickup } from "../../../fixtures/data/orders.mock";
import * as useClientPortalHook from "@/hooks/useClientPortal";
import * as usePlatformHook from "@/hooks/usePlatform";
import * as useOrdersPortalHook from "@/hooks/useOrdersPortal";
import * as AuthProviderModule from "@/components/providers/AuthProvider";
import Cart from "@/pages/cart/Cart";

vi.mock("@/hooks/useClientPortal");
vi.mock("@/hooks/usePlatform");
vi.mock("@/hooks/useOrdersPortal");
vi.mock("@/components/providers/AuthProvider");

// ProductOrderModal (rendered by Cart when a row's Order is clicked) calls useAuth() directly
// to gate PICKUP — same requirement order-form.test.tsx's own suite already established.
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

// The real page renders alongside this — real useLocation under a real MemoryRouter, so the
// post-submit navigate target is checked against the router's actual resulting location
// (set-01/Sub-02 precedent), not a mocked useNavigate call.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const removeMutate = vi.fn();
const placeOrderMutateAsync = vi.fn();

function mockCartQuery(
  data: typeof mockCart | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useClientPortalHook.useClientCart).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: vi.fn(),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth(true); // Cart is a CLIENT-only route (App.tsx) — always an authenticated session.
  vi.mocked(useClientPortalHook.useRemoveFromCart).mockReturnValue({
    mutate: removeMutate,
    isPending: false,
  } as never);
  vi.mocked(usePlatformHook.useWilayas).mockReturnValue({ data: mockWilayas } as never);
  vi.mocked(usePlatformHook.usePlatformDeliveryFee).mockReturnValue({
    data: mockFeeDefault,
    isLoading: false,
  } as never);
  vi.mocked(useOrdersPortalHook.usePlaceOrder).mockReturnValue({
    mutateAsync: placeOrderMutateAsync,
    isPending: false,
  } as never);
});

describe("Cart (PUB-04)", () => {
  it("shows a skeleton list while the cart query is loading", () => {
    mockCartQuery(undefined, { isLoading: true });
    const { container } = renderWithRoutes({ "/cart": <Cart /> }, "/cart");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a local error with retry when the cart query fails", () => {
    mockCartQuery(undefined, { isError: true });
    renderWithRoutes({ "/cart": <Cart /> }, "/cart");
    expect(screen.getByText("cart.errorLoading")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.actions.tryAgain" })).toBeInTheDocument();
  });

  it("shows EmptyState with a catalog link when the cart is empty", () => {
    mockCartQuery([]);
    renderWithRoutes({ "/cart": <Cart /> }, "/cart");
    expect(screen.getByText("cart.empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "orders.startShopping" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("opens the order modal for a priced, in-stock row", async () => {
    mockCartQuery(mockCart);
    const user = userEvent.setup();
    renderWithRoutes({ "/cart": <Cart /> }, "/cart");

    await user.click(screen.getByRole("button", { name: "cart.order" }));
    expect(await screen.findByLabelText("product.quantity")).toBeInTheDocument();
  });

  it("disables Order and shows 'price on request' for a priceHidden row", () => {
    const hiddenItem = {
      ...mockCartItem,
      productId: "10000000-0000-4000-8000-000000000099",
      product: {
        ...mockCartItem.product,
        priceHidden: true,
        currentPrice: undefined,
        guestPrice: undefined,
      },
    };
    mockCartQuery([hiddenItem]);
    renderWithRoutes({ "/cart": <Cart /> }, "/cart");

    expect(screen.getByText("cart.priceOnRequest")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "cart.order" })).toBeDisabled();
  });

  it("removes a favorite by productId", async () => {
    mockCartQuery(mockCart);
    const user = userEvent.setup();
    renderWithRoutes({ "/cart": <Cart /> }, "/cart");

    await user.click(screen.getByRole("button", { name: "cart.remove" }));
    expect(removeMutate).toHaveBeenCalledWith(mockCartItem.productId);
  });

  it("navigates to /order-confirmation with the placed order after a successful submit", async () => {
    mockCartQuery(mockCart);
    placeOrderMutateAsync.mockResolvedValue(mockOrderPickup);
    const user = userEvent.setup();
    renderWithRoutes(
      {
        "/cart": (
          <>
            <Cart />
            <LocationProbe />
          </>
        ),
        "/order-confirmation": <LocationProbe />,
      },
      "/cart",
    );

    await user.click(screen.getByRole("button", { name: "cart.order" }));
    await user.type(await screen.findByLabelText("product.fullName"), "Amine Belkacem");
    await user.type(screen.getByLabelText("product.phone"), "0550000001");
    await user.click(screen.getByRole("button", { name: "product.confirmOrder" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/order-confirmation"),
    );
  });
});
