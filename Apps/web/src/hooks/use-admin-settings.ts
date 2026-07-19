/**
 * Admin Settings Hooks
 * Custom hooks for admin settings state management and API interactions
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
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
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: AdminAccountFormData) => AdminSettingsService.createAdminAccount(data),
    onSuccess: (response: ServiceResponse<AdminAccountWithDetails>) => {
      if (response.success) {
        // Invalidate and refetch admin accounts
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.adminAccounts() });
        
        toast.success(t('common.crud.createSuccess', { entity: t('admin.settings.entities.adminAccount') }), {
          description: t('common.crud.namedCreatedBody', { item: t('common.nouns.account'), name: response.data?.userName ?? '' })
        });
      } else {
        toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.adminAccount') }), {
          description: response.message || t('common.crud.createErrorBody', { item: t('common.nouns.account') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error creating admin account:', error);
      toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.adminAccount') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to update an existing admin account
 */
export function useUpdateAdminAccount() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AdminAccountFormData }) => 
      AdminSettingsService.updateAdminAccount(id, data),
    onSuccess: (response: ServiceResponse<AdminAccountWithDetails>, variables) => {
      if (response.success) {
        // Invalidate and refetch admin accounts
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.adminAccounts() });
        
        toast.success(t('common.crud.updateSuccess', { entity: t('admin.settings.entities.adminAccount') }), {
          description: t('common.crud.namedUpdatedBody', { item: t('common.nouns.account'), name: response.data?.userName ?? '' })
        });
      } else {
        toast.error(t('common.crud.updateError', { entity: t('admin.settings.entities.adminAccount') }), {
          description: response.message || t('common.crud.updateErrorBody', { item: t('common.nouns.account') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error updating admin account:', error);
      toast.error(t('common.crud.updateError', { entity: t('admin.settings.entities.adminAccount') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to delete an admin account
 */
export function useDeleteAdminAccount() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: number) => AdminSettingsService.deleteAdminAccount(id),
    onSuccess: (response: ServiceResponse<void>, id) => {
      if (response.success) {
        // Invalidate and refetch admin accounts
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.adminAccounts() });
        
        toast.success(t('common.crud.deleteSuccess', { entity: t('admin.settings.entities.adminAccount') }), {
          description: t('common.crud.deletedBody', { item: t('common.nouns.account') })
        });
      } else {
        toast.error(t('common.crud.deleteError', { entity: t('admin.settings.entities.adminAccount') }), {
          description: response.message || t('common.crud.deleteErrorBody', { item: t('common.nouns.account') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error deleting admin account:', error);
      toast.error(t('common.crud.deleteError', { entity: t('admin.settings.entities.adminAccount') }), {
        description: t('common.crud.unexpectedErrorBody')
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
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: ClientCategoryFormData) => AdminSettingsService.createClientCategory(data),
    onSuccess: (response: ServiceResponse<ClientCategory>) => {
      if (response.success) {
        // Invalidate and refetch client categories
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.clientCategories() });
        
        toast.success(t('common.crud.createSuccess', { entity: t('admin.settings.entities.clientCategory') }), {
          description: t('common.crud.namedCreatedBody', { item: t('common.nouns.category'), name: response.data?.categoryName ?? '' })
        });
      } else {
        toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.clientCategory') }), {
          description: response.message || t('common.crud.createErrorBody', { item: t('common.nouns.category') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error creating client category:', error);
      toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.clientCategory') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to update an existing client category
 */
export function useUpdateClientCategory() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ClientCategoryFormData }) => 
      AdminSettingsService.updateClientCategory(id, data),
    onSuccess: (response: ServiceResponse<ClientCategory>) => {
      if (response.success) {
        // Invalidate and refetch client categories
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.clientCategories() });
        
        toast.success(t('common.crud.updateSuccess', { entity: t('admin.settings.entities.clientCategory') }), {
          description: t('common.crud.namedUpdatedBody', { item: t('common.nouns.category'), name: response.data?.categoryName ?? '' })
        });
      } else {
        toast.error(t('common.crud.updateError', { entity: t('admin.settings.entities.clientCategory') }), {
          description: response.message || t('common.crud.updateErrorBody', { item: t('common.nouns.category') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error updating client category:', error);
      toast.error(t('common.crud.updateError', { entity: t('admin.settings.entities.clientCategory') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to delete a client category
 */
export function useDeleteClientCategory() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: number) => AdminSettingsService.deleteClientCategory(id),
    onSuccess: (response: ServiceResponse<void>) => {
      if (response.success) {
        // Invalidate and refetch client categories
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.clientCategories() });
        
        toast.success(t('common.crud.deleteSuccess', { entity: t('admin.settings.entities.clientCategory') }), {
          description: t('common.crud.deletedBody', { item: t('common.nouns.category') })
        });
      } else {
        toast.error(t('common.crud.deleteError', { entity: t('admin.settings.entities.clientCategory') }), {
          description: response.message || t('common.crud.deleteErrorBody', { item: t('common.nouns.category') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error deleting client category:', error);
      toast.error(t('common.crud.deleteError', { entity: t('admin.settings.entities.clientCategory') }), {
        description: t('common.crud.unexpectedErrorBody')
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
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: FamilyFormData) => AdminSettingsService.createFamily(data),
    onSuccess: (response: ServiceResponse<Family>) => {
      if (response.success) {
        // Invalidate and refetch families
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.families() });
        
        toast.success(t('common.crud.createSuccess', { entity: t('admin.settings.entities.productFamily') }), {
          description: t('common.crud.namedCreatedBody', { item: t('common.nouns.family'), name: response.data?.familyName ?? '' })
        });
      } else {
        toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.productFamily') }), {
          description: response.message || t('common.crud.createErrorBody', { item: t('common.nouns.family') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error creating product family:', error);
      toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.productFamily') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to update an existing product family
 */
export function useUpdateFamily() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FamilyFormData }) => 
      AdminSettingsService.updateFamily(id, data),
    onSuccess: (response: ServiceResponse<Family>) => {
      if (response.success) {
        // Invalidate and refetch families
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.families() });
        
        toast.success(t('common.crud.updateSuccess', { entity: t('admin.settings.entities.productFamily') }), {
          description: t('common.crud.namedUpdatedBody', { item: t('common.nouns.family'), name: response.data?.familyName ?? '' })
        });
      } else {
        toast.error(t('common.crud.updateError', { entity: t('admin.settings.entities.productFamily') }), {
          description: response.message || t('common.crud.updateErrorBody', { item: t('common.nouns.family') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error updating product family:', error);
      toast.error(t('common.crud.updateError', { entity: t('admin.settings.entities.productFamily') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to delete a product family
 */
export function useDeleteFamily() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: number) => AdminSettingsService.deleteFamily(id),
    onSuccess: (response: ServiceResponse<void>) => {
      if (response.success) {
        // Invalidate and refetch families
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.families() });
        
        toast.success(t('common.crud.deleteSuccess', { entity: t('admin.settings.entities.productFamily') }), {
          description: t('common.crud.deletedBody', { item: t('common.nouns.family') })
        });
      } else {
        toast.error(t('common.crud.deleteError', { entity: t('admin.settings.entities.productFamily') }), {
          description: response.message || t('common.crud.deleteErrorBody', { item: t('common.nouns.family') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error deleting product family:', error);
      toast.error(t('common.crud.deleteError', { entity: t('admin.settings.entities.productFamily') }), {
        description: t('common.crud.unexpectedErrorBody')
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
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: BrandFormData) => AdminSettingsService.createBrand(data),
    onSuccess: (response: ServiceResponse<Brand>) => {
      if (response.success) {
        // Invalidate and refetch brands
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.brands() });
        
        toast.success(t('common.crud.createSuccess', { entity: t('admin.settings.entities.productBrand') }), {
          description: t('common.crud.namedCreatedBody', { item: t('common.nouns.brand'), name: response.data?.brandName ?? '' })
        });
      } else {
        toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.productBrand') }), {
          description: response.message || t('common.crud.createErrorBody', { item: t('common.nouns.brand') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error creating product brand:', error);
      toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.productBrand') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to update an existing product brand
 */
export function useUpdateBrand() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BrandFormData }) => 
      AdminSettingsService.updateBrand(id, data),
    onSuccess: (response: ServiceResponse<Brand>) => {
      if (response.success) {
        // Invalidate and refetch brands
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.brands() });
        
        toast.success(t('common.crud.updateSuccess', { entity: t('admin.settings.entities.productBrand') }), {
          description: t('common.crud.namedUpdatedBody', { item: t('common.nouns.brand'), name: response.data?.brandName ?? '' })
        });
      } else {
        toast.error(t('common.crud.updateError', { entity: t('admin.settings.entities.productBrand') }), {
          description: response.message || t('common.crud.updateErrorBody', { item: t('common.nouns.brand') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error updating product brand:', error);
      toast.error(t('common.crud.updateError', { entity: t('admin.settings.entities.productBrand') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to delete a product brand
 */
export function useDeleteBrand() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: number) => AdminSettingsService.deleteBrand(id),
    onSuccess: (response: ServiceResponse<void>) => {
      if (response.success) {
        // Invalidate and refetch brands
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.brands() });
        
        toast.success(t('common.crud.deleteSuccess', { entity: t('admin.settings.entities.productBrand') }), {
          description: t('common.crud.deletedBody', { item: t('common.nouns.brand') })
        });
      } else {
        toast.error(t('common.crud.deleteError', { entity: t('admin.settings.entities.productBrand') }), {
          description: response.message || t('common.crud.deleteErrorBody', { item: t('common.nouns.brand') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error deleting product brand:', error);
      toast.error(t('common.crud.deleteError', { entity: t('admin.settings.entities.productBrand') }), {
        description: t('common.crud.unexpectedErrorBody')
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
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: ModelFormData) => AdminSettingsService.createModel(data),
    onSuccess: (response: ServiceResponse<Model>) => {
      if (response.success) {
        // Invalidate and refetch models
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.models() });
        
        toast.success(t('common.crud.createSuccess', { entity: t('admin.settings.entities.productModel') }), {
          description: t('common.crud.namedCreatedBody', { item: t('common.nouns.model'), name: response.data?.modelName ?? '' })
        });
      } else {
        toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.productModel') }), {
          description: response.message || t('common.crud.createErrorBody', { item: t('common.nouns.model') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error creating product model:', error);
      toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.productModel') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to update an existing product model
 */
export function useUpdateModel() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ModelFormData }) => 
      AdminSettingsService.updateModel(id, data),
    onSuccess: (response: ServiceResponse<Model>) => {
      if (response.success) {
        // Invalidate and refetch models
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.models() });
        
        toast.success(t('common.crud.updateSuccess', { entity: t('admin.settings.entities.productModel') }), {
          description: t('common.crud.namedUpdatedBody', { item: t('common.nouns.model'), name: response.data?.modelName ?? '' })
        });
      } else {
        toast.error(t('common.crud.updateError', { entity: t('admin.settings.entities.productModel') }), {
          description: response.message || t('common.crud.updateErrorBody', { item: t('common.nouns.model') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error updating product model:', error);
      toast.error(t('common.crud.updateError', { entity: t('admin.settings.entities.productModel') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to delete a product model
 */
export function useDeleteModel() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: number) => AdminSettingsService.deleteModel(id),
    onSuccess: (response: ServiceResponse<void>) => {
      if (response.success) {
        // Invalidate and refetch models
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.models() });
        
        toast.success(t('common.crud.deleteSuccess', { entity: t('admin.settings.entities.productModel') }), {
          description: t('common.crud.deletedBody', { item: t('common.nouns.model') })
        });
      } else {
        toast.error(t('common.crud.deleteError', { entity: t('admin.settings.entities.productModel') }), {
          description: response.message || t('common.crud.deleteErrorBody', { item: t('common.nouns.model') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error deleting product model:', error);
      toast.error(t('common.crud.deleteError', { entity: t('admin.settings.entities.productModel') }), {
        description: t('common.crud.unexpectedErrorBody')
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
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (file: File) => AdminSettingsService.importDeliveryFees(file),
    onSuccess: (response: ExcelImportResult) => {
      if (response.success) {
        // Invalidate and refetch delivery fees
        queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.deliveryFees() });
        
        toast.success(t('common.crud.createSuccess', { entity: t('admin.settings.entities.deliveryFees') }), {
          description: response.message || t('admin.settings.delivery.importedBody', { count: response.data?.length || 0 })
        });
      } else {
        toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.deliveryFees') }), {
          description: response.message || t('common.crud.createErrorBody', { item: t('common.nouns.file') })
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error importing delivery fees:', error);
      toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.deliveryFees') }), {
        description: t('common.crud.unexpectedErrorBody')
      });
    },
  });
}

/**
 * Hook to export delivery fees to Excel file
 */
export function useExportDeliveryFees() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: () => AdminSettingsService.exportDeliveryFees(),
    onSuccess: () => {
      toast.success(t('common.crud.createSuccess', { entity: t('admin.settings.entities.deliveryFees') }), {
        description: t('admin.settings.delivery.exportedBody')
      });
    },
    onError: (error: Error) => {
      console.error('Error exporting delivery fees:', error);
      toast.error(t('common.crud.createError', { entity: t('admin.settings.entities.deliveryFees') }), {
        description: t('common.crud.unexpectedErrorBody')
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
  const { t } = useTranslation();

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
