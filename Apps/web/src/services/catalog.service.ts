// Catalog domain (products/brands/families/models) — Sub-01 scaffolding.
//
// Every function returns a typed empty default (`[]`/`null`). Real HTTP wiring against
// `@dragon-telecom/contract`'s CATALOG_ROUTES lands in Sub-02; per Sub-01 scope decision,
// the return types stay on the existing frontend view models (numeric ids) rather than the
// contract's UUID-based DTOs — that retype happens together with the real wiring.
import type { Brand, Family, Model, ProductDetails } from "@/types/draft-types/product.types";
import type { ProductWithDetails } from "@/types/draft-types/main-page.types";
import type {
  AdminProductWithDetails,
  AdminProductsStats,
  AdminProductsFilters,
  AdminProductsPaginatedResponse,
} from "@/types/draft-types/admin.types";
import type {
  AdminProductWithFullDetails,
  PricingUpdates,
  ProductInformationFormData,
  ProductSupplierWithDetails,
  ImageUploadResponse,
  SupplierUpdateResponse,
  SupplierDeletionResponse,
  SupplierUpdates,
} from "@/types/draft-types/admin-product-information.types";
import type { SupplyFormData } from "@/types/draft-types/admin-supply.types";

// Stub write-paths that would otherwise need to fabricate a full entity throw this instead
// of faking success — real persistence lands in Sub-02, wired against a real product.
const NOT_WIRED = 'This action is not available yet.';

export async function getProducts(): Promise<ProductWithDetails[]> {
  return [];
}

export async function getFeaturedProducts(_limit: number = 4): Promise<ProductWithDetails[]> {
  return [];
}

export async function getProductByName(_name: string): Promise<ProductDetails | null> {
  return null;
}

export async function getProductById(_id: string): Promise<ProductDetails | null> {
  return null;
}

export async function getRelatedProducts(_productId: number, _limit: number = 4): Promise<ProductDetails[]> {
  return [];
}

export async function searchProducts(_query: string): Promise<ProductDetails[]> {
  return [];
}

export async function getBrands(): Promise<Brand[]> {
  return [];
}

export async function getBrandById(_id: number): Promise<Brand | null> {
  return null;
}

export async function getFamilies(): Promise<Family[]> {
  return [];
}

export async function getFamilyById(_id: number): Promise<Family | null> {
  return null;
}

export async function getModels(): Promise<Model[]> {
  return [];
}

export async function getModelById(_id: number): Promise<Model | null> {
  return null;
}

// --- Admin catalog management ---

export async function getAdminProducts(filters?: AdminProductsFilters): Promise<AdminProductsPaginatedResponse> {
  return {
    products: [],
    pagination: {
      currentPage: filters?.page || 1,
      totalPages: 0,
      totalItems: 0,
      itemsPerPage: filters?.limit || 20,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

export async function getAdminProductsStats(): Promise<AdminProductsStats> {
  return { totalProducts: 0, inStock: 0, lowStock: 0, outOfStock: 0 };
}

export async function getAdminProductById(_productId: number): Promise<AdminProductWithDetails | null> {
  return null;
}

export async function deleteAdminProduct(_productId: number): Promise<void> {}

export async function updateAdminProductStock(_productId: number, _newQuantity: number): Promise<void> {}

export async function addAdminProductSupply(_productId: number, _supply: SupplyFormData): Promise<void> {
  throw new Error(NOT_WIRED);
}

export async function getAdminProductsByStockStatus(
  _status: 'in_stock' | 'low_stock' | 'out_of_stock',
): Promise<AdminProductWithDetails[]> {
  return [];
}

export async function searchAdminProducts(
  query: string,
  filters?: Omit<AdminProductsFilters, 'searchQuery'>,
): Promise<AdminProductsPaginatedResponse> {
  return getAdminProducts({ searchQuery: query, ...filters });
}

export async function getAdminProductFullDetails(_productId: number): Promise<AdminProductWithFullDetails | null> {
  return null;
}

export async function updateAdminProductInformation(
  _productId: number,
  _updates: ProductInformationFormData,
): Promise<AdminProductWithFullDetails> {
  throw new Error(NOT_WIRED);
}

export async function updateAdminProductPricing(
  _productId: number,
  _updates: PricingUpdates,
): Promise<AdminProductWithFullDetails> {
  throw new Error(NOT_WIRED);
}

export async function getAdminProductSuppliers(_productId: number): Promise<ProductSupplierWithDetails[]> {
  return [];
}

export async function uploadAdminProductImage(_productId: number, _file: File): Promise<ImageUploadResponse> {
  return { success: true };
}

export async function removeAdminProductImage(
  _productId: number,
  _imageId: string,
): Promise<{ success: boolean; message?: string }> {
  return { success: true };
}

export async function setAdminProductPrimaryImage(
  _productId: number,
  _imageId: string,
): Promise<{ success: boolean; message?: string }> {
  return { success: true };
}

export async function updateAdminProductSupplier(
  _supplierId: number,
  _updates: SupplierUpdates,
): Promise<SupplierUpdateResponse> {
  return { success: true };
}

export async function deleteAdminProductSupplier(_supplierId: number): Promise<SupplierDeletionResponse> {
  return { success: true };
}

// ============================================================================
// Sub-02 real catalog service — contract-typed, HTTP-wired (integration
// plan.md §2.2). Consumed by the new hooks (useCatalogProducts.ts,
// useCatalogTaxonomy.ts, useClientCategories.ts), NOT by the Sub-01 stub
// hooks above — those still call the stub functions above and stay wired to
// the pre-existing pages until Sub-03 rewires those pages onto these real
// hooks (integration sprints.md Sprint 3 handoff note). No name collisions
// with the stub functions above by design (contract verbs: listX/getX vs.
// the stubs' getXs/getXById).
// ============================================================================
import { api } from "@/lib/axios";
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
function commandToFormData(
  command: Record<string, unknown>,
  files: File[],
  filesField: string,
): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(command)) {
    if (value === undefined) continue;
    formData.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  files.forEach((file) => formData.append(filesField, file));
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

export async function productStats(): Promise<ProductStatsDto> {
  const res = await api.get<ApiResponse<ProductStatsDto>>(apiPath(CATALOG_ROUTES.PRODUCT_STATS));
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

export async function createBrand(command: CreateBrandCommand): Promise<BrandDto> {
  const res = await api.post<ApiResponse<BrandDto>>(apiPath(CATALOG_ROUTES.ADMIN_BRANDS), command);
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

export async function createModel(command: CreateModelCommand): Promise<DeviceModelDto> {
  const res = await api.post<ApiResponse<DeviceModelDto>>(
    apiPath(CATALOG_ROUTES.ADMIN_MODELS),
    command,
  );
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
