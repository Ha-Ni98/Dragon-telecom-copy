import { z } from "zod";
import { OrderType } from "@dragon-telecom/contract";
import type { PlaceOrderCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";
import { phoneField } from "@/lib/validation/phone.schema";

// Aligned to PlaceOrderCommand (orders.command.ts). `clientId` is intentionally not a form
// field — it's populated from the auth session at submit time (plan.md PUB-03 §4), not
// collected from the user, so it's absent here too (the contract marks it optional, so the
// AssertAssignable check below still holds without it).
//
// S15 — `productId`/`quantity` moved out of this schema: OrderPlacementSection (S15) collects
// one-or-many lines from its caller (a single product page line, or S16's selected cart rows),
// not from this form. The quantity ceiling now lives with each caller's own stepper.
//
// S15 — `delivery.address` (the "location" field) is dropped entirely per the issue ("remove
// the optional location field from the UI and send null"): omitting the key is the
// PlaceOrderSchema-compatible way to send nothing, since the contract's field is `.optional()`
// (undefined), not `.nullable()`.
//
// The two `.refine`s mirror the contract's own PlaceOrderSchema refines (delivery required
// unless PICKUP / forbidden when PICKUP) so the form can show the same error locally before a
// submit round-trip.
export function orderSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      orderType: z.enum(OrderType),
      contact: z.object({
        fullName: z.string().min(1, t("product.fullNameRequired")),
        // S15/R3 — shared with the register form's phone field (lib/validation/phone.schema.ts).
        phone: phoneField(t),
      }),
      delivery: z
        .object({
          wilayaId: z.string().min(1, t("register.wilayaRequired")),
          communeId: z.string().min(1, t("register.communeRequired")),
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

// D1 (S9) — PlaceOrderCommand carries a lines[] array. S15 widens this from a single product to
// a caller-supplied lines list, so a product page passes one line and S16's cart passes many
// through the same command shape. The `: PlaceOrderCommand` return annotation is the
// compile-time guard the old `AssertAssignable` check used to provide: a renamed or removed
// contract field fails here.
export function toPlaceOrderCommand(
  values: OrderFormValues,
  lines: { productId: string; quantity: number }[],
  clientId: string | null,
): PlaceOrderCommand {
  return {
    clientId,
    lines,
    orderType: values.orderType,
    contact: values.contact,
    ...(values.delivery !== undefined ? { delivery: values.delivery } : {}),
  };
}
