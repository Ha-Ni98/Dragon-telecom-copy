// DETAIL is mounted under both /api/staff and /api/admin per the spec's "(staff|admin)"
// notation — split into two literal-path constants (same pattern as CATEGORIES_CUD,
// SUPPLIER_DETAIL, ADMIN_BRANDS/... in earlier sprints).
export const SALE_ROUTES = {
  CREATE_DRAFT: '/staff/sales',
  UPDATE_DRAFT: '/staff/sales/:id',
  CONFIRM: '/staff/sales/:id/confirm',
  STAFF_LIST: '/staff/sales',
  ADMIN_LIST: '/admin/sales',
  STAFF_DETAIL: '/staff/sales/:reference',
  ADMIN_DETAIL: '/admin/sales/:reference',
  RETURN: '/admin/returns',
} as const;
