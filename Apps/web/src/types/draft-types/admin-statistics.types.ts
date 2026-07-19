/**
 * Admin Statistics Types
 * Comprehensive type definitions for the admin statistics page
 */

// Date range selection
export interface DateRange {
  type: 'weekly' | 'monthly' | 'yearly' | 'custom';
  startDate: Date;
  endDate: Date;
  label: string;
}

// Overview statistics
export interface AdminStatisticsOverview {
  totalRevenue: number;
  totalProfit: number;
  totalProductValue: number;
  totalClientCredit: number;
  totalSupplierCredit: number;
}

// Filtered statistics
export interface AdminStatisticsFiltered {
  totalRevenue: number;
  totalProfit: number;
  totalOrders: number;
  period: string;
  previousPeriodComparison: {
    revenueChange: number;
    profitChange: number;
    ordersChange: number;
  };
}

// Chart data interfaces
export interface RevenueChartData {
  date: string;
  revenue: number;
  family?: string;
}

export interface OrdersChartData {
  date: string;
  total: number;
  completed: number;
  canceled: number;
  pending: number;
}

export interface ClientsChartData {
  month: string;
  newClients: number;
  totalClients: number;
  growthRate: number;
}

export interface SalesByFamilyData {
  familyName: string;
  sales: number;
  percentage: number;
  color: string;
  revenue: number;
}

// Top selling products
export interface TopSellingProduct {
  idProduct: number;
  productName: string;
  brandName: string;
  familyName: string;
  totalSold: number;
  revenue: number;
  image?: string;
  rank: number;
  averagePrice: number;
}

// Statistics filters
export interface AdminStatisticsFilters {
  dateRange: DateRange;
  selectedFamily?: string;
  selectedPeriod?: 'all-time' | 'month' | 'custom';
}

// Chart configuration
export interface ChartConfig {
  revenue: {
    color: string;
    label: string;
  };
  orders: {
    total: { color: string; label: string };
    completed: { color: string; label: string };
    canceled: { color: string; label: string };
    pending: { color: string; label: string };
  };
  clients: {
    newClients: { color: string; label: string };
    totalClients: { color: string; label: string };
  };
  salesByFamily: {
    colors: string[];
  };
}

// Statistics service response types
export interface AdminStatisticsResponse {
  overview: AdminStatisticsOverview;
  filtered: AdminStatisticsFiltered;
  charts: {
    revenue: RevenueChartData[];
    orders: OrdersChartData[];
    clients: ClientsChartData[];
    salesByFamily: SalesByFamilyData[];
  };
  topProducts: TopSellingProduct[];
}

// Hook return types
export interface UseAdminStatisticsReturn {
  overview: AdminStatisticsOverview | undefined;
  filtered: AdminStatisticsFiltered | undefined;
  charts: {
    revenue: RevenueChartData[];
    orders: OrdersChartData[];
    clients: ClientsChartData[];
    salesByFamily: SalesByFamilyData[];
  };
  topProducts: TopSellingProduct[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Component props types
export interface AdminStatisticsFiltersProps {
  selectedDateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  selectedFamily: string;
  onFamilyChange: (family: string) => void;
  families: Array<{ idFamily: number; familyName: string }>;
  loading?: boolean;
  className?: string;
}

export interface AdminStatisticsOverviewCardsProps {
  stats: AdminStatisticsOverview;
  loading?: boolean;
  className?: string;
}

export interface AdminStatisticsFilteredCardsProps {
  stats: AdminStatisticsFiltered;
  dateRange: DateRange;
  loading?: boolean;
  className?: string;
}

export interface AdminStatisticsChartsProps {
  revenueData: RevenueChartData[];
  ordersData: OrdersChartData[];
  clientsData: ClientsChartData[];
  salesByFamilyData: SalesByFamilyData[];
  selectedFamily?: string;
  loading?: boolean;
  className?: string;
}

export interface RevenueChartProps {
  data: RevenueChartData[];
  selectedFamily?: string;
  className?: string;
}

export interface OrdersTrendChartProps {
  data: OrdersChartData[];
  selectedFilter: 'all' | 'completed' | 'canceled' | 'pending';
  onFilterChange: (filter: string) => void;
  className?: string;
}

export interface ClientsChartProps {
  data: ClientsChartData[];
  className?: string;
}

export interface SalesByFamilyChartProps {
  data: SalesByFamilyData[];
  className?: string;
}

export interface TopSellingProductsProps {
  products: TopSellingProduct[];
  selectedPeriod: 'all-time' | 'month' | 'custom';
  onPeriodChange: (period: string) => void;
  loading?: boolean;
  className?: string;
}

// Utility types for date range generation
export interface DateRangePreset {
  type: DateRange['type'];
  label: string;
  getDateRange: () => DateRange;
}

// Error types
export interface StatisticsError {
  code: 'FETCH_ERROR' | 'PARSE_ERROR' | 'VALIDATION_ERROR';
  message: string;
  details?: unknown;
}
