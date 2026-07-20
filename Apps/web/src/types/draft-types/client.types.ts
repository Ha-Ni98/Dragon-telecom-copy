import { ClientStatusCode } from "./enums.types";

// Re-export enums for convenience
export { ClientStatusCode } from "./enums.types";

export interface ClientCategory {
  idCategory: number;
  categoryName: string;
  categoryStatus: number; // CategoryStatusCode
}

export interface Client {
  idClient: number;
  clientUserName: string;
  clientPassword: string; // hashed
  clientFirstName: string;
  clientLastName?: string;
  clientPhoneNumber: string;
  clientEmail?: string;
  clientWilaya: string;
  clientCommune: string;
  clientStatus: ClientStatusCode;
  clientCreatedDate: string; // ISO
  clientLocation?: string;
  idCategory: number;
  clientCredit: number;
  clientSolde: number;
  clientPaid: number;
}

// Interface for registration form data (without password fields)
export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  wilaya: string;
  commune: string;
}

// Enhanced client interface for admin view
export interface AdminClientWithDetails extends Client {
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: string;
  fullName: string;
  displayStatus: string;
}

// Client statistics interface
export interface AdminClientsStats {
  totalClients: number;
  activeClients: number;
  newThisMonth: number;
  averageOrdersPerClient: number;
}

// Client modification data
export interface ClientModificationData {
  status: ClientStatusCode;
  credit: number;
  username?: string;
  password?: string;
  confirmPassword?: string;
  categoryId?: number;
}

// Pagination info
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Admin clients filters
export interface AdminClientsFilters {
  searchQuery: string;
  status: string;
  page: number;
  limit: number;
}

// Paginated response for admin clients
export interface AdminClientsPaginatedResponse {
  clients: AdminClientWithDetails[];
  pagination: PaginationInfo;
}


