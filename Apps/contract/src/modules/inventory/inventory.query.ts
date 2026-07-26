import { z } from 'zod';
import { BooleanQuerySchema } from '../../common/types';
import { MovementType } from './inventory.enums';

// `search` matches product name (case-insensitive substring) or barcode (prefix) — resolved
// backend-side in InventoryReadService.getStock so the Product.barcode unique index applies
// (S1 finding F1). Applied before the CSV branch: an export sent with `search` exports the
// filtered set.
export const StockQuerySchema = z.object({
  lowStockOnly: BooleanQuerySchema.optional(),
  search: z.string().optional(),
  // Only "csv" is documented ("CSV export param") — no other format is named in the spec.
  export: z.literal('csv').optional(),
});
export type StockQuery = z.infer<typeof StockQuerySchema>;

export const MovementsQuerySchema = z.object({
  productId: z.uuid().optional(),
  type: z.enum(MovementType).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  staffId: z.uuid().optional(),
  // Free-text product search (name substring / barcode prefix) — filters the movement's product
  // relation, not the movement itself.
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type MovementsQuery = z.infer<typeof MovementsQuerySchema>;

// No filter fields are named in the spec beyond the "holder + age" display columns —
// kept to pagination only rather than inventing filters.
export const ReservationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReservationsQuery = z.infer<typeof ReservationsQuerySchema>;
