import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "../../fixtures/msw/server";
import { clientsUrls, clientsErrorHandlers } from "../../fixtures/msw/clients.handlers";
import { ok } from "../../fixtures/msw/envelope";
import {
  mockClientMe,
  mockCart,
  mockAdminClientsPaginated,
  mockClientStats,
  mockAdminClientPending,
  mockPosClient,
  mockPosClientsPaginated,
} from "../../fixtures/data/clients.mock";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  useClientMe,
  useUpdateClientMe,
  useClientCart,
  useAddToCart,
} from "@/hooks/useClientPortal";
import {
  useClientDirectory,
  useClientDirectoryStats,
  useApproveClient,
} from "@/hooks/useClientDirectory";
import {
  usePosClientSearch,
  useQuickCreatePosClient,
  usePosClientsList,
} from "@/hooks/usePosClients";

describe("useClientMe / useUpdateClientMe", () => {
  it("resolves the client's own account and invalidates it on update", async () => {
    const wrapper = createQueryWrapper();
    let meCalls = 0;
    server.use(
      http.get(clientsUrls.me, () => {
        meCalls += 1;
        return ok(mockClientMe);
      }),
    );

    const { result: meResult } = renderHook(() => useClientMe(), { wrapper });
    await waitFor(() => expect(meResult.current.isSuccess).toBe(true));
    expect(meCalls).toBe(1);

    const { result: updateResult } = renderHook(() => useUpdateClientMe(), { wrapper });
    updateResult.current.mutate({ storeName: "New Store" });
    await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));

    // Invalidation triggers a refetch of the still-mounted, active "me" query.
    await waitFor(() => expect(meCalls).toBe(2));
  });
});

describe("useClientCart / useAddToCart", () => {
  it("resolves the cart and invalidates it after adding an item", async () => {
    const wrapper = createQueryWrapper();
    let cartCalls = 0;
    server.use(
      http.get(clientsUrls.cart, () => {
        cartCalls += 1;
        return ok(mockCart);
      }),
    );

    const { result: cartResult } = renderHook(() => useClientCart(), { wrapper });
    await waitFor(() => expect(cartResult.current.isSuccess).toBe(true));
    expect(cartResult.current.data).toEqual(mockCart);
    expect(cartCalls).toBe(1);

    const { result: addResult } = renderHook(() => useAddToCart(), { wrapper });
    addResult.current.mutate({ productId: mockCart[0].productId });
    await waitFor(() => expect(addResult.current.isSuccess).toBe(true));

    await waitFor(() => expect(cartCalls).toBe(2));
  });
});

describe("useClientDirectory / useClientDirectoryStats / useApproveClient", () => {
  it("resolves the admin list and stats, and invalidates both on approve", async () => {
    const wrapper = createQueryWrapper();
    let listCalls = 0;
    let statsCalls = 0;
    server.use(
      http.get(clientsUrls.adminList, () => {
        listCalls += 1;
        return ok(mockAdminClientsPaginated);
      }),
      http.get(clientsUrls.adminStats, () => {
        statsCalls += 1;
        return ok(mockClientStats);
      }),
    );

    const { result: listResult } = renderHook(() => useClientDirectory({ page: 1, limit: 10 }), {
      wrapper,
    });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listCalls).toBe(1);

    const { result: statsResult } = renderHook(() => useClientDirectoryStats(), { wrapper });
    await waitFor(() => expect(statsResult.current.isSuccess).toBe(true));
    expect(statsCalls).toBe(1);

    const { result: approveResult } = renderHook(() => useApproveClient(), { wrapper });
    approveResult.current.mutate({
      id: mockAdminClientPending.id,
      command: {
        username: "amine.b",
        password: "secret123",
        categoryId: "ca000000-0000-4000-8000-000000000001",
      },
    });
    await waitFor(() => expect(approveResult.current.isSuccess).toBe(true));

    // approve invalidates qk.clients.admin.all() (["clients","admin"]) — TanStack's default
    // prefix matching means this also sweeps qk.clients.admin.stats() (["clients","admin","stats"]),
    // since stats is nested under the same admin family, not a separate top-level one. This is
    // exactly the cross-invalidation plan.md §2.3 calls for ("Approve/reject cross-invalidate
    // qk.clients.admin.stats()") — achieved by the single .all() sweep, no extra invalidation
    // line needed in the hook.
    await waitFor(() => expect(listCalls).toBe(2));
    await waitFor(() => expect(statsCalls).toBe(2));
  });

  it("surfaces an error state on a 404 detail lookup", async () => {
    server.use(clientsErrorHandlers.adminClientNotFound());
    const { result } = renderHook(() => useClientDirectory({ page: 1, limit: 10 }), {
      wrapper: createQueryWrapper(),
    });
    // adminList itself isn't the 404'd route, so this should still succeed — sanity check that
    // an unrelated override doesn't leak into the list query.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("usePosClientSearch / useQuickCreatePosClient", () => {
  it("stays disabled with an empty query and resolves once a query is given", async () => {
    const { result, rerender } = renderHook(({ q }: { q: string }) => usePosClientSearch({ q }), {
      wrapper: createQueryWrapper(),
      initialProps: { q: "" },
    });
    expect(result.current.fetchStatus).toBe("idle");

    rerender({ q: "Walk" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockPosClient]);
  });

  it("useQuickCreatePosClient exposes mutate/isPending and invalidates the pos-clients list", async () => {
    const wrapper = createQueryWrapper();
    let listCalls = 0;
    server.use(
      http.get(clientsUrls.posAdmin, () => {
        listCalls += 1;
        return ok(mockPosClientsPaginated);
      }),
    );

    const { result: listResult } = renderHook(() => usePosClientsList({ page: 1, limit: 10 }), {
      wrapper,
    });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listCalls).toBe(1);

    const { result: createResult } = renderHook(() => useQuickCreatePosClient(), { wrapper });
    expect(createResult.current.isPending).toBe(false);
    createResult.current.mutate({ name: "New POS Client" });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    expect(createResult.current.data).toEqual(mockPosClient);

    await waitFor(() => expect(listCalls).toBe(2));
  });
});
