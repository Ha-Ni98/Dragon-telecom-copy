// Observability domain (admin activity logs) — Sub-01 scaffolding. See catalog.service.ts's
// header comment for the numeric-id/view-model scope decision this follows.
import {
  AdminLogsFilters,
  AdminLogsPaginatedResponse,
  AdminLogsStats,
  PlatformUser
} from '@/types/draft-types/logs.types';

export class AdminLogsService {
  static async getLogs(filters: AdminLogsFilters): Promise<AdminLogsPaginatedResponse> {
    return {
      logs: [],
      total: 0,
      totalPages: 0,
      currentPage: filters.page || 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  static async getLogsStats(): Promise<AdminLogsStats> {
    return { totalLogs: 0, logsToday: 0, logsThisWeek: 0, logsThisMonth: 0 };
  }

  static async refreshLogs(): Promise<void> {}
}

// The staff/admin user list a logs-filter dropdown lets you narrow by.
export async function getPlatformUsers(): Promise<PlatformUser[]> {
  return [];
}
