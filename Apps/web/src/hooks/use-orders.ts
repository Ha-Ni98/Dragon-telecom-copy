import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OrderStatusCode } from '@/types/draft-types/enums.types';
import { getMyOrders, cancelOrder as cancelOrderRequest } from '@/services/orders.service';
import { qk } from '@/lib/query-keys';

/**
 * Custom hook for orders management
 */
export const useOrders = () => {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatusCode | 'all'>('all');

  const { data: allOrders, isLoading, error, refetch } = useQuery({
    queryKey: qk.orders.mine(),
    queryFn: getMyOrders,
    staleTime: 1000 * 60,
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: number) => cancelOrderRequest(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.orders.mine() });
    },
  });

  const orders = useMemo(() => {
    const list = allOrders ?? [];
    if (selectedStatus === 'all') return list;
    return list.filter(order => order.orderStatus === selectedStatus);
  }, [allOrders, selectedStatus]);

  const filterOrdersByStatus = (status: OrderStatusCode | 'all') => {
    setSelectedStatus(status);
  };

  const cancelOrder = async (orderId: number): Promise<boolean> => {
    try {
      await cancelMutation.mutateAsync(orderId);
      return true;
    } catch {
      return false;
    }
  };

  const getOrdersStatistics = () => {
    const list = allOrders ?? [];
    const totalOrders = list.length;
    const pendingOrders = list.filter(order => order.orderStatus === OrderStatusCode.pending).length;
    const confirmedOrders = list.filter(order => order.orderStatus === OrderStatusCode.confirmed).length;
    const deliveryOrders = list.filter(order => order.orderStatus === OrderStatusCode.delivery).length;
    const completedOrders = list.filter(order => order.orderStatus === OrderStatusCode.completed).length;
    const cancelledOrders = list.filter(order => order.orderStatus === OrderStatusCode.canceled).length;

    const totalValue = list.reduce((total, order) => total + order.orderGrandTotal, 0);
    const paidValue = list.reduce((total, order) => total + order.pricePaid, 0);
    const pendingValue = list.reduce((total, order) => total + order.totalDue, 0);

    return {
      totalOrders,
      pendingOrders,
      confirmedOrders,
      deliveryOrders,
      completedOrders,
      cancelledOrders,
      totalValue,
      paidValue,
      pendingValue
    };
  };

  return {
    // State
    orders,
    loading: isLoading,
    error: error?.message ?? null,
    selectedStatus,

    // Actions
    filterOrdersByStatus,
    cancelOrder,
    refreshOrders: refetch,

    // Statistics
    getOrdersStatistics,
  };
};
