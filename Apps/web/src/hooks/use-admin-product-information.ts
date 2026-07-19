import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import {
  AdminProductWithFullDetails,
  ProductInformationServiceResponse,
  ProductUpdateResponse,
  ProductInformationFormData,
} from '@/types/draft-types/admin-product-information.types';
import { adminProductInformationService } from '@/lib/services/admin-product-information.service';

/**
 * Hook to fetch product information with full details
 */
export function useAdminProductInformation(productId: number) {
  return useQuery<AdminProductWithFullDetails>({
    queryKey: ['admin-product-information', productId],
    queryFn: async () => {
      const response = await adminProductInformationService.getProductWithFullDetails(productId);
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch product information');
      }
      return response.product;
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to update product information with optimistic updates
 */
export function useUpdateProductInformation(productId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation<
    ProductUpdateResponse,
    Error,
    ProductInformationFormData,
    { previousProduct: AdminProductWithFullDetails | undefined }
  >({
    mutationFn: async (updates: ProductInformationFormData) => {
      // categoryPrices shapes differ (form: {categoryId: price} map; entity: array) — no
      // transform exists in the source MVP (Sub-01 Sprint 1 finding); a real mapping lands
      // with the Sub-02 catalog-pricing integration.
      const response = await adminProductInformationService.updateProduct(
        productId,
        updates as Partial<AdminProductWithFullDetails>,
      );
      if (!response.success) {
        throw new Error(response.message || 'Failed to update product');
      }
      return response;
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-product-information', productId] });

      // Snapshot the previous value
      const previousProduct = queryClient.getQueryData<AdminProductWithFullDetails>([
        'admin-product-information',
        productId,
      ]);

      // Optimistically update to the new value. categoryPrices keeps its previous (array)
      // shape — the form edits it as a {categoryId: price} map, a different representation
      // the real update endpoint reconciles server-side; this optimistic snapshot just isn't
      // the place to guess that transform.
      if (previousProduct) {
        queryClient.setQueryData<AdminProductWithFullDetails>(
          ['admin-product-information', productId],
          {
            ...previousProduct,
            ...updates,
            categoryPrices: previousProduct.categoryPrices,
          }
        );
      }

      // Return a context object with the snapshotted value
      return { previousProduct };
    },
    onError: (error, updates, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousProduct) {
        queryClient.setQueryData(
          ['admin-product-information', productId],
          context.previousProduct
        );
      }
      toast({
        title: t('admin.productInfo.updateError'),
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: (response) => {
      toast({
        title: t('admin.productInfo.updateSuccess'),
        description: response.message,
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryClient.invalidateQueries({ queryKey: ['admin-product-information', productId] });
    },
  });
}

/**
 * Hook to refresh product information data
 */
export function useRefreshProductInformation() {
  const queryClient = useQueryClient();

  const refreshProduct = (productId: number) => {
    queryClient.invalidateQueries({ queryKey: ['admin-product-information', productId] });
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-product-information'] });
  };

  return {
    refreshProduct,
    refreshAll,
  };
}

/**
 * Hook to manage product information page state
 */
export function useProductInformationPageState(productId: number) {
  const {
    data: product,
    isLoading,
    error,
    refetch,
  } = useAdminProductInformation(productId);

  const updateMutation = useUpdateProductInformation(productId);
  const { refreshProduct } = useRefreshProductInformation();

  const handleRefresh = () => {
    refreshProduct(productId);
  };

  const handleRetry = () => {
    refetch();
  };

  return {
    product,
    isLoading,
    error: error?.message || null,
    isUpdating: updateMutation.isPending,
    updateProduct: updateMutation.mutate,
    refresh: handleRefresh,
    retry: handleRetry,
  };
}
