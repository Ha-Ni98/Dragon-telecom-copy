/**
 * Admin Statistics Charts Container Component
 * Container for all chart components with responsive grid layout
 */

import React, { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  AlertTriangle, 
  RefreshCw,
  TrendingUp,
  Users,
  PieChart as PieChartIcon
} from 'lucide-react';
import { RevenueChart } from './charts/revenue-chart';
import { OrdersTrendChart } from './charts/orders-trend-chart';
import { ClientsChart } from './charts/clients-chart';
import { SalesByFamilyChart } from './charts/sales-by-family-chart';
import { 
  RevenueChartData, 
  OrdersChartData, 
  ClientsChartData, 
  SalesByFamilyData, 
  DateRange 
} from '@/types/draft-types/admin-statistics.types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for the Admin Statistics Charts container component
 */
export interface AdminStatisticsChartsProps {
  revenueData: RevenueChartData[];
  ordersData: OrdersChartData[];
  clientsData: ClientsChartData[];
  salesByFamilyData: SalesByFamilyData[];
  dateRange: DateRange;
  selectedFamily?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Chart configuration for the charts container
 */
const chartConfig = [
  {
    key: 'revenue',
    title: 'admin.statistics.charts.revenue.title',
    description: 'admin.statistics.charts.revenue.description',
    icon: TrendingUp,
    component: RevenueChart,
    props: ['revenueData', 'dateRange', 'selectedFamily', 'loading', 'error', 'onRetry'],
  },
  {
    key: 'orders',
    title: 'admin.statistics.charts.orders.title',
    description: 'admin.statistics.charts.orders.description',
    icon: BarChart3,
    component: OrdersTrendChart,
    props: ['ordersData', 'dateRange', 'loading', 'error', 'onRetry'],
  },
  {
    key: 'clients',
    title: 'admin.statistics.charts.clients.title',
    description: 'admin.statistics.charts.clients.description',
    icon: Users,
    component: ClientsChart,
    props: ['clientsData', 'dateRange', 'loading', 'error', 'onRetry'],
  },
  {
    key: 'salesByFamily',
    title: 'admin.statistics.charts.salesByFamily.title',
    description: 'admin.statistics.charts.salesByFamily.description',
    icon: PieChartIcon,
    component: SalesByFamilyChart,
    props: ['salesByFamilyData', 'dateRange', 'loading', 'error', 'onRetry'],
  },
];

/**
 * Loading skeleton for charts container
 */
function ChartsContainerSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Error state for charts container
 */
interface ChartsContainerErrorProps {
  error: string;
  onRetry?: () => void;
  t: (key: string) => string;
}

function ChartsContainerError({ error, onRetry, t }: ChartsContainerErrorProps) {
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
 * Individual chart wrapper component with error boundary
 */
interface ChartWrapperProps {
  config: typeof chartConfig[0];
  data: any;
  dateRange: DateRange;
  selectedFamily?: string;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  t: (key: string) => string;
}

const ChartWrapper = memo<ChartWrapperProps>(({ 
  config, 
  data, 
  dateRange, 
  selectedFamily, 
  loading, 
  error, 
  onRetry, 
  t 
}) => {
  const ChartComponent = config.component;
  
  // Prepare props based on chart configuration
  const chartProps: any = {
    dateRange,
    loading,
    error,
    onRetry,
  };

  // Add data prop based on chart type
  switch (config.key) {
    case 'revenue':
      chartProps.data = data;
      if (selectedFamily) {
        chartProps.family = selectedFamily;
      }
      break;
    case 'orders':
      chartProps.data = data;
      break;
    case 'clients':
      chartProps.data = data;
      break;
    case 'salesByFamily':
      chartProps.data = data;
      break;
  }

  return <ChartComponent {...chartProps} />;
});

ChartWrapper.displayName = 'ChartWrapper';

/**
 * Admin Statistics Charts Container Component
 * Container for all chart components with responsive grid layout
 */
export const AdminStatisticsCharts = memo<AdminStatisticsChartsProps>(({
  revenueData,
  ordersData,
  clientsData,
  salesByFamilyData,
  dateRange,
  selectedFamily,
  loading = false,
  error,
  onRetry,
  className = '',
}) => {
  const { t } = useTranslation();

  // Loading state
  if (loading) {
    return (
      <div className={className}>
        <ChartsContainerSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <ChartsContainerError 
          error={error}
          onRetry={onRetry}
          t={t}
        />
      </div>
    );
  }

  // Chart data mapping
  const chartDataMap = {
    revenue: revenueData,
    orders: ordersData,
    clients: clientsData,
    salesByFamily: salesByFamilyData,
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {chartConfig.map((config) => (
        <ChartWrapper
          key={config.key}
          config={config}
          data={chartDataMap[config.key as keyof typeof chartDataMap]}
          dateRange={dateRange}
          selectedFamily={selectedFamily}
          loading={loading}
          error={error}
          onRetry={onRetry}
          t={t}
        />
      ))}
    </div>
  );
});

AdminStatisticsCharts.displayName = 'AdminStatisticsCharts';
