import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import {
  AdminProductImage,
  ImageUploadResponse,
  ImageUploadData,
  ImageRemovalData,
  validateImageFile,
  PRODUCT_INFORMATION_CONSTANTS,
} from '@/types/draft-types/admin-product-information.types';
import {
  uploadAdminProductImage,
  removeAdminProductImage,
  setAdminProductPrimaryImage,
} from '@/services/catalog.service';

/**
 * Hook to upload product images
 */
export function useUploadProductImage(productId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation<ImageUploadResponse, Error, File>({
    mutationFn: async (file: File) => {
      // Validate file before upload
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const response = await uploadAdminProductImage(productId, file);
      if (!response.success) {
        throw new Error(response.message || 'Failed to upload image');
      }
      return response;
    },
    onSuccess: (response) => {
      // Invalidate and refetch product information to get updated images
      queryClient.invalidateQueries({ queryKey: ['admin-product-information', productId] });
      
      toast({
        title: t('admin.productInfo.imageUploadSuccess'),
        description: response.message,
      });
    },
    onError: (error) => {
      toast({
        title: t('admin.productInfo.imageUploadError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to remove product images
 */
export function useRemoveProductImage(productId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation<{ success: boolean; message?: string }, Error, string>({
    mutationFn: async (imageId: string) => {
      const response = await removeAdminProductImage(productId, imageId);
      if (!response.success) {
        throw new Error(response.message || 'Failed to remove image');
      }
      return response;
    },
    onSuccess: (response) => {
      // Invalidate and refetch product information to get updated images
      queryClient.invalidateQueries({ queryKey: ['admin-product-information', productId] });
      
      toast({
        title: t('admin.productInfo.imageRemoveSuccess'),
        description: response.message,
      });
    },
    onError: (error) => {
      toast({
        title: t('admin.productInfo.imageRemoveError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to set primary image
 */
export function useSetPrimaryImage(productId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation<{ success: boolean; message?: string }, Error, string>({
    mutationFn: async (imageId: string) => {
      const response = await setAdminProductPrimaryImage(productId, imageId);
      if (!response.success) {
        throw new Error(response.message || 'Failed to set primary image');
      }
      return response;
    },
    onSuccess: (response) => {
      // Invalidate and refetch product information to get updated images
      queryClient.invalidateQueries({ queryKey: ['admin-product-information', productId] });
      
      toast({
        title: t('admin.productInfo.updateSuccess'),
        description: response.message,
      });
    },
    onError: (error) => {
      toast({
        title: t('admin.productInfo.updateError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to manage product images with all operations
 */
export function useProductImages(productId: number) {
  const uploadMutation = useUploadProductImage(productId);
  const removeMutation = useRemoveProductImage(productId);
  const setPrimaryMutation = useSetPrimaryImage(productId);

  const uploadImage = async (file: File) => {
    try {
      await uploadMutation.mutateAsync(file);
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Image upload failed:', error);
    }
  };

  const removeImage = async (imageId: string) => {
    try {
      await removeMutation.mutateAsync(imageId);
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Image removal failed:', error);
    }
  };

  const setPrimaryImage = async (imageId: string) => {
    try {
      await setPrimaryMutation.mutateAsync(imageId);
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Set primary image failed:', error);
    }
  };

  const canUploadMore = (currentImageCount: number) => {
    return currentImageCount < PRODUCT_INFORMATION_CONSTANTS.MAX_IMAGES;
  };

  return {
    uploadImage,
    removeImage,
    setPrimaryImage,
    isUploading: uploadMutation.isPending,
    isRemoving: removeMutation.isPending,
    isSettingPrimary: setPrimaryMutation.isPending,
    canUploadMore,
    uploadError: uploadMutation.error?.message,
    removeError: removeMutation.error?.message,
    setPrimaryError: setPrimaryMutation.error?.message,
  };
}
