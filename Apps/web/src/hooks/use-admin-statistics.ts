/**
 * Custom hooks for admin statistics
 * Handles fetching and caching of statistics data using TanStack Query
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { 
  AdminStatisticsOverview,
  AdminStatisticsFiltered,
  RevenueChartData,
  OrdersChartData,
  ClientsChartData,
  SalesByFamilyData,
  TopSellingProduct,
  DateRange,
  AdminStatisticsResponse,
  UseAdminStatisticsReturn
} from "@/types/draft-types/admin-statistics.types";
import { adminStatisticsService } from "@/lib/services/admin-statistics.service";

/**
 * Query keys for admin statistics
 */
export const adminStatisticsQueryKeys = {
  all: ['admin-statistics'] as const,
  overview: () => [...adminStatisticsQueryKeys.all, 'overview'] as const,
  filtered: (dateRange: DateRange) => [...adminStatisticsQueryKeys.all, 'filtered', dateRange] as const,
  revenue: (dateRange: DateRange, family?: string) => [...adminStatisticsQueryKeys.all, 'revenue', dateRange, family] as const,
  orders: (dateRange: DateRange) => [...adminStatisticsQueryKeys.all, 'orders', dateRange] as const,
  clients: (dateRange: DateRange) => [...adminStatisticsQueryKeys.all, 'clients', dateRange] as const,
  salesByFamily: (dateRange: DateRange) => [...adminStatisticsQueryKeys.all, 'sales-by-family', dateRange] as const,
  topProducts: (period: string) => [...adminStatisticsQueryKeys.all, 'top-products', period] as const,
  allData: (dateRange: DateRange, family?: string) => [...adminStatisticsQueryKeys.all, 'all-data', dateRange, family] as const,
};

/**
 * Hook to fetch overview statistics
 * Returns general statistics for the admin dashboard
 */
export function useAdminStatisticsOverview(
  options?: Partial<UseQueryOptions<AdminStatisticsOverview>>
) {
  return useQuery({
    queryKey: adminStatisticsQueryKeys.overview(),
    queryFn: adminStatisticsService.getOverviewStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to fetch filtered statistics based on date range
 * Returns statistics filtered by the specified date range
 */
export function useAdminStatisticsFiltered(
  dateRange: DateRange,
  options?: Partial<UseQueryOptions<AdminStatisticsFiltered>>
) {
  return useQuery({
    queryKey: adminStatisticsQueryKeys.filtered(dateRange),
    queryFn: () => adminStatisticsService.getFilteredStats(dateRange),
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 8, // 8 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    enabled: !!dateRange,
    ...options,
  });
}

/**
 * Hook to fetch revenue chart data
 * Returns revenue data for chart visualization
 */
export function useAdminStatisticsRevenue(
  dateRange: DateRange,
  family?: string,
  options?: Partial<UseQueryOptions<RevenueChartData[]>>
) {
  return useQuery({
    queryKey: adminStatisticsQueryKeys.revenue(dateRange, family),
    queryFn: () => adminStatisticsService.getRevenueData(dateRange, family),
    staleTime: 1000 * 60 * 4, // 4 minutes
    gcTime: 1000 * 60 * 8, // 8 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    enabled: !!dateRange,
    ...options,
  });
}

/**
 * Hook to fetch orders chart data
 * Returns orders data for chart visualization
 */
export function useAdminStatisticsOrders(
  dateRange: DateRange,
  options?: Partial<UseQueryOptions<OrdersChartData[]>>
) {
  return useQuery({
    queryKey: adminStatisticsQueryKeys.orders(dateRange),
    queryFn: () => adminStatisticsService.getOrdersData(dateRange),
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 8, // 8 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    enabled: !!dateRange,
    ...options,
  });
}

/**
 * Hook to fetch clients chart data
 * Returns client registration data for chart visualization
 */
export function useAdminStatisticsClients(
  dateRange: DateRange,
  options?: Partial<UseQueryOptions<ClientsChartData[]>>
) {
  return useQuery({
    queryKey: adminStatisticsQueryKeys.clients(dateRange),
    queryFn: () => adminStatisticsService.getClientsData(dateRange),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    enabled: !!dateRange,
    ...options,
  });
}

/**
 * Hook to fetch sales by family data
 * Returns sales distribution data by product family
 */
export function useAdminStatisticsSalesByFamily(
  dateRange: DateRange,
  options?: Partial<UseQueryOptions<SalesByFamilyData[]>>
) {
  return useQuery({
    queryKey: adminStatisticsQueryKeys.salesByFamily(dateRange),
    queryFn: () => adminStatisticsService.getSalesByFamilyData(dateRange),
    staleTime: 1000 * 60 * 6, // 6 minutes
    gcTime: 1000 * 60 * 12, // 12 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    enabled: !!dateRange,
    ...options,
  });
}

/**
 * Hook to fetch top selling products
 * Returns best-selling products based on period
 */
export function useTopSellingProducts(
  period: string = 'all-time',
  options?: Partial<UseQueryOptions<TopSellingProduct[]>>
) {
  return useQuery({
    queryKey: adminStatisticsQueryKeys.topProducts(period),
    queryFn: () => adminStatisticsService.getTopSellingProducts(period),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to fetch all statistics data
 * Aggregates all statistics data in a single call
 */
export function useAdminStatisticsAllData(
  dateRange: DateRange,
  family?: string,
  options?: Partial<UseQueryOptions<AdminStatisticsResponse>>
) {
  return useQuery({
    queryKey: adminStatisticsQueryKeys.allData(dateRange, family),
    queryFn: () => adminStatisticsService.getAllStatisticsData(dateRange, family),
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 8, // 8 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    enabled: !!dateRange,
    ...options,
  });
}

/**
 * Main hook to fetch all statistics data with unified interface
 * Returns all statistics data in a single hook
 */
export function useAdminStatistics(
  dateRange: DateRange,
  family?: string,
  options?: Partial<UseQueryOptions<AdminStatisticsResponse>>
): UseAdminStatisticsReturn {
  const query = useAdminStatisticsAllData(dateRange, family, options);
  
  return {
    overview: query.data?.overview,
    filtered: query.data?.filtered,
    charts: query.data?.charts || {
      revenue: [],
      orders: [],
      clients: [],
      salesByFamily: [],
    },
    topProducts: query.data?.topProducts || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to refresh statistics data
 * Forces a refresh of all statistics data
 */
export function useRefreshAdminStatistics() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ dateRange, family }: { dateRange: DateRange; family?: string }) =>
      adminStatisticsService.refreshStatisticsData(dateRange, family),
    onSuccess: (data, variables) => {
      // Update all related queries
      queryClient.setQueryData(
        adminStatisticsQueryKeys.allData(variables.dateRange, variables.family),
        data
      );
      
      // Invalidate related queries to trigger refetch
      queryClient.invalidateQueries({
        queryKey: adminStatisticsQueryKeys.all,
      });
    },
  });
}

/**
 * Hook to get statistics summary
 * Returns a summary of key metrics for quick overview
 */
export function useAdminStatisticsSummary(
  options?: Partial<UseQueryOptions<{
    totalRevenue: number;
    totalOrders: number;
    totalClients: number;
    topFamily: string;
  }>>
) {
  return useQuery({
    queryKey: [...adminStatisticsQueryKeys.all, 'summary'],
    queryFn: adminStatisticsService.getStatisticsSummary,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to get date range presets
 * Returns predefined date ranges for quick selection
 */
export function useDateRangePresets() {
  return useQuery({
    queryKey: [...adminStatisticsQueryKeys.all, 'date-range-presets'],
    queryFn: adminStatisticsService.getDateRangePresets,
    staleTime: 1000 * 60 * 60, // 1 hour (static data)
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
