import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "../../fixtures/msw/server";
import { inventoryUrls } from "../../fixtures/msw/inventory.handlers";
import { ok } from "../../fixtures/msw/envelope";
import {
  mockStockRows,
  mockMovementsPaginated,
  mockReservationsPaginated,
  mockAdjustmentResult,
} from "../../fixtures/data/inventory.mock";
import { mockProductWithPricing } from "../../fixtures/data/catalog.mock";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  useStock,
  useExportStockCsv,
  useMovements,
  useReservations,
  useCreateAdjustment,
} from "@/hooks/useInventory";

describe("useStock / useExportStockCsv", () => {
  it("resolves the stock list", async () => {
    const { result } = renderHook(() => useStock(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStockRows);
  });

  it("useExportStockCsv resolves a Blob on demand", async () => {
    const { result } = renderHook(() => useExportStockCsv(), { wrapper: createQueryWrapper() });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeInstanceOf(Blob);
  });
});

describe("useMovements / useReservations", () => {
  it("resolves movements and reservations", async () => {
    const { result: movementsResult } = renderHook(() => useMovements({ page: 1, limit: 20 }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(movementsResult.current.isSuccess).toBe(true));
    expect(movementsResult.current.data).toEqual(mockMovementsPaginated);

    const { result: reservationsResult } = renderHook(
      () => useReservations({ page: 1, limit: 20 }),
      {
        wrapper: createQueryWrapper(),
      },
    );
    await waitFor(() => expect(reservationsResult.current.isSuccess).toBe(true));
    expect(reservationsResult.current.data).toEqual(mockReservationsPaginated);
  });
});

describe("useCreateAdjustment — cross-domain invalidation", () => {
  it("invalidates inventory and the still-mounted admin product stats on success", async () => {
    const wrapper = createQueryWrapper();
    let stockCalls = 0;
    server.use(
      http.get(inventoryUrls.stock, () => {
        stockCalls += 1;
        return ok(mockStockRows);
      }),
    );

    const { result: stockResult } = renderHook(() => useStock(), { wrapper });
    await waitFor(() => expect(stockResult.current.isSuccess).toBe(true));
    expect(stockCalls).toBe(1);

    const { result: adjustResult } = renderHook(() => useCreateAdjustment(), { wrapper });
    adjustResult.current.mutate({
      reason: "COUNT" as never,
      lines: [{ productId: mockProductWithPricing.id, countedQuantity: 8 }],
    });
    await waitFor(() => expect(adjustResult.current.isSuccess).toBe(true));
    expect(adjustResult.current.data).toEqual(mockAdjustmentResult);

    await waitFor(() => expect(stockCalls).toBe(2));
  });
});
