import { z } from 'zod';
import { BooleanQuerySchema } from '../../common/types';
import { ProductSort } from './catalog.enums';

export const ProductListQuerySchema = z.object({
  search: z.string().optional(),
  // S15 — the home page's featured strip asks for exactly the products named in
  // settings.storefront.featuredProductIds. Comma-separated, not an array: Express 5 parses query
  // strings with `querystring`, so `ids[]=…` would arrive as a key literally called "ids[]".
  // The regex validates every element at the boundary, so the service can split blindly without
  // risking a Postgres "invalid input syntax for type uuid" 500.
  ids: z
    .string()
    .regex(
      /^[0-9a-fA-F-]{36}(,[0-9a-fA-F-]{36})*$/,
      'ids must be a comma-separated list of uuids',
    )
    .optional(),
  familyId: z.uuid().optional(),
  brandId: z.uuid().optional(),
  modelId: z.uuid().optional(),
  inStock: BooleanQuerySchema.optional(),
  featured: BooleanQuerySchema.optional(),
  sort: z.enum(ProductSort).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

export const FamiliesQuerySchema = z.object({
  featured: BooleanQuerySchema.optional(),
  limit: z.coerce.number().int().min(1).optional(),
  withCount: BooleanQuerySchema.optional(),
});
export type FamiliesQuery = z.infer<typeof FamiliesQuerySchema>;

export const ModelsQuerySchema = z.object({
  brandId: z.uuid().optional(),
});
export type ModelsQuery = z.infer<typeof ModelsQuerySchema>;

export const ProductIdParamsSchema = z.object({ id: z.uuid() });
export type ProductIdParams = z.infer<typeof ProductIdParamsSchema>;

// Two-param route (product + image) — mirrors repairs' RepairPartParamsSchema precedent.
export const ProductImageParamsSchema = z.object({ id: z.uuid(), imageId: z.uuid() });
export type ProductImageParams = z.infer<typeof ProductImageParamsSchema>;

export const BrandIdParamsSchema = z.object({ id: z.uuid() });
export type BrandIdParams = z.infer<typeof BrandIdParamsSchema>;

export const FamilyIdParamsSchema = z.object({ id: z.uuid() });
export type FamilyIdParams = z.infer<typeof FamilyIdParamsSchema>;

export const ModelIdParamsSchema = z.object({ id: z.uuid() });
export type ModelIdParams = z.infer<typeof ModelIdParamsSchema>;

export const CategoryIdParamsSchema = z.object({ id: z.uuid() });
export type CategoryIdParams = z.infer<typeof CategoryIdParamsSchema>;
