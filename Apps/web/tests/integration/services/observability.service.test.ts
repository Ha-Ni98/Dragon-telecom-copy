import { describe, it, expect } from "vitest";
import { ClientActivityType } from "@dragon-telecom/contract";
import { server } from "../../fixtures/msw/server";
import { observabilityErrorHandlers } from "../../fixtures/msw/observability.handlers";
import {
  mockClientActivities,
  mockStaffSearches,
  mockAuditLogsPaginated,
  mockLogStats,
} from "../../fixtures/data/observability.mock";
import * as observabilityService from "@/services/observability.service";

describe("observability.service — beacons (202 + null envelope)", () => {
  it("sendClientActivity resolves to void on a 202 null-data envelope", async () => {
    await expect(
      observabilityService.sendClientActivity({
        type: ClientActivityType.PRODUCT_VIEW,
        productId: "10000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toBeUndefined();
  });

  it("sendStaffSearch resolves to void on a 202 null-data envelope", async () => {
    await expect(
      observabilityService.sendStaffSearch({ query: "galaxy s21" }),
    ).resolves.toBeUndefined();
  });

  it("sendClientActivity throws on the SEARCH+duration refine violation (400)", async () => {
    server.use(observabilityErrorHandlers.clientBeaconSearchDurationInvalid());
    await expect(
      observabilityService.sendClientActivity({
        type: ClientActivityType.SEARCH,
        query: "galaxy",
        durationSeconds: 10,
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});

describe("observability.service — reads", () => {
  it("getClientActivity substitutes the :id param and returns the unwrapped array", async () => {
    const result = await observabilityService.getClientActivity(
      "10000000-0000-4000-8000-000000000005",
      {},
    );
    expect(result).toEqual(mockClientActivities);
  });

  it("listStaffSearches returns the unwrapped array", async () => {
    expect(await observabilityService.listStaffSearches({})).toEqual(mockStaffSearches);
  });

  it("listLogs returns the unwrapped paginated result", async () => {
    expect(await observabilityService.listLogs({ page: 1, limit: 20 })).toEqual(
      mockAuditLogsPaginated,
    );
  });

  it("logStats returns the unwrapped DTO", async () => {
    expect(await observabilityService.logStats()).toEqual(mockLogStats);
  });
});
