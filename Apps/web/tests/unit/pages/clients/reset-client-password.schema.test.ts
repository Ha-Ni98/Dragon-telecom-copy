import { describe, it, expect } from "vitest";
import { resetClientPasswordSchema } from "@/pages/admin/clients/components/reset-client-password.schema";

const t = (key: string) => key;
const schema = resetClientPasswordSchema(t);

describe("resetClientPasswordSchema (ADM-12b reset-password dialog)", () => {
  it("accepts matching passwords", () => {
    const result = schema.safeParse({ newPassword: "newpass1", confirmPassword: "newpass1" });
    expect(result.success).toBe(true);
  });

  it("rejects a mismatched confirmation", () => {
    const result = schema.safeParse({ newPassword: "newpass1", confirmPassword: "different" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "confirmPassword");
      expect(issue?.message).toBe("register.passwordMismatch");
    }
  });

  it("rejects a newPassword under 6 characters", () => {
    const result = schema.safeParse({ newPassword: "abc", confirmPassword: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "newPassword");
      expect(issue?.message).toBe("admin.clients.resetPassword.minLength");
    }
  });
});
