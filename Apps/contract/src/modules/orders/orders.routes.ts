// BACKOFFICE_LIST/CONFIRM/STATUS/STATS are each mounted under both /api/staff and
// /api/admin per the spec's "(staff|admin)" notation — split into literal-path pairs,
// same pattern used for SALE_ROUTES.STAFF_DETAIL/ADMIN_DETAIL.
export const ORDER_ROUTES = {
  PLACE: '/api/orders',
  MY_LIST: '/api/clients/me/orders',
  MY_CANCEL: '/api/orders/:id/cancel',
  STAFF_LIST: '/api/staff/orders',
  ADMIN_LIST: '/api/admin/orders',
  STAFF_CONFIRM: '/api/staff/orders/:id/confirm',
  ADMIN_CONFIRM: '/api/admin/orders/:id/confirm',
  STAFF_STATUS: '/api/staff/orders/:id/status',
  ADMIN_STATUS: '/api/admin/orders/:id/status',
  CANCEL: '/api/admin/orders/:id/cancel',
  RETURN: '/api/admin/orders/:id/return',
  STAFF_STATS: '/api/staff/orders/stats',
  ADMIN_STATS: '/api/admin/orders/stats',
} as const;
