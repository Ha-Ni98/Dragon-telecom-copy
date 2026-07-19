/**
 * Admin Statistics Overview Cards Component
 * Displays general statistics in responsive cards with proper formatting
 */

import React from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  Users,
  Truck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/shared/StatCard';
import { StatCardSkeleton } from '@/components/shared/StatCardSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { AdminStatisticsOverviewCardsProps, AdminStatisticsOverview } from '@/types/draft-types/admin-statistics.types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Statistics card configuration
 */
const statsConfig = [
  {
    key: 'totalRevenue' as keyof AdminStatisticsOverview,
    icon: DollarSign,
    labelKey: 'admin.statistics.overview.totalRevenue',
    descriptionKey: 'admin.statistics.overview.descriptions.totalRevenue',
    isCurrency: true,
  },
  {
    key: 'totalProfit' as keyof AdminStatisticsOverview,
    icon: TrendingUp,
    labelKey: 'admin.statistics.overview.totalProfit',
    descriptionKey: 'admin.statistics.overview.descriptions.totalProfit',
    isCurrency: true,
  },
  {
    key: 'totalProductValue' as keyof AdminStatisticsOverview,
    icon: Package,
    labelKey: 'admin.statistics.overview.totalProductValue',
    descriptionKey: 'admin.statistics.overview.descriptions.totalProductValue',
    isCurrency: true,
  },
  {
    key: 'totalClientCredit' as keyof AdminStatisticsOverview,
    icon: Users,
    labelKey: 'admin.statistics.overview.totalClientCredit',
    descriptionKey: 'admin.statistics.overview.descriptions.totalClientCredit',
    isCurrency: true,
  },
  {
    key: 'totalSupplierCredit' as keyof AdminStatisticsOverview,
    icon: Truck,
    labelKey: 'admin.statistics.overview.totalSupplierCredit',
    descriptionKey: 'admin.statistics.overview.descriptions.totalSupplierCredit',
    isCurrency: true,
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
 * Admin Statistics Overview Cards Component
 * Displays general statistics in responsive cards with proper formatting
 */
export const AdminStatisticsOverviewCards: React.FC<AdminStatisticsOverviewCardsProps> = ({
  stats,
  loading = false,
  className = '',
}) => {
  const { t } = useTranslation();

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('admin.statistics.overview')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.overview.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {statsConfig.map((config) => (
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
            <Package className="h-5 w-5" />
            {t('admin.statistics.overview')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.overview.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Package className="h-6 w-6" />}
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
          <Package className="h-5 w-5" />
          {t('admin.statistics.overview')}
        </CardTitle>
        <CardDescription>
          {t('admin.statistics.overview.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {statsConfig.map((config) => {
            const Icon = config.icon;
            const value = stats[config.key];
            const formattedValue = config.isCurrency ? formatCurrency(value) : formatLargeNumber(value);
            return (
              <StatCard
                key={config.key}
                icon={<Icon className="h-5 w-5" />}
                label={t(config.labelKey)}
                value={formattedValue}
                trend={<span className="text-xs text-muted-foreground">{t(config.descriptionKey)}</span>}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
