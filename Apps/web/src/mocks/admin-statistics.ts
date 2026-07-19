/**
 * Mock data for admin statistics
 * Provides realistic data for statistics page components
 */

import { 
  AdminStatisticsOverview,
  AdminStatisticsFiltered,
  RevenueChartData,
  OrdersChartData,
  ClientsChartData,
  SalesByFamilyData,
  TopSellingProduct,
  DateRange
} from "@/types/draft-types/admin-statistics.types";

/**
 * Mock overview statistics
 * General statistics for the admin dashboard
 */
export const mockAdminStatisticsOverview: AdminStatisticsOverview = {
  totalRevenue: 245680.50,
  totalProfit: 48920.75,
  totalProductValue: 156780.25,
  totalClientCredit: 12450.00,
  totalSupplierCredit: 8750.30,
};

/**
 * Mock filtered statistics based on date range
 */
export function getAdminStatisticsFiltered(dateRange: DateRange): AdminStatisticsFiltered {
  // Simulate different data based on date range
  const baseRevenue = 45000;
  const baseProfit = 9000;
  const baseOrders = 150;

  let multiplier = 1;
  switch (dateRange.type) {
    case 'weekly':
      multiplier = 0.25;
      break;
    case 'monthly':
      multiplier = 1;
      break;
    case 'yearly':
      multiplier = 12;
      break;
    case 'custom':
      // Calculate based on actual date range
      const daysDiff = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
      multiplier = daysDiff / 30; // Assume monthly average
      break;
  }

  const revenue = baseRevenue * multiplier;
  const profit = baseProfit * multiplier;
  const orders = Math.round(baseOrders * multiplier);

  return {
    totalRevenue: revenue,
    totalProfit: profit,
    totalOrders: orders,
    period: dateRange.label,
    previousPeriodComparison: {
      revenueChange: Math.random() * 20 - 10, // -10% to +10%
      profitChange: Math.random() * 15 - 7.5, // -7.5% to +7.5%
      ordersChange: Math.random() * 25 - 12.5, // -12.5% to +12.5%
    },
  };
}

/**
 * Mock revenue chart data
 */
export function getRevenueChartData(dateRange: DateRange, family?: string): RevenueChartData[] {
  const data: RevenueChartData[] = [];
  const startDate = new Date(dateRange.startDate);
  const endDate = new Date(dateRange.endDate);
  
  // Generate data points based on date range
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const interval = Math.max(1, Math.floor(daysDiff / 10)); // Max 10 data points
  
  for (let i = 0; i < daysDiff; i += interval) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    // Generate realistic revenue data with some randomness
    const baseRevenue = 2000 + Math.random() * 3000;
    const revenue = family ? baseRevenue * (0.3 + Math.random() * 0.4) : baseRevenue;
    
    data.push({
      date: date.toISOString().split('T')[0],
      revenue: Math.round(revenue * 100) / 100,
      family: family || undefined,
    });
  }
  
  return data;
}

/**
 * Mock orders chart data
 */
export function getOrdersChartData(dateRange: DateRange): OrdersChartData[] {
  const data: OrdersChartData[] = [];
  const startDate = new Date(dateRange.startDate);
  const endDate = new Date(dateRange.endDate);
  
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const interval = Math.max(1, Math.floor(daysDiff / 10));
  
  for (let i = 0; i < daysDiff; i += interval) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const total = 5 + Math.floor(Math.random() * 20);
    const completed = Math.floor(total * (0.6 + Math.random() * 0.3));
    const canceled = Math.floor(total * (0.05 + Math.random() * 0.1));
    const pending = total - completed - canceled;
    
    data.push({
      date: date.toISOString().split('T')[0],
      total,
      completed,
      canceled,
      pending,
    });
  }
  
  return data;
}

/**
 * Mock clients chart data
 */
export function getClientsChartData(dateRange: DateRange): ClientsChartData[] {
  const data: ClientsChartData[] = [];
  const startDate = new Date(dateRange.startDate);
  const endDate = new Date(dateRange.endDate);
  
  // Generate monthly data
  const currentDate = new Date(startDate);
  let totalClients = 1000; // Starting point
  
  while (currentDate <= endDate) {
    const newClients = 15 + Math.floor(Math.random() * 30);
    totalClients += newClients;
    const growthRate = (newClients / (totalClients - newClients)) * 100;
    
    data.push({
      month: currentDate.toISOString().slice(0, 7), // YYYY-MM format
      newClients,
      totalClients,
      growthRate: Math.round(growthRate * 100) / 100,
    });
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return data;
}

/**
 * Mock sales by family data
 */
export function getSalesByFamilyData(dateRange: DateRange): SalesByFamilyData[] {
  const families = [
    { name: 'Smartphones', color: '#3B82F6', baseSales: 45000 },
    { name: 'Accessories', color: '#10B981', baseSales: 28000 },
    { name: 'Watches', color: '#F59E0B', baseSales: 15000 },
    { name: 'Batteries', color: '#EF4444', baseSales: 12000 },
    { name: 'Cables', color: '#8B5CF6', baseSales: 8000 },
    { name: 'Protection', color: '#06B6D4', baseSales: 6000 },
  ];
  
  // Calculate total sales
  const totalSales = families.reduce((sum, family) => sum + family.baseSales, 0);
  
  return families.map(family => ({
    familyName: family.name,
    sales: family.baseSales,
    percentage: Math.round((family.baseSales / totalSales) * 100 * 100) / 100,
    color: family.color,
    revenue: family.baseSales * (0.8 + Math.random() * 0.4), // Add some variation
  }));
}

/**
 * Mock top selling products
 */
export function getTopSellingProducts(period: string): TopSellingProduct[] {
  const products = [
    {
      idProduct: 1,
      productName: 'Samsung Galaxy S24 Ultra',
      brandName: 'Samsung',
      familyName: 'Smartphones',
      baseSold: 45,
      baseRevenue: 58000,
      averagePrice: 1299,
      image: '/api/placeholder/300/300'
    },
    {
      idProduct: 2,
      productName: 'iPhone 15 Pro Max',
      brandName: 'Apple',
      familyName: 'Smartphones',
      baseSold: 38,
      baseRevenue: 52000,
      averagePrice: 1199,
      image: '/api/placeholder/300/300'
    },
    {
      idProduct: 3,
      productName: 'AirPods Pro (2nd Gen)',
      brandName: 'Apple',
      familyName: 'Accessories',
      baseSold: 65,
      baseRevenue: 19500,
      averagePrice: 299,
      image: '/api/placeholder/300/300'
    },
    {
      idProduct: 4,
      productName: 'MacBook Pro M3',
      brandName: 'Apple',
      familyName: 'Laptops',
      baseSold: 12,
      baseRevenue: 24000,
      averagePrice: 1999,
      image: '/api/placeholder/300/300'
    },
    {
      idProduct: 5,
      productName: 'Sony WH-1000XM5',
      brandName: 'Sony',
      familyName: 'Accessories',
      baseSold: 28,
      baseRevenue: 8400,
      averagePrice: 299,
      image: '/api/placeholder/300/300'
    },
    {
      idProduct: 6,
      productName: 'OnePlus 12',
      brandName: 'OnePlus',
      familyName: 'Smartphones',
      baseSold: 22,
      baseRevenue: 17600,
      averagePrice: 799,
      image: '/api/placeholder/300/300'
    },
    {
      idProduct: 7,
      productName: 'iPad Air M2',
      brandName: 'Apple',
      familyName: 'Tablets',
      baseSold: 18,
      baseRevenue: 10800,
      averagePrice: 599,
      image: '/api/placeholder/300/300'
    },
    {
      idProduct: 8,
      productName: 'Samsung Galaxy Watch 6',
      brandName: 'Samsung',
      familyName: 'Watches',
      baseSold: 35,
      baseRevenue: 10500,
      averagePrice: 299,
      image: '/api/placeholder/300/300'
    },
    {
      idProduct: 9,
      productName: 'LG OLED C3 55"',
      brandName: 'LG',
      familyName: 'TVs',
      baseSold: 8,
      baseRevenue: 12000,
      averagePrice: 1499,
      image: '/api/placeholder/300/300'
    },
    {
      idProduct: 10,
      productName: 'Dell XPS 13',
      brandName: 'Dell',
      familyName: 'Laptops',
      baseSold: 15,
      baseRevenue: 19500,
      averagePrice: 1299,
      image: '/api/placeholder/300/300'
    },
  ];
  
  // Adjust quantities based on period
  let multiplier = 1;
  switch (period) {
    case 'month':
      multiplier = 0.3;
      break;
    case 'custom':
      multiplier = 0.5;
      break;
    case 'all-time':
    default:
      multiplier = 1;
      break;
  }
  
  return products
    .map((product, index) => ({
      ...product,
      totalSold: Math.round(product.baseSold * multiplier),
      revenue: Math.round(product.baseRevenue * multiplier * 100) / 100,
      rank: index + 1,
    }))
    .sort((a, b) => b.totalSold - a.totalSold)
    .map((product, index) => ({
      ...product,
      rank: index + 1,
    }));
}

/**
 * Helper function to get overview statistics
 */
export function getAdminStatisticsOverview(): AdminStatisticsOverview {
  return mockAdminStatisticsOverview;
}

/**
 * Helper function to generate date range data
 */
export function generateDateRangeData(type: DateRange['type']): DateRange {
  const now = new Date();
  let startDate: Date;
  let label: string;
  
  switch (type) {
    case 'weekly':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      label = 'Last 7 Days';
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      label = 'This Month';
      break;
    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1);
      label = 'This Year';
      break;
    case 'custom':
    default:
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      label = 'Last 30 Days';
      break;
  }
  
  return {
    type,
    startDate,
    endDate: now,
    label,
  };
}
