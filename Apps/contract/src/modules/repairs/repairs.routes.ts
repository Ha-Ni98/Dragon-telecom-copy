// Every route continues the LIST/CREATE rows' "(staff|admin)" prefix (the spec elides it
// as "..." on later rows) — split into STAFF_*/ADMIN_* pairs, same pattern as sprint 5.
export const REPAIR_ROUTES = {
  STAFF_LIST: '/api/staff/repairs',
  ADMIN_LIST: '/api/admin/repairs',
  STAFF_CREATE: '/api/staff/repairs',
  ADMIN_CREATE: '/api/admin/repairs',
  STAFF_UPDATE: '/api/staff/repairs/:id',
  ADMIN_UPDATE: '/api/admin/repairs/:id',
  STAFF_PARTS: '/api/staff/repairs/:id/parts',
  ADMIN_PARTS: '/api/admin/repairs/:id/parts',
  STAFF_PART_BY_ID: '/api/staff/repairs/:id/parts/:partId',
  ADMIN_PART_BY_ID: '/api/admin/repairs/:id/parts/:partId',
  STAFF_STATUS: '/api/staff/repairs/:id/status',
  ADMIN_STATUS: '/api/admin/repairs/:id/status',
} as const;
