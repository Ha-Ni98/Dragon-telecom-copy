import { AdminProductWithDetails, AdminProductsStats, AdminProductsFilters, AdminProductsPaginatedResponse } from '@/types/draft-types/admin.types';
import { mockAdminProducts, mockAdminProductsStats, sleep } from '@/mocks/admin-products';

/**
 * Admin Products Service
 * Handles all admin-specific product operations
 * Currently uses mock data, designed to easily switch to real API calls
 */
export const adminProductsService = {
  /**
   * Get all products with filtering and pagination support
   */
  getProducts: async (filters?: AdminProductsFilters): Promise<AdminProductsPaginatedResponse> => {
    // Simulate API delay
    await sleep(300);
    
    try {
      let filteredProducts = [...mockAdminProducts];
      
      // Apply search filter
      if (filters?.searchQuery) {
        const searchQuery = filters.searchQuery.toLowerCase();
        filteredProducts = filteredProducts.filter(product =>
          product.productName.toLowerCase().includes(searchQuery) ||
          product.productCodeBar.toLowerCase().includes(searchQuery) ||
          product.brand.brandName.toLowerCase().includes(searchQuery) ||
          product.family.familyName.toLowerCase().includes(searchQuery) ||
          product.model.modelName.toLowerCase().includes(searchQuery)
        );
      }
      
      // Apply family filter
      if (filters?.familyId && filters.familyId !== 'all') {
        filteredProducts = filteredProducts.filter(product =>
          product.family.idFamily === filters.familyId
        );
      }
      
      // Apply brand filter
      if (filters?.brandId && filters.brandId !== 'all') {
        filteredProducts = filteredProducts.filter(product =>
          product.brand.idBrand === filters.brandId
        );
      }
      
      // Apply model filter
      if (filters?.modelId && filters.modelId !== 'all') {
        filteredProducts = filteredProducts.filter(product =>
          product.model.idModel === filters.modelId
        );
      }
      
      // Pagination logic
      const page = filters?.page || 1;
      const limit = filters?.limit || 20;
      const totalItems = filteredProducts.length;
      const totalPages = Math.ceil(totalItems / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
      
      return {
        products: paginatedProducts,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      console.error('Error fetching admin products:', error);
      throw new Error('Failed to fetch products');
    }
  },

  /**
   * Get product statistics
   */
  getProductsStats: async (): Promise<AdminProductsStats> => {
    // Simulate API delay
    await sleep(200);
    
    try {
      return mockAdminProductsStats;
    } catch (error) {
      console.error('Error fetching product statistics:', error);
      throw new Error('Failed to fetch product statistics');
    }
  },

  /**
   * Delete a product by ID
   */
  deleteProduct: async (productId: number): Promise<void> => {
    // Simulate API delay
    await sleep(500);
    
    try {
      // In a real implementation, this would make an API call to delete the product
      // For now, we'll just simulate success
      const productExists = mockAdminProducts.some(p => p.idProduct === productId);
      
      if (!productExists) {
        throw new Error('Product not found');
      }
      
      // Simulate successful deletion
      console.log(`Product ${productId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw new Error('Failed to delete product');
    }
  },

  /**
   * Get a single product by ID
   */
  getProductById: async (productId: number): Promise<AdminProductWithDetails | null> => {
    // Simulate API delay
    await sleep(150);
    
    try {
      const product = mockAdminProducts.find(p => p.idProduct === productId);
      return product || null;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw new Error('Failed to fetch product');
    }
  },

  /**
   * Update product stock quantity
   */
  updateProductStock: async (productId: number, newQuantity: number): Promise<void> => {
    // Simulate API delay
    await sleep(400);
    
    try {
      const product = mockAdminProducts.find(p => p.idProduct === productId);
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      if (newQuantity < 0) {
        throw new Error('Stock quantity cannot be negative');
      }
      
      // In a real implementation, this would update the database
      // For now, we'll just simulate success
      console.log(`Product ${productId} stock updated to ${newQuantity}`);
    } catch (error) {
      console.error('Error updating product stock:', error);
      throw new Error('Failed to update product stock');
    }
  },

  /**
   * Get products by stock status
   */
  getProductsByStockStatus: async (status: 'in_stock' | 'low_stock' | 'out_of_stock'): Promise<AdminProductWithDetails[]> => {
    // Simulate API delay
    await sleep(250);
    
    try {
      return mockAdminProducts.filter(product => product.status === status);
    } catch (error) {
      console.error('Error fetching products by stock status:', error);
      throw new Error('Failed to fetch products by stock status');
    }
  },

  /**
   * Search products with advanced filtering
   */
  searchProducts: async (query: string, filters?: Omit<AdminProductsFilters, 'searchQuery'>): Promise<AdminProductsPaginatedResponse> => {
    // Simulate API delay
    await sleep(350);
    
    try {
      return adminProductsService.getProducts({
        searchQuery: query,
        ...filters,
      });
    } catch (error) {
      console.error('Error searching products:', error);
      throw new Error('Failed to search products');
    }
  },
};
