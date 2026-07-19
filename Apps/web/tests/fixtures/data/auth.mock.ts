import {
  AuthTokensResponseSchema,
  SessionUserResponseSchema,
  UserRole,
  type AuthTokensDTO,
  type SessionUserDTO,
} from "@dragon-telecom/contract";

export const mockAuthTokens: AuthTokensDTO = AuthTokensResponseSchema.parse({
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
  role: UserRole.USER,
});

export const mockUserSession: SessionUserDTO = SessionUserResponseSchema.parse({
  id: "8400b859-fc6c-4a1a-9c1e-1a2b3c4d5e6f",
  username: "sam.user",
  role: UserRole.USER,
  fullName: "Sam User",
});

export const mockAdminSession: SessionUserDTO = SessionUserResponseSchema.parse({
  id: "8400b859-fc6c-4a1a-9c1e-2b3c4d5e6f70",
  username: "alex.admin",
  role: UserRole.ADMIN,
  fullName: "Alex Admin",
});
