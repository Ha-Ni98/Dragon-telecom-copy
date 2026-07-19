/**
 * Admin Statistics Page
 * Comprehensive analytics and insights for the admin dashboard
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/useTranslation';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { AdminStatisticsFilters } from '@/pages/admin/statistics/components/admin-statistics-filters';
import { AdminStatisticsOverviewCards } from '@/pages/admin/statistics/components/admin-statistics-overview-cards';
import { AdminStatisticsFilteredCards } from '@/pages/admin/statistics/components/admin-statistics-filtered-cards';
import { RevenueChart } from '@/pages/admin/statistics/components/charts/revenue-chart';
import { OrdersTrendChart } from '@/pages/admin/statistics/components/charts/orders-trend-chart';
import { ClientsChart } from '@/pages/admin/statistics/components/charts/clients-chart';
import { SalesByFamilyChart } from '@/pages/admin/statistics/components/charts/sales-by-family-chart';
import { AdminStatisticsCharts } from '@/pages/admin/statistics/components/admin-statistics-charts';
import { AdminTopSellingProducts } from '@/pages/admin/products/components/admin-top-selling-products';
import { 
  useAdminStatistics, 
  useAdminStatisticsRevenue,
  useAdminStatisticsOrders,
  useAdminStatisticsClients,
  useAdminStatisticsSalesByFamily,
  useTopSellingProducts,
  useDateRangePresets,
  useRefreshAdminStatistics 
} from '@/hooks/use-admin-statistics';
import { DateRange } from '@/types/draft-types/admin-statistics.types';
import { generateDateRangeData } from '@/mocks/admin-statistics';

/**
 * Admin Statistics Page Component
 * Provides comprehensive analytics and insights for the admin dashboard
 */
export default function AdminStatistics() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State management
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(() => {
    const dateRangeType = searchParams.get('dateRange') as DateRange['type'] || 'monthly';
    return generateDateRangeData(dateRangeType);
  });
  const [selectedFamily, setSelectedFamily] = useState<string>(() => 
    searchParams.get('family') || 'all'
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data fetching
  const { 
    overview, 
    filtered, 
    charts, 
    topProducts, 
    isLoading, 
    error, 
    refetch 
  } = useAdminStatistics(selectedDateRange, selectedFamily === 'all' ? undefined : selectedFamily);

  const { data: dateRangePresets } = useDateRangePresets();
  const refreshMutation = useRefreshAdminStatistics();

  // Chart data hooks
  const { 
    data: revenueChartData, 
    error: revenueChartError 
  } = useAdminStatisticsRevenue(selectedDateRange, selectedFamily !== 'all' ? selectedFamily : undefined);
  
  const { 
    data: ordersChartData, 
    error: ordersChartError 
  } = useAdminStatisticsOrders(selectedDateRange);

  // Additional chart data hooks
  const { 
    data: clientsChartData, 
    error: clientsChartError 
  } = useAdminStatisticsClients(selectedDateRange);
  
  const { 
    data: salesByFamilyData, 
    error: salesByFamilyError 
  } = useAdminStatisticsSalesByFamily(selectedDateRange);

  // Top selling products hook
  const { 
    data: topProductsData, 
    error: topProductsError 
  } = useTopSellingProducts(selectedDateRange.type);

  /**
   * Update URL parameters
   */
  const updateURLParams = useCallback((dateRange: DateRange, family: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    
    if (dateRange.type !== 'monthly') {
      newSearchParams.set('dateRange', dateRange.type);
    } else {
      newSearchParams.delete('dateRange');
    }
    
    if (family !== 'all') {
      newSearchParams.set('family', family);
    } else {
      newSearchParams.delete('family');
    }
    
    setSearchParams(newSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  /**
   * Handle date range change
   */
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setSelectedDateRange(newDateRange);
    updateURLParams(newDateRange, selectedFamily);
  }, [selectedFamily, updateURLParams]);

  /**
   * Handle family filter change
   */
  const handleFamilyChange = useCallback((family: string) => {
    setSelectedFamily(family);
    updateURLParams(selectedDateRange, family);
  }, [selectedDateRange, updateURLParams]);

  /**
   * Handle refresh action
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshMutation.mutateAsync({
        dateRange: selectedDateRange,
        family: selectedFamily === 'all' ? undefined : selectedFamily
      });
    } catch (error) {
      console.error('Failed to refresh statistics:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshMutation, selectedDateRange, selectedFamily]);

  /**
   * Handle retry on error
   */
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            {t('admin.statistics.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('admin.statistics.description')}
          </p>
        </div>
        
        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('admin.statistics.refresh')}
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{t('admin.statistics.error')}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="ml-4"
            >
              {t('admin.statistics.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && !overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted animate-pulse rounded mb-2" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="h-5 bg-muted animate-pulse rounded w-1/3" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !error && overview && filtered && (
        <ErrorBoundary>
          <div className="space-y-6">
            {/* Overview Statistics Cards */}
            <AdminStatisticsOverviewCards
              stats={overview}
              loading={isLoading}
            />

            {/* Filters Section */}
            <AdminStatisticsFilters
              selectedDateRange={selectedDateRange}
              onDateRangeChange={handleDateRangeChange}
              selectedFamily={selectedFamily}
              onFamilyChange={handleFamilyChange}
              families={[]}
              loading={isLoading}
            />

            {/* Filtered Statistics */}
            <AdminStatisticsFilteredCards
              stats={filtered}
              dateRange={selectedDateRange}
              loading={isLoading}
            />

            {/* Charts Section */}
            <AdminStatisticsCharts
              revenueData={revenueChartData || []}
              ordersData={ordersChartData || []}
              clientsData={clientsChartData || []}
              salesByFamilyData={salesByFamilyData || []}
              dateRange={selectedDateRange}
              selectedFamily={selectedFamily !== 'all' ? selectedFamily : undefined}
              loading={isLoading}
              error={(revenueChartError || ordersChartError || clientsChartError || salesByFamilyError)?.message}
              onRetry={refetch}
            />

            {/* Top Selling Products */}
            <AdminTopSellingProducts
              products={topProductsData || []}
              dateRange={selectedDateRange}
              loading={isLoading}
              error={topProductsError?.message}
              onRetry={refetch}
            />
          </div>
        </ErrorBoundary>
      )}
    </div>
  );
}