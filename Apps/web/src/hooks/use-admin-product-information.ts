import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import {
  AdminProductWithFullDetails,
  ProductInformationFormData,
} from '@/types/draft-types/admin-product-information.types';
import { getAdminProductFullDetails, updateAdminProductInformation } from '@/services/catalog.service';

/**
 * Hook to fetch product information with full details
 */
export function useAdminProductInformation(productId: number) {
  return useQuery({
    queryKey: ['admin-product-information', productId],
    queryFn: () => getAdminProductFullDetails(productId),
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
    AdminProductWithFullDetails,
    Error,
    ProductInformationFormData,
    { previousProduct: AdminProductWithFullDetails | null | undefined }
  >({
    mutationFn: (updates) => updateAdminProductInformation(productId, updates),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['admin-product-information', productId] });
      const previousProduct = queryClient.getQueryData<AdminProductWithFullDetails | null>([
        'admin-product-information',
        productId,
      ]);
      if (previousProduct) {
        queryClient.setQueryData<AdminProductWithFullDetails>(
          ['admin-product-information', productId],
          { ...previousProduct, ...updates, categoryPrices: previousProduct.categoryPrices },
        );
      }
      return { previousProduct };
    },
    onError: (error, _updates, context) => {
      if (context?.previousProduct !== undefined) {
        queryClient.setQueryData(['admin-product-information', productId], context.previousProduct);
      }
      toast({
        title: t('admin.productInfo.updateError'),
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({ title: t('admin.productInfo.updateSuccess') });
    },
    onSettled: () => {
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
