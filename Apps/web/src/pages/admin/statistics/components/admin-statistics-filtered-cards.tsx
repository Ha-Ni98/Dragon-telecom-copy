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
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/shared/StatCard';
import { StatCardSkeleton } from '@/components/shared/StatCardSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
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
    labelKey: 'admin.statistics.filtered.revenue',
    descriptionKey: 'admin.statistics.filtered.descriptions.totalRevenue',
    isCurrency: true,
    comparisonKey: 'revenueChange' as keyof AdminStatisticsFiltered['previousPeriodComparison'],
  },
  {
    key: 'totalProfit' as 'totalRevenue' | 'totalProfit' | 'totalOrders',
    icon: TrendingUp,
    labelKey: 'admin.statistics.filtered.profit',
    descriptionKey: 'admin.statistics.filtered.descriptions.totalProfit',
    isCurrency: true,
    comparisonKey: 'profitChange' as keyof AdminStatisticsFiltered['previousPeriodComparison'],
  },
  {
    key: 'totalOrders' as 'totalRevenue' | 'totalProfit' | 'totalOrders',
    icon: ShoppingCart,
    labelKey: 'admin.statistics.filtered.orders',
    descriptionKey: 'admin.statistics.filtered.descriptions.totalOrders',
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
    return { icon: Minus, bgColor: 'bg-gray-50 dark:bg-gray-950', textColor: 'text-gray-600' };
  }

  if (isPositive) {
    return { icon: TrendingUpIcon, bgColor: 'bg-green-50 dark:bg-green-950', textColor: 'text-green-600' };
  }

  return { icon: TrendingDown, bgColor: 'bg-red-50 dark:bg-red-950', textColor: 'text-red-600' };
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
            {t('admin.statistics.filtered.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredStatsConfig.map((config) => (
              <StatCardSkeleton key={config.key} />
            ))}
          </div>
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
            {t('admin.statistics.filtered.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title={t('common.errorLoadingData')}
            body={t('admin.statistics.error')}
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
          {t('admin.statistics.filtered.subtitleWithComparison')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredStatsConfig.map((config) => {
            const Icon = config.icon;
            const value = stats[config.key];
            const comparison = stats.previousPeriodComparison[config.comparisonKey];
            const formattedValue = config.isCurrency ? formatCurrency(value) : formatLargeNumber(value);
            const comparisonIndicator = getComparisonIndicator(comparison);
            const ComparisonIcon = comparisonIndicator.icon;
            const comparisonText = comparison === 0
              ? t('admin.statistics.comparison.noChange')
              : `${comparison > 0 ? '+' : ''}${comparison.toFixed(1)}% ${t('admin.statistics.comparison.vsPrevious')}`;

            return (
              <StatCard
                key={config.key}
                icon={<Icon className="h-5 w-5" />}
                label={t(config.labelKey)}
                value={formattedValue}
                trend={
                  <div className="space-y-1">
                    <Badge
                      variant="outline"
                      className={`${comparisonIndicator.bgColor} ${comparisonIndicator.textColor} border-0`}
                    >
                      <ComparisonIcon className="h-3 w-3 mr-1" />
                      {comparison > 0 ? '+' : ''}{comparison.toFixed(1)}%
                    </Badge>
                    <p className="text-xs text-muted-foreground">{t(config.descriptionKey)}</p>
                    <p className={`text-xs ${comparisonIndicator.textColor} flex items-center gap-1`}>
                      <ComparisonIcon className="h-3 w-3" />
                      {comparisonText}
                    </p>
                  </div>
                }
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
