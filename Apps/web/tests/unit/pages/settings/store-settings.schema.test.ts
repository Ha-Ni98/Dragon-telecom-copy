import { describe, it, expect } from "vitest";
import { storeSettingsSchema } from "@/pages/admin/settings/components/store-settings.schema";

const t = (key: string) => key;
const schema = storeSettingsSchema(t);

describe("storeSettingsSchema (ADM-17 Store tab)", () => {
  it("accepts an empty patch (every field optional)", () => {
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("accepts a full store section", () => {
    const result = schema.safeParse({
      name: "Dragon Telecom",
      address: "1 Rue Didouche Mourad, Alger",
      phone: "0550000000",
      logoUrl: "https://example.com/logo.png",
    });
    expect(result.success).toBe(true);
  });
});
