import { Brand, Family, Product, Model, ProductPriceCategory, ProductHistoryPrice, ModelFamily } from '@/types';
import { 
  ApiResponse, 
  SingleResponse, 
  CreateProductRequest, 
  UpdateProductRequest, 
  CreatePriceCategoryRequest, 
  UpdatePriceCategoryRequest, 
  CreateHistoryPriceRequest, 
  CreateModelRequest, 
  UpdateModelRequest, 
  CreateModelFamilyRequest
} from '@/types';

// Import ProductImage from existing types (not in data-base-types yet)
import { ProductImage } from '@/types/draft-types';

/**
 * Product API Service
 * Handles communication with backend product endpoints for reference data
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Type aliases for backward compatibility
export type ProductApiResponse<T> = ApiResponse<T>;
export type ProductSingleResponse<T> = SingleResponse<T>;

export const productApiService = {
  /**
   * Get all brands from the backend
   */
  async getBrands(): Promise<Brand[]> {
    const response = await fetch(`${API_BASE_URL}/api/products/brands`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch brands: ${response.statusText}`);
    }

    const result: ProductApiResponse<Brand> = await response.json();
    return result.data || [];
  },

  /**
   * Get all families (categories) from the backend
   */
  async getFamilies(): Promise<Family[]> {
    const response = await fetch(`${API_BASE_URL}/api/products/families`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch families: ${response.statusText}`);
    }

    const result: ProductApiResponse<Family> = await response.json();
    return result.data || [];
  },

  /**
   * Get brand by ID
   */
  async getBrandById(id: number): Promise<Brand | null> {
    const response = await fetch(`${API_BASE_URL}/api/products/brands/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch brand: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Get family by ID
   */
  async getFamilyById(id: number): Promise<Family | null> {
    const response = await fetch(`${API_BASE_URL}/api/products/families/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch family: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  // ==================== Core Product Operations ====================

  /**
   * Get all products from the backend
   */
  async getProducts(): Promise<Product[]> {
    const response = await fetch(`${API_BASE_URL}/api/products`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }

    const result: ProductApiResponse<Product> = await response.json();
    return result.data || [];
  },

  /**
   * Get product by ID
   */
  async getProductById(id: number): Promise<Product | null> {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch product: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new product
   */
  async createProduct(data: CreateProductRequest): Promise<Product> {
    const response = await fetch(`${API_BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create product: ${response.statusText}`);
    }

    const result: ProductSingleResponse<Product> = await response.json();
    return result.data;
  },

  /**
   * Update an existing product
   */
  async updateProduct(id: number, data: UpdateProductRequest): Promise<Product> {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update product: ${response.statusText}`);
    }

    const result: ProductSingleResponse<Product> = await response.json();
    return result.data;
  },

  /**
   * Delete a product
   */
  async deleteProduct(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete product: ${response.statusText}`);
    }
  },

  // ==================== Product Picture Operations ====================

  /**
   * Get product pictures (all pictures or specific to a product)
   */
  async getProductPictures(productId?: number): Promise<ProductImage[]> {
    const url = productId 
      ? `${API_BASE_URL}/api/products/${productId}/pictures`
      : `${API_BASE_URL}/api/products/pictures`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product pictures: ${response.statusText}`);
    }

    const result: ProductApiResponse<ProductImage> = await response.json();
    return result.data || [];
  },

  /**
   * Get product picture by ID
   */
  async getProductPictureById(id: string): Promise<ProductImage | null> {
    const response = await fetch(`${API_BASE_URL}/api/products/pictures/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch product picture: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new product picture (upload image)
   */
  async createProductPicture(formData: FormData): Promise<ProductImage> {
    const response = await fetch(`${API_BASE_URL}/api/products/pictures`, {
      method: 'POST',
      body: formData, // Don't set Content-Type header for FormData
    });

    if (!response.ok) {
      throw new Error(`Failed to create product picture: ${response.statusText}`);
    }

    const result: ProductSingleResponse<ProductImage> = await response.json();
    return result.data;
  },

  /**
   * Update a product picture
   */
  async updateProductPicture(id: string, formData: FormData): Promise<ProductImage> {
    const response = await fetch(`${API_BASE_URL}/api/products/pictures/${id}`, {
      method: 'PUT',
      body: formData, // Don't set Content-Type header for FormData
    });

    if (!response.ok) {
      throw new Error(`Failed to update product picture: ${response.statusText}`);
    }

    const result: ProductSingleResponse<ProductImage> = await response.json();
    return result.data;
  },

  /**
   * Delete a product picture
   */
  async deleteProductPicture(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/products/pictures/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete product picture: ${response.statusText}`);
    }
  },

  // ==================== Product Price Category Operations ====================

  /**
   * Get product price categories (all or specific to a product)
   */
  async getProductPriceCategories(productId?: number): Promise<ProductPriceCategory[]> {
    const url = productId 
      ? `${API_BASE_URL}/api/products/${productId}/price-categories`
      : `${API_BASE_URL}/api/products/price-categories`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product price categories: ${response.statusText}`);
    }

    const result: ProductApiResponse<ProductPriceCategory> = await response.json();
    return result.data || [];
  },

  /**
   * Create a new product price category
   */
  async createProductPriceCategory(data: CreatePriceCategoryRequest): Promise<ProductPriceCategory> {
    const response = await fetch(`${API_BASE_URL}/api/products/price-categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create product price category: ${response.statusText}`);
    }

    const result: ProductSingleResponse<ProductPriceCategory> = await response.json();
    return result.data;
  },

  /**
   * Update a product price category
   */
  async updateProductPriceCategory(productId: number, categoryId: number, data: UpdatePriceCategoryRequest): Promise<ProductPriceCategory> {
    const response = await fetch(`${API_BASE_URL}/api/products/price-categories/${productId}/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update product price category: ${response.statusText}`);
    }

    const result: ProductSingleResponse<ProductPriceCategory> = await response.json();
    return result.data;
  },

  /**
   * Delete a product price category
   */
  async deleteProductPriceCategory(productId: number, categoryId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/products/price-categories/${productId}/${categoryId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete product price category: ${response.statusText}`);
    }
  },

  // ==================== Model Operations ====================

  /**
   * Get all models from the backend
   */
  async getModels(brandId?: number): Promise<Model[]> {
    const url = brandId 
      ? `${API_BASE_URL}/api/products/models?brandId=${brandId}`
      : `${API_BASE_URL}/api/products/models`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const result: ProductApiResponse<Model> = await response.json();
    return result.data || [];
  },

  /**
   * Get model by ID
   */
  async getModelById(id: number): Promise<Model | null> {
    const response = await fetch(`${API_BASE_URL}/api/products/models/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch model: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new model
   */
  async createModel(data: CreateModelRequest): Promise<Model> {
    const response = await fetch(`${API_BASE_URL}/api/products/models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create model: ${response.statusText}`);
    }

    const result: ProductSingleResponse<Model> = await response.json();
    return result.data;
  },

  /**
   * Update an existing model
   */
  async updateModel(id: number, data: UpdateModelRequest): Promise<Model> {
    const response = await fetch(`${API_BASE_URL}/api/products/models/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update model: ${response.statusText}`);
    }

    const result: ProductSingleResponse<Model> = await response.json();
    return result.data;
  },

  /**
   * Delete a model
   */
  async deleteModel(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/products/models/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete model: ${response.statusText}`);
    }
  },

  // ==================== Model-Family Operations ====================

  /**
   * Get model families (all or specific to a model)
   */
  async getModelFamilies(modelId?: number): Promise<ModelFamily[]> {
    const url = modelId 
      ? `${API_BASE_URL}/api/products/model-families?modelId=${modelId}`
      : `${API_BASE_URL}/api/products/model-families`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch model families: ${response.statusText}`);
    }

    const result: ProductApiResponse<ModelFamily> = await response.json();
    return result.data || [];
  },

  /**
   * Create a new model-family relationship
   */
  async createModelFamily(data: CreateModelFamilyRequest): Promise<ModelFamily> {
    const response = await fetch(`${API_BASE_URL}/api/products/model-families`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create model family: ${response.statusText}`);
    }

    const result: ProductSingleResponse<ModelFamily> = await response.json();
    return result.data;
  },

  /**
   * Delete a model-family relationship
   */
  async deleteModelFamily(modelId: number, familyId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/products/model-families/${modelId}/${familyId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete model family: ${response.statusText}`);
    }
  },

  // ==================== Product History Price Operations ====================

  /**
   * Get product history prices (all or specific to a category)
   */
  async getProductHistoryPrices(categoryId?: number): Promise<ProductHistoryPrice[]> {
    const url = categoryId 
      ? `${API_BASE_URL}/api/products/price-history?categoryId=${categoryId}`
      : `${API_BASE_URL}/api/products/price-history`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product history prices: ${response.statusText}`);
    }

    const result: ProductApiResponse<ProductHistoryPrice> = await response.json();
    return result.data || [];
  },

  /**
   * Get product history price by ID
   */
  async getProductHistoryPriceById(id: number): Promise<ProductHistoryPrice | null> {
    const response = await fetch(`${API_BASE_URL}/api/products/price-history/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch product history price: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new product history price
   */
  async createProductHistoryPrice(data: CreateHistoryPriceRequest): Promise<ProductHistoryPrice> {
    const response = await fetch(`${API_BASE_URL}/api/products/price-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create product history price: ${response.statusText}`);
    }

    const result: ProductSingleResponse<ProductHistoryPrice> = await response.json();
    return result.data;
  },
};
