import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateClientCategoryCommand,
  UpdateClientCategoryCommand,
} from "@dragon-telecom/contract";
import * as catalogService from "@/services/catalog.service";
import { qk } from "@/lib/query-keys";

// Named useCatalogClientCategories/useCreateCatalogClientCategory/useUpdateCatalogClientCategory
// (not the shorter useClientCategories/useCreateClientCategory/useUpdateClientCategory),
// discovered necessary in Sprint 5: src/hooks/use-admin-settings.ts (a separate Sub-01 stub
// surface) already exports those exact three names for client-categories-section.tsx. Different
// files never collide at compile time, but identical exported names across two hook files is
// genuinely confusing for Sub-03 — renamed here (this file has zero consumers yet, safe).

export function useCatalogClientCategories() {
  return useQuery({
    queryKey: qk.catalog.categories(),
    queryFn: catalogService.listCategories,
  });
}

export function useCreateCatalogClientCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateClientCategoryCommand) => catalogService.createCategory(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.categories() });
    },
  });
}

export function useUpdateCatalogClientCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateClientCategoryCommand }) =>
      catalogService.updateCategory(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.categories() });
    },
  });
}
