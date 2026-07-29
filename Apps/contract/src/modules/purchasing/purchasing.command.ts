import { z } from 'zod';

export const CreateSupplierSchema = z.object({
  name: z.string(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.email().optional(),
  location: z.string().optional(),
  initialCredit: z.number().optional(),
});
export type CreateSupplierCommand = z.infer<typeof CreateSupplierSchema>;

// Not given a field list in the spec; mirrors CreateSupplierCommand minus initialCredit
// (credit is ledger-derived thereafter), plus the universal isEnabled toggle.
export const UpdateSupplierSchema = z.object({
  name: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.email().optional(),
  location: z.string().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateSupplierCommand = z.infer<typeof UpdateSupplierSchema>;

const SupplierInvoiceLineInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1),
  unitCost: z.number().min(0),
  serialNumbers: z.string().optional(),
});

// amountOnly XOR lines (spec Business Logic #1) — exactly one must be present.
export const CreateSupplierInvoiceSchema = z
  .object({
    supplierId: z.uuid(),
    supplierReference: z.string().optional(),
    invoiceDate: z.iso.date(),
    dueDate: z.iso.date().optional(),
    shippingCost: z.number().min(0).optional(),
    amountOnly: z.number().min(0).optional(),
    note: z.string().optional(),
    lines: z.array(SupplierInvoiceLineInputSchema).optional(),
  })
  .refine((d) => (d.amountOnly === undefined) !== (d.lines === undefined), {
    message: 'Exactly one of amountOnly or lines is required',
    path: ['amountOnly'],
  })
  // An invoice with neither goods nor money is a junk row: confirming it allocates a real
  // reference and moves the supplier's credit by 0, permanently (S7 I2/F10).
  .refine((d) => (d.lines === undefined ? (d.amountOnly ?? 0) > 0 : d.lines.length > 0), {
    message: 'An invoice must carry at least one line, or an amount-only above 0',
    path: ['lines'],
  });
export type CreateSupplierInvoiceCommand = z.infer<typeof CreateSupplierInvoiceSchema>;

// DRAFT-only enforcement is a backend guard (PATCH after confirm -> 409); supplierId is
// not reassignable (never stated as editable). Same amountOnly XOR lines shape as create.
export const UpdateSupplierInvoiceSchema = z
  .object({
    supplierReference: z.string().optional(),
    invoiceDate: z.iso.date().optional(),
    dueDate: z.iso.date().optional(),
    shippingCost: z.number().min(0).optional(),
    amountOnly: z.number().min(0).optional(),
    note: z.string().optional(),
    lines: z.array(SupplierInvoiceLineInputSchema).optional(),
  })
  .refine((d) => d.amountOnly === undefined || d.lines === undefined, {
    message: 'amountOnly and lines are mutually exclusive',
    path: ['amountOnly'],
  })
  .refine((d) => d.lines === undefined || d.lines.length > 0, {
    message: 'An invoice must carry at least one line',
    path: ['lines'],
  })
  .refine((d) => d.amountOnly === undefined || d.amountOnly > 0, {
    message: 'An amount-only invoice must be above 0',
    path: ['amountOnly'],
  });
export type UpdateSupplierInvoiceCommand = z.infer<typeof UpdateSupplierInvoiceSchema>;

export const CancelSupplierInvoiceSchema = z.object({
  reason: z.string().optional(),
});
export type CancelSupplierInvoiceCommand = z.infer<typeof CancelSupplierInvoiceSchema>;

export const CreateSupplierPaymentSchema = z.object({
  supplierId: z.uuid(),
  supplierInvoiceReference: z.string().optional(),
  amount: z.number().positive(),
  paidAt: z.iso.datetime().optional(),
});
export type CreateSupplierPaymentCommand = z.infer<typeof CreateSupplierPaymentSchema>;
