import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import {
  ProductSupplierWithDetails,
  SupplierUpdateResponse,
  SupplierDeletionResponse,
  SupplierUpdates,
  SupplierModificationFormData,
} from '@/types/draft-types/admin-product-information.types';
import {
  getAdminProductSuppliers,
  updateAdminProductSupplier,
  deleteAdminProductSupplier,
} from '@/services/catalog.service';

/**
 * Hook to fetch product suppliers
 */
export function useProductSuppliers(productId: number) {
  return useQuery<ProductSupplierWithDetails[]>({
    queryKey: ['product-suppliers', productId],
    queryFn: () => getAdminProductSuppliers(productId),
    enabled: !!productId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to update supplier information
 */
export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation<SupplierUpdateResponse, Error, { supplierId: number; updates: SupplierUpdates }>({
    mutationFn: async ({ supplierId, updates }) => {
      const response = await updateAdminProductSupplier(supplierId, updates);
      if (!response.success) {
        throw new Error(response.message || 'Failed to update supplier');
      }
      return response;
    },
    onSuccess: (response, { supplierId }) => {
      // Find the product ID from the supplier data to invalidate the correct query
      const productSuppliers = queryClient.getQueriesData<ProductSupplierWithDetails[]>({
        queryKey: ['product-suppliers'],
      });
      
      // Invalidate all product supplier queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['product-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-information'] });
      
      toast({
        title: t('admin.productInfo.supplierUpdateSuccess'),
        description: response.message,
      });
    },
    onError: (error) => {
      toast({
        title: t('admin.productInfo.supplierUpdateError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete supplier
 */
export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation<SupplierDeletionResponse, Error, number>({
    mutationFn: async (supplierId: number) => {
      const response = await deleteAdminProductSupplier(supplierId);
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete supplier');
      }
      return response;
    },
    onSuccess: (response) => {
      // Invalidate all product supplier queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['product-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-information'] });
      
      toast({
        title: t('admin.productInfo.supplierDeleteSuccess'),
        description: response.message,
      });
    },
    onError: (error) => {
      toast({
        title: t('admin.productInfo.supplierDeleteError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to manage product suppliers with all operations
 */
export function useProductSuppliersManagement(productId: number) {
  const {
    data: suppliers,
    isLoading,
    error,
    refetch,
  } = useProductSuppliers(productId);

  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();

  const updateSupplier = async (supplierId: number, updates: SupplierModificationFormData) => {
    try {
      await updateMutation.mutateAsync({ supplierId, updates });
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Supplier update failed:', error);
    }
  };

  const deleteSupplier = async (supplierId: number) => {
    try {
      await deleteMutation.mutateAsync(supplierId);
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Supplier deletion failed:', error);
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleRetry = () => {
    refetch();
  };

  // Sort suppliers by issue date (most recent first)
  const sortedSuppliers = suppliers?.sort((a, b) => 
    new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
  ) || [];

  return {
    suppliers: sortedSuppliers,
    isLoading,
    error: error?.message || null,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    updateSupplier,
    deleteSupplier,
    refresh: handleRefresh,
    retry: handleRetry,
  };
}
