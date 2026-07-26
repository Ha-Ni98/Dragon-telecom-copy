/**
 * Dashboard Statistics Section Component
 * Thin presentational adapter between AdminDashboard's single useAdminDashboard() query
 * (Sprint 6, plan.md D10) and DashboardStatsCards.
 */

import { DashboardStatsCards } from "./dashboard-stats-cards";
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// set-02 Sprint 3: no longer calls useDashboardStats() (the stub hook) itself — D10 requires
// ONE aggregate query owned by the page, decomposed into per-section props, not N independent
// per-widget fetches. `stats`/`isLoading`/`isError` now come from the parent.
interface DashboardStatsSectionProps {
  stats?: AdminDashboardDto["stats"];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
}

export function DashboardStatsSection({
  stats,
  isLoading = false,
  isError = false,
  onRetry,
  onRefresh,
  showRefresh = false,
}: DashboardStatsSectionProps) {
  const { t } = useTranslation();

  return (
    <DashboardStatsCards
      stats={stats}
      loading={isLoading}
      error={isError ? t("admin.dashboard.error") : null}
      onRetry={onRetry}
      onRefresh={onRefresh}
      showRefresh={showRefresh}
    />
  );
}
