/**
 * Admin Settings Hooks
 * Custom hooks for admin settings state management and API interactions
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminSettingsService } from '@/lib/services/admin-settings.service';
import {
  AdminAccountWithDetails,
  AdminAccountFormData,
  ClientCategory,
  ClientCategoryFormData,
  Family,
  FamilyFormData,
  Brand,
  BrandFormData,
  Model,
  ModelFormData,
  DeliveryFee,
  DeliveryFeeFormData,
  ExcelImportResult,
  ServiceResponse
} from '@/types/draft-types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const adminSettingsQueryKeys = {
  all: ['admin-settings'] as const,
  adminAccounts: () => [...adminSettingsQueryKeys.all, 'admin-accounts'] as const,
  clientCategories: () => [...adminSettingsQueryKeys.all, 'client-categories'] as const,
  families: () => [...adminSettingsQueryKeys.all, 'families'] as const,
  brands: () => [...adminSettingsQueryKeys.all, 'brands'] as const,
  models: () => [...adminSettingsQueryKeys.all, 'models'] as const,
  deliveryFees: () => [...adminSettingsQueryKeys.all, 'delivery-fees'] as const,
};

// ============================================================================
// ADMIN ACCOUNTS HOOKS
// ============================================================================

/**
 * Hook to fetch all admin accounts
 */
export function useAdminAccounts(
  options?: Partial<UseQueryOptions<AdminAccountWithDetails[]>>
) {
  return useQuery({
    queryKey: adminSettingsQueryKeys.adminAccounts(),
    queryFn: () => AdminSettingsService.getAdminAccounts(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to create a new admin account
 */
export function useCreateAdminAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminAccountFormData) => AdminSettingsService.createAdminAccount(data),
    onSuccess: (response: ServiceResponse<AdminAccountWithDetails>) => {
      if (response.success) {
        // Invalidate and refetch admin accounts
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.adminAccounts() });
        
        toast.success('Admin account created successfully', {
          description: `Account "${response.data?.userName}" has been created.`
        });
      } else {
        toast.error('Failed to create admin account', {
          description: response.message || 'An error occurred while creating the account.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error creating admin account:', error);
      toast.error('Failed to create admin account', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to update an existing admin account
 */
export function useUpdateAdminAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AdminAccountFormData }) => 
      AdminSettingsService.updateAdminAccount(id, data),
    onSuccess: (response: ServiceResponse<AdminAccountWithDetails>, variables) => {
      if (response.success) {
        // Invalidate and refetch admin accounts
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.adminAccounts() });
        
        toast.success('Admin account updated successfully', {
          description: `Account "${response.data?.userName}" has been updated.`
        });
      } else {
        toast.error('Failed to update admin account', {
          description: response.message || 'An error occurred while updating the account.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error updating admin account:', error);
      toast.error('Failed to update admin account', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to delete an admin account
 */
export function useDeleteAdminAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => AdminSettingsService.deleteAdminAccount(id),
    onSuccess: (response: ServiceResponse<void>, id) => {
      if (response.success) {
        // Invalidate and refetch admin accounts
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.adminAccounts() });
        
        toast.success('Admin account deleted successfully', {
          description: 'The admin account has been removed.'
        });
      } else {
        toast.error('Failed to delete admin account', {
          description: response.message || 'An error occurred while deleting the account.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error deleting admin account:', error);
      toast.error('Failed to delete admin account', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

// ============================================================================
// CLIENT CATEGORIES HOOKS
// ============================================================================

/**
 * Hook to fetch all client categories
 */
export function useClientCategories(
  options?: Partial<UseQueryOptions<ClientCategory[]>>
) {
  return useQuery({
    queryKey: adminSettingsQueryKeys.clientCategories(),
    queryFn: () => AdminSettingsService.getClientCategories(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to create a new client category
 */
export function useCreateClientCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClientCategoryFormData) => AdminSettingsService.createClientCategory(data),
    onSuccess: (response: ServiceResponse<ClientCategory>) => {
      if (response.success) {
        // Invalidate and refetch client categories
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.clientCategories() });
        
        toast.success('Client category created successfully', {
          description: `Category "${response.data?.categoryName}" has been created.`
        });
      } else {
        toast.error('Failed to create client category', {
          description: response.message || 'An error occurred while creating the category.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error creating client category:', error);
      toast.error('Failed to create client category', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to update an existing client category
 */
export function useUpdateClientCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ClientCategoryFormData }) => 
      AdminSettingsService.updateClientCategory(id, data),
    onSuccess: (response: ServiceResponse<ClientCategory>) => {
      if (response.success) {
        // Invalidate and refetch client categories
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.clientCategories() });
        
        toast.success('Client category updated successfully', {
          description: `Category "${response.data?.categoryName}" has been updated.`
        });
      } else {
        toast.error('Failed to update client category', {
          description: response.message || 'An error occurred while updating the category.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error updating client category:', error);
      toast.error('Failed to update client category', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to delete a client category
 */
export function useDeleteClientCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => AdminSettingsService.deleteClientCategory(id),
    onSuccess: (response: ServiceResponse<void>) => {
      if (response.success) {
        // Invalidate and refetch client categories
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.clientCategories() });
        
        toast.success('Client category deleted successfully', {
          description: 'The client category has been removed.'
        });
      } else {
        toast.error('Failed to delete client category', {
          description: response.message || 'An error occurred while deleting the category.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error deleting client category:', error);
      toast.error('Failed to delete client category', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

// ============================================================================
// PRODUCT HIERARCHY HOOKS
// ============================================================================

/**
 * Hook to fetch all product families
 */
export function useFamilies(
  options?: Partial<UseQueryOptions<Family[]>>
) {
  return useQuery({
    queryKey: adminSettingsQueryKeys.families(),
    queryFn: () => AdminSettingsService.getFamilies(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to create a new product family
 */
export function useCreateFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FamilyFormData) => AdminSettingsService.createFamily(data),
    onSuccess: (response: ServiceResponse<Family>) => {
      if (response.success) {
        // Invalidate and refetch families
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.families() });
        
        toast.success('Product family created successfully', {
          description: `Family "${response.data?.familyName}" has been created.`
        });
      } else {
        toast.error('Failed to create product family', {
          description: response.message || 'An error occurred while creating the family.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error creating product family:', error);
      toast.error('Failed to create product family', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to update an existing product family
 */
export function useUpdateFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FamilyFormData }) => 
      AdminSettingsService.updateFamily(id, data),
    onSuccess: (response: ServiceResponse<Family>) => {
      if (response.success) {
        // Invalidate and refetch families
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.families() });
        
        toast.success('Product family updated successfully', {
          description: `Family "${response.data?.familyName}" has been updated.`
        });
      } else {
        toast.error('Failed to update product family', {
          description: response.message || 'An error occurred while updating the family.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error updating product family:', error);
      toast.error('Failed to update product family', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to delete a product family
 */
export function useDeleteFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => AdminSettingsService.deleteFamily(id),
    onSuccess: (response: ServiceResponse<void>) => {
      if (response.success) {
        // Invalidate and refetch families
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.families() });
        
        toast.success('Product family deleted successfully', {
          description: 'The product family has been removed.'
        });
      } else {
        toast.error('Failed to delete product family', {
          description: response.message || 'An error occurred while deleting the family.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error deleting product family:', error);
      toast.error('Failed to delete product family', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to fetch all product brands
 */
export function useBrands(
  options?: Partial<UseQueryOptions<Brand[]>>
) {
  return useQuery({
    queryKey: adminSettingsQueryKeys.brands(),
    queryFn: () => AdminSettingsService.getBrands(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to create a new product brand
 */
export function useCreateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BrandFormData) => AdminSettingsService.createBrand(data),
    onSuccess: (response: ServiceResponse<Brand>) => {
      if (response.success) {
        // Invalidate and refetch brands
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.brands() });
        
        toast.success('Product brand created successfully', {
          description: `Brand "${response.data?.brandName}" has been created.`
        });
      } else {
        toast.error('Failed to create product brand', {
          description: response.message || 'An error occurred while creating the brand.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error creating product brand:', error);
      toast.error('Failed to create product brand', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to update an existing product brand
 */
export function useUpdateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BrandFormData }) => 
      AdminSettingsService.updateBrand(id, data),
    onSuccess: (response: ServiceResponse<Brand>) => {
      if (response.success) {
        // Invalidate and refetch brands
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.brands() });
        
        toast.success('Product brand updated successfully', {
          description: `Brand "${response.data?.brandName}" has been updated.`
        });
      } else {
        toast.error('Failed to update product brand', {
          description: response.message || 'An error occurred while updating the brand.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error updating product brand:', error);
      toast.error('Failed to update product brand', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to delete a product brand
 */
export function useDeleteBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => AdminSettingsService.deleteBrand(id),
    onSuccess: (response: ServiceResponse<void>) => {
      if (response.success) {
        // Invalidate and refetch brands
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.brands() });
        
        toast.success('Product brand deleted successfully', {
          description: 'The product brand has been removed.'
        });
      } else {
        toast.error('Failed to delete product brand', {
          description: response.message || 'An error occurred while deleting the brand.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error deleting product brand:', error);
      toast.error('Failed to delete product brand', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to fetch all product models
 */
export function useModels(
  options?: Partial<UseQueryOptions<Model[]>>
) {
  return useQuery({
    queryKey: adminSettingsQueryKeys.models(),
    queryFn: () => AdminSettingsService.getModels(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to create a new product model
 */
export function useCreateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ModelFormData) => AdminSettingsService.createModel(data),
    onSuccess: (response: ServiceResponse<Model>) => {
      if (response.success) {
        // Invalidate and refetch models
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.models() });
        
        toast.success('Product model created successfully', {
          description: `Model "${response.data?.modelName}" has been created.`
        });
      } else {
        toast.error('Failed to create product model', {
          description: response.message || 'An error occurred while creating the model.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error creating product model:', error);
      toast.error('Failed to create product model', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to update an existing product model
 */
export function useUpdateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ModelFormData }) => 
      AdminSettingsService.updateModel(id, data),
    onSuccess: (response: ServiceResponse<Model>) => {
      if (response.success) {
        // Invalidate and refetch models
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.models() });
        
        toast.success('Product model updated successfully', {
          description: `Model "${response.data?.modelName}" has been updated.`
        });
      } else {
        toast.error('Failed to update product model', {
          description: response.message || 'An error occurred while updating the model.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error updating product model:', error);
      toast.error('Failed to update product model', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to delete a product model
 */
export function useDeleteModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => AdminSettingsService.deleteModel(id),
    onSuccess: (response: ServiceResponse<void>) => {
      if (response.success) {
        // Invalidate and refetch models
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.models() });
        
        toast.success('Product model deleted successfully', {
          description: 'The product model has been removed.'
        });
      } else {
        toast.error('Failed to delete product model', {
          description: response.message || 'An error occurred while deleting the model.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error deleting product model:', error);
      toast.error('Failed to delete product model', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

// ============================================================================
// DELIVERY FEES HOOKS
// ============================================================================

/**
 * Hook to fetch all delivery fees
 */
export function useDeliveryFees(
  options?: Partial<UseQueryOptions<DeliveryFee[]>>
) {
  return useQuery({
    queryKey: adminSettingsQueryKeys.deliveryFees(),
    queryFn: () => AdminSettingsService.getDeliveryFees(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * Hook to import delivery fees from Excel file
 */
export function useImportDeliveryFees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => AdminSettingsService.importDeliveryFees(file),
    onSuccess: (response: ExcelImportResult) => {
      if (response.success) {
        // Invalidate and refetch delivery fees
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.deliveryFees() });
        
        toast.success('Delivery fees imported successfully', {
          description: response.message || `Successfully imported ${response.data?.length || 0} entries.`
        });
      } else {
        toast.error('Failed to import delivery fees', {
          description: response.message || 'An error occurred while importing the file.'
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error importing delivery fees:', error);
      toast.error('Failed to import delivery fees', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

/**
 * Hook to export delivery fees to Excel file
 */
export function useExportDeliveryFees() {
  return useMutation({
    mutationFn: () => AdminSettingsService.exportDeliveryFees(),
    onSuccess: () => {
      toast.success('Delivery fees exported successfully', {
        description: 'The Excel file has been generated and downloaded.'
      });
    },
    onError: (error: Error) => {
      console.error('Error exporting delivery fees:', error);
      toast.error('Failed to export delivery fees', {
        description: 'An unexpected error occurred. Please try again.'
      });
    },
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to refresh all admin settings data
 */
export function useRefreshAdminSettings() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.all });
  };
}

/**
 * Hook to get loading state for any admin settings operation
 */
export function useAdminSettingsLoading() {
  const adminAccountsQuery = useAdminAccounts();
  const clientCategoriesQuery = useClientCategories();
  const familiesQuery = useFamilies();
  const brandsQuery = useBrands();
  const modelsQuery = useModels();
  const deliveryFeesQuery = useDeliveryFees();

  return {
    adminAccounts: adminAccountsQuery.isLoading,
    clientCategories: clientCategoriesQuery.isLoading,
    families: familiesQuery.isLoading,
    brands: brandsQuery.isLoading,
    models: modelsQuery.isLoading,
    deliveryFees: deliveryFeesQuery.isLoading,
    anyLoading: [
      adminAccountsQuery.isLoading,
      clientCategoriesQuery.isLoading,
      familiesQuery.isLoading,
      brandsQuery.isLoading,
      modelsQuery.isLoading,
      deliveryFeesQuery.isLoading
    ].some(Boolean)
  };
}
