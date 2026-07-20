import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "msw";
import type { ReactNode } from "react";
import { server } from "../../fixtures/msw/server";
import { ordersUrls } from "../../fixtures/msw/orders.handlers";
import { ok } from "../../fixtures/msw/envelope";
import {
  mockOrderPickup,
  mockOrderDelivery,
  mockOrdersList,
  mockOrderStats,
} from "../../fixtures/data/orders.mock";
import { mockProductWithPricing } from "../../fixtures/data/catalog.mock";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import { usePlaceOrder, useMyOrders, useCancelMyOrder } from "@/hooks/useOrdersPortal";
import { useOrdersList, useOrderStats, useConfirmOrder } from "@/hooks/useOrdersDirectory";
import { qk } from "@/lib/query-keys";

// A local wrapper (not the shared createQueryWrapper) so this test can reach into the same
// QueryClient instance for direct, public-API cache assertions (getQueryState) — not
// internals. Same pattern as auth.test.tsx's/clients.test.tsx's makeWrapperWithClient().
function makeWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe("useMyOrders / usePlaceOrder", () => {
  it("resolves my orders and invalidates the list on placing a new one", async () => {
    const wrapper = createQueryWrapper();
    let myOrdersCalls = 0;
    server.use(
      http.get(ordersUrls.myList, () => {
        myOrdersCalls += 1;
        return ok(mockOrdersList);
      }),
    );

    const { result: myOrdersResult } = renderHook(() => useMyOrders(), { wrapper });
    await waitFor(() => expect(myOrdersResult.current.isSuccess).toBe(true));
    expect(myOrdersCalls).toBe(1);

    const { result: placeResult } = renderHook(() => usePlaceOrder(), { wrapper });
    placeResult.current.mutate({
      productId: mockProductWithPricing.id,
      quantity: 1,
      orderType: "PICKUP" as never,
      contact: { fullName: "Amine Belkacem", phone: "0550000001" },
    });
    await waitFor(() => expect(placeResult.current.isSuccess).toBe(true));

    await waitFor(() => expect(myOrdersCalls).toBe(2));
  });
});

describe("useCancelMyOrder", () => {
  it("exposes mutate/isPending and resolves the cancelled order", async () => {
    const { result } = renderHook(() => useCancelMyOrder(), { wrapper: createQueryWrapper() });
    expect(result.current.isPending).toBe(false);
    result.current.mutate(mockOrderPickup.id);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockOrderPickup);
  });
});

describe("useOrdersList / useOrderStats", () => {
  it("resolves the backoffice list and per-status stats", async () => {
    const { result: listResult } = renderHook(
      () => useOrdersList("admin", { page: 1, limit: 20 }),
      {
        wrapper: createQueryWrapper(),
      },
    );
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));

    const { result: statsResult } = renderHook(() => useOrderStats("admin"), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(statsResult.current.isSuccess).toBe(true));
    expect(statsResult.current.data).toEqual(mockOrderStats);
  });
});

describe("useConfirmOrder — cross-domain invalidation", () => {
  it("invalidates orders, inventory, billing, clients, posClients, and stats on success", async () => {
    const { Wrapper: wrapper, queryClient } = makeWrapperWithClient();
    // Seed one cached entry per domain the mutation is expected to sweep, so we can observe
    // each becoming stale (marked invalidated) rather than guessing from network call counts.
    queryClient.setQueryData(qk.orders.all(), "seed");
    queryClient.setQueryData(qk.inventory.all(), "seed");
    queryClient.setQueryData(qk.billing.all(), "seed");
    queryClient.setQueryData(qk.clients.all(), "seed");
    queryClient.setQueryData(qk.posClients.all(), "seed");
    queryClient.setQueryData(qk.stats.all(), "seed");

    const { result } = renderHook(() => useConfirmOrder(), { wrapper });
    result.current.mutate({ scope: "admin", id: mockOrderDelivery.id, command: {} });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    for (const key of [
      qk.orders.all(),
      qk.inventory.all(),
      qk.billing.all(),
      qk.clients.all(),
      qk.posClients.all(),
      qk.stats.all(),
    ]) {
      await waitFor(() => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    }
  });
});
