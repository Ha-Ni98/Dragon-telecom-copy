import { Supplier } from './supplier.types';

/**
 * Statistics data for admin suppliers page
 */
export interface AdminSuppliersStats {
  /** Total number of suppliers */
  totalSuppliers: number;
  /** Total amount due from all suppliers */
  totalDue: number;
  /** Total amount paid by all suppliers */
  totalPaid: number;
  /** Total credit amount for all suppliers */
  totalCredit: number;
}

/**
 * Enhanced supplier interface with additional calculated fields
 */
export interface SupplierWithDetails extends Supplier {
  /** Number of products supplied by this supplier */
  productsSuppliedCount: number;
  /** Number of invoices for this supplier */
  invoicesCount: number;
  /** Total amount due from this supplier */
  totalDue: number;
  /** Total amount paid by this supplier */
  totalPaid: number;
  /** Total credit amount for this supplier */
  totalCredit: number;
}

/**
 * Form data for creating or editing a supplier
 */
export interface SupplierFormData {
  /** Supplier company name (required) */
  supplierName: string;
  /** Contact person name (optional) */
  supplierPersonName?: string;
  /** Phone number (optional) */
  supplierPhone?: string;
  /** Email address (optional) */
  supplierEmail?: string;
  /** Physical location/address (optional) */
  supplierLocation?: string;
  /** Initial credit amount (optional, defaults to 0) */
  supplierCredit?: number;
}

/**
 * Form data for adding a new invoice to a supplier
 */
export interface InvoiceFormData {
  /** New amount due */
  newDue: number;
  /** Amount already paid */
  paid: number;
}

/**
 * Filters for searching and paginating suppliers
 */
export interface AdminSuppliersFilters {
  /** Search query for supplier name or person name */
  searchQuery?: string;
  /** Page number for pagination */
  page?: number;
  /** Number of items per page */
  limit?: number;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  /** Current page number */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Number of items per page */
  itemsPerPage: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
}

/**
 * Paginated response for suppliers list
 */
export interface AdminSuppliersPaginatedResponse {
  /** Array of suppliers with details */
  suppliers: SupplierWithDetails[];
  /** Pagination information */
  pagination: PaginationInfo;
}

/**
 * Service response wrapper for consistent API responses
 */
export interface ServiceResponse<T> {
  /** Whether the operation was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if operation failed */
  message?: string;
  /** HTTP status code */
  statusCode?: number;
}

/**
 * Form validation errors for supplier forms
 */
export interface SupplierFormErrors {
  supplierName?: string;
  supplierPersonName?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierLocation?: string;
  supplierCredit?: string;
}

/**
 * Form validation errors for invoice forms
 */
export interface InvoiceFormErrors {
  newDue?: string;
  paid?: string;
}

/**
 * Supplier statistics for dashboard display
 */
export interface SupplierStatistics {
  /** Total number of active suppliers */
  activeSuppliers: number;
  /** Total number of inactive suppliers */
  inactiveSuppliers: number;
  /** Average credit amount per supplier */
  averageCredit: number;
  /** Total value of all supplier relationships */
  totalRelationshipValue: number;
}

/**
 * Invoice statistics for a specific supplier
 */
export interface SupplierInvoiceStats {
  /** Total number of invoices */
  totalInvoices: number;
  /** Total amount due */
  totalDue: number;
  /** Total amount paid */
  totalPaid: number;
  /** Total credit amount */
  totalCredit: number;
  /** Average invoice amount */
  averageInvoiceAmount: number;
  /** Number of overdue invoices */
  overdueInvoices: number;
}

/**
 * Enhanced supplier with full statistics
 */
export interface SupplierWithStats extends SupplierWithDetails {
  /** Invoice statistics for this supplier */
  invoiceStats: SupplierInvoiceStats;
  /** Last invoice date */
  lastInvoiceDate?: string;
  /** Supplier status (active, inactive, suspended) */
  status: 'active' | 'inactive' | 'suspended';
  /** Supplier rating (1-5 stars) */
  rating?: number;
  /** Notes about the supplier */
  notes?: string;
}

/**
 * Bulk operation data for multiple suppliers
 */
export interface BulkSupplierOperation {
  /** Array of supplier IDs to operate on */
  supplierIds: number[];
  /** Type of operation (delete, update_status, export) */
  operation: 'delete' | 'update_status' | 'export';
  /** Additional data for the operation */
  data?: Record<string, any>;
}

/**
 * Supplier search result with highlighting
 */
export interface SupplierSearchResult extends SupplierWithDetails {
  /** Highlighted search terms in supplier name */
  highlightedName?: string;
  /** Highlighted search terms in person name */
  highlightedPersonName?: string;
  /** Search relevance score */
  relevanceScore: number;
}

/**
 * Export options for supplier data
 */
export interface SupplierExportOptions {
  /** Export format (csv, excel, pdf) */
  format: 'csv' | 'excel' | 'pdf';
  /** Fields to include in export */
  fields: string[];
  /** Date range for export */
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  /** Whether to include statistics */
  includeStats: boolean;
}

/**
 * Product supply history interface for supplier information page
 */
export interface ProductSupplyHistory {
  /** Product ID */
  idProduct: number;
  /** Product name */
  productName: string;
  /** Quantity supplied */
  quantitySupplied: number;
  /** Supply date */
  supplyDate: string;
}

/**
 * Supplier information page state interface
 */
export interface SupplierInformationPageState {
  /** Whether the page is in edit mode */
  isEditMode: boolean;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Current error message */
  error: string | null;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
}
