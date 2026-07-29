import { z } from 'zod';
import { ClientActivityType } from './observability.enums';

export const ClientActivityQuerySchema = z.object({
  type: z.enum(ClientActivityType).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type ClientActivityQuery = z.infer<typeof ClientActivityQuerySchema>;

export const StaffSearchesQuerySchema = z.object({
  userId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().optional(),
});
export type StaffSearchesQuery = z.infer<typeof StaffSearchesQuerySchema>;

// "20/page" per the route note.
export const LogsQuerySchema = z.object({
  search: z.string().optional(),
  userId: z.uuid().optional(),
  actionType: z.string().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type LogsQuery = z.infer<typeof LogsQuerySchema>;

// Named for its route (CLIENT_ACTIVITY's :id) rather than ClientIdParams — that name is
// already exported by the clients module, and the root barrel re-exports both.
export const ClientActivityIdParamsSchema = z.object({ id: z.uuid() });
export type ClientActivityIdParams = z.infer<typeof ClientActivityIdParamsSchema>;
