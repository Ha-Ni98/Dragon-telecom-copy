import { z } from 'zod';

// Validation schema for supplier modification
export const supplierModificationSchema = z.object({
  unitPrice: z.number().min(0, 'Unit price must be positive').max(999999, 'Unit price must be reasonable'),
  quantity: z.number().min(0, 'Quantity must be positive').max(99999, 'Quantity must be reasonable'),
});

export type SupplierModificationFormData = z.infer<typeof supplierModificationSchema>;
