import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SupplierListQuery,
  CreateSupplierCommand,
  UpdateSupplierCommand,
} from "@dragon-telecom/contract";
import * as purchasingService from "@/services/purchasing.service";
import { qk } from "@/lib/query-keys";

// Every export is prefixed usePurchasingX — the pre-existing use-admin-suppliers.ts already
// exports useCreateSupplier/useUpdateSupplier/useSupplierById/etc. for AdminSuppliers.tsx
// (Sub-01 stub, untouched, still serving that page until Sub-03).

export function usePurchasingSuppliers(query: SupplierListQuery) {
  return useQuery({
    queryKey: qk.purchasing.suppliers.list(query),
    queryFn: () => purchasingService.listSuppliers(query),
  });
}

export function usePurchasingSupplierStats() {
  return useQuery({
    queryKey: qk.purchasing.suppliers.stats(),
    queryFn: purchasingService.supplierStats,
  });
}

export function usePurchasingSupplierDetail(id: string) {
  return useQuery({
    queryKey: qk.purchasing.suppliers.detail(id),
    queryFn: () => purchasingService.getSupplier(id),
    enabled: !!id,
  });
}

export function useCreatePurchasingSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateSupplierCommand) => purchasingService.createSupplier(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.purchasing.suppliers.all() });
    },
  });
}

export function useUpdatePurchasingSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateSupplierCommand }) =>
      purchasingService.updateSupplier(id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.purchasing.suppliers.all() });
      queryClient.invalidateQueries({ queryKey: qk.purchasing.suppliers.detail(id) });
    },
  });
}
