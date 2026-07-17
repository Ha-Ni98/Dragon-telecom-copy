export const IDENTITY_ROUTES = {
  LOGIN: '/auth/login',
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',
  ME_PERMISSIONS: '/me/permissions',
  USERS: '/admin/users',
  USER_BY_ID: '/admin/users/:id',
  ROLES: '/admin/roles',
  ROLE_BY_ID: '/admin/roles/:id',
  ROLE_PAGES: '/admin/roles/:id/pages',
  PAGES: '/admin/pages',
  TECHNICIANS: '/admin/technicians',
  TECHNICIAN_BY_ID: '/admin/technicians/:id',
} as const;
