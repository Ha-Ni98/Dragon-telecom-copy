// Every route continues the LIST/CREATE rows' "(staff|admin)" prefix (the spec elides it
// as "..." on later rows) — split into STAFF_*/ADMIN_* pairs, same pattern as sprint 5.
export const REPAIR_ROUTES = {
  STAFF_LIST: '/staff/repairs',
  ADMIN_LIST: '/admin/repairs',
  STAFF_CREATE: '/staff/repairs',
  ADMIN_CREATE: '/admin/repairs',
  // set-03 B1 — single-ticket read (ADM-13/STF-07 ticket detail); shares STAFF_UPDATE/
  // ADMIN_UPDATE's `:id` path, mounted on GET instead of PATCH.
  STAFF_BY_ID: '/staff/repairs/:id',
  ADMIN_BY_ID: '/admin/repairs/:id',
  STAFF_UPDATE: '/staff/repairs/:id',
  ADMIN_UPDATE: '/admin/repairs/:id',
  STAFF_PARTS: '/staff/repairs/:id/parts',
  ADMIN_PARTS: '/admin/repairs/:id/parts',
  STAFF_PART_BY_ID: '/staff/repairs/:id/parts/:partId',
  ADMIN_PART_BY_ID: '/admin/repairs/:id/parts/:partId',
  STAFF_STATUS: '/staff/repairs/:id/status',
  ADMIN_STATUS: '/admin/repairs/:id/status',
  // S13/D5 — cumulative payment at any pre-pickup step.
  STAFF_PAYMENTS: '/staff/repairs/:id/payments',
  ADMIN_PAYMENTS: '/admin/repairs/:id/payments',
  // S13/R1 — the admin Technicians tab. Mounted OUTSIDE /admin/repairs on purpose: a
  // /admin/repairs/technicians path would be swallowed by ADMIN_BY_ID's uuid-validated :id.
  ADMIN_TECHNICIAN_STATS: '/admin/repair-technicians',
  // S18/D-3 — staff Technicians tab (sees stats, cannot add a technician). Mounted outside
  // '/staff/repairs/…' for the same reason ADMIN_TECHNICIAN_STATS is.
  STAFF_TECHNICIAN_STATS: '/staff/repair-technicians',
} as const;
