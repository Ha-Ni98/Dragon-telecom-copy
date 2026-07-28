import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  RepairListQuery,
  CreateRepairCommand,
  UpdateRepairCommand,
  AddRepairPartCommand,
  RecordRepairPaymentCommand,
  RepairStatusCommand,
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
// cross-invalidates inventory).
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
    },
  });
}

// "release" — the inverse of addPart, same inventory cross-invalidation.
export function useRemoveRepairPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, id, partId }: { scope: RepairsScope; id: string; partId: string }) =>
      repairsService.removeRepairPart(scope, id, partId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.repairs.all() });
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
    },
  });
}

// S13/D8/D9 — PICKED_UP is now the single money moment: parts are consumed, an invoice is
// issued and a ledger payment may be captured, all inside one backend transaction. No repair-
// origin sale exists any more (D9) — cross-invalidates inventory (consumption), billing
// (the new invoice/payments) and clients (credit/totalSold/totalPaid moved).
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

// S13/R1 — the admin Technicians tab.
export function useTechnicianRepairStats() {
  return useQuery({
    queryKey: qk.repairs.technicianStats(),
    queryFn: repairsService.listTechnicianStats,
  });
}
