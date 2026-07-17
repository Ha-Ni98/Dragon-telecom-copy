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
} as const;
