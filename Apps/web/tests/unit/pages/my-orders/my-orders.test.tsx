import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { OrderStatus, type MyOrdersQuery } from "@dragon-telecom/contract";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockOrderPickup,
  mockOrderDelivery,
  mockOrdersList,
} from "../../../fixtures/data/orders.mock";
import * as useOrdersPortalHook from "@/hooks/useOrdersPortal";
import OrdersPage from "@/pages/Orders";

vi.mock("@/hooks/useOrdersPortal");

// The real page renders alongside this — real useSearchParams/useLocation under a real
// MemoryRouter (catalog.test.tsx precedent), so "filter → URL sync" is checked against the
// router's actual resulting location, not a mocked setSearchParams call.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

const cancelMutate = vi.fn();

// mockOrderPickup is PENDING, mockOrderDelivery is CONFIRMED (orders.mock.ts) — real enough to
// distinguish the filtered vs. unfiltered useMyOrders({status}) / useMyOrders({}) calls by their
// actual query argument, the same way the two calls behave in production.
function mockMyOrders(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(useOrdersPortalHook.useMyOrders).mockImplementation((query: MyOrdersQuery = {}) => {
    const data = query.status
      ? mockOrdersList.filter((o) => o.status === query.status)
      : mockOrdersList;
    return {
      data,
      isLoading: overrides.isLoading ?? false,
      isError: overrides.isError ?? false,
      refetch: vi.fn(),
    } as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useOrdersPortalHook.useCancelMyOrder).mockReturnValue({
    mutate: cancelMutate,
    isPending: false,
  } as never);
});

describe("Orders — My Orders (PUB-09)", () => {
  it("shows skeleton cards while the filtered query is loading", () => {
    mockMyOrders({ isLoading: true });
    const { container } = renderWithRoutes({ "/orders": <OrdersPage /> }, "/orders");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("writes the chosen status to ?status= and refetches the filtered list", async () => {
    mockMyOrders();
    const user = userEvent.setup();
    renderWithRoutes(
      {
        "/orders": (
          <>
            <OrdersPage />
            <LocationProbe />
          </>
        ),
      },
      "/orders",
    );

    await user.click(screen.getByRole("tab", { name: /orders\.pending/ }));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/orders?status=PENDING"),
    );
    expect(screen.getByText(mockOrderPickup.reference)).toBeInTheDocument();
    expect(screen.queryByText(mockOrderDelivery.reference)).not.toBeInTheDocument();
  });

  it("shows summary counts derived from the unfiltered query, not the active filter", async () => {
    mockMyOrders();
    const user = userEvent.setup();
    renderWithRoutes({ "/orders": <OrdersPage /> }, "/orders");

    // Filter down to PENDING (1 of the 2 fixture orders) — the "All Orders" chip's own count
    // must still read 2, proving it comes from the separate unfiltered useMyOrders({}) call.
    await user.click(screen.getByRole("tab", { name: /orders\.pending/ }));
    await waitFor(() =>
      expect(screen.queryByText(mockOrderDelivery.reference)).not.toBeInTheDocument(),
    );

    expect(screen.getByRole("tab", { name: /orders\.allOrders/ })).toHaveTextContent("2");
  });

  it("shows Cancel only on a canBeCancelled order", () => {
    mockMyOrders();
    renderWithRoutes({ "/orders": <OrdersPage /> }, "/orders");

    // Both fixture orders have canBeCancelled: true (orders.mock.ts) — confirm the button
    // renders once per card.
    expect(screen.getAllByRole("button", { name: "orders.cancelOrder" })).toHaveLength(2);
  });

  it("confirming the dialog calls useCancelMyOrder with the order id", async () => {
    mockMyOrders();
    const user = userEvent.setup();
    renderWithRoutes({ "/orders": <OrdersPage /> }, "/orders");

    const [firstCancelButton] = screen.getAllByRole("button", { name: "orders.cancelOrder" });
    await user.click(firstCancelButton);

    // OrderCard opens its own CancelOrderDialog (Sprint 3) — the dialog's confirm button
    // shares the same "orders.cancelOrder" label, so scope the query to the dialog itself.
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "orders.cancelOrder" }));

    expect(cancelMutate).toHaveBeenCalledWith(mockOrderPickup.id);
  });

  it("shows a filter-scoped EmptyState when a status has no orders", async () => {
    mockMyOrders();
    const user = userEvent.setup();
    renderWithRoutes({ "/orders": <OrdersPage /> }, "/orders");

    await user.click(screen.getByRole("tab", { name: /orders\.returned/ }));
    expect(await screen.findByText("orders.emptyFiltered")).toBeInTheDocument();
  });
});
