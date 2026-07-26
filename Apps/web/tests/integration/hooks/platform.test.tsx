import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "../../fixtures/msw/server";
import { platformUrls } from "../../fixtures/msw/platform.handlers";
import { ok } from "../../fixtures/msw/envelope";
import {
  mockWilayas,
  mockAdminFees,
  mockSettings,
  mockPublicSettings,
} from "../../fixtures/data/platform.mock";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  useWilayas,
  usePlatformDeliveryFee,
  useAdminDeliveryFees,
  useUpsertAdminDeliveryFees,
  usePlatformSettings,
  useUpdatePlatformSettings,
  usePublicSettings,
} from "@/hooks/usePlatform";

describe("useWilayas", () => {
  it("resolves the wilaya list", async () => {
    const { result } = renderHook(() => useWilayas(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockWilayas);
  });
});

describe("usePlatformDeliveryFee", () => {
  it("stays disabled without a wilayaId and resolves once one is given", () => {
    const { result } = renderHook(() => usePlatformDeliveryFee({ wilayaId: "" }), {
      wrapper: createQueryWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useAdminDeliveryFees / useUpsertAdminDeliveryFees", () => {
  it("resolves the admin fee grid and invalidates it on upsert", async () => {
    const wrapper = createQueryWrapper();
    let feesCalls = 0;
    server.use(
      http.get(platformUrls.adminFees, () => {
        feesCalls += 1;
        return ok(mockAdminFees);
      }),
    );

    const { result: feesResult } = renderHook(() => useAdminDeliveryFees(), { wrapper });
    await waitFor(() => expect(feesResult.current.isSuccess).toBe(true));
    expect(feesCalls).toBe(1);

    const { result: upsertResult } = renderHook(() => useUpsertAdminDeliveryFees(), { wrapper });
    upsertResult.current.mutate({
      rows: [{ wilayaId: mockWilayas[0].id, deliveryHome: 600, deliveryOffice: 350 }],
    });
    await waitFor(() => expect(upsertResult.current.isSuccess).toBe(true));

    await waitFor(() => expect(feesCalls).toBe(2));
  });
});

describe("usePlatformSettings / useUpdatePlatformSettings / usePublicSettings", () => {
  it("invalidates both settings and publicSettings on update", async () => {
    const wrapper = createQueryWrapper();
    let settingsCalls = 0;
    let publicSettingsCalls = 0;
    server.use(
      http.get(platformUrls.settings, () => {
        settingsCalls += 1;
        return ok(mockSettings);
      }),
      http.get(platformUrls.settingsPublic, () => {
        publicSettingsCalls += 1;
        return ok(mockPublicSettings);
      }),
    );

    const { result: settingsResult } = renderHook(() => usePlatformSettings(), { wrapper });
    await waitFor(() => expect(settingsResult.current.isSuccess).toBe(true));
    expect(settingsCalls).toBe(1);

    const { result: publicResult } = renderHook(() => usePublicSettings(), { wrapper });
    await waitFor(() => expect(publicResult.current.isSuccess).toBe(true));
    expect(publicSettingsCalls).toBe(1);

    const { result: updateResult } = renderHook(() => useUpdatePlatformSettings(), { wrapper });
    updateResult.current.mutate({ store: { name: "New Name" } });
    await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));

    await waitFor(() => expect(settingsCalls).toBe(2));
    await waitFor(() => expect(publicSettingsCalls).toBe(2));
  });
});
