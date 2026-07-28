import { z } from 'zod';
import { SaleStatus, ReturnType } from './sales.enums';

// costOfGoods/profit/totalCost/totalProfit are mapping-gated (spec Data Mapping): staff
// mapper strips them, admin keeps them. Modelled .optional() here, not schema-stripped.
// No `origin` field (S1): with repairs no longer producing a Sale row (D9), every Sale is POS —
// the field carried no information and SaleOrigin was deleted.
export const SaleResponseSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: z.enum(SaleStatus),
  posClientId: z.uuid().optional(),
  posClientName: z.string().optional(),
  subtotal: z.number(),
  discountAmount: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  // S12 — cash actually refunded against this sale so far (Σ of the negative ClientPayment rows on
  // its invoice), so the return dialog can show what is still refundable before the backend
  // silently caps it (sales.service.ts's cashRefundable). Present on the **detail** read only:
  // populating it on the list would cost a per-row ledger aggregate for a figure no list column
  // shows.
  refundedAmount: z.number().optional(),
  previousCredit: z.number().optional(),
  newCredit: z.number().optional(),
  totalCost: z.number().optional(),
  totalProfit: z.number().optional(),
  soldAt: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
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

// S12 — the return read model. `Return`/`ReturnLine` existed since set-06 but were write-only
// (POST /admin/returns); the admin Returns tab is the first consumer that reads them back.
// Product identity is denormalised off the linked SaleLine (a ReturnLine has no productId of its
// own), and `unitPrice` is the price the line was *sold* at — "the returned products with their
// returned prices" (§S12) means `refundAmount`, which is per-line and operator-entered, so both
// are carried.
export const ReturnLineResponseSchema = z.object({
  id: z.uuid(),
  saleLineId: z.uuid(),
  productId: z.uuid(),
  productName: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  restock: z.boolean(),
  refundAmount: z.number(),
});
export type ReturnLineDto = z.infer<typeof ReturnLineResponseSchema>;

// `totalQuantity` is Σ lines[].quantity, computed in the mapper rather than stored — the table
// needs it as a column and every consumer would otherwise re-derive it. `posClientId`/
// `posClientName` are the *sale's* client (a Return has no client of its own); both absent for a
// walk-in sale, which the table renders as "Comptoir".
export const ReturnResponseSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  saleId: z.uuid(),
  saleReference: z.string(),
  type: z.enum(ReturnType),
  reason: z.string().optional(),
  refundAmount: z.number(),
  totalQuantity: z.number().int(),
  returnedAt: z.iso.datetime(),
  posClientId: z.uuid().optional(),
  posClientName: z.string().optional(),
  staffId: z.uuid(),
  staffName: z.string(),
  lines: z.array(ReturnLineResponseSchema),
});
export type ReturnDto = z.infer<typeof ReturnResponseSchema>;
