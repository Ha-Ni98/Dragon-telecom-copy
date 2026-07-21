import { PageHeader } from "@/components/shared/PageHeader";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-19 — route + shell only (Sprint 2, Foundation), mounted at `/admin/activity/staff-searches`
// (linked from ADM-06 and ADM-18). Wires onto `useStaffSearches` (useObservability.ts) in Sprint 5.
export default function AdminStaffSearches() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.staffSearches.title")}
        subtitle={t("admin.staffSearches.description")}
      />
      <TableSkeleton />
    </div>
  );
}
