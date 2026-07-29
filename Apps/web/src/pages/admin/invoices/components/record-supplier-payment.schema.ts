import { z } from "zod";
import type { CreateSupplierPaymentCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreateSupplierPaymentCommand (purchasing.command.ts). Admin-only (ADM-14
// §Forms, Payments tab).
export function recordSupplierPaymentSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    supplierId: z.uuid(),
    supplierInvoiceReference: z.string().optional(),
    amount: z.number().positive(t("admin.invoices.recordSupplierPayment.amountInvalid")),
    paidAt: z.iso.datetime().optional(),
  });
}

export type RecordSupplierPaymentFormValues = z.infer<
  ReturnType<typeof recordSupplierPaymentSchema>
>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateSupplierPaymentCommandCheck = AssertAssignable<
  RecordSupplierPaymentFormValues extends CreateSupplierPaymentCommand ? true : false
>;
