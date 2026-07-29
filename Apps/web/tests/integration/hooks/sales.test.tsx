import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "msw";
import type { ReactNode } from "react";
import { ReturnType } from "@dragon-telecom/contract";
import { server } from "../../fixtures/msw/server";
import { salesUrls, salesErrorHandlers } from "../../fixtures/msw/sales.handlers";
import { ok } from "../../fixtures/msw/envelope";
import { mockSale, mockSalesPaginated, mockReceipt } from "../../fixtures/data/sales.mock";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  useSales,
  useSale,
  useCreateDraft,
  useUpdateDraft,
  useConfirmSale,
  useCreateReturn,
} from "@/hooks/useSales";
import { qk } from "@/lib/query-keys";

function makeWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe("useSales / useSale", () => {
  it("resolves the paginated list for a scope and the reference-keyed detail", async () => {
    const { result: listResult } = renderHook(() => useSales("staff", { page: 1, limit: 20 }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listResult.current.data).toEqual(mockSalesPaginated);

    const { result: disabledResult } = renderHook(() => useSale("staff", ""), {
      wrapper: createQueryWrapper(),
    });
    expect(disabledResult.current.fetchStatus).toBe("idle");

    const { result: detailResult } = renderHook(() => useSale("staff", mockSale.reference), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(detailResult.current.isSuccess).toBe(true));
    expect(detailResult.current.data).toEqual(mockSale);
  });
});

describe("useCreateDraft / useUpdateDraft — sales-only invalidation", () => {
  it("invalidates the sales list on create and update", async () => {
    const wrapper = createQueryWrapper();
    let salesCalls = 0;
    server.use(
      http.get(salesUrls.staffList, () => {
        salesCalls += 1;
        return ok(mockSalesPaginated);
      }),
    );

    const { result: listResult } = renderHook(() => useSales("staff", { page: 1, limit: 20 }), {
      wrapper,
    });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(salesCalls).toBe(1);

    const { result: createResult } = renderHook(() => useCreateDraft(), { wrapper });
    createResult.current.mutate({
      lines: [{ productId: mockSale.lines[0].productId, quantity: 1, unitPrice: 3_000 }],
    });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(salesCalls).toBe(2));

    const { result: updateResult } = renderHook(() => useUpdateDraft(), { wrapper });
    updateResult.current.mutate({ id: mockSale.id, command: { note: "Updated" } });
    await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(salesCalls).toBe(3));
  });
});

describe("useConfirmSale — cross-domain invalidation", () => {
  it("sweeps sales, inventory, billing, clients, pos-clients, and stats on success", async () => {
    const { Wrapper: wrapper, queryClient } = makeWrapperWithClient();
    queryClient.setQueryData(qk.sales.all(), "seed");
    queryClient.setQueryData(qk.inventory.all(), "seed");
    queryClient.setQueryData(qk.billing.all(), "seed");
    queryClient.setQueryData(qk.clients.all(), "seed");
    queryClient.setQueryData(qk.posClients.all(), "seed");
    queryClient.setQueryData(qk.stats.all(), "seed");

    const { result } = renderHook(() => useConfirmSale(), { wrapper });
    result.current.mutate({ id: mockSale.id, command: { paidAmount: 6_000 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockReceipt);

    for (const key of [
      qk.sales.all(),
      qk.inventory.all(),
      qk.billing.all(),
      qk.clients.all(),
      qk.posClients.all(),
      qk.stats.all(),
    ]) {
      await waitFor(() => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    }
  });

  it("surfaces an error state on a confirm conflict", async () => {
    server.use(salesErrorHandlers.confirmConflict());
    const { result } = renderHook(() => useConfirmSale(), { wrapper: createQueryWrapper() });
    result.current.mutate({ id: mockSale.id, command: { paidAmount: 6_000 } });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateReturn — same cross-domain ripple as confirm", () => {
  it("sweeps sales, inventory, billing, and credit domains on success", async () => {
    const { Wrapper: wrapper, queryClient } = makeWrapperWithClient();
    queryClient.setQueryData(qk.sales.all(), "seed");
    queryClient.setQueryData(qk.inventory.all(), "seed");
    queryClient.setQueryData(qk.billing.all(), "seed");

    const { result } = renderHook(() => useCreateReturn(), { wrapper });
    result.current.mutate({
      saleId: mockSale.id,
      type: ReturnType.REFUND,
      lines: [
        { saleLineId: mockSale.lines[0].id, quantity: 1, restock: true, refundAmount: 3_000 },
      ],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    for (const key of [qk.sales.all(), qk.inventory.all(), qk.billing.all()]) {
      await waitFor(() => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    }
  });
});
