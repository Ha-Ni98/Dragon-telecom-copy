import { z } from "zod";
import type { RecordRepairPaymentCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to RecordRepairPaymentCommand (repairs.command.ts, S13/D5) — the ticket drawer's
// "Record payment" dialog, for a cumulative payment taken at any pre-pickup step.
export function recordRepairPaymentSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    amount: z.coerce.number().positive(t("staff.repairs.payments.amountInvalid")),
  });
}

export type RecordRepairPaymentFormValues = z.infer<ReturnType<typeof recordRepairPaymentSchema>>;
export type RecordRepairPaymentInput = z.input<ReturnType<typeof recordRepairPaymentSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract Command.
type AssertAssignable<T extends true> = T;
type _RecordRepairPaymentCommandCheck = AssertAssignable<
  RecordRepairPaymentFormValues extends RecordRepairPaymentCommand ? true : false
>;
