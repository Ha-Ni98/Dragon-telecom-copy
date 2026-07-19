import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { supplierInformationService } from '@/lib/services/supplier-information.service';
import { 
  SupplierWithDetails, 
  SupplierFormData, 
  ProductSupplyHistory 
} from '@/types/draft-types/admin-suppliers.types';
import { SupplierInvoice } from '@/types/draft-types/supplier.types';

/**
 * Query keys for supplier information
 */
export const supplierInformationQueryKeys = {
  all: ['supplier-information'] as const,
  supplier: (id: number) => [...supplierInformationQueryKeys.all, 'supplier', id] as const,
  invoices: (id: number) => [...supplierInformationQueryKeys.all, 'invoices', id] as const,
  productHistory: (id: number) => [...supplierInformationQueryKeys.all, 'product-history', id] as const,
};

/**
 * Hook to fetch supplier details
 */
export function useSupplierDetails(supplierId: number) {
  return useQuery<SupplierWithDetails | null>({
    queryKey: supplierInformationQueryKeys.supplier(supplierId),
    queryFn: () => supplierInformationService.getSupplierWithDetails(supplierId),
    enabled: !!supplierId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch supplier invoices
 */
export function useSupplierInvoices(supplierId: number) {
  return useQuery<SupplierInvoice[]>({
    queryKey: supplierInformationQueryKeys.invoices(supplierId),
    queryFn: () => supplierInformationService.getSupplierInvoices(supplierId),
    enabled: !!supplierId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch supplier product history
 */
export function useSupplierProductHistory(supplierId: number) {
  return useQuery<ProductSupplyHistory[]>({
    queryKey: supplierInformationQueryKeys.productHistory(supplierId),
    queryFn: () => supplierInformationService.getSupplierProductHistory(supplierId),
    enabled: !!supplierId,
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

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SupplierFormData }) =>
      supplierInformationService.updateSupplier(id, data),
    onSuccess: (data, variables) => {
      // Update the supplier details cache
      queryClient.setQueryData(
        supplierInformationQueryKeys.supplier(variables.id),
        data
      );
      
      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({
        queryKey: supplierInformationQueryKeys.invoices(variables.id)
      });
      
      toast({
        title: t('common.success'),
        description: t('admin.suppliers.updateSuccess'),
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Supplier update failed:', error);
      toast({
        title: t('common.error'),
        description: t('admin.suppliers.updateError'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete supplier invoice
 */
export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (invoiceId: number) =>
      supplierInformationService.deleteSupplierInvoice(invoiceId),
    onSuccess: (_, invoiceId) => {
      // Find which supplier this invoice belongs to and invalidate their data
      const supplierId = findSupplierIdByInvoiceId(invoiceId);
      if (supplierId) {
        queryClient.invalidateQueries({
          queryKey: supplierInformationQueryKeys.supplier(supplierId)
        });
        queryClient.invalidateQueries({
          queryKey: supplierInformationQueryKeys.invoices(supplierId)
        });
      }
      
      toast({
        title: t('common.success'),
        description: t('admin.suppliers.invoiceDeleteSuccess'),
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Invoice deletion failed:', error);
      toast({
        title: t('common.error'),
        description: t('admin.suppliers.invoiceDeleteError'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Helper function to find supplier ID by invoice ID
 * In a real app, this would be handled by the backend
 */
function findSupplierIdByInvoiceId(invoiceId: number): number | null {
  // This is a simplified implementation for mock data
  // In a real app, the backend would return the supplier ID
  const supplierIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  return supplierIds[invoiceId % supplierIds.length] || null;
}

/**
 * Comprehensive hook for supplier information page
 * Combines all data fetching and mutations
 */
export function useSupplierInformation(supplierId: number) {
  const {
    data: supplier,
    isLoading: supplierLoading,
    error: supplierError,
    refetch: refetchSupplier,
  } = useSupplierDetails(supplierId);

  const {
    data: invoices,
    isLoading: invoicesLoading,
    error: invoicesError,
    refetch: refetchInvoices,
  } = useSupplierInvoices(supplierId);

  const {
    data: productHistory,
    isLoading: productHistoryLoading,
    error: productHistoryError,
    refetch: refetchProductHistory,
  } = useSupplierProductHistory(supplierId);

  const updateMutation = useUpdateSupplier();
  const deleteInvoiceMutation = useDeleteInvoice();

  const isLoading = supplierLoading || invoicesLoading || productHistoryLoading;
  const error = supplierError || invoicesError || productHistoryError;

  const updateSupplier = async (data: SupplierFormData) => {
    try {
      await updateMutation.mutateAsync({ id: supplierId, data });
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Supplier update failed:', error);
    }
  };

  const deleteInvoice = async (invoiceId: number) => {
    try {
      await deleteInvoiceMutation.mutateAsync(invoiceId);
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Invoice deletion failed:', error);
    }
  };

  const refresh = () => {
    refetchSupplier();
    refetchInvoices();
    refetchProductHistory();
  };

  return {
    // Data
    supplier,
    invoices,
    productHistory,
    
    // Loading states
    isLoading,
    supplierLoading,
    invoicesLoading,
    productHistoryLoading,
    
    // Error states
    error,
    supplierError,
    invoicesError,
    productHistoryError,
    
    // Mutations
    updateSupplier,
    deleteInvoice,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteInvoiceMutation.isPending,
    
    // Actions
    refresh,
    refetchSupplier,
    refetchInvoices,
    refetchProductHistory,
  };
}
