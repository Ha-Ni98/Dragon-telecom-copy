// Statistics domain (admin statistics page) — Sub-01 scaffolding. See catalog.service.ts's
// header comment for the numeric-id/view-model scope decision this follows.
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

const EMPTY_OVERVIEW: AdminStatisticsOverview = {
  totalRevenue: 0,
  totalProfit: 0,
  totalProductValue: 0,
  totalClientCredit: 0,
  totalSupplierCredit: 0,
};

export class AdminStatisticsService {
  static async getOverviewStats(): Promise<AdminStatisticsOverview> {
    return EMPTY_OVERVIEW;
  }

  static async getFilteredStats(_dateRange: DateRange): Promise<AdminStatisticsFiltered> {
    return {
      totalRevenue: 0,
      totalProfit: 0,
      totalOrders: 0,
      period: '',
      previousPeriodComparison: { revenueChange: 0, profitChange: 0, ordersChange: 0 },
    };
  }

  static async getRevenueData(_dateRange: DateRange, _family?: string): Promise<RevenueChartData[]> {
    return [];
  }

  static async getOrdersData(_dateRange: DateRange): Promise<OrdersChartData[]> {
    return [];
  }

  static async getClientsData(_dateRange: DateRange): Promise<ClientsChartData[]> {
    return [];
  }

  static async getSalesByFamilyData(_dateRange: DateRange): Promise<SalesByFamilyData[]> {
    return [];
  }

  static async getTopSellingProducts(_period: string): Promise<TopSellingProduct[]> {
    return [];
  }

  static async getAllStatisticsData(dateRange: DateRange, family?: string): Promise<AdminStatisticsResponse> {
    const [overview, filtered, revenueData, ordersData, clientsData, salesByFamilyData, topProducts] = await Promise.all([
      AdminStatisticsService.getOverviewStats(),
      AdminStatisticsService.getFilteredStats(dateRange),
      AdminStatisticsService.getRevenueData(dateRange, family),
      AdminStatisticsService.getOrdersData(dateRange),
      AdminStatisticsService.getClientsData(dateRange),
      AdminStatisticsService.getSalesByFamilyData(dateRange),
      AdminStatisticsService.getTopSellingProducts('all-time'),
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
  }

  static async refreshStatisticsData(dateRange: DateRange, family?: string): Promise<AdminStatisticsResponse> {
    return AdminStatisticsService.getAllStatisticsData(dateRange, family);
  }

  static async getStatisticsSummary(): Promise<{
    totalRevenue: number;
    totalOrders: number;
    totalClients: number;
    topFamily: string;
  }> {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      totalClients: 0,
      topFamily: 'N/A',
    };
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
      { type: 'weekly', startDate: startOfWeek, endDate: now, label: 'This Week' },
      { type: 'monthly', startDate: startOfMonth, endDate: now, label: 'This Month' },
      { type: 'yearly', startDate: startOfYear, endDate: now, label: 'This Year' },
    ];
  }
}

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
