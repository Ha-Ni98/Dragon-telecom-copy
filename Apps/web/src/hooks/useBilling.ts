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

export function useInvoices(scope: BillingScope, query: InvoiceListQuery) {
  return useQuery({
    queryKey: qk.billing.list(scope, query),
    queryFn: () => billingService.listInvoices(scope, query),
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

export function useClientPayments(query: ClientPaymentListQuery) {
  return useQuery({
    queryKey: qk.billing.payments.list(query),
    queryFn: () => billingService.listClientPayments(query),
  });
}
