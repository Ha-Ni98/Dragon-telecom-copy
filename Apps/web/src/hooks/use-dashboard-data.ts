/**
 * Comprehensive dashboard data hook
 * Combines all dashboard data in a single hook for convenience
 */

import { useQuery, UseQueryOptions, useQueryClient } from "@tanstack/react-query";
import { DashboardData } from "@/types/draft-types/dashboard.types";
import { dashboardService } from "@/lib/services/dashboard.service";

/**
 * Hook to fetch all dashboard data
 * Combines statistics, recent clients, recent orders, and low stock products
 */
export function useDashboardData(
  options?: Partial<UseQueryOptions<DashboardData>>
) {
  return useQuery({
    queryKey: ["dashboard", "all-data"],
    queryFn: dashboardService.getAllDashboardData,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to refresh dashboard data
 * Forces a refresh of all dashboard data
 */
export function useRefreshDashboardData() {
  const queryClient = useQueryClient();
  
  const refreshData = async () => {
    try {
      const data = await dashboardService.refreshDashboardData();
      queryClient.setQueryData(["dashboard", "all-data"], data);
      return data;
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      throw error;
    }
  };

  return { refreshData };
}
