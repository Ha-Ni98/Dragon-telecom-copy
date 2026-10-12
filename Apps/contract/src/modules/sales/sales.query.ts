import { z } from 'zod';
import { SaleStatus } from './sales.enums';

// `sellerId`/`posClientId` (set-03 A3) — ADM-10 §UI filter bar: "date range, seller, POS
// client, status". Optional, so STF-05 (status-only) callers are unaffected.
// S32/Q2 — `from`/`to` are Africa/Algiers calendar days applied to `soldAt`, `to` inclusive.
// Drafts have no `soldAt`, so any date filter excludes them.
export const SaleListQuerySchema = z.object({
  status: z.enum(SaleStatus).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  sellerId: z.uuid().optional(),
  posClientId: z.uuid().optional(),
  // S32 — "search by sold product": any line whose snapshot name contains every typed token, or
  // whose product's barcode starts with the text. Trimmed; blank is dropped by the caller.
  product: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type SaleListQuery = z.infer<typeof SaleListQuerySchema>;

export const SaleReferenceParamsSchema = z.object({ reference: z.string() });
export type SaleReferenceParams = z.infer<typeof SaleReferenceParamsSchema>;

export const SaleIdParamsSchema = z.object({ id: z.uuid() });
export type SaleIdParams = z.infer<typeof SaleIdParamsSchema>;

// S12 — the admin Returns tab. `saleId` doubles as the return dialog's "already returned per line"
// lookup (one sale's returns), which is why the list carries its lines inline.
export const ReturnListQuerySchema = z.object({
  saleId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReturnListQuery = z.infer<typeof ReturnListQuerySchema>;
