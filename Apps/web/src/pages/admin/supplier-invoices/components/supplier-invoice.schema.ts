import { z } from "zod";
import type { CreateSupplierInvoiceCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

const SupplierInvoiceLineSchema = (t: ReturnType<typeof useTranslation>["t"]) =>
  z.object({
    productId: z.uuid(),
    quantity: z.number().int().min(1, t("admin.supplierInvoices.editor.quantityMin")),
    unitCost: z.number().min(0, t("common.validation.nonNegativeNumber")),
    serialNumbers: z.string().optional(),
  });

// Aligned to CreateSupplierInvoiceCommand (purchasing.command.ts). The contract already
// enforces "amountOnly XOR lines" (spec Business Logic #1) via its own `.refine`, but a
// `ZodEffects` can't be re-`.extend()`-ed with translated messages, so this wrapper
// re-declares the same shape + refine with a localized message (ADM-08 §4's amount-only
// switch surfaces this on the `amountOnly` field, matching the contract's own `path`).
export function supplierInvoiceSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      supplierId: z.uuid(),
      supplierReference: z.string().optional(),
      invoiceDate: z.iso.date(),
      dueDate: z.iso.date().optional(),
      shippingCost: z.number().min(0, t("common.validation.nonNegativeNumber")).optional(),
      amountOnly: z.number().min(0, t("common.validation.nonNegativeNumber")).optional(),
      note: z.string().optional(),
      lines: z.array(SupplierInvoiceLineSchema(t)).optional(),
    })
    .refine((d) => (d.amountOnly === undefined) !== (d.lines === undefined), {
      message: t("admin.supplierInvoices.editor.amountOnlyXorLines"),
      path: ["amountOnly"],
    });
}

export type SupplierInvoiceFormValues = z.infer<ReturnType<typeof supplierInvoiceSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateSupplierInvoiceCommandCheck = AssertAssignable<
  SupplierInvoiceFormValues extends CreateSupplierInvoiceCommand ? true : false
>;
