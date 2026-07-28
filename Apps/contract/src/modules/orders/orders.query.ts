import { z } from 'zod';
import { OrderStatus } from './orders.enums';

export const MyOrdersQuerySchema = z.object({
  status: z.enum(OrderStatus).optional(),
});
export type MyOrdersQuery = z.infer<typeof MyOrdersQuerySchema>;

// `from`/`to` (set-03 A2) — STF-04/ADM-09 §UI: "status tabs ... + search + date range", filtered
// on the order's own date. Optional, so every existing caller that omits them is unaffected.
export const BackofficeOrdersQuerySchema = z.object({
  status: z.enum(OrderStatus).optional(),
  search: z.string().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  // S8 J4 — the admin client-detail Orders tab scopes the same list to one registered client.
  // Order.clientId is the registered Client, not the PosClient the invoice/payment lists key on.
  clientId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type BackofficeOrdersQuery = z.infer<typeof BackofficeOrdersQuerySchema>;

export const OrderIdParamsSchema = z.object({ id: z.uuid() });
export type OrderIdParams = z.infer<typeof OrderIdParamsSchema>;

// No OrderStatsQuery: STATS carries no query-string params in the spec (same as
// PRODUCT_STATS/SUPPLIER_STATS in earlier sprints, which likewise have no query schema).
