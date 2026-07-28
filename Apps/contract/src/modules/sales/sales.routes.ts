// DETAIL is mounted under both /api/staff and /api/admin per the spec's "(staff|admin)"
// notation — split into two literal-path constants (same pattern as CATEGORIES_CUD,
// SUPPLIER_DETAIL, ADMIN_BRANDS/... in earlier sprints).
export const SALE_ROUTES = {
  CREATE_DRAFT: '/staff/sales',
  UPDATE_DRAFT: '/staff/sales/:id',
  // Same path as UPDATE_DRAFT, distinguished only by HTTP verb (DELETE vs PATCH) — its own
  // constant so no call site hardcodes the string (S6/I4).
  DELETE_DRAFT: '/staff/sales/:id',
  CONFIRM: '/staff/sales/:id/confirm',
  STAFF_LIST: '/staff/sales',
  ADMIN_LIST: '/admin/sales',
  STAFF_DETAIL: '/staff/sales/:reference',
  ADMIN_DETAIL: '/admin/sales/:reference',
  // S18/D-2 — staff holding the sales page gets the Returns tab + issue-return, same as admin.
  ADMIN_RETURN: '/admin/returns',
  // Same path as ADMIN_RETURN, distinguished only by HTTP verb (GET vs POST) — its own constant
  // so no call site hardcodes the string (same convention as UPDATE_DRAFT/DELETE_DRAFT above).
  ADMIN_RETURNS_LIST: '/admin/returns',
  STAFF_RETURN: '/staff/returns',
  STAFF_RETURNS_LIST: '/staff/returns',
} as const;
