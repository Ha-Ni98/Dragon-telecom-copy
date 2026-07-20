import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "msw";
import type { ReactNode } from "react";
import { server } from "../../fixtures/msw/server";
import { purchasingUrls, purchasingErrorHandlers } from "../../fixtures/msw/purchasing.handlers";
import { ok } from "../../fixtures/msw/envelope";
import {
  mockSuppliersPaginated,
  mockSupplier,
  mockSupplierStats,
  mockSupplierInvoicesPaginated,
  mockSupplierInvoiceDraft,
  mockConfirmResult,
  mockSupplierPaymentsPaginated,
  mockSupplierPayment,
} from "../../fixtures/data/purchasing.mock";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  usePurchasingSuppliers,
  usePurchasingSupplierStats,
  usePurchasingSupplierDetail,
  useCreatePurchasingSupplier,
} from "@/hooks/usePurchasingSuppliers";
import {
  usePurchasingInvoices,
  usePurchasingInvoiceDetail,
  useCreatePurchasingInvoice,
  useConfirmPurchasingInvoice,
} from "@/hooks/usePurchasingInvoices";
import { usePurchasingPayments, useCreatePurchasingPayment } from "@/hooks/usePurchasingPayments";
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

describe("usePurchasingSuppliers / useCreatePurchasingSupplier", () => {
  it("resolves suppliers/stats/detail and invalidates the list on create", async () => {
    const wrapper = createQueryWrapper();
    let suppliersCalls = 0;
    server.use(
      http.get(purchasingUrls.suppliers, () => {
        suppliersCalls += 1;
        return ok(mockSuppliersPaginated);
      }),
    );

    const { result: listResult } = renderHook(
      () => usePurchasingSuppliers({ page: 1, limit: 10 }),
      { wrapper },
    );
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(suppliersCalls).toBe(1);

    const { result: statsResult } = renderHook(() => usePurchasingSupplierStats(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(statsResult.current.isSuccess).toBe(true));
    expect(statsResult.current.data).toEqual(mockSupplierStats);

    const { result: detailResult } = renderHook(
      () => usePurchasingSupplierDetail(mockSupplier.id),
      {
        wrapper: createQueryWrapper(),
      },
    );
    await waitFor(() => expect(detailResult.current.isSuccess).toBe(true));

    const { result: createResult } = renderHook(() => useCreatePurchasingSupplier(), { wrapper });
    createResult.current.mutate({ name: "New Supplier" });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));

    await waitFor(() => expect(suppliersCalls).toBe(2));
  });
});

describe("usePurchasingInvoices / useCreatePurchasingInvoice", () => {
  it("resolves invoices/detail and invalidates the list + suppliers on create", async () => {
    const { Wrapper: wrapper, queryClient } = makeWrapperWithClient();
    queryClient.setQueryData(qk.purchasing.suppliers.all(), "seed");

    const { result: listResult } = renderHook(() => usePurchasingInvoices({ page: 1, limit: 10 }), {
      wrapper,
    });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listResult.current.data).toEqual(mockSupplierInvoicesPaginated);

    const { result: detailResult } = renderHook(
      () => usePurchasingInvoiceDetail(mockSupplierInvoiceDraft.id),
      {
        wrapper,
      },
    );
    await waitFor(() => expect(detailResult.current.isSuccess).toBe(true));

    const { result: createResult } = renderHook(() => useCreatePurchasingInvoice(), { wrapper });
    createResult.current.mutate({
      supplierId: mockSupplier.id,
      invoiceDate: "2026-01-05",
      lines: [{ productId: "10000000-0000-4000-8000-000000000002", quantity: 10, unitCost: 3000 }],
    });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));

    await waitFor(() =>
      expect(queryClient.getQueryState(qk.purchasing.suppliers.all())?.isInvalidated).toBe(true),
    );
  });
});

describe("useConfirmPurchasingInvoice — cross-domain invalidation", () => {
  it("invalidates purchasing, inventory, and catalog admin products on success", async () => {
    const { Wrapper: wrapper, queryClient } = makeWrapperWithClient();
    queryClient.setQueryData(qk.purchasing.invoices.all(), "seed");
    queryClient.setQueryData(qk.purchasing.suppliers.all(), "seed");
    queryClient.setQueryData(qk.inventory.all(), "seed");
    queryClient.setQueryData(qk.catalog.adminProducts.all(), "seed");

    const { result } = renderHook(() => useConfirmPurchasingInvoice(), { wrapper });
    result.current.mutate(mockSupplierInvoiceDraft.id);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockConfirmResult);

    for (const key of [
      qk.purchasing.invoices.all(),
      qk.purchasing.suppliers.all(),
      qk.inventory.all(),
      qk.catalog.adminProducts.all(),
    ]) {
      await waitFor(() => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    }
  });

  it("surfaces an error state on a conflict (already confirmed)", async () => {
    server.use(purchasingErrorHandlers.confirmInvoiceConflict());
    const { result } = renderHook(() => useConfirmPurchasingInvoice(), {
      wrapper: createQueryWrapper(),
    });
    result.current.mutate(mockSupplierInvoiceDraft.id);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("usePurchasingPayments / useCreatePurchasingPayment", () => {
  it("resolves payments and invalidates the whole purchasing prefix on create", async () => {
    const wrapper = createQueryWrapper();
    let paymentsCalls = 0;
    server.use(
      http.get(purchasingUrls.payments, () => {
        paymentsCalls += 1;
        return ok(mockSupplierPaymentsPaginated);
      }),
    );

    const { result: listResult } = renderHook(() => usePurchasingPayments({ page: 1, limit: 10 }), {
      wrapper,
    });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listResult.current.data).toEqual(mockSupplierPaymentsPaginated);
    expect(paymentsCalls).toBe(1);

    const { result: createResult } = renderHook(() => useCreatePurchasingPayment(), { wrapper });
    createResult.current.mutate({ supplierId: mockSupplier.id, amount: 20000 });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    expect(createResult.current.data).toEqual(mockSupplierPayment);

    // Invalidation (qk.purchasing.all()) triggers a refetch of the still-mounted, active
    // payments query — isInvalidated itself is transient and clears the instant that
    // automatic refetch resolves, so a call-count assertion is the non-racy signal here.
    await waitFor(() => expect(paymentsCalls).toBe(2));
  });
});
