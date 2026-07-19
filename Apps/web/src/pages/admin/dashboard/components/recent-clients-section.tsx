/**
 * Recent Clients Section Component
 * Integrates the recent clients table with the recent clients hook
 */

import { RecentClientsTable } from "./recent-clients-table";
import { useRecentClients } from "@/hooks/use-recent-clients";
import { useTranslation } from "@/hooks/useTranslation";

interface RecentClientsSectionProps {
  /** Whether to show the refresh button */
  showRefresh?: boolean;
  /** Custom error message */
  customError?: string | null;
  /** Maximum number of clients to display */
  limit?: number;
}

/**
 * Recent Clients Section Component
 * Wraps the recent clients table with data fetching logic
 */
export function RecentClientsSection({
  showRefresh = false,
  customError = null,
  limit = 5,
}: RecentClientsSectionProps) {
  const { t } = useTranslation();
  const {
    data: clients,
    isLoading,
    error,
    refetch,
  } = useRecentClients(limit);

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
    <RecentClientsTable
      clients={clients}
      loading={isLoading}
      error={errorMessage}
      onRetry={handleRetry}
      onRefresh={handleRefresh}
      showRefresh={showRefresh}
      limit={limit}
    />
  );
}
