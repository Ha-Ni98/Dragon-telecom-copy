import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { ClientActivityType } from "@dragon-telecom/contract";
import { server } from "../../fixtures/msw/server";
import { observabilityErrorHandlers } from "../../fixtures/msw/observability.handlers";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  mockClientActivities,
  mockStaffSearches,
  mockAuditLogsPaginated,
  mockLogStats,
} from "../../fixtures/data/observability.mock";
import {
  useSendClientActivity,
  useSendStaffSearch,
  useClientActivity,
  useStaffSearches,
  useLogs,
  useLogStats,
} from "@/hooks/useObservability";

describe("useSendClientActivity / useSendStaffSearch — fire-and-forget beacons", () => {
  it("useSendClientActivity resolves to void on success", async () => {
    const { result } = renderHook(() => useSendClientActivity(), {
      wrapper: createQueryWrapper(),
    });
    result.current.mutate({
      type: ClientActivityType.PRODUCT_VIEW,
      productId: "10000000-0000-4000-8000-000000000002",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("useSendStaffSearch resolves to void on success", async () => {
    const { result } = renderHook(() => useSendStaffSearch(), { wrapper: createQueryWrapper() });
    result.current.mutate({ query: "galaxy s21" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  // meta:{silentErrorToast:true} only silences the global mutationCache toast (query-client.ts,
  // not exercised by createQueryWrapper's own bare QueryClient) — the hook's own error state
  // still flips as expected on a validation failure.
  it("useSendClientActivity surfaces an error state on the SEARCH+duration refine violation", async () => {
    server.use(observabilityErrorHandlers.clientBeaconSearchDurationInvalid());
    const { result } = renderHook(() => useSendClientActivity(), {
      wrapper: createQueryWrapper(),
    });
    result.current.mutate({
      type: ClientActivityType.SEARCH,
      query: "galaxy",
      durationSeconds: 10,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useClientActivity / useStaffSearches", () => {
  it("useClientActivity stays disabled without an id and resolves once one is given", () => {
    const { result } = renderHook(() => useClientActivity("", {}), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useClientActivity resolves the unwrapped array", async () => {
    const { result } = renderHook(
      () => useClientActivity("10000000-0000-4000-8000-000000000005", {}),
      { wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockClientActivities);
  });

  it("useStaffSearches resolves the unwrapped array", async () => {
    const { result } = renderHook(() => useStaffSearches({}), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStaffSearches);
  });
});

describe("useLogs / useLogStats", () => {
  it("useLogs resolves the paginated audit log list", async () => {
    const { result } = renderHook(() => useLogs({ page: 1, limit: 20 }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAuditLogsPaginated);
  });

  it("useLogStats resolves the unwrapped DTO", async () => {
    const { result } = renderHook(() => useLogStats(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockLogStats);
  });
});
