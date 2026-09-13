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
  PRODUCT_STATS: '/admin/products/stats',
  // S19 — barcode generation. A POST (not a GET) because each call must yield a *fresh* value:
  // nothing is written, but the response is deliberately non-idempotent and must never be cached
  // by a browser or a proxy. Registered before ADMIN_PRODUCT_BY_ID for the same reason
  // PRODUCT_STATS is (see catalog.routes.ts in the api).
  GENERATE_BARCODE: '/admin/products/barcode',
  // S22 — barcode label printing. Both are POSTs: BARCODE_LOOKUP takes an id array (too long for a
  // query string) and BARCODE_LABELS takes a per-line quantity map. Both are literal segments
  // under "/admin/products" and must be registered before ADMIN_PRODUCT_BY_ID for the same reason
  // PRODUCT_STATS and GENERATE_BARCODE are (see catalog.routes.ts in the api).
  BARCODE_LOOKUP: '/admin/products/barcode-lookup',
  BARCODE_LABELS: '/admin/products/barcode-labels',
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
