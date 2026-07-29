import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  ClientActivityCommand,
  StaffSearchCommand,
  ClientActivityQuery,
  StaffSearchesQuery,
  LogsQuery,
} from "@dragon-telecom/contract";
import * as observabilityService from "@/services/observability.service";
import { qk } from "@/lib/query-keys";

// Names distinct from use-admin-logs.ts (usePlatformUsers/useAdminLogs/useAdminLogsStats/
// useRefreshAdminLogs), the pre-existing Sub-01 stub surface still serving AdminLogs.tsx until
// Sub-03.

// Fire-and-forget beacons — `meta:{silentErrorToast:true}` (query-client.ts's mutationCache)
// suppresses the generic backend-message toast so a failed beacon never surfaces to the user
// (plan §2.9). No invalidation: beacons write ephemeral activity rows, not a cache a hook here
// reads back from.
export function useSendClientActivity() {
  return useMutation({
    mutationFn: (command: ClientActivityCommand) =>
      observabilityService.sendClientActivity(command),
    meta: { silentErrorToast: true },
  });
}

export function useSendStaffSearch() {
  return useMutation({
    mutationFn: (command: StaffSearchCommand) => observabilityService.sendStaffSearch(command),
    meta: { silentErrorToast: true },
  });
}

export function useClientActivity(id: string, query: ClientActivityQuery) {
  return useQuery({
    queryKey: qk.observability.clientActivity(id, query),
    queryFn: () => observabilityService.getClientActivity(id, query),
    enabled: !!id,
  });
}

export function useStaffSearches(query: StaffSearchesQuery) {
  return useQuery({
    queryKey: qk.observability.staffSearches(query),
    queryFn: () => observabilityService.listStaffSearches(query),
  });
}

export function useLogs(query: LogsQuery) {
  return useQuery({
    queryKey: qk.observability.logs.list(query),
    queryFn: () => observabilityService.listLogs(query),
  });
}

export function useLogStats() {
  return useQuery({
    queryKey: qk.observability.logStats(),
    queryFn: observabilityService.logStats,
  });
}
