import { z } from 'zod';
import { MovementDirection, MovementType, ReservationHolderType } from './inventory.enums';

export const StockRowResponseSchema = z.object({
  productId: z.uuid(),
  name: z.string(),
  barcode: z.string().optional(),
  quantityOnHand: z.number().int(),
  quantityReserved: z.number().int(),
  availableQuantity: z.number().int(),
  averageCost: z.number(),
  stockValue: z.number(),
  reorderThreshold: z.number().int().min(0),
  isLow: z.boolean(),
});
export type StockRowDto = z.infer<typeof StockRowResponseSchema>;

// referenceType is an open string in the schema (like AuditLog.actionType), not a Prisma
// enum — kept as z.string() rather than a fabricated closed union.
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
  referenceType: z.string(),
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
