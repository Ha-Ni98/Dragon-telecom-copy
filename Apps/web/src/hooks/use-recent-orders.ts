/**
 * Custom hook for recent orders
 * Handles fetching and caching of recent orders data
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { RecentOrder } from "@/types/draft-types/dashboard.types";
import { dashboardService } from "@/services/dashboard.service";

/**
 * Hook to fetch recent orders
 * Uses TanStack Query for caching and state management
 */
export function useRecentOrders(
  limit: number = 8,
  options?: Partial<UseQueryOptions<RecentOrder[]>>
) {
  return useQuery({
    queryKey: ["dashboard", "recent-orders", limit],
    queryFn: () => dashboardService.getRecentOrders(limit),
    staleTime: 1000 * 60 * 3, // 3 minutes (orders change more frequently)
    gcTime: 1000 * 60 * 8, // 8 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}
