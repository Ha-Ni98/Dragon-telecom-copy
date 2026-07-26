import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { AdminLogsTable } from "@/pages/admin/logs/components/admin-logs-table";
import {
  AdminLogsFilters,
  type LogsFilterValues,
} from "@/pages/admin/logs/components/admin-logs-filters";
import { AdminLogsStatsCards } from "@/pages/admin/logs/components/admin-logs-stats-cards";
import { useLogs, useLogStats } from "@/hooks/useObservability";
import { useUsers } from "@/hooks/useIdentity";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-18 — Sprint 8 wiring: `useLogs`/`useLogStats` (useObservability.ts), user-filter sourced
// from `useUsers` (identity), not the stub `usePlatformUsers`. Strictly read-only — no mutation
// UI. `LogsFilterValues` names its date fields `dateFrom`/`dateTo` (UI convention) while the
// real `LogsQuery` names them `from`/`to` — mapped explicitly below rather than renamed, since
// the filter component's names read better next to a date-range picker.
export default function AdminLogs() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<LogsFilterValues>({ search: "", page: 1, limit: 20 });

  const logsQuery = useMemo(
    () => ({
      search: filters.search || undefined,
      userId: filters.userId,
      actionType: filters.actionType,
      from: filters.dateFrom,
      to: filters.dateTo,
      page: filters.page,
      limit: filters.limit,
    }),
    [filters],
  );
  const logs = useLogs(logsQuery);
  const logStats = useLogStats();
  const users = useUsers({ page: 1, limit: 100 });

  const handleFiltersChange = useCallback((next: LogsFilterValues) => {
    setFilters(next);
  }, []);
  const handlePageChange = useCallback((page: number) => {
    setFilters((current) => ({ ...current, page }));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.logs.title")} subtitle={t("admin.logs.description")} />

      <AdminLogsStatsCards
        stats={logStats.data}
        loading={logStats.isLoading}
        error={logStats.isError ? t("admin.logs.stats.description") : null}
        onRefresh={() => logStats.refetch()}
      />

      <AdminLogsFilters
        onFiltersChange={handleFiltersChange}
        users={users.data?.items}
        loading={logs.isLoading}
      />

      <AdminLogsTable
        data={logs.data}
        loading={logs.isLoading}
        error={logs.isError ? t("admin.logs.description") : null}
        onRetry={() => logs.refetch()}
        onRefresh={() => logs.refetch()}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
