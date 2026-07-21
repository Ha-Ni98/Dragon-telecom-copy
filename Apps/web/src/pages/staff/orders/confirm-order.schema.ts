import { z } from "zod";
import type { ConfirmOrderCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to ConfirmOrderCommand (orders.command.ts) — every field is optional on the
// contract (charged-price adjust + serials + paidAmount are all opt-in at confirm time);
// this wrapper only adds translated `min(0)` messages. Shared by STF-04 and ADM-09 (same
// dialog, mounted at either scope).
export function confirmOrderSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    unitPrice: z.number().min(0, t("staff.orders.confirmDialog.unitPriceInvalid")).optional(),
    serialNumbers: z.array(z.string()).optional(),
    paidAmount: z.number().min(0, t("staff.orders.confirmDialog.paidAmountInvalid")).optional(),
  });
}

export type ConfirmOrderFormValues = z.infer<ReturnType<typeof confirmOrderSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _ConfirmOrderCommandCheck = AssertAssignable<
  ConfirmOrderFormValues extends ConfirmOrderCommand ? true : false
>;
