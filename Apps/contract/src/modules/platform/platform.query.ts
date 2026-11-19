import { z } from 'zod';

// wilayaId required to resolve a fee; communeId is the optional override lookup.
export const FeeQuerySchema = z.object({
  wilayaId: z.uuid(),
  communeId: z.uuid().optional(),
});
export type FeeQuery = z.infer<typeof FeeQuerySchema>;

export const HeroSlideIdParamsSchema = z.object({ id: z.uuid() });
export type HeroSlideIdParams = z.infer<typeof HeroSlideIdParamsSchema>;

export const FeesExportQuerySchema = z.object({
  // S25 added "pdf" alongside excel/csv/json.
  format: z.enum(['excel', 'csv', 'json', 'pdf']).optional(),
});
export type FeesExportQuery = z.infer<typeof FeesExportQuerySchema>;
