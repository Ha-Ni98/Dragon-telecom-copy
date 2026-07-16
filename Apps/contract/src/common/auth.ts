import { z } from 'zod';
import { UserType } from '../modules/identity/identity.enums';

export const JWTPayloadSchema = z.object({
  sub: z.uuid(),
  type: z.enum(UserType),
  clientId: z.uuid().optional(),
  staffId: z.uuid().optional(),
});
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;
