import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SaleDraftCommand,
  UpdateSaleDraftCommand,
  ConfirmSaleCommand,
  SaleListQuery,
  CreateReturnCommand,
  ReturnListQuery,
  ReturnWholeSaleCommand,
} from "@dragon-telecom/contract";
import * as salesService from "@/services/sales.service";
import type { SalesScope } from "@/services/sales.service";
import { qk } from "@/lib/query-keys";

// Genuinely new territory (Tier 5, no MVP UI) — no pre-existing stub hooks anywhere reference
// sale-shaped names; checked (incl. use-admin-settings.ts per the standing rule), zero hits.

// `options.enabled` (set-04 Sprint 5) — ADM-11's detail drawer only wants this to fire once a
// POS client row is clicked, unlike StaffPos.tsx's always-on ticket search; omitting `options`
// keeps every existing caller's always-on behavior (same precedent as useStaffProducts/
// useInvoices — react-query treats `enabled: undefined` as enabled).
export function useSales(scope: SalesScope, query: SaleListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.sales.list(scope, query),
    queryFn: () => salesService.listSales(scope, query),
    enabled: options?.enabled,
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

// Drafts don't touch stock/billing — invalidates only the sales domain, same as create/update.
export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesService.deleteDraft(id),
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

// S12 — the Returns tab, and the return dialog's "already returned per line" lookup
// (`{ saleId }`). `options.enabled` follows useSales' own precedent: the dialog's query must not
// fire until a sale is actually selected. S18/D-2 — scoped so staff and admin get separate
// cache entries and staff can reach its own Returns tab.
export function useReturns(
  scope: SalesScope,
  query: ReturnListQuery,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: qk.sales.returns(scope, query),
    queryFn: () => salesService.listReturns(scope, query),
    enabled: options?.enabled,
  });
}

// Same ripple as confirm — a return restocks (sometimes) and refunds credit.
export function useCreateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, command }: { scope: SalesScope; command: CreateReturnCommand }) =>
      salesService.createReturn(scope, command),
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

// S32 (P2) — same ripple as useCreateReturn: it is the same return, with one refund figure.
export function useReturnWholeSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, command }: { scope: SalesScope; command: ReturnWholeSaleCommand }) =>
      salesService.returnWholeSale(scope, command),
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
