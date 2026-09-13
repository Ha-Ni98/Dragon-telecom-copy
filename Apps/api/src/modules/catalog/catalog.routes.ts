import { Router } from 'express';
import multer from 'multer';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  CATALOG_ROUTES,
  IMAGE_MAX_UPLOAD_BYTES,
  PageKey,
  UserType,
  AddProductImagesSchema,
  BarcodeLookupSchema,
  BrandIdParamsSchema,
  CategoryIdParamsSchema,
  CreateBrandSchema,
  CreateClientCategorySchema,
  CreateFamilySchema,
  CreateModelSchema,
  CreateProductSchema,
  FamiliesQuerySchema,
  FamilyIdParamsSchema,
  GenerateBarcodeSchema,
  ModelIdParamsSchema,
  ModelsQuerySchema,
  ProductIdParamsSchema,
  ProductImageParamsSchema,
  ProductListQuerySchema,
  SetModelFamiliesSchema,
  UpdateBrandSchema,
  UpdateClientCategorySchema,
  UpdateFamilySchema,
  UpdateModelSchema,
  UpdatePricingSchema,
  UpdateProductImagesSchema,
  UpdateProductSchema,
} from '@dragon-telecom/contract';
import { CatalogProductService, CatalogTaxonomyService, CatalogCategoryService } from './catalog.service';
import type { IInventoryPort } from './catalog.interface';
import { CatalogController } from './catalog.controller';

const router = Router();

// 1. Manual DI
// The real FIFO engine is injected by registerModules() (modules/index.ts) at module-load time,
// before any request is served. This placeholder exists only to satisfy the constructor at that
// ordering. If it is ever actually called the wiring is broken, and it must fail loudly rather
// than write inventory-owned columns behind the FIFO ledger's back (S23 F5 — the stub it replaces
// did exactly that, overwriting avgStockPrice and creating no movement row).
const inventory: IInventoryPort = {
  addLayer: () => {
    throw new Error(
      'CatalogProductService.inventory was never wired — registerModules() must call useInventory() before serving requests',
    );
  },
};
const productService = new CatalogProductService(prisma, inventory);
const taxonomyService = new CatalogTaxonomyService(prisma);
const categoryService = new CatalogCategoryService(prisma);
const controller = new CatalogController(productService, taxonomyService, categoryService);

// Exported for the aggregator (modules/index.ts) to inject the real inventory port once it's
// constructed, replacing the placeholder above (inventory plan §6, §8 #5).
export const catalogProductService = productService;
// Exposes CatalogProductService.applyPricing as the ICatalogPricingPort shape inventory's
// adjustment flow needs — structural typing means no import of inventory's interface here
// (single import direction: inventory -> catalog, per plan §6).
export const catalogPricingService = productService;

// S26.1 — product photos go through the shared image pipeline (processed, then stored in R2 as
// content-addressed WebP + thumbnail); memoryStorage because the Fly filesystem is ephemeral and
// every byte goes straight to sharp. No fileFilter on mimetype: the pipeline sniffs the real type
// from magic bytes, because the declared mimetype is attacker-controlled. The 10 MB ceiling is
// the contract's IMAGE_MAX_UPLOAD_BYTES, shared with the media upload route and the web control.
const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: IMAGE_MAX_UPLOAD_BYTES,
    files: 3,
  },
});

const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });
const staffOrAdmin = requireAuth({ types: [UserType.STAFF, UserType.ADMIN], checkDB: true });
// S18 — the staff product lookup backs three staff pages: the products page itself, the POS
// product search, and the repairs spare-part picker. AND-semantics on STAFF_PRODUCTS 403'd a
// POS-only or repairs-only staff on a call their page cannot work without.
const staffProductLookupOrAdmin = requireAuth({
  types: [UserType.STAFF, UserType.ADMIN],
  anyPages: [PageKey.STAFF_PRODUCTS, PageKey.STAFF_POS, PageKey.STAFF_REPAIRS],
  checkDB: true,
});
// S18 — repairs intake's create-if-absent brand/model (D-3, P4).
const staffRepairsOrAdmin = requireAuth({
  types: [UserType.STAFF, UserType.ADMIN],
  anyPages: [PageKey.STAFF_REPAIRS],
  checkDB: true,
});
// Token shapes the response (viewer-resolved pricing/inCart); it never gates the route itself.
const optionalViewer = requireAuth({ optional: true });

// 2. Routes (validation uses contract schemas per segment)

// --- Public taxonomy ---
router.get(CATALOG_ROUTES.BRANDS, controller.listBrands);
router.get(CATALOG_ROUTES.FAMILIES, validateRequest({ query: FamiliesQuerySchema }), controller.listFamilies);
router.get(CATALOG_ROUTES.MODELS, validateRequest({ query: ModelsQuerySchema }), controller.listModels);

// --- Public / viewer-resolved products ---
router.get(
  CATALOG_ROUTES.PRODUCTS,
  optionalViewer,
  validateRequest({ query: ProductListQuerySchema }),
  controller.listProducts,
);
router.get(
  CATALOG_ROUTES.PRODUCT_DETAIL,
  optionalViewer,
  validateRequest({ params: ProductIdParamsSchema }),
  controller.getProduct,
);

// --- Staff ---
router.get(
  CATALOG_ROUTES.STAFF_PRODUCTS,
  staffProductLookupOrAdmin,
  validateRequest({ query: ProductListQuerySchema }),
  controller.listStaffProducts,
);
router.get(CATALOG_ROUTES.CATEGORIES, staffOrAdmin, controller.listCategories);
// S18 — repairs intake creates a brand/model when absent (S13); the read routes above (BRANDS,
// MODELS) are already public.
router.post(
  CATALOG_ROUTES.STAFF_BRANDS,
  staffRepairsOrAdmin,
  validateRequest({ body: CreateBrandSchema }),
  controller.createBrand,
);
router.post(
  CATALOG_ROUTES.STAFF_MODELS,
  staffRepairsOrAdmin,
  validateRequest({ body: CreateModelSchema }),
  controller.createModel,
);

// --- Admin: products ---
// PRODUCT_STATS ("/admin/products/stats") must be registered before ADMIN_PRODUCT_BY_ID
// ("/admin/products/:id"), or Express would match `:id === "stats"`.
router.get(CATALOG_ROUTES.PRODUCT_STATS, adminOnly, controller.productStats);
// GENERATE_BARCODE ("/admin/products/barcode") shares PRODUCT_STATS's constraint: a literal
// segment under "/admin/products" must be registered before ADMIN_PRODUCT_BY_ID
// ("/admin/products/:id"), or Express would match `:id === "barcode"`.
router.post(
  CATALOG_ROUTES.GENERATE_BARCODE,
  adminOnly,
  validateRequest({ body: GenerateBarcodeSchema }),
  controller.generateBarcode,
);
// S22 — BARCODE_LOOKUP is a literal segment under "/admin/products" and follows the same
// registration rule as PRODUCT_STATS and GENERATE_BARCODE above: literal before
// ADMIN_PRODUCT_BY_ID ("/admin/products/:id"). adminOnly — there is no staff supplier-invoices
// page. S27 deleted the sibling BARCODE_LABELS route (label rendering moved into the browser);
// this lookup remains the supplier-invoice label dialog's only server dependency.
router.post(
  CATALOG_ROUTES.BARCODE_LOOKUP,
  adminOnly,
  validateRequest({ body: BarcodeLookupSchema }),
  controller.lookupBarcodes,
);
router.get(
  CATALOG_ROUTES.ADMIN_PRODUCTS,
  adminOnly,
  validateRequest({ query: ProductListQuerySchema }),
  controller.listAdminProducts,
);
router.post(
  CATALOG_ROUTES.ADMIN_PRODUCTS,
  adminOnly,
  uploadImages.array('images'),
  validateRequest({ body: CreateProductSchema }),
  controller.createProduct,
);
router.get(
  CATALOG_ROUTES.ADMIN_PRODUCT_BY_ID,
  adminOnly,
  validateRequest({ params: ProductIdParamsSchema }),
  controller.getAdminProduct,
);
router.patch(
  CATALOG_ROUTES.ADMIN_PRODUCT_BY_ID,
  adminOnly,
  validateRequest({ params: ProductIdParamsSchema, body: UpdateProductSchema }),
  controller.updateProduct,
);
router.patch(
  CATALOG_ROUTES.PRICING,
  adminOnly,
  validateRequest({ params: ProductIdParamsSchema, body: UpdatePricingSchema }),
  controller.updatePricing,
);
router.post(
  CATALOG_ROUTES.IMAGES,
  adminOnly,
  uploadImages.array('images'),
  validateRequest({ params: ProductIdParamsSchema, body: AddProductImagesSchema }),
  controller.addImages,
);
router.patch(
  CATALOG_ROUTES.IMAGES,
  adminOnly,
  validateRequest({ params: ProductIdParamsSchema, body: UpdateProductImagesSchema }),
  controller.updateImages,
);
router.delete(
  CATALOG_ROUTES.IMAGE_BY_ID,
  adminOnly,
  validateRequest({ params: ProductImageParamsSchema }),
  controller.deleteImage,
);

// --- Admin: taxonomy ---
router.get(CATALOG_ROUTES.ADMIN_BRANDS, adminOnly, controller.listAdminBrands);
router.post(
  CATALOG_ROUTES.ADMIN_BRANDS,
  adminOnly,
  validateRequest({ body: CreateBrandSchema }),
  controller.createBrand,
);
router.patch(
  CATALOG_ROUTES.ADMIN_BRAND_BY_ID,
  adminOnly,
  validateRequest({ params: BrandIdParamsSchema, body: UpdateBrandSchema }),
  controller.updateBrand,
);

router.get(
  CATALOG_ROUTES.ADMIN_FAMILIES,
  adminOnly,
  validateRequest({ query: FamiliesQuerySchema }),
  controller.listAdminFamilies,
);
router.post(
  CATALOG_ROUTES.ADMIN_FAMILIES,
  adminOnly,
  validateRequest({ body: CreateFamilySchema }),
  controller.createFamily,
);
router.patch(
  CATALOG_ROUTES.ADMIN_FAMILY_BY_ID,
  adminOnly,
  validateRequest({ params: FamilyIdParamsSchema, body: UpdateFamilySchema }),
  controller.updateFamily,
);

router.get(
  CATALOG_ROUTES.ADMIN_MODELS,
  adminOnly,
  validateRequest({ query: ModelsQuerySchema }),
  controller.listAdminModels,
);
router.post(
  CATALOG_ROUTES.ADMIN_MODELS,
  adminOnly,
  validateRequest({ body: CreateModelSchema }),
  controller.createModel,
);
router.patch(
  CATALOG_ROUTES.ADMIN_MODEL_BY_ID,
  adminOnly,
  validateRequest({ params: ModelIdParamsSchema, body: UpdateModelSchema }),
  controller.updateModel,
);
router.put(
  CATALOG_ROUTES.MODEL_FAMILIES,
  adminOnly,
  validateRequest({ params: ModelIdParamsSchema, body: SetModelFamiliesSchema }),
  controller.setModelFamilies,
);

// --- Admin: client categories ---
router.post(
  CATALOG_ROUTES.CATEGORIES_CUD,
  adminOnly,
  validateRequest({ body: CreateClientCategorySchema }),
  controller.createCategory,
);
router.patch(
  CATALOG_ROUTES.CATEGORY_BY_ID,
  adminOnly,
  validateRequest({ params: CategoryIdParamsSchema, body: UpdateClientCategorySchema }),
  controller.updateCategory,
);

export { router };
