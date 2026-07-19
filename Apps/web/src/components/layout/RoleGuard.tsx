import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { UserType } from "@dragon-telecom/contract";
import { useSession } from "@/hooks/useSession";

// Full-screen, not PageLoader's content-scoped min-h-[50vh] — no layout has mounted yet at
// this gate (mirrors ProtectedRoute's AuthRestoring).
function SessionResolving() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// EXTENSION POINT (auth, role-based): wrap any route subtree in
//   <RoleGuard allow={[UserType.ADMIN]} />
// to restrict it to those types.
// EXTENSION POINT (auth, page/route-based): access is declared in App.tsx's router config —
// nesting a subtree under ProtectedRoute (any session) or RoleGuard (specific types) IS the
// policy. There is no per-page permission table; the route tree is the source of truth.
//
// Reads useSession() directly rather than useAuth() — AuthCtx doesn't expose `type` (it's
// only used internally by AuthProvider for the socket connection). Same cache entry either
// way (TanStack dedupes by queryKey), so this isn't a second network call.
export function RoleGuard({ allow, fallbackPath = "/" }: { allow: UserType[]; fallbackPath?: string }) {
  const { data: session, isPending } = useSession();

  if (isPending) return <SessionResolving />;
  if (!session) return <Navigate to="/login" replace />;
  // A valid session with the wrong type — send them to a safe home rather than /login
  // (which would just bounce them back here via PublicOnlyRoute anyway).
  if (!allow.includes(session.type)) return <Navigate to={fallbackPath} replace />;

  return <Outlet />;
}
