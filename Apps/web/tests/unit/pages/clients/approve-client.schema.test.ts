import { describe, it, expect } from "vitest";
import { approveClientSchema } from "@/pages/admin/clients/components/approve-client.schema";

const t = (key: string) => key;
const schema = approveClientSchema(t);

const CATEGORY_ID = "10000000-0000-4000-8000-000000000001";

describe("approveClientSchema (ADM-12 approval dialog)", () => {
  it("accepts a valid approval", () => {
    const result = schema.safeParse({
      username: "amine.b",
      password: "supersecret",
      categoryId: CATEGORY_ID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing category (mandatory per ADM-12)", () => {
    const result = schema.safeParse({ username: "amine.b", password: "supersecret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "categoryId");
      expect(issue?.message).toBe("admin.clients.approval.categoryRequired");
    }
  });

  it("rejects a short password", () => {
    const result = schema.safeParse({
      username: "amine.b",
      password: "short",
      categoryId: CATEGORY_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "password");
      expect(issue?.message).toBe("admin.clients.approval.passwordMinLength");
    }
  });

  it("rejects an empty username", () => {
    const result = schema.safeParse({
      username: "",
      password: "supersecret",
      categoryId: CATEGORY_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "username");
      expect(issue?.message).toBe("admin.clients.approval.usernameRequired");
    }
  });
});
