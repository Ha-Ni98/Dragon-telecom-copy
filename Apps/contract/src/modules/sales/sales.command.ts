import { z } from 'zod';
import { ReturnType } from './sales.enums';

const SaleLineInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  serialNumbers: z.array(z.string()).optional(),
});

export const SaleDraftSchema = z.object({
  posClientId: z.uuid().optional(),
  discountAmount: z.number().min(0).optional(),
  note: z.string().optional(),
  lines: z.array(SaleLineInputSchema).min(1),
});
export type SaleDraftCommand = z.infer<typeof SaleDraftSchema>;

// No field list given beyond "PATCH ... DRAFT only" (a backend guard); mirrors
// SaleDraftCommand with every field optional for a partial update.
export const UpdateSaleDraftSchema = z.object({
  posClientId: z.uuid().optional(),
  discountAmount: z.number().min(0).optional(),
  note: z.string().optional(),
  lines: z.array(SaleLineInputSchema).min(1).optional(),
});
export type UpdateSaleDraftCommand = z.infer<typeof UpdateSaleDraftSchema>;

export const ConfirmSaleSchema = z.object({
  paidAmount: z.number().min(0),
});
export type ConfirmSaleCommand = z.infer<typeof ConfirmSaleSchema>;

export const CreateReturnSchema = z.object({
  saleId: z.uuid(),
  type: z.enum(ReturnType),
  reason: z.string().optional(),
  lines: z
    .array(
      z.object({
        saleLineId: z.uuid(),
        quantity: z.number().int().min(1),
        restock: z.boolean(),
        refundAmount: z.number().min(0),
      }),
    )
    .min(1),
});
export type CreateReturnCommand = z.infer<typeof CreateReturnSchema>;
