/**
 * Admin Products Statistics Cards Component
 * Displays product statistics in responsive cards with proper loading and error states
 */

import { Package, CheckCircle, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminProductsStats } from "@/types/draft-types/admin.types";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminProductsStatsCardsProps {
  /** Product statistics data */
  stats?: AdminProductsStats;
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
}

/**
 * Statistics card configuration for products
 */
const statsConfig = [
  { key: 'totalProducts' as keyof AdminProductsStats, icon: Package, translationKey: 'admin.products.totalProducts' },
  { key: 'inStock' as keyof AdminProductsStats, icon: CheckCircle, translationKey: 'admin.products.inStock' },
  { key: 'lowStock' as keyof AdminProductsStats, icon: AlertTriangle, translationKey: 'admin.products.lowStock' },
  { key: 'outOfStock' as keyof AdminProductsStats, icon: XCircle, translationKey: 'admin.products.outOfStock' },
];

/**
 * Format number with appropriate separators
 */
function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toString();
}

/**
 * Error state component
 */
function StatsErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="col-span-full">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('common.retry')}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * Main Admin Products Statistics Cards Component
 */
export function AdminProductsStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = false,
}: AdminProductsStatsCardsProps) {
  const { t } = useTranslation();

  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsConfig.map((config) => (
          <StatCardSkeleton key={config.key} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return <StatsErrorState error={error} onRetry={onRetry} />;
  }

  // No data state
  if (!stats) {
    return (
      <div className="col-span-full">
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title={t('common.noDataAvailable')}
          body={t('admin.products.statsError')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      {showRefresh && onRefresh && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('admin.products.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('admin.products.description')}
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
      )}

      {/* Statistics cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsConfig.map((config) => {
          const IconComponent = config.icon;
          const value = stats[config.key] as number;
          return (
            <StatCard
              key={config.key}
              icon={<IconComponent className="h-5 w-5" />}
              label={t(config.translationKey)}
              value={formatNumber(value)}
              trend={
                <span className="text-xs text-muted-foreground">
                  {value === 1 ? t('common.item') : t('common.items')}
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
