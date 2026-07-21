import { describe, it, expect } from "vitest";
import { updateClientSchema } from "@/pages/admin/clients/components/admin-client-modify-dialog.schema";

const t = (key: string) => key;
const schema = updateClientSchema(t);

describe("updateClientSchema (ADM-12 modify dialog)", () => {
  it("accepts a contact-info-only patch", () => {
    expect(schema.safeParse({ storeName: "Acme Repairs", isEnabled: true }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = schema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  // Sprint 7 fix — the dialog's controlled `<Input>` defaults `email` to `client.email ?? ""`,
  // not `undefined`; a plain `z.email().optional()` would reject that on every submit (same bug
  // class as Sprint 6's `supplier.schema.ts`).
  it("accepts a blank email (dialog defaults the field to an empty string, not undefined)", () => {
    expect(schema.safeParse({ email: "" }).success).toBe(true);
  });
});
