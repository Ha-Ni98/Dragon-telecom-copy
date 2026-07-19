export interface PlatformUser {
  idUser: number;
  userName: string;
  userPassword: string; // hashed
  userRole: number; // UserRoleCode
}

export interface LogEntry {
  idLog: number;
  idUser: number;
  actionType: number; // ActionTypeCode
  actionDetails: string;
  logCreatedDate: string; // ISO
}

/**
 * Enhanced log entry with user details and formatted data for admin display
 */
export interface AdminLogWithDetails extends LogEntry {
  user: PlatformUser;
  actionTypeLabel: string;
  formattedDate: string;
}

/**
 * Filters for admin logs page
 */
export interface AdminLogsFilters {
  searchQuery: string;
  page: number;
  limit: number;
  userId?: number;
  actionType?: number; // ActionTypeCode
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Paginated response for admin logs
 */
export interface AdminLogsPaginatedResponse {
  logs: AdminLogWithDetails[];
  total: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Statistics for admin logs
 */
export interface AdminLogsStats {
  totalLogs: number;
  logsToday: number;
  logsThisWeek: number;
  logsThisMonth: number;
}

