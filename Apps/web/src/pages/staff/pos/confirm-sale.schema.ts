import { z } from "zod";
import type { ConfirmSaleCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to ConfirmSaleCommand (sales.command.ts). The contract only enforces `min(0)`
// with no message — this wrapper adds the translated message for the F4 payment-panel field.
export function confirmSaleSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    paidAmount: z.number().min(0, t("staff.pos.payment.paidAmountInvalid")),
  });
}

export type ConfirmSaleFormValues = z.infer<ReturnType<typeof confirmSaleSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _ConfirmSaleCommandCheck = AssertAssignable<
  ConfirmSaleFormValues extends ConfirmSaleCommand ? true : false
>;
