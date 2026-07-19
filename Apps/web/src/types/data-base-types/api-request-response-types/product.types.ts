/**
 * Product API Request/Response Types
 * Types for product-related API operations
 */

// ==================== Product API Request Types ====================

export interface CreateProductRequest {
  productName: string;
  productDescription?: string;
  productCodeBar: string;
  idModel: number;
}

export interface UpdateProductRequest {
  productName?: string;
  productDescription?: string;
  productCodeBar?: string;
  idModel?: number;
}

export interface CreatePriceCategoryRequest {
  idProduct: number;
  idCategory: number;
  price: number;
}

export interface UpdatePriceCategoryRequest {
  price: number;
}

export interface CreateHistoryPriceRequest {
  idCategory: number;
  price: number;
}

export interface CreateModelRequest {
  idBrand: number;
  modelName: string;
}

export interface UpdateModelRequest {
  idBrand?: number;
  modelName?: string;
}

export interface CreateModelFamilyRequest {
  idModel: number;
  idFamily: number;
}
