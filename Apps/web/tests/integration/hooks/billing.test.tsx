import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "msw";
import type { ReactNode } from "react";
import { server } from "../../fixtures/msw/server";
import { billingUrls, billingErrorHandlers } from "../../fixtures/msw/billing.handlers";
import { ok } from "../../fixtures/msw/envelope";
import {
  mockInvoice,
  mockInvoicesPaginated,
  mockClientPayment,
  mockClientPaymentsPaginated,
} from "../../fixtures/data/billing.mock";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  useMyInvoices,
  useInvoices,
  useInvoice,
  useInvoicePdf,
  useCancelInvoice,
  useCreateClientPayment,
  useClientPayments,
} from "@/hooks/useBilling";
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

describe("useMyInvoices / useInvoices / useInvoice / useInvoicePdf", () => {
  it("resolves the client's paginated invoices (not a bare array)", async () => {
    const { result } = renderHook(() => useMyInvoices({ page: 1, limit: 20 }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockInvoicesPaginated);
  });

  it("resolves the scoped invoice list and the number-keyed detail", async () => {
    const { result: listResult } = renderHook(() => useInvoices("staff", { page: 1, limit: 20 }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listResult.current.data).toEqual(mockInvoicesPaginated);

    const { result: disabledResult } = renderHook(() => useInvoice("staff", ""), {
      wrapper: createQueryWrapper(),
    });
    expect(disabledResult.current.fetchStatus).toBe("idle");

    const { result: detailResult } = renderHook(() => useInvoice("staff", mockInvoice.number), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(detailResult.current.isSuccess).toBe(true));
    expect(detailResult.current.data).toEqual(mockInvoice);
  });

  it("useInvoicePdf is imperative and resolves a Blob", async () => {
    const { result } = renderHook(() => useInvoicePdf(), { wrapper: createQueryWrapper() });
    result.current.mutate({ scope: "admin", number: mockInvoice.number });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeInstanceOf(Blob);
  });
});

describe("useCancelInvoice", () => {
  it("invalidates the whole billing prefix on success", async () => {
    const { Wrapper: wrapper, queryClient } = makeWrapperWithClient();
    queryClient.setQueryData(qk.billing.all(), "seed");

    const { result } = renderHook(() => useCancelInvoice(), { wrapper });
    result.current.mutate({ number: mockInvoice.number, command: {} });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() =>
      expect(queryClient.getQueryState(qk.billing.all())?.isInvalidated).toBe(true),
    );
  });

  it("surfaces an error state on a cancel conflict", async () => {
    server.use(billingErrorHandlers.cancelConflict());
    const { result } = renderHook(() => useCancelInvoice(), { wrapper: createQueryWrapper() });
    result.current.mutate({ number: mockInvoice.number, command: {} });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateClientPayment / useClientPayments — payments has no .all() sibling", () => {
  it("invalidates the whole billing prefix (not a bare payments.list) plus client credit domains", async () => {
    const wrapper = createQueryWrapper();
    let paymentsCalls = 0;
    server.use(
      http.get(billingUrls.clientPaymentsList, () => {
        paymentsCalls += 1;
        return ok(mockClientPaymentsPaginated);
      }),
    );

    const { result: listResult } = renderHook(() => useClientPayments({ page: 1, limit: 20 }), {
      wrapper,
    });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listResult.current.data).toEqual(mockClientPaymentsPaginated);
    expect(paymentsCalls).toBe(1);

    const { result: createResult } = renderHook(() => useCreateClientPayment(), { wrapper });
    createResult.current.mutate({
      scope: "staff",
      command: { posClientId: "50000000-0000-4000-8000-000000000002", amount: 2_000 },
    });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    expect(createResult.current.data).toEqual(mockClientPayment);

    // Invalidation (qk.billing.all()) triggers a refetch of the still-mounted, active payments
    // query — isInvalidated itself is transient (Sprint 6 finding), so a call-count assertion is
    // the non-racy signal here.
    await waitFor(() => expect(paymentsCalls).toBe(2));
  });
});
