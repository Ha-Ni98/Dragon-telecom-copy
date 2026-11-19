export const PLATFORM_ROUTES = {
  WILAYAS: '/wilayas',
  FEE: '/delivery-fees',
  ADMIN_FEES: '/admin/delivery-fees',
  FEES_IMPORT: '/admin/delivery-fees/import',
  FEES_EXPORT: '/admin/delivery-fees/export',
  SETTINGS: '/admin/settings',
  SETTINGS_PUBLIC: '/settings/public',
  // S26.1 — the one image-upload endpoint. Writes no row: it processes the bytes, stores the
  // derivatives in R2 and returns their URLs. The caller then PATCHes whichever entity should
  // point at them (brand.logoUrl, family.iconUrl, settings.store.logoUrl/printLogoUrl), which is
  // what keeps the "no DB row pointing at a missing object" guarantee — the row is only written
  // after the object exists. Product images keep their own multipart routes (they create the
  // ProductImage rows themselves) but go through the same pipeline service.
  ADMIN_MEDIA_IMAGE: '/admin/media/images',
  // S38 — home hero slider. The public list is the live slides only (active + inside their
  // window, ≤ 5). ADMIN_HERO_SLIDES_ORDER is registered before ADMIN_HERO_SLIDE_BY_ID so "order"
  // is never read as an :id.
  HERO_SLIDES: '/hero-slides',
  ADMIN_HERO_SLIDES: '/admin/hero-slides',
  ADMIN_HERO_SLIDES_ORDER: '/admin/hero-slides/order',
  ADMIN_HERO_SLIDE_BY_ID: '/admin/hero-slides/:id',
} as const;
