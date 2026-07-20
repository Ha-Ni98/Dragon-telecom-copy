import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FamiliesQuery,
  ModelsQuery,
  CreateBrandCommand,
  UpdateBrandCommand,
  CreateFamilyCommand,
  UpdateFamilyCommand,
  CreateModelCommand,
  UpdateModelCommand,
  SetModelFamiliesCommand,
} from "@dragon-telecom/contract";
import * as catalogService from "@/services/catalog.service";
import { qk } from "@/lib/query-keys";

// Mutation hooks are named useCreateCatalogX/useUpdateCatalogX (not the shorter useCreateX),
// discovered necessary in Sprint 5: src/hooks/use-admin-settings.ts (a separate Sub-01 stub
// surface, unrelated to catalog.service.ts's own stub) independently implements
// useCreateBrand/useUpdateBrand/useCreateFamily/useUpdateFamily/useCreateModel/useUpdateModel
// for AdminProductsAdd.tsx's hierarchy UI. Different files never collide at compile time, but
// identical exported names across two hook files is genuinely confusing for Sub-03 — renamed
// here (this file has zero consumers yet, safe) rather than after more sprints compound it.

// --- Brands ---

export function useCatalogBrands(admin = false) {
  return useQuery({
    queryKey: qk.catalog.brands.list(admin),
    queryFn: () => catalogService.listBrands(admin),
  });
}

export function useCreateCatalogBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateBrandCommand) => catalogService.createBrand(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.brands.all() });
    },
  });
}

export function useUpdateCatalogBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateBrandCommand }) =>
      catalogService.updateBrand(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.brands.all() });
    },
  });
}

// --- Families ---

export function useCatalogFamilies(query: FamiliesQuery = {}, admin = false) {
  return useQuery({
    queryKey: qk.catalog.families.list(query),
    queryFn: () => catalogService.listFamilies(query, admin),
  });
}

export function useCreateCatalogFamily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateFamilyCommand) => catalogService.createFamily(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.families.all() });
    },
  });
}

export function useUpdateCatalogFamily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateFamilyCommand }) =>
      catalogService.updateFamily(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.families.all() });
    },
  });
}

// --- Models ---

export function useCatalogModels(query: ModelsQuery = {}, admin = false) {
  return useQuery({
    queryKey: qk.catalog.models.list(query),
    queryFn: () => catalogService.listModels(query, admin),
  });
}

export function useCreateCatalogModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateModelCommand) => catalogService.createModel(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.models.all() });
    },
  });
}

export function useUpdateCatalogModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateModelCommand }) =>
      catalogService.updateModel(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.models.all() });
    },
  });
}

export function useSetModelFamilies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: SetModelFamiliesCommand }) =>
      catalogService.setModelFamilies(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.models.all() });
    },
  });
}
