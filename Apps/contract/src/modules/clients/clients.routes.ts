export const CLIENT_ROUTES = {
  VALIDATE_PHONE: '/auth/validate-phone',
  REGISTER: '/auth/register',
  ME: '/clients/me',
  ME_PASSWORD: '/clients/me/password',
  CART: '/clients/me/cart',
  CART_ITEM: '/clients/me/cart/:productId',
  ADMIN_LIST: '/admin/clients',
  ADMIN_STATS: '/admin/clients/stats',
  ADMIN_DETAIL: '/admin/clients/:id',
  ADMIN_OVERVIEW: '/admin/clients/:id/overview',
  APPROVE: '/admin/clients/:id/approve',
  REJECT: '/admin/clients/:id/reject',
  RESET_PASSWORD: '/admin/clients/:id/reset-password',
  ADMIN_UPDATE: '/admin/clients/:id',
} as const;

export const POS_CLIENT_ROUTES = {
  SEARCH: '/staff/pos-clients/search',
  QUICK_CREATE: '/staff/pos-clients',
  ADMIN: '/admin/pos-clients',
  ADMIN_BY_ID: '/admin/pos-clients/:id',
  // S18 — the staff POS-clients page (D-5). Creation reuses QUICK_CREATE: it already validates
  // the full CreatePosClientSchema and its service method is literally createPosClientRow, the
  // same one the admin POST calls — so no third create path is needed. STAFF_LIST is the same
  // path as QUICK_CREATE, distinguished by verb (GET vs POST).
  STAFF_LIST: '/staff/pos-clients',
  STAFF_BY_ID: '/staff/pos-clients/:id',
} as const;
