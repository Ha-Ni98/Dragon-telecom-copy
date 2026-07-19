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
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdminStatisticsOverviewCardsProps, AdminStatisticsOverview } from '@/types/draft-types/admin-statistics.types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Statistics card configuration
 */
const statsConfig = [
  {
    key: 'totalRevenue' as keyof AdminStatisticsOverview,
    icon: DollarSign,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-800',
    labelKey: 'admin.statistics.overview.totalRevenue',
    description: 'Total revenue from all sales',
    isCurrency: true,
  },
  {
    key: 'totalProfit' as keyof AdminStatisticsOverview,
    icon: TrendingUp,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    labelKey: 'admin.statistics.overview.totalProfit',
    description: 'Total profit after costs',
    isCurrency: true,
  },
  {
    key: 'totalProductValue' as keyof AdminStatisticsOverview,
    icon: Package,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-200 dark:border-blue-800',
    labelKey: 'admin.statistics.overview.totalProductValue',
    description: 'Total value of products in stock',
    isCurrency: true,
  },
  {
    key: 'totalClientCredit' as keyof AdminStatisticsOverview,
    icon: Users,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    borderColor: 'border-orange-200 dark:border-orange-800',
    labelKey: 'admin.statistics.overview.totalClientCredit',
    description: 'Total credit owed by clients',
    isCurrency: true,
  },
  {
    key: 'totalSupplierCredit' as keyof AdminStatisticsOverview,
    icon: Truck,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-800',
    labelKey: 'admin.statistics.overview.totalSupplierCredit',
    description: 'Total credit owed to suppliers',
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
 * Individual statistics card component
 */
interface StatCardProps {
  config: typeof statsConfig[0];
  value: number;
  t: (key: string) => string;
  isCurrency: boolean;
}

function StatCard({ config, value, t, isCurrency }: StatCardProps) {
  const Icon = config.icon;
  const formattedValue = isCurrency ? formatCurrency(value) : formatLargeNumber(value);

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2 hover:shadow-md transition-shadow duration-200`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {t(config.labelKey)}
              </div>
            </div>
            <div className={`text-2xl font-bold ${config.color}`}>
              {formattedValue}
            </div>
            <div className="text-xs text-muted-foreground">
              {config.description}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for statistics cards
 */
function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Error state for statistics cards
 */
interface StatsCardsErrorProps {
  error: string;
  onRetry?: () => void;
  t: (key: string) => string;
}

function StatsCardsError({ error, onRetry, t }: StatsCardsErrorProps) {
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
            Key metrics and financial overview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StatsCardsSkeleton />
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
            Key metrics and financial overview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StatsCardsError 
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
          <Package className="h-5 w-5" />
          {t('admin.statistics.overview')}
        </CardTitle>
        <CardDescription>
          Key metrics and financial overview
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {statsConfig.map((config) => (
            <StatCard
              key={config.key}
              config={config}
              value={stats[config.key]}
              t={t}
              isCurrency={config.isCurrency}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
