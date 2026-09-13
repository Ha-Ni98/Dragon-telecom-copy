export * from "./enums.types";
export * from "./product.types";
export * from "./client.types";
export * from "./supplier.types";
export * from "./order.types";
export * from "./main-page.types";
export * from "./dashboard.types";
export * from "./admin.types";
// ClientCategory/Supplier: admin-product-add.types.ts declares its own local variants that
// collide with client.types.ts/supplier.types.ts's canonical ones — the canonical ones win
// the barrel; import from "./admin-product-add.types" directly for the local variants.
export type {
  ProductAddFormData,
  ProductAddValidationErrors,
  BarcodeGenerationResult,
  ProductNameGenerationResult,
  FormSection,
  AutoGenerationOptions,
  ProductAddFormState,
  SuggestionItem,
  FormSubmissionResult,
  PricingCalculationResult,
  FormFieldConfig,
  FormSectionConfig,
  ProductCreationContext,
  FormValidationRules,
  AutoGenerationSettings,
  FormSubmissionOptions,
} from "./admin-product-add.types";
export * from "./admin-supply.types";
export * from "./admin-statistics.types";
