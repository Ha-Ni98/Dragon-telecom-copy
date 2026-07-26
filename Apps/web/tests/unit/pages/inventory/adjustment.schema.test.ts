import { describe, it, expect } from "vitest";
import { AdjustmentReason } from "@dragon-telecom/contract";
import { adjustmentSchema } from "@/pages/admin/inventory/components/adjustment.schema";

// mockTranslation isn't imported here on purpose — this schema only needs a `t`, and asserting
// on the *key* it was given back is the project's i18n test convention (see
// product-detail/order.schema.test.ts).
const t = (key: string) => key;

const PRODUCT_ID = "10000000-0000-4000-8000-000000000001";

describe("adjustmentSchema (ADM-06 adjustment form)", () => {
  it("accepts a COUNT line that lowers stock without a unitCost", () => {
    const schema = adjustmentSchema(t, { [PRODUCT_ID]: 10 });
    const result = schema.safeParse({
      reason: AdjustmentReason.COUNT,
      lines: [{ productId: PRODUCT_ID, countedQuantity: 5 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a line that raises stock when unitCost is supplied", () => {
    const schema = adjustmentSchema(t, { [PRODUCT_ID]: 10 });
    const result = schema.safeParse({
      reason: AdjustmentReason.COUNT,
      lines: [{ productId: PRODUCT_ID, countedQuantity: 15, unitCost: 500 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a line that raises stock (an IN-delta) without unitCost", () => {
    const schema = adjustmentSchema(t, { [PRODUCT_ID]: 10 });
    const result = schema.safeParse({
      reason: AdjustmentReason.COUNT,
      lines: [{ productId: PRODUCT_ID, countedQuantity: 15 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "lines.0.unitCost");
      expect(issue?.message).toBe("admin.inventory.adjustment.unitCostRequiredForIncrease");
    }
  });

  it("treats a product with no snapshot entry as system quantity 0 (any positive count is an increase)", () => {
    const schema = adjustmentSchema(t, {});
    const result = schema.safeParse({
      reason: AdjustmentReason.COUNT,
      lines: [{ productId: PRODUCT_ID, countedQuantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty lines array", () => {
    const schema = adjustmentSchema(t, {});
    const result = schema.safeParse({ reason: AdjustmentReason.COUNT, lines: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "lines");
      expect(issue?.message).toBe("admin.inventory.adjustment.lineRequired");
    }
  });
});
