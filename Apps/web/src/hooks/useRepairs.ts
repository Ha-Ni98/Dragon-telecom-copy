import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  RepairListQuery,
  CreateRepairCommand,
  UpdateRepairCommand,
  AddRepairPartCommand,
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

// Status transitions can carry consumedPartReturns (restock) and, on completion, hand off to a
// repair-origin sale/invoice — cross-invalidates inventory + billing per plan §3's
// "repair add-part / status(complete→sale)" row.
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
    },
  });
}
