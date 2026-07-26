import { z } from "zod";
import type { ReturnOrderCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to ReturnOrderCommand (orders.command.ts). Admin-only (ADM-09 §Forms). `maxQuantity`
// is the order's own line quantity — known client-side in the return dialog (unlike the public
// order form, which deliberately has no client-side stock bound) — so the factory takes it to
// enforce "quantity ≤ ordered" locally; the backend validates the same bound again.
export function returnOrderSchema(t: ReturnType<typeof useTranslation>["t"], maxQuantity: number) {
  return z.object({
    quantity: z
      .number()
      .int()
      .min(1, t("admin.orders.returnDialog.quantityMin"))
      .max(maxQuantity, t("admin.orders.returnDialog.quantityExceedsOrdered")),
    restock: z.boolean(),
    refundAmount: z.number().min(0, t("admin.orders.returnDialog.refundAmountInvalid")),
  });
}

export type ReturnOrderFormValues = z.infer<ReturnType<typeof returnOrderSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _ReturnOrderCommandCheck = AssertAssignable<
  ReturnOrderFormValues extends ReturnOrderCommand ? true : false
>;
