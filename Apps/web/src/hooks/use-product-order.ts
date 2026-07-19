/**
 * Custom hook for product ordering functionality
 * Handles order processing and management
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/AuthProvider";
import type { OrderData } from "@/types/draft-types";

interface UseProductOrderResult {
  createOrder: (orderData: OrderData) => Promise<string>;
  isCreatingOrder: boolean;
  orderError: string | null;
  lastOrderId: string | null;
  clearError: () => void;
}

interface OrderProcessingResult {
  orderId: string;
  status: "confirmed" | "pending" | "failed";
  message: string;
  estimatedDelivery?: string;
}

/**
 * Hook for processing product orders
 */
export function useProductOrder(): UseProductOrderResult {
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const {
    mutateAsync: createOrderMutation,
    isPending: isCreatingOrder
  } = useMutation({
    mutationFn: async (orderData: OrderData): Promise<string> => {
      // Validate authentication
      if (!isAuthenticated) {
        throw new Error("You must be logged in to place an order");
      }

      // Validate order data
      if (!orderData.productId || orderData.quantity <= 0) {
        throw new Error("Invalid order data");
      }

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate order ID
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create order object
      const order = {
        idOrder: orderId,
        // Client identity isn't wired yet (clients module integration is Sub-02).
        orderType: orderData.orderType === "pickup" ? 0 : (orderData.orderType === "delivery" ? 1 : 2),
        orderStatus: 1, // pending
        orderTotalPrice: orderData.totalPrice,
        orderDeliveryFee: orderData.deliveryFee || 0,
        orderGrandTotal: orderData.totalPrice,
        totalDue: orderData.totalPrice,
        pricePaid: 0,
        credit: 0,
        orderDeliveryName: orderData.deliveryInfo?.fullName ?? null,
        orderDeliveryPhone: orderData.deliveryInfo?.phone || null,
        orderDeliveryWilaya: orderData.deliveryInfo?.wilaya || null,
        orderDeliveryCommune: orderData.deliveryInfo?.commune || null,
        orderCreatedDate: new Date().toISOString(),
        // Order lines would be created separately
        orderLines: [{
          idProductSupplier: 1, // This would come from the product data
          orderQuantity: orderData.quantity,
          unitPrice: orderData.totalPrice / orderData.quantity
        }]
      };
      
      // In a real application, this would make an API call to create the order
      console.log("Creating order:", order);
      
      // Simulate potential errors (5% chance for testing)
      if (Math.random() < 0.05) {
        throw new Error("Order creation failed. Please try again.");
      }
      
      // Simulate network timeout (2% chance)
      if (Math.random() < 0.02) {
        throw new Error("Request timeout. Please check your connection and try again.");
      }
      
      return orderId;
    },
    onSuccess: (orderId) => {
      setLastOrderId(orderId);
      setOrderError(null);
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["user", "orders"] });
      
      console.log("Order created successfully:", orderId);
    },
    onError: (error) => {
      setOrderError(error.message);
      console.error("Order creation failed:", error);
    }
  });

  const createOrder = async (orderData: OrderData): Promise<string> => {
    setOrderError(null);
    return await createOrderMutation(orderData);
  };

  const clearError = () => {
    setOrderError(null);
  };

  return {
    createOrder,
    isCreatingOrder,
    orderError,
    lastOrderId,
    clearError
  };
}

/**
 * Hook for order history
 */
export function useOrderHistory() {
  // This would typically fetch from an API
  const mockOrders = [
    {
      id: "ORD-1234567890",
      productName: "iPhone 15 Pro Max",
      quantity: 1,
      totalPrice: 629,
      orderType: "delivery" as const,
      status: "confirmed" as const,
      createdAt: new Date().toISOString(),
      deliveryInfo: {
        wilaya: "Algiers",
        commune: "Alger Centre",
        deliveryMode: "home" as const
      }
    }
  ];

  return {
    orders: mockOrders,
    isLoading: false,
    error: null
  };
}

/**
 * Hook for order status tracking
 */
export function useOrderStatus(orderId: string) {
  // This would typically fetch from an API
  const mockStatus = {
    orderId,
    status: "confirmed" as const,
    estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    trackingNumber: "TRK-123456789",
    updates: [
      {
        status: "confirmed",
        timestamp: new Date().toISOString(),
        message: "Order confirmed and being prepared"
      }
    ]
  };

  return {
    orderStatus: mockStatus,
    isLoading: false,
    error: null
  };
}
