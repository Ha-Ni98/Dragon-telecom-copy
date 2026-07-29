import { AdminProductWithDetails } from './admin.types';
import { ProductImage, ProductSupplier, ProductSupplierPrice } from './product.types';
import { Supplier } from './supplier.types';

/**
 * Enhanced admin product interface with full details for product information page
 */
export interface AdminProductWithFullDetails extends AdminProductWithDetails {
  images: AdminProductImage[];
  suppliers: ProductSupplierWithDetails[] | null;
  categoryPrices: ProductSupplierPrice[];
}

/**
 * Enhanced product supplier interface with supplier details and pricing
 */
export interface ProductSupplierWithDetails extends ProductSupplier {
  supplier: Supplier;
  categoryPrices: ProductSupplierPrice[];
}

/**
 * Interface for pricing updates in the admin product information page
 */
export interface PricingUpdates {
  noUserPrice?: number;
  categoryPrices?: Partial<ProductSupplierPrice>[];
}

/**
 * Interface for supplier updates in the admin product information page
 */
export interface SupplierUpdates {
  unitPrice?: number;
  quantity?: number;
}

/**
 * Interface for product image management
 * Note: This extends the existing ProductImage interface with additional admin-specific fields
 */
export interface AdminProductImage extends ProductImage {
 // String ID for easier management
  uploadedAt: string; // ISO date string
  fileSize: number; // File size in bytes
  mimeType: string; // MIME type of the image
}

/**
 * Interface for image upload operations
 */
export interface ImageUploadData {
  file: File;
  productId: number;
  isPrimary?: boolean;
}

/**
 * Interface for image removal operations
 */
export interface ImageRemovalData {
  imageId: string;
  productId: number;
}

/**
 * Interface for product information form data
 */
export interface ProductInformationFormData {
  productDescription?: string;
  noUserPrice?: number;
  categoryPrices?: Record<number, number>; // categoryId -> price mapping
}

/**
 * Interface for supplier modification form data
 */
export interface SupplierModificationFormData {
  unitPrice: number;
  quantity: number;
}

/**
 * Interface for product information page state
 */
export interface ProductInformationPageState {
  isEditMode: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
}

/**
 * Interface for product information page props
 */
export interface ProductInformationPageProps {
  productId: number;
  productName?: string; // Optional for breadcrumb display
}

/**
 * Interface for product information service response
 */
export interface ProductInformationServiceResponse {
  product: AdminProductWithFullDetails;
  success: boolean;
  message?: string;
}

/**
 * Interface for product update response
 */
export interface ProductUpdateResponse {
  success: boolean;
  message?: string;
  updatedProduct?: AdminProductWithFullDetails;
}

/**
 * Interface for image upload response
 */
export interface ImageUploadResponse {
  success: boolean;
  message?: string;
  image?: AdminProductImage;
}

/**
 * Interface for supplier update response
 */
export interface SupplierUpdateResponse {
  success: boolean;
  message?: string;
  updatedSupplier?: ProductSupplierWithDetails;
}

/**
 * Interface for supplier deletion response
 */
export interface SupplierDeletionResponse {
  success: boolean;
  message?: string;
}

/**
 * Constants for product information page
 */
export const PRODUCT_INFORMATION_CONSTANTS = {
  MAX_IMAGES: 3,
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MIN_PRICE: 0,
  MAX_PRICE: 999999,
  MIN_QUANTITY: 0,
  MAX_QUANTITY: 9999,
} as const;

/**
 * Helper function to validate image file
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  if (!PRODUCT_INFORMATION_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(file.type as 'image/jpeg' | 'image/png' | 'image/webp')) {
    return {
      isValid: false,
      error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
    };
  }

  if (file.size > PRODUCT_INFORMATION_CONSTANTS.MAX_IMAGE_SIZE) {
    return {
      isValid: false,
      error: 'File size too large. Maximum size is 5MB.',
    };
  }

  return { isValid: true };
}

/**
 * Helper function to validate pricing data
 */
export function validatePricingData(price: number): { isValid: boolean; error?: string } {
  if (price < PRODUCT_INFORMATION_CONSTANTS.MIN_PRICE) {
    return {
      isValid: false,
      error: 'Price cannot be negative.',
    };
  }

  if (price > PRODUCT_INFORMATION_CONSTANTS.MAX_PRICE) {
    return {
      isValid: false,
      error: 'Price exceeds maximum allowed value.',
    };
  }

  return { isValid: true };
}

/**
 * Helper function to validate quantity data
 */
export function validateQuantityData(quantity: number): { isValid: boolean; error?: string } {
  if (quantity < PRODUCT_INFORMATION_CONSTANTS.MIN_QUANTITY) {
    return {
      isValid: false,
      error: 'Quantity cannot be negative.',
    };
  }

  if (quantity > PRODUCT_INFORMATION_CONSTANTS.MAX_QUANTITY) {
    return {
      isValid: false,
      error: 'Quantity exceeds maximum allowed value.',
    };
  }

  return { isValid: true };
}
