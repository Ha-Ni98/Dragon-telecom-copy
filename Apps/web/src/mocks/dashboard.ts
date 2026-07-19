/**
 * Mock data for admin dashboard
 * Provides realistic data for dashboard statistics, recent clients, orders, and low stock products
 */

import { DashboardStats, RecentClient, RecentOrder, ProductWithStock } from "@/types/draft-types/dashboard.types";
import { ClientStatusCode, OrderStatusCode, OrderTypeCode } from "@/types/draft-types/enums.types";

/**
 * Mock dashboard statistics
 * Calculated from existing mock data with realistic percentage changes
 */
export const mockDashboardStats: DashboardStats = {
  totalClients: 1247,
  totalProducts: 456,
  ordersThisWeek: 23,
  revenueThisMonth: 12340,
  clientChange: 12.5,
  productChange: 3.2,
  ordersChange: 18.7,
  revenueChange: 8.3,
};

/**
 * Mock recent clients data (last 5 registered clients)
 * Sorted by registration date (newest first)
 */
export const mockRecentClients: RecentClient[] = [
  {
    idClient: 1247,
    fullName: "Yasmine Kadi",
    phoneNumber: "+213 555 123 456",
    wilaya: "Algiers",
    commune: "Hydra",
    status: ClientStatusCode.active,
    statusLabel: "Active",
    createdDate: "2024-12-18T10:30:00Z",
  },
  {
    idClient: 1246,
    fullName: "Mohamed Amine",
    phoneNumber: "+213 555 234 567",
    wilaya: "Oran",
    commune: "Bir El Djir",
    status: ClientStatusCode.pending,
    statusLabel: "Pending",
    createdDate: "2024-12-17T14:15:00Z",
  },
  {
    idClient: 1245,
    fullName: "Fatima Zohra",
    phoneNumber: "+213 555 345 678",
    wilaya: "Constantine",
    commune: "El Khroub",
    status: ClientStatusCode.active,
    statusLabel: "Active",
    createdDate: "2024-12-16T09:45:00Z",
  },
  {
    idClient: 1244,
    fullName: "Ahmed Benali",
    phoneNumber: "+213 555 456 789",
    wilaya: "Blida",
    commune: "Blida",
    status: ClientStatusCode.active,
    statusLabel: "Active",
    createdDate: "2024-12-15T16:20:00Z",
  },
  {
    idClient: 1243,
    fullName: "Khadija Boudjedra",
    phoneNumber: "+213 555 567 890",
    wilaya: "Tizi Ouzou",
    commune: "Tizi Ouzou",
    status: ClientStatusCode.pending,
    statusLabel: "Pending",
    createdDate: "2024-12-14T11:10:00Z",
  },
];

/**
 * Mock recent orders data (last 8 submitted orders)
 * Sorted by creation date (newest first)
 */
export const mockRecentOrders: RecentOrder[] = [
  {
    idOrder: 1008,
    orderCode: "ORD-2024-1008",
    orderLines: "iPhone 15 Pro Max, AirPods Pro (2nd Gen)",
    clientName: "Yasmine Kadi",
    orderType: OrderTypeCode["delivry-home"],
    orderTypeLabel: "Home Delivery",
    totalPrice: 1448.0,
    orderDate: "2024-12-18",
    orderStatus: OrderStatusCode.pending,
    statusLabel: "Pending",
  },
  {
    idOrder: 1007,
    orderCode: "ORD-2024-1007",
    orderLines: "Samsung Galaxy S24 Ultra",
    clientName: "Mohamed Amine",
    orderType: OrderTypeCode["pick-up"],
    orderTypeLabel: "Pick Up",
    totalPrice: 1299.0,
    orderDate: "2024-12-17",
    orderStatus: OrderStatusCode.confirmed,
    statusLabel: "Confirmed",
  },
  {
    idOrder: 1006,
    orderCode: "ORD-2024-1006",
    orderLines: "MacBook Pro M3, Magic Mouse",
    clientName: "Fatima Zohra",
    orderType: OrderTypeCode["delivry-office"],
    orderTypeLabel: "Office Delivery",
    totalPrice: 2499.0,
    orderDate: "2024-12-16",
    orderStatus: OrderStatusCode.delivery,
    statusLabel: "In Delivery",
  },
  {
    idOrder: 1005,
    orderCode: "ORD-2024-1005",
    orderLines: "iPad Air M2, Apple Pencil",
    clientName: "Ahmed Benali",
    orderType: OrderTypeCode["pick-up"],
    orderTypeLabel: "Pick Up",
    totalPrice: 899.0,
    orderDate: "2024-12-15",
    orderStatus: OrderStatusCode.completed,
    statusLabel: "Completed",
  },
  {
    idOrder: 1004,
    orderCode: "ORD-2024-1004",
    orderLines: "Sony WH-1000XM5, iPhone Case",
    clientName: "Khadija Boudjedra",
    orderType: OrderTypeCode["delivry-home"],
    orderTypeLabel: "Home Delivery",
    totalPrice: 384.0,
    orderDate: "2024-12-14",
    orderStatus: OrderStatusCode.pending,
    statusLabel: "Pending",
  },
  {
    idOrder: 1003,
    orderCode: "ORD-2024-1003",
    orderLines: "OnePlus 12, Wireless Charger",
    clientName: "Omar Cherif",
    orderType: OrderTypeCode["delivry-office"],
    orderTypeLabel: "Office Delivery",
    totalPrice: 799.0,
    orderDate: "2024-12-13",
    orderStatus: OrderStatusCode.confirmed,
    statusLabel: "Confirmed",
  },
  {
    idOrder: 1002,
    orderCode: "ORD-2024-1002",
    orderLines: "LG OLED C3 55\", Soundbar",
    clientName: "Nour El Houda",
    orderType: OrderTypeCode["delivry-home"],
    orderTypeLabel: "Home Delivery",
    totalPrice: 1599.0,
    orderDate: "2024-12-12",
    orderStatus: OrderStatusCode.delivery,
    statusLabel: "In Delivery",
  },
  {
    idOrder: 1001,
    orderCode: "ORD-2024-1001",
    orderLines: "Dell XPS 13, USB-C Hub",
    clientName: "Karim Bensalem",
    orderType: OrderTypeCode["pick-up"],
    orderTypeLabel: "Pick Up",
    totalPrice: 1299.0,
    orderDate: "2024-12-11",
    orderStatus: OrderStatusCode.completed,
    statusLabel: "Completed",
  },
];

/**
 * Mock low stock products data (5 products with lowest stock)
 * Sorted by stock quantity (lowest first)
 */
export const mockLowStockProducts: ProductWithStock[] = [
  {
    idProduct: 15,
    productName: "MacBook Pro M3",
    productCodeBar: "MBP-M3-001",
    brand: {
      idBrand: 2,
      brandName: "Apple",
    },
    stockQuantity: 2,
    stockThreshold: 10,
    isCritical: true,
  },
  {
    idProduct: 8,
    productName: "iPhone 15 Pro Max",
    productCodeBar: "IP15PM-001",
    brand: {
      idBrand: 2,
      brandName: "Apple",
    },
    stockQuantity: 3,
    stockThreshold: 15,
    isCritical: true,
  },
  {
    idProduct: 19,
    productName: "AirPods Pro (2nd Gen)",
    productCodeBar: "APP2-001",
    brand: {
      idBrand: 2,
      brandName: "Apple",
    },
    stockQuantity: 7,
    stockThreshold: 20,
    isCritical: false,
  },
  {
    idProduct: 2,
    productName: "Samsung Galaxy S24 Ultra",
    productCodeBar: "S24U-001",
    brand: {
      idBrand: 1,
      brandName: "Samsung",
    },
    stockQuantity: 8,
    stockThreshold: 25,
    isCritical: false,
  },
  {
    idProduct: 21,
    productName: "Sony WH-1000XM5",
    productCodeBar: "WH1000XM5-001",
    brand: {
      idBrand: 6,
      brandName: "Sony",
    },
    stockQuantity: 12,
    stockThreshold: 30,
    isCritical: false,
  },
];

/**
 * Helper function to get dashboard statistics with calculated changes
 * This simulates real-time calculation from existing data
 */
export function getDashboardStats(): DashboardStats {
  // In a real application, these would be calculated from actual data
  // For now, we return the mock data with some randomization for realism
  const baseStats = { ...mockDashboardStats };
  
  // Add some small random variation to make it feel more dynamic
  const variation = 0.1; // 10% variation
  baseStats.clientChange += (Math.random() - 0.5) * variation * 2;
  baseStats.productChange += (Math.random() - 0.5) * variation * 2;
  baseStats.ordersChange += (Math.random() - 0.5) * variation * 2;
  baseStats.revenueChange += (Math.random() - 0.5) * variation * 2;
  
  return baseStats;
}

/**
 * Helper function to get recent clients with proper sorting
 */
export function getRecentClients(limit: number = 5): RecentClient[] {
  return mockRecentClients
    .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
    .slice(0, limit);
}

/**
 * Helper function to get recent orders with proper sorting
 */
export function getRecentOrders(limit: number = 8): RecentOrder[] {
  return mockRecentOrders
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    .slice(0, limit);
}

/**
 * Helper function to get low stock products with proper sorting
 */
export function getLowStockProducts(limit: number = 5): ProductWithStock[] {
  return mockLowStockProducts
    .sort((a, b) => a.stockQuantity - b.stockQuantity)
    .slice(0, limit);
}
