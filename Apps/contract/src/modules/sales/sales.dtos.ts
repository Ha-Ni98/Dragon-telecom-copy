import { z } from 'zod';
import { SaleOrigin, SaleStatus } from './sales.enums';

// costOfGoods/profit/totalCost/totalProfit are mapping-gated (spec Data Mapping): staff
// mapper strips them, admin keeps them. Modelled .optional() here, not schema-stripped.
export const SaleResponseSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  origin: z.enum(SaleOrigin),
  status: z.enum(SaleStatus),
  posClientId: z.uuid().optional(),
  posClientName: z.string().optional(),
  subtotal: z.number(),
  discountAmount: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  previousCredit: z.number().optional(),
  newCredit: z.number().optional(),
  totalCost: z.number().optional(),
  totalProfit: z.number().optional(),
  soldAt: z.iso.datetime().optional(),
  staffId: z.uuid(),
  staffName: z.string(),
  note: z.string().optional(),
  lines: z.array(
    z.object({
      id: z.uuid(),
      productId: z.uuid(),
      productName: z.string(),
      quantity: z.number().int(),
      resolvedPrice: z.number(),
      unitPrice: z.number(),
      costOfGoods: z.number().optional(),
      profit: z.number().optional(),
      lineTotal: z.number(),
      serialNumbers: z.array(z.string()).optional(),
    }),
  ),
});
export type SaleDto = z.infer<typeof SaleResponseSchema>;

// No field list for `lines` beyond the bare name; a printed receipt is customer-facing,
// so it carries no cost/profit — only what the customer sees on paper.
export const ReceiptResponseSchema = z.object({
  reference: z.string(),
  lines: z.array(
    z.object({
      productName: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number(),
      lineTotal: z.number(),
      serialNumbers: z.array(z.string()).optional(),
    }),
  ),
  total: z.number(),
  previousCredit: z.number(),
  grandTotal: z.number(),
  totalPaid: z.number(),
  newCredit: z.number(),
});
export type ReceiptDto = z.infer<typeof ReceiptResponseSchema>;
