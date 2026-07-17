import { z } from 'zod';

const CategoryPriceInputSchema = z.object({
  categoryId: z.uuid(),
  price: z.number().min(0),
});

// XOR: familyId|newFamilyName, brandId|newBrandName; modelId/newModelName mutually exclusive
// (both may be absent — a universal part has no model). initialUnitCost required iff
// initialQuantity > 0; pricing fields forbidden iff initialQuantity === 0 (PRICING_REQUIRES_STOCK).
export const CreateProductSchema = z
  .object({
    barcode: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    familyId: z.uuid().optional(),
    newFamilyName: z.string().optional(),
    brandId: z.uuid().optional(),
    newBrandName: z.string().optional(),
    modelId: z.uuid().optional(),
    newModelName: z.string().optional(),
    initialQuantity: z.number().int().min(0),
    initialUnitCost: z.number().min(0).optional(),
    guestPrice: z.number().min(0).optional(),
    defaultSalePrice: z.number().min(0).optional(),
    categoryPrices: z.array(CategoryPriceInputSchema).optional(),
    reorderThreshold: z.number().int().min(0).optional(),
  })
  .refine((d) => (d.familyId === undefined) !== (d.newFamilyName === undefined), {
    message: 'Exactly one of familyId or newFamilyName is required',
    path: ['familyId'],
  })
  .refine((d) => (d.brandId === undefined) !== (d.newBrandName === undefined), {
    message: 'Exactly one of brandId or newBrandName is required',
    path: ['brandId'],
  })
  .refine((d) => !(d.modelId !== undefined && d.newModelName !== undefined), {
    message: 'modelId and newModelName are mutually exclusive',
    path: ['modelId'],
  })
  .refine((d) => d.initialQuantity === 0 || d.initialUnitCost !== undefined, {
    message: 'initialUnitCost is required when initialQuantity > 0',
    path: ['initialUnitCost'],
  })
  .refine(
    (d) =>
      d.initialQuantity > 0 ||
      (d.guestPrice === undefined &&
        d.defaultSalePrice === undefined &&
        d.categoryPrices === undefined),
    {
      message: 'Pricing fields require initialQuantity > 0 (PRICING_REQUIRES_STOCK)',
      path: ['initialQuantity'],
    },
  );
export type CreateProductCommand = z.infer<typeof CreateProductSchema>;

// Product-core fields only; pricing has its own route/command, and quantity/averageCost
// are owned by inventory — this module never writes them (spec Business Logic #6).
export const UpdateProductSchema = z.object({
  barcode: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  reorderThreshold: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateProductCommand = z.infer<typeof UpdateProductSchema>;

export const UpdatePricingSchema = z.object({
  guestPrice: z.number().min(0).nullable().optional(),
  defaultSalePrice: z.number().min(0).optional(),
  categoryPrices: z.array(CategoryPriceInputSchema).optional(),
});
export type UpdatePricingCommand = z.infer<typeof UpdatePricingSchema>;

export const CreateBrandSchema = z.object({
  name: z.string(),
  logoUrl: z.string().optional(),
});
export type CreateBrandCommand = z.infer<typeof CreateBrandSchema>;

export const UpdateBrandSchema = z.object({
  name: z.string().optional(),
  logoUrl: z.string().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateBrandCommand = z.infer<typeof UpdateBrandSchema>;

export const CreateFamilySchema = z.object({
  name: z.string(),
  parentId: z.uuid().optional(),
  iconUrl: z.string().optional(),
  isFeatured: z.boolean().optional(),
});
export type CreateFamilyCommand = z.infer<typeof CreateFamilySchema>;

export const UpdateFamilySchema = z.object({
  name: z.string().optional(),
  parentId: z.uuid().optional(),
  iconUrl: z.string().optional(),
  isFeatured: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateFamilyCommand = z.infer<typeof UpdateFamilySchema>;

export const CreateModelSchema = z.object({
  brandId: z.uuid(),
  name: z.string(),
});
export type CreateModelCommand = z.infer<typeof CreateModelSchema>;

export const UpdateModelSchema = z.object({
  name: z.string().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateModelCommand = z.infer<typeof UpdateModelSchema>;

export const SetModelFamiliesSchema = z.object({
  familyIds: z.array(z.uuid()),
});
export type SetModelFamiliesCommand = z.infer<typeof SetModelFamiliesSchema>;

// File bytes travel via multipart form-data outside this schema (like platform's Excel
// import); these fields are the accompanying per-image metadata.
export const AddProductImagesSchema = z.object({
  images: z.array(
    z.object({
      alt: z.string().optional(),
      position: z.number().int().min(0).optional(),
      isPrimary: z.boolean().optional(),
    }),
  ),
});
export type AddProductImagesCommand = z.infer<typeof AddProductImagesSchema>;

export const UpdateProductImagesSchema = z.object({
  images: z.array(
    z.object({
      id: z.uuid(),
      alt: z.string().optional(),
      position: z.number().int().min(0).optional(),
      isPrimary: z.boolean().optional(),
    }),
  ),
});
export type UpdateProductImagesCommand = z.infer<typeof UpdateProductImagesSchema>;

export const CreateClientCategorySchema = z.object({
  name: z.string(),
});
export type CreateClientCategoryCommand = z.infer<typeof CreateClientCategorySchema>;

// "name only" (spec) describes what a category creates/holds — isEnabled toggling is the
// universal isEnabled-PATCH convention (Shared Conventions, every module spec).
export const UpdateClientCategorySchema = z.object({
  name: z.string().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateClientCategoryCommand = z.infer<typeof UpdateClientCategorySchema>;
