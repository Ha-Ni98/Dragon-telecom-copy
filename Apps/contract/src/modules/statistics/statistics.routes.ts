export const STATS_ROUTES = {
  ADMIN_DASHBOARD: '/api/admin/dashboard',
  STAFF_DASHBOARD: '/api/staff/dashboard',
  OVERVIEW: '/api/admin/statistics/overview',
  FILTERED: '/api/admin/statistics/filtered',
  CHARTS: '/api/admin/statistics/charts/:chart',
  TOP_PRODUCTS: '/api/admin/statistics/top-products',
  REPORT: '/api/admin/reports/:type',
} as const;
