import {
  OverviewResponseSchema,
  FilteredResponseSchema,
  ReportResponseSchema,
  AdminDashboardResponseSchema,
  StaffDashboardResponseSchema,
  ReportType,
  type OverviewDto,
  type FilteredDto,
  type ReportDto,
  type AdminDashboardDto,
  type StaffDashboardDto,
} from "@dragon-telecom/contract";
import type { ChartPoint, TopProductDto } from "@/services/statistics.service";
import { mockProductWithPricing } from "./catalog.mock";

export const mockOverview: OverviewDto = OverviewResponseSchema.parse({
  totalRevenue: 500_000,
  totalProfit: 120_000,
  stockValue: 800_000,
  totalClientCredit: 15_000,
  totalSupplierCredit: 5_000,
});

export const mockFiltered: FilteredDto = FilteredResponseSchema.parse({
  revenue: 50_000,
  profit: 12_000,
  orders: 24,
  revenueChangePct: 8.5,
  profitChangePct: 3.2,
  ordersChangePct: -1.1,
});

export const mockReport: ReportDto = ReportResponseSchema.parse({
  chart: [{ label: "2026-01", value: 10_000 }],
  rows: [{ productId: mockProductWithPricing.id, quantitySold: 12, revenue: 36_000 }],
  totals: { revenue: 36_000 },
  drill: { entity: "product", idField: "productId" },
});

export const mockReportType = ReportType.SALES_BY_PRODUCT;

// CHARTS / TOP_PRODUCTS have no contract schema at all — plain typed literals, matching the
// backend's own locally-declared (non-contract) shapes (statistics.service.ts's header comment).
export const mockChartPoints: ChartPoint[] = [
  { label: "2026-01", value: 10_000 },
  { label: "2026-02", value: 14_500 },
];

export const mockTopProducts: TopProductDto[] = [
  {
    productId: mockProductWithPricing.id,
    productName: mockProductWithPricing.name,
    brandName: mockProductWithPricing.brand.name,
    familyName: mockProductWithPricing.family.name,
    quantitySold: 42,
    revenue: 126_000,
    averagePrice: 3_000,
  },
];

export const mockAdminDashboard: AdminDashboardDto = AdminDashboardResponseSchema.parse({
  stats: {
    totalClients: 120,
    totalProducts: 340,
    ordersThisWeek: 18,
    revenueThisMonth: 500_000,
    totalClientsChangePct: 4.2,
    totalProductsChangePct: 1.1,
    ordersThisWeekChangePct: -2.5,
    revenueThisMonthChangePct: 9.8,
  },
  pendingOrders: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      reference: "ORD-0001",
      totalAmount: 15_000,
      placedAt: "2026-07-18T10:00:00.000Z",
    },
  ],
  pendingClients: [
    {
      id: "20000000-0000-4000-8000-000000000002",
      fullName: "Amine Belkacem",
      createdAt: "2026-07-17T09:00:00.000Z",
    },
  ],
  recentOrders: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      reference: "ORD-0001",
      totalAmount: 15_000,
      placedAt: "2026-07-18T10:00:00.000Z",
    },
  ],
  recentClients: [
    {
      id: "20000000-0000-4000-8000-000000000002",
      fullName: "Amine Belkacem",
      createdAt: "2026-07-17T09:00:00.000Z",
    },
  ],
  lowStockProducts: [
    {
      productId: mockProductWithPricing.id,
      name: mockProductWithPricing.name,
      availableQuantity: 2,
      reorderThreshold: 5,
    },
  ],
  repairsByStatus: { PENDING: 3, IN_PROGRESS: 2, COMPLETED: 10 },
  draftSalesByStaff: [
    { staffId: "20000000-0000-4000-8000-000000000003", staffName: "Sara Haddad", draftCount: 2 },
  ],
});

export const mockStaffDashboard: StaffDashboardDto = StaffDashboardResponseSchema.parse({
  mySalesToday: 5,
  myRevenueToday: 45_000,
  myDrafts: [{ reference: "SAL-0001", clientName: "Amine Belkacem", total: 8_500, ageHours: 2.5 }],
  myPendingOrdersCount: 3,
  lowStock: [
    {
      productId: mockProductWithPricing.id,
      name: mockProductWithPricing.name,
      availableQuantity: 2,
      reorderThreshold: 5,
    },
  ],
});
