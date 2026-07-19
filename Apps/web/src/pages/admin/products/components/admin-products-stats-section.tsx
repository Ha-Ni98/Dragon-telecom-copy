/**
 * Admin Products Statistics Section Component
 * Wraps the statistics cards with data fetching logic
 */

import { AdminProductsStatsCards } from './admin-products-stats-cards';
import { useAdminProductsStats } from '@/hooks/use-admin-products';
import { useTranslation } from '@/hooks/useTranslation';

interface AdminProductsStatsSectionProps {
  /** Whether to show refresh button */
  showRefresh?: boolean;
  /** Custom error message */
  customError?: string | null;
}

/**
 * Admin Products Statistics Section Component
 * Wraps the statistics cards with data fetching logic
 */
export function AdminProductsStatsSection({
  showRefresh = true,
  customError = null,
}: AdminProductsStatsSectionProps) {
  const { t } = useTranslation();
  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useAdminProductsStats();

  // Handle retry functionality
  const handleRetry = () => {
    refetch();
  };

  // Handle refresh functionality
  const handleRefresh = () => {
    refetch();
  };

  // Determine error message
  const errorMessage = customError || (error ? t('admin.products.statsError') : null);

  return (
    <AdminProductsStatsCards
      stats={stats}
      loading={isLoading}
      error={errorMessage}
      onRetry={handleRetry}
      onRefresh={handleRefresh}
      showRefresh={showRefresh}
    />
  );
}
