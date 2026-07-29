/**
 * Supply form data interface for adding stock to existing products
 */
export interface SupplyFormData {
  quantity: number;
  supplierName: string;
  unitPrice: number;
  noUserPrice?: number;
  categoryPrices: Record<number, number>; // categoryId -> price
}

/**
 * Supply form validation errors interface
 */
export interface SupplyValidationErrors {
  quantity?: string;
  supplierName?: string;
  unitPrice?: string;
  categoryPrices?: Record<number, string>;
}

/**
 * Supply submission result interface
 */
export interface SupplySubmissionResult {
  success: boolean;
  supplyId?: number;
  error?: string;
  validationErrors?: SupplyValidationErrors;
}

/**
 * Existing stock warning interface
 */
export interface ExistingStockWarning {
  hasExistingStock: boolean;
  currentQuantity: number;
  message: string;
}
