import { z } from 'zod';

// wilayaId required to resolve a fee; communeId is the optional override lookup.
export const FeeQuerySchema = z.object({
  wilayaId: z.uuid(),
  communeId: z.uuid().optional(),
});
export type FeeQuery = z.infer<typeof FeeQuerySchema>;

export const FeesExportQuerySchema = z.object({
  format: z.enum(['excel', 'csv', 'json']).optional(),
});
export type FeesExportQuery = z.infer<typeof FeesExportQuerySchema>;
