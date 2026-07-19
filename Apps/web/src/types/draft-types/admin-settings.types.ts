/**
 * Admin Settings Types
 * Type definitions for admin settings page functionality
 */

import { PlatformUser } from './logs.types';
import { ClientCategory } from './client.types';
import { Family, Brand, Model } from './product.types';
import { UserRoleCode, CategoryStatusCode } from './enums.types';

// ============================================================================
// ADMIN ACCOUNT MANAGEMENT
// ============================================================================

/**
 * Form data for creating/editing admin accounts
 */
export interface AdminAccountFormData {
  userName: string;
  password: string;
  confirmPassword: string;
  userRole: UserRoleCode;
}

/**
 * Enhanced admin account interface with additional details for display
 */
export interface AdminAccountWithDetails extends PlatformUser {
  createdDate: string; // ISO date string
  roleLabel: string; // Human-readable role name
  canBeDeleted: boolean; // Whether this admin can be deleted (current user cannot)
}

// ============================================================================
// CLIENT CATEGORY MANAGEMENT
// ============================================================================

/**
 * Form data for creating/editing client categories
 */
export interface ClientCategoryFormData {
  categoryName: string;
  categoryStatus: CategoryStatusCode;
}

// ============================================================================
// PRODUCT HIERARCHY MANAGEMENT
// ============================================================================

/**
 * Form data for creating/editing product families
 */
export interface FamilyFormData {
  familyName: string;
}

/**
 * Form data for creating/editing product brands
 */
export interface BrandFormData {
  brandName: string;
}

/**
 * Form data for creating/editing product models
 */
export interface ModelFormData {
  modelName: string;
  idFamily: number;
  idBrand: number;
}

// ============================================================================
// DELIVERY FEES MANAGEMENT
// ============================================================================

/**
 * Delivery fee data structure
 */
export interface DeliveryFee {
  wilaya: string;
  commune: string;
  deliveryOffice: number; // Delivery fee to office in DA
  deliveryHome: number; // Delivery fee to home in DA
}

/**
 * Form data for delivery fees (matches Excel import format)
 */
export interface DeliveryFeeFormData {
  wilaya: string;
  commune: string;
  deliveryOffice: number;
  deliveryHome: number;
}

/**
 * Result of Excel import operation
 */
export interface ExcelImportResult {
  success: boolean;
  data?: DeliveryFeeFormData[];
  errors?: string[];
  message?: string;
}

// ============================================================================
// SETTINGS PAGE STATE MANAGEMENT
// ============================================================================

/**
 * Main state interface for the admin settings page
 */
export interface AdminSettingsState {
  adminAccounts: AdminAccountWithDetails[];
  clientCategories: ClientCategory[];
  families: Family[];
  brands: Brand[];
  models: Model[];
  deliveryFees: DeliveryFee[];
  isLoading: boolean;
  error: string | null;
  activeSection: 'accounts' | 'categories' | 'hierarchy' | 'delivery';
}

// ============================================================================
// SERVICE RESPONSE TYPES
// ============================================================================

/**
 * Generic service response wrapper
 */
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
}

// ============================================================================
// FORM VALIDATION TYPES
// ============================================================================

/**
 * Admin account form validation errors
 */
export interface AdminAccountFormErrors {
  userName?: string;
  password?: string;
  confirmPassword?: string;
  userRole?: string;
  general?: string;
}

/**
 * Client category form validation errors
 */
export interface ClientCategoryFormErrors {
  categoryName?: string;
  categoryStatus?: string;
  general?: string;
}

/**
 * Model form validation errors
 */
export interface ModelFormErrors {
  modelName?: string;
  idFamily?: string;
  idBrand?: string;
  general?: string;
}

// ============================================================================
// EXCEL FILE HANDLING
// ============================================================================

/**
 * Excel file validation result
 */
export interface ExcelValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: DeliveryFeeFormData[];
  rowCount: number;
}

/**
 * Excel file upload state
 */
export interface ExcelUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  validationResult: ExcelValidationResult | null;
}

// ============================================================================
// DIALOG STATE MANAGEMENT
// ============================================================================

/**
 * Dialog state for admin account operations
 */
export interface AdminAccountDialogState {
  isOpen: boolean;
  mode: 'add' | 'edit';
  adminId?: number;
  isSaving: boolean;
}

/**
 * Dialog state for client category operations
 */
export interface ClientCategoryDialogState {
  isOpen: boolean;
  mode: 'add' | 'edit';
  categoryId?: number;
  isSaving: boolean;
}

/**
 * Dialog state for model operations
 */
export interface ModelDialogState {
  isOpen: boolean;
  mode: 'add' | 'edit';
  modelId?: number;
  isSaving: boolean;
}

// ============================================================================
// HIERARCHY RELATIONSHIP TYPES
// ============================================================================

/**
 * Brand with family relationship for cascading dropdowns
 */
export interface BrandWithFamily extends Brand {
  familyName: string;
}

/**
 * Model with brand and family relationships for cascading dropdowns
 */
export interface ModelWithRelations extends Model {
  brandName: string;
  familyName: string;
}

/**
 * Hierarchy dependency check result
 */
export interface HierarchyDependencyResult {
  canDelete: boolean;
  dependencies: string[];
  message: string;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * Export format options for delivery fees
 */
export type ExportFormat = 'excel' | 'csv' | 'json';

/**
 * Export configuration
 */
export interface ExportConfig {
  format: ExportFormat;
  includeHeaders: boolean;
  filename?: string;
}
