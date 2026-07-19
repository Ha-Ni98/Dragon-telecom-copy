import { z } from 'zod';
import { BooleanQuerySchema } from '../../common/types';
import { ClientStatus } from './clients.enums';

export const AdminClientListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(ClientStatus).optional(),
  isEnabled: BooleanQuerySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type AdminClientListQuery = z.infer<typeof AdminClientListQuerySchema>;

export const PosClientSearchQuerySchema = z.object({
  q: z.string(),
});
export type PosClientSearchQuery = z.infer<typeof PosClientSearchQuerySchema>;

// POS_CLIENT_ROUTES.ADMIN's GET (list) has no query schema in the spec beyond the route note
// ("the only manual client creation") — mirrors AdminClientListQuerySchema's shape (plan-
// client-purch.md §I.2's `listPosClients(query)` left this type unnamed, discovered as a
// genuine gap while writing the Sprint 2 interface, same as ADMIN_STATS/VALIDATE_PHONE in
// Sprint 1).
export const PosClientListQuerySchema = z.object({
  search: z.string().optional(),
  isEnabled: BooleanQuerySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type PosClientListQuery = z.infer<typeof PosClientListQuerySchema>;

export const ClientIdParamsSchema = z.object({ id: z.uuid() });
export type ClientIdParams = z.infer<typeof ClientIdParamsSchema>;

export const PosClientIdParamsSchema = z.object({ id: z.uuid() });
export type PosClientIdParams = z.infer<typeof PosClientIdParamsSchema>;

export const CartItemParamsSchema = z.object({ productId: z.uuid() });
export type CartItemParams = z.infer<typeof CartItemParamsSchema>;
