/**
 * Admin Suppliers Statistics Cards Component
 * Displays key supplier statistics in a responsive card layout
 */

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Truck, DollarSign, CreditCard, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { AdminSuppliersStats } from '@/types/draft-types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for AdminSuppliersStatsCards component
 */
interface AdminSuppliersStatsCardsProps {
  /** Statistics data */
  stats?: AdminSuppliersStats;
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
 * Individual statistics card component
 */
interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  loading?: boolean;
  className?: string;
}

const StatCard = memo(function StatCard({
  title,
  value,
  description,
  icon,
  loading = false,
  className = '',
}: StatCardProps) {
  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-1">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-lg font-bold">
              {value}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

/**
 * Loading skeleton for statistics cards
 */
const StatsLoadingSkeleton = memo(function StatsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

/**
 * Error state component
 */
const StatsErrorState = memo(function StatsErrorState({ 
  error, 
  onRetry 
}: { 
  error: string; 
  onRetry?: () => void; 
}) {
  const { t } = useTranslation();

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
            {t('common.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
});

/**
 * Format currency value for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format number with thousand separators
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Main AdminSuppliersStatsCards component
 */
export const AdminSuppliersStatsCards = memo(function AdminSuppliersStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  className = '',
}: AdminSuppliersStatsCardsProps) {
  const { t } = useTranslation();

  // Show loading skeleton
  if (loading) {
    return (
      <div className={className}>
        <StatsLoadingSkeleton />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={className}>
        <StatsErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  // Show statistics cards
  return (
    <div className={className}>
      <div className="space-y-4">
      
        {showRefresh && onRefresh && (
          <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">
              {t('admin.suppliers.stats.title')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('admin.suppliers.stats.description')}
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
      

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('admin.suppliers.stats.totalSuppliers')}
          value={stats ? formatNumber(stats.totalSuppliers) : 0}
          description={t('admin.suppliers.stats.totalSuppliersDescription')}
          icon={<Truck className="h-4 w-4 text-blue-600" />}
          loading={!stats}
        />

        <StatCard
          title={t('admin.suppliers.stats.totalDue')}
          value={stats ? formatCurrency(stats.totalDue) : formatCurrency(0)}
          description={t('admin.suppliers.stats.totalDueDescription')}
          icon={<DollarSign className="h-4 w-4 text-red-600" />}
          loading={!stats}
        />

        <StatCard
          title={t('admin.suppliers.stats.totalPaid')}
          value={stats ? formatCurrency(stats.totalPaid) : formatCurrency(0)}
          description={t('admin.suppliers.stats.totalPaidDescription')}
          icon={<CreditCard className="h-4 w-4 text-green-600" />}
          loading={!stats}
        />

        <StatCard
          title={t('admin.suppliers.stats.totalCredit')}
          value={stats ? formatCurrency(stats.totalCredit) : formatCurrency(0)}
          description={t('admin.suppliers.stats.totalCreditDescription')}
          icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
          loading={!stats}
        />
      </div>
    
      </div>
    </div>
  );
});

export default AdminSuppliersStatsCards;
