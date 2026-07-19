/**
 * Recent Orders Section Component
 * Integrates the recent orders table with the recent orders hook
 */

import { RecentOrdersTable } from "./recent-orders-table";
import { useRecentOrders } from "@/hooks/use-recent-orders";
import { useTranslation } from "@/hooks/useTranslation";

interface RecentOrdersSectionProps {
  /** Whether to show the refresh button */
  showRefresh?: boolean;
  /** Custom error message */
  customError?: string | null;
  /** Maximum number of orders to display */
  limit?: number;
}

/**
 * Recent Orders Section Component
 * Wraps the recent orders table with data fetching logic
 */
export function RecentOrdersSection({
  showRefresh = false,
  customError = null,
  limit = 8,
}: RecentOrdersSectionProps) {
  const { t } = useTranslation();
  const {
    data: orders,
    isLoading,
    error,
    refetch,
  } = useRecentOrders(limit);

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
    <RecentOrdersTable
      orders={orders}
      loading={isLoading}
      error={errorMessage}
      onRetry={handleRetry}
      onRefresh={handleRefresh}
      showRefresh={showRefresh}
      limit={limit}
    />
  );
}
