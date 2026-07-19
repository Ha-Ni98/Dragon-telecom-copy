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

// --- Brands ---

export function useCatalogBrands(admin = false) {
  return useQuery({
    queryKey: qk.catalog.brands.list(admin),
    queryFn: () => catalogService.listBrands(admin),
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateBrandCommand) => catalogService.createBrand(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.brands.all() });
    },
  });
}

export function useUpdateBrand() {
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

export function useCreateFamily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateFamilyCommand) => catalogService.createFamily(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.families.all() });
    },
  });
}

export function useUpdateFamily() {
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

export function useCreateModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateModelCommand) => catalogService.createModel(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.models.all() });
    },
  });
}

export function useUpdateModel() {
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
