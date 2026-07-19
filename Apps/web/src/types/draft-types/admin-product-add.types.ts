import { Brand, Family, Model } from "./product.types";

/**
 * Client category interface for pricing
 */
export interface ClientCategory {
  idCategory: number;
  categoryName: string;
  description?: string;
}

/**
 * Supplier interface for product suppliers
 */
export interface Supplier {
  idSupplier: number;
  supplierName: string;
  contactInfo?: string;
  email?: string;
  phone?: string;
}

/**
 * Product add form data interface
 */
export interface ProductAddFormData {
  // Basic Information
  barcode: string;
  family: string;
  brand: string;
  model: string;
  productName: string;
  description?: string;
  quantity: number;
  supplierId?: number;
  
  // Pricing
  unitPrice: number;
  noUserPrice?: number;
  categoryPrices: Record<number, number>; // categoryId -> price
  
  // Images
  images: File[];
}

/**
 * Product add validation errors interface
 */
export interface ProductAddValidationErrors {
  barcode?: string;
  family?: string;
  brand?: string;
  model?: string;
  productName?: string;
  quantity?: string;
  unitPrice?: string;
  categoryPrices?: Record<number, string>;
  images?: string;
}

/**
 * Barcode generation result interface
 */
export interface BarcodeGenerationResult {
  barcode: string;
  success: boolean;
  error?: string;
}

/**
 * Product name generation result interface
 */
export interface ProductNameGenerationResult {
  name: string;
  success: boolean;
  error?: string;
}

/**
 * Form section interface for organizing form sections
 */
export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: string[];
}

/**
 * Auto-generation options interface
 */
export interface AutoGenerationOptions {
  generateBarcode: boolean;
  generateName: boolean;
  autoFillFromSelection: boolean;
}

/**
 * Form state interface for managing form state
 */
export interface ProductAddFormState {
  isSubmitting: boolean;
  isValid: boolean;
  errors: ProductAddValidationErrors;
  touched: Record<string, boolean>;
  autoGeneration: AutoGenerationOptions;
}

/**
 * Suggestion item interface for autocomplete suggestions
 */
export interface SuggestionItem {
  id: number;
  name: string;
  type: 'family' | 'brand' | 'model' | 'supplier';
  isNew?: boolean;
}

/**
 * Form submission result interface
 */
export interface FormSubmissionResult {
  success: boolean;
  productId?: number;
  error?: string;
  validationErrors?: ProductAddValidationErrors;
}

/**
 * Image upload result interface
 */
export interface ImageUploadResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

/**
 * Pricing calculation result interface
 */
export interface PricingCalculationResult {
  totalRevenue: number;
  categoryBreakdown: Record<number, number>;
  averagePrice: number;
  isValid: boolean;
  errors: string[];
}

/**
 * Form field configuration interface
 */
export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'file';
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string | number; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: unknown) => string | undefined;
  };
}

/**
 * Form section configuration interface
 */
export interface FormSectionConfig {
  id: string;
  title: string;
  description?: string;
  fields: FormFieldConfig[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

/**
 * Product creation context interface
 */
export interface ProductCreationContext {
  families: Family[];
  brands: Brand[];
  models: Model[];
  suppliers: Supplier[];
  categories: ClientCategory[];
  isLoading: boolean;
  error?: string;
}

/**
 * Form validation rules interface
 */
export interface FormValidationRules {
  barcode: {
    required: boolean;
    pattern?: string;
    unique?: boolean;
  };
  productName: {
    required: boolean;
    minLength?: number;
    maxLength?: number;
  };
  quantity: {
    required: boolean;
    min?: number;
    max?: number;
  };
  unitPrice: {
    required: boolean;
    min?: number;
    max?: number;
  };
  images: {
    maxCount?: number;
    maxSize?: number;
    allowedTypes?: string[];
  };
}

/**
 * Auto-generation settings interface
 */
export interface AutoGenerationSettings {
  barcodePrefix?: string;
  barcodeLength?: number;
  nameTemplate?: string;
  enableAutoFill?: boolean;
  enableSuggestions?: boolean;
}

/**
 * Form submission options interface
 */
export interface FormSubmissionOptions {
  validateBeforeSubmit: boolean;
  showLoadingState: boolean;
  redirectAfterSuccess: boolean;
  redirectPath?: string;
  showSuccessMessage: boolean;
  showErrorMessage: boolean;
}
