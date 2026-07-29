// Statistics domain (admin dashboard) — Sub-01 scaffolding. See catalog.service.ts's header
// comment for the numeric-id/view-model scope decision this follows.
import { DashboardStats, RecentClient, RecentOrder, ProductWithStock, DashboardData } from "@/types/draft-types/dashboard.types";

const EMPTY_STATS: DashboardStats = {
  totalClients: 0,
  totalProducts: 0,
  ordersThisWeek: 0,
  revenueThisMonth: 0,
  clientChange: 0,
  productChange: 0,
  ordersChange: 0,
  revenueChange: 0,
};

export class DashboardService {
  static async getDashboardStats(): Promise<DashboardStats> {
    return EMPTY_STATS;
  }

  static async getRecentClients(_limit: number = 5): Promise<RecentClient[]> {
    return [];
  }

  static async getRecentOrders(_limit: number = 8): Promise<RecentOrder[]> {
    return [];
  }

  static async getLowStockProducts(_limit: number = 5): Promise<ProductWithStock[]> {
    return [];
  }

  static async getAllDashboardData(): Promise<DashboardData> {
    const [stats, recentClients, recentOrders, lowStockProducts] = await Promise.all([
      DashboardService.getDashboardStats(),
      DashboardService.getRecentClients(5),
      DashboardService.getRecentOrders(8),
      DashboardService.getLowStockProducts(5),
    ]);

    return { stats, recentClients, recentOrders, lowStockProducts };
  }

  static async refreshDashboardData(): Promise<DashboardData> {
    return DashboardService.getAllDashboardData();
  }

  static async getDashboardSummary(): Promise<{
    totalClients: number;
    totalProducts: number;
    pendingOrders: number;
    lowStockCount: number;
  }> {
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
  }
}

export const dashboardService = {
  getDashboardStats: DashboardService.getDashboardStats,
  getRecentClients: DashboardService.getRecentClients,
  getRecentOrders: DashboardService.getRecentOrders,
  getLowStockProducts: DashboardService.getLowStockProducts,
  getAllDashboardData: DashboardService.getAllDashboardData,
  refreshDashboardData: DashboardService.refreshDashboardData,
  getDashboardSummary: DashboardService.getDashboardSummary,
};
