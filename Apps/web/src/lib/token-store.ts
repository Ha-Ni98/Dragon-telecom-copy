import {
  JWTPayloadSchema,
  StaffProfileResponseSchema,
  type LoginResultDto,
  type RefreshResultDto,
  type StaffProfileDto,
} from "@dragon-telecom/contract";
import type { Session } from "@/types/session";

// The only module that touches auth tokens (plan.md §1.3). Access token lives in a
// module-scoped variable only — never persisted, never readable by anything but this
// process's memory (narrows the XSS window, plan.md §8.1). Refresh token persists across
// reloads so a silent-refresh cold start can restore the session without a login screen.
const REFRESH_TOKEN_KEY = "sv_refresh_token";
// Display-only cache of the last login's profile (see getSession() below) — never used for
// authorization, only so a cold start can show a name/role without a server round trip.
const PROFILE_CACHE_KEY = "sv_profile_cache";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function decodeJwtPayload(token: string): unknown {
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    return JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function readProfileCache(): StaffProfileDto | null {
  const raw = localStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return null;
  const parsed = StaffProfileResponseSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

// Called on login (never on refresh — a token refresh doesn't return a fresh profile, and
// the identity doesn't change mid-session). `result.profile` is polymorphic by authType
// (StaffProfileDto for staff/admin, an unmodeled client shape for client); parsing it
// against StaffProfileResponseSchema is how we tell them apart — a client login just leaves
// the cache empty.
export function setLoginSession(result: LoginResultDto): void {
  accessToken = result.accessToken;
  localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
  const staffProfile = StaffProfileResponseSchema.safeParse(result.profile);
  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(staffProfile.success ? staffProfile.data : null));
}

export function setTokens(tokens: Pick<RefreshResultDto, "accessToken" | "refreshToken">): void {
  accessToken = tokens.accessToken;
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

// No server "who am I" endpoint exists — session is the access token's own JWT claims
// (sub/type/clientId/staffId, authoritative — the backend signed them) plus the cached
// display profile. Returns null if there's no valid access token in memory; callers that
// need to bootstrap after a reload call refreshTokens() first (see hooks/useSession.ts).
export function getSession(): Session | null {
  if (!accessToken) return null;
  const claims = JWTPayloadSchema.safeParse(decodeJwtPayload(accessToken));
  if (!claims.success) return null;
  return {
    userId: claims.data.sub,
    type: claims.data.type,
    clientId: claims.data.clientId,
    staffId: claims.data.staffId,
    profile: readProfileCache(),
  };
}

export function clear(): void {
  accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(PROFILE_CACHE_KEY);
}
