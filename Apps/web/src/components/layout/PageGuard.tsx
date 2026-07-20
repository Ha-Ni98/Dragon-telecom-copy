import { Navigate, Outlet } from "react-router-dom";
import { PageKey } from "@dragon-telecom/contract";
import { usePermissions } from "@/hooks/usePermissions";
import { PageLoader } from "@/components/shared/PageLoader";

// EXTENSION POINT (staff pages): wrap a /staff/* route subtree in
//   <PageGuard requires={PageKey.STAFF_PRODUCTS} />
// to additionally restrict it to staff granted that specific page, layered inside the coarser
// RoleGuard allow={[STAFF, ADMIN]} that already wraps all of /staff/*. No separate ADMIN
// bypass needed here — the backend's effectivePages() (identity.mapper.ts) already returns
// every PageKey for an ADMIN session, so `permissions.includes(requires)` is true for admins
// without a special case.
//
// PageLoader (content-scoped), not a full-screen gate, since this always nests inside
// StaffLayout — the header/sidebar are already mounted by the time this resolves.
export function PageGuard({
  requires,
  fallbackPath = "/staff",
}: {
  requires: PageKey;
  fallbackPath?: string;
}) {
  const { data: permissions, isLoading } = usePermissions();

  if (isLoading) return <PageLoader />;
  if (!permissions?.includes(requires)) return <Navigate to={fallbackPath} replace />;

  return <Outlet />;
}
