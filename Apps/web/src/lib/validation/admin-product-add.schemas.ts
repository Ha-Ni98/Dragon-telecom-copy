import { z } from "zod";

/**
 * Barcode validation schema
 */
export const barcodeSchema = z
  .string()
  .min(1, "Barcode is required")
  .regex(/^[0-9]{13}$/, "Barcode must be exactly 13 digits")
  .refine(
    (barcode) => {
      // Check if barcode is unique (this would be implemented with actual API call)
      return true; // For now, always return true
    },
    {
      message: "Barcode already exists"
    }
  );

/**
 * Product name validation schema
 */
export const productNameSchema = z
  .string()
  .min(1, "Product name is required")
  .min(3, "Product name must be at least 3 characters")
  .max(100, "Product name must be less than 100 characters")
  .trim();

/**
 * Quantity validation schema
 */
export const quantitySchema = z
  .number()
  .min(0, "Quantity must be at least 0")
  .max(9999, "Quantity must be less than 10000")
  .int("Quantity must be a whole number");

/**
 * Unit price validation schema
 */
export const unitPriceSchema = z
  .number()
  .min(0.01, "Unit price must be at least 0.01")
  .max(99999.99, "Unit price must be less than 100000")
  .multipleOf(0.01, "Unit price must have at most 2 decimal places");

/**
 * Optional price validation schema
 */
export const optionalPriceSchema = z
  .number()
  .min(0.01, "Price must be at least 0.01")
  .max(99999.99, "Price must be less than 100000")
  .multipleOf(0.01, "Price must have at most 2 decimal places")
  .optional();

/**
 * Category prices validation schema
 */
export const categoryPricesSchema = z
  .record(
    z.string().transform(Number),
    z.number().min(0.01, "Category price must be at least 0.01")
  )
  .optional();

/**
 * Image file validation schema
 */
export const imageFileSchema = z
  .instanceof(File)
  .refine(
    (file) => file.size <= 5 * 1024 * 1024, // 5MB
    "Image size must be less than 5MB"
  )
  .refine(
    (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    "Only JPEG, PNG, and WebP images are allowed"
  );

/**
 * Images array validation schema
 */
export const imagesSchema = z
  .array(imageFileSchema)
  .max(3, "Maximum 3 images allowed")
  .optional();

/**
 * Family selection validation schema
 */
export const familySchema = z
  .string()
  .min(1, "Family is required");

/**
 * Brand selection validation schema
 */
export const brandSchema = z
  .string()
  .min(1, "Brand is required");

/**
 * Model selection validation schema
 */
export const modelSchema = z
  .string()
  .min(1, "Model is required");

/**
 * Description validation schema
 */
export const descriptionSchema = z
  .string()
  .max(500, "Description must be less than 500 characters")
  .optional();

/**
 * Supplier ID validation schema
 */
export const supplierIdSchema = z
  .number()
  .int("Supplier ID must be a whole number")
  .positive("Supplier ID must be positive")
  .optional();

/**
 * Main product add form validation schema
 */
export const productAddFormSchema = z.object({
  // Basic Information
  barcode: barcodeSchema,
  family: familySchema,
  brand: brandSchema,
  model: modelSchema,
  productName: productNameSchema,
  description: descriptionSchema,
  quantity: quantitySchema,
  supplierId: supplierIdSchema,
  
  // Pricing
  unitPrice: unitPriceSchema,
  noUserPrice: optionalPriceSchema,
  categoryPrices: categoryPricesSchema,
  
  // Images
  images: imagesSchema
}).refine(
  (data) => {
    // If quantity > 0, unit price is required
    if (data.quantity > 0 && data.unitPrice <= 0) {
      return false;
    }
    return true;
  },
  {
    message: "Unit price is required when quantity is greater than 0",
    path: ["unitPrice"]
  }
).refine(
  (data) => {
    // If quantity > 0, at least one category price should be set
    if (data.quantity > 0 && (!data.categoryPrices || Object.keys(data.categoryPrices).length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: "At least one category price is required when quantity is greater than 0",
    path: ["categoryPrices"]
  }
);

/**
 * Barcode generation request schema
 */
export const barcodeGenerationRequestSchema = z.object({
  prefix: z.string().optional(),
  length: z.number().int().min(8).max(20).optional(),
  checkUniqueness: z.boolean().optional()
});

/**
 * Product name generation request schema
 */
export const productNameGenerationRequestSchema = z.object({
  family: z.string().min(1, "Family is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  template: z.string().optional()
});

/**
 * Image upload request schema
 */
export const imageUploadRequestSchema = z.object({
  files: z.array(z.instanceof(File)).min(1).max(3),
  productId: z.number().int().positive().optional(),
  compress: z.boolean().optional()
});

/**
 * Form field validation schemas for individual fields
 */
export const fieldValidationSchemas = {
  barcode: barcodeSchema,
  productName: productNameSchema,
  quantity: quantitySchema,
  unitPrice: unitPriceSchema,
  family: familySchema,
  brand: brandSchema,
  model: modelSchema,
  description: descriptionSchema,
  supplierId: supplierIdSchema,
  noUserPrice: optionalPriceSchema,
  categoryPrices: categoryPricesSchema,
  images: imagesSchema
};

/**
 * Validation error messages
 */
export const validationMessages = {
  barcode: {
    required: "Barcode is required",
    pattern: "Barcode must be exactly 13 digits",
    unique: "Barcode already exists"
  },
  productName: {
    required: "Product name is required",
    minLength: "Product name must be at least 3 characters",
    maxLength: "Product name must be less than 100 characters"
  },
  quantity: {
    required: "Quantity is required",
    min: "Quantity must be at least 0",
    max: "Quantity must be less than 10000",
    integer: "Quantity must be a whole number"
  },
  unitPrice: {
    required: "Unit price is required",
    min: "Unit price must be at least 0.01",
    max: "Unit price must be less than 100000",
    decimal: "Unit price must have at most 2 decimal places"
  },
  family: {
    required: "Family is required"
  },
  brand: {
    required: "Brand is required"
  },
  model: {
    required: "Model is required"
  },
  description: {
    maxLength: "Description must be less than 500 characters"
  },
  supplierId: {
    integer: "Supplier ID must be a whole number",
    positive: "Supplier ID must be positive"
  },
  noUserPrice: {
    min: "Price must be at least 0.01",
    max: "Price must be less than 100000",
    decimal: "Price must have at most 2 decimal places"
  },
  categoryPrices: {
    min: "Category price must be at least 0.01"
  },
  images: {
    maxCount: "Maximum 3 images allowed",
    maxSize: "Image size must be less than 5MB",
    allowedTypes: "Only JPEG, PNG, and WebP images are allowed"
  }
};

/**
 * Type inference from schemas
 */
export type ProductAddFormData = z.infer<typeof productAddFormSchema>;
export type BarcodeGenerationRequest = z.infer<typeof barcodeGenerationRequestSchema>;
export type ProductNameGenerationRequest = z.infer<typeof productNameGenerationRequestSchema>;
export type ImageUploadRequest = z.infer<typeof imageUploadRequestSchema>;
