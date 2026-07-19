import {
  LoginResultResponseSchema,
  RefreshResultResponseSchema,
  AuthType,
  type LoginResultDto,
  type RefreshResultDto,
} from "@dragon-telecom/contract";

// `profile` is polymorphic by authType (identity.dtos.ts) — a staff-shaped profile here so
// token-store.ts's setLoginSession() caches it (StaffProfileResponseSchema.safeParse succeeds).
export const mockLoginResult: LoginResultDto = LoginResultResponseSchema.parse({
  authType: AuthType.STAFF,
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
  profile: { firstName: "Amine", lastName: "B." },
});

export const mockRefreshResult: RefreshResultDto = RefreshResultResponseSchema.parse({
  accessToken: "fresh-access-token",
  refreshToken: "fresh-refresh-token",
});
