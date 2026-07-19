import {
  AdminProductWithFullDetails,
  ProductInformationServiceResponse,
  ProductUpdateResponse,
  ImageUploadResponse,
  SupplierUpdateResponse,
  SupplierDeletionResponse,
  PricingUpdates,
  SupplierUpdates,
  AdminProductImage,
  ProductSupplierWithDetails,
} from '@/types/draft-types/admin-product-information.types';
import { mockAdminProductInformation, sleep } from '@/mocks/admin-product-information';

/**
 * Admin Product Information Service
 * Handles all product information operations for the admin product information page
 * Currently uses mock data, designed to easily switch to real API calls
 */
export const adminProductInformationService = {
  /**
   * Get product with full details including images, suppliers, and pricing
   */
  getProductWithFullDetails: async (productId: number): Promise<ProductInformationServiceResponse> => {
    // Simulate API delay
    await sleep(300);
    
    try {
      const product = mockAdminProductInformation.find(p => p.idProduct === productId);
      
      if (!product) {
        return {
          product: {} as AdminProductWithFullDetails,
          success: false,
          message: 'Product not found',
        };
      }

      return {
        product,
        success: true,
      };
    } catch (error) {
      console.error('Error fetching product with full details:', error);
      return {
        product: {} as AdminProductWithFullDetails,
        success: false,
        message: 'Failed to fetch product information',
      };
    }
  },

  /**
   * Update product information
   */
  updateProduct: async (
    productId: number,
    updates: Partial<AdminProductWithFullDetails>
  ): Promise<ProductUpdateResponse> => {
    // Simulate API delay
    await sleep(500);
    
    try {
      // In a real implementation, this would make an API call to update the product
      // For now, we'll just simulate success
      console.log(`Updating product ${productId} with:`, updates);
      
      return {
        success: true,
        message: 'Product updated successfully',
      };
    } catch (error) {
      console.error('Error updating product:', error);
      return {
        success: false,
        message: 'Failed to update product',
      };
    }
  },

  /**
   * Upload product image
   */
  uploadProductImage: async (
    productId: number,
    file: File
  ): Promise<ImageUploadResponse> => {
    // Simulate API delay
    await sleep(800);
    
    try {
      // In a real implementation, this would upload the file to a server
      // For now, we'll just simulate success
      const newImage: AdminProductImage = {
        id: `img_${Date.now()}`,
        url: URL.createObjectURL(file),
        alt: file.name,
        isPrimary: false,
        order: 0,
        uploadedAt: new Date().toISOString(),
        fileSize: file.size,
        mimeType: file.type,
      };

      console.log(`Uploading image for product ${productId}:`, file.name);
      
      return {
        success: true,
        message: 'Image uploaded successfully',
        image: newImage,
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      return {
        success: false,
        message: 'Failed to upload image',
      };
    }
  },

  /**
   * Remove product image
   */
  removeProductImage: async (
    productId: number,
    imageId: string
  ): Promise<{ success: boolean; message?: string }> => {
    // Simulate API delay
    await sleep(400);
    
    try {
      // In a real implementation, this would remove the image from the server
      // For now, we'll just simulate success
      console.log(`Removing image ${imageId} from product ${productId}`);
      
      return {
        success: true,
        message: 'Image removed successfully',
      };
    } catch (error) {
      console.error('Error removing image:', error);
      return {
        success: false,
        message: 'Failed to remove image',
      };
    }
  },

  /**
   * Update product pricing
   */
  updateProductPricing: async (
    productId: number,
    updates: PricingUpdates
  ): Promise<ProductUpdateResponse> => {
    // Simulate API delay
    await sleep(500);
    
    try {
      // In a real implementation, this would update pricing in the database
      // For now, we'll just simulate success
      console.log(`Updating pricing for product ${productId}:`, updates);
      
      return {
        success: true,
        message: 'Pricing updated successfully',
      };
    } catch (error) {
      console.error('Error updating pricing:', error);
      return {
        success: false,
        message: 'Failed to update pricing',
      };
    }
  },

  /**
   * Get product suppliers
   */
  getProductSuppliers: async (productId: number): Promise<ProductSupplierWithDetails[]> => {
    // Simulate API delay
    await sleep(200);
    
    try {
      const product = mockAdminProductInformation.find(p => p.idProduct === productId);
      return product?.suppliers || [];
    } catch (error) {
      console.error('Error fetching product suppliers:', error);
      return [];
    }
  },

  /**
   * Update supplier information
   */
  updateSupplier: async (
    supplierId: number,
    updates: SupplierUpdates
  ): Promise<SupplierUpdateResponse> => {
    // Simulate API delay
    await sleep(500);
    
    try {
      // In a real implementation, this would update supplier information in the database
      // For now, we'll just simulate success
      console.log(`Updating supplier ${supplierId}:`, updates);
      
      return {
        success: true,
        message: 'Supplier updated successfully',
      };
    } catch (error) {
      console.error('Error updating supplier:', error);
      return {
        success: false,
        message: 'Failed to update supplier',
      };
    }
  },

  /**
   * Delete supplier
   */
  deleteSupplier: async (supplierId: number): Promise<SupplierDeletionResponse> => {
    // Simulate API delay
    await sleep(500);
    
    try {
      // In a real implementation, this would delete the supplier from the database
      // For now, we'll just simulate success
      console.log(`Deleting supplier ${supplierId}`);
      
      return {
        success: true,
        message: 'Supplier deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting supplier:', error);
      return {
        success: false,
        message: 'Failed to delete supplier',
      };
    }
  },

  /**
   * Set primary image
   */
  setPrimaryImage: async (
    productId: number,
    imageId: string
  ): Promise<{ success: boolean; message?: string }> => {
    // Simulate API delay
    await sleep(300);
    
    try {
      // In a real implementation, this would update the primary image in the database
      // For now, we'll just simulate success
      console.log(`Setting primary image ${imageId} for product ${productId}`);
      
      return {
        success: true,
        message: 'Primary image updated successfully',
      };
    } catch (error) {
      console.error('Error setting primary image:', error);
      return {
        success: false,
        message: 'Failed to update primary image',
      };
    }
  },
};
