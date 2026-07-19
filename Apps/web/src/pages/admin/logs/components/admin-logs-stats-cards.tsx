/**
 * Admin Logs Statistics Cards Component
 * Displays key metrics and statistics for system logs
 */

import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { StatCard } from '@/components/shared/StatCard';
import { StatCardSkeleton } from '@/components/shared/StatCardSkeleton';
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
  { key: 'totalLogs' as keyof AdminLogsStats, icon: FileText },
  { key: 'logsToday' as keyof AdminLogsStats, icon: Calendar },
  { key: 'logsThisWeek' as keyof AdminLogsStats, icon: TrendingUp },
  { key: 'logsThisMonth' as keyof AdminLogsStats, icon: Activity },
];

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
        {statsConfig.map((config) => (
          <StatCardSkeleton key={config.key} />
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
        {statsConfig.map((config) => {
          const Icon = config.icon;
          const value = stats[config.key];
          return (
            <StatCard
              key={config.key}
              icon={<Icon className="h-5 w-5" />}
              label={t(`admin.logs.stats.${config.key}.title`)}
              value={value.toLocaleString()}
              trend={
                <span className="text-xs text-muted-foreground">
                  {t(`admin.logs.stats.${config.key}.description`)}
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
});
