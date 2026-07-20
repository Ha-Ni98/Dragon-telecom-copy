import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminProductsFilters } from '@/types/draft-types/admin.types';
import { SupplyFormData } from '@/types/draft-types/admin-supply.types';
import {
  getAdminProducts,
  getAdminProductsStats,
  getAdminProductById,
  getAdminProductsByStockStatus,
  searchAdminProducts,
  deleteAdminProduct,
  updateAdminProductStock,
  addAdminProductSupply,
} from '@/services/catalog.service';
import { qk, qkLegacy } from '@/lib/query-keys';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Hook to fetch admin products with filtering and pagination
 */
export function useAdminProducts(filters?: AdminProductsFilters) {
  return useQuery({
    queryKey: qk.catalog.adminProducts.list(filters),
    queryFn: () => getAdminProducts(filters),
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
    queryKey: qkLegacy.catalogAdminProductsStats(),
    queryFn: getAdminProductsStats,
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
    queryKey: qkLegacy.catalogAdminProductDetail(productId),
    queryFn: () => getAdminProductById(productId),
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
    queryKey: qkLegacy.catalogAdminProductsByStatus(status),
    queryFn: () => getAdminProductsByStockStatus(status),
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
    queryKey: qkLegacy.catalogAdminProductsSearch(query, filters),
    queryFn: () => searchAdminProducts(query, filters),
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
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (productId: number) => deleteAdminProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
      toast.success(t('admin.products.deleteSuccess'), {
        description: t('admin.products.deleteSuccessDescription'),
      });
    },
    onError: () => {
      toast.error(t('admin.products.deleteError'), {
        description: t('admin.products.deleteErrorDescription'),
      });
    },
  });
}

/**
 * Hook to add stock supply to a product from a supplier
 */
export function useAddAdminProductSupply() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ productId, supply }: { productId: number; supply: SupplyFormData }) =>
      addAdminProductSupply(productId, supply),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
      queryClient.invalidateQueries({ queryKey: qkLegacy.catalogAdminProductDetail(productId) });
      toast.success(t('admin.supply.success'), {
        description: t('admin.supply.successDescription'),
      });
    },
    onError: () => {
      toast.error(t('admin.supply.error'), {
        description: t('admin.supply.errorDescription'),
      });
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
      updateAdminProductStock(productId, newQuantity),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
      queryClient.invalidateQueries({ queryKey: qkLegacy.catalogAdminProductDetail(productId) });
    },
  });
}

/**
 * Hook to manage admin products filters state
 */
export function useAdminProductsFilters() {
  const queryClient = useQueryClient();

  const setFilters = (_filters: AdminProductsFilters) => {
    queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.list() });
  };

  const clearFilters = () => {
    queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.list() });
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
    queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
  };

  const refreshStats = () => {
    queryClient.invalidateQueries({ queryKey: qkLegacy.catalogAdminProductsStats() });
  };

  const refreshProducts = () => {
    queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.list() });
  };

  return {
    refreshAll,
    refreshStats,
    refreshProducts,
  };
}
