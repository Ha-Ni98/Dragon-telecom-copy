/**
 * Admin Clients Statistics Cards Component
 * Displays key client statistics in a responsive card layout
 */

import { memo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, UserPlus, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { StatCardSkeleton } from '@/components/shared/StatCardSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { AdminClientsStats } from '@/types/draft-types/client.types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for AdminClientsStatsCards component
 */
interface AdminClientsStatsCardsProps {
  /** Statistics data */
  stats?: AdminClientsStats;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Retry function for error handling */
  onRetry?: () => void;
  /** Refresh function */
  onRefresh?: () => void;
  /** Whether to show refresh button */
  showRefresh?: boolean;
  /** Custom className for styling */
  className?: string;
}

/**
 * Error state component
 */
function StatsCardsError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

/**
 * Format number with proper formatting
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Main AdminClientsStatsCards component
 */
export const AdminClientsStatsCards = memo(function AdminClientsStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = false,
  className = '',
}: AdminClientsStatsCardsProps) {
  const { t } = useTranslation();

  const header = showRefresh && onRefresh && (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">{t('admin.clients.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('admin.clients.description')}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        className="flex items-center space-x-2"
      >
        <RefreshCw className="h-4 w-4" />
        <span>{t('common.refresh')}</span>
      </Button>
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className={className}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <StatsCardsError error={error} onRetry={onRetry} />
      </div>
    );
  }

  // No data state
  if (!stats) {
    return (
      <div className={className}>
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={t('common.noDataAvailable')}
          body={t('admin.clients.errorLoadingStats')}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {header}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label={t('admin.clients.totalClients')}
            value={formatNumber(stats.totalClients)}
          />

          <StatCard
            icon={<UserCheck className="h-5 w-5" />}
            label={t('admin.clients.activeClients')}
            value={formatNumber(stats.activeClients)}
          />

          <StatCard
            icon={<UserPlus className="h-5 w-5" />}
            label={t('admin.clients.newThisMonth')}
            value={formatNumber(stats.newThisMonth)}
          />

          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label={t('admin.clients.averageOrders')}
            value={stats.averageOrdersPerClient.toFixed(1)}
          />
        </div>
      </div>
    </div>
  );
});
