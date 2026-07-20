import { describe, it, expect } from "vitest";
import { server } from "../../fixtures/msw/server";
import { purchasingErrorHandlers } from "../../fixtures/msw/purchasing.handlers";
import {
  mockSuppliersPaginated,
  mockSupplier,
  mockSupplierDetail,
  mockSupplierStats,
  mockSupplierInvoicesPaginated,
  mockSupplierInvoiceDraft,
  mockConfirmResult,
  mockSupplierPaymentsPaginated,
  mockSupplierPayment,
} from "../../fixtures/data/purchasing.mock";
import * as purchasingService from "@/services/purchasing.service";

describe("purchasing.service — suppliers", () => {
  it("listSuppliers returns the unwrapped paginated DTO", async () => {
    const result = await purchasingService.listSuppliers({ page: 1, limit: 10 });
    expect(result).toEqual(mockSuppliersPaginated);
  });

  it("supplierStats returns the unwrapped DTO", async () => {
    const result = await purchasingService.supplierStats();
    expect(result).toEqual(mockSupplierStats);
  });

  it("getSupplier returns the unwrapped detail DTO (aggregate: invoices/payments/history)", async () => {
    const result = await purchasingService.getSupplier(mockSupplier.id);
    expect(result).toEqual(mockSupplierDetail);
  });

  it("getSupplier throws on 404", async () => {
    server.use(purchasingErrorHandlers.supplierNotFound());
    await expect(purchasingService.getSupplier("missing")).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it("createSupplier / updateSupplier return the unwrapped DTO", async () => {
    expect(await purchasingService.createSupplier({ name: "New Supplier" })).toEqual(mockSupplier);
    expect(await purchasingService.updateSupplier(mockSupplier.id, { name: "Renamed" })).toEqual(
      mockSupplier,
    );
  });
});

describe("purchasing.service — supplier invoices", () => {
  it("listSupplierInvoices returns the unwrapped paginated DTO", async () => {
    const result = await purchasingService.listSupplierInvoices({ page: 1, limit: 10 });
    expect(result).toEqual(mockSupplierInvoicesPaginated);
  });

  it("getSupplierInvoice returns the unwrapped DTO", async () => {
    const result = await purchasingService.getSupplierInvoice(mockSupplierInvoiceDraft.id);
    expect(result).toEqual(mockSupplierInvoiceDraft);
  });

  it("createSupplierInvoice (amountOnly XOR lines) returns the unwrapped DTO", async () => {
    const result = await purchasingService.createSupplierInvoice({
      supplierId: mockSupplier.id,
      invoiceDate: "2026-01-05",
      lines: [{ productId: "10000000-0000-4000-8000-000000000002", quantity: 10, unitCost: 3000 }],
    });
    expect(result).toEqual(mockSupplierInvoiceDraft);
  });

  it("createSupplierInvoice throws on a validation error (amountOnly XOR lines)", async () => {
    server.use(purchasingErrorHandlers.createInvoiceValidationError());
    await expect(
      purchasingService.createSupplierInvoice({
        supplierId: mockSupplier.id,
        invoiceDate: "2026-01-05",
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it("updateSupplierInvoice returns the unwrapped DTO", async () => {
    const result = await purchasingService.updateSupplierInvoice(mockSupplierInvoiceDraft.id, {
      note: "Updated",
    });
    expect(result).toEqual(mockSupplierInvoiceDraft);
  });

  it("updateSupplierInvoice throws on a conflict (PATCH after confirm)", async () => {
    server.use(purchasingErrorHandlers.updateInvoiceConflict());
    await expect(
      purchasingService.updateSupplierInvoice(mockSupplierInvoiceDraft.id, { note: "X" }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });

  it("confirmSupplierInvoice (no body) returns the unwrapped result with reprice candidates", async () => {
    const result = await purchasingService.confirmSupplierInvoice(mockSupplierInvoiceDraft.id);
    expect(result).toEqual(mockConfirmResult);
    expect(result.repriceCandidates).toHaveLength(1);
  });

  it("confirmSupplierInvoice throws on a conflict (already confirmed)", async () => {
    server.use(purchasingErrorHandlers.confirmInvoiceConflict());
    await expect(
      purchasingService.confirmSupplierInvoice(mockSupplierInvoiceDraft.id),
    ).rejects.toMatchObject({
      response: { status: 409 },
    });
  });

  it("cancelSupplierInvoice returns the unwrapped DTO", async () => {
    const result = await purchasingService.cancelSupplierInvoice(mockSupplierInvoiceDraft.id, {
      reason: "duplicate entry",
    });
    expect(result).toEqual(mockSupplierInvoiceDraft);
  });
});

describe("purchasing.service — payments", () => {
  it("listSupplierPayments returns the unwrapped paginated DTO", async () => {
    const result = await purchasingService.listSupplierPayments({ page: 1, limit: 10 });
    expect(result).toEqual(mockSupplierPaymentsPaginated);
  });

  it("createSupplierPayment returns the unwrapped DTO", async () => {
    const result = await purchasingService.createSupplierPayment({
      supplierId: mockSupplier.id,
      amount: 20000,
    });
    expect(result).toEqual(mockSupplierPayment);
  });
});
