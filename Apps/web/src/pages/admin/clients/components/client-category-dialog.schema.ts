import { z } from 'zod';

// Validation schema for client category form
export const clientCategorySchema = z.object({
  categoryName: z.string()
    .min(2, 'Category name must be at least 2 characters')
    .max(50, 'Category name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Category name can only contain letters, numbers, spaces, and hyphens'),
  categoryStatus: z.number().min(0).max(1), // CategoryStatusCode
});

export type ClientCategoryFormData = z.infer<typeof clientCategorySchema>;
