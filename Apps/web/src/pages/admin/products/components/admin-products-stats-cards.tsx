/**
 * Admin Products Statistics Cards Component
 * Displays product statistics in responsive cards with proper loading and error states
 */

import { Package, CheckCircle, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  {
    key: 'totalProducts' as keyof AdminProductsStats,
    icon: Package,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    translationKey: 'admin.products.totalProducts',
  },
  {
    key: 'inStock' as keyof AdminProductsStats,
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    translationKey: 'admin.products.inStock',
  },
  {
    key: 'lowStock' as keyof AdminProductsStats,
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    translationKey: 'admin.products.lowStock',
  },
  {
    key: 'outOfStock' as keyof AdminProductsStats,
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    translationKey: 'admin.products.outOfStock',
  },
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
 * Loading skeleton for statistics cards
 */
function StatsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
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
 * Individual statistics card component
 */
function StatCard({ 
  config, 
  stats, 
  t 
}: { 
  config: typeof statsConfig[0]; 
  stats: AdminProductsStats; 
  t: (key: string) => string;
}) {
  const IconComponent = config.icon;
  const value = stats[config.key] as number;
  const formattedValue = formatNumber(value);
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t(config.translationKey)}
        </CardTitle>
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <IconComponent className={`h-4 w-4 ${config.color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <span>
            {value === 1 ? t('common.item') : t('common.items')}
          </span>
        </div>
      </CardContent>
    </Card>
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
        {Array.from({ length: 4 }).map((_, index) => (
          <StatsCardSkeleton key={index} />
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
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('admin.products.statsError')}
          </AlertDescription>
        </Alert>
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
        {statsConfig.map((config) => (
          <StatCard
            key={config.key}
            config={config}
            stats={stats}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
