import { z } from 'zod';

/**
 * Form validation schema
 */
export const invoiceAddSchema = z.object({
  newDue: z.number()
    .min(0, 'New due amount cannot be negative')
    .max(999999, 'New due amount must be less than 999,999'),
  paid: z.number()
    .min(0, 'Paid amount cannot be negative')
    .max(999999, 'Paid amount must be less than 999,999'),
});

export type InvoiceAddFormData = z.infer<typeof invoiceAddSchema>;
