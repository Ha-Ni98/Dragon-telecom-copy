/**
 * Low Stock Alert Section Component
 * Thin presentational adapter between AdminDashboard's single useAdminDashboard() query
 * (Sprint 6, plan.md D10) and LowStockAlert.
 */

import { LowStockAlert } from "./low-stock-alert";
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// set-02 Sprint 3: no longer calls useLowStockProducts() (the stub hook) itself — see
// dashboard-stats-section.tsx's identical note (D10: one aggregate query, not N).
interface LowStockAlertSectionProps {
  products?: AdminDashboardDto["lowStockProducts"];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  limit?: number;
}

export function LowStockAlertSection({
  products,
  isLoading = false,
  isError = false,
  onRetry,
  onRefresh,
  showRefresh = false,
  limit = 5,
}: LowStockAlertSectionProps) {
  const { t } = useTranslation();

  return (
    <LowStockAlert
      products={products}
      loading={isLoading}
      error={isError ? t("admin.dashboard.error") : null}
      onRetry={onRetry}
      onRefresh={onRefresh}
      showRefresh={showRefresh}
      limit={limit}
    />
  );
}
