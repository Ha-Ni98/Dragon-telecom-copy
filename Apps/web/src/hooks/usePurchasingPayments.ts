import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SupplierPaymentListQuery,
  CreateSupplierPaymentCommand,
} from "@dragon-telecom/contract";
import * as purchasingService from "@/services/purchasing.service";
import { qk } from "@/lib/query-keys";

export function usePurchasingPayments(query: SupplierPaymentListQuery) {
  return useQuery({
    queryKey: qk.purchasing.payments.list(query),
    queryFn: () => purchasingService.listSupplierPayments(query),
  });
}

// Invalidates the supplier's own credit balance — plan.md §3. Sweeps the whole `purchasing`
// prefix (not qk.purchasing.payments.list(), which — called bare — only matches an
// undefined-query cache entry, never one keyed by a real filter object; same bug class fixed
// in Sprint 5 for qk.orders.mine()). `payments` has no `.all()` sibling of its own.
export function useCreatePurchasingPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateSupplierPaymentCommand) =>
      purchasingService.createSupplierPayment(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.purchasing.all() });
    },
  });
}
