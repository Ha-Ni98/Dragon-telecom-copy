import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockProductDetail } from "../../../fixtures/data/catalog.mock";
import { mockWilaya, mockWilayas, mockFeeDefault } from "../../../fixtures/data/platform.mock";
import * as AuthProviderModule from "@/components/providers/AuthProvider";
import { ProductOrderModal } from "@/components/shared/ProductOrderModal";

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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const priced = { ...mockProductDetail, currentPrice: 4500, guestPrice: undefined };

function renderModal(props: Partial<React.ComponentProps<typeof ProductOrderModal>> = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWithRoutes(
    {
      "/": (
        <>
          <ProductOrderModal
            isOpen
            onClose={onClose}
            product={priced}
            quantity={1}
            wilayas={mockWilayas}
            fee={mockFeeDefault}
            isFeeLoading={false}
            onSubmit={onSubmit}
            {...props}
          />
          <LocationProbe />
        </>
      ),
      "/login": <LocationProbe />,
    },
    "/",
  );
  return { onClose, onSubmit };
}

async function fillContact(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("product.fullName"), "Amine Belkacem");
  await user.type(screen.getByLabelText("product.phone"), "0550000001");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductOrderModal (PUB-03 order form)", () => {
  it("pickup hides the wilaya/commune selects and charges no delivery fee", () => {
    mockAuth(true);
    renderModal();
    // Pickup is the default orderType for an authenticated viewer.
    expect(screen.queryByText("product.selectWilaya")).not.toBeInTheDocument();
    // The rendered node is "product.deliveryFee:" (colon appended outside the t() call) —
    // match by substring rather than the exact translated-key text.
    expect(screen.queryByText(/product\.deliveryFee/)).not.toBeInTheDocument();
    // subtotal === total when the delivery fee is 0 (pickup) — both rows show the same amount.
    expect(screen.getAllByText("4,500 DA")).toHaveLength(2);
  });

  it("gates the fee row until wilaya + commune are both chosen", async () => {
    mockAuth(false); // guest defaults to DELIVERY_HOME
    const user = userEvent.setup();
    renderModal();

    // The rendered node is "product.deliveryFee:" (colon appended outside the t() call) —
    // match by substring rather than the exact translated-key text.
    expect(screen.queryByText(/product\.deliveryFee/)).not.toBeInTheDocument();

    // The placeholder <span> itself is pointer-events:none (Radix Select internals) — click
    // the trigger button that contains it instead.
    await user.click(screen.getByText("product.selectWilaya").closest("button")!);
    await user.click(await screen.findByRole("option", { name: mockWilaya.frName }));
    expect(screen.queryByText(/product\.deliveryFee/)).not.toBeInTheDocument();

    await user.click(screen.getByText("product.selectCommune").closest("button")!);
    await user.click(await screen.findByRole("option", { name: mockWilaya.communes[0].frName }));

    expect(await screen.findByText(/product\.deliveryFee/)).toBeInTheDocument();
  });

  it("renders the server's 409 INSUFFICIENT_STOCK on the quantity field", async () => {
    mockAuth(true);
    const user = userEvent.setup();
    const { onSubmit } = renderModal();
    onSubmit.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { code: "INSUFFICIENT_STOCK" } } },
    });

    await fillContact(user);
    await user.click(screen.getByRole("button", { name: "product.confirmOrder" }));

    expect(await screen.findByText("product.quantityExceedsStock")).toBeInTheDocument();
  });

  it("closes and redirects to /login on a 403 GUEST_PRICE_HIDDEN", async () => {
    mockAuth(true);
    const user = userEvent.setup();
    const { onClose, onSubmit } = renderModal();
    onSubmit.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { code: "GUEST_PRICE_HIDDEN" } } },
    });

    await fillContact(user);
    await user.click(screen.getByRole("button", { name: "product.confirmOrder" }));

    expect(await screen.findByTestId("location")).toHaveTextContent("/login");
    expect(onClose).toHaveBeenCalled();
  });
});
