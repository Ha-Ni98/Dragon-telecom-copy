/**
 * Orders Trend Chart Component
 * Displays orders trends over time with status filtering capability
 */

import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  BarChart3
} from 'lucide-react';
import { OrdersChartData, DateRange } from '@/types/draft-types/admin-statistics.types';
import { useTranslation } from '@/hooks/useTranslation';
import { format, parseISO } from 'date-fns';

/**
 * Props for the Orders Trend Chart component
 */
export interface OrdersTrendChartProps {
  data: OrdersChartData[];
  dateRange: DateRange;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Order status configuration
 */
const orderStatusConfig = [
  {
    key: 'completed' as keyof OrdersChartData,
    label: 'admin.statistics.orders.status.completed',
    color: 'hsl(var(--success))',
    bgColor: 'bg-green-50 dark:bg-green-950',
    textColor: 'text-green-600',
    icon: CheckCircle,
  },
  {
    key: 'pending' as keyof OrdersChartData,
    label: 'admin.statistics.orders.status.pending',
    color: 'hsl(var(--warning))',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    textColor: 'text-yellow-600',
    icon: Clock,
  },
  {
    key: 'canceled' as keyof OrdersChartData,
    label: 'admin.statistics.orders.status.canceled',
    color: 'hsl(var(--destructive))',
    bgColor: 'bg-red-50 dark:bg-red-950',
    textColor: 'text-red-600',
    icon: XCircle,
  },
];

/**
 * Custom tooltip component for orders chart
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
      console.warn('Error parsing date in orders chart tooltip:', error);
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
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-muted-foreground">
                {t('admin.statistics.orders.status.completed')}:
              </span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {data.completed}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-muted-foreground">
                {t('admin.statistics.orders.status.pending')}:
              </span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {data.pending}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm text-muted-foreground">
                {t('admin.statistics.orders.status.canceled')}:
              </span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {data.canceled}
            </span>
          </div>
          <div className="border-t border-border pt-1 mt-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-foreground">
                {t('admin.statistics.orders.total')}:
              </span>
              <span className="text-sm font-bold text-foreground">
                {data.total}
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
 * Loading skeleton for orders chart
 */
function OrdersChartSkeleton() {
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
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Error state for orders chart
 */
interface OrdersChartErrorProps {
  error: string;
  onRetry?: () => void;
  t: (key: string) => string;
}

function OrdersChartError({ error, onRetry, t }: OrdersChartErrorProps) {
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
 * Orders Trend Chart Component
 * Displays orders trends over time with status filtering capability
 */
export const OrdersTrendChart: React.FC<OrdersTrendChartProps> = ({
  data,
  dateRange,
  loading = false,
  error,
  onRetry,
  className = '',
}) => {
  const { t } = useTranslation();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Process data for chart display
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      formattedDate: formatXAxisLabel(item.date, dateRange),
    }));
  }, [data, dateRange]);

  // Calculate chart statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const totals = chartData.map(d => d.total);
    const completed = chartData.map(d => d.completed);
    const pending = chartData.map(d => d.pending);
    const canceled = chartData.map(d => d.canceled);
    
    const totalOrders = totals.reduce((sum, total) => sum + total, 0);
    const totalCompleted = completed.reduce((sum, comp) => sum + comp, 0);
    const totalPending = pending.reduce((sum, pend) => sum + pend, 0);
    const totalCanceled = canceled.reduce((sum, canc) => sum + canc, 0);
    
    const completionRate = totalOrders > 0 ? (totalCompleted / totalOrders) * 100 : 0;
    const cancellationRate = totalOrders > 0 ? (totalCanceled / totalOrders) * 100 : 0;
    
    return {
      totalOrders,
      totalCompleted,
      totalPending,
      totalCanceled,
      completionRate,
      cancellationRate,
      dataPoints: chartData.length,
    };
  }, [chartData]);

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t('admin.statistics.charts.orders')}
          </CardTitle>
          <CardDescription>
            Orders trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersChartSkeleton />
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
            <ShoppingCart className="h-5 w-5" />
            {t('admin.statistics.charts.orders')}
          </CardTitle>
          <CardDescription>
            Orders trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersChartError 
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
            <ShoppingCart className="h-5 w-5" />
            {t('admin.statistics.charts.orders')}
          </CardTitle>
          <CardDescription>
            Orders trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
              <ShoppingCart className="h-5 w-5" />
              {t('admin.statistics.charts.orders')}
            </CardTitle>
            <CardDescription>
              Orders trends over time by status
            </CardDescription>
          </div>
          {stats && (
            <div className="text-right text-sm text-muted-foreground">
              <div>{t('admin.statistics.charts.total')}: {stats.totalOrders.toLocaleString()}</div>
              <div>{t('admin.statistics.charts.completionRate')}: {stats.completionRate.toFixed(1)}%</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Status Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {orderStatusConfig.map((status) => {
            const Icon = status.icon;
            const count = stats ? stats[`total${status.key.charAt(0).toUpperCase() + status.key.slice(1)}` as keyof typeof stats] as number : 0;
            
            return (
              <Badge
                key={status.key}
                variant="outline"
                className={`${status.bgColor} ${status.textColor} border-0 cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => setSelectedStatus(selectedStatus === status.key ? 'all' : status.key)}
              >
                <Icon className="h-3 w-3 mr-1" />
                {t(status.label)}: {count}
              </Badge>
            );
          })}
        </div>

        {/* Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
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
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                className="text-muted-foreground"
              />
              <Tooltip
                content={<CustomTooltip t={t} />}
                cursor={{ fill: 'hsl(var(--muted-foreground))', opacity: 0.1 }}
              />
              <Legend />
              <Bar
                dataKey="completed"
                stackId="orders"
                fill="hsl(var(--success))"
                name={t('admin.statistics.orders.status.completed')}
                radius={[0, 0, 4, 4]}
              />
              <Bar
                dataKey="pending"
                stackId="orders"
                fill="hsl(var(--warning))"
                name={t('admin.statistics.orders.status.pending')}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="canceled"
                stackId="orders"
                fill="hsl(var(--destructive))"
                name={t('admin.statistics.orders.status.canceled')}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
