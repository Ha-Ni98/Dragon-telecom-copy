/**
 * Admin Statistics Filtered Cards Component
 * Displays filtered statistics based on date range with comparison indicators
 */

import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart,
  TrendingDown,
  TrendingUp as TrendingUpIcon,
  Minus,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AdminStatisticsFilteredCardsProps, AdminStatisticsFiltered, DateRange } from '@/types/draft-types/admin-statistics.types';
import { useTranslation } from '@/hooks/useTranslation';
import { format } from 'date-fns';

/**
 * Statistics card configuration for filtered data
 */
const filteredStatsConfig = [
  {
    key: 'totalRevenue' as 'totalRevenue' | 'totalProfit' | 'totalOrders',
    icon: DollarSign,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-800',
    labelKey: 'admin.statistics.filtered.revenue',
    description: 'Total revenue for the selected period',
    isCurrency: true,
    comparisonKey: 'revenueChange' as keyof AdminStatisticsFiltered['previousPeriodComparison'],
  },
  {
    key: 'totalProfit' as 'totalRevenue' | 'totalProfit' | 'totalOrders',
    icon: TrendingUp,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    labelKey: 'admin.statistics.filtered.profit',
    description: 'Total profit for the selected period',
    isCurrency: true,
    comparisonKey: 'profitChange' as keyof AdminStatisticsFiltered['previousPeriodComparison'],
  },
  {
    key: 'totalOrders' as 'totalRevenue' | 'totalProfit' | 'totalOrders',
    icon: ShoppingCart,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-200 dark:border-blue-800',
    labelKey: 'admin.statistics.filtered.orders',
    description: 'Total orders for the selected period',
    isCurrency: false,
    comparisonKey: 'ordersChange' as keyof AdminStatisticsFiltered['previousPeriodComparison'],
  },
];

/**
 * Format currency value with proper localization
 */
function formatCurrency(value: number, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format large numbers with appropriate suffixes
 */
function formatLargeNumber(value: number): string {
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(1) + 'B';
  } else if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toString();
}

/**
 * Get comparison indicator for percentage change
 */
function getComparisonIndicator(change: number) {
  const isPositive = change > 0;
  const isNeutral = change === 0;
  
  if (isNeutral) {
    return {
      icon: Minus,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 dark:bg-gray-950',
      textColor: 'text-gray-600',
    };
  }
  
  if (isPositive) {
    return {
      icon: TrendingUpIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
      textColor: 'text-green-600',
    };
  }
  
  return {
    icon: TrendingDown,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    textColor: 'text-red-600',
  };
}

/**
 * Individual filtered statistics card component
 */
interface FilteredStatCardProps {
  config: typeof filteredStatsConfig[0];
  value: number;
  comparison: number;
  t: (key: string) => string;
  isCurrency: boolean;
}

function FilteredStatCard({ config, value, comparison, t, isCurrency }: FilteredStatCardProps) {
  const Icon = config.icon;
  const formattedValue = isCurrency ? formatCurrency(value) : formatLargeNumber(value);
  const comparisonIndicator = getComparisonIndicator(comparison);
  const ComparisonIcon = comparisonIndicator.icon;
  
  const comparisonText = comparison === 0 
    ? t('admin.statistics.comparison.noChange')
    : `${comparison > 0 ? '+' : ''}${comparison.toFixed(1)}% ${t('admin.statistics.comparison.vsPrevious')}`;

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2 hover:shadow-md transition-shadow duration-200`}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header with icon and label */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {t(config.labelKey)}
              </div>
            </div>
            
            {/* Comparison indicator */}
            <Badge 
              variant="outline" 
              className={`${comparisonIndicator.bgColor} ${comparisonIndicator.textColor} border-0`}
            >
              <ComparisonIcon className="h-3 w-3 mr-1" />
              {comparison > 0 ? '+' : ''}{comparison.toFixed(1)}%
            </Badge>
          </div>

          {/* Main value */}
          <div className={`text-3xl font-bold ${config.color}`}>
            {formattedValue}
          </div>

          {/* Description and comparison */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {config.description}
            </div>
            <div className={`text-sm ${comparisonIndicator.textColor} flex items-center gap-1`}>
              <ComparisonIcon className="h-3 w-3" />
              {comparisonText}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for filtered statistics cards
 */
function FilteredStatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-10 w-24" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Error state for filtered statistics cards
 */
interface FilteredStatsCardsErrorProps {
  error: string;
  onRetry?: () => void;
  t: (key: string) => string;
}

function FilteredStatsCardsError({ error, onRetry, t }: FilteredStatsCardsErrorProps) {
  return (
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
            {t('admin.statistics.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Admin Statistics Filtered Cards Component
 * Displays filtered statistics based on date range with comparison indicators
 */
export const AdminStatisticsFilteredCards: React.FC<AdminStatisticsFilteredCardsProps> = ({
  stats,
  dateRange,
  loading = false,
  className = '',
}) => {
  const { t } = useTranslation();

  // Format date range for display
  const formatDateRange = (dateRange: DateRange) => {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    
    if (dateRange.type === 'custom') {
      return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`;
    }
    
    return dateRange.label;
  };

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('admin.statistics.filtered.period')}: {t('admin.statistics.loading')}
          </CardTitle>
          <CardDescription>
            Statistics for the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FilteredStatsCardsSkeleton />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('admin.statistics.filtered.period')}: {formatDateRange(dateRange)}
          </CardTitle>
          <CardDescription>
            Statistics for the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FilteredStatsCardsError 
            error={t('admin.statistics.error')}
            t={t}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t('admin.statistics.filtered.period')}: {formatDateRange(dateRange)}
        </CardTitle>
        <CardDescription>
          Statistics for the selected time period with comparison to previous period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredStatsConfig.map((config) => (
            <FilteredStatCard
              key={config.key}
              config={config}
              value={stats[config.key]}
              comparison={stats.previousPeriodComparison[config.comparisonKey]}
              t={t}
              isCurrency={config.isCurrency}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
