import { z } from 'zod';
import { RepairStatus } from './repairs.enums';

export const RepairListQuerySchema = z.object({
  status: z.enum(RepairStatus).optional(),
  technicianId: z.uuid().optional(),
});
export type RepairListQuery = z.infer<typeof RepairListQuerySchema>;

export const RepairIdParamsSchema = z.object({ id: z.uuid() });
export type RepairIdParams = z.infer<typeof RepairIdParamsSchema>;

export const RepairPartParamsSchema = z.object({ id: z.uuid(), partId: z.uuid() });
export type RepairPartParams = z.infer<typeof RepairPartParamsSchema>;
