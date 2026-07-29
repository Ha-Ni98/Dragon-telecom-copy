import { z } from 'zod';
import { UpdatePricingSchema } from '../catalog/catalog.command';
import { AdjustmentReason } from './inventory.enums';

// prices? nests catalog's real UpdatePricingSchema (value import) so the whole command
// stays a single z.infer per rules §3.1 — see clients.dtos.ts for the same pattern.
export const CreateAdjustmentSchema = z.object({
  reason: z.enum(AdjustmentReason),
  note: z.string().optional(),
  lines: z.array(
    z.object({
      productId: z.uuid(),
      countedQuantity: z.number().int().min(0),
      unitCost: z.number().min(0).optional(),
      prices: UpdatePricingSchema.optional(),
    }),
  ),
});
export type CreateAdjustmentCommand = z.infer<typeof CreateAdjustmentSchema>;
