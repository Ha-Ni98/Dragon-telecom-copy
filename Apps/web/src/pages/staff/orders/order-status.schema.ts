import { z } from "zod";
import { OrderStatus } from "@dragon-telecom/contract";
import type { UpdateOrderStatusCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to UpdateOrderStatusCommand (orders.command.ts). The contract schema does not
// refine deliveryCompany/trackingNumber against `status` — that's a page-local UI rule
// (STF-04/ADM-09 §Forms: "deliveryCompany/trackingNumber required conditionally by a
// refine") added here so the dialog can show the error before a round-trip; the backend
// enforces the same rule server-side.
export function orderStatusSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      status: z.enum(OrderStatus),
      deliveryCompany: z.string().optional(),
      trackingNumber: z.string().optional(),
      reason: z.string().optional(),
    })
    .refine((d) => d.status !== OrderStatus.IN_DELIVERY || !!d.deliveryCompany, {
      message: t("staff.orders.statusDialog.deliveryCompanyRequired"),
      path: ["deliveryCompany"],
    })
    .refine((d) => d.status !== OrderStatus.IN_DELIVERY || !!d.trackingNumber, {
      message: t("staff.orders.statusDialog.trackingNumberRequired"),
      path: ["trackingNumber"],
    });
}

export type OrderStatusFormValues = z.infer<ReturnType<typeof orderStatusSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _UpdateOrderStatusCommandCheck = AssertAssignable<
  OrderStatusFormValues extends UpdateOrderStatusCommand ? true : false
>;
