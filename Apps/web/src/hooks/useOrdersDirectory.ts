import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BackofficeOrdersQuery,
  UpdateOrderStatusCommand,
  ReturnOrderCommand,
} from "@dragon-telecom/contract";
import * as ordersService from "@/services/orders.service";
import type { OrderScope, AdminCancelOrderCommand } from "@/services/orders.service";
import { qk } from "@/lib/query-keys";

// Staff/admin order pipeline. Named distinctly from the Sub-01 stub `useAdminOrders`/
// `useAdminOrdersStats`/`useUpdateAdminOrder` (use-admin-orders.ts, still serving
// AdminOrders.tsx until Sub-03).

export function useOrdersList(scope: OrderScope, query: BackofficeOrdersQuery) {
  return useQuery({
    queryKey: qk.orders.list(scope, query),
    queryFn: () => ordersService.listOrders(scope, query),
  });
}

export function useOrderStats(scope: OrderScope) {
  return useQuery({
    queryKey: qk.orders.stats(scope),
    queryFn: () => ordersService.orderStats(scope),
  });
}

// Status/cancel/return all cross-invalidate inventory (stock reserved→consumed or released),
// billing (an invoice may be issued/cancelled), and client/pos-client credit — plan.md §3.
function invalidateOrderSideEffects(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: qk.orders.all() });
  queryClient.invalidateQueries({ queryKey: qk.inventory.all() });
  queryClient.invalidateQueries({ queryKey: qk.billing.all() });
  queryClient.invalidateQueries({ queryKey: qk.clients.all() });
  queryClient.invalidateQueries({ queryKey: qk.posClients.all() });
  queryClient.invalidateQueries({ queryKey: qk.stats.all() });
}

// S10/R3 — the single forward-transition mutation (confirm is folded in: PENDING->CONFIRMED now
// goes through this same command). A transition may consume stock, issue an invoice and move
// credit (at COMPLETED), so it invalidates every side effect, not just qk.orders.
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      id,
      command,
    }: {
      scope: OrderScope;
      id: string;
      command: UpdateOrderStatusCommand;
    }) => ordersService.updateOrderStatus(scope, id, command),
    onSuccess: () => invalidateOrderSideEffects(queryClient),
  });
}

export function useAdminCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: AdminCancelOrderCommand }) =>
      ordersService.adminCancelOrder(id, command),
    onSuccess: () => invalidateOrderSideEffects(queryClient),
  });
}

export function useReturnOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: ReturnOrderCommand }) =>
      ordersService.returnOrder(id, command),
    onSuccess: () => invalidateOrderSideEffects(queryClient),
  });
}
