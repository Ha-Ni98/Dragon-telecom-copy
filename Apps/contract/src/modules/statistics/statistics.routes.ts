export const STATS_ROUTES = {
  ADMIN_DASHBOARD: '/admin/dashboard',
  STAFF_DASHBOARD: '/staff/dashboard',
  OVERVIEW: '/admin/statistics/overview',
  FILTERED: '/admin/statistics/filtered',
  CHARTS: '/admin/statistics/charts/:chart',
  TOP_PRODUCTS: '/admin/statistics/top-products',
  REPORT: '/admin/reports/:type',
  // S33 — the Caisse (admin only): day summary + drill-through document list.
  CASH_REGISTER: '/admin/cash-register',
  CASH_REGISTER_DOCUMENTS: '/admin/cash-register/documents',
} as const;
