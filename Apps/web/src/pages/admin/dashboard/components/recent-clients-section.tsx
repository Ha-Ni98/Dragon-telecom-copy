/**
 * Recent Clients Section Component
 * Thin presentational adapter between AdminDashboard's single useAdminDashboard() query
 * (Sprint 6, plan.md D10) and RecentClientsTable.
 */

import { RecentClientsTable } from "./recent-clients-table";
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// set-02 Sprint 3: no longer calls useRecentClients() (the stub hook) itself — see
// dashboard-stats-section.tsx's identical note (D10: one aggregate query, not N).
interface RecentClientsSectionProps {
  clients?: AdminDashboardDto["recentClients"];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  limit?: number;
}

export function RecentClientsSection({
  clients,
  isLoading = false,
  isError = false,
  onRetry,
  onRefresh,
  showRefresh = false,
  limit = 5,
}: RecentClientsSectionProps) {
  const { t } = useTranslation();

  return (
    <RecentClientsTable
      clients={clients}
      loading={isLoading}
      error={isError ? t("admin.dashboard.error") : null}
      onRetry={onRetry}
      onRefresh={onRefresh}
      showRefresh={showRefresh}
      limit={limit}
    />
  );
}
