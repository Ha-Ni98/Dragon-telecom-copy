/**
 * Admin Logs Statistics Cards Component
 * Displays key metrics and statistics for system logs
 */

import React, { memo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  RefreshCw, 
  AlertTriangle, 
  Calendar,
  TrendingUp,
  Activity
} from 'lucide-react';
import { AdminLogsStats } from '@/types/draft-types/logs.types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for AdminLogsStatsCards component
 */
interface AdminLogsStatsCardsProps {
  /** Statistics data */
  stats?: AdminLogsStats;
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
 * Statistics card configuration
 */
const statsConfig = [
  {
    key: 'totalLogs',
    title: 'Total Logs',
    description: 'All system logs',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    key: 'logsToday',
    title: 'Today',
    description: 'Logs created today',
    icon: Calendar,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    key: 'logsThisWeek',
    title: 'This Week',
    description: 'Logs created this week',
    icon: TrendingUp,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    key: 'logsThisMonth',
    title: 'This Month',
    description: 'Logs created this month',
    icon: Activity,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
];

/**
 * Loading skeleton for statistics cards
 */
function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
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
  stats: AdminLogsStats; 
  t: (key: string) => string;
}) {
  const Icon = config.icon;
  const value = stats[config.key as keyof AdminLogsStats];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {t(`admin.logs.stats.${config.key}.title`)}
        </CardTitle>
        <div className={`p-2 rounded-full ${config.bgColor}`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">
          {t(`admin.logs.stats.${config.key}.description`)}
        </p>
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>{t('admin.logs.stats.title')}</span>
            </CardTitle>
            <CardDescription>{t('admin.logs.stats.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="ml-2"
              >
                {t('common.retry')}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

/**
 * Main Admin Logs Statistics Cards Component
 */
export const AdminLogsStatsCards = memo(function AdminLogsStatsCards({
  stats,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  className = '',
}: AdminLogsStatsCardsProps) {
  const { t } = useTranslation();

  // Loading state
  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {statsConfig.map((_, index) => (
          <StatCardSkeleton key={index} />
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
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>{t('admin.logs.stats.title')}</span>
              </CardTitle>
              <CardDescription>{t('admin.logs.stats.description')}</CardDescription>
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
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t('admin.logs.stats.noData')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('admin.logs.stats.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.logs.stats.description')}</p>
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

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
});
