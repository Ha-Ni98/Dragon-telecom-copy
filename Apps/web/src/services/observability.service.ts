// Observability domain (activity beacons + audit logs) — Sub-02, contract-typed, HTTP-wired
// (integration plan.md §2.9). No Sub-01 stub existed under this file name; the pre-existing
// `admin-logs.service.ts` stays untouched — real page rewiring is Sub-03.
import { api } from "@/lib/axios";
import { apiPath, withParams } from "@/lib/api-path";
import {
  OBS_ROUTES,
  type ApiResponse,
  type PaginatedResult,
  type ClientActivityCommand,
  type StaffSearchCommand,
  type ClientActivityDto,
  type ClientActivityQuery,
  type StaffSearchDto,
  type StaffSearchesQuery,
  type AuditLogDto,
  type LogsQuery,
  type LogStatsDto,
} from "@dragon-telecom/contract";

// Beacons respond 202 with an envelope of `{success:true,data:null}` — NOT the null-body 204
// case (Sprint 4's noContent() rule doesn't apply here; 202 is not a null-body status, so the
// body does survive the wire). Still unwrap+throw on failure, but there is no data to return.
export async function sendClientActivity(command: ClientActivityCommand): Promise<void> {
  const res = await api.post<ApiResponse<null>>(apiPath(OBS_ROUTES.CLIENT_BEACON), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
}

export async function sendStaffSearch(command: StaffSearchCommand): Promise<void> {
  const res = await api.post<ApiResponse<null>>(apiPath(OBS_ROUTES.STAFF_SEARCH_BEACON), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
}

export async function getClientActivity(
  id: string,
  query: ClientActivityQuery,
): Promise<ClientActivityDto[]> {
  const res = await api.get<ApiResponse<ClientActivityDto[]>>(
    withParams(apiPath(OBS_ROUTES.CLIENT_ACTIVITY), { id }),
    { params: query },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Bare array — StaffSearchesQuery carries no page/limit (integration plan.md §0.2 pagination rule).
export async function listStaffSearches(query: StaffSearchesQuery): Promise<StaffSearchDto[]> {
  const res = await api.get<ApiResponse<StaffSearchDto[]>>(apiPath(OBS_ROUTES.STAFF_SEARCHES), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listLogs(query: LogsQuery): Promise<PaginatedResult<AuditLogDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<AuditLogDto>>>(apiPath(OBS_ROUTES.LOGS), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function logStats(): Promise<LogStatsDto> {
  const res = await api.get<ApiResponse<LogStatsDto>>(apiPath(OBS_ROUTES.LOG_STATS));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
