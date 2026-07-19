/**
 * Custom hook for product ordering functionality
 * Handles order processing and management
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/AuthProvider";
import { qk } from "@/lib/query-keys";
import type { OrderData } from "@/types/draft-types";

interface UseProductOrderResult {
  createOrder: (orderData: OrderData) => Promise<string>;
  isCreatingOrder: boolean;
  orderError: string | null;
  lastOrderId: string | null;
  clearError: () => void;
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
    // Real order creation lands in Sub-02 — this stub validates and echoes a generated id
    // back so the checkout UI can complete its flow without a backend.
    mutationFn: async (orderData: OrderData): Promise<string> => {
      if (!isAuthenticated) {
        throw new Error("You must be logged in to place an order");
      }

      if (!orderData.productId || orderData.quantity <= 0) {
        throw new Error("Invalid order data");
      }

      return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },
    onSuccess: (orderId) => {
      setLastOrderId(orderId);
      setOrderError(null);
      queryClient.invalidateQueries({ queryKey: qk.orders.mine() });
    },
    onError: (error) => {
      setOrderError(error.message);
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
