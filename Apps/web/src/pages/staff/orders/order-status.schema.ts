import { z } from "zod";
import { OrderStatus } from "@dragon-telecom/contract";
import type { UpdateOrderStatusCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to UpdateOrderStatusCommand (orders.command.ts). S10/R3 — this is now the single
// forward-transition command (confirm is folded in); `lines` carries the per-line price edit
// legal at D11's price-edit status and `paidAmount` is the payment captured at COMPLETED. The
// contract schema does not refine deliveryCompany/trackingNumber against `status`, or paidAmount
// against COMPLETED — those are page-local UI rules added here so the dialog can show the error
// before a round-trip; the backend enforces the same rules server-side.
//
// z.coerce.number() (not `valueAsNumber: true`) — an empty numeric input with `valueAsNumber`
// resolves to NaN before zod ever sees it (report-S03.md's finding). Its *input* type is
// `unknown`, so a plain single-generic useForm<OrderStatusFormValues> won't type-check against
// zodResolver — fixed with this codebase's existing 3-generic useForm<Input, unknown, Output>
// precedent (register.schema.ts/Register.tsx; also documented in return-order.schema.ts, S9).
export function orderStatusSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      status: z.enum(OrderStatus),
      deliveryCompany: z.string().optional(),
      trackingNumber: z.string().optional(),
      reason: z.string().optional(),
      lines: z
        .array(
          z.object({
            orderLineId: z.string().min(1),
            unitPrice: z.coerce
              .number()
              .min(0, t("staff.orders.statusDialog.unitPriceInvalid"))
              .optional(),
          }),
        )
        .optional(),
      paidAmount: z.coerce
        .number()
        .min(0, t("staff.orders.statusDialog.paidAmountInvalid"))
        .optional(),
    })
    .refine((d) => d.status !== OrderStatus.IN_DELIVERY || !!d.deliveryCompany, {
      message: t("staff.orders.statusDialog.deliveryCompanyRequired"),
      path: ["deliveryCompany"],
    })
    .refine((d) => d.status !== OrderStatus.IN_DELIVERY || !!d.trackingNumber, {
      message: t("staff.orders.statusDialog.trackingNumberRequired"),
      path: ["trackingNumber"],
    })
    .refine((d) => d.status !== OrderStatus.COMPLETED || d.paidAmount !== undefined, {
      message: t("staff.orders.statusDialog.paidAmountRequired"),
      path: ["paidAmount"],
    });
}

export type OrderStatusFormValues = z.infer<ReturnType<typeof orderStatusSchema>>;

// 3-generic form: useForm<OrderStatusInput, unknown, OrderStatusFormValues>().
export type OrderStatusInput = z.input<ReturnType<typeof orderStatusSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _UpdateOrderStatusCommandCheck = AssertAssignable<
  OrderStatusFormValues extends UpdateOrderStatusCommand ? true : false
>;
