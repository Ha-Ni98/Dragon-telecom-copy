import { z } from 'zod';

// Validation schema for supplier form
export const supplierFormSchema = z.object({
  supplierName: z.string().min(1, 'Supplier name is required'),
  supplierPersonName: z.string().min(1, 'Contact person name is required'),
  supplierPhone: z.string().min(1, 'Phone number is required'),
  supplierEmail: z.string().email('Invalid email address'),
  supplierLocation: z.string().min(1, 'Location is required'),
  supplierCredit: z.number().min(0, 'Credit must be non-negative'),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
