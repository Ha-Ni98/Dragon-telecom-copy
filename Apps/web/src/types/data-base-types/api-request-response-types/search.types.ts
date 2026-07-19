/**
 * Search API Request/Response Types
 * Types for search-related API operations
 */

// ==================== Search API Request Types ====================

export interface SearchRequest {
  query: string;
  limit?: number;
  idClient?: number;
}

export interface SearchResponse {
  idProduct: number;
  productName: string;
  brandName: string;
  price: number;
  image: string;
}