import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateClientCategoryCommand,
  UpdateClientCategoryCommand,
} from "@dragon-telecom/contract";
import * as catalogService from "@/services/catalog.service";
import { qk } from "@/lib/query-keys";

export function useClientCategories() {
  return useQuery({
    queryKey: qk.catalog.categories(),
    queryFn: catalogService.listCategories,
  });
}

export function useCreateClientCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateClientCategoryCommand) => catalogService.createCategory(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.categories() });
    },
  });
}

export function useUpdateClientCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateClientCategoryCommand }) =>
      catalogService.updateCategory(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.categories() });
    },
  });
}
