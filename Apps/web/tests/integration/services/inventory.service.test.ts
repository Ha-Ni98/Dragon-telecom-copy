import { describe, it, expect } from "vitest";
import { server } from "../../fixtures/msw/server";
import { inventoryErrorHandlers } from "../../fixtures/msw/inventory.handlers";
import {
  mockStockRows,
  mockMovementsPaginated,
  mockReservationsPaginated,
  mockAdjustmentResult,
} from "../../fixtures/data/inventory.mock";
import { mockProductWithPricing } from "../../fixtures/data/catalog.mock";
import * as inventoryService from "@/services/inventory.service";

describe("inventory.service — stock", () => {
  it("getStock returns the unwrapped array (JSON branch)", async () => {
    const result = await inventoryService.getStock();
    expect(result).toEqual(mockStockRows);
  });

  it("exportStockCsv returns a raw Blob, bypassing the envelope entirely", async () => {
    const result = await inventoryService.exportStockCsv();
    expect(result).toBeInstanceOf(Blob);
    expect(result.size).toBeGreaterThan(0);
  });
});

describe("inventory.service — movements / reservations", () => {
  it("listMovements returns the unwrapped paginated DTO", async () => {
    const result = await inventoryService.listMovements({ page: 1, limit: 20 });
    expect(result).toEqual(mockMovementsPaginated);
    // Optional numerics present on the OUT/SALE line, absent on the IN/SUPPLIER_INVOICE line.
    expect(result.items[0].costOfGoods).toBeUndefined();
    expect(result.items[1].costOfGoods).toBeDefined();
  });

  it("listMovements throws on 500", async () => {
    server.use(inventoryErrorHandlers.movementsServerError());
    await expect(inventoryService.listMovements({ page: 1, limit: 20 })).rejects.toMatchObject({
      response: { status: 500 },
    });
  });

  it("listReservations returns the unwrapped paginated DTO", async () => {
    const result = await inventoryService.listReservations({ page: 1, limit: 20 });
    expect(result).toEqual(mockReservationsPaginated);
  });
});

describe("inventory.service — adjustments", () => {
  it("createAdjustment returns the unwrapped DTO", async () => {
    const result = await inventoryService.createAdjustment({
      reason: "COUNT" as never,
      lines: [{ productId: mockProductWithPricing.id, countedQuantity: 8 }],
    });
    expect(result).toEqual(mockAdjustmentResult);
  });

  it("createAdjustment throws on a validation error", async () => {
    server.use(inventoryErrorHandlers.createAdjustmentValidationError());
    await expect(
      inventoryService.createAdjustment({
        reason: "COUNT" as never,
        lines: [{ productId: mockProductWithPricing.id, countedQuantity: -1 }],
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});
