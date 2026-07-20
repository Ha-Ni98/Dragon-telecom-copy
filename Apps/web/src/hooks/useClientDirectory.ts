import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminClientListQuery,
  ApproveClientCommand,
  RejectClientCommand,
  ResetClientPasswordCommand,
  AdminUpdateClientCommand,
} from "@dragon-telecom/contract";
import * as clientsService from "@/services/clients.service";
import { qk } from "@/lib/query-keys";

// Admin client pipeline. Named "Directory" (not "AdminClients") to stay clearly distinct from
// the Sub-01 stub hooks in use-admin-clients.ts (useAdminClients/useAdminClient) and
// use-admin-clients-stats.ts (useAdminClientsStats) — those still serve AdminClients.tsx until
// Sub-03 rewires it onto these real hooks (integration sprints.md Sprint 4).

export function useClientDirectory(query: AdminClientListQuery) {
  return useQuery({
    queryKey: qk.clients.admin.list(query),
    queryFn: () => clientsService.listAdminClients(query),
  });
}

export function useClientDirectoryEntry(id: string) {
  return useQuery({
    queryKey: qk.clients.admin.detail(id),
    queryFn: () => clientsService.getAdminClient(id),
    enabled: !!id,
  });
}

export function useClientDirectoryStats() {
  return useQuery({
    queryKey: qk.clients.admin.stats(),
    queryFn: clientsService.adminClientStats,
  });
}

// Approve/reject cross-invalidate stats (a pending client leaving the pipeline changes the
// pending/approved/rejected counts) — plan.md §2.3.
export function useApproveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: ApproveClientCommand }) =>
      clientsService.approveClient(id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.clients.admin.all() });
      queryClient.invalidateQueries({ queryKey: qk.clients.admin.detail(id) });
    },
  });
}

export function useRejectClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: RejectClientCommand }) =>
      clientsService.rejectClient(id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.clients.admin.all() });
      queryClient.invalidateQueries({ queryKey: qk.clients.admin.detail(id) });
    },
  });
}

export function useResetClientPassword() {
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: ResetClientPasswordCommand }) =>
      clientsService.resetClientPassword(id, command),
  });
}

export function useUpdateClientDirectoryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: AdminUpdateClientCommand }) =>
      clientsService.updateAdminClient(id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.clients.admin.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.clients.admin.all() });
    },
  });
}
