/**
 * Admin Statistics service layer
 * Handles data aggregation and business logic for admin statistics page
 */

import { 
  AdminStatisticsOverview,
  AdminStatisticsFiltered,
  RevenueChartData,
  OrdersChartData,
  ClientsChartData,
  SalesByFamilyData,
  TopSellingProduct,
  DateRange,
  AdminStatisticsResponse
} from "@/types/draft-types/admin-statistics.types";

// Import mock data functions (will be created in next task)
import {
  getAdminStatisticsOverview,
  getAdminStatisticsFiltered,
  getRevenueChartData,
  getOrdersChartData,
  getClientsChartData,
  getSalesByFamilyData,
  getTopSellingProducts
} from "@/mocks/admin-statistics";

/**
 * Admin Statistics service class
 * Provides methods for fetching and aggregating statistics data
 */
export class AdminStatisticsService {
  /**
   * Get overview statistics
   * Returns general statistics for the admin dashboard
   */
  static async getOverviewStats(): Promise<AdminStatisticsOverview> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      return getAdminStatisticsOverview();
    } catch (error) {
      console.error('Error fetching overview statistics:', error);
      throw new Error('Failed to fetch overview statistics');
    }
  }

  /**
   * Get filtered statistics based on date range
   * Returns statistics filtered by the specified date range
   */
  static async getFilteredStats(dateRange: DateRange): Promise<AdminStatisticsFiltered> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    try {
      return getAdminStatisticsFiltered(dateRange);
    } catch (error) {
      console.error('Error fetching filtered statistics:', error);
      throw new Error('Failed to fetch filtered statistics');
    }
  }

  /**
   * Get revenue chart data
   * Returns revenue data for chart visualization
   */
  static async getRevenueData(dateRange: DateRange, family?: string): Promise<RevenueChartData[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 350));
    
    try {
      return getRevenueChartData(dateRange, family);
    } catch (error) {
      console.error('Error fetching revenue chart data:', error);
      throw new Error('Failed to fetch revenue chart data');
    }
  }

  /**
   * Get orders chart data
   * Returns orders data for chart visualization
   */
  static async getOrdersData(dateRange: DateRange): Promise<OrdersChartData[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      return getOrdersChartData(dateRange);
    } catch (error) {
      console.error('Error fetching orders chart data:', error);
      throw new Error('Failed to fetch orders chart data');
    }
  }

  /**
   * Get clients chart data
   * Returns client registration data for chart visualization
   */
  static async getClientsData(dateRange: DateRange): Promise<ClientsChartData[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 250));
    
    try {
      return getClientsChartData(dateRange);
    } catch (error) {
      console.error('Error fetching clients chart data:', error);
      throw new Error('Failed to fetch clients chart data');
    }
  }

  /**
   * Get sales by family data
   * Returns sales distribution data by product family
   */
  static async getSalesByFamilyData(dateRange: DateRange): Promise<SalesByFamilyData[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      return getSalesByFamilyData(dateRange);
    } catch (error) {
      console.error('Error fetching sales by family data:', error);
      throw new Error('Failed to fetch sales by family data');
    }
  }

  /**
   * Get top selling products
   * Returns best-selling products based on period
   */
  static async getTopSellingProducts(period: string): Promise<TopSellingProduct[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      return getTopSellingProducts(period);
    } catch (error) {
      console.error('Error fetching top selling products:', error);
      throw new Error('Failed to fetch top selling products');
    }
  }

  /**
   * Get all statistics data
   * Aggregates all statistics data in a single call
   */
  static async getAllStatisticsData(dateRange: DateRange, family?: string): Promise<AdminStatisticsResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    try {
      const [
        overview,
        filtered,
        revenueData,
        ordersData,
        clientsData,
        salesByFamilyData,
        topProducts
      ] = await Promise.all([
        AdminStatisticsService.getOverviewStats(),
        AdminStatisticsService.getFilteredStats(dateRange),
        AdminStatisticsService.getRevenueData(dateRange, family),
        AdminStatisticsService.getOrdersData(dateRange),
        AdminStatisticsService.getClientsData(dateRange),
        AdminStatisticsService.getSalesByFamilyData(dateRange),
        AdminStatisticsService.getTopSellingProducts('all-time')
      ]);

      return {
        overview,
        filtered,
        charts: {
          revenue: revenueData,
          orders: ordersData,
          clients: clientsData,
          salesByFamily: salesByFamilyData,
        },
        topProducts,
      };
    } catch (error) {
      console.error('Error fetching all statistics data:', error);
      throw new Error('Failed to fetch statistics data');
    }
  }

  /**
   * Refresh statistics data
   * Forces a refresh of all statistics data
   */
  static async refreshStatisticsData(dateRange: DateRange, family?: string): Promise<AdminStatisticsResponse> {
    // Simulate longer delay for refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      return await AdminStatisticsService.getAllStatisticsData(dateRange, family);
    } catch (error) {
      console.error('Error refreshing statistics data:', error);
      throw new Error('Failed to refresh statistics data');
    }
  }

  /**
   * Get statistics summary
   * Returns a summary of key metrics for quick overview
   */
  static async getStatisticsSummary(): Promise<{
    totalRevenue: number;
    totalOrders: number;
    totalClients: number;
    topFamily: string;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      const [overview, salesByFamily] = await Promise.all([
        AdminStatisticsService.getOverviewStats(),
        AdminStatisticsService.getSalesByFamilyData({
          type: 'monthly',
          startDate: new Date(),
          endDate: new Date(),
          label: 'Current Month'
        })
      ]);

      const topFamily = salesByFamily.length > 0 ? salesByFamily[0].familyName : 'N/A';

      return {
        totalRevenue: overview.totalRevenue,
        totalOrders: 0, // This would come from filtered stats in real implementation
        totalClients: 0, // This would come from clients data in real implementation
        topFamily,
      };
    } catch (error) {
      console.error('Error fetching statistics summary:', error);
      throw new Error('Failed to fetch statistics summary');
    }
  }

  /**
   * Get date range presets
   * Returns predefined date ranges for quick selection
   */
  static getDateRangePresets(): DateRange[] {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return [
      {
        type: 'weekly',
        startDate: startOfWeek,
        endDate: now,
        label: 'This Week'
      },
      {
        type: 'monthly',
        startDate: startOfMonth,
        endDate: now,
        label: 'This Month'
      },
      {
        type: 'yearly',
        startDate: startOfYear,
        endDate: now,
        label: 'This Year'
      }
    ];
  }
}

/**
 * Export individual functions for convenience
 */
export const adminStatisticsService = {
  getOverviewStats: AdminStatisticsService.getOverviewStats,
  getFilteredStats: AdminStatisticsService.getFilteredStats,
  getRevenueData: AdminStatisticsService.getRevenueData,
  getOrdersData: AdminStatisticsService.getOrdersData,
  getClientsData: AdminStatisticsService.getClientsData,
  getSalesByFamilyData: AdminStatisticsService.getSalesByFamilyData,
  getTopSellingProducts: AdminStatisticsService.getTopSellingProducts,
  getAllStatisticsData: AdminStatisticsService.getAllStatisticsData,
  refreshStatisticsData: AdminStatisticsService.refreshStatisticsData,
  getStatisticsSummary: AdminStatisticsService.getStatisticsSummary,
  getDateRangePresets: AdminStatisticsService.getDateRangePresets,
};
