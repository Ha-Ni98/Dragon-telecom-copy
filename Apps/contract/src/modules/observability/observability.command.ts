import { z } from 'zod';
import { ClientActivityType } from './observability.enums';

// durationSeconds valid only for PRODUCT_VIEW/CATALOG_SESSION — 400 on SEARCH (spec
// Business Logic #2, confirmed by Test Scenarios: "SEARCH + duration -> 400").
export const ClientActivitySchema = z
  .object({
    type: z.enum(ClientActivityType),
    query: z.string().optional(),
    productId: z.uuid().optional(),
    durationSeconds: z.number().int().min(0).optional(),
  })
  .refine((d) => d.type !== ClientActivityType.SEARCH || d.durationSeconds === undefined, {
    message: 'durationSeconds is not valid for SEARCH',
    path: ['durationSeconds'],
  });
export type ClientActivityCommand = z.infer<typeof ClientActivitySchema>;

export const StaffSearchSchema = z.object({
  query: z.string(),
  matchedProductId: z.uuid().optional(),
});
export type StaffSearchCommand = z.infer<typeof StaffSearchSchema>;
