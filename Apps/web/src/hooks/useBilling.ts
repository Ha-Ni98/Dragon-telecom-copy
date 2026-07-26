import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  InvoiceListQuery,
  CancelInvoiceCommand,
  CreateClientPaymentCommand,
  ClientPaymentListQuery,
} from "@dragon-telecom/contract";
import * as billingService from "@/services/billing.service";
import type { BillingScope } from "@/services/billing.service";
import { qk } from "@/lib/query-keys";

// Genuinely new territory (Tier 5, no MVP UI) — no pre-existing stub hooks anywhere reference
// invoice/billing-shaped names; checked (incl. use-admin-settings.ts per the standing rule),
// zero hits. `use-supplier-information.ts`'s `useSupplierInvoices`/`useDeleteInvoice` are a
// different domain (purchasing's supplier invoices, already handled in Sprint 6) — no collision.

export function useMyInvoices(query: InvoiceListQuery) {
  return useQuery({
    queryKey: qk.billing.mine(query),
    queryFn: () => billingService.getMyInvoices(query),
  });
}

// set-02 D3 (engine gap) — billingService.getMyInvoice/getMyInvoicePdf already existed
// (Sub-02 built the service layer ahead of any consuming UI, same Tier-5 pattern as the rest
// of this file) but were never wrapped in a hook. No `scope` param: BillingScope is only
// "staff"|"admin", so this is genuinely a separate client-only surface, not a 3rd scope value.
export function useMyInvoice(number: string) {
  return useQuery({
    queryKey: qk.billing.mineDetail(number),
    queryFn: () => billingService.getMyInvoice(number),
    enabled: !!number,
  });
}

// Imperative (Blob download), same shape as useInvoicePdf below and useExportReportCsv
// (useStatistics.ts) — not cacheable domain data.
export function useMyInvoicePdf() {
  return useMutation({
    mutationFn: (number: string) => billingService.getMyInvoicePdf(number),
  });
}

// `options.enabled` (set-03 Sprint 6) — ADM-14's Outgoing tab is one of three lazy-per-tab
// queries (plan.md §5: "Incoming & Payments queries don't fire until their tab opens").
export function useInvoices(
  scope: BillingScope,
  query: InvoiceListQuery,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: qk.billing.list(scope, query),
    queryFn: () => billingService.listInvoices(scope, query),
    enabled: options?.enabled,
  });
}

export function useInvoice(scope: BillingScope, number: string) {
  return useQuery({
    queryKey: qk.billing.detail(scope, number),
    queryFn: () => billingService.getInvoice(scope, number),
    enabled: !!number,
  });
}

// Imperative (triggers a file view/download) rather than a query — getInvoicePdf returns a
// Blob, not cacheable domain data. Mirrors useExportAdminDeliveryFees/useExportReportCsv.
export function useInvoicePdf() {
  return useMutation({
    mutationFn: ({ scope, number }: { scope: BillingScope; number: string }) =>
      billingService.getInvoicePdf(scope, number),
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ number, command }: { number: string; command: CancelInvoiceCommand }) =>
      billingService.cancelInvoice(number, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.billing.all() });
    },
  });
}

// Cross-invalidates client/pos-client credit (plan §3's "supplier/client payment" row).
// `qk.billing.payments` has no `.all()` sibling — invalidate the broader `qk.billing.all()`
// instead (same fix class as Sprint 6's `qk.purchasing.payments`, applied at write-time here).
export function useCreateClientPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      command,
    }: {
      scope: BillingScope;
      command: CreateClientPaymentCommand;
    }) => billingService.createClientPayment(scope, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.billing.all() });
      queryClient.invalidateQueries({ queryKey: qk.clients.all() });
      queryClient.invalidateQueries({ queryKey: qk.posClients.all() });
    },
  });
}

export function useClientPayments(query: ClientPaymentListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.billing.payments.list(query),
    queryFn: () => billingService.listClientPayments(query),
    enabled: options?.enabled,
  });
}
