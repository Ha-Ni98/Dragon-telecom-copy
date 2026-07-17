import { z } from 'zod';

export const CancelInvoiceSchema = z.object({
  reason: z.string().optional(),
});
export type CancelInvoiceCommand = z.infer<typeof CancelInvoiceSchema>;

export const CreateClientPaymentSchema = z.object({
  posClientId: z.uuid(),
  invoiceNumber: z.string().optional(),
  amount: z.number().positive(),
  paidAt: z.iso.datetime().optional(),
});
export type CreateClientPaymentCommand = z.infer<typeof CreateClientPaymentSchema>;
