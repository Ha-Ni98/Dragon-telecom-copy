/**
 * Admin Orders Statistics Cards Component
 * Displays order statistics in a responsive grid layout
 */

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  {
    key: 'totalOrdersThisMonth' as keyof AdminOrdersStats,
    icon: ShoppingCart,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  {
    key: 'pendingOrders' as keyof AdminOrdersStats,
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  },
  {
    key: 'confirmedOrders' as keyof AdminOrdersStats,
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  {
    key: 'deliveryOrders' as keyof AdminOrdersStats,
    icon: Truck,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  }
];

/**
 * Loading skeleton for statistics cards
 */
function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="animate-pulse">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Error state for statistics cards
 */
function StatsCardsError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">--</div>
            <p className="text-xs text-red-500">Error loading data</p>
          </CardContent>
        </Card>
      ))}
      <div className="col-span-full">
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
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    </div>
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

  // Loading state
  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{t('admin.orders.stats.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('admin.orders.stats.description')}</p>
          </div>
          {showRefresh && onRefresh && (
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
          )}
        </div>
        <StatsCardsSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{t('admin.orders.stats.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('admin.orders.stats.description')}</p>
          </div>
          {showRefresh && onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>{t('common.refresh')}</span>
            </Button>
          )}
        </div>
        <StatsCardsError error={error} onRetry={onRetry} />
      </div>
    );
  }

  // No data state
  if (!stats) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{t('admin.orders.stats.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('admin.orders.stats.description')}</p>
          </div>
          {showRefresh && onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>{t('common.refresh')}</span>
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border-dashed">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-4 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">--</div>
                <p className="text-xs text-muted-foreground">No data available</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{t('admin.orders.stats.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.orders.stats.description')}</p>
        </div>
        {showRefresh && onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>{t('common.refresh')}</span>
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          const value = stats[card.key];
          const translationKey = `admin.orders.stats.${card.key}`;
          
          return (
            <Card 
              key={card.key}
              className={`${card.borderColor} ${card.bgColor} hover:shadow-md transition-shadow`}
              role="region"
              aria-label={`${t(translationKey)}: ${value}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t(translationKey)}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color}`}>
                  {value.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {value === 1 ? 'order' : 'orders'} this month
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
});
