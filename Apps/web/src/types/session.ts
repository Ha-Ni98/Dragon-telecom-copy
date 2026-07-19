import type { UserType, StaffProfileDto } from "@dragon-telecom/contract";

// Frontend-only view model — no server "who am I" endpoint exists (identity only exposes
// /me/permissions, not a full session/profile route; Sub-01 Sprint 1 finding). Derived
// client-side from the access token's JWT claims (authoritative: sub/type/clientId/staffId)
// plus the profile snapshot cached from the last login response (display-only; see
// lib/token-store.ts). `profile` is null for CLIENT sessions — the client module's own
// profile shape isn't modeled on the frontend yet (no client-portal pages ported in Sub-01).
export interface Session {
  userId: string;
  type: UserType;
  clientId?: string;
  staffId?: string;
  profile: StaffProfileDto | null;
}
