import { z } from 'zod';

/**
 * Form validation schema
 */
export const clientModificationSchema = z.object({
  status: z.number().min(0).max(3, 'Invalid status'),
  credit: z.number().min(-999999).max(999999, 'Credit must be between -999,999 and 999,999'),
  username: z.string().optional(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  categoryId: z.number().optional(),
}).refine((data) => {
  // If status is active (0), username is required
  if (data.status === 0 && !data.username) {
    return false;
  }
  return true;
}, {
  message: 'Username is required when status is Active',
  path: ['username'],
}).refine((data) => {
  // If status is active (0), category is required
  if (data.status === 0 && !data.categoryId) {
    return false;
  }
  return true;
}, {
  message: 'Category is required when status is Active',
  path: ['categoryId'],
}).refine((data) => {
  // If password is provided, confirmPassword must match
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ClientModificationFormData = z.infer<typeof clientModificationSchema>;
