import { z } from "zod";
import type { CreateClientPaymentCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreateClientPaymentCommand (billing.command.ts). Shared by STF-06 and ADM-14
// (same `RecordPaymentDialog`, mounted at either scope) — `posClientId`/`invoiceNumber` are
// pre-filled hidden fields (invoice preselected, STF-06 §Forms); `amount` is the only field
// the user actually types, hence the translated positive-amount message.
export function recordClientPaymentSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    posClientId: z.uuid(),
    invoiceNumber: z.string().optional(),
    amount: z.number().positive(t("staff.invoices.recordPayment.amountInvalid")),
    paidAt: z.iso.datetime().optional(),
  });
}

export type RecordClientPaymentFormValues = z.infer<ReturnType<typeof recordClientPaymentSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateClientPaymentCommandCheck = AssertAssignable<
  RecordClientPaymentFormValues extends CreateClientPaymentCommand ? true : false
>;
