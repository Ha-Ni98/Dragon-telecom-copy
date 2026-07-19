import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminOrders, getAdminOrdersStats, updateAdminOrder, type AdminOrdersQuery } from '@/services/orders.service';
import { qk } from '@/lib/query-keys';
import type { AdminOrderWithDetails } from '@/types/draft-types/order.types';

export function useAdminOrders(query: AdminOrdersQuery) {
  return useQuery({
    queryKey: qk.orders.adminList(query),
    queryFn: () => getAdminOrders(query),
    staleTime: 1000 * 60,
  });
}

export function useAdminOrdersStats() {
  return useQuery({
    queryKey: qk.orders.adminStats(),
    queryFn: getAdminOrdersStats,
    staleTime: 1000 * 60,
  });
}

export function useUpdateAdminOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, updates }: { orderId: number; updates: Partial<AdminOrderWithDetails> }) =>
      updateAdminOrder(orderId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.orders.all() });
    },
  });
}
