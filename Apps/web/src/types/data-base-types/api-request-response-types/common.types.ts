/**
 * Common API Types
 * Shared request/response interfaces used across all domains
 */

// ==================== Common API Response Types ====================

export interface ApiResponse<T> {
  success: boolean;
  data: T[];
  count: number;
}

export interface SingleResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ==================== Utility Types ====================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  [key: string]: any;
}
