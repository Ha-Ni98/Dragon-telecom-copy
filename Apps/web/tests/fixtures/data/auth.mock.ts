import {
  LoginResultResponseSchema,
  RefreshResultResponseSchema,
  JWTPayloadSchema,
  AuthType,
  UserType,
  PageKey,
  type LoginResultDto,
  type RefreshResultDto,
  type JWTPayload,
} from "@dragon-telecom/contract";
import type { Session } from "@/types/session";

function base64url(input: object): string {
  return btoa(JSON.stringify(input)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// token-store.ts's decodeJwtPayload() only reads/JSON.parses the middle segment — it never
// verifies a signature (that's the backend's job) — so a syntactically real, unsigned JWT is
// enough to exercise the real getSession()/useSession() decode path in tests.
export function makeFakeAccessToken(payload: JWTPayload): string {
  JWTPayloadSchema.parse(payload); // fail fast if the fixture itself is malformed
  return `${base64url({ alg: "none", typ: "JWT" })}.${base64url(payload)}.fake-signature`;
}

export const mockJwtPayload: JWTPayload = {
  sub: "8400b859-fc6c-4a1a-9c1e-1a2b3c4d5e6f",
  type: UserType.STAFF,
  staffId: "8400b859-fc6c-4a1a-9c1e-2b3c4d5e6f70",
};

// `profile` is polymorphic by authType (identity.dtos.ts) — a staff-shaped profile here so
// token-store.ts's setLoginSession() caches it (StaffProfileResponseSchema.safeParse succeeds).
export const mockLoginResult: LoginResultDto = LoginResultResponseSchema.parse({
  authType: AuthType.STAFF,
  accessToken: makeFakeAccessToken(mockJwtPayload),
  refreshToken: "mock-refresh-token",
  profile: { firstName: "Amine", lastName: "B." },
});

// The decoded Session a successful login (mockLoginResult) resolves to via
// tokenStore.getSession() — JWT claims + the profile cached by setLoginSession().
export const mockSessionAfterLogin: Session = {
  userId: mockJwtPayload.sub,
  type: mockJwtPayload.type,
  clientId: mockJwtPayload.clientId,
  staffId: mockJwtPayload.staffId,
  profile: { firstName: "Amine", lastName: "B." },
};

export const mockRefreshResult: RefreshResultDto = RefreshResultResponseSchema.parse({
  accessToken: makeFakeAccessToken(mockJwtPayload),
  refreshToken: "fresh-refresh-token",
});

// A cold-start refresh (setTokens(), never setLoginSession()) never touches the profile
// cache — getSession().profile stays null unless a prior login populated it.
export const mockSessionAfterRefresh: Session = {
  userId: mockJwtPayload.sub,
  type: mockJwtPayload.type,
  clientId: mockJwtPayload.clientId,
  staffId: mockJwtPayload.staffId,
  profile: null,
};

// Real PageKey enum members (identity.enums.ts) — IDENTITY_ROUTES.ME_PERMISSIONS has no
// dedicated response schema in the contract (bare `string[]`, per IIdentityService.getEffectivePages).
export const mockPermissions: string[] = [PageKey.STAFF_POS, PageKey.STAFF_PRODUCTS];
