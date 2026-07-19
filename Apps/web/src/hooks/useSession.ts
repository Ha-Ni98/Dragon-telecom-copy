import { useQuery } from "@tanstack/react-query";
import * as tokenStore from "@/lib/token-store";
import { refreshTokens } from "@/lib/axios";
import { qk } from "@/lib/query-keys";
import type { Session } from "@/types/session";

// No server "who am I" endpoint exists (identity only has /me/permissions — Sub-01 Sprint 1
// finding). Session is derived locally: decode the in-memory access token's JWT claims,
// bootstrapping it from the stored refresh token on a cold start via the same single-flight
// refreshTokens() the 401 interceptor uses, so a page reload never needs a dummy request.
export function useSession() {
  return useQuery({
    queryKey: qk.auth.session(),
    queryFn: async (): Promise<Session | null> => {
      if (!tokenStore.getAccessToken()) {
        if (!tokenStore.getRefreshToken()) return null;
        try {
          await refreshTokens();
        } catch {
          tokenStore.clear();
          return null;
        }
      }
      return tokenStore.getSession();
    },
    staleTime: Infinity,
    retry: false,
  });
}
