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

  // Sprint 6 fix — the add dialog's controlled `<Input>` defaults `email` to `""`, not
  // `undefined`; a plain `z.email().optional()` would reject that on every submit.
  it("accepts a blank email (dialog defaults the field to an empty string, not undefined)", () => {
    expect(schema.safeParse({ name: "Acme Parts", email: "" }).success).toBe(true);
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

  // Sprint 6 fix — SupplierDetailsSection defaults `email` to `supplier.email ?? ""`.
  it("accepts a blank email (details section defaults the field to an empty string)", () => {
    expect(schema.safeParse({ name: "Acme Parts", email: "" }).success).toBe(true);
  });
});
