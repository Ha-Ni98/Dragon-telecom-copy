/**
 * Revenue Chart Component
 * Displays revenue trends over time with family filtering capability
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
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
import { TrendingUp, AlertTriangle, RefreshCw, Filter } from 'lucide-react';
import { RevenueChartData, DateRange } from '@/types/draft-types/admin-statistics.types';
import { useTranslation } from '@/hooks/useTranslation';
import { format, parseISO } from 'date-fns';

/**
 * Props for the Revenue Chart component
 */
export interface RevenueChartProps {
  data: RevenueChartData[];
  dateRange: DateRange;
  family?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Custom tooltip component for revenue chart
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
        // Handle different date formats
        let date: Date;
        if (label.includes('-')) {
          // ISO date format (YYYY-MM-DD)
          date = parseISO(label);
        } else {
          // Try parsing as regular date string
          date = new Date(label);
        }
        
        // Check if date is valid
        if (!isNaN(date.getTime())) {
          formattedDate = format(date, 'MMM dd, yyyy');
        }
      }
    } catch (error) {
      console.warn('Error parsing date in revenue chart tooltip:', error);
      formattedDate = label || 'Invalid Date';
    }
    
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <div className="text-sm font-medium text-foreground mb-2">
          {formattedDate}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-sm text-muted-foreground">
              {t('admin.statistics.charts.revenue')}:
            </span>
            <span className="text-sm font-medium text-foreground">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'DZD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(data.revenue)}
            </span>
          </div>
          {data.family && (
            <div className="text-xs text-muted-foreground">
              {t('admin.statistics.filters.family')}: {data.family}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Format X-axis labels based on date range
 */
function formatXAxisLabel(dateString: string, dateRange: DateRange): string {
  const date = parseISO(dateString);
  
  switch (dateRange.type) {
    case 'weekly':
      return format(date, 'EEE');
    case 'monthly':
      return format(date, 'MMM dd');
    case 'yearly':
      return format(date, 'MMM');
    case 'custom':
      const daysDiff = Math.ceil(
        (new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff <= 7) {
        return format(date, 'EEE');
      } else if (daysDiff <= 30) {
        return format(date, 'MMM dd');
      } else {
        return format(date, 'MMM');
      }
    default:
      return format(date, 'MMM dd');
  }
}

/**
 * Format Y-axis labels for currency
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
 * Loading skeleton for revenue chart
 */
function RevenueChartSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Error state for revenue chart
 */
interface RevenueChartErrorProps {
  error: string;
  onRetry?: () => void;
  t: (key: string) => string;
}

function RevenueChartError({ error, onRetry, t }: RevenueChartErrorProps) {
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
 * Revenue Chart Component
 * Displays revenue trends over time with family filtering capability
 */
export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  dateRange,
  family,
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
      formattedDate: formatXAxisLabel(item.date, dateRange),
      displayRevenue: item.revenue,
    }));
  }, [data, dateRange]);

  // Calculate chart statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const revenues = chartData.map(d => d.revenue);
    const totalRevenue = revenues.reduce((sum, rev) => sum + rev, 0);
    const averageRevenue = totalRevenue / revenues.length;
    const maxRevenue = Math.max(...revenues);
    const minRevenue = Math.min(...revenues);
    
    return {
      totalRevenue,
      averageRevenue,
      maxRevenue,
      minRevenue,
      dataPoints: chartData.length,
    };
  }, [chartData]);

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('admin.statistics.charts.revenue')}
          </CardTitle>
          <CardDescription>
            Revenue trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChartSkeleton />
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
            <TrendingUp className="h-5 w-5" />
            {t('admin.statistics.charts.revenue')}
          </CardTitle>
          <CardDescription>
            Revenue trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChartError 
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
            <TrendingUp className="h-5 w-5" />
            {t('admin.statistics.charts.revenue')}
          </CardTitle>
          <CardDescription>
            Revenue trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
              <TrendingUp className="h-5 w-5" />
              {t('admin.statistics.charts.revenue')}
            </CardTitle>
            <CardDescription>
              Revenue trends over time
              {family && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {family}
                </span>
              )}
            </CardDescription>
          </div>
          {stats && (
            <div className="text-right text-sm text-muted-foreground">
              <div>{t('admin.statistics.charts.total')}: {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'DZD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(stats.totalRevenue)}</div>
              <div>{t('admin.statistics.charts.average')}: {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'DZD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(stats.averageRevenue)}</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
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
                dataKey="formattedDate"
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
              <Line
                type="monotone"
                dataKey="displayRevenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                name={t('admin.statistics.charts.revenue')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
