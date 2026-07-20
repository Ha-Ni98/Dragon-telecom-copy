import { describe, it, expect } from "vitest";
import { ReturnType } from "@dragon-telecom/contract";
import { server } from "../../fixtures/msw/server";
import { salesErrorHandlers } from "../../fixtures/msw/sales.handlers";
import { mockSale, mockSalesPaginated, mockReceipt } from "../../fixtures/data/sales.mock";
import * as salesService from "@/services/sales.service";

describe("sales.service — drafts & confirm", () => {
  it("createDraft returns the unwrapped DTO", async () => {
    const result = await salesService.createDraft({
      lines: [{ productId: mockSale.lines[0].productId, quantity: 2, unitPrice: 3_000 }],
    });
    expect(result).toEqual(mockSale);
  });

  it("createDraft throws on an empty-lines validation error", async () => {
    server.use(salesErrorHandlers.createDraftEmptyLines());
    await expect(salesService.createDraft({ lines: [] })).rejects.toMatchObject({
      response: { status: 400 },
    });
  });

  it("updateDraft returns the unwrapped DTO", async () => {
    expect(await salesService.updateDraft(mockSale.id, { note: "Updated" })).toEqual(mockSale);
  });

  it("confirmSale returns a ReceiptDto (a different shape from SaleDto)", async () => {
    const result = await salesService.confirmSale(mockSale.id, { paidAmount: 6_000 });
    expect(result).toEqual(mockReceipt);
  });

  it("confirmSale throws on a state-guard conflict", async () => {
    server.use(salesErrorHandlers.confirmConflict());
    await expect(
      salesService.confirmSale(mockSale.id, { paidAmount: 6_000 }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
});

describe("sales.service — list & detail (scope-parameterized)", () => {
  it("listSales resolves the unwrapped paginated result for both scopes", async () => {
    expect(await salesService.listSales("staff", { page: 1, limit: 20 })).toEqual(
      mockSalesPaginated,
    );
    expect(await salesService.listSales("admin", { page: 1, limit: 20 })).toEqual(
      mockSalesPaginated,
    );
  });

  it("getSale is keyed by reference (string), not id", async () => {
    expect(await salesService.getSale("staff", mockSale.reference)).toEqual(mockSale);
  });

  it("getSale throws on a 404", async () => {
    server.use(salesErrorHandlers.saleNotFound());
    await expect(salesService.getSale("staff", "SAL-9999")).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});

describe("sales.service — returns", () => {
  it("createReturn returns the unwrapped SaleDto", async () => {
    const result = await salesService.createReturn({
      saleId: mockSale.id,
      type: ReturnType.REFUND,
      lines: [
        { saleLineId: mockSale.lines[0].id, quantity: 1, restock: true, refundAmount: 3_000 },
      ],
    });
    expect(result).toEqual(mockSale);
  });
});
