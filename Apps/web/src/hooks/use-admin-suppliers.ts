/**
 * Custom hooks for Admin Suppliers page
 * Provides data fetching, state management, and CRUD operations for suppliers
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  SupplierFormData, 
  InvoiceFormData,
  AdminSuppliersFilters
} from '@/types/draft-types/admin-suppliers.types';
import { AdminSuppliersService } from '@/lib/services/admin-suppliers.service';

/**
 * Hook for fetching suppliers with pagination and filtering
 */
export function useAdminSuppliers(filters: AdminSuppliersFilters) {
  return useQuery({
    queryKey: ['admin-suppliers', filters],
    queryFn: () => AdminSuppliersService.getSuppliers(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for fetching suppliers statistics
 */
export function useAdminSuppliersStats() {
  return useQuery({
    queryKey: ['admin-suppliers-stats'],
    queryFn: () => AdminSuppliersService.getSuppliersStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for creating a new supplier
 */
export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SupplierFormData) => AdminSuppliersService.createSupplier(data),
    onSuccess: () => {
      // Invalidate and refetch suppliers data
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers-stats'] });
    },
    onError: (error) => {
      console.error('Error creating supplier:', error);
    },
  });
}

/**
 * Hook for updating an existing supplier
 */
export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SupplierFormData> }) => 
      AdminSuppliersService.updateSupplier(id, data),
    onSuccess: () => {
      // Invalidate and refetch suppliers data
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers-stats'] });
    },
    onError: (error) => {
      console.error('Error updating supplier:', error);
    },
  });
}

/**
 * Hook for deleting a supplier
 */
export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => AdminSuppliersService.deleteSupplier(id),
    onSuccess: () => {
      // Invalidate and refetch suppliers data
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers-stats'] });
    },
    onError: (error) => {
      console.error('Error deleting supplier:', error);
    },
  });
}

/**
 * Hook for adding an invoice to a supplier
 */
export function useAddInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ supplierId, data }: { supplierId: number; data: InvoiceFormData }) => 
      AdminSuppliersService.addInvoice(supplierId, data),
    onSuccess: () => {
      // Invalidate and refetch suppliers data
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers-stats'] });
    },
    onError: (error) => {
      console.error('Error adding invoice:', error);
    },
  });
}

/**
 * Hook for searching suppliers
 */
export function useAdminSuppliersSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (query: string) => {
      // This would typically call a search API endpoint
      // For now, we'll use the existing getSuppliers with search filter
      return AdminSuppliersService.getSuppliers({ searchQuery: query, page: 1, limit: 10 });
    },
    onSuccess: (data) => {
      // Update the cache with search results
      queryClient.setQueryData(['admin-suppliers-search'], data);
    },
    onError: (error) => {
      console.error('Error searching suppliers:', error);
    },
  });
}

/**
 * Hook for refreshing all suppliers data
 */
export function useRefreshSuppliers() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['admin-suppliers-stats'] });
  };
}

/**
 * Hook for getting a specific supplier by ID
 */
export function useSupplierById(id: number) {
  return useQuery({
    queryKey: ['admin-supplier', id],
    queryFn: () => {
      // This would typically call a getSupplierById API endpoint
      // For now, we'll return null as this is not implemented in the service
      return Promise.resolve(null);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for bulk operations on suppliers
 */
export function useBulkSupplierOperations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (operations: Array<{ type: 'delete' | 'update'; id: number; data?: any }>) => {
      const results = [];
      for (const operation of operations) {
        try {
          if (operation.type === 'delete') {
            await AdminSuppliersService.deleteSupplier(operation.id);
          } else if (operation.type === 'update') {
            await AdminSuppliersService.updateSupplier(operation.id, operation.data);
          }
          results.push({ success: true, id: operation.id });
        } catch (error) {
          results.push({ success: false, id: operation.id, error });
        }
      }
      return results;
    },
    onSuccess: () => {
      // Invalidate and refetch all suppliers data
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers-stats'] });
    },
    onError: (error) => {
      console.error('Error performing bulk operations:', error);
    },
  });
}
