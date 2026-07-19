/**
 * User API Request/Response Types
 * Types for user-related API operations
 */

// ==================== User API Request Types ====================

export interface CreateUserRequest {
  userName: string;
  userPassword: string;
  userRole: number;
  userStatue: number;
}

export interface UpdateUserRequest {
  userName?: string;
  userPassword?: string;
  userRole?: number;
  userStatue?: number;
}

export interface CreateUserLogRequest {
  idUser: number;
  useractionType: number;
  actionDetails: string;
}
