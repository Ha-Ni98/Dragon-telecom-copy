import { z } from 'zod';
import { BooleanQuerySchema } from '../../common/types';
import { PageScope, UserType } from './identity.enums';

export const UserListQuerySchema = z.object({
  type: z.enum(UserType).optional(),
  isEnabled: BooleanQuerySchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export const PagesQuerySchema = z.object({
  scope: z.enum(PageScope).optional(),
});
export type PagesQuery = z.infer<typeof PagesQuerySchema>;

export const UserIdParamsSchema = z.object({ id: z.uuid() });
export type UserIdParams = z.infer<typeof UserIdParamsSchema>;

export const RoleIdParamsSchema = z.object({ id: z.uuid() });
export type RoleIdParams = z.infer<typeof RoleIdParamsSchema>;

export const TechnicianIdParamsSchema = z.object({ id: z.uuid() });
export type TechnicianIdParams = z.infer<typeof TechnicianIdParamsSchema>;
