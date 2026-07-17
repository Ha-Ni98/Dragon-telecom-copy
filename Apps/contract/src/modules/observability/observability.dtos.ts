import { z } from 'zod';
import { ClientActivityType } from './observability.enums';

export const ClientActivityResponseSchema = z.object({
  type: z.enum(ClientActivityType),
  query: z.string().optional(),
  product: z.object({ id: z.uuid(), name: z.string() }).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  createdAt: z.iso.datetime(),
});
export type ClientActivityDto = z.infer<typeof ClientActivityResponseSchema>;

export const StaffSearchResponseSchema = z.object({
  userId: z.uuid(),
  userName: z.string(),
  query: z.string(),
  matchedProduct: z.object({ id: z.uuid(), name: z.string() }).optional(),
  createdAt: z.iso.datetime(),
});
export type StaffSearchDto = z.infer<typeof StaffSearchResponseSchema>;

// actionType is an open string, never an enum (spec) — adding an actionType is adding a
// listener, zero schema change.
export const AuditLogResponseSchema = z.object({
  id: z.uuid(),
  user: z.object({ id: z.uuid(), username: z.string() }).optional(),
  actionType: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  description: z.string(),
  ipAddress: z.string().optional(),
  createdAt: z.iso.datetime(),
});
export type AuditLogDto = z.infer<typeof AuditLogResponseSchema>;

export const LogStatsResponseSchema = z.object({
  total: z.number().int().min(0),
  today: z.number().int().min(0),
  week: z.number().int().min(0),
  month: z.number().int().min(0),
});
export type LogStatsDto = z.infer<typeof LogStatsResponseSchema>;
