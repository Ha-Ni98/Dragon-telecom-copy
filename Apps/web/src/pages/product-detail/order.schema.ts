import { z } from "zod";
import { OrderType } from "@dragon-telecom/contract";
import type { PlaceOrderCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to PlaceOrderCommand (orders.command.ts). `clientId` is intentionally not a form
// field — it's populated from the auth session at submit time (plan.md PUB-03 §4), not
// collected from the user, so it's absent here too (the contract marks it optional, so the
// AssertAssignable check below still holds without it).
//
// Correction (found in Sprint 3, retyping the components this schema drives): this originally
// took an `availableQuantity` factory param for a `.max()` bound, on the assumption PUB-03's
// "quantity (≤ available)" meant a real stock count was available client-side. It isn't —
// ProductDetailDto (catalog.dtos.ts) deliberately exposes only `inStock: boolean` for public/
// client viewers ("no cost, no exact quantities"). The authoritative bound is the server's own
// 409 INSUFFICIENT_STOCK rejection (PUB-03, wired in Sprint 5); this schema now only enforces
// `min(1)`, plus a generous UI sanity ceiling.
//
// The two `.refine`s mirror the contract's own PlaceOrderSchema refines (delivery required
// unless PICKUP / forbidden when PICKUP) so the form can show the same error locally before a
// submit round-trip.
const MAX_ORDER_QUANTITY = 99;

export function orderSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      productId: z.string().min(1),
      quantity: z
        .number()
        .int()
        .min(1, t("product.quantityMin"))
        .max(MAX_ORDER_QUANTITY, t("product.quantityExceedsStock")),
      orderType: z.enum(OrderType),
      contact: z.object({
        fullName: z.string().min(1, t("product.fullNameRequired")),
        phone: z.string().min(1, t("product.phoneRequired")),
      }),
      delivery: z
        .object({
          wilayaId: z.string().min(1, t("register.wilayaRequired")),
          communeId: z.string().min(1, t("register.communeRequired")),
          address: z.string().optional(),
        })
        .optional(),
    })
    .refine((d) => d.orderType === OrderType.PICKUP || d.delivery !== undefined, {
      message: t("product.deliveryRequired"),
      path: ["delivery"],
    })
    .refine((d) => d.orderType !== OrderType.PICKUP || d.delivery === undefined, {
      message: t("product.deliveryForbiddenForPickup"),
      path: ["delivery"],
    });
}

export type OrderFormValues = z.infer<ReturnType<typeof orderSchema>>;

// D1 (S9) — PlaceOrderCommand carries a lines[] array; this form collects a single product, so
// the mapping is one line. The `: PlaceOrderCommand` return annotation is the compile-time guard
// the old `AssertAssignable` check used to provide: a renamed or removed contract field fails
// here. The cart's true multi-line placement is S16.
export function toPlaceOrderCommand(
  values: OrderFormValues,
  clientId: string | null,
): PlaceOrderCommand {
  return {
    clientId,
    lines: [{ productId: values.productId, quantity: values.quantity }],
    orderType: values.orderType,
    contact: values.contact,
    ...(values.delivery !== undefined ? { delivery: values.delivery } : {}),
  };
}
