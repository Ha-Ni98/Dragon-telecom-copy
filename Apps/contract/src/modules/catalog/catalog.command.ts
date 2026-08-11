import { z } from 'zod';
import {
  BARCODE_LABEL_MAX_QUANTITY,
  BARCODE_LABEL_SHEET_MAX_ITEMS,
  BARCODE_LABEL_SHEET_MAX_TOTAL,
  BARCODE_LOOKUP_MAX_IDS,
  CATALOG_ERROR,
} from './catalog.constants';

const CategoryPriceInputSchema = z.object({
  categoryId: z.uuid(),
  price: z.coerce.number().min(0),
});

export const zJson = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, schema);

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
    initialQuantity: z.coerce.number().int().min(0),
    initialUnitCost: z.coerce.number().min(0).optional(),
    guestPrice: z.coerce.number().min(0).optional(),
    defaultSalePrice: z.coerce.number().min(0).optional(),
    categoryPrices: zJson(z.array(CategoryPriceInputSchema)).optional(),
    reorderThreshold: z.coerce.number().int().min(0).optional(),
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

// Product-core fields only; pricing has its own route/command, and quantity/avgStockPrice/avgPrice
// are owned by inventory — this module never writes them (spec Business Logic #6).
export const UpdateProductSchema = z.object({
  barcode: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  reorderThreshold: z.coerce.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateProductCommand = z.infer<typeof UpdateProductSchema>;

export const UpdatePricingSchema = z.object({
  guestPrice: z.coerce.number().min(0).nullable().optional(),
  defaultSalePrice: z.coerce.number().min(0).optional(),
  categoryPrices: zJson(z.array(CategoryPriceInputSchema)).optional(),
});
export type UpdatePricingCommand = z.infer<typeof UpdatePricingSchema>;

// S19 — the generator needs the two names its prefix is built from; ids, not names, so the caller
// cannot influence the prefix and the service reads the authoritative rows itself.
export const GenerateBarcodeSchema = z.object({
  familyId: z.uuid(),
  brandId: z.uuid(),
});
export type GenerateBarcodeCommand = z.infer<typeof GenerateBarcodeSchema>;

// S22 — which of these products actually have a printable barcode. The response omits the rest,
// and the caller reports the difference as "N lines skipped" — the absence is never silent.
// Duplicate ids are tolerated (a supplier invoice may list one product on two lines); the service
// de-duplicates before querying.
export const BarcodeLookupSchema = z.object({
  productIds: z.array(z.uuid()).min(1).max(BARCODE_LOOKUP_MAX_IDS),
});
export type BarcodeLookupCommand = z.infer<typeof BarcodeLookupSchema>;

// S22 — one label-sheet request. `items` is ordered and may repeat a productId: the sheet is laid
// out in exactly this order, which for a supplier invoice is invoice-line order.
export const BarcodeLabelSheetSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.uuid(),
          quantity: z.number().int().min(1).max(BARCODE_LABEL_MAX_QUANTITY),
        }),
      )
      .min(1)
      .max(BARCODE_LABEL_SHEET_MAX_ITEMS),
  })
  // Cross-field, so it cannot live on the array element. The message is a contract sentinel, not a
  // sentence, so the web side can translate it (query-client.ts's SENTINEL_TRANSLATION_KEYS).
  .refine(
    (value) => value.items.reduce((total, item) => total + item.quantity, 0) <= BARCODE_LABEL_SHEET_MAX_TOTAL,
    { message: CATALOG_ERROR.BARCODE_LABEL_TOTAL_EXCEEDED, path: ['items'] },
  );
export type BarcodeLabelSheetCommand = z.infer<typeof BarcodeLabelSheetSchema>;

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
  images: zJson(z.array(
    z.object({
      alt: z.string().optional(),
      position: z.number().int().min(0).optional(),
      isPrimary: z.boolean().optional(),
    }),
  )),
});
export type AddProductImagesCommand = z.infer<typeof AddProductImagesSchema>;

export const UpdateProductImagesSchema = z.object({
  images: zJson(z.array(
    z.object({
      id: z.uuid(),
      alt: z.string().optional(),
      position: z.number().int().min(0).optional(),
      isPrimary: z.boolean().optional(),
    }),
  )),
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
