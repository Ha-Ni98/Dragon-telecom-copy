export const OBS_ROUTES = {
  CLIENT_BEACON: '/api/activity/client',
  STAFF_SEARCH_BEACON: '/api/activity/staff-search',
  CLIENT_ACTIVITY: '/api/admin/clients/:id/activity',
  STAFF_SEARCHES: '/api/admin/activity/staff-searches',
  LOGS: '/api/admin/logs',
  LOG_STATS: '/api/admin/logs/stats',
} as const;
