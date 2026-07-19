/**
 * Dashboard Statistics Section Component
 * Integrates the statistics cards with the dashboard stats hook
 */

import { DashboardStatsCards } from "./dashboard-stats-cards";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useTranslation } from "@/hooks/useTranslation";

interface DashboardStatsSectionProps {
  /** Whether to show the refresh button */
  showRefresh?: boolean;
  /** Custom error message */
  customError?: string | null;
}

/**
 * Dashboard Statistics Section Component
 * Wraps the statistics cards with data fetching logic
 */
export function DashboardStatsSection({
  showRefresh = false,
  customError = null,
}: DashboardStatsSectionProps) {
  const { t } = useTranslation();
  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useDashboardStats();

  // Handle retry functionality
  const handleRetry = () => {
    refetch();
  };

  // Handle refresh functionality
  const handleRefresh = () => {
    refetch();
  };

  // Determine error message
  const errorMessage = customError || (error ? t('admin.dashboard.error') : null);

  return (
    <DashboardStatsCards
      stats={stats}
      loading={isLoading}
      error={errorMessage}
      onRetry={handleRetry}
      onRefresh={handleRefresh}
      showRefresh={showRefresh}
    />
  );
}
