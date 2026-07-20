import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { firstPermittedStaffRoute } from "@/lib/staff-pages";
import { useTranslation } from "@/hooks/useTranslation";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Skeleton } from "@/components/ui/skeleton";

// PUB-06's staff landing (D4): resolves to the first permitted page from usePermissions(), or
// a local empty state while none of the staff member's permitted pages have a shipped route yet
// (see lib/staff-pages.ts). Rendered inside AdminLayout (App.tsx nests this route alongside
// /admin/*), so no full-screen loader here — content-scoped only, layout stays mounted.
export default function StaffLanding() {
  const { t } = useTranslation();
  const { data: permissions, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  const target = firstPermittedStaffRoute(permissions ?? []);
  if (target) return <Navigate to={target} replace />;

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <NotFoundState
        title={t("staff.landing.noPermittedPages")}
        body={t("staff.landing.noPermittedPagesBody")}
      />
    </div>
  );
}
