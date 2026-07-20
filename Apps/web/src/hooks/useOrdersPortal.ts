import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlaceOrderCommand, MyOrdersQuery } from "@dragon-telecom/contract";
import * as ordersService from "@/services/orders.service";
import { qk } from "@/lib/query-keys";

// Client-facing order flow. Named distinctly from the Sub-01 stub `useOrders` (use-orders.ts,
// still serving OrderCard.tsx/orders-list-section.tsx until Sub-03).

// Mutations below invalidate qk.orders.all() (the bare ["orders"] prefix), not qk.orders.mine():
// `mine(query)` always appends a third key element (even `undefined` for a bare call), so it
// can never serve as a true prefix for an arbitrary filtered "mine" query — invalidating with
// it would silently miss any useMyOrders(query) call site that passes a real filter object
// (found via a failing test: useMyOrders() with its {} default doesn't match a bare
// qk.orders.mine() invalidation either, since {} !== undefined). qk.orders.all() is broader
// (also sweeps admin/stats) but correct, and already the proven pattern in
// useOrdersDirectory.ts's mutations.

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: PlaceOrderCommand) => ordersService.placeOrder(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.orders.all() });
    },
  });
}

export function useMyOrders(query: MyOrdersQuery = {}) {
  return useQuery({
    queryKey: qk.orders.mine(query),
    queryFn: () => ordersService.listMyOrders(query),
  });
}

export function useCancelMyOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersService.cancelMyOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.orders.all() });
    },
  });
}
