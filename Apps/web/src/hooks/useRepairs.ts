import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  RepairListQuery,
  CreateRepairCommand,
  UpdateRepairCommand,
  AddRepairPartCommand,
  AddRepairPartsCommand,
  RecordRepairPaymentCommand,
  RepairStatusCommand,
  ReturnRepairCommand,
} from "@dragon-telecom/contract";
import * as repairsService from "@/services/repairs.service";
import type { RepairsScope } from "@/services/repairs.service";
import { qk } from "@/lib/query-keys";

// Genuinely new territory (Tier 5, no MVP UI) — no pre-existing stub hooks anywhere reference
// repair-shaped names; checked (incl. use-admin-settings.ts per the standing rule), zero hits.

export function useRepairs(scope: RepairsScope, query: RepairListQuery) {
  return useQuery({
    queryKey: qk.repairs.list(scope, query),
    queryFn: () => repairsService.listRepairs(scope, query),
  });
}

// set-03 B1 — single-ticket read (ADM-13/STF-07 ticket detail drawer). `enabled: !!id`
// (Sprint 7 fix) mirrors every other by-id hook in this codebase (useCatalogProduct, useSale,
// useMyInvoice, …) — without it, mounting the drawer before a ticket is selected would fire
// `GET .../repairs/` with an empty id segment.
export function useRepair(scope: RepairsScope, id: string) {
  return useQuery({
    queryKey: qk.repairs.detail(scope, id),
    queryFn: () => repairsService.getRepair(scope, id),
    enabled: !!id,
  });
}

export function useCreateRepair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, command }: { scope: RepairsScope; command: CreateRepairCommand }) =>
      repairsService.createRepair(scope, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.repairs.all() });
    },
  });
}

export function useUpdateRepair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      id,
      command,
    }: {
      scope: RepairsScope;
      id: string;
      command: UpdateRepairCommand;
    }) => repairsService.updateRepair(scope, id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.repairs.all() });
    },
  });
}

// "reserve(PENDING_REPAIR)" (plan §3 cross-domain invalidation matrix: adding a part
// cross-invalidates inventory). S30 (F4) — and catalog too: product lists carry
// quantityReserved/availableQuantity, so a reservation change must refresh them (before S30 they
// kept showing the old figures, which read as "the reservation was never released").
export function useAddRepairPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      id,
      command,
    }: {
      scope: RepairsScope;
      id: string;
      command: AddRepairPartCommand;
    }) => repairsService.addRepairPart(scope, id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.repairs.all() });
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.all() });
    },
  });
}

// S31 — the ticket drawer's staged parts, reserved all at once (all or nothing). Same
// cross-invalidation as useAddRepairPart above, which the drawer no longer uses but is kept.
export function useAddRepairParts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      id,
      command,
    }: {
      scope: RepairsScope;
      id: string;
      command: AddRepairPartsCommand;
    }) => repairsService.addRepairParts(scope, id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.repairs.all() });
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.all() });
    },
  });
}

// "release" — the inverse of addPart, same inventory + catalog cross-invalidation (S30/F4).
export function useRemoveRepairPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, id, partId }: { scope: RepairsScope; id: string; partId: string }) =>
      repairsService.removeRepairPart(scope, id, partId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.repairs.all() });
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.all() });
    },
  });
}

// S13/D8/D9 — PICKED_UP is now the single money moment: parts are consumed, an invoice is
// issued and a ledger payment may be captured, all inside one backend transaction. No repair-
// origin sale exists any more (D9) — cross-invalidates inventory (consumption), billing
// (the new invoice/payments) and clients (credit/totalSold/totalPaid moved). S30/F4 — and catalog
// (pickup consumes and cancel releases, both of which product lists display).
export function useUpdateRepairStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      id,
      command,
    }: {
      scope: RepairsScope;
      id: string;
      command: RepairStatusCommand;
    }) => repairsService.updateRepairStatus(scope, id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.repairs.all() });
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.all() });
      queryClient.invalidateQueries({ queryKey: qk.billing.all() });
      queryClient.invalidateQueries({ queryKey: qk.clients.all() });
    },
  });
}

// S30 — PICKED_UP → RETURNED: restocked parts move inventory + catalog, the invoice is cancelled
// and every payment reversed (billing), and the client's credit/totalPaid/totalSold move (clients).
export function useReturnRepair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      id,
      command,
    }: {
      scope: RepairsScope;
      id: string;
      command: ReturnRepairCommand;
    }) => repairsService.returnRepair(scope, id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.repairs.all() });
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.all() });
      queryClient.invalidateQueries({ queryKey: qk.billing.all() });
      queryClient.invalidateQueries({ queryKey: qk.clients.all() });
    },
  });
}

// S13/D5 — a cumulative payment at any pre-pickup step; moves the client's credit/totalPaid
// through the ledger (for a known POS client) the same way a status-changing payment does.
export function useRecordRepairPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      id,
      command,
    }: {
      scope: RepairsScope;
      id: string;
      command: RecordRepairPaymentCommand;
    }) => repairsService.recordRepairPayment(scope, id, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.repairs.all() });
      queryClient.invalidateQueries({ queryKey: qk.billing.all() });
      queryClient.invalidateQueries({ queryKey: qk.clients.all() });
    },
  });
}

// S13/R1, scoped by S18/D-3 — the Technicians tab, now shared staff/admin.
export function useTechnicianRepairStats(scope: RepairsScope) {
  return useQuery({
    queryKey: qk.repairs.technicianStats(scope),
    queryFn: () => repairsService.listTechnicianStats(scope),
  });
}
