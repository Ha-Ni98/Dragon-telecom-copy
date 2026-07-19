/**
 * Low Stock Alert Section Component
 * Integrates the low stock alert with the low stock products hook
 */

import { LowStockAlert } from "./low-stock-alert";
import { useLowStockProducts } from "@/hooks/use-low-stock-products";
import { useTranslation } from "@/hooks/useTranslation";

interface LowStockAlertSectionProps {
  /** Whether to show the refresh button */
  showRefresh?: boolean;
  /** Custom error message */
  customError?: string | null;
  /** Maximum number of products to display */
  limit?: number;
}

/**
 * Low Stock Alert Section Component
 * Wraps the low stock alert with data fetching logic
 */
export function LowStockAlertSection({
  showRefresh = false,
  customError = null,
  limit = 5,
}: LowStockAlertSectionProps) {
  const { t } = useTranslation();
  const {
    data: products,
    isLoading,
    error,
    refetch,
  } = useLowStockProducts(limit);

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
    <LowStockAlert
      products={products}
      loading={isLoading}
      error={errorMessage}
      onRetry={handleRetry}
      onRefresh={handleRefresh}
      showRefresh={showRefresh}
      limit={limit}
    />
  );
}
