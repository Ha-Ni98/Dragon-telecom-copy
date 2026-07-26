import { describe, it, expect } from "vitest";
import { supplierInvoiceSchema } from "@/pages/admin/supplier-invoices/components/supplier-invoice.schema";

const t = (key: string) => key;
const schema = supplierInvoiceSchema(t);

const SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";
const PRODUCT_ID = "20000000-0000-4000-8000-000000000002";

const base = { supplierId: SUPPLIER_ID, invoiceDate: "2026-01-01" };

describe("supplierInvoiceSchema (ADM-08 editor)", () => {
  it("accepts an amountOnly-only invoice", () => {
    const result = schema.safeParse({ ...base, amountOnly: 1000 });
    expect(result.success).toBe(true);
  });

  it("accepts a lines-only invoice", () => {
    const result = schema.safeParse({
      ...base,
      lines: [{ productId: PRODUCT_ID, quantity: 2, unitCost: 500 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects both amountOnly and lines present", () => {
    const result = schema.safeParse({
      ...base,
      amountOnly: 1000,
      lines: [{ productId: PRODUCT_ID, quantity: 2, unitCost: 500 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "amountOnly");
      expect(issue?.message).toBe("admin.supplierInvoices.editor.amountOnlyXorLines");
    }
  });

  it("rejects neither amountOnly nor lines present", () => {
    const result = schema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejects a line with quantity below 1", () => {
    const result = schema.safeParse({
      ...base,
      lines: [{ productId: PRODUCT_ID, quantity: 0, unitCost: 500 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "lines.0.quantity");
      expect(issue?.message).toBe("admin.supplierInvoices.editor.quantityMin");
    }
  });

  it("rejects a negative unitCost", () => {
    const result = schema.safeParse({
      ...base,
      lines: [{ productId: PRODUCT_ID, quantity: 1, unitCost: -5 }],
    });
    expect(result.success).toBe(false);
  });
});
