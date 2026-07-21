import { describe, it, expect } from "vitest";
import {
  createClientCategorySchema,
  updateClientCategorySchema,
} from "@/pages/admin/settings/components/client-category.schema";

const t = (key: string) => key;

describe("createClientCategorySchema (ADM-17 Categories tab)", () => {
  const schema = createClientCategorySchema(t);

  it("accepts a named category", () => {
    expect(schema.safeParse({ name: "Wholesale" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = schema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("admin.settings.categories.form.nameRequired");
    }
  });
});

describe("updateClientCategorySchema", () => {
  const schema = updateClientCategorySchema(t);

  it("accepts a disable-only patch", () => {
    expect(schema.safeParse({ isEnabled: false }).success).toBe(true);
  });
});
