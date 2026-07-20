import { describe, it, expect } from "vitest";
import { RepairStatus, ReportedIssue } from "@dragon-telecom/contract";
import { server } from "../../fixtures/msw/server";
import { repairsErrorHandlers } from "../../fixtures/msw/repairs.handlers";
import { mockRepair, mockRepairs } from "../../fixtures/data/repairs.mock";
import * as repairsService from "@/services/repairs.service";

describe("repairs.service — list & create (scope-parameterized)", () => {
  it("listRepairs resolves the unwrapped bare array for both scopes (no pagination)", async () => {
    expect(await repairsService.listRepairs("staff", {})).toEqual(mockRepairs);
    expect(await repairsService.listRepairs("admin", {})).toEqual(mockRepairs);
  });

  it("createRepair returns the unwrapped DTO", async () => {
    const result = await repairsService.createRepair("staff", {
      customerName: "Karim Bensaid",
      customerPhone: "0555000222",
      reportedIssues: [ReportedIssue.DISPLAY],
    });
    expect(result).toEqual(mockRepair);
  });

  it("createRepair throws on an empty-reportedIssues validation error", async () => {
    server.use(repairsErrorHandlers.createRepairEmptyIssues());
    await expect(
      repairsService.createRepair("staff", {
        customerName: "Karim Bensaid",
        customerPhone: "0555000222",
        reportedIssues: [],
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});

describe("repairs.service — update & parts", () => {
  it("updateRepair returns the unwrapped DTO", async () => {
    expect(
      await repairsService.updateRepair("staff", mockRepair.id, { diagnosis: "Updated" }),
    ).toEqual(mockRepair);
  });

  it("updateRepair throws on a 404", async () => {
    server.use(repairsErrorHandlers.repairNotFound());
    await expect(
      repairsService.updateRepair("staff", "60000000-0000-4000-8000-000000000099", {}),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it("addRepairPart / removeRepairPart return the unwrapped DTO", async () => {
    expect(
      await repairsService.addRepairPart("staff", mockRepair.id, {
        productId: mockRepair.parts[0].productId,
        quantity: 1,
        unitPrice: 4_500,
      }),
    ).toEqual(mockRepair);
    // removeRepairPart returns the updated RepairDto (200), not void — confirmed against
    // repairs.controller.ts.
    expect(
      await repairsService.removeRepairPart("staff", mockRepair.id, mockRepair.parts[0].id),
    ).toEqual(mockRepair);
  });
});

describe("repairs.service — status", () => {
  it("updateRepairStatus (POST, not PATCH) returns the unwrapped DTO", async () => {
    const result = await repairsService.updateRepairStatus("staff", mockRepair.id, {
      toStatus: RepairStatus.COMPLETED,
    });
    expect(result).toEqual(mockRepair);
  });
});
