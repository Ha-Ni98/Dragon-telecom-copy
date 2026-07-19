import { z } from 'zod';
import { ProductAddFormData } from '@/types/draft-types/admin-product-add.types';

/**
 * Comprehensive form validation schemas and utilities
 */

// Base validation rules
const barcodeSchema = z.string()
  .min(1, 'Barcode is required')
  .length(13, 'Barcode must be exactly 13 digits')
  .regex(/^\d{13}$/, 'Barcode must contain only numbers');

const productNameSchema = z.string()
  .min(1, 'Product name is required')
  .min(3, 'Product name must be at least 3 characters')
  .max(100, 'Product name must be less than 100 characters')
  .regex(/^[a-zA-Z0-9\s\-&.,()]+$/, 'Product name contains invalid characters');

const familySchema = z.string()
  .min(1, 'Family is required')
  .min(2, 'Family name must be at least 2 characters')
  .max(50, 'Family name must be less than 50 characters');

const brandSchema = z.string()
  .min(1, 'Brand is required')
  .min(2, 'Brand name must be at least 2 characters')
  .max(50, 'Brand name must be less than 50 characters');

const modelSchema = z.string()
  .min(1, 'Model is required')
  .min(2, 'Model name must be at least 2 characters')
  .max(100, 'Model name must be less than 100 characters');

const descriptionSchema = z.string()
  .max(500, 'Description must be less than 500 characters')
  .optional();

const quantitySchema = z.number()
  .min(0, 'Quantity must be at least 0')
  .max(9999, 'Quantity must be less than 10000')
  .int('Quantity must be a whole number');

const supplierSchema = z.number()
  .min(1, 'Supplier is required')
  .int('Supplier ID must be a valid number');

const unitPriceSchema = z.number()
  .min(0.01, 'Unit price must be at least 0.01')
  .max(99999.99, 'Unit price must be less than 100000');

const noUserPriceSchema = z.number()
  .min(0.01, 'No user price must be at least 0.01')
  .max(99999.99, 'No user price must be less than 100000')
  .optional();

const categoryPricesSchema = z.record(z.string(), z.number())
  .refine(
    (prices) => Object.values(prices).every(price => price > 0),
    'All category prices must be greater than 0'
  )
  .optional();

const imagesSchema = z.array(z.instanceof(File))
  .max(3, 'Maximum 3 images allowed')
  .refine(
    (files) => files.every(file => file.size <= 5 * 1024 * 1024),
    'Each image must be less than 5MB'
  )
  .refine(
    (files) => files.every(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)),
    'Only JPEG, PNG, and WebP images are allowed'
  )
  .optional();

// Main form validation schema
export const productAddFormSchema = z.object({
  barcode: barcodeSchema,
  productName: productNameSchema,
  family: familySchema,
  brand: brandSchema,
  model: modelSchema,
  description: descriptionSchema,
  quantity: quantitySchema,
  supplierId: supplierSchema,
  unitPrice: unitPriceSchema,
  noUserPrice: noUserPriceSchema,
  categoryPrices: categoryPricesSchema,
  images: imagesSchema
});

// Conditional validation based on quantity
export const conditionalValidationSchema = z.object({
  barcode: barcodeSchema,
  productName: productNameSchema,
  family: familySchema,
  brand: brandSchema,
  model: modelSchema,
  description: descriptionSchema,
  quantity: quantitySchema,
  supplierId: supplierSchema,
  unitPrice: unitPriceSchema,
  noUserPrice: noUserPriceSchema,
  categoryPrices: z.record(z.string(), z.number()).optional(),
  images: imagesSchema
}).refine(
  (data) => {
    // If quantity > 0, require at least one category price
    if (data.quantity > 0) {
      return data.categoryPrices && Object.keys(data.categoryPrices).length > 0;
    }
    return true;
  },
  {
    message: 'At least one category price is required when quantity > 0',
    path: ['categoryPrices']
  }
);

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
  suggestions: Record<string, string[]>;
}

/**
 * Validate form data with comprehensive checks
 */
export function validateFormData(data: ProductAddFormData): ValidationResult {
  const errors: Record<string, string[]> = {};
  const warnings: Record<string, string[]> = {};
  const suggestions: Record<string, string[]> = {};

  try {
    // Validate with conditional schema
    conditionalValidationSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.issues.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });
    }
  }

  // Additional business logic validations
  validateBusinessRules(data, errors, warnings, suggestions);

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
    suggestions
  };
}

/**
 * Validate business rules
 */
function validateBusinessRules(
  data: ProductAddFormData,
  errors: Record<string, string[]>,
  warnings: Record<string, string[]>,
  suggestions: Record<string, string[]>
): void {
  // Barcode uniqueness (would be checked against database)
  if (data.barcode && isBarcodeUsed(data.barcode)) {
    errors.barcode = errors.barcode || [];
    errors.barcode.push('Barcode already exists in the system');
  }

  // Product name uniqueness (would be checked against database)
  if (data.productName && isProductNameUsed(data.productName)) {
    errors.productName = errors.productName || [];
    errors.productName.push('Product name already exists in the system');
  }

  // Price validation
  if (data.unitPrice && data.noUserPrice) {
    if (data.noUserPrice <= data.unitPrice) {
      warnings.noUserPrice = warnings.noUserPrice || [];
      warnings.noUserPrice.push('No user price should be higher than unit price');
    }
  }

  // Category price validation
  if (data.categoryPrices) {
    Object.entries(data.categoryPrices).forEach(([categoryId, price]) => {
      if (price <= data.unitPrice) {
        warnings[`categoryPrices.${categoryId}`] = warnings[`categoryPrices.${categoryId}`] || [];
        warnings[`categoryPrices.${categoryId}`].push(
          `Category price should be higher than unit price (${data.unitPrice})`
        );
      }
    });
  }

  // Image validation
  if (data.images && data.images.length > 0) {
    data.images.forEach((file, index) => {
      // Check image dimensions (would require async validation)
      if (file.size > 2 * 1024 * 1024) { // 2MB
        warnings[`images.${index}`] = warnings[`images.${index}`] || [];
        warnings[`images.${index}`].push('Large image detected. Consider optimizing for web use.');
      }
    });
  }

  // Suggestions based on common patterns
  if (data.productName && !data.productName.includes(data.brand)) {
    suggestions.productName = suggestions.productName || [];
    suggestions.productName.push('Consider including brand name in product name');
  }
}

/**
 * Mock functions for database checks (would be replaced with actual API calls)
 */
function isBarcodeUsed(barcode: string): boolean {
  // Mock implementation - would check against database
  const usedBarcodes = ['1234567890123', '2345678901234', '3456789012345'];
  return usedBarcodes.includes(barcode);
}

function isProductNameUsed(productName: string): boolean {
  // Mock implementation - would check against database
  const usedNames = ['Samsung Galaxy S24', 'iPhone 15 Pro', 'LG G8 ThinQ'];
  return usedNames.includes(productName);
}

/**
 * Validate individual field
 */
export function validateField(
  fieldName: keyof ProductAddFormData,
  value: any,
  formData: Partial<ProductAddFormData>
): { isValid: boolean; error?: string; warning?: string; suggestion?: string } {
  try {
    // Get the specific schema for the field
    const fieldSchema = productAddFormSchema.shape[fieldName];
    if (fieldSchema) {
      fieldSchema.parse(value);
    }

    // Additional field-specific validations
    switch (fieldName) {
      case 'barcode':
        if (value && isBarcodeUsed(value)) {
          return { isValid: false, error: 'Barcode already exists' };
        }
        break;
      
      case 'productName':
        if (value && isProductNameUsed(value)) {
          return { isValid: false, error: 'Product name already exists' };
        }
        break;
      
      case 'unitPrice':
        if (value && formData.noUserPrice && value >= formData.noUserPrice) {
          return { 
            isValid: true, 
            warning: 'Unit price should be lower than no user price' 
          };
        }
        break;
      
      case 'noUserPrice':
        if (value && formData.unitPrice && value <= formData.unitPrice) {
          return { 
            isValid: true, 
            warning: 'No user price should be higher than unit price' 
          };
        }
        break;
    }

    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.issues[0]?.message };
    }
    return { isValid: false, error: 'Validation error' };
  }
}

/**
 * Get validation messages for display
 */
export function getValidationMessages(
  fieldName: keyof ProductAddFormData,
  value: any,
  formData: Partial<ProductAddFormData>
): {
  error?: string;
  warning?: string;
  suggestion?: string;
  isValid: boolean;
} {
  const validation = validateField(fieldName, value, formData);
  
  return {
    error: validation.error,
    warning: validation.warning,
    suggestion: validation.suggestion,
    isValid: validation.isValid
  };
}

/**
 * Validate form submission
 */
export function validateFormSubmission(data: ProductAddFormData): {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
  canSubmit: boolean;
} {
  const result = validateFormData(data);
  
  // Additional submission-specific validations
  const submissionErrors: Record<string, string[]> = { ...result.errors };
  
  // Require at least one image for product submission
  if (!data.images || data.images.length === 0) {
    submissionErrors.images = submissionErrors.images || [];
    submissionErrors.images.push('At least one product image is required');
  }
  
  // Require category prices when quantity > 0
  if (data.quantity > 0 && (!data.categoryPrices || Object.keys(data.categoryPrices).length === 0)) {
    submissionErrors.categoryPrices = submissionErrors.categoryPrices || [];
    submissionErrors.categoryPrices.push('Category prices are required when quantity > 0');
  }

  return {
    isValid: Object.keys(submissionErrors).length === 0,
    errors: submissionErrors,
    warnings: result.warnings,
    canSubmit: Object.keys(submissionErrors).length === 0
  };
}
