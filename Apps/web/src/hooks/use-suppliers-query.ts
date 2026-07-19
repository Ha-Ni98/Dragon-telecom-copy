import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suppliersService } from '@/lib/services/suppliers.service';
import { Supplier } from '@/types/draft-types/admin-product-add.types';

/**
 * Query keys for suppliers
 */
export const suppliersQueryKeys = {
  all: ['suppliers'] as const,
  lists: () => [...suppliersQueryKeys.all, 'list'] as const,
  list: (filters: string) => [...suppliersQueryKeys.lists(), { filters }] as const,
  details: () => [...suppliersQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...suppliersQueryKeys.details(), id] as const,
  search: (query: string) => [...suppliersQueryKeys.all, 'search', query] as const,
  active: () => [...suppliersQueryKeys.all, 'active'] as const,
};

/**
 * Hook to fetch all suppliers
 */
export function useSuppliersQuery() {
  return useQuery({
    queryKey: suppliersQueryKeys.lists(),
    queryFn: () => suppliersService.getSuppliers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch supplier by ID
 */
export function useSupplierQuery(id: number) {
  return useQuery({
    queryKey: suppliersQueryKeys.detail(id),
    queryFn: () => suppliersService.getSupplierById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to search suppliers
 */
export function useSuppliersSearchQuery(query: string) {
  return useQuery({
    queryKey: suppliersQueryKeys.search(query),
    queryFn: () => suppliersService.searchSuppliers(query),
    enabled: !!query && query.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook to fetch active suppliers only
 */
export function useActiveSuppliersQuery() {
  return useQuery({
    queryKey: suppliersQueryKeys.active(),
    queryFn: () => suppliersService.getActiveSuppliers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to create supplier
 */
export function useCreateSupplierMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (supplier: Omit<Supplier, 'idSupplier'>) => suppliersService.createSupplier(supplier),
    onSuccess: (newSupplier) => {
      // Invalidate and refetch suppliers list
      queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.active() });
      
      // Add the new supplier to the cache
      queryClient.setQueryData(suppliersQueryKeys.detail(newSupplier.idSupplier), newSupplier);
    },
    onError: (error) => {
      console.error('Error creating supplier:', error);
    },
  });
}

/**
 * Hook to update supplier
 */
export function useUpdateSupplierMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, supplier }: { id: number; supplier: Partial<Supplier> }) => 
      suppliersService.updateSupplier(id, supplier),
    onSuccess: (updatedSupplier) => {
      // Update the specific supplier in cache
      queryClient.setQueryData(suppliersQueryKeys.detail(updatedSupplier.idSupplier), updatedSupplier);
      
      // Invalidate suppliers lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.active() });
    },
    onError: (error) => {
      console.error('Error updating supplier:', error);
    },
  });
}

/**
 * Hook to delete supplier
 */
export function useDeleteSupplierMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => suppliersService.deleteSupplier(id),
    onSuccess: (_, deletedId) => {
      // Remove the supplier from cache
      queryClient.removeQueries({ queryKey: suppliersQueryKeys.detail(deletedId) });
      
      // Invalidate suppliers lists
      queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.active() });
    },
    onError: (error) => {
      console.error('Error deleting supplier:', error);
    },
  });
}

/**
 * Hook to toggle supplier active status
 */
export function useToggleSupplierStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => suppliersService.toggleSupplierStatus(id),
    onSuccess: (updatedSupplier) => {
      // Update the specific supplier in cache
      queryClient.setQueryData(suppliersQueryKeys.detail(updatedSupplier.idSupplier), updatedSupplier);
      
      // Invalidate suppliers lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: suppliersQueryKeys.active() });
    },
    onError: (error) => {
      console.error('Error toggling supplier status:', error);
    },
  });
}

/**
 * Hook to get suppliers with search functionality
 */
export function useSuppliersWithSearch() {
  const suppliersQuery = useSuppliersQuery();
  
  return {
    suppliers: suppliersQuery.data || [],
    isLoading: suppliersQuery.isLoading,
    isError: suppliersQuery.isError,
    error: suppliersQuery.error,
    refetch: suppliersQuery.refetch,
  };
}

/**
 * Hook to get supplier suggestions for autocomplete
 */
export function useSupplierSuggestions(query: string, activeOnly: boolean = true) {
  const searchQuery = useSuppliersSearchQuery(query);
  const activeSuppliersQuery = useActiveSuppliersQuery();
  const allSuppliersQuery = useSuppliersQuery();

  // Determine which data to use based on activeOnly flag
  const suggestions = activeOnly
    ? (searchQuery.data || activeSuppliersQuery.data || [])
    : (searchQuery.data || allSuppliersQuery.data || []);

  const isLoading = activeOnly
    ? (searchQuery.isLoading || activeSuppliersQuery.isLoading)
    : (searchQuery.isLoading || allSuppliersQuery.isLoading);

  const isError = activeOnly
    ? (searchQuery.isError || activeSuppliersQuery.isError)
    : (searchQuery.isError || allSuppliersQuery.isError);

  const error = activeOnly
    ? (searchQuery.error || activeSuppliersQuery.error)
    : (searchQuery.error || allSuppliersQuery.error);

  return {
    suggestions,
    isLoading,
    isError,
    error,
  };
}
