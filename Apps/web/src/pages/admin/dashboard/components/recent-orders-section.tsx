/**
 * Recent Orders Section Component
 * Thin presentational adapter between AdminDashboard's single useAdminDashboard() query
 * (Sprint 6, plan.md D10) and RecentOrdersTable.
 */

import { RecentOrdersTable } from "./recent-orders-table";
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// set-02 Sprint 3: no longer calls useRecentOrders() (the stub hook) itself — see
// dashboard-stats-section.tsx's identical note (D10: one aggregate query, not N).
interface RecentOrdersSectionProps {
  orders?: AdminDashboardDto["recentOrders"];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  limit?: number;
}

export function RecentOrdersSection({
  orders,
  isLoading = false,
  isError = false,
  onRetry,
  onRefresh,
  showRefresh = false,
  limit = 8,
}: RecentOrdersSectionProps) {
  const { t } = useTranslation();

  return (
    <RecentOrdersTable
      orders={orders}
      loading={isLoading}
      error={isError ? t("admin.dashboard.error") : null}
      onRetry={onRetry}
      onRefresh={onRefresh}
      showRefresh={showRefresh}
      limit={limit}
    />
  );
}
