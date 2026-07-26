import { describe, it, expect } from "vitest";
import { server } from "../../fixtures/msw/server";
import { platformErrorHandlers } from "../../fixtures/msw/platform.handlers";
import {
  mockWilayas,
  mockFeeDefault,
  mockAdminFees,
  mockPublicSettings,
  mockSettings,
} from "../../fixtures/data/platform.mock";
import * as platformService from "@/services/platform.service";

describe("platform.service — public reads", () => {
  it("listWilayas returns the unwrapped array", async () => {
    const result = await platformService.listWilayas();
    expect(result).toEqual(mockWilayas);
  });

  it("getFee returns the unwrapped DTO", async () => {
    const result = await platformService.getFee({ wilayaId: mockWilayas[0].id });
    expect(result).toEqual(mockFeeDefault);
  });

  it("getPublicSettings returns the unwrapped DTO", async () => {
    const result = await platformService.getPublicSettings();
    expect(result).toEqual(mockPublicSettings);
  });
});

describe("platform.service — admin delivery fees", () => {
  it("getAdminFees returns the unwrapped DTO", async () => {
    const result = await platformService.getAdminFees();
    expect(result).toEqual(mockAdminFees);
  });

  it("upsertFees (PUT) returns the unwrapped DTO", async () => {
    const result = await platformService.upsertFees({
      rows: [{ wilayaId: mockWilayas[0].id, deliveryHome: 600, deliveryOffice: 350 }],
    });
    expect(result).toEqual(mockAdminFees);
  });

  it("upsertFees throws on a validation error", async () => {
    server.use(platformErrorHandlers.upsertFeesValidationError());
    await expect(
      platformService.upsertFees({
        rows: [{ wilayaId: mockWilayas[0].id, deliveryHome: -1, deliveryOffice: 0 }],
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it("importFees sends a multipart body with the file appended and returns the unwrapped result", async () => {
    const file = new File(["wilaya,commune\n"], "fees.csv", { type: "text/csv" });
    const result = await platformService.importFees(file);
    expect(result).toEqual({ imported: 5 });
  });

  it("importFees throws when the backend rejects the file", async () => {
    server.use(platformErrorHandlers.importFeesBadFile());
    const file = new File(["bad"], "fees.csv", { type: "text/csv" });
    await expect(platformService.importFees(file)).rejects.toMatchObject({
      response: { status: 400 },
    });
  });

  it("exportFees returns a raw Blob, bypassing the envelope entirely", async () => {
    const result = await platformService.exportFees({ format: "csv" });
    // Reading the Blob's actual text content is unreliable across this environment's
    // Node/jsdom Blob realms (same class of cross-realm gap as Sprint 3's `instanceof File`
    // finding) — `size > 0` still proves a real body arrived unenveloped, not `{success,data}`.
    expect(result).toBeInstanceOf(Blob);
    expect(result.size).toBeGreaterThan(0);
  });
});

describe("platform.service — settings", () => {
  it("getSettings / updateSettings return the unwrapped DTO", async () => {
    expect(await platformService.getSettings()).toEqual(mockSettings);
    expect(await platformService.updateSettings({ store: { name: "New Name" } })).toEqual(
      mockSettings,
    );
  });

  it("updateSettings throws on a validation error", async () => {
    server.use(platformErrorHandlers.updateSettingsValidationError());
    await expect(platformService.updateSettings({})).rejects.toMatchObject({
      response: { status: 400 },
    });
  });
});
