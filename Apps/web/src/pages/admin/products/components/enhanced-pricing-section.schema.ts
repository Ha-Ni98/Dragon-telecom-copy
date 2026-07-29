import { z } from 'zod';

// Enhanced validation schema for pricing with business rules
export const enhancedPricingSchema = z.object({
  noUserPrice: z.number().min(0, 'Price must be positive').max(999999, 'Price must be reasonable'),
  categoryPrices: z.record(z.string(), z.number().min(0, 'Price must be positive').max(999999, 'Price must be reasonable')),
  bulkDiscountPercentage: z.number().min(0, 'Discount must be positive').max(100, 'Discount cannot exceed 100%').optional(),
});

export type EnhancedPricingFormData = z.infer<typeof enhancedPricingSchema>;
