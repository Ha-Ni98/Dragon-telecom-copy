import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  CATALOG_ROUTES,
  PageKey,
  PRODUCT_UPLOAD_DIR,
  UserType,
  AddProductImagesSchema,
  BrandIdParamsSchema,
  CategoryIdParamsSchema,
  CreateBrandSchema,
  CreateClientCategorySchema,
  CreateFamilySchema,
  CreateModelSchema,
  CreateProductSchema,
  FamiliesQuerySchema,
  FamilyIdParamsSchema,
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
import { InventoryPortStub } from './inventory.port.stub';
import { CatalogController } from './catalog.controller';

const router = Router();

// 1. Manual DI
const inventory = new InventoryPortStub();
const productService = new CatalogProductService(prisma, inventory);
const taxonomyService = new CatalogTaxonomyService(prisma);
const categoryService = new CatalogCategoryService(prisma);
const controller = new CatalogController(productService, taxonomyService, categoryService);

// Exported for the aggregator (modules/index.ts) to inject the real inventory port once it's
// constructed, replacing the InventoryPortStub above (inventory plan §6, §8 #5).
export const catalogProductService = productService;
// Exposes CatalogProductService.applyPricing as the ICatalogPricingPort shape inventory's
// adjustment flow needs — structural typing means no import of inventory's interface here
// (single import direction: inventory -> catalog, per plan §6).
export const catalogPricingService = productService;

// Product images must persist across requests (unlike platform's import file, which is parsed
// once and discarded from memory) — disk storage with a stable, servable path. No upload env
// knob exists yet (env-template.md lists only AWS_* generically); an in-code constant is the
// plan §7.4-recommended choice pending an owner decision on the real storage backend (local/S3).
// `PRODUCT_UPLOAD_DIR` is shared with app.ts's express.static mount and catalog.service.ts's
// deleteImage (S3) — kept under this local name so the rest of this file is untouched.
const UPLOAD_DIR = PRODUCT_UPLOAD_DIR;
mkdirSync(UPLOAD_DIR, { recursive: true });
const uploadImages = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
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
