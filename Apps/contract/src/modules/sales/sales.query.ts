import { z } from 'zod';
import { SaleStatus } from './sales.enums';

// `sellerId`/`posClientId` (set-03 A3) — exact-id filters, kept for programmatic callers (the
// POS-clients drawer's Sales tab sends posClientId). The filter bar sends `seller`/`client` text
// instead (S34).
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
  // S34 — the filter bar's free-text client/seller boxes. Matched server-side, like `product`:
  // the page used to resolve the typed text to an id on an exact match, which never fired for a
  // partial name and sent a User id where a Staff id was needed (report-S34 F1/F2).
  // `client`: the sale's POS client by name or phone (same match as GET /pos-clients/search).
  // `seller`: every whitespace token must appear in the seller's first name, last name or username.
  client: z.string().trim().min(1).max(100).optional(),
  seller: z.string().trim().min(1).max(100).optional(),
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
  // S34 — Africa/Algiers days on returnedAt, `to` inclusive (storeDayRangeUtc).
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReturnListQuery = z.infer<typeof ReturnListQuerySchema>;
