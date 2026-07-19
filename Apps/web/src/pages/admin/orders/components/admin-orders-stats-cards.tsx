/**
 * Admin Orders Statistics Cards Component
 * Displays order statistics in a responsive grid layout
 */

import React, { memo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { StatCardSkeleton } from '@/components/shared/StatCardSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { AdminOrdersStats } from '@/types/draft-types/order.types';
import { useTranslation } from '@/hooks/useTranslation';

interface AdminOrdersStatsCardsProps {
  /** Statistics data */
  stats?: AdminOrdersStats;
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
 * Statistics card data configuration
 */
const statsCards = [
  { key: 'totalOrdersThisMonth' as keyof AdminOrdersStats, icon: ShoppingCart },
  { key: 'pendingOrders' as keyof AdminOrdersStats, icon: Clock },
  { key: 'confirmedOrders' as keyof AdminOrdersStats, icon: CheckCircle },
  { key: 'deliveryOrders' as keyof AdminOrdersStats, icon: Truck },
];

/**
 * Error state for statistics cards
 */
function StatsCardsError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert className="border-red-200 bg-red-50">
      <AlertTriangle className="h-4 w-4 text-red-500" />
      <AlertDescription className="text-red-700">
        {error}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-2 text-red-600 border-red-300 hover:bg-red-100"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('common.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Main AdminOrdersStatsCards component
 */
export const AdminOrdersStatsCards = memo(function AdminOrdersStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  className = ''
}: AdminOrdersStatsCardsProps) {
  const { t } = useTranslation();

  const header = showRefresh && onRefresh && (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold">{t('admin.orders.stats.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.orders.stats.description')}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
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
        {header}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((card) => (
            <StatCardSkeleton key={card.key} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        {header}
        <StatsCardsError error={error} onRetry={onRetry} />
      </div>
    );
  }

  // No data state
  if (!stats) {
    return (
      <div className={className}>
        {header}
        <EmptyState
          icon={<ShoppingCart className="h-6 w-6" />}
          title={t('common.noDataAvailable')}
          body={t('admin.orders.stats.description')}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {header}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          const value = stats[card.key];
          const translationKey = `admin.orders.stats.${card.key}`;

          return (
            <StatCard
              key={card.key}
              icon={<Icon className="h-5 w-5" />}
              label={t(translationKey)}
              value={value.toLocaleString()}
              trend={
                <span className="text-xs text-muted-foreground">
                  {value === 1 ? t('admin.orders.stats.unitSingular') : t('admin.orders.stats.unitPlural')}
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
});
