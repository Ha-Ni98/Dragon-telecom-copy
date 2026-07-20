import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { UserType } from "@dragon-telecom/contract";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSession } from "@/hooks/useSession";

// Router-level auth gates, declarative (<Navigate>). ProtectedRoute is the authenticated-or-
// not baseline; RoleGuard (RoleGuard.tsx) is the role-based variant.

// Full-screen, not PageLoader's content-scoped min-h-[50vh] — no layout has mounted yet at
// this gate. Distinct from PageLoader's Suspense-only role (that component's own comment
// scopes it to route code-splitting, not data loading).
function AuthRestoring() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated, isReady } = useAuth();
  const location = useLocation();
  if (!isReady) return <AuthRestoring />;
  // Carries the attempted path via router state so PublicOnlyRoute can send the client back
  // here once they've signed in (PUB-06: "client → back-target or /").
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

// Reads useSession() directly rather than useAuth() — AuthCtx doesn't expose `type` (same
// reasoning as RoleGuard's identical comment); this is the one other place that needs it,
// to send an already-authenticated user away from /login or /register to their home.
export function PublicOnlyRoute() {
  const { isReady } = useAuth();
  const { data: session } = useSession();
  const location = useLocation();
  if (!isReady) return <AuthRestoring />;
  if (session) {
    if (session.type === UserType.ADMIN) return <Navigate to="/admin" replace />;
    if (session.type === UserType.STAFF) return <Navigate to="/staff" replace />;
    // CLIENT: /register has its own target (PUB-07: "authenticated clients redirected to
    // /my-account"), distinct from /login's back-target-or-home (PUB-06). Both routes share
    // this one guard, so the branch is keyed on which of the two the client landed on.
    if (location.pathname === "/register") return <Navigate to="/my-account" replace />;
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? "/"} replace />;
  }
  return <Outlet />;
}
