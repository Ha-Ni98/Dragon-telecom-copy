/**
 * Admin Clients Statistics Cards Component
 * Displays key client statistics in a responsive card layout
 */

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, UserPlus, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { AdminClientsStats } from '@/types/draft-types/client.types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for AdminClientsStatsCards component
 */
interface AdminClientsStatsCardsProps {
  /** Statistics data */
  stats?: AdminClientsStats;
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-2xl font-bold">
              {value}
            </div>
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});


/**
 * Error state component
 */
function StatsCardsError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Format number with proper formatting
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}


/**
 * Main AdminClientsStatsCards component
 */
export const AdminClientsStatsCards = memo(function AdminClientsStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = false,
  className = '',
}: AdminClientsStatsCardsProps) {
  const { t } = useTranslation();

  // Loading state
  if (loading) {
    const loadingIcons = [
      <Users className="h-4 w-4 text-blue-600" />,
      <UserCheck className="h-4 w-4 text-green-600" />,
      <UserPlus className="h-4 w-4 text-purple-600" />,
      <TrendingUp className="h-4 w-4 text-orange-600" />
    ];
    
    const loadingBorders = [
      "border-l-4 border-l-blue-500",
      "border-l-4 border-l-green-500", 
      "border-l-4 border-l-purple-500",
      "border-l-4 border-l-orange-500"
    ];
    
    return (
      <div className={className}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <StatCard
              key={index}
              title="Loading..."
              value=""
              description=""
              icon={loadingIcons[index]}
              loading={true}
              className={loadingBorders[index]}
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <StatsCardsError error={error} onRetry={onRetry} />
      </div>
    );
  }

  // No data state
  if (!stats) {
    return (
      <div className={className}>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('admin.clients.errorLoadingStats')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Header with refresh button */}
        {showRefresh && onRefresh && (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{t('admin.clients.title')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('admin.clients.description')}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t('admin.clients.totalClients')}
            value={formatNumber(stats.totalClients)}
            description={t('admin.clients.totalClients')}
            icon={<Users className="h-4 w-4 text-blue-600" />}
            className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
          />
          
          <StatCard
            title={t('admin.clients.activeClients')}
            value={formatNumber(stats.activeClients)}
            description={t('admin.clients.activeClients')}
            icon={<UserCheck className="h-4 w-4 text-green-600" />}
            className="hover:shadow-md transition-shadow border-l-4 border-l-green-500"
          />
          
          <StatCard
            title={t('admin.clients.newThisMonth')}
            value={formatNumber(stats.newThisMonth)}
            description={t('admin.clients.newThisMonth')}
            icon={<UserPlus className="h-4 w-4 text-purple-600" />}
            className="hover:shadow-md transition-shadow border-l-4 border-l-purple-500"
          />
          
          <StatCard
            title={t('admin.clients.averageOrders')}
            value={stats.averageOrdersPerClient.toFixed(1)}
            description={t('admin.clients.averageOrders')}
            icon={<TrendingUp className="h-4 w-4 text-orange-600" />}
            className="hover:shadow-md transition-shadow border-l-4 border-l-orange-500"
          />
        </div>
      </div>
    </div>
  );
});
