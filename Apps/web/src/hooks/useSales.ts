import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SaleDraftCommand,
  UpdateSaleDraftCommand,
  ConfirmSaleCommand,
  SaleListQuery,
  CreateReturnCommand,
} from "@dragon-telecom/contract";
import * as salesService from "@/services/sales.service";
import type { SalesScope } from "@/services/sales.service";
import { qk } from "@/lib/query-keys";

// Genuinely new territory (Tier 5, no MVP UI) — no pre-existing stub hooks anywhere reference
// sale-shaped names; checked (incl. use-admin-settings.ts per the standing rule), zero hits.

export function useSales(scope: SalesScope, query: SaleListQuery) {
  return useQuery({
    queryKey: qk.sales.list(scope, query),
    queryFn: () => salesService.listSales(scope, query),
  });
}

export function useSale(scope: SalesScope, reference: string) {
  return useQuery({
    queryKey: qk.sales.detail(scope, reference),
    queryFn: () => salesService.getSale(scope, reference),
    enabled: !!reference,
  });
}

// Drafts don't touch stock/billing — invalidates only the sales domain.
export function useCreateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: SaleDraftCommand) => salesService.createDraft(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sales.all() });
    },
  });
}

export function useUpdateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateSaleDraftCommand }) =>
      salesService.updateDraft(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sales.all() });
    },
  });
}

// The money/stock ripple (plan §3 cross-domain invalidation matrix): confirm commits stock
// movements, issues an invoice, and (for a POS client sale) applies credit.
export function useConfirmSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: ConfirmSaleCommand }) =>
      salesService.confirmSale(id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sales.all() });
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
      queryClient.invalidateQueries({ queryKey: qk.billing.all() });
      queryClient.invalidateQueries({ queryKey: qk.clients.all() });
      queryClient.invalidateQueries({ queryKey: qk.posClients.all() });
      queryClient.invalidateQueries({ queryKey: qk.stats.all() });
    },
  });
}

// Same ripple as confirm — a return restocks (sometimes) and refunds credit.
export function useCreateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateReturnCommand) => salesService.createReturn(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sales.all() });
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
      queryClient.invalidateQueries({ queryKey: qk.billing.all() });
      queryClient.invalidateQueries({ queryKey: qk.clients.all() });
      queryClient.invalidateQueries({ queryKey: qk.posClients.all() });
      queryClient.invalidateQueries({ queryKey: qk.stats.all() });
    },
  });
}
