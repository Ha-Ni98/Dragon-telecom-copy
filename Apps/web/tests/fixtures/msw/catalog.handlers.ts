import { http } from "msw";
import { CATALOG_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import {
  mockProductsPaginated,
  mockProductDetail,
  mockStaffProductsPaginated,
  mockAdminProductsPaginated,
  mockAdminProduct,
  mockProductStats,
  mockBrand,
  mockFamily,
  mockFamilyWithCount,
  mockModel,
  mockClientCategory,
} from "../data/catalog.mock";

// CATALOG_ROUTES are full literal paths, including `:id` placeholders — msw matches those as
// path patterns natively (same builder as services, test-rules §3), so the raw route constant
// can be registered as-is without substitution.
export const catalogUrls = {
  brands: apiUrl(CATALOG_ROUTES.BRANDS),
  families: apiUrl(CATALOG_ROUTES.FAMILIES),
  models: apiUrl(CATALOG_ROUTES.MODELS),
  products: apiUrl(CATALOG_ROUTES.PRODUCTS),
  productDetail: apiUrl(CATALOG_ROUTES.PRODUCT_DETAIL),
  staffProducts: apiUrl(CATALOG_ROUTES.STAFF_PRODUCTS),
  adminProducts: apiUrl(CATALOG_ROUTES.ADMIN_PRODUCTS),
  adminProductById: apiUrl(CATALOG_ROUTES.ADMIN_PRODUCT_BY_ID),
  pricing: apiUrl(CATALOG_ROUTES.PRICING),
  images: apiUrl(CATALOG_ROUTES.IMAGES),
  productStats: apiUrl(CATALOG_ROUTES.PRODUCT_STATS),
  adminBrands: apiUrl(CATALOG_ROUTES.ADMIN_BRANDS),
  adminBrandById: apiUrl(CATALOG_ROUTES.ADMIN_BRAND_BY_ID),
  adminFamilies: apiUrl(CATALOG_ROUTES.ADMIN_FAMILIES),
  adminFamilyById: apiUrl(CATALOG_ROUTES.ADMIN_FAMILY_BY_ID),
  adminModels: apiUrl(CATALOG_ROUTES.ADMIN_MODELS),
  adminModelById: apiUrl(CATALOG_ROUTES.ADMIN_MODEL_BY_ID),
  modelFamilies: apiUrl(CATALOG_ROUTES.MODEL_FAMILIES),
  categories: apiUrl(CATALOG_ROUTES.CATEGORIES),
  categoriesCud: apiUrl(CATALOG_ROUTES.CATEGORIES_CUD),
  categoryById: apiUrl(CATALOG_ROUTES.CATEGORY_BY_ID),
};

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3).
export const catalogHandlers = [
  http.get(catalogUrls.brands, () => ok([mockBrand])),
  http.get(catalogUrls.families, ({ request }) => {
    // withCount=true is the one case where the response shape actually differs (FamilyDto.productCount
    // is present only then) — branch on the real query flag rather than a separate named override.
    const withCount = new URL(request.url).searchParams.get("withCount") === "true";
    return ok([withCount ? mockFamilyWithCount : mockFamily]);
  }),
  http.get(catalogUrls.models, () => ok([mockModel])),
  http.get(catalogUrls.products, () => ok(mockProductsPaginated)),
  http.get(catalogUrls.productDetail, () => ok(mockProductDetail)),
  http.get(catalogUrls.staffProducts, () => ok(mockStaffProductsPaginated)),
  // PRODUCT_STATS ("/admin/products/stats") is registered before ADMIN_PRODUCT_BY_ID
  // ("/admin/products/:id") — msw, like the real Express router, matches the first
  // registered handler; a `:id` pattern would otherwise greedily match "stats" (mirrors the
  // backend's own route-ordering comment in catalog.routes.ts).
  http.get(catalogUrls.productStats, () => ok(mockProductStats)),
  http.get(catalogUrls.adminProducts, () => ok(mockAdminProductsPaginated)),
  http.post(catalogUrls.adminProducts, () => ok(mockAdminProduct, 201)),
  http.get(catalogUrls.adminProductById, () => ok(mockAdminProduct)),
  http.patch(catalogUrls.adminProductById, () => ok(mockAdminProduct)),
  http.patch(catalogUrls.pricing, () => ok(mockAdminProduct)),
  http.post(catalogUrls.images, () => ok(mockAdminProduct, 201)),
  http.patch(catalogUrls.images, () => ok(mockAdminProduct)),
  http.get(catalogUrls.adminBrands, () => ok([mockBrand])),
  http.post(catalogUrls.adminBrands, () => ok(mockBrand, 201)),
  http.patch(catalogUrls.adminBrandById, () => ok(mockBrand)),
  http.get(catalogUrls.adminFamilies, () => ok([mockFamily])),
  http.post(catalogUrls.adminFamilies, () => ok(mockFamily, 201)),
  http.patch(catalogUrls.adminFamilyById, () => ok(mockFamily)),
  http.get(catalogUrls.adminModels, () => ok([mockModel])),
  http.post(catalogUrls.adminModels, () => ok(mockModel, 201)),
  http.patch(catalogUrls.adminModelById, () => ok(mockModel)),
  http.put(catalogUrls.modelFamilies, () => ok(mockModel)),
  http.get(catalogUrls.categories, () => ok([mockClientCategory])),
  http.post(catalogUrls.categoriesCud, () => ok(mockClientCategory, 201)),
  http.patch(catalogUrls.categoryById, () => ok(mockClientCategory)),
];

export const catalogErrorHandlers = {
  // The 5 CreateProductSchema .refine() XORs all surface identically at the HTTP boundary —
  // one representative 400 covers the service/hook "throws on validation error" contract;
  // the XOR combinatorics themselves are the contract's own Zod-level concern, not this
  // service's (integration plan.md §4.5).
  createProductValidationError: () =>
    http.post(catalogUrls.adminProducts, () =>
      fail(ErrorCode.VALIDATION_ERROR, "Exactly one of familyId or newFamilyName is required", 400),
    ),
  productDetailNotFound: () =>
    http.get(catalogUrls.productDetail, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Product not found", 404),
    ),
  adminProductNotFound: () =>
    http.get(catalogUrls.adminProductById, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Product not found", 404),
    ),
  pricingValidationError: () =>
    http.patch(catalogUrls.pricing, () =>
      fail(ErrorCode.VALIDATION_ERROR, "guestPrice must be >= 0", 400),
    ),
  brandNotFound: () =>
    http.patch(catalogUrls.adminBrandById, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Brand not found", 404),
    ),
  familyNotFound: () =>
    http.patch(catalogUrls.adminFamilyById, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Family not found", 404),
    ),
  modelNotFound: () =>
    http.patch(catalogUrls.adminModelById, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Model not found", 404),
    ),
  categoryConflict: () =>
    http.post(catalogUrls.categoriesCud, () =>
      fail(ErrorCode.RESOURCE_CONFLICT, "Category name already exists", 409),
    ),
  categoryNotFound: () =>
    http.patch(catalogUrls.categoryById, () =>
      fail(ErrorCode.RESOURCE_NOT_FOUND, "Category not found", 404),
    ),
  adminProductsServerError: () =>
    http.get(catalogUrls.adminProducts, () => fail(ErrorCode.INTERNAL_SERVER_ERROR, "boom", 500)),
};
