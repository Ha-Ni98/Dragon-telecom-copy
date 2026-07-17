import { z } from 'zod';
import { UserType } from './identity.enums';

export const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type LoginCommand = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshCommand = z.infer<typeof RefreshSchema>;

const StaffProfileInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
});

// roleIds: required non-empty iff type STAFF; forbidden iff type ADMIN
export const CreateUserSchema = z
  .object({
    username: z.string(),
    email: z.email().optional(),
    password: z.string().min(8),
    type: z.enum([UserType.ADMIN, UserType.STAFF]),
    profile: StaffProfileInputSchema,
    roleIds: z.array(z.uuid()).optional(),
  })
  .refine((data) => data.type !== UserType.STAFF || (data.roleIds?.length ?? 0) > 0, {
    message: 'roleIds is required and non-empty for STAFF users',
    path: ['roleIds'],
  })
  .refine((data) => data.type !== UserType.ADMIN || data.roleIds === undefined, {
    message: 'roleIds is forbidden for ADMIN users',
    path: ['roleIds'],
  });
export type CreateUserCommand = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  isEnabled: z.boolean().optional(),
  roleIds: z.array(z.uuid()).optional(),
  profile: StaffProfileInputSchema.partial().optional(),
  password: z.string().min(8).optional(),
});
export type UpdateUserCommand = z.infer<typeof UpdateUserSchema>;

export const CreateRoleSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
});
export type CreateRoleCommand = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateRoleCommand = z.infer<typeof UpdateRoleSchema>;

// STAFF-scope-only enforcement needs the seeded Page registry (DB lookup) — backend concern.
export const SetRolePagesSchema = z.object({
  pageKeys: z.array(z.string()),
});
export type SetRolePagesCommand = z.infer<typeof SetRolePagesSchema>;

export const CreateTechnicianSchema = z.object({
  name: z.string(),
  phone: z.string().optional(),
});
export type CreateTechnicianCommand = z.infer<typeof CreateTechnicianSchema>;

export const UpdateTechnicianSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateTechnicianCommand = z.infer<typeof UpdateTechnicianSchema>;
