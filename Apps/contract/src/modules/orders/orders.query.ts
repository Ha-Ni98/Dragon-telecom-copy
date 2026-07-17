import { z } from 'zod';
import { OrderStatus } from './orders.enums';

export const MyOrdersQuerySchema = z.object({
  status: z.enum(OrderStatus).optional(),
});
export type MyOrdersQuery = z.infer<typeof MyOrdersQuerySchema>;

export const BackofficeOrdersQuerySchema = z.object({
  status: z.enum(OrderStatus).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type BackofficeOrdersQuery = z.infer<typeof BackofficeOrdersQuerySchema>;

export const OrderIdParamsSchema = z.object({ id: z.uuid() });
export type OrderIdParams = z.infer<typeof OrderIdParamsSchema>;

// No OrderStatsQuery: STATS carries no query-string params in the spec (same as
// PRODUCT_STATS/SUPPLIER_STATS in earlier sprints, which likewise have no query schema).
