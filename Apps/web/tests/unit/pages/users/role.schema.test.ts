import { describe, it, expect } from "vitest";
import {
  createRoleSchema,
  updateRoleSchema,
  setRolePagesSchema,
} from "@/pages/admin/users/components/role.schema";

const t = (key: string) => key;

describe("createRoleSchema (ADM-16 role dialog)", () => {
  const schema = createRoleSchema(t);

  it("accepts a valid role", () => {
    expect(schema.safeParse({ code: "POS_MANAGER", name: "POS Manager" }).success).toBe(true);
  });

  it("rejects a missing code", () => {
    const result = schema.safeParse({ code: "", name: "POS Manager" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((i) => i.path.join(".") === "code")?.message).toBe(
        "admin.users.roleForm.codeRequired",
      );
    }
  });
});

describe("updateRoleSchema", () => {
  const schema = updateRoleSchema(t);

  it("accepts a disable-only patch", () => {
    expect(schema.safeParse({ isEnabled: false }).success).toBe(true);
  });
});

describe("setRolePagesSchema (permission matrix submit)", () => {
  const schema = setRolePagesSchema(t);

  it("accepts a list of page keys", () => {
    expect(schema.safeParse({ pageKeys: ["STAFF_POS", "STAFF_SALES"] }).success).toBe(true);
  });

  it("accepts an empty list (clearing every page)", () => {
    expect(schema.safeParse({ pageKeys: [] }).success).toBe(true);
  });
});
