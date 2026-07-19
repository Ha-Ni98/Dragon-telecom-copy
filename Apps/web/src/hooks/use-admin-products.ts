import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminProductWithDetails, AdminProductsStats, AdminProductsFilters, AdminProductsPaginatedResponse } from '@/types/draft-types/admin.types';
import { adminProductsService } from '@/lib/services/admin-products.service';

/**
 * Hook to fetch admin products with filtering and pagination
 */
export function useAdminProducts(filters?: AdminProductsFilters) {
  return useQuery<AdminProductsPaginatedResponse>({
    queryKey: ['admin-products', filters],
    queryFn: () => adminProductsService.getProducts(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch admin products statistics
 */
export function useAdminProductsStats() {
  return useQuery({
    queryKey: ['admin-products-stats'],
    queryFn: adminProductsService.getProductsStats,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch a single product by ID
 */
export function useAdminProduct(productId: number) {
  return useQuery({
    queryKey: ['admin-product', productId],
    queryFn: () => adminProductsService.getProductById(productId),
    enabled: !!productId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch products by stock status
 */
export function useAdminProductsByStockStatus(status: 'in_stock' | 'low_stock' | 'out_of_stock') {
  return useQuery({
    queryKey: ['admin-products-by-status', status],
    queryFn: () => adminProductsService.getProductsByStockStatus(status),
    staleTime: 1000 * 60 * 3, // 3 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to search products
 */
export function useAdminProductsSearch(query: string, filters?: Omit<AdminProductsFilters, 'searchQuery'>) {
  return useQuery({
    queryKey: ['admin-products-search', query, filters],
    queryFn: () => adminProductsService.searchProducts(query, filters),
    enabled: query.length >= 2, // Only search if query is at least 2 characters
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to delete a product
 */
export function useDeleteAdminProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: number) => adminProductsService.deleteProduct(productId),
    onSuccess: () => {
      // Invalidate and refetch all admin products queries
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products-by-status'] });
    },
    onError: (error) => {
      console.error('Failed to delete product:', error);
    },
  });
}

/**
 * Hook to update product stock
 */
export function useUpdateAdminProductStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, newQuantity }: { productId: number; newQuantity: number }) =>
      adminProductsService.updateProductStock(productId, newQuantity),
    onSuccess: (_, { productId }) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products-by-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product', productId] });
    },
    onError: (error) => {
      console.error('Failed to update product stock:', error);
    },
  });
}

/**
 * Hook to manage admin products filters state
 */
export function useAdminProductsFilters() {
  const queryClient = useQueryClient();

  const setFilters = (filters: AdminProductsFilters) => {
    // This would typically be managed by a state management solution
    // For now, we'll just trigger a refetch with new filters
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
  };

  const clearFilters = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
  };

  return {
    setFilters,
    clearFilters,
  };
}

/**
 * Hook to refresh admin products data
 */
export function useRefreshAdminProducts() {
  const queryClient = useQueryClient();

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    queryClient.invalidateQueries({ queryKey: ['admin-products-stats'] });
    queryClient.invalidateQueries({ queryKey: ['admin-products-by-status'] });
  };

  const refreshStats = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-products-stats'] });
  };

  const refreshProducts = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
  };

  return {
    refreshAll,
    refreshStats,
    refreshProducts,
  };
}
