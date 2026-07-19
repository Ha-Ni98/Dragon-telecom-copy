import { Order, OrderLine } from '@/types';
import { 
  ApiResponse, 
  SingleResponse, 
  CreateOrderRequest, 
  UpdateOrderRequest, 
  CreateOrderLineRequest, 
  UpdateOrderLineRequest
} from '@/types';

/**
 * Order API Service
 * Handles communication with backend order endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Type aliases for backward compatibility
export type OrderApiResponse<T> = ApiResponse<T>;
export type OrderSingleResponse<T> = SingleResponse<T>;

export const orderApiService = {
  // ==================== Order Operations ====================

  /**
   * Get all orders from the backend
   * Optional query parameter to filter by client ID
   */
  async getAllOrders(clientId?: number): Promise<Order[]> {
    const url = clientId 
      ? `${API_BASE_URL}/api/orders?clientId=${clientId}`
      : `${API_BASE_URL}/api/orders`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    const result: ApiResponse<Order> = await response.json();
    return result.data || [];
  },

  /**
   * Get order by ID
   */
  async getOrderById(id: number): Promise<Order | null> {
    const response = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch order: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new order
   */
  async createOrder(data: CreateOrderRequest): Promise<Order> {
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create order: ${response.statusText}`);
    }

    const result: SingleResponse<Order> = await response.json();
    return result.data;
  },

  /**
   * Update an existing order
   */
  async updateOrder(id: number, data: UpdateOrderRequest): Promise<Order> {
    const response = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update order: ${response.statusText}`);
    }

    const result: SingleResponse<Order> = await response.json();
    return result.data;
  },

  /**
   * Delete an order
   */
  async deleteOrder(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete order: ${response.statusText}`);
    }
  },

  // ==================== OrderLine Operations ====================

  /**
   * Get all order lines or specific to an order
   */
  async getOrderLines(orderId?: number): Promise<OrderLine[]> {
    const url = orderId 
      ? `${API_BASE_URL}/api/orders/${orderId}/lines`
      : `${API_BASE_URL}/api/orders/lines`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch order lines: ${response.statusText}`);
    }

    const result: ApiResponse<OrderLine> = await response.json();
    return result.data || [];
  },

  /**
   * Get order line by ID
   */
  async getOrderLineById(id: number): Promise<OrderLine | null> {
    const response = await fetch(`${API_BASE_URL}/api/orders/lines/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch order line: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || null;
  },

  /**
   * Create a new order line
   */
  async createOrderLine(data: CreateOrderLineRequest): Promise<OrderLine> {
    const response = await fetch(`${API_BASE_URL}/api/orders/lines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create order line: ${response.statusText}`);
    }

    const result: SingleResponse<OrderLine> = await response.json();
    return result.data;
  },

  /**
   * Update an existing order line
   */
  async updateOrderLine(id: number, data: UpdateOrderLineRequest): Promise<OrderLine> {
    const response = await fetch(`${API_BASE_URL}/api/orders/lines/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update order line: ${response.statusText}`);
    }

    const result: SingleResponse<OrderLine> = await response.json();
    return result.data;
  },

  /**
   * Delete an order line
   */
  async deleteOrderLine(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/orders/lines/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete order line: ${response.statusText}`);
    }
  },

  // ==================== Utility Operations ====================

  /**
   * Get orders with their lines (combined operation)
   */
  async getOrdersWithLines(clientId?: number): Promise<(Order & { lines: OrderLine[] })[]> {
    const orders = await this.getAllOrders(clientId);
    
    // Fetch lines for each order
    const ordersWithLines = await Promise.all(
      orders.map(async (order) => {
        const lines = await this.getOrderLines(order.idOrder);
        return { ...order, lines };
      })
    );

    return ordersWithLines;
  },

  /**
   * Get order with its lines (single order with details)
   */
  async getOrderWithLines(id: number): Promise<(Order & { lines: OrderLine[] }) | null> {
    const order = await this.getOrderById(id);
    if (!order) return null;

    const lines = await this.getOrderLines(id);
    return { ...order, lines };
  },
};
