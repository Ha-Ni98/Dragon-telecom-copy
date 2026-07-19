import { http } from "msw";
import { IDENTITY_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail, noContent } from "./envelope";
import { mockLoginResult, mockRefreshResult, mockPermissions } from "../data/auth.mock";

// IDENTITY_ROUTES are full literal paths (no `.BASE` + fragment split — see api-path.ts).
// No `/auth/me`: session is derived client-side from the JWT (hooks/useSession.ts).
// ME_PERMISSIONS is the one real "me" endpoint — effective page keys (Role→Page resolution
// lives server-side, not in the JWT).
export const authUrls = {
  login: apiUrl(IDENTITY_ROUTES.LOGIN),
  refresh: apiUrl(IDENTITY_ROUTES.REFRESH),
  logout: apiUrl(IDENTITY_ROUTES.LOGOUT),
  mePermissions: apiUrl(IDENTITY_ROUTES.ME_PERMISSIONS),
};

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3).
export const authHandlers = [
  http.post(authUrls.login, () => ok(mockLoginResult)),
  http.post(authUrls.refresh, () => ok(mockRefreshResult)),
  http.post(authUrls.logout, () => noContent()),
  http.get(authUrls.mePermissions, () => ok(mockPermissions)),
];

export const authErrorHandlers = {
  loginInvalidCredentials: () =>
    http.post(authUrls.login, () =>
      fail(ErrorCode.AUTH_INVALID_CREDENTIALS, "Invalid username or password", 401),
    ),
  logoutServerError: () =>
    http.post(authUrls.logout, () => fail(ErrorCode.INTERNAL_SERVER_ERROR, "boom", 500)),
  refreshUnauthorized: () =>
    http.post(authUrls.refresh, () =>
      fail(ErrorCode.AUTH_UNAUTHORIZED, "Invalid refresh token", 401),
    ),
  mePermissionsUnauthorized: () =>
    http.get(authUrls.mePermissions, () => fail(ErrorCode.AUTH_UNAUTHORIZED, "expired", 401)),
};
