import { describe, it, expect } from "vitest";
import {
  createPosClientSchema,
  updatePosClientSchema,
} from "@/pages/admin/pos-clients/components/pos-client.schema";

const t = (key: string) => key;

describe("createPosClientSchema (ADM-11 add dialog)", () => {
  const schema = createPosClientSchema(t);

  it("accepts a name-only client", () => {
    expect(schema.safeParse({ name: "Amine" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = schema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("admin.posClients.form.nameRequired");
    }
  });

  it("accepts an optional initialCredit", () => {
    expect(schema.safeParse({ name: "Amine", initialCredit: 500 }).success).toBe(true);
  });
});

describe("updatePosClientSchema (ADM-11 edit dialog)", () => {
  const schema = updatePosClientSchema(t);

  it("accepts a partial update", () => {
    expect(schema.safeParse({ isEnabled: false }).success).toBe(true);
  });

  it("rejects an empty name when supplied", () => {
    const result = schema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
