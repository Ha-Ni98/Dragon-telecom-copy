import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SupplierInvoiceListQuery,
  CreateSupplierInvoiceCommand,
  UpdateSupplierInvoiceCommand,
  CancelSupplierInvoiceCommand,
} from "@dragon-telecom/contract";
import * as purchasingService from "@/services/purchasing.service";
import { qk } from "@/lib/query-keys";

// `options.enabled` (set-03 Sprint 6) — ADM-14's read-only Incoming tab is lazy-per-tab
// (plan.md §5), same reason as useInvoices'/useClientPayments' own `enabled` option.
export function usePurchasingInvoices(
  query: SupplierInvoiceListQuery,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: qk.purchasing.invoices.list(query),
    queryFn: () => purchasingService.listSupplierInvoices(query),
    enabled: options?.enabled,
  });
}

export function usePurchasingInvoiceDetail(id: string) {
  return useQuery({
    queryKey: qk.purchasing.invoices.detail(id),
    queryFn: () => purchasingService.getSupplierInvoice(id),
    enabled: !!id,
  });
}

export function useCreatePurchasingInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateSupplierInvoiceCommand) =>
      purchasingService.createSupplierInvoice(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.purchasing.invoices.all() });
      queryClient.invalidateQueries({ queryKey: qk.purchasing.suppliers.all() });
    },
  });
}

export function useUpdatePurchasingInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateSupplierInvoiceCommand }) =>
      purchasingService.updateSupplierInvoice(id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.purchasing.invoices.all() });
      queryClient.invalidateQueries({ queryKey: qk.purchasing.invoices.detail(id) });
    },
  });
}

// Confirming a DRAFT invoice books stock (FIFO layers) and may reprice products — cross-
// invalidates inventory + catalog admin products + the supplier's own credit, per plan.md §3.
export function useConfirmPurchasingInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchasingService.confirmSupplierInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.purchasing.invoices.all() });
      queryClient.invalidateQueries({ queryKey: qk.purchasing.suppliers.all() });
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
    },
  });
}

export function useCancelPurchasingInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: CancelSupplierInvoiceCommand }) =>
      purchasingService.cancelSupplierInvoice(id, command),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.purchasing.invoices.all() });
      queryClient.invalidateQueries({ queryKey: qk.purchasing.invoices.detail(id) });
    },
  });
}
