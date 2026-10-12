import { z } from 'zod';
import { InvoiceSource, InvoiceStatus } from './billing.enums';

// totalCost/totalProfit and line costSnapshot/profit/currentAvgStockPrice are
// mapping-gated (admin-only per Data Mapping section) — modelled .optional(); the
// client mapper strips them and 404s on foreign invoice numbers. posClientCredit is
// mapping-gated too (staff/admin only, stripped for the client audience) — see its own comment.
export const InvoiceResponseSchema = z.object({
  number: z.string(),
  posClientId: z.uuid().optional(),
  clientNameSnapshot: z.string(),
  clientAddressSnapshot: z.string().optional(),
  sourceType: z.enum(InvoiceSource),
  sourceReference: z.string(),
  status: z.enum(InvoiceStatus),
  totalAmount: z.number(),
  paidAmount: z.number(),
  previousCredit: z.number().optional(),
  newCredit: z.number().optional(),
  // The linked POS client's credit *right now* — distinct from previousCredit/newCredit, which
  // bracket this invoice's own issuance. The record-payment dialog previews
  // `posClientCredit - amount`; using newCredit there previewed from a stale figure (S8 F7).
  // Absent on a walk-in invoice (no posClientId) and stripped for the client audience.
  posClientCredit: z.number().optional(),
  totalCost: z.number().optional(),
  totalProfit: z.number().optional(),
  issuedAt: z.iso.datetime(),
  dueDate: z.iso.date().optional(),
  staffName: z.string(),
  lines: z.array(
    z.object({
      label: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number(),
      costSnapshot: z.number().optional(),
      profit: z.number().optional(),
      lineTotal: z.number(),
      serialNumbers: z.string().optional(),
      currentAvgStockPrice: z.number().optional(),
    }),
  ),
});
export type InvoiceDto = z.infer<typeof InvoiceResponseSchema>;

export const ClientPaymentResponseSchema = z.object({
  reference: z.string(),
  posClientName: z.string(),
  invoiceNumber: z.string().optional(),
  // S30 — the repair this row was taken or refunded for (REP-…), and on a reversal row the
  // payment it reverses (PAY-…, owner decision Q1).
  repairReference: z.string().optional(),
  reversesReference: z.string().optional(),
  amount: z.number(),
  previousCredit: z.number(),
  newCredit: z.number(),
  paidAt: z.iso.datetime(),
  staffName: z.string(),
});
export type ClientPaymentDto = z.infer<typeof ClientPaymentResponseSchema>;
