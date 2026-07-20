import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UserType, type OrderDto } from "@dragon-telecom/contract";
import "../../../fixtures/wrappers/mockTranslation";
import { mockOrderDelivery } from "../../../fixtures/data/orders.mock";
import * as useSessionHook from "@/hooks/useSession";
import OrderConfirmation from "@/pages/order-confirmation/OrderConfirmation";

vi.mock("@/hooks/useSession");

function mockSession(type: UserType | null) {
  vi.mocked(useSessionHook.useSession).mockReturnValue({
    data: type ? { userId: "1", type, staffId: null, profile: null } : undefined,
  } as never);
}

// No shared renderWithRoutes helper carries router *state* — mirrors redirect.test.tsx's own
// local MemoryRouter/initialEntries-with-state pattern.
function renderConfirmation(order?: OrderDto) {
  const initialEntries = order
    ? [{ pathname: "/order-confirmation", state: { order } }]
    : ["/order-confirmation"];
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<div>Public Home</div>} />
        <Route path="/order-confirmation" element={<OrderConfirmation />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrderConfirmation (PUB-05)", () => {
  it("redirects to / when no order is in router state", () => {
    mockSession(null);
    renderConfirmation();
    expect(screen.getByText("Public Home")).toBeInTheDocument();
  });

  it("renders the reference, product line, total, and mode from the placed order", () => {
    mockSession(UserType.CLIENT);
    renderConfirmation(mockOrderDelivery);

    expect(screen.getByText(mockOrderDelivery.reference)).toBeInTheDocument();
    expect(
      screen.getByText(`${mockOrderDelivery.productName} × ${mockOrderDelivery.quantity}`),
    ).toBeInTheDocument();
    expect(screen.getByText(/9,500/)).toBeInTheDocument(); // totalAmount
    expect(screen.getByText("product.deliveryToHome")).toBeInTheDocument();
    expect(screen.getByText("orderConfirmation.pendingMessage")).toBeInTheDocument();
  });

  it("shows the My Orders link only for a CLIENT session", () => {
    mockSession(UserType.CLIENT);
    renderConfirmation(mockOrderDelivery);
    expect(screen.getByRole("link", { name: "account.seeMyOrders" })).toHaveAttribute(
      "href",
      "/orders",
    );
  });

  it("hides the My Orders link for a guest", () => {
    mockSession(null);
    renderConfirmation(mockOrderDelivery);
    expect(screen.queryByRole("link", { name: "account.seeMyOrders" })).not.toBeInTheDocument();
    // The catalog CTA still renders regardless of session.
    expect(screen.getByRole("link", { name: "orderConfirmation.backToCatalog" })).toHaveAttribute(
      "href",
      "/products",
    );
  });
});
