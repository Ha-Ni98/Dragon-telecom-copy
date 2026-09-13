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
} as const;
