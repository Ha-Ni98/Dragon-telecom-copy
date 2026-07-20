import { useQuery } from "@tanstack/react-query";
import * as authService from "@/services/auth.service";
import { qk } from "@/lib/query-keys";

// Effective page keys for the current session (IDENTITY_ROUTES.ME_PERMISSIONS) — distinct
// from useSession's locally-derived JWT claims, since Role→Page resolution lives server-side.
export function usePermissions() {
  return useQuery({
    queryKey: qk.auth.permissions(),
    queryFn: authService.getMyPermissions,
    staleTime: 60_000,
  });
}
