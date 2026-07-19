/**
 * Dashboard-specific type definitions
 * These types support the admin dashboard functionality
 */

import { Client, OrderWithDetails } from "./index";

/**
 * Dashboard statistics interface
 * Contains key metrics for the admin dashboard
 */
export interface DashboardStats {
  /** Total number of registered clients */
  totalClients: number;
  /** Total number of products in inventory */
  totalProducts: number;
  /** Number of orders placed this week */
  ordersThisWeek: number;
  /** Total revenue generated this month */
  revenueThisMonth: number;
  /** Percentage change in client count from last month */
  clientChange: number;
  /** Percentage change in product count from last month */
  productChange: number;
  /** Percentage change in orders from last week */
  ordersChange: number;
  /** Percentage change in revenue from last month */
  revenueChange: number;
}

/**
 * Product with stock information for low stock alerts
 * Extends basic product with stock quantity and brand information
 */
export interface ProductWithStock {
  /** Product ID */
  idProduct: number;
  /** Product name */
  productName: string;
  /** Product barcode */
  productCodeBar: string;
  /** Brand information */
  brand: {
    idBrand: number;
    brandName: string;
  };
  /** Current stock quantity */
  stockQuantity: number;
  /** Stock threshold for alerts */
  stockThreshold: number;
  /** Whether product is critically low on stock */
  isCritical: boolean;
}

/**
 * Recent client interface for dashboard display
 * Simplified client data for recent clients table
 */
export interface RecentClient {
  /** Client ID */
  idClient: number;
  /** Client's full name (firstName + lastName) */
  fullName: string;
  /** Client's phone number */
  phoneNumber: string;
  /** Client's wilaya (region) */
  wilaya: string;
  /** Client's commune (district) */
  commune: string;
  /** Client status code */
  status: number;
  /** Human-readable status label */
  statusLabel: string;
  /** Client registration date */
  createdDate: string;
}

/**
 * Recent order interface for dashboard display
 * Simplified order data for recent orders table
 */
export interface RecentOrder {
  /** Order ID */
  idOrder: number;
  /** Generated order code for display */
  orderCode: string;
  /** Comma-separated list of product names */
  orderLines: string;
  /** Client's full name */
  clientName: string;
  /** Order type code */
  orderType: number;
  /** Human-readable order type label */
  orderTypeLabel: string;
  /** Total order price */
  totalPrice: number;
  /** Formatted order date */
  orderDate: string;
  /** Order status code */
  orderStatus: number;
  /** Human-readable status label */
  statusLabel: string;
}

/**
 * Dashboard data aggregation result
 * Contains all dashboard data in a single interface
 */
export interface DashboardData {
  /** Dashboard statistics */
  stats: DashboardStats;
  /** Recent clients (last 5) */
  recentClients: RecentClient[];
  /** Recent orders (last 8) */
  recentOrders: RecentOrder[];
  /** Low stock products (5 with lowest stock) */
  lowStockProducts: ProductWithStock[];
}
