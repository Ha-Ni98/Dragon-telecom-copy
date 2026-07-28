export const CATALOG_ROUTES = {
  BRANDS: '/brands',
  FAMILIES: '/families',
  MODELS: '/models',
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/products/:id',
  STAFF_PRODUCTS: '/staff/products',
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_PRODUCT_BY_ID: '/admin/products/:id',
  PRICING: '/admin/products/:id/pricing',
  IMAGES: '/admin/products/:id/images',
  IMAGE_BY_ID: '/admin/products/:id/images/:imageId',
  IMAGE: '/uploads/:id',
  PRODUCT_STATS: '/admin/products/stats',
  ADMIN_BRANDS: '/admin/brands',
  ADMIN_BRAND_BY_ID: '/admin/brands/:id',
  ADMIN_FAMILIES: '/admin/families',
  ADMIN_FAMILY_BY_ID: '/admin/families/:id',
  ADMIN_MODELS: '/admin/models',
  ADMIN_MODEL_BY_ID: '/admin/models/:id',
  MODEL_FAMILIES: '/admin/models/:id/families',
  // S18 — repairs intake creates a brand/model when absent (S13). The read routes (BRANDS,
  // MODELS) are already public; only creation needed a staff-reachable path.
  STAFF_BRANDS: '/staff/brands',
  STAFF_MODELS: '/staff/models',
  CATEGORIES: '/admin/client-categories',
  CATEGORIES_CUD: '/admin/client-categories',
  CATEGORY_BY_ID: '/admin/client-categories/:id',
} as const;

// The on-disk directory product images are written to and served from. Shared because three
// places must agree on it: multer's destination, express.static's mount, and the delete path.
export const PRODUCT_UPLOAD_DIR = 'uploads';
