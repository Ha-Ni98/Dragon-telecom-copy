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

export async function getProductById(_id: number): Promise<ProductDetails | null> {
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
