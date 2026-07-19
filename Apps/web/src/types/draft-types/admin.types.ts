import { Product, Brand, Family, Model, ProductSupplier } from './product.types';

/**
 * Admin-specific product interface with all details needed for admin management
 */
export interface AdminProductWithDetails extends Product {
  brand: Brand;
  model: Model;
  family: Family;
  supplier: ProductSupplier | null;
  stockQuantity: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  createdDate: string; // Formatted date string for display
}

/**
 * Product statistics for admin dashboard
 */
export interface AdminProductsStats {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

/**
 * Paginated response for admin products
 */
export interface AdminProductsPaginatedResponse {
  products: AdminProductWithDetails[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Filter options for admin products page
 */
export interface AdminProductsFilters {
  searchQuery: string;
  familyId?: number | 'all';
  brandId?: number | 'all';
  modelId?: number | 'all';
  page?: number;
  limit?: number;
}

/**
 * Stock status calculation thresholds
 */
export const STOCK_THRESHOLDS = {
  LOW_STOCK: 10,
  OUT_OF_STOCK: 0,
} as const;

/**
 * Helper function to determine stock status based on quantity
 */
export function getStockStatus(quantity: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (quantity <= STOCK_THRESHOLDS.OUT_OF_STOCK) {
    return 'out_of_stock';
  }
  if (quantity <= STOCK_THRESHOLDS.LOW_STOCK) {
    return 'low_stock';
  }
  return 'in_stock';
}

/**
 * Helper function to format date for display
 */
export function formatProductDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
