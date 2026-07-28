import { z } from 'zod';
import { RepairStatus } from './repairs.enums';

// S13 — intake-date range + pagination (R2: 10 per page, page selector in the filter row; the
// board is not a table, so the pager is not a table footer). `from`/`to` filter on intakeAt.
export const RepairListQuerySchema = z.object({
  status: z.enum(RepairStatus).optional(),
  technicianId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type RepairListQuery = z.infer<typeof RepairListQuerySchema>;

export const RepairIdParamsSchema = z.object({ id: z.uuid() });
export type RepairIdParams = z.infer<typeof RepairIdParamsSchema>;

export const RepairPartParamsSchema = z.object({ id: z.uuid(), partId: z.uuid() });
export type RepairPartParams = z.infer<typeof RepairPartParamsSchema>;
