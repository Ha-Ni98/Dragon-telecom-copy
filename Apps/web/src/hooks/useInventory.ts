import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  StockQuery,
  MovementsQuery,
  ReservationsQuery,
  CreateAdjustmentCommand,
} from "@dragon-telecom/contract";
import * as inventoryService from "@/services/inventory.service";
import { qk } from "@/lib/query-keys";

export function useStock(query: inventoryService.StockListQuery) {
  return useQuery({
    queryKey: qk.inventory.stock(query),
    queryFn: () => inventoryService.getStock(query),
  });
}

// Imperative (triggers a file download) rather than a query — exportStock returns a Blob, not
// cacheable domain data (same shape as usePlatform.ts's useExportAdminDeliveryFees).
export function useExportStock() {
  return useMutation({
    mutationFn: ({
      query,
      format,
    }: {
      query: Omit<StockQuery, "export" | "page" | "limit">;
      format: "csv" | "pdf";
    }) => inventoryService.exportStock(query, format),
  });
}

export function useMovements(query: MovementsQuery) {
  return useQuery({
    queryKey: qk.inventory.movements.list(query),
    queryFn: () => inventoryService.listMovements(query),
  });
}

// Imperative (triggers a file download) rather than a query — mirrors useExportStock above.
export function useExportMovements() {
  return useMutation({
    mutationFn: ({
      query,
      format,
    }: {
      query: Omit<MovementsQuery, "export" | "page" | "limit">;
      format: "csv" | "pdf";
    }) => inventoryService.exportMovements(query, format),
  });
}

export function useReservations(query: ReservationsQuery) {
  return useQuery({
    queryKey: qk.inventory.reservations.list(query),
    queryFn: () => inventoryService.listReservations(query),
  });
}

// Cross-invalidates catalog admin products (quantities/avgStockPrice/avgPrice change) and stats — plan.md §3.
// S28 — the per-product Adjust dialog submits through this same hook, so the row's quantity and
// average refresh on close without any extra invalidation.
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
