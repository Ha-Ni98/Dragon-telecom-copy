import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PosClientSearchQuery,
  CreatePosClientCommand,
  PosClientListQuery,
  UpdatePosClientCommand,
} from "@dragon-telecom/contract";
import * as clientsService from "@/services/clients.service";
import type { PosClientsScope } from "@/services/clients.service";
import { qk } from "@/lib/query-keys";

export function usePosClientSearch(query: PosClientSearchQuery) {
  return useQuery({
    queryKey: qk.posClients.search(query.q),
    queryFn: () => clientsService.searchPosClients(query),
    enabled: !!query.q,
  });
}

export function useQuickCreatePosClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreatePosClientCommand) => clientsService.quickCreatePosClient(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.posClients.all() });
    },
  });
}

// S18/D-5 — scoped, full parity: the staff POS-clients page shares this hook with admin.
export function usePosClientsList(scope: PosClientsScope, query: PosClientListQuery) {
  return useQuery({
    queryKey: qk.posClients.list(scope, query),
    queryFn: () => clientsService.listPosClients(scope, query),
  });
}

export function useCreatePosClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, command }: { scope: PosClientsScope; command: CreatePosClientCommand }) =>
      clientsService.createPosClient(scope, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.posClients.all() });
    },
  });
}

export function useUpdatePosClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      id,
      command,
    }: {
      scope: PosClientsScope;
      id: string;
      command: UpdatePosClientCommand;
    }) => clientsService.updatePosClient(scope, id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.posClients.all() });
      queryClient.invalidateQueries({ queryKey: qk.posClients.detail(id) });
    },
  });
}
