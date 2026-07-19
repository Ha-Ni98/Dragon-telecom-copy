/**
 * Admin Logs Hooks
 * Custom hooks for admin logs data management using TanStack Query
 */

import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { AdminLogsService } from '@/lib/services/admin-logs.service';
import { 
  AdminLogsFilters, 
  AdminLogsPaginatedResponse, 
  AdminLogsStats 
} from '@/types/draft-types/logs.types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const adminLogsQueryKeys = {
  all: ['admin-logs'] as const,
  lists: () => [...adminLogsQueryKeys.all, 'list'] as const,
  list: (filters: AdminLogsFilters) => [...adminLogsQueryKeys.lists(), filters] as const,
  stats: () => [...adminLogsQueryKeys.all, 'stats'] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch admin logs with filtering and pagination
 */
export function useAdminLogs(
  filters: AdminLogsFilters,
  options?: Partial<UseQueryOptions<AdminLogsPaginatedResponse>>
) {
  return useQuery<AdminLogsPaginatedResponse>({
    queryKey: adminLogsQueryKeys.list(filters),
    queryFn: () => AdminLogsService.getLogs(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to fetch admin logs statistics
 */
export function useAdminLogsStats(
  options?: Partial<UseQueryOptions<AdminLogsStats>>
) {
  return useQuery<AdminLogsStats>({
    queryKey: adminLogsQueryKeys.stats(),
    queryFn: () => AdminLogsService.getLogsStats(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to refresh admin logs data
 * Provides methods to invalidate and refetch logs data
 */
export function useRefreshAdminLogs() {
  const queryClient = useQueryClient();

  const refreshAll = async () => {
    try {
      // Clear service cache
      await AdminLogsService.refreshLogs();
      
      // Invalidate all logs queries
      await queryClient.invalidateQueries({
        queryKey: adminLogsQueryKeys.all,
      });
      
      // Refetch all active queries
      await queryClient.refetchQueries({
        queryKey: adminLogsQueryKeys.all,
      });
    } catch (error) {
      console.error('Error refreshing admin logs:', error);
      throw error;
    }
  };

  const refreshLogs = async (filters?: AdminLogsFilters) => {
    try {
      if (filters) {
        // Invalidate specific logs query
        await queryClient.invalidateQueries({
          queryKey: adminLogsQueryKeys.list(filters),
        });
        
        // Refetch specific query
        await queryClient.refetchQueries({
          queryKey: adminLogsQueryKeys.list(filters),
        });
      } else {
        // Invalidate all logs queries
        await queryClient.invalidateQueries({
          queryKey: adminLogsQueryKeys.lists(),
        });
        
        // Refetch all logs queries
        await queryClient.refetchQueries({
          queryKey: adminLogsQueryKeys.lists(),
        });
      }
    } catch (error) {
      console.error('Error refreshing logs:', error);
      throw error;
    }
  };

  const refreshStats = async () => {
    try {
      // Invalidate stats query
      await queryClient.invalidateQueries({
        queryKey: adminLogsQueryKeys.stats(),
      });
      
      // Refetch stats query
      await queryClient.refetchQueries({
        queryKey: adminLogsQueryKeys.stats(),
      });
    } catch (error) {
      console.error('Error refreshing logs stats:', error);
      throw error;
    }
  };

  const clearCache = () => {
    // Clear service cache
    AdminLogsService.clearCache();
    
    // Remove all logs queries from React Query cache
    queryClient.removeQueries({
      queryKey: adminLogsQueryKeys.all,
    });
  };

  return {
    refreshAll,
    refreshLogs,
    refreshStats,
    clearCache,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to get cache statistics for debugging
 */
export function useAdminLogsCacheStats() {
  const queryClient = useQueryClient();
  
  const getCacheStats = () => {
    const serviceStats = AdminLogsService.getCacheStats();
    const queryCache = queryClient.getQueryCache();
    const logsQueries = queryCache.findAll({
      queryKey: adminLogsQueryKeys.all,
    });
    
    return {
      service: serviceStats,
      reactQuery: {
        totalQueries: logsQueries.length,
        queries: logsQueries.map(query => ({
          queryKey: query.queryKey,
          state: query.state.status,
          dataUpdatedAt: query.state.dataUpdatedAt,
        })),
      },
    };
  };

  return { getCacheStats };
}
