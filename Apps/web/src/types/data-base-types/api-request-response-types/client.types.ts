/**
 * Client API Request/Response Types
 * Types for client-related API operations
 */

// ==================== Client API Request Types ====================

export interface CreateClientRequest {
  clientFirstName: string;
  clientLastName: string;
  clientEmail?: string;
  clientPhoneNumber: string;
  clientWilaya: string;
  clientCommune: string;
  clientStatus: number;
  idCategory?: number;
  clientCredit: number;
  clientSolde: number;
  clientPaid: number;
}

export interface UpdateClientRequest {
  clientFirstName?: string;
  clientLastName?: string;
  clientEmail?: string;
  clientPhoneNumber?: string;
  clientWilaya?: string;
  clientCommune?: string;
  clientStatus?: number;
  idCategory?: number;
  clientCredit?: number;
  clientSolde?: number;
  clientPaid?: number;
}

export interface CreateCategoryRequest {
  categoryName: string;
  categoryStatus: number;
}

export interface UpdateCategoryRequest {
  categoryName?: string;
  categoryStatus?: number;
}

export interface CreateLogRequest {
  idClient: number;
  clientActionType: number;
  actionDetails: string;
}

export interface CheckPhoneRequest {
  phone: string;
}

export interface CheckPhoneResponse {
  exists: boolean;
}
