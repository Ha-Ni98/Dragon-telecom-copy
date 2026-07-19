/**
 * Dashboard service layer
 * Handles data aggregation and business logic for admin dashboard
 */

import { DashboardStats, RecentClient, RecentOrder, ProductWithStock, DashboardData } from "@/types/draft-types/dashboard.types";
import { 
  getDashboardStats, 
  getRecentClients, 
  getRecentOrders, 
  getLowStockProducts 
} from "@/mocks/dashboard";

/**
 * Dashboard service class
 * Provides methods for fetching and aggregating dashboard data
 */
export class DashboardService {
  /**
   * Get dashboard statistics
   * Calculates key metrics for the admin dashboard
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      return getDashboardStats();
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw new Error('Failed to fetch dashboard statistics');
    }
  }

  /**
   * Get recent clients
   * Returns the most recently registered clients
   */
  static async getRecentClients(limit: number = 5): Promise<RecentClient[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      return getRecentClients(limit);
    } catch (error) {
      console.error('Error fetching recent clients:', error);
      throw new Error('Failed to fetch recent clients');
    }
  }

  /**
   * Get recent orders
   * Returns the most recently submitted orders
   */
  static async getRecentOrders(limit: number = 8): Promise<RecentOrder[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 250));
    
    try {
      return getRecentOrders(limit);
    } catch (error) {
      console.error('Error fetching recent orders:', error);
      throw new Error('Failed to fetch recent orders');
    }
  }

  /**
   * Get low stock products
   * Returns products with the lowest stock quantities
   */
  static async getLowStockProducts(limit: number = 5): Promise<ProductWithStock[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      return getLowStockProducts(limit);
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      throw new Error('Failed to fetch low stock products');
    }
  }

  /**
   * Get all dashboard data
   * Aggregates all dashboard data in a single call
   */
  static async getAllDashboardData(): Promise<DashboardData> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const [stats, recentClients, recentOrders, lowStockProducts] = await Promise.all([
        DashboardService.getDashboardStats(),
        DashboardService.getRecentClients(5),
        DashboardService.getRecentOrders(8),
        DashboardService.getLowStockProducts(5),
      ]);

      return {
        stats,
        recentClients,
        recentOrders,
        lowStockProducts,
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw new Error('Failed to fetch dashboard data');
    }
  }

  /**
   * Refresh dashboard data
   * Forces a refresh of all dashboard data
   */
  static async refreshDashboardData(): Promise<DashboardData> {
    // Simulate longer delay for refresh
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      return await DashboardService.getAllDashboardData();
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      throw new Error('Failed to refresh dashboard data');
    }
  }

  /**
   * Get dashboard statistics summary
   * Returns a summary of key metrics for quick overview
   */
  static async getDashboardSummary(): Promise<{
    totalClients: number;
    totalProducts: number;
    pendingOrders: number;
    lowStockCount: number;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      const [stats, lowStockProducts] = await Promise.all([
        DashboardService.getDashboardStats(),
        DashboardService.getLowStockProducts(5),
      ]);

      return {
        totalClients: stats.totalClients,
        totalProducts: stats.totalProducts,
        pendingOrders: stats.ordersThisWeek,
        lowStockCount: lowStockProducts.filter(p => p.isCritical).length,
      };
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      throw new Error('Failed to fetch dashboard summary');
    }
  }
}

/**
 * Export individual functions for convenience
 */
export const dashboardService = {
  getDashboardStats: DashboardService.getDashboardStats,
  getRecentClients: DashboardService.getRecentClients,
  getRecentOrders: DashboardService.getRecentOrders,
  getLowStockProducts: DashboardService.getLowStockProducts,
  getAllDashboardData: DashboardService.getAllDashboardData,
  refreshDashboardData: DashboardService.refreshDashboardData,
  getDashboardSummary: DashboardService.getDashboardSummary,
};
