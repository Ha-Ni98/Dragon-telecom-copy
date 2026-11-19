// Catalog domain (products/brands/families/models) — contract-typed, HTTP-wired (integration
// plan.md §2.2). The Sub-01 stub functions this file used to also carry (getRelatedProducts/
// searchProducts/getBrands/getBrandById/getFamilies/getFamilyById/getModels/getModelById plus
// the getAdminProduct*/updateAdminProduct*/deleteAdminProduct* admin-catalog block) were removed
// set-04 Sprint 9: the products page (AdminProducts.tsx/AdminProductsAdd.tsx/
// AdminProductInformation.tsx) was confirmed already fully wired onto the real hooks below
// (useCatalogProducts.ts/useCatalogTaxonomy.ts) with zero remaining stub consumers — the
// `use-brands.ts`/`use-models.ts` hooks a stale header comment once pointed to no longer exist.
import { api, baseURL } from "@/lib/axios";
import { apiPath, withParams } from "@/lib/api-path";
import {
  CATALOG_ROUTES,
  type ApiResponse,
  type PaginatedResult,
  type ProductListQuery,
  type ProductWithPricingDto,
  type ProductDetailDto,
  type StaffProductDto,
  type AdminProductDto,
  type CreateProductCommand,
  type UpdateProductCommand,
  type UpdatePricingCommand,
  type AddProductImagesCommand,
  type UpdateProductImagesCommand,
  type ProductStatsDto,
  type GenerateBarcodeCommand,
  type GeneratedBarcodeDto,
  type BarcodeLookupCommand,
  type BarcodeLookupDto,
  type BrandDto,
  type CreateBrandCommand,
  type UpdateBrandCommand,
  type FamiliesQuery,
  type FamilyDto,
  type CreateFamilyCommand,
  type UpdateFamilyCommand,
  type ModelsQuery,
  type DeviceModelDto,
  type CreateModelCommand,
  type UpdateModelCommand,
  type SetModelFamiliesCommand,
  type ClientCategoryDto,
  type CreateClientCategoryCommand,
  type UpdateClientCategoryCommand,
} from "@dragon-telecom/contract";

// Standard multipart convention: scalars stringified, objects/arrays JSON-stringified, files
// appended last under `filesField`. NOTE (discovered gap, not a frontend fix): the real
// backend's CreateProductSchema/AddProductImagesSchema use strict `z.number()`/`z.boolean()`
// (not `.coerce`) with no JSON.parse preprocessing in validate-request.middleware.ts, so a
// multer-parsed body (all-string fields) will 400 against the live API regardless of encoding
// — flagged for a contract/backend fix, out of scope for this frontend service.
export function commandToFormData(
  command: Record<string, unknown>,
  files: File[],
  filesField: string,
): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(command)) {
    if (value === undefined) continue;

    if (value === null) {
      formData.append(key, "null");
    } else if (value instanceof Date) {
      formData.append(key, value.toISOString());
    } else if (Array.isArray(value) || typeof value === "object") {
      formData.append(key, JSON.stringify(value));
    } else {
      // string | number | boolean | bigint
      formData.append(key, String(value));
    }
  }

  for (const file of files) {
    formData.append(filesField, file);
  }

  return formData;
}

export async function listProducts(
  query: ProductListQuery,
): Promise<PaginatedResult<ProductWithPricingDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<ProductWithPricingDto>>>(
    apiPath(CATALOG_ROUTES.PRODUCTS),
    {
      params: query,
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// S39 — the home "New arrivals" row: viewer-priced, newest first, ≤ 3 per family (server-side).
export async function listNewArrivals(limit: number): Promise<ProductWithPricingDto[]> {
  const res = await api.get<ApiResponse<ProductWithPricingDto[]>>(
    apiPath(CATALOG_ROUTES.PRODUCTS_NEW_ARRIVALS),
    { params: { limit } },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getProduct(id: string): Promise<ProductDetailDto> {
  const res = await api.get<ApiResponse<ProductDetailDto>>(
    withParams(apiPath(CATALOG_ROUTES.PRODUCT_DETAIL), { id }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listStaffProducts(
  query: ProductListQuery,
): Promise<PaginatedResult<StaffProductDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<StaffProductDto>>>(
    apiPath(CATALOG_ROUTES.STAFF_PRODUCTS),
    {
      params: query,
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listAdminProducts(
  query: ProductListQuery,
): Promise<PaginatedResult<AdminProductDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<AdminProductDto>>>(
    apiPath(CATALOG_ROUTES.ADMIN_PRODUCTS),
    {
      params: query,
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createProduct(
  command: CreateProductCommand,
  images: File[],
): Promise<AdminProductDto> {
  const res = await api.post<ApiResponse<AdminProductDto>>(
    apiPath(CATALOG_ROUTES.ADMIN_PRODUCTS),
    commandToFormData(command, images, "images"),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getAdminProduct(id: string): Promise<AdminProductDto> {
  const res = await api.get<ApiResponse<AdminProductDto>>(
    withParams(apiPath(CATALOG_ROUTES.ADMIN_PRODUCT_BY_ID), { id }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateProduct(
  id: string,
  command: UpdateProductCommand,
): Promise<AdminProductDto> {
  const res = await api.patch<ApiResponse<AdminProductDto>>(
    withParams(apiPath(CATALOG_ROUTES.ADMIN_PRODUCT_BY_ID), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updatePricing(
  id: string,
  command: UpdatePricingCommand,
): Promise<AdminProductDto> {
  const res = await api.patch<ApiResponse<AdminProductDto>>(
    withParams(apiPath(CATALOG_ROUTES.PRICING), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function addImages(
  id: string,
  command: AddProductImagesCommand,
  images: File[],
): Promise<AdminProductDto> {
  const res = await api.post<ApiResponse<AdminProductDto>>(
    withParams(apiPath(CATALOG_ROUTES.IMAGES), { id }),
    commandToFormData(command, images, "images"),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateImages(
  id: string,
  command: UpdateProductImagesCommand,
): Promise<AdminProductDto> {
  const res = await api.patch<ApiResponse<AdminProductDto>>(
    withParams(apiPath(CATALOG_ROUTES.IMAGES), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function deleteImage(id: string, imageId: string): Promise<AdminProductDto> {
  const res = await api.delete<ApiResponse<AdminProductDto>>(
    withParams(apiPath(CATALOG_ROUTES.IMAGE_BY_ID), { id, imageId }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function productStats(): Promise<ProductStatsDto> {
  const res = await api.get<ApiResponse<ProductStatsDto>>(apiPath(CATALOG_ROUTES.PRODUCT_STATS));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function generateBarcode(
  command: GenerateBarcodeCommand,
): Promise<GeneratedBarcodeDto> {
  const res = await api.post<ApiResponse<GeneratedBarcodeDto>>(
    apiPath(CATALOG_ROUTES.GENERATE_BARCODE),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function lookupBarcodes(command: BarcodeLookupCommand): Promise<BarcodeLookupDto> {
  const res = await api.post<ApiResponse<BarcodeLookupDto>>(
    apiPath(CATALOG_ROUTES.BARCODE_LOOKUP),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// `admin` selects ADMIN_BRANDS (includes disabled rows) vs. the public BRANDS list.
export async function listBrands(admin = false): Promise<BrandDto[]> {
  const res = await api.get<ApiResponse<BrandDto[]>>(
    apiPath(admin ? CATALOG_ROUTES.ADMIN_BRANDS : CATALOG_ROUTES.BRANDS),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// S18/D-3 — repairs intake's create-if-absent brand also needs a staff-reachable path;
// `admin = true` keeps every existing admin caller (Settings hierarchy, Add Product) unchanged.
export async function createBrand(command: CreateBrandCommand, admin = true): Promise<BrandDto> {
  const route = admin ? CATALOG_ROUTES.ADMIN_BRANDS : CATALOG_ROUTES.STAFF_BRANDS;
  const res = await api.post<ApiResponse<BrandDto>>(apiPath(route), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateBrand(id: string, command: UpdateBrandCommand): Promise<BrandDto> {
  const res = await api.patch<ApiResponse<BrandDto>>(
    withParams(apiPath(CATALOG_ROUTES.ADMIN_BRAND_BY_ID), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listFamilies(query: FamiliesQuery = {}, admin = false): Promise<FamilyDto[]> {
  const res = await api.get<ApiResponse<FamilyDto[]>>(
    apiPath(admin ? CATALOG_ROUTES.ADMIN_FAMILIES : CATALOG_ROUTES.FAMILIES),
    { params: query },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createFamily(command: CreateFamilyCommand): Promise<FamilyDto> {
  const res = await api.post<ApiResponse<FamilyDto>>(
    apiPath(CATALOG_ROUTES.ADMIN_FAMILIES),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateFamily(id: string, command: UpdateFamilyCommand): Promise<FamilyDto> {
  const res = await api.patch<ApiResponse<FamilyDto>>(
    withParams(apiPath(CATALOG_ROUTES.ADMIN_FAMILY_BY_ID), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listModels(
  query: ModelsQuery = {},
  admin = false,
): Promise<DeviceModelDto[]> {
  const res = await api.get<ApiResponse<DeviceModelDto[]>>(
    apiPath(admin ? CATALOG_ROUTES.ADMIN_MODELS : CATALOG_ROUTES.MODELS),
    { params: query },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// S18/D-3 — same staff/admin split as createBrand above.
export async function createModel(
  command: CreateModelCommand,
  admin = true,
): Promise<DeviceModelDto> {
  const route = admin ? CATALOG_ROUTES.ADMIN_MODELS : CATALOG_ROUTES.STAFF_MODELS;
  const res = await api.post<ApiResponse<DeviceModelDto>>(apiPath(route), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateModel(
  id: string,
  command: UpdateModelCommand,
): Promise<DeviceModelDto> {
  const res = await api.patch<ApiResponse<DeviceModelDto>>(
    withParams(apiPath(CATALOG_ROUTES.ADMIN_MODEL_BY_ID), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function setModelFamilies(
  id: string,
  command: SetModelFamiliesCommand,
): Promise<DeviceModelDto> {
  const res = await api.put<ApiResponse<DeviceModelDto>>(
    withParams(apiPath(CATALOG_ROUTES.MODEL_FAMILIES), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listCategories(): Promise<ClientCategoryDto[]> {
  const res = await api.get<ApiResponse<ClientCategoryDto[]>>(apiPath(CATALOG_ROUTES.CATEGORIES));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createCategory(
  command: CreateClientCategoryCommand,
): Promise<ClientCategoryDto> {
  const res = await api.post<ApiResponse<ClientCategoryDto>>(
    apiPath(CATALOG_ROUTES.CATEGORIES_CUD),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateCategory(
  id: string,
  command: UpdateClientCategoryCommand,
): Promise<ClientCategoryDto> {
  const res = await api.patch<ApiResponse<ClientCategoryDto>>(
    withParams(apiPath(CATALOG_ROUTES.CATEGORY_BY_ID), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
