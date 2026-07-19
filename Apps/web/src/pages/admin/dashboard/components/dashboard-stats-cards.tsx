/**
 * Dashboard Statistics Cards Component
 * Displays key metrics in responsive cards with change indicators
 */

import { Users, Package, ShoppingCart, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DashboardStats } from "@/types/draft-types/dashboard.types";
import { useTranslation } from "@/hooks/useTranslation";

interface DashboardStatsCardsProps {
  /** Dashboard statistics data */
  stats?: DashboardStats;
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
 * Statistics card configuration
 */
const statsConfig = [
  {
    key: 'totalClients' as keyof DashboardStats,
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    changeKey: 'clientChange' as keyof DashboardStats,
  },
  {
    key: 'totalProducts' as keyof DashboardStats,
    icon: Package,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    changeKey: 'productChange' as keyof DashboardStats,
  },
  {
    key: 'ordersThisWeek' as keyof DashboardStats,
    icon: ShoppingCart,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
    changeKey: 'ordersChange' as keyof DashboardStats,
  },
  {
    key: 'revenueThisMonth' as keyof DashboardStats,
    icon: TrendingUp,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    changeKey: 'revenueChange' as keyof DashboardStats,
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
 * Format currency value
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Get change indicator color and icon
 */
function getChangeIndicator(change: number) {
  const isPositive = change >= 0;
  const color = isPositive ? 'text-green-600' : 'text-red-600';
  const bgColor = isPositive ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950';
  const icon = isPositive ? '↗' : '↘';
  
  return { color, bgColor, icon };
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
  stats: DashboardStats; 
  t: (key: string) => string;
}) {
  const IconComponent = config.icon;
  const value = stats[config.key] as number;
  const change = stats[config.changeKey] as number;
  const { color: changeColor, icon: changeIcon } = getChangeIndicator(change);
  
  // Format value based on the statistic type
  const formattedValue = config.key === 'revenueThisMonth' 
    ? formatCurrency(value)
    : formatNumber(value);
  
  // Get translation key for the statistic
  const translationKey = `admin.dashboard.${config.key}`;
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t(translationKey)}
        </CardTitle>
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <IconComponent className={`h-4 w-4 ${config.color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        <div className="flex items-center space-x-1 text-xs">
          <span className={changeColor}>
            {changeIcon} {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-muted-foreground">
            {t('admin.dashboard.fromLastMonth')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main Dashboard Statistics Cards Component
 */
export function DashboardStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
}: DashboardStatsCardsProps) {
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
            {t('admin.dashboard.error')}
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
            <h2 className="text-lg font-semibold">{t('admin.dashboard.overview')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('admin.dashboard.welcome')}
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
