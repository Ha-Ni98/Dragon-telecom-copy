import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import {
  PricingUpdates,
  ProductUpdateResponse,
  validatePricingData,
} from '@/types/draft-types/admin-product-information.types';
import { adminProductInformationService } from '@/lib/services/admin-product-information.service';

/**
 * Hook to update product pricing
 */
export function useUpdateProductPricing(productId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation<ProductUpdateResponse, Error, PricingUpdates, { previousProduct: unknown }>({
    mutationFn: async (updates: PricingUpdates) => {
      // Validate pricing data before update
      if (updates.noUserPrice !== undefined) {
        const validation = validatePricingData(updates.noUserPrice);
        if (!validation.isValid) {
          throw new Error(validation.error);
        }
      }

      // Validate category prices if provided
      if (updates.categoryPrices) {
        for (const categoryPrice of updates.categoryPrices) {
          if (categoryPrice.price !== undefined) {
            const validation = validatePricingData(categoryPrice.price);
            if (!validation.isValid) {
              throw new Error(validation.error);
            }
          }
        }
      }

      const response = await adminProductInformationService.updateProductPricing(productId, updates);
      if (!response.success) {
        throw new Error(response.message || 'Failed to update pricing');
      }
      return response;
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-product-information', productId] });

      // Snapshot the previous value
      const previousProduct = queryClient.getQueryData(['admin-product-information', productId]);

      // Optimistically update the pricing
      if (previousProduct) {
        queryClient.setQueryData(['admin-product-information', productId], {
          ...previousProduct,
          ...updates,
        });
      }

      return { previousProduct };
    },
    onError: (error, updates, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousProduct) {
        queryClient.setQueryData(['admin-product-information', productId], context.previousProduct);
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
 * Hook to manage product pricing with validation and optimistic updates
 */
export function useProductPricing(productId: number) {
  const updateMutation = useUpdateProductPricing(productId);

  const updatePricing = async (updates: PricingUpdates) => {
    try {
      await updateMutation.mutateAsync(updates);
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Pricing update failed:', error);
    }
  };

  const updateNoUserPrice = async (noUserPrice: number) => {
    await updatePricing({ noUserPrice });
  };

  const updateCategoryPrices = async (categoryPrices: Record<number, number>) => {
    const pricingUpdates = Object.entries(categoryPrices).map(([categoryId, price]) => ({
      idCategory: parseInt(categoryId),
      price,
    }));
    
    await updatePricing({ categoryPrices: pricingUpdates });
  };

  const updateBulkPricing = async (updates: {
    noUserPrice?: number;
    categoryPrices?: Record<number, number>;
  }) => {
    const pricingUpdates: PricingUpdates = {};
    
    if (updates.noUserPrice !== undefined) {
      pricingUpdates.noUserPrice = updates.noUserPrice;
    }
    
    if (updates.categoryPrices) {
      pricingUpdates.categoryPrices = Object.entries(updates.categoryPrices).map(([categoryId, price]) => ({
        idCategory: parseInt(categoryId),
        price,
      }));
    }
    
    await updatePricing(pricingUpdates);
  };

  return {
    updatePricing,
    updateNoUserPrice,
    updateCategoryPrices,
    updateBulkPricing,
    isUpdating: updateMutation.isPending,
    error: updateMutation.error?.message,
  };
}