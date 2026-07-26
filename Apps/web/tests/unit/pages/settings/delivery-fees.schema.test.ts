import { describe, it, expect } from "vitest";
import { deliveryFeesSchema } from "@/pages/admin/settings/components/delivery-fees.schema";

const t = (key: string) => key;
const schema = deliveryFeesSchema(t);
const WILAYA_ID = "10000000-0000-4000-8000-000000000001";

describe("deliveryFeesSchema (ADM-17 Delivery fees tab + Excel import)", () => {
  it("accepts a valid row set", () => {
    const result = schema.safeParse({
      rows: [{ wilayaId: WILAYA_ID, deliveryHome: 500, deliveryOffice: 300 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a row with a null commune (wilaya-level default)", () => {
    const result = schema.safeParse({
      rows: [{ wilayaId: WILAYA_ID, communeId: null, deliveryHome: 500, deliveryOffice: 300 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative fee", () => {
    const result = schema.safeParse({
      rows: [{ wilayaId: WILAYA_ID, deliveryHome: -1, deliveryOffice: 300 }],
    });
    expect(result.success).toBe(false);
  });
});
