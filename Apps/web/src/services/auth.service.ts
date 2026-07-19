import {
  IDENTITY_ROUTES,
  type ApiResponse,
  type LoginCommand,
  type LoginResultDto,
  type RefreshCommand,
} from "@dragon-telecom/contract";
import { api } from "@/lib/axios";
import { apiPath } from "@/lib/api-path";
import * as tokenStore from "@/lib/token-store";

export async function login(command: LoginCommand): Promise<LoginResultDto> {
  const res = await api.post<ApiResponse<LoginResultDto>>(apiPath(IDENTITY_ROUTES.LOGIN), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  tokenStore.setLoginSession(res.data.data);
  return res.data.data;
}

// IDENTITY_ROUTES.LOGOUT requires a RefreshCommand body, but reads it from the token
// store rather than taking a parameter — the only caller today (AuthProvider) invokes this
// as a zero-argument mutation, mirroring the same "read the store, don't ask the caller"
// pattern axios.ts's refreshTokens() already uses. Local logout always happens (tokens
// clear in `finally`) even if the API call itself throws.
export async function logout(): Promise<void> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) {
    tokenStore.clear();
    return;
  }
  const command: RefreshCommand = { refreshToken };
  try {
    await api.post(apiPath(IDENTITY_ROUTES.LOGOUT), command);
  } finally {
    tokenStore.clear();
  }
}

// The only real "me" endpoint (IDENTITY_ROUTES has no "who am I"/full-profile route) —
// session itself comes from hooks/useSession.ts reading the JWT locally via token-store.ts,
// not a service call. Effective page keys still require a server round trip (Role→Page
// resolution lives in the DB, not the JWT).
export async function getMyPermissions(): Promise<string[]> {
  const res = await api.get<ApiResponse<string[]>>(apiPath(IDENTITY_ROUTES.ME_PERMISSIONS));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// IDENTITY_ROUTES.REFRESH's real implementation is axios.ts's own single-flight
// refreshTokens() — re-exported here only so every contract route maps to a service
// function (plan.md D2). No dedicated hook: calling this outside the 401 interceptor
// would risk racing a second refresh against the interceptor's own in-flight one.
export { refreshTokens as refresh } from "@/lib/axios";
