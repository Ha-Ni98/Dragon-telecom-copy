import { z } from 'zod';

// Validation schema for model form
export const modelSchema = z.object({
  modelName: z.string()
    .min(2, 'Model name must be at least 2 characters')
    .max(100, 'Model name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s-_.]+$/, 'Model name can only contain letters, numbers, spaces, hyphens, underscores, and dots'),
  idFamily: z.number().min(1, 'Please select a family'),
  idBrand: z.number().min(1, 'Please select a brand'),
});

export type ModelFormData = z.infer<typeof modelSchema>;
