import { describe, it, expect } from "vitest";
import { UserType } from "@dragon-telecom/contract";
import { createUserSchema, updateUserSchema } from "@/pages/admin/users/components/user.schema";

const t = (key: string) => key;

const profile = { firstName: "Amine", lastName: "Belkacem" };
const ROLE_ID = "10000000-0000-4000-8000-000000000001";

describe("createUserSchema (ADM-16 user dialog)", () => {
  const schema = createUserSchema(t);

  it("accepts an ADMIN user with no roleIds", () => {
    const result = schema.safeParse({
      username: "admin1",
      password: "supersecret",
      type: UserType.ADMIN,
      profile,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a STAFF user with roleIds", () => {
    const result = schema.safeParse({
      username: "staff1",
      password: "supersecret",
      type: UserType.STAFF,
      profile,
      roleIds: [ROLE_ID],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a STAFF user with no roleIds", () => {
    const result = schema.safeParse({
      username: "staff1",
      password: "supersecret",
      type: UserType.STAFF,
      profile,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "roleIds");
      expect(issue?.message).toBe("admin.users.form.roleIdsRequiredForStaff");
    }
  });

  it("rejects an ADMIN user with roleIds present", () => {
    const result = schema.safeParse({
      username: "admin1",
      password: "supersecret",
      type: UserType.ADMIN,
      profile,
      roleIds: [ROLE_ID],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "roleIds");
      expect(issue?.message).toBe("admin.users.form.roleIdsForbiddenForAdmin");
    }
  });
});

describe("updateUserSchema (ADM-16 user dialog, edit mode)", () => {
  const schema = updateUserSchema(t);

  it("accepts a partial update", () => {
    expect(schema.safeParse({ isEnabled: false }).success).toBe(true);
  });

  it("rejects a password under 8 characters", () => {
    const result = schema.safeParse({ password: "short" });
    expect(result.success).toBe(false);
  });
});
