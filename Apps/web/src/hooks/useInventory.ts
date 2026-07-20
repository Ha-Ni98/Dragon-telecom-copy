import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MovementsQuery,
  ReservationsQuery,
  CreateAdjustmentCommand,
} from "@dragon-telecom/contract";
import * as inventoryService from "@/services/inventory.service";
import { qk } from "@/lib/query-keys";

export function useStock(lowStockOnly?: boolean) {
  return useQuery({
    queryKey: qk.inventory.stock({ lowStockOnly }),
    queryFn: () => inventoryService.getStock(lowStockOnly),
  });
}

// Imperative (triggers a file download) rather than a query — exportStockCsv returns a Blob,
// not cacheable domain data (same shape as usePlatform.ts's useExportAdminDeliveryFees).
export function useExportStockCsv() {
  return useMutation({
    mutationFn: () => inventoryService.exportStockCsv(),
  });
}

export function useMovements(query: MovementsQuery) {
  return useQuery({
    queryKey: qk.inventory.movements.list(query),
    queryFn: () => inventoryService.listMovements(query),
  });
}

export function useReservations(query: ReservationsQuery) {
  return useQuery({
    queryKey: qk.inventory.reservations.list(query),
    queryFn: () => inventoryService.listReservations(query),
  });
}

// Cross-invalidates catalog admin products (quantities/averageCost change) and stats — plan.md §3.
export function useCreateAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateAdjustmentCommand) => inventoryService.createAdjustment(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
      queryClient.invalidateQueries({ queryKey: qk.stats.all() });
    },
  });
}
