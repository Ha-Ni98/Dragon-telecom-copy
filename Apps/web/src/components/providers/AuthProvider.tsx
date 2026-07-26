import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { LoginCommand } from "@dragon-telecom/contract";
import { useSession } from "@/hooks/useSession";
import { useLogin } from "@/hooks/useLogin";
import { useLogout } from "@/hooks/useLogout";
import { connectRoleSocket, disconnectRoleSocket } from "@/lib/realtime";

interface AuthCtx {
  isAuthenticated: boolean;
  // True once the session query has settled (success or error) at least once — lets
  // ProtectedRoute/PublicOnlyRoute hold rendering during the cold-start restore instead of
  // flashing to /login before the silent refresh (axios's 401 interceptor) has a chance to
  // resolve (plan.md §2.1).
  isReady: boolean;
  displayName: string | null;
  login: (command: LoginCommand) => Promise<void>;
  isLoggingIn: boolean;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const sessionQuery = useSession();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const session = sessionQuery.data ?? null;
  const isAuthenticated = !!session;
  const type = session?.type;

  // Role socket lifecycle: connects once a session with a type is present, disconnects on
  // logout (queryClient.clear() drops the cached session, so `type` goes undefined on the
  // next render) or unmount. Keyed on the type value, not the session object, so an unrelated
  // session refetch with the same type never reconnects the socket.
  // Realtime is opt-in: connectRoleSocket() is a no-op unless VITE_WS_ENABLED === "true"
  // (see src/lib/realtime.ts), so this effect stays dormant when realtime is off.
  useEffect(() => {
    if (!isAuthenticated || !type) {
      disconnectRoleSocket();
      return;
    }
    connectRoleSocket(type);
    return () => disconnectRoleSocket();
  }, [isAuthenticated, type]);

  const displayName = session?.profile ? `${session.profile.firstName} ${session.profile.lastName}` : null;

  return (
    <Ctx.Provider
      value={{
        isAuthenticated,
        isReady: !sessionQuery.isPending,
        displayName,
        login: async (command) => {
          await loginMutation.mutateAsync(command);
        },
        isLoggingIn: loginMutation.isPending,
        // Awaitable so callers can navigate only *after* useLogout's onSettled has run
        // queryClient.clear() — otherwise PublicOnlyRoute still sees the cached session at
        // /login and bounces straight back to /admin (G4). The catch is deliberate:
        // authService.logout() clears the local tokens in its own `finally` even when the API
        // call throws, so a failed round-trip is still a completed logout and must still resolve.
        logout: async () => {
          try {
            await logoutMutation.mutateAsync();
          } catch {
            /* tokens already cleared by the service's finally; the cache by onSettled */
          }
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
