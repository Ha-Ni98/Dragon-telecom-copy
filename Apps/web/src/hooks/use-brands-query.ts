import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { brandsService } from '@/lib/services/brands.service';
import { Brand } from '@/types/draft-types/product.types';

/**
 * Query keys for brands
 */
export const brandsQueryKeys = {
  all: ['brands'] as const,
  lists: () => [...brandsQueryKeys.all, 'list'] as const,
  list: (filters: string) => [...brandsQueryKeys.lists(), { filters }] as const,
  details: () => [...brandsQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...brandsQueryKeys.details(), id] as const,
  search: (query: string) => [...brandsQueryKeys.all, 'search', query] as const,
  byFamily: (familyId: number) => [...brandsQueryKeys.all, 'byFamily', familyId] as const,
};

/**
 * Hook to fetch all brands
 */
export function useBrandsQuery() {
  return useQuery({
    queryKey: brandsQueryKeys.lists(),
    queryFn: () => brandsService.getBrands(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch brand by ID
 */
export function useBrandQuery(id: number) {
  return useQuery({
    queryKey: brandsQueryKeys.detail(id),
    queryFn: () => brandsService.getBrandById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to search brands
 */
export function useBrandsSearchQuery(query: string) {
  return useQuery({
    queryKey: brandsQueryKeys.search(query),
    queryFn: () => brandsService.searchBrands(query),
    enabled: !!query && query.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook to fetch brands by family
 */
export function useBrandsByFamilyQuery(familyId: number) {
  return useQuery({
    queryKey: brandsQueryKeys.byFamily(familyId),
    queryFn: () => brandsService.getBrandsByFamily(familyId),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to create brand
 */
export function useCreateBrandMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (brand: Omit<Brand, 'idBrand'>) => brandsService.createBrand(brand),
    onSuccess: (newBrand) => {
      // Invalidate and refetch brands list
      queryClient.invalidateQueries({ queryKey: brandsQueryKeys.lists() });
      
      // Add the new brand to the cache
      queryClient.setQueryData(brandsQueryKeys.detail(newBrand.idBrand), newBrand);
    },
    onError: (error) => {
      console.error('Error creating brand:', error);
    },
  });
}

/**
 * Hook to update brand
 */
export function useUpdateBrandMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, brand }: { id: number; brand: Partial<Brand> }) => 
      brandsService.updateBrand(id, brand),
    onSuccess: (updatedBrand) => {
      // Update the specific brand in cache
      queryClient.setQueryData(brandsQueryKeys.detail(updatedBrand.idBrand), updatedBrand);
      
      // Invalidate brands list to ensure consistency
      queryClient.invalidateQueries({ queryKey: brandsQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('Error updating brand:', error);
    },
  });
}

/**
 * Hook to delete brand
 */
export function useDeleteBrandMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => brandsService.deleteBrand(id),
    onSuccess: (_, deletedId) => {
      // Remove the brand from cache
      queryClient.removeQueries({ queryKey: brandsQueryKeys.detail(deletedId) });
      
      // Invalidate brands list
      queryClient.invalidateQueries({ queryKey: brandsQueryKeys.lists() });
    },
    onError: (error) => {
      console.error('Error deleting brand:', error);
    },
  });
}

/**
 * Hook to get brands with search functionality
 */
export function useBrandsWithSearch() {
  const brandsQuery = useBrandsQuery();
  
  return {
    brands: brandsQuery.data || [],
    isLoading: brandsQuery.isLoading,
    isError: brandsQuery.isError,
    error: brandsQuery.error,
    refetch: brandsQuery.refetch,
  };
}

/**
 * Hook to get brand suggestions for autocomplete
 */
export function useBrandSuggestions(query: string, familyId?: number) {
  const searchQuery = useBrandsSearchQuery(query);
  const brandsByFamilyQuery = useBrandsByFamilyQuery(familyId || 0);
  const allBrandsQuery = useBrandsQuery();

  // Determine which data to use based on whether we have a family filter
  const suggestions = familyId 
    ? (brandsByFamilyQuery.data || [])
    : (searchQuery.data || allBrandsQuery.data || []);

  const isLoading = familyId
    ? brandsByFamilyQuery.isLoading
    : (searchQuery.isLoading || allBrandsQuery.isLoading);

  const isError = familyId
    ? brandsByFamilyQuery.isError
    : (searchQuery.isError || allBrandsQuery.isError);

  const error = familyId
    ? brandsByFamilyQuery.error
    : (searchQuery.error || allBrandsQuery.error);

  return {
    suggestions,
    isLoading,
    isError,
    error,
  };
}
