import { z } from 'zod';
import { MovementDirection, MovementReferenceType, MovementType, ReservationHolderType } from './inventory.enums';

export const StockRowResponseSchema = z.object({
  productId: z.uuid(),
  name: z.string(),
  barcode: z.string().optional(),
  quantityOnHand: z.number().int(),
  quantityReserved: z.number().int(),
  availableQuantity: z.number().int(),
  avgStockPrice: z.number(),
  stockValue: z.number(),
  reorderThreshold: z.number().int().min(0),
  isLow: z.boolean(),
});
export type StockRowDto = z.infer<typeof StockRowResponseSchema>;

// referenceType used to be an open string (like AuditLog.actionType) because SALE/ORDER/REPAIR/
// RETURN's owning modules didn't exist yet. They all exist now (S1, RC-4), and the resolver that
// turns a movement into a human reference must be exhaustive over every writer — so this is now a
// closed enum (MovementReferenceType), not a fabricated-then-open union.
export const MovementResponseSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  productName: z.string(),
  direction: z.enum(MovementDirection),
  type: z.enum(MovementType),
  quantity: z.number().int(),
  unitCost: z.number().optional(),
  remainingQuantity: z.number().int().optional(),
  costOfGoods: z.number().optional(),
  profit: z.number().optional(),
  balanceAfter: z.number().int(),
  referenceType: z.enum(MovementReferenceType),
  referenceId: z.uuid(),
  referenceLabel: z.string(),
  reason: z.string().optional(),
  staffName: z.string(),
  createdAt: z.iso.datetime(),
});
export type MovementDto = z.infer<typeof MovementResponseSchema>;

export const ReservationResponseSchema = z.object({
  productId: z.uuid(),
  productName: z.string(),
  quantity: z.number().int(),
  holderType: z.enum(ReservationHolderType),
  holderReference: z.string(),
  ageHours: z.number(),
});
export type ReservationDto = z.infer<typeof ReservationResponseSchema>;

export const AdjustmentResultResponseSchema = z.object({
  reference: z.string(),
  lines: z.array(
    z.object({
      productId: z.uuid(),
      delta: z.number().int(),
      movementId: z.uuid(),
    }),
  ),
});
export type AdjustmentResultDto = z.infer<typeof AdjustmentResultResponseSchema>;
