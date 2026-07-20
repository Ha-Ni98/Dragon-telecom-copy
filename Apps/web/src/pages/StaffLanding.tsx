import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { firstPermittedStaffRoute } from "@/lib/staff-pages";
import { useTranslation } from "@/hooks/useTranslation";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// PUB-06's staff landing (D4): resolves to the first permitted page from usePermissions(), or
// a local empty state while none of the staff member's permitted pages have a shipped route yet
// (see lib/staff-pages.ts). Rendered inside AdminLayout (App.tsx nests this route alongside
// /admin/*), so no full-screen loader here — content-scoped only, layout stays mounted.
export default function StaffLanding() {
  const { t } = useTranslation();
  const { data: permissions, isLoading, isError, refetch } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  // Distinct from "no permitted pages" below — a failed fetch shouldn't be mistaken for a
  // legitimately empty permission set.
  if (isError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <NotFoundState
          title={t("staff.landing.errorLoading")}
          body={t("staff.landing.errorLoadingBody")}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              {t("common.actions.tryAgain")}
            </Button>
          }
        />
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
