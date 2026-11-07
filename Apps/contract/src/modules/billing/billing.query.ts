import { z } from 'zod';
import { InvoiceSource, InvoiceStatus } from './billing.enums';

// "client?" in the spec's filter shorthand — named posClientId to match the actual FK
// used throughout the rest of the contract.
export const InvoiceListQuerySchema = z.object({
  posClientId: z.uuid().optional(),
  status: z.enum(InvoiceStatus).optional(),
  source: z.enum(InvoiceSource).optional(),
  // S34 — Africa/Algiers days on issuedAt, `to` inclusive (storeDayRangeUtc).
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>;

export const ClientPaymentListQuerySchema = z.object({
  posClientId: z.uuid().optional(),
  // S8 J8 — the payments tab's date-range filter, on the same `paidAt` column the list sorts by.
  // S34 — Africa/Algiers days, `to` inclusive (storeDayRangeUtc).
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ClientPaymentListQuery = z.infer<typeof ClientPaymentListQuerySchema>;

export const InvoiceNumberParamsSchema = z.object({ number: z.string() });
export type InvoiceNumberParams = z.infer<typeof InvoiceNumberParamsSchema>;
