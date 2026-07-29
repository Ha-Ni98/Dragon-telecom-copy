import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "msw";
import type { ReactNode } from "react";
import { ErrorCode } from "@dragon-telecom/contract";
import { server } from "../../fixtures/msw/server";
import { authUrls, authErrorHandlers } from "../../fixtures/msw/auth.handlers";
import { fail } from "../../fixtures/msw/envelope";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  mockLoginResult,
  mockPermissions,
  mockSessionAfterLogin,
  mockSessionAfterRefresh,
  mockJwtPayload,
  makeFakeAccessToken,
} from "../../fixtures/data/auth.mock";
import { useLogin } from "@/hooks/useLogin";
import { useLogout } from "@/hooks/useLogout";
import { useSession } from "@/hooks/useSession";
import { usePermissions } from "@/hooks/usePermissions";
import { qk } from "@/lib/query-keys";
import { setRedirect } from "@/lib/axios";
import * as tokenStore from "@/lib/token-store";

beforeEach(() => {
  tokenStore.clear();
  // A 401 with no refresh token falls through to axios's real redirect path; stub it so
  // these tests don't trigger jsdom's unimplemented navigation (noisy, not a failure).
  setRedirect(vi.fn());
});

// A local wrapper (not the shared createQueryWrapper) so tests can reach into the same
// QueryClient instance both hooks share, for direct, public-API cache assertions
// (getQueryData) — not internals.
function makeWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

// useSession's queryFn never actually throws (src/hooks/useSession.ts) — every path,
// including a failed cold-start refresh, resolves to `Session | null`. There is no
// isError state to exercise; these four cover its real branches instead.
describe("useSession", () => {
  it("resolves with null when there are no tokens at all", async () => {
    const { result } = renderHook(() => useSession(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("resolves with the decoded session when an access token is already present", async () => {
    tokenStore.setTokens({ accessToken: makeFakeAccessToken(mockJwtPayload), refreshToken: "r" });
    const { result } = renderHook(() => useSession(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // No setLoginSession() call here, so the profile cache is untouched (null) — matches
    // mockSessionAfterRefresh's shape even though this test never calls refresh.
    expect(result.current.data).toEqual(mockSessionAfterRefresh);
  });

  it("cold start: refreshes silently on a valid persisted refresh token and resolves the session", async () => {
    localStorage.setItem("sv_refresh_token", "valid-refresh");
    const { result } = renderHook(() => useSession(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSessionAfterRefresh);
  });

  it("cold start: resolves with null (not an error) when the persisted refresh token is invalid", async () => {
    localStorage.setItem("sv_refresh_token", "revoked-refresh");
    server.use(authErrorHandlers.refreshUnauthorized());
    const { result } = renderHook(() => useSession(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(tokenStore.getRefreshToken()).toBeNull(); // cleared by the failed-refresh branch
  });
});

describe("useLogin", () => {
  it("exposes mutate/isPending and invalidates the session query on success", async () => {
    const wrapper = createQueryWrapper();

    const { result: sessionResult } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(sessionResult.current.isSuccess).toBe(true));
    expect(sessionResult.current.data).toBeNull(); // no tokens yet

    const { result: loginResult } = renderHook(() => useLogin(), { wrapper });
    expect(loginResult.current.isPending).toBe(false);
    loginResult.current.mutate({ username: "amine.b", password: "secret" });
    await waitFor(() => expect(loginResult.current.isSuccess).toBe(true));

    // Invalidation triggers a refetch of the still-mounted, active session query, which now
    // decodes the real access token login just stored.
    await waitFor(() => expect(sessionResult.current.data).toEqual(mockSessionAfterLogin));
  });
});

describe("useLogout", () => {
  it("clears the entire query cache once the mutation settles", async () => {
    tokenStore.setLoginSession(mockLoginResult);
    const { Wrapper, queryClient } = makeWrapperWithClient();

    const { result: sessionResult } = renderHook(() => useSession(), { wrapper: Wrapper });
    await waitFor(() => expect(sessionResult.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(qk.auth.session())).toEqual(mockSessionAfterLogin);

    const { result: logoutResult } = renderHook(() => useLogout(), { wrapper: Wrapper });
    logoutResult.current.mutate();
    await waitFor(() => expect(logoutResult.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(qk.auth.session())).toBeUndefined();
  });

  it("still clears the cache when the logout API call itself fails", async () => {
    tokenStore.setLoginSession(mockLoginResult);
    server.use(
      http.post(authUrls.logout, () => fail(ErrorCode.INTERNAL_SERVER_ERROR, "boom", 500)),
    );
    const { Wrapper, queryClient } = makeWrapperWithClient();

    const { result: sessionResult } = renderHook(() => useSession(), { wrapper: Wrapper });
    await waitFor(() => expect(sessionResult.current.isSuccess).toBe(true));

    const { result: logoutResult } = renderHook(() => useLogout(), { wrapper: Wrapper });
    logoutResult.current.mutate();
    await waitFor(() => expect(logoutResult.current.isError).toBe(true));

    expect(queryClient.getQueryData(qk.auth.session())).toBeUndefined();
  });
});

describe("usePermissions", () => {
  it("resolves with the effective page keys on success", async () => {
    const { result } = renderHook(() => usePermissions(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPermissions);
  });

  it("surfaces an error when unauthorized (unlike useSession, this hook doesn't self-catch)", async () => {
    server.use(
      http.get(authUrls.mePermissions, () => fail(ErrorCode.AUTH_UNAUTHORIZED, "expired", 401)),
    );
    const { result } = renderHook(() => usePermissions(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
