/**
 * Sales by Family Chart Component
 * Displays sales distribution by product family with interactive pie chart
 */

import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PieChart as PieChartIcon, 
  AlertTriangle, 
  RefreshCw, 
  TrendingUp,
  Eye,
  EyeOff
} from 'lucide-react';
import { SalesByFamilyData, DateRange } from '@/types/draft-types/admin-statistics.types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for the Sales by Family Chart component
 */
export interface SalesByFamilyChartProps {
  data: SalesByFamilyData[];
  dateRange: DateRange;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Custom tooltip component for sales by family chart
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  t: (key: string) => string;
}

function CustomTooltip({ active, payload, t }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <div className="text-sm font-medium text-foreground mb-2">
          {data.familyName}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              {t('admin.statistics.charts.salesByFamily.sales')}:
            </span>
            <span className="text-sm font-medium text-foreground">
              {data.sales.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              {t('admin.statistics.charts.salesByFamily.percentage')}:
            </span>
            <span className="text-sm font-medium text-foreground">
              {data.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              {t('admin.statistics.charts.salesByFamily.revenue')}:
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
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Custom legend component for sales by family chart
 */
interface CustomLegendProps {
  payload?: any[];
  onToggle?: (familyName: string) => void;
  hiddenFamilies?: Set<string>;
  t: (key: string) => string;
}

function CustomLegend({ payload, onToggle, hiddenFamilies, t }: CustomLegendProps) {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {payload.map((entry, index) => {
        const isHidden = hiddenFamilies?.has(entry.payload.familyName);
        
        return (
          <Badge
            key={index}
            variant="outline"
            className={`cursor-pointer hover:opacity-80 transition-opacity ${
              isHidden ? 'opacity-50' : ''
            }`}
            onClick={() => onToggle?.(entry.payload.familyName)}
            style={{ 
              borderColor: entry.color,
              backgroundColor: isHidden ? 'transparent' : `${entry.color}20`,
              color: entry.color
            }}
          >
            <div 
              className="w-3 h-3 rounded-full mr-2" 
              style={{ backgroundColor: entry.color }}
            />
            {entry.payload.familyName}: {entry.payload.percentage.toFixed(1)}%
            {isHidden ? (
              <EyeOff className="h-3 w-3 ml-1" />
            ) : (
              <Eye className="h-3 w-3 ml-1" />
            )}
          </Badge>
        );
      })}
    </div>
  );
}

/**
 * Loading skeleton for sales by family chart
 */
function SalesByFamilyChartSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="flex items-center justify-center">
        <Skeleton className="h-64 w-64 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-20" />
        ))}
      </div>
    </div>
  );
}

/**
 * Error state for sales by family chart
 */
interface SalesByFamilyChartErrorProps {
  error: string;
  onRetry?: () => void;
  t: (key: string) => string;
}

function SalesByFamilyChartError({ error, onRetry, t }: SalesByFamilyChartErrorProps) {
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
 * Sales by Family Chart Component
 * Displays sales distribution by product family with interactive pie chart
 */
export const SalesByFamilyChart: React.FC<SalesByFamilyChartProps> = ({
  data,
  dateRange,
  loading = false,
  error,
  onRetry,
  className = '',
}) => {
  const { t } = useTranslation();
  const [hiddenFamilies, setHiddenFamilies] = useState<Set<string>>(new Set());

  // Process data for chart display
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      // Ensure color is properly formatted
      color: item.color.startsWith('#') ? item.color : `#${item.color}`,
    }));
  }, [data]);

  // Filter data based on hidden families
  const visibleData = useMemo(() => {
    return chartData.filter(item => !hiddenFamilies.has(item.familyName));
  }, [chartData, hiddenFamilies]);

  // Calculate chart statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const totalSales = chartData.reduce((sum, item) => sum + item.sales, 0);
    const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
    const topFamily = chartData.reduce((max, item) => 
      item.sales > max.sales ? item : max
    );
    const averagePercentage = chartData.reduce((sum, item) => sum + item.percentage, 0) / chartData.length;
    
    return {
      totalSales,
      totalRevenue,
      topFamily,
      averagePercentage,
      familyCount: chartData.length,
    };
  }, [chartData]);

  // Toggle family visibility
  const toggleFamily = (familyName: string) => {
    setHiddenFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(familyName)) {
        newSet.delete(familyName);
      } else {
        newSet.add(familyName);
      }
      return newSet;
    });
  };

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            {t('admin.statistics.charts.salesByFamily.title')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.charts.salesByFamily.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SalesByFamilyChartSkeleton />
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
            <PieChartIcon className="h-5 w-5" />
            {t('admin.statistics.charts.salesByFamily.title')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.charts.salesByFamily.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SalesByFamilyChartError 
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
            <PieChartIcon className="h-5 w-5" />
            {t('admin.statistics.charts.salesByFamily.title')}
          </CardTitle>
          <CardDescription>
            {t('admin.statistics.charts.salesByFamily.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <PieChartIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
              <PieChartIcon className="h-5 w-5" />
              {t('admin.statistics.charts.salesByFamily.title')}
            </CardTitle>
            <CardDescription>
              {t('admin.statistics.charts.salesByFamily.description')}
            </CardDescription>
          </div>
          {stats && (
            <div className="text-right text-sm text-muted-foreground">
              <div>{t('admin.statistics.charts.salesByFamily.totalSales')}: {stats.totalSales.toLocaleString()}</div>
              <div>{t('admin.statistics.charts.salesByFamily.totalRevenue')}: {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'DZD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(stats.totalRevenue)}</div>
              <div>{t('admin.statistics.charts.salesByFamily.topFamily')}: {stats.topFamily.familyName}</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={visibleData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ familyName, percentage }) => 
                  percentage > 5 ? `${familyName}: ${percentage.toFixed(1)}%` : ''
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="sales"
                stroke="hsl(var(--background))"
                strokeWidth={2}
              >
                {visibleData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip t={t} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Interactive Legend */}
        <CustomLegend
          payload={chartData.map((item, index) => ({
            value: item.familyName,
            color: item.color,
            payload: item,
          }))}
          onToggle={toggleFamily}
          hiddenFamilies={hiddenFamilies}
          t={t}
        />
      </CardContent>
    </Card>
  );
};
