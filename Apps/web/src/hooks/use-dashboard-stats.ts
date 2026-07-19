/**
 * Custom hook for dashboard statistics
 * Handles fetching and caching of dashboard statistics data
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { DashboardStats } from "@/types/draft-types/dashboard.types";
import { dashboardService } from "@/services/dashboard.service";

/**
 * Hook to fetch dashboard statistics
 * Uses TanStack Query for caching and state management
 */
export function useDashboardStats(
  options?: Partial<UseQueryOptions<DashboardStats>>
) {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: dashboardService.getDashboardStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to fetch dashboard summary
 * Returns key metrics for quick overview
 */
export function useDashboardSummary(
  options?: Partial<UseQueryOptions<{
    totalClients: number;
    totalProducts: number;
    pendingOrders: number;
    lowStockCount: number;
  }>>
) {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: dashboardService.getDashboardSummary,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 8, // 8 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}
