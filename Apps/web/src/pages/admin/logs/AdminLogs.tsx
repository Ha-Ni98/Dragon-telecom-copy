import { useCallback, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { AdminLogsTable } from "@/pages/admin/logs/components/admin-logs-table";
import {
  AdminLogsFilters,
  type LogsFilterValues,
} from "@/pages/admin/logs/components/admin-logs-filters";
import { AdminLogsStatsCards } from "@/pages/admin/logs/components/admin-logs-stats-cards";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-18 — retyped onto AuditLogDto/LogStatsDto (Sprint 3, presentational only). Data is a
// local placeholder instead of the incompatible stub hooks `use-admin-logs` (numeric-id view-
// models) — Sprint 8 swaps this for `useLogs`/`useLogStats`, with the user-filter sourced from
// `useUsers` (identity), not the stub `usePlatformUsers`. Strictly read-only — no mutation UI.
export default function AdminLogs() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);

  const handleFiltersChange = useCallback((_filters: LogsFilterValues) => {
    setCurrentPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.logs.title")} subtitle={t("admin.logs.description")} />

      <AdminLogsStatsCards stats={undefined} loading={false} error={null} />

      <AdminLogsFilters onFiltersChange={handleFiltersChange} users={[]} loading={false} />

      <AdminLogsTable data={undefined} loading={false} error={null} onPageChange={setCurrentPage} />
    </div>
  );
}
