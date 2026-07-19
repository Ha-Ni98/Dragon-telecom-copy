/**
 * Custom hook for recent clients
 * Handles fetching and caching of recent clients data
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { RecentClient } from "@/types/draft-types/dashboard.types";
import { dashboardService } from "@/lib/services/dashboard.service";

/**
 * Hook to fetch recent clients
 * Uses TanStack Query for caching and state management
 */
export function useRecentClients(
  limit: number = 5,
  options?: Partial<UseQueryOptions<RecentClient[]>>
) {
  return useQuery({
    queryKey: ["dashboard", "recent-clients", limit],
    queryFn: () => dashboardService.getRecentClients(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}
