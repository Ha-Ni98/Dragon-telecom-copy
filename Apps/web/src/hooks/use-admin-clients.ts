/**
 * Hook for fetching admin clients data
 * Provides paginated client data with filtering and search capabilities
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { 
  AdminClientsFilters, 
  AdminClientsPaginatedResponse 
} from "@/types/draft-types/client.types";
import { AdminClientsService } from "@/lib/services/admin-clients.service";

/**
 * Query keys for admin clients
 */
export const adminClientsQueryKeys = {
  all: ['admin-clients'] as const,
  lists: () => [...adminClientsQueryKeys.all, 'list'] as const,
  list: (filters: AdminClientsFilters) => [...adminClientsQueryKeys.lists(), filters] as const,
};

/**
 * Hook to fetch admin clients with pagination and filtering
 * Returns paginated client data with loading and error states
 */
export function useAdminClients(
  filters: AdminClientsFilters,
  options?: Partial<UseQueryOptions<AdminClientsPaginatedResponse>>
) {
  return useQuery({
    queryKey: adminClientsQueryKeys.list(filters),
    queryFn: () => AdminClientsService.getClients(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to refresh admin clients data
 * Forces a refresh of the clients data
 */
export function useRefreshAdminClients() {
  const { refetch } = useAdminClients({
    searchQuery: '',
    status: 'all',
    page: 1,
    limit: 10
  });
  
  return {
    refreshClients: refetch,
  };
}

/**
 * Hook to get a single client by ID
 */
export function useAdminClient(clientId: number) {
  return useQuery({
    queryKey: [...adminClientsQueryKeys.all, 'client', clientId],
    queryFn: () => AdminClientsService.getClientById(clientId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
  });
}
