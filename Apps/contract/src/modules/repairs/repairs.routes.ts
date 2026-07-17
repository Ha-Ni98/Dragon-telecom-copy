// Every route continues the LIST/CREATE rows' "(staff|admin)" prefix (the spec elides it
// as "..." on later rows) — split into STAFF_*/ADMIN_* pairs, same pattern as sprint 5.
export const REPAIR_ROUTES = {
  STAFF_LIST: '/staff/repairs',
  ADMIN_LIST: '/admin/repairs',
  STAFF_CREATE: '/staff/repairs',
  ADMIN_CREATE: '/admin/repairs',
  STAFF_UPDATE: '/staff/repairs/:id',
  ADMIN_UPDATE: '/admin/repairs/:id',
  STAFF_PARTS: '/staff/repairs/:id/parts',
  ADMIN_PARTS: '/admin/repairs/:id/parts',
  STAFF_PART_BY_ID: '/staff/repairs/:id/parts/:partId',
  ADMIN_PART_BY_ID: '/admin/repairs/:id/parts/:partId',
  STAFF_STATUS: '/staff/repairs/:id/status',
  ADMIN_STATUS: '/admin/repairs/:id/status',
} as const;
