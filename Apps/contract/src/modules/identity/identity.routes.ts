export const IDENTITY_ROUTES = {
  LOGIN: '/api/auth/login',
  REFRESH: '/api/auth/refresh',
  LOGOUT: '/api/auth/logout',
  ME_PERMISSIONS: '/api/me/permissions',
  USERS: '/api/admin/users',
  USER_BY_ID: '/api/admin/users/:id',
  ROLES: '/api/admin/roles',
  ROLE_BY_ID: '/api/admin/roles/:id',
  ROLE_PAGES: '/api/admin/roles/:id/pages',
  PAGES: '/api/admin/pages',
  TECHNICIANS: '/api/admin/technicians',
  TECHNICIAN_BY_ID: '/api/admin/technicians/:id',
} as const;
