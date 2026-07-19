/**
 * Clients Chart Component
 * Displays client registrations over time with growth rate visualization
 */

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Users, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import { ClientsChartData, DateRange } from '@/types/draft-types/admin-statistics.types';
import { useTranslation } from '@/hooks/useTranslation';
import { format, parseISO } from 'date-fns';

/**
 * Props for the Clients Chart component
 */
export interface ClientsChartProps {
  data: ClientsChartData[];
  dateRange: DateRange;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Custom tooltip component for clients chart
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  t: (key: string) => string;
}

function CustomTooltip({ active, payload, label, t }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    
    // Safely parse the date with error handling
    let formattedDate = label || '';
    try {
      if (label) {
        // Handle YYYY-MM format for clients chart
        let date: Date;
        if (label.includes('-') && label.length === 7) {
          // YYYY-MM format - add day to make it a valid date
          date = parseISO(label + '-01');
        } else if (label.includes('-')) {
          // ISO date format (YYYY-MM-DD)
          date = parseISO(label);
        } else {
          // Try parsing as regular date string
          date = new Date(label);
        }
        
        // Check if date is valid
        if (!isNaN(date.getTime())) {
          formattedDate = format(date, 'MMMM yyyy');
        }
      }
    } catch (error) {
      console.warn('Error parsing date in clients chart tooltip:', error);
      formattedDate = label || 'Invalid Date';
    }
    
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <div className="text-sm font-medium text-foreground mb-2">
          {formattedDate}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-muted-foreground">
                {t('admin.statistics.charts.clients.newClients')}:
              </span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {data.newClients.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-muted-foreground">
                {t('admin.statistics.charts.clients.totalClients')}:
              </span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {data.totalClients.toLocaleString()}
            </span>
          </div>
          <div className="border-t border-border pt-1 mt-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-sm text-muted-foreground">
                  {t('admin.statistics.charts.clients.growthRate')}:
                </span>
              </div>
              <span className="text-sm font-medium text-green-600">
                +{data.growthRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Format X-axis labels for month display
 */
function formatXAxisLabel(monthString: string): string {
  const month = parseISO(monthString + '-01');
  return format(month, 'MMM yyyy');
}

/**
 * Format Y-axis labels for large numbers
 */
function formatYAxisLabel(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Loading skeleton for clients chart
 */
function ClientsChartSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Error state for clients chart
 */
interface ClientsChartErrorProps {
  error: string;
  onRetry?: () => void;
  t: (key: string) => string;
}

function ClientsChartError({ error, onRetry, t }: ClientsChartErrorProps) {
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
 * Clients Chart Component
 * Displays client registrations over time with growth rate visualization
 */
export const ClientsChart: React.FC<ClientsChartProps> = ({
  data,
  dateRange,
  loading = false,
  error,
  onRetry,
  className = '',
}) => {
  const { t } = useTranslation();

  // Process data for chart display
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      formattedMonth: formatXAxisLabel(item.month),
    }));
  }, [data]);

  // Calculate chart statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const newClients = chartData.map(d => d.newClients);
    const totalClients = chartData.map(d => d.totalClients);
    const growthRates = chartData.map(d => d.growthRate);
    
    const totalNewClients = newClients.reduce((sum, clients) => sum + clients, 0);
    const currentTotalClients = totalClients[totalClients.length - 1] || 0;
    const averageGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const maxGrowthRate = Math.max(...growthRates);
    const minGrowthRate = Math.min(...growthRates);
    
    return {
      totalNewClients,
      currentTotalClients,
      averageGrowthRate,
      maxGrowthRate,
      minGrowthRate,
      dataPoints: chartData.length,
    };
  }, [chartData]);

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('admin.statistics.charts.clients.title')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.charts.clients.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsChartSkeleton />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('admin.statistics.charts.clients.title')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.charts.clients.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsChartError 
            error={error}
            onRetry={onRetry}
            t={t}
          />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!chartData || chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('admin.statistics.charts.clients.title')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.charts.clients.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('admin.statistics.charts.noData')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('admin.statistics.charts.clients.title')}
            </CardTitle>
            <CardDescription>
              {t('admin.statistics.charts.clients.description')}
            </CardDescription>
          </div>
          {stats && (
            <div className="text-right text-sm text-muted-foreground">
              <div>{t('admin.statistics.charts.clients.totalNew')}: {stats.totalNewClients.toLocaleString()}</div>
              <div>{t('admin.statistics.charts.clients.currentTotal')}: {stats.currentTotalClients.toLocaleString()}</div>
              <div>{t('admin.statistics.charts.clients.avgGrowth')}: +{stats.averageGrowthRate.toFixed(1)}%</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 20,
              }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                className="opacity-30"
                stroke="hsl(var(--muted-foreground))"
              />
              <XAxis
                dataKey="formattedMonth"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={formatYAxisLabel}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                className="text-muted-foreground"
              />
              <Tooltip
                content={<CustomTooltip t={t} />}
                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="newClients"
                stackId="1"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
                name={t('admin.statistics.charts.clients.newClients')}
              />
              <Area
                type="monotone"
                dataKey="totalClients"
                stackId="2"
                stroke="hsl(var(--success))"
                fill="hsl(var(--success))"
                fillOpacity={0.2}
                name={t('admin.statistics.charts.clients.totalClients')}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
