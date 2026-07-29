import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "msw";
import type { ReactNode } from "react";
import { RepairStatus, ReportedIssue } from "@dragon-telecom/contract";
import { server } from "../../fixtures/msw/server";
import { repairsUrls, repairsErrorHandlers } from "../../fixtures/msw/repairs.handlers";
import { ok } from "../../fixtures/msw/envelope";
import { mockRepair, mockRepairs } from "../../fixtures/data/repairs.mock";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  useRepairs,
  useCreateRepair,
  useUpdateRepair,
  useAddRepairPart,
  useRemoveRepairPart,
  useUpdateRepairStatus,
} from "@/hooks/useRepairs";
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

describe("useRepairs — bare array, no pagination", () => {
  it("resolves the repair list for a scope", async () => {
    const { result } = renderHook(() => useRepairs("staff", {}), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRepairs);
  });
});

describe("useCreateRepair / useUpdateRepair — repairs-only invalidation", () => {
  it("invalidates the repair list on create and update", async () => {
    const wrapper = createQueryWrapper();
    let repairsCalls = 0;
    server.use(
      http.get(repairsUrls.staffList, () => {
        repairsCalls += 1;
        return ok(mockRepairs);
      }),
    );

    const { result: listResult } = renderHook(() => useRepairs("staff", {}), { wrapper });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(repairsCalls).toBe(1);

    const { result: createResult } = renderHook(() => useCreateRepair(), { wrapper });
    createResult.current.mutate({
      scope: "staff",
      command: {
        customerName: "Karim Bensaid",
        customerPhone: "0555000222",
        reportedIssues: [ReportedIssue.DISPLAY],
      },
    });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(repairsCalls).toBe(2));

    const { result: updateResult } = renderHook(() => useUpdateRepair(), { wrapper });
    updateResult.current.mutate({
      scope: "staff",
      id: mockRepair.id,
      command: { diagnosis: "Updated" },
    });
    await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(repairsCalls).toBe(3));
  });
});

describe("useAddRepairPart / useRemoveRepairPart — cross-invalidates inventory", () => {
  it("sweeps repairs + inventory on both add and remove", async () => {
    const { Wrapper: wrapper, queryClient } = makeWrapperWithClient();
    queryClient.setQueryData(qk.repairs.all(), "seed-add");
    queryClient.setQueryData(qk.inventory.all(), "seed-add");

    const { result: addResult } = renderHook(() => useAddRepairPart(), { wrapper });
    addResult.current.mutate({
      scope: "staff",
      id: mockRepair.id,
      command: { productId: mockRepair.parts[0].productId, quantity: 1, unitPrice: 4_500 },
    });
    await waitFor(() => expect(addResult.current.isSuccess).toBe(true));
    await waitFor(() =>
      expect(queryClient.getQueryState(qk.repairs.all())?.isInvalidated).toBe(true),
    );
    await waitFor(() =>
      expect(queryClient.getQueryState(qk.inventory.all())?.isInvalidated).toBe(true),
    );

    queryClient.setQueryData(qk.repairs.all(), "seed-remove");
    queryClient.setQueryData(qk.inventory.all(), "seed-remove");

    const { result: removeResult } = renderHook(() => useRemoveRepairPart(), { wrapper });
    removeResult.current.mutate({
      scope: "staff",
      id: mockRepair.id,
      partId: mockRepair.parts[0].id,
    });
    await waitFor(() => expect(removeResult.current.isSuccess).toBe(true));
    await waitFor(() =>
      expect(queryClient.getQueryState(qk.repairs.all())?.isInvalidated).toBe(true),
    );
    await waitFor(() =>
      expect(queryClient.getQueryState(qk.inventory.all())?.isInvalidated).toBe(true),
    );
  });
});

describe("useUpdateRepairStatus — cross-invalidates inventory + billing", () => {
  it("sweeps repairs, inventory, and billing on a status transition", async () => {
    const { Wrapper: wrapper, queryClient } = makeWrapperWithClient();
    queryClient.setQueryData(qk.repairs.all(), "seed");
    queryClient.setQueryData(qk.inventory.all(), "seed");
    queryClient.setQueryData(qk.billing.all(), "seed");

    const { result } = renderHook(() => useUpdateRepairStatus(), { wrapper });
    result.current.mutate({
      scope: "staff",
      id: mockRepair.id,
      command: { toStatus: RepairStatus.COMPLETED },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    for (const key of [qk.repairs.all(), qk.inventory.all(), qk.billing.all()]) {
      await waitFor(() => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    }
  });

  it("surfaces an error state on a 404 (repair not found)", async () => {
    server.use(repairsErrorHandlers.repairNotFound());
    const { result } = renderHook(() => useUpdateRepair(), { wrapper: createQueryWrapper() });
    result.current.mutate({
      scope: "staff",
      id: "60000000-0000-4000-8000-000000000099",
      command: {},
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
