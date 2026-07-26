import { describe, it, expect } from "vitest";
import { OrderType } from "@dragon-telecom/contract";
import { orderSchema } from "@/pages/product-detail/order.schema";

// mockTranslation isn't imported here on purpose — this schema only needs a `t`, and asserting
// on the *key* it was given back (rather than a translated string) is exactly what the
// project's i18n test convention already does for component-level tests.
const t = (key: string) => key;
const schema = orderSchema(t);

const baseOrder = {
  productId: "10000000-0000-4000-8000-000000000001",
  quantity: 1,
  contact: { fullName: "Amine Belkacem", phone: "0550000001" },
};

describe("orderSchema (PUB-03 order form)", () => {
  it("accepts a pickup order with no delivery block", () => {
    const result = schema.safeParse({ ...baseOrder, orderType: OrderType.PICKUP });
    expect(result.success).toBe(true);
  });

  it("accepts a delivery order with a filled delivery block", () => {
    const result = schema.safeParse({
      ...baseOrder,
      orderType: OrderType.DELIVERY_HOME,
      delivery: { wilayaId: "w1", communeId: "c1" },
    });
    expect(result.success).toBe(true);
  });

  // The wired ProductOrderModal never actually reaches this state through its own UI —
  // handleOrderTypeChange always sets `delivery` to a (possibly empty) object the moment
  // orderType leaves PICKUP, so `delivery === undefined` while non-pickup can't happen by
  // clicking through the form. The refine is still real defense-in-depth (mirrors the
  // contract's own PlaceOrderSchema refine) — exercised directly against the schema since the
  // DOM can't produce the input it guards against.
  it("rejects a non-pickup order with no delivery block at all", () => {
    const result = schema.safeParse({ ...baseOrder, orderType: OrderType.DELIVERY_HOME });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "delivery");
      expect(issue?.message).toBe("product.deliveryRequired");
    }
  });

  it("rejects a pickup order that still carries a delivery block", () => {
    const result = schema.safeParse({
      ...baseOrder,
      orderType: OrderType.PICKUP,
      delivery: { wilayaId: "w1", communeId: "c1" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "delivery");
      expect(issue?.message).toBe("product.deliveryForbiddenForPickup");
    }
  });

  it("rejects a quantity above the UI sanity ceiling", () => {
    const result = schema.safeParse({ ...baseOrder, orderType: OrderType.PICKUP, quantity: 100 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "quantity");
      expect(issue?.message).toBe("product.quantityExceedsStock");
    }
  });
});
