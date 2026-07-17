// DETAIL is mounted under both /api/staff and /api/admin per the spec's "(staff|admin)"
// notation — split into two literal-path constants (same pattern as CATEGORIES_CUD,
// SUPPLIER_DETAIL, ADMIN_BRANDS/... in earlier sprints).
export const SALE_ROUTES = {
  CREATE_DRAFT: '/api/staff/sales',
  UPDATE_DRAFT: '/api/staff/sales/:id',
  CONFIRM: '/api/staff/sales/:id/confirm',
  STAFF_LIST: '/api/staff/sales',
  ADMIN_LIST: '/api/admin/sales',
  STAFF_DETAIL: '/api/staff/sales/:reference',
  ADMIN_DETAIL: '/api/admin/sales/:reference',
  RETURN: '/api/admin/returns',
} as const;
