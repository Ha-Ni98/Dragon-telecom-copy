import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { familiesService } from '@/lib/services/families.service';
import { Family } from '@/types/draft-types/product.types';

/**
 * Query keys for families
 */
export const familiesQueryKeys = {
  all: ['families'] as const,
  lists: () => [...familiesQueryKeys.all, 'list'] as const,
  list: (filters: string) => [...familiesQueryKeys.lists(), { filters }] as const,
  details: () => [...familiesQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...familiesQueryKeys.details(), id] as const,
  search: (query: string) => [...familiesQueryKeys.all, 'search', query] as const,
};

/**
 * Hook to fetch all families
 */
export function useFamiliesQuery() {
  return useQuery({
    queryKey: familiesQueryKeys.lists(),
    queryFn: () => familiesService.getFamilies(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch family by ID
 */
export function useFamilyQuery(id: number) {
  return useQuery({
    queryKey: familiesQueryKeys.detail(id),
    queryFn: () => familiesService.getFamilyById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to search families
 */
export function useFamiliesSearchQuery(query: string) {
  return useQuery({
    queryKey: familiesQueryKeys.search(query),
    queryFn: () => familiesService.searchFamilies(query),
    enabled: !!query && query.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook to create family
 */
export function useCreateFamilyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (family: Omit<Family, 'idFamily'>) => familiesService.createFamily(family),
    onSuccess: (newFamily) => {
      // Invalidate and refetch families list
      queryClient.invalidateQueries({ queryKey: familiesQueryKeys.lists() });
      
      // Add the new family to the cache
      queryClient.setQueryData(familiesQueryKeys.detail(newFamily.idFamily), newFamily);
    },
    onError: (error) => {
      console.error('Error creating family:', error);
    },
  });
}

/**
 * Hook to update family
 */
export function useUpdateFamilyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, family }: { id: number; family: Partial<Family> }) => 
      familiesService.updateFamily(id, family),
    onSuccess: (updatedFamily) => {
      // Update the specific family in cache
      queryClient.setQueryData(familiesQueryKeys.detail(updatedFamily.idFamily), updatedFamily);
      
      // Invalidate families list to ensure consistency
      queryClient.invalidateQueries({ queryKey: familiesQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('Error updating family:', error);
    },
  });
}

/**
 * Hook to delete family
 */
export function useDeleteFamilyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => familiesService.deleteFamily(id),
    onSuccess: (_, deletedId) => {
      // Remove the family from cache
      queryClient.removeQueries({ queryKey: familiesQueryKeys.detail(deletedId) });
      
      // Invalidate families list
      queryClient.invalidateQueries({ queryKey: familiesQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('Error deleting family:', error);
    },
  });
}

/**
 * Hook to get families with search functionality
 */
export function useFamiliesWithSearch() {
  const familiesQuery = useFamiliesQuery();
  
  return {
    families: familiesQuery.data || [],
    isLoading: familiesQuery.isLoading,
    isError: familiesQuery.isError,
    error: familiesQuery.error,
    refetch: familiesQuery.refetch,
  };
}

/**
 * Hook to get family suggestions for autocomplete
 */
export function useFamilySuggestions(query: string) {
  const searchQuery = useFamiliesSearchQuery(query);
  const allFamiliesQuery = useFamiliesQuery();

  return {
    suggestions: searchQuery.data || allFamiliesQuery.data || [],
    isLoading: searchQuery.isLoading || allFamiliesQuery.isLoading,
    isError: searchQuery.isError || allFamiliesQuery.isError,
    error: searchQuery.error || allFamiliesQuery.error,
  };
}
