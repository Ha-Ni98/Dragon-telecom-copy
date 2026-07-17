export const CLIENT_ROUTES = {
  VALIDATE_PHONE: '/api/auth/validate-phone',
  REGISTER: '/api/auth/register',
  ME: '/api/clients/me',
  ME_PASSWORD: '/api/clients/me/password',
  CART: '/api/clients/me/cart',
  CART_ITEM: '/api/clients/me/cart/:productId',
  ADMIN_LIST: '/api/admin/clients',
  ADMIN_STATS: '/api/admin/clients/stats',
  ADMIN_DETAIL: '/api/admin/clients/:id',
  APPROVE: '/api/admin/clients/:id/approve',
  REJECT: '/api/admin/clients/:id/reject',
  RESET_PASSWORD: '/api/admin/clients/:id/reset-password',
  ADMIN_UPDATE: '/api/admin/clients/:id',
} as const;

export const POS_CLIENT_ROUTES = {
  SEARCH: '/api/staff/pos-clients/search',
  QUICK_CREATE: '/api/staff/pos-clients',
  ADMIN: '/api/admin/pos-clients',
  ADMIN_BY_ID: '/api/admin/pos-clients/:id',
} as const;
