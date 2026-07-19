/**
 * Hook for fetching admin clients statistics
 * Provides statistics data for the admin clients dashboard
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { AdminClientsStats } from "@/types/draft-types/client.types";
import { AdminClientsStatsService } from "@/lib/services/admin-clients-stats.service";

/**
 * Query keys for admin clients statistics
 */
export const adminClientsStatsQueryKeys = {
  all: ['admin-clients-stats'] as const,
  stats: () => [...adminClientsStatsQueryKeys.all, 'stats'] as const,
};

/**
 * Hook to fetch admin clients statistics
 * Returns statistics data with loading and error states
 */
export function useAdminClientsStats(
  options?: Partial<UseQueryOptions<AdminClientsStats>>
) {
  return useQuery({
    queryKey: adminClientsStatsQueryKeys.stats(),
    queryFn: AdminClientsStatsService.getClientsStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to refresh admin clients statistics
 * Forces a refresh of the statistics data
 */
export function useRefreshAdminClientsStats() {
  const { refetch } = useAdminClientsStats();
  
  return {
    refreshStats: refetch,
  };
}
