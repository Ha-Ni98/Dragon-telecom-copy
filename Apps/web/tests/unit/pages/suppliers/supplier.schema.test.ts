import { describe, it, expect } from "vitest";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@/pages/admin/suppliers/components/supplier.schema";

const t = (key: string) => key;

describe("createSupplierSchema (ADM-07 add dialog)", () => {
  const schema = createSupplierSchema(t);

  it("accepts a name-only supplier", () => {
    expect(schema.safeParse({ name: "Acme Parts" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = schema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("admin.suppliers.supplierNameRequired");
    }
  });

  it("rejects an invalid email", () => {
    const result = schema.safeParse({ name: "Acme Parts", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("accepts an initialCredit", () => {
    expect(schema.safeParse({ name: "Acme Parts", initialCredit: 1000 }).success).toBe(true);
  });
});

describe("updateSupplierSchema (ADM-07 disable/edit)", () => {
  const schema = updateSupplierSchema(t);

  it("accepts a disable-only patch", () => {
    expect(schema.safeParse({ isEnabled: false }).success).toBe(true);
  });
});
