import type { AuthType } from './identity.enums';
import type { UserDto } from './identity.dtos';

// Only auth.loggedIn's payload is spelled out in the spec; user.created/updated/roleChanged
// are named without a field list — payloads below are the minimal natural shape (the
// resulting entity / changed ids), not additional spec-derived fields.
export type IdentityEvents = {
  'auth.loggedIn': { userId: string; authType: AuthType; ipAddress?: string };
  'user.created': { user: UserDto };
  'user.updated': { user: UserDto };
  'user.roleChanged': { userId: string; roleIds: string[] };
};
