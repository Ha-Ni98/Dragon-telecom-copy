import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PosClientSearchQuery,
  CreatePosClientCommand,
  PosClientListQuery,
  UpdatePosClientCommand,
} from "@dragon-telecom/contract";
import * as clientsService from "@/services/clients.service";
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

export function usePosClientsList(query: PosClientListQuery) {
  return useQuery({
    queryKey: qk.posClients.list(query),
    queryFn: () => clientsService.listPosClients(query),
  });
}

export function useCreatePosClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreatePosClientCommand) => clientsService.createPosClient(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.posClients.all() });
    },
  });
}

export function useUpdatePosClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdatePosClientCommand }) =>
      clientsService.updatePosClient(id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.posClients.all() });
      queryClient.invalidateQueries({ queryKey: qk.posClients.detail(id) });
    },
  });
}
