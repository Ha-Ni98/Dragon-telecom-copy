// BACKOFFICE_LIST/STATUS/STATS are each mounted under both /api/staff and /api/admin per the
// spec's "(staff|admin)" notation — split into literal-path pairs, same pattern used for
// SALE_ROUTES.STAFF_DETAIL/ADMIN_DETAIL. STAFF_CONFIRM/ADMIN_CONFIRM removed in S10/R3 — every
// forward transition, including PENDING->CONFIRMED, now goes through STATUS.
export const ORDER_ROUTES = {
  PLACE: '/orders',
  MY_LIST: '/clients/me/orders',
  MY_CANCEL: '/orders/:id/cancel',
  STAFF_LIST: '/staff/orders',
  ADMIN_LIST: '/admin/orders',
  STAFF_STATUS: '/staff/orders/:id/status',
  ADMIN_STATUS: '/admin/orders/:id/status',
  CANCEL: '/admin/orders/:id/cancel',
  RETURN: '/admin/orders/:id/return',
  STAFF_STATS: '/staff/orders/stats',
  ADMIN_STATS: '/admin/orders/stats',
} as const;
