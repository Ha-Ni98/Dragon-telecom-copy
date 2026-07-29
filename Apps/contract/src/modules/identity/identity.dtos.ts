import { z } from 'zod';
import { AuthType, PageScope, UserType } from './identity.enums';

// Sanctioned §0.1.3 exception: raw access + refresh tokens returned to their owner at login/refresh
export const LoginResultResponseSchema = z.object({
  authType: z.enum(AuthType),
  accessToken: z.string(),
  refreshToken: z.string(),
  // Polymorphic by authType: StaffProfileDto (staff/admin) or the clients module's own
  // profile shape (client). Identity does not depend on clients, so this stays unknown
  // here; the consumer narrows on `authType`.
  profile: z.unknown(),
});
export type LoginResultDto = z.infer<typeof LoginResultResponseSchema>;

export const RefreshResultResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type RefreshResultDto = z.infer<typeof RefreshResultResponseSchema>;

export const StaffProfileResponseSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
});
export type StaffProfileDto = z.infer<typeof StaffProfileResponseSchema>;

export const RoleResponseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  isEnabled: z.boolean(),
  pageKeys: z.array(z.string()),
});
export type RoleDto = z.infer<typeof RoleResponseSchema>;

export const PageResponseSchema = z.object({
  key: z.string(),
  label: z.string(),
  group: z.string(),
  scope: z.enum(PageScope),
});
export type PageDto = z.infer<typeof PageResponseSchema>;

export const TechnicianResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string().optional(),
  isEnabled: z.boolean(),
});
export type TechnicianDto = z.infer<typeof TechnicianResponseSchema>;

// Never expose passwordHash / token hashes / token ids (spec Data Mapping).
export const UserResponseSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  email: z.email().optional(),
  type: z.enum(UserType),
  isEnabled: z.boolean(),
  lastLoginAt: z.iso.datetime().optional(),
  profile: StaffProfileResponseSchema,
  roles: z.array(RoleResponseSchema),
  effectivePages: z.array(z.string()),
});
export type UserDto = z.infer<typeof UserResponseSchema>;
