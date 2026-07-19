import { z } from 'zod';

/**
 * Form validation schema
 */
export const supplierAddSchema = z.object({
  supplierName: z.string()
    .min(1, 'Supplier name is required')
    .min(2, 'Supplier name must be at least 2 characters')
    .max(100, 'Supplier name must be less than 100 characters'),
  supplierPersonName: z.string()
    .min(2, 'Person name must be at least 2 characters')
    .max(100, 'Person name must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  supplierPhone: z.string()
    .min(8, 'Phone number must be at least 8 characters')
    .max(20, 'Phone number must be less than 20 characters')
    .regex(/^[+]?[0-9\s\-()]+$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  supplierEmail: z.string()
    .email('Invalid email format')
    .max(100, 'Email must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  supplierLocation: z.string()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location must be less than 200 characters')
    .optional()
    .or(z.literal('')),
  supplierCredit: z.number()
    .min(0, 'Credit cannot be negative')
    .max(999999, 'Credit must be less than 999,999')
    .default(0),
});

export type SupplierAddFormData = z.input<typeof supplierAddSchema>;
