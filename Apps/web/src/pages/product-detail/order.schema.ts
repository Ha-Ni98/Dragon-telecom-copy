import { z } from "zod";
import { OrderType } from "@dragon-telecom/contract";
import type { PlaceOrderCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to PlaceOrderCommand (orders.command.ts). `clientId` is intentionally not a form
// field — it's populated from the auth session at submit time (plan.md PUB-03 §4), not
// collected from the user, so it's absent here too (the contract marks it optional, so the
// AssertAssignable check below still holds without it). `quantity`'s upper bound is injected
// per-product (the schema factory takes `availableQuantity`), mirroring loginSchema(t)'s
// factory pattern. The two `.refine`s mirror the contract's own PlaceOrderSchema refines
// (delivery required unless PICKUP / forbidden when PICKUP) so the form can show the same
// error locally before a submit round-trip.
export function orderSchema(t: ReturnType<typeof useTranslation>["t"], availableQuantity: number) {
  return z
    .object({
      productId: z.string().min(1),
      quantity: z
        .number()
        .int()
        .min(1, t("product.quantityMin"))
        .max(availableQuantity, t("product.quantityExceedsStock")),
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

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _PlaceOrderCommandCheck = AssertAssignable<
  OrderFormValues extends PlaceOrderCommand ? true : false
>;
