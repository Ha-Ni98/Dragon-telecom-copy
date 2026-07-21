import { PageHeader } from "@/components/shared/PageHeader";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-06 — route + shell only (Sprint 2, Foundation). The four tabs (stock/movements/
// reservations/adjustments), their skeletons, and real data wire onto `useInventory` in
// Sprints 4/5 — this placeholder only proves the route mounts inside AdminLayout and the
// Suspense/lazy chunk resolves without a blank page (front-end-rules §4 layout-preservation
// checked here at the route level, not yet at the per-tab level).
export default function AdminInventory() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.inventory.title")} subtitle={t("admin.inventory.description")} />
      <TableSkeleton />
    </div>
  );
}
