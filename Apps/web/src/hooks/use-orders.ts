import { useState, useEffect, useCallback } from 'react';
import { OrderWithDetails, OrderLineWithProduct } from '@/types/draft-types/order.types';
import { OrderStatusCode, OrderTypeCode } from '@/types/draft-types/enums.types';
import { ProductWithDetails } from '@/types/draft-types/main-page.types';
import { 
  getMockOrdersWithDetails, 
  getMockOrderWithDetails, 
  getMockOrdersByStatus, 
  getMockOrdersByClient 
} from '@/mocks/orders';
import { 
  generateOrderCode, 
  getOrderStatusLabel, 
  getOrderTypeLabel, 
  formatOrderDate, 
  getDaysSinceOrderCreation, 
  canOrderBeCancelled 
} from '@/lib/order-utils';

/**
 * Orders state interface
 */
interface OrdersState {
  orders: OrderWithDetails[];
  loading: boolean;
  error: string | null;
  selectedStatus: OrderStatusCode | 'all';
}

/**
 * Custom hook for orders management
 */
export const useOrders = () => {
  const [state, setState] = useState<OrdersState>({
    orders: [],
    loading: false,
    error: null,
    selectedStatus: 'all'
  });

  /**
   * Load orders from mock data
   */
  const loadOrders = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const orders = getMockOrdersWithDetails();
      setState(prev => ({ 
        ...prev, 
        orders, 
        loading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load orders', 
        loading: false 
      }));
    }
  }, []);

  /**
   * Load orders on mount
   */
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  /**
   * Get filtered orders based on selected status
   */
  const getFilteredOrders = useCallback((): OrderWithDetails[] => {
    if (state.selectedStatus === 'all') {
      return state.orders;
    }
    return state.orders.filter(order => order.orderStatus === state.selectedStatus);
  }, [state.orders, state.selectedStatus]);

  /**
   * Filter orders by status
   */
  const filterOrdersByStatus = useCallback((status: OrderStatusCode | 'all') => {
    setState(prev => ({ ...prev, selectedStatus: status }));
  }, []);

  /**
   * Get order by ID
   */
  const getOrderById = useCallback((orderId: number): OrderWithDetails | undefined => {
    return state.orders.find(order => order.idOrder === orderId);
  }, [state.orders]);

  /**
   * Cancel order
   */
  const cancelOrder = useCallback(async (orderId: number): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update order status to cancelled
      setState(prev => ({
        ...prev,
        orders: prev.orders.map(order => 
          order.idOrder === orderId 
            ? { 
                ...order, 
                orderStatus: OrderStatusCode.canceled,
                statusLabel: getOrderStatusLabel(OrderStatusCode.canceled, 'en'),
                canBeCancelled: false
              }
            : order
        ),
        loading: false
      }));
      
      return true;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to cancel order', 
        loading: false 
      }));
      return false;
    }
  }, []);

  /**
   * Create order from wishlist
   */
  const createOrderFromWishlist = useCallback(async (
    wishlistItems: { product: ProductWithDetails; quantity: number }[],
    orderType: OrderTypeCode,
    deliveryInfo?: {
      name: string;
      phone: string;
      wilaya: string;
      commune: string;
    }
  ): Promise<OrderWithDetails | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Calculate totals
      const orderTotalPrice = wishlistItems.reduce((total, item) => {
        return total + (item.product.price || 0) * item.quantity;
      }, 0);
      
      const deliveryFee = orderType !== OrderTypeCode['pick-up'] ? 600 : 0;
      const orderGrandTotal = orderTotalPrice + deliveryFee;
      
      // Create order lines
      const orderLines: OrderLineWithProduct[] = wishlistItems.map((item, index) => ({
        idLine: Date.now() + index,
        idOrder: Date.now(),
        idProductSupplier: item.product.idProduct,
        orderQuantity: item.quantity,
        unitPrice: item.product.price || 0,
        product: {
          idProduct: item.product.idProduct,
          productName: item.product.productName,
          productCodeBar: item.product.productCodeBar,
          brand: item.product.brand,
          model: item.product.model,
          family: item.product.family,
          image: item.product.image
        }
      }));
      
      // Create new order
      const newOrder: OrderWithDetails = {
        idOrder: Date.now(),
        idClient: 1, // Mock client ID
        orderType,
        orderStatus: OrderStatusCode.pending,
        orderTotalPrice,
        orderDeliveryFee: deliveryFee,
        orderGrandTotal,
        totalDue: orderGrandTotal,
        pricePaid: 0,
        credit: 0,
        orderDeliveryName: deliveryInfo?.name,
        orderDeliveryPhone: deliveryInfo?.phone,
        orderDeliveryWilaya: deliveryInfo?.wilaya,
        orderDeliveryCommune: deliveryInfo?.commune,
        orderCreatedDate: new Date().toISOString(),
        orderCode: generateOrderCode(),
        orderLines,
        statusLabel: getOrderStatusLabel(OrderStatusCode.pending, 'en'),
        typeLabel: getOrderTypeLabel(orderType, 'en'),
        formattedDate: formatOrderDate(new Date().toISOString(), 'en'),
        daysSinceCreation: 0,
        canBeCancelled: true,
        client: {
          idClient: 1,
          clientFirstName: "Current",
          clientLastName: "User",
          clientPhoneNumber: "+213 555 000 000",
          clientEmail: "user@example.com"
        }
      };
      
      // Add new order to state
      setState(prev => ({
        ...prev,
        orders: [newOrder, ...prev.orders],
        loading: false
      }));
      
      return newOrder;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to create order', 
        loading: false 
      }));
      return null;
    }
  }, []);

  /**
   * Get orders statistics
   */
  const getOrdersStatistics = useCallback(() => {
    const totalOrders = state.orders.length;
    const pendingOrders = state.orders.filter(order => order.orderStatus === OrderStatusCode.pending).length;
    const confirmedOrders = state.orders.filter(order => order.orderStatus === OrderStatusCode.confirmed).length;
    const deliveryOrders = state.orders.filter(order => order.orderStatus === OrderStatusCode.delivery).length;
    const completedOrders = state.orders.filter(order => order.orderStatus === OrderStatusCode.completed).length;
    const cancelledOrders = state.orders.filter(order => order.orderStatus === OrderStatusCode.canceled).length;
    
    const totalValue = state.orders.reduce((total, order) => total + order.orderGrandTotal, 0);
    const paidValue = state.orders.reduce((total, order) => total + order.pricePaid, 0);
    const pendingValue = state.orders.reduce((total, order) => total + order.totalDue, 0);
    
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
  }, [state.orders]);

  /**
   * Refresh orders
   */
  const refreshOrders = useCallback(() => {
    loadOrders();
  }, [loadOrders]);

  return {
    // State
    orders: getFilteredOrders(),
    allOrders: state.orders,
    loading: state.loading,
    error: state.error,
    selectedStatus: state.selectedStatus,
    
    // Actions
    filterOrdersByStatus,
    getOrderById,
    cancelOrder,
    createOrderFromWishlist,
    refreshOrders,
    
    // Statistics
    getOrdersStatistics,
    
    // Utility
    loadOrders
  };
};
