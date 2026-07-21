import { z } from "zod";
import type { CancelInvoiceCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CancelInvoiceCommand (billing.command.ts) — admin-only (ADM-14 §UI: "cancel" on
// the Outgoing tab). Reason optional, same shape as the admin orders/cancel-order.schema.ts
// precedent.
export function cancelInvoiceSchema(_t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    reason: z.string().optional(),
  });
}

export type CancelInvoiceFormValues = z.infer<ReturnType<typeof cancelInvoiceSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CancelInvoiceCommandCheck = AssertAssignable<
  CancelInvoiceFormValues extends CancelInvoiceCommand ? true : false
>;
