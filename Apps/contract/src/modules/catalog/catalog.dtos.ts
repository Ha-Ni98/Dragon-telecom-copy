import { z } from 'zod';
import { StockStatus } from './catalog.enums';

export const ProductImageResponseSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  alt: z.string().optional(),
  position: z.number().int().min(0),
  isPrimary: z.boolean(),
});
export type ProductImageDto = z.infer<typeof ProductImageResponseSchema>;

// Public — no cost, no exact quantities (boolean inStock only), no reserved, no margin.
export const ProductWithPricingResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().optional(),
  barcode: z.string().optional(),
  createdAt: z.iso.datetime(),
  brand: z.object({ id: z.uuid(), name: z.string() }),
  model: z.object({ id: z.uuid(), name: z.string() }).optional(),
  family: z.object({ id: z.uuid(), name: z.string(), iconUrl: z.string().optional() }),
  images: z.array(ProductImageResponseSchema),
  currentPrice: z.number().optional(),
  guestPrice: z.number().optional(),
  priceHidden: z.boolean(),
  inStock: z.boolean(),
  inCart: z.boolean(),
});
export type ProductWithPricingDto = z.infer<typeof ProductWithPricingResponseSchema>;

// Staff — read-only qty + the 4 sale prices, still no cost.
export const StaffProductResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  barcode: z.string().optional(),
  family: z.object({ id: z.uuid(), name: z.string() }),
  brand: z.object({ id: z.uuid(), name: z.string() }),
  model: z.object({ id: z.uuid(), name: z.string() }).optional(),
  availableQuantity: z.number().int().min(0),
  defaultSalePrice: z.number().optional(),
  categoryPrices: z.array(
    z.object({ categoryId: z.uuid(), categoryName: z.string(), price: z.number() }),
  ),
});
export type StaffProductDto = z.infer<typeof StaffProductResponseSchema>;

// Admin — full visibility: exact quantities, averageCost, publish/enable flags.
export const AdminProductResponseSchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  barcode: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  family: z.object({ id: z.uuid(), name: z.string() }),
  brand: z.object({ id: z.uuid(), name: z.string() }),
  model: z.object({ id: z.uuid(), name: z.string() }).optional(),
  guestPrice: z.number().optional(),
  defaultSalePrice: z.number().optional(),
  createdAt: z.iso.datetime(),
  quantityOnHand: z.number().int(),
  quantityReserved: z.number().int(),
  availableQuantity: z.number().int(),
  averageCost: z.number(),
  reorderThreshold: z.number().int().min(0),
  stockStatus: z.enum(StockStatus),
  isPublished: z.boolean(),
  isEnabled: z.boolean(),
});
export type AdminProductDto = z.infer<typeof AdminProductResponseSchema>;

export const ClientCategoryResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isEnabled: z.boolean(),
  memberCount: z.number().int().min(0),
  pricedProductCount: z.number().int().min(0),
});
export type ClientCategoryDto = z.infer<typeof ClientCategoryResponseSchema>;

export const BrandResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().optional(),
  isEnabled: z.boolean(),
});
export type BrandDto = z.infer<typeof BrandResponseSchema>;

// isUniversal reconciled from database-description.md §4 (not in catalog.md's inline sketch).
export const FamilyResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  iconUrl: z.string().optional(),
  parentId: z.uuid().optional(),
  isUniversal: z.boolean(),
  isFeatured: z.boolean(),
  isEnabled: z.boolean(),
});
export type FamilyDto = z.infer<typeof FamilyResponseSchema>;

export const DeviceModelResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  brandId: z.uuid(),
  familyIds: z.array(z.uuid()),
  isEnabled: z.boolean(),
});
export type DeviceModelDto = z.infer<typeof DeviceModelResponseSchema>;

export const ProductStatsResponseSchema = z.object({
  total: z.number().int().min(0),
  inStock: z.number().int().min(0),
  lowStock: z.number().int().min(0),
  outOfStock: z.number().int().min(0),
});
export type ProductStatsDto = z.infer<typeof ProductStatsResponseSchema>;
