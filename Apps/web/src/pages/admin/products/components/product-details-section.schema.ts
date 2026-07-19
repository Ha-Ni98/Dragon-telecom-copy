import { z } from 'zod';

// Validation schema for product information form
export const productInformationSchema = z.object({
  productDescription: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters'),
  noUserPrice: z.number().min(0, 'Price must be positive').max(999999, 'Price must be reasonable'),
});

export type ProductInformationFormData = z.infer<typeof productInformationSchema>;
